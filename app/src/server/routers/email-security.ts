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

async function getEmailSecurity(prisma: Parameters<typeof ConnectorFactory.get>[1]) {
  return ConnectorFactory.getByToolId("avanan", prisma) as unknown as IEmailSecurityConnector;
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
  // MSP Tenant Management
  // ═══════════════════════════════════════════════════════════════

  listTenants: adminProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.listTenants();
  }),

  createTenant: adminProcedure
    .input(
      z.object({
        tenantName: z.string().min(1),
        adminEmail: z.string().email(),
        licenses: z
          .array(
            z.object({
              licenseId: z.string(),
              quantity: z.number().int().positive(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const tenant = await connector.createTenant(input);

      await auditLog({
        action: "email_security.msp.tenant.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${tenant.tenantId}`,
        detail: { tenantName: input.tenantName, adminEmail: input.adminEmail },
      });

      return tenant;
    }),

  describeTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.describeTenant(input.tenantId);
    }),

  deleteTenant: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.deleteTenant(input.tenantId);

      await auditLog({
        action: "email_security.msp.tenant.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantId}`,
        detail: { tenantId: input.tenantId },
      });

      return { success: true };
    }),

  updateTenantLicenses: adminProcedure
    .input(
      z.object({
        tenantId: z.string(),
        licenses: z.array(
          z.object({
            licenseId: z.string(),
            quantity: z.number().int().positive(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.updateTenantLicenses(input.tenantId, input.licenses);

      await auditLog({
        action: "email_security.msp.tenant.licenses_updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `tenant:${input.tenantId}`,
        detail: { tenantId: input.tenantId, licenses: input.licenses },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Licenses
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
  // MSP Partners
  // ═══════════════════════════════════════════════════════════════

  listPartners: adminProcedure.query(async ({ ctx }) => {
    const connector = await getEmailSecurity(ctx.prisma);
    return connector.listPartners();
  }),

  createPartner: adminProcedure
    .input(
      z.object({
        partnerName: z.string().min(1),
        adminEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const partner = await connector.createPartner(input);

      await auditLog({
        action: "email_security.msp.partner.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `partner:${partner.partnerId}`,
        detail: { partnerName: input.partnerName },
      });

      return partner;
    }),

  deletePartner: adminProcedure
    .input(z.object({ partnerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.deletePartner(input.partnerId);

      await auditLog({
        action: "email_security.msp.partner.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `partner:${input.partnerId}`,
        detail: { partnerId: input.partnerId },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Users
  // ═══════════════════════════════════════════════════════════════

  listUsers: adminProcedure
    .input(z.object({ tenantId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.listUsers(input?.tenantId);
    }),

  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.string(),
        tenantId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      const user = await connector.createUser(input);

      await auditLog({
        action: "email_security.msp.user.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `user:${user.userId}`,
        detail: { email: input.email, role: input.role, tenantId: input.tenantId },
      });

      return user;
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, ...update } = input;
      const connector = await getEmailSecurity(ctx.prisma);
      const user = await connector.updateUser(userId, update);

      await auditLog({
        action: "email_security.msp.user.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `user:${userId}`,
        detail: { userId, ...update },
      });

      return user;
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      await connector.deleteUser(input.userId);

      await auditLog({
        action: "email_security.msp.user.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `user:${input.userId}`,
        detail: { userId: input.userId },
      });

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════
  // MSP Usage
  // ═══════════════════════════════════════════════════════════════

  getUsage: adminProcedure
    .input(
      z.object({
        period: z.enum(["monthly", "daily"]),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connector = await getEmailSecurity(ctx.prisma);
      return connector.getUsage(input.period, input.startDate, input.endDate);
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
