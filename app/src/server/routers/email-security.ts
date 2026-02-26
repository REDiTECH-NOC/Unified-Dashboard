/**
 * Email Security Router — tRPC procedures for email threat protection.
 *
 * Uses IEmailSecurityConnector via ConnectorFactory — never imports Avanan directly.
 * All security actions (quarantine, dismiss, exceptions) are audit-logged.
 * Supports MSP multi-tenant scoping.
 *
 * Includes MSP management (tenants, users, partners, licenses, usage),
 * task status polling, and full exception CRUD.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { IEmailSecurityConnector } from "../connectors/_interfaces/email-security";
import { auditLog } from "@/lib/audit";
import { cachedQuery } from "@/lib/query-cache";

async function getEmailSecurity(prisma: Parameters<typeof ConnectorFactory.get>[1]) {
  return ConnectorFactory.getByToolId("avanan", prisma) as unknown as IEmailSecurityConnector;
}

// ── Event stats aggregation: Redis-backed SWR via cachedQuery ──
type EventStatsResult = {
  total: number;
  totalRecords: number;
  byType: Record<string, number>;
  byState: Record<string, number>;
  bySeverity: Record<string, number>;
  byDay: Record<string, number>;
  byCustomer: Record<string, number>;
  byCustomerByType: Record<string, Record<string, number>>;
  days: number;
};
const STATS_STALE = 30 * 60_000; // 30 min — trigger background refresh
const TENANT_STALE = 10 * 60_000; // 10 min

/** Fetch all events from Avanan API and aggregate stats. Used by getEventStats. */
async function fetchEventStats(
  prisma: Parameters<typeof ConnectorFactory.get>[1],
  days: number,
  eventStates: string[] | undefined,
): Promise<EventStatsResult> {
  const connector = await getEmailSecurity(prisma);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const byType: Record<string, number> = {};
  const byState: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const byCustomerByType: Record<string, Record<string, number>> = {};
  let total = 0;
  let scrollId: string | undefined;

  const allowedStates = eventStates?.length
    ? new Set(eventStates.map((s) => s.toLowerCase()))
    : null;

  for (let page = 0; page < 500; page++) {
    let result;
    try {
      result = await connector.getSecurityEvents({ startDate, endDate }, scrollId);
    } catch (err) {
      console.error("[avanan] getEventStats page error:", err instanceof Error ? err.message : err);
      break;
    }

    for (const evt of result.data) {
      const raw = evt._raw as Record<string, unknown> | undefined;
      const type = (raw?.type as string) || "unknown";
      const state = (raw?.state as string) || "unknown";
      const severity = String((raw?.severity as string) || "0");
      const customerId = (raw?.customerId as string) || "unknown";
      const created = (raw?.eventCreated as string) || "";

      if (allowedStates && !allowedStates.has(state.toLowerCase())) continue;

      total++;
      byType[type] = (byType[type] || 0) + 1;
      byState[state] = (byState[state] || 0) + 1;
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
      byCustomer[customerId] = (byCustomer[customerId] || 0) + 1;

      if (!byCustomerByType[customerId]) byCustomerByType[customerId] = {};
      byCustomerByType[customerId][type] = (byCustomerByType[customerId][type] || 0) + 1;

      if (created) {
        const day = created.substring(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
      }
    }

    scrollId = result.nextCursor ? String(result.nextCursor) : undefined;
    if (!result.hasMore || !scrollId) break;
  }

  const data: EventStatsResult = {
    total,
    totalRecords: total,
    byType,
    byState,
    bySeverity,
    byDay,
    byCustomer,
    byCustomerByType,
    days,
  };

  console.log(`[avanan] Event stats refreshed: ${total} events`);
  return data;
}

export const emailSecurityRouter = router({
  // ═══════════════════════════════════════════════════════════════
  // Security Events (Threats)
  // ═══════════════════════════════════════════════════════════════

  getEvents: protectedProcedure
    .input(
      z.object({
        eventTypes: z.array(z.string()).optional(),
        eventStates: z.array(z.string()).optional(),
        severities: z.array(z.string()).optional(),
        saas: z.array(z.string()).optional(),
        eventIds: z.array(z.string()).optional(),
        confidenceIndicator: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        searchTerm: z.string().optional(),
        scope: z.string().optional(),
        scrollId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getSecurityEvents(
        {
          eventTypes: input.eventTypes,
          eventStates: input.eventStates,
          severities: input.severities,
          saas: input.saas,
          eventIds: input.eventIds,
          confidenceIndicator: input.confidenceIndicator,
          startDate: input.startDate,
          endDate: input.endDate,
          searchTerm: input.searchTerm,
          scope: input.scope,
        },
        input.scrollId,
      );
    }),

  getEventById: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        scope: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getSecurityEventById(input.eventId, input.scope);
    }),

  /**
   * Aggregated security event stats for dashboard.
   *
   * Uses Redis-backed stale-while-revalidate (via cachedQuery):
   * - If Redis has cached data (even stale), returns it INSTANTLY.
   * - If data is >30 min old, triggers a background refresh (non-blocking).
   * - Only blocks on the very first call with empty Redis cache.
   * - Data survives container restarts (persisted in Redis for 24h).
   */
  getEventStats: protectedProcedure
    .input(
      z.object({
        days: z.number().int().min(1).max(365).default(30),
        eventStates: z.array(z.string()).optional(),
      }).default({})
    )
    .query(async ({ ctx, input }) => {
      const key = `stats:${input.days}:${(input.eventStates || []).sort().join(",")}`;
      return cachedQuery<EventStatsResult>("avanan", STATS_STALE, key, () =>
        fetchEventStats(ctx.prisma, input.days, input.eventStates),
      );
    }),

  // ═══════════════════════════════════════════════════════════════
  // Secured Entities (Emails/Files)
  // ═══════════════════════════════════════════════════════════════

  searchEntities: protectedProcedure
    .input(
      z.object({
        saas: z.string().optional(),
        saasEntity: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        extendedFilters: z
          .array(
            z.object({
              attrName: z.string(),
              op: z.enum([
                "is",
                "contains",
                "startsWith",
                "isEmpty",
                "isNot",
                "notContains",
                "isNotEmpty",
                "greaterThan",
                "lessThan",
              ]),
              value: z.string(),
            })
          )
          .optional(),
        scope: z.string().optional(),
        scrollId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.searchEntities(
        {
          saas: input.saas,
          saasEntity: input.saasEntity,
          startDate: input.startDate,
          endDate: input.endDate,
          extendedFilters: input.extendedFilters,
          scope: input.scope,
        },
        input.scrollId,
      );
    }),

  getEntityById: protectedProcedure
    .input(
      z.object({
        entityId: z.string(),
        scope: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getEntityById(input.entityId, input.scope);
    }),

  // ═══════════════════════════════════════════════════════════════
  // Actions on Events
  // ═══════════════════════════════════════════════════════════════

  dismissEvent: adminProcedure
    .input(
      z.object({
        eventIds: z.array(z.string()).min(1),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const results = await connector.dismissEvent(input.eventIds, input.scope);

      await auditLog({
        action: "email_security.event.dismissed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `events:${input.eventIds.join(",")}`,
        detail: { count: input.eventIds.length, scope: input.scope },
      });

      return results;
    }),

  actionOnEvent: adminProcedure
    .input(
      z.object({
        eventIds: z.array(z.string()).min(1),
        actionName: z.string(),
        actionParam: z.string().optional(),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const results = await connector.actionOnEvent(
        input.eventIds,
        input.actionName,
        input.actionParam,
        input.scope,
      );

      await auditLog({
        action: `email_security.event.${input.actionName}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `events:${input.eventIds.join(",")}`,
        detail: {
          actionName: input.actionName,
          actionParam: input.actionParam,
          count: input.eventIds.length,
          scope: input.scope,
        },
      });

      return results;
    }),

  // ═══════════════════════════════════════════════════════════════
  // Actions on Entities
  // ═══════════════════════════════════════════════════════════════

  quarantineEntity: adminProcedure
    .input(
      z.object({
        entityIds: z.array(z.string()).min(1),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const results = await connector.quarantineEntity(input.entityIds, input.scope);

      await auditLog({
        action: "email_security.entity.quarantined",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `entities:${input.entityIds.join(",")}`,
        detail: { count: input.entityIds.length, scope: input.scope },
      });

      return results;
    }),

  restoreEntity: adminProcedure
    .input(
      z.object({
        entityIds: z.array(z.string()).min(1),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const results = await connector.restoreEntity(input.entityIds, input.scope);

      await auditLog({
        action: "email_security.entity.restored",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `entities:${input.entityIds.join(",")}`,
        detail: { count: input.entityIds.length, scope: input.scope },
      });

      return results;
    }),

  actionOnEntity: adminProcedure
    .input(
      z.object({
        entityIds: z.array(z.string()).min(1),
        actionName: z.string(),
        actionParam: z.string().optional(),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const results = await connector.actionOnEntity(
        input.entityIds,
        input.actionName,
        input.actionParam,
        input.scope,
      );

      await auditLog({
        action: `email_security.entity.${input.actionName}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `entities:${input.entityIds.join(",")}`,
        detail: {
          actionName: input.actionName,
          actionParam: input.actionParam,
          count: input.entityIds.length,
          scope: input.scope,
        },
      });

      return results;
    }),

  // ═══════════════════════════════════════════════════════════════
  // Task Status (async action tracking)
  // ═══════════════════════════════════════════════════════════════

  getTaskStatus: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getTaskStatus(input.taskId);
    }),

  // ═══════════════════════════════════════════════════════════════
  // Exceptions (Allowlist/Blocklist)
  // ═══════════════════════════════════════════════════════════════

  getExceptions: protectedProcedure
    .input(
      z.object({
        type: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getExceptions(input.type);
    }),

  createUrlException: adminProcedure
    .input(
      z.object({
        type: z.string(),
        value: z.string().min(1),
        comment: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        fileName: z.string().optional(),
        createdByEmail: z.string().optional(),
        isExclusive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.createUrlException(input);

      await auditLog({
        action: "email_security.exception.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `exception:${input.type}:${input.value}`,
        detail: { type: input.type, value: input.value, comment: input.comment },
      });

      return { success: true };
    }),

  updateException: adminProcedure
    .input(
      z.object({
        vendor: z.string(),
        excId: z.string(),
        value: z.string().optional(),
        comment: z.string().optional(),
        isExclusive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.updateException(input.vendor, input.excId, {
        value: input.value,
        comment: input.comment,
        isExclusive: input.isExclusive,
      });

      await auditLog({
        action: "email_security.exception.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `exception:${input.vendor}:${input.excId}`,
        detail: { vendor: input.vendor, excId: input.excId },
      });

      return { success: true };
    }),

  deleteException: adminProcedure
    .input(
      z.object({
        vendor: z.string(),
        excId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.deleteException(input.vendor, input.excId);

      await auditLog({
        action: "email_security.exception.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `exception:${input.vendor}:${input.excId}`,
        detail: { vendor: input.vendor, excId: input.excId },
      });

      return { success: true };
    }),

  getWhitelist: protectedProcedure
    .input(z.object({ vendor: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getWhitelist(input.vendor);
    }),

  getBlacklist: protectedProcedure
    .input(z.object({ vendor: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getBlacklist(input.vendor);
    }),

  createWhitelistEntry: adminProcedure
    .input(
      z.object({
        vendor: z.string(),
        type: z.string(),
        value: z.string().min(1),
        comment: z.string().optional(),
        createdByEmail: z.string().optional(),
        isExclusive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.createWhitelistEntry(input.vendor, {
        type: input.type,
        value: input.value,
        comment: input.comment,
        createdByEmail: input.createdByEmail,
        isExclusive: input.isExclusive,
      });

      await auditLog({
        action: "email_security.whitelist.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `whitelist:${input.vendor}:${input.value}`,
        detail: { vendor: input.vendor, type: input.type, value: input.value },
      });

      return { success: true };
    }),

  createBlacklistEntry: adminProcedure
    .input(
      z.object({
        vendor: z.string(),
        type: z.string(),
        value: z.string().min(1),
        comment: z.string().optional(),
        createdByEmail: z.string().optional(),
        isExclusive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.createBlacklistEntry(input.vendor, {
        type: input.type,
        value: input.value,
        comment: input.comment,
        createdByEmail: input.createdByEmail,
        isExclusive: input.isExclusive,
      });

      await auditLog({
        action: "email_security.blacklist.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `blacklist:${input.vendor}:${input.value}`,
        detail: { vendor: input.vendor, type: input.type, value: input.value },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Multi-Tenant
  // ═══════════════════════════════════════════════════════════════

  getScopes: protectedProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.getScopes();
  }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Tenant Management (SmartAPI)
  // ═══════════════════════════════════════════════════════════════

  listTenants: adminProcedure.query(async ({ ctx }) => {
    return cachedQuery("avanan", TENANT_STALE, "tenants", async () => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.listTenants();
    });
  }),

  describeTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.describeTenant(input.tenantId);
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Licenses (SmartAPI)
  // ═══════════════════════════════════════════════════════════════

  listLicenses: adminProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.listLicenses();
  }),

  listAddOns: adminProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.listAddOns();
  }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Users (SmartAPI)
  // ═══════════════════════════════════════════════════════════════

  listUsers: adminProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.listUsers();
  }),

  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.string().min(1),
        directLogin: z.boolean().optional(),
        samlLogin: z.boolean().optional(),
        sendAlerts: z.boolean().optional(),
        receiveWeeklyReports: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const user = await connector.createUser(input);

      await auditLog({
        action: "email_security.msp_user.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `msp_user:${input.email}`,
        detail: { email: input.email, role: input.role },
      });

      return user;
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.string().optional(),
        directLogin: z.boolean().optional(),
        samlLogin: z.boolean().optional(),
        sendAlerts: z.boolean().optional(),
        receiveWeeklyReports: z.boolean().optional(),
        // MSP-level fields (write-only — accepted by UPDATE, not returned by LIST)
        mspRole: z.enum(["Admin", "Help Desk"]).optional(),
        mspTenantAccess: z.enum(["All", "Except", "Only"]).optional(),
        mspTenants: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...updates } = input;
      const connector = await getEmailSecurity(ctx.prisma);
      const user = await connector.updateUser(userId, updates);

      await auditLog({
        action: "email_security.msp_user.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `msp_user:${userId}`,
        detail: { userId, updates },
      });

      return user;
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.deleteUser(input.userId);

      await auditLog({
        action: "email_security.msp_user.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `msp_user:${input.userId}`,
        detail: { userId: input.userId },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Usage (SmartAPI)
  // ═══════════════════════════════════════════════════════════════

  getUsage: adminProcedure
    .input(
      z.object({
        year: z.number().int().min(2020).max(2030),
        month: z.number().int().min(1).max(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getUsage(input.year, input.month);
    }),

  // ═══════════════════════════════════════════════════════════════
  // Download
  // ═══════════════════════════════════════════════════════════════

  downloadEntity: adminProcedure
    .input(
      z.object({
        entityId: z.string(),
        original: z.boolean().default(false),
        scope: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const buffer = await connector.downloadEntity(
        input.entityId,
        input.original,
        input.scope,
      );

      await auditLog({
        action: "email_security.entity.downloaded",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `entity:${input.entityId}`,
        detail: { original: input.original, scope: input.scope },
      });

      return {
        data: buffer.toString("base64"),
        filename: `${input.entityId}.eml`,
        contentType: "application/message/rfc822",
      };
    }),
});
