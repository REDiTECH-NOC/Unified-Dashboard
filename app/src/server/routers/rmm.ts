/**
 * RMM Router — tRPC procedures for device monitoring, management, and fleet data.
 *
 * Uses IRmmConnector via ConnectorFactory for standard device/alert queries.
 * Fleet queries read from Redis cache (populated by FleetRefreshService).
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { cachedQuery } from "@/lib/query-cache";
import { NinjaOneRmmConnector } from "../connectors/ninjaone/connector";
import { auditLog } from "@/lib/audit";
import {
  getFleetData,
  getFleetRefreshStatus,
  invalidateFleetCache,
  type FleetEndpoint,
} from "@/lib/fleet-cache";
import {
  refreshFleetData,
  refreshSingleEndpoint,
} from "../services/fleet-refresh";

// ─── Helper: Resolve companyId to NinjaOne orgId via mapping ─────

async function resolveNinjaOrgId(
  prisma: any,
  companyId: string
): Promise<string | null> {
  const mapping = await prisma.companyIntegrationMapping.findUnique({
    where: { companyId_toolId: { companyId, toolId: "ninjaone" } },
    select: { externalId: true },
  });
  return mapping?.externalId ?? null;
}

// ─── Helper: Filter fleet data by NinjaOne orgId ─────────────────

function filterByOrg<T extends { organizationId?: number; references?: { organization?: { id: number } } }>(
  data: T[],
  orgId: string | null
): T[] {
  if (!orgId) return data;
  const orgIdNum = Number(orgId);
  return data.filter(
    (item) =>
      item.organizationId === orgIdNum ||
      item.references?.organization?.id === orgIdNum
  );
}

// ── In-memory stale-while-revalidate cache for alert queries ──
const _rmmCache: import("@/lib/query-cache").QueryCacheMap = new Map();
const _rmmBg = new Set<string>();
const RMM_STALE = 10 * 60_000; // 10 min

export const rmmRouter = router({
  // ─── Devices ─────────────────────────────────────────────

  getDevices: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        status: z.enum(["online", "offline"]).optional(),
        deviceType: z.string().optional(),
        os: z.string().optional(),
        searchTerm: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDevices(
        {
          organizationId: input.organizationId,
          status: input.status,
          deviceType: input.deviceType,
          os: input.os,
          searchTerm: input.searchTerm,
        },
        input.cursor,
        input.pageSize
      );
    }),

  getDeviceById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceById(input.id);
    }),

  getDeviceCustomFields: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceCustomFields(input.id);
    }),

  getDevicesByCompany: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
      if (!orgId) return { data: [], hasMore: false };

      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDevices(
        { organizationId: orgId },
        input.cursor,
        input.pageSize
      );
    }),

  // ─── Alerts ──────────────────────────────────────────────

  getAlerts: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        severity: z.string().optional(),
        status: z.string().optional(),
        deviceId: z.string().optional(),
        createdAfter: z.date().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateKey = input.createdAfter?.toISOString().substring(0, 10) ?? "all";
      const key = `rmm:${dateKey}:${input.pageSize}:${input.severity ?? ""}:${input.status ?? ""}`;

      return cachedQuery(_rmmCache, _rmmBg, RMM_STALE, key, async () => {
        const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
        return rmm.getAlerts(
          {
            organizationId: input.organizationId,
            severity: input.severity,
            status: input.status,
            deviceId: input.deviceId,
            createdAfter: input.createdAfter,
          },
          input.cursor,
          input.pageSize
        );
      });
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      await rmm.acknowledgeAlert(input.id);

      await auditLog({
        action: "rmm.alert.acknowledged",
        category: "API",
        actorId: ctx.user.id,
        resource: `alert:${input.id}`,
      });

      return { success: true };
    }),

  // ─── Organizations ───────────────────────────────────────

  getOrganizations: protectedProcedure
    .input(z.object({ searchTerm: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getOrganizations(input.searchTerm);
    }),

  getOrganizationById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getOrganizationById(input.id);
    }),

  // ─── Software & Patches ─────────────────────────────────

  getDeviceSoftware: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceSoftware(input.deviceId);
    }),

  getDevicePatches: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDevicePatches(input.deviceId);
    }),

  getDeviceWindowsServices: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceWindowsServices(input.deviceId);
    }),

  // ─── Activities ──────────────────────────────────────────

  getDeviceActivities: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceActivities(
        input.deviceId,
        input.cursor,
        input.pageSize
      );
    }),

  // ─── Fleet Queries (cached in Redis) ─────────────────────

  getFleetHealth: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("device-health");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetOsDistribution: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("operating-systems");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetVolumeStatus: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("volumes");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetAvStatus: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("antivirus-status");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetAvThreats: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("antivirus-threats");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetPatchCompliance: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("os-patch-installs");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetHardwareInventory: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("computer-systems");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetBackupStatus: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("backup-jobs");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetSoftwareInventory: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("software");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  getFleetProcessors: protectedProcedure
    .input(z.object({ companyId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const cache = await getFleetData("processors");
      if (!cache) return { data: null, isRefreshing: true, cachedAt: null };

      let data = cache.data as Array<any>;
      if (input?.companyId) {
        const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
        data = filterByOrg(data, orgId);
      }

      return { data, isRefreshing: false, cachedAt: cache.cachedAt, isStale: cache.isStale };
    }),

  // ─── Fleet Summary (aggregated stats for one company) ────

  getCompanyFleetSummary: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = await resolveNinjaOrgId(ctx.prisma, input.companyId);
      if (!orgId) {
        return {
          mapped: false,
          deviceCount: 0,
          onlineCount: 0,
          offlineCount: 0,
          patchComplianceRate: null,
          avCoverageRate: null,
          devicesNeedingReboot: 0,
        };
      }

      const healthCache = await getFleetData("device-health");
      if (!healthCache) {
        return {
          mapped: true,
          deviceCount: null,
          onlineCount: null,
          offlineCount: null,
          patchComplianceRate: null,
          avCoverageRate: null,
          devicesNeedingReboot: null,
        };
      }

      const devices = filterByOrg(healthCache.data as Array<any>, orgId);
      const onlineCount = devices.filter((d: any) => !d.offline).length;
      const offlineCount = devices.filter((d: any) => d.offline).length;

      // AV status
      const avCache = await getFleetData("antivirus-status");
      let avCoverageRate: number | null = null;
      if (avCache) {
        const avDevices = filterByOrg(avCache.data as Array<any>, orgId);
        const withAv = avDevices.filter(
          (d: any) => d.realTimeProtectionEnabled
        ).length;
        avCoverageRate =
          avDevices.length > 0
            ? Math.round((withAv / avDevices.length) * 100)
            : 100;
      }

      return {
        mapped: true,
        deviceCount: devices.length,
        onlineCount,
        offlineCount,
        patchComplianceRate: null, // computed when patch cache is available
        avCoverageRate,
        devicesNeedingReboot: 0, // computed from OS data when available
      };
    }),

  // ─── Fleet Cache Management ──────────────────────────────

  getFleetRefreshStatus: protectedProcedure.query(async () => {
    const status = await getFleetRefreshStatus();
    return { endpoints: status };
  }),

  triggerFleetRefresh: adminProcedure
    .input(
      z.object({
        endpoint: z
          .enum([
            "device-health",
            "processors",
            "volumes",
            "operating-systems",
            "computer-systems",
            "software",
            "antivirus-status",
            "antivirus-threats",
            "os-patch-installs",
            "backup-jobs",
          ])
          .optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      await auditLog({
        action: "rmm.fleet.refresh.triggered",
        category: "API",
        actorId: ctx.user.id,
        detail: { endpoint: input?.endpoint ?? "all" },
      });

      if (input?.endpoint) {
        return refreshSingleEndpoint(ctx.prisma, input.endpoint as FleetEndpoint);
      }
      return refreshFleetData(ctx.prisma);
    }),

  invalidateFleetCache: adminProcedure
    .input(
      z.object({
        endpoint: z
          .enum([
            "device-health",
            "processors",
            "volumes",
            "operating-systems",
            "computer-systems",
            "software",
            "antivirus-status",
            "antivirus-threats",
            "os-patch-installs",
            "backup-jobs",
          ])
          .optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      await invalidateFleetCache(input?.endpoint as FleetEndpoint | undefined);

      await auditLog({
        action: "rmm.fleet.cache.invalidated",
        category: "API",
        actorId: ctx.user.id,
        detail: { endpoint: input?.endpoint ?? "all" },
      });

      return { success: true };
    }),

  // ─── Webhook Management ──────────────────────────────────

  configureWebhook: adminProcedure
    .input(
      z.object({
        webhookUrl: z.string().url(),
        activityTypes: z
          .array(z.enum(["CONDITION", "DEVICE", "SYSTEM", "USER", "ACTIONSET"]))
          .min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connector = (await ConnectorFactory.get(
        "rmm",
        ctx.prisma
      )) as NinjaOneRmmConnector;
      await connector.configureWebhook(input.webhookUrl, input.activityTypes);

      await auditLog({
        action: "rmm.webhook.configured",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: {
          webhookUrl: input.webhookUrl,
          activityTypes: input.activityTypes,
        },
      });

      return { success: true };
    }),

  deleteWebhook: adminProcedure.mutation(async ({ ctx }) => {
    const connector = (await ConnectorFactory.get(
      "rmm",
      ctx.prisma
    )) as NinjaOneRmmConnector;
    await connector.deleteWebhook();

    await auditLog({
      action: "rmm.webhook.deleted",
      category: "INTEGRATION",
      actorId: ctx.user.id,
    });

    return { success: true };
  }),
});
