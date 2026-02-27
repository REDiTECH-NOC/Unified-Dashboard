/**
 * Blackpoint CompassOne Router — tRPC procedures for the full CompassOne API.
 *
 * Uses BlackpointConnector via ConnectorFactory.getByToolId("blackpoint").
 * All write operations are audit-logged.
 *
 * Categories: detections, assets, tenants, accounts, collections, cloud-mdr,
 *             vulnerability-management, notification-channels, users, contact-groups
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { BlackpointConnector } from "../connectors/blackpoint/connector";
import { auditLog } from "@/lib/audit";
import { cachedQuery } from "@/lib/query-cache";

/** Get the Blackpoint connector instance (always by toolId, not category) */
async function getBP(prisma: Parameters<typeof ConnectorFactory.getByToolId>[1]) {
  return ConnectorFactory.getByToolId("blackpoint", prisma) as Promise<BlackpointConnector>;
}

const BP_STALE = 10 * 60_000; // 10 min
const BP_TENANT_STALE = 30 * 60_000; // 30 min — tenants rarely change

/** Fetch all tenant IDs (cached). Most BP endpoints require x-tenant-id. */
async function getTenantIds(bp: BlackpointConnector): Promise<Array<{ id: string; name: string }>> {
  return cachedQuery("bp", BP_TENANT_STALE, "tenant-ids", () => bp.getTenantIds());
}

export const blackpointRouter = router({
  // =========================================================================
  // Detections (Alert Groups)
  // =========================================================================

  getDetections: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        status: z.array(z.string()).optional(),
        detectionType: z.string().optional(),
        search: z.string().optional(),
        since: z.date().optional(),
        sortByColumn: z.string().optional(),
        sortDirection: z.enum(["ASC", "DESC"]).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const dateKey = input.since?.toISOString().substring(0, 10) ?? "all";
      const tenantKey = input.tenantId ?? "all";
      const key = `det:${tenantKey}:${dateKey}:${input.take}:${input.detectionType ?? ""}`;
      const filter = {
        detectionType: input.detectionType,
        search: input.search,
        since: input.since,
        sortByColumn: input.sortByColumn,
        sortDirection: input.sortDirection,
      };

      return cachedQuery("bp", BP_STALE, key, async () => {
        const bp = await getBP(ctx.prisma);

        // If specific tenant requested, query directly
        if (input.tenantId) {
          return bp.getDetections(filter, input.skip, input.take, input.tenantId);
        }

        // Aggregate across all tenants
        const tenants = await getTenantIds(bp);
        const results = await Promise.allSettled(
          tenants.map(t => bp.getDetections(filter, 0, input.take, t.id))
        );

        const allData = results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getDetections>>> => r.status === "fulfilled")
          .flatMap(r => r.value.data);

        // Sort by detectedAt descending
        allData.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

        const totalCount = results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getDetections>>> => r.status === "fulfilled")
          .reduce((sum, r) => sum + (r.value.totalCount ?? 0), 0);

        return {
          data: allData.slice(input.skip, input.skip + input.take),
          hasMore: allData.length > input.skip + input.take,
          totalCount,
        };
      });
    }),

  getDetectionById: protectedProcedure
    .input(z.object({ id: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getDetectionById(input.id, input.tenantId);
      // Try each tenant until found
      const tenants = await getTenantIds(bp);
      for (const t of tenants) {
        try { return await bp.getDetectionById(input.id, t.id); } catch { /* try next */ }
      }
      throw new Error("Detection not found across any tenant");
    }),

  getDetectionAlerts: protectedProcedure
    .input(
      z.object({
        alertGroupId: z.string(),
        tenantId: z.string().optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getDetectionAlerts(input.alertGroupId, input.skip, input.take, input.tenantId);
      const tenants = await getTenantIds(bp);
      const errors: string[] = [];
      for (const t of tenants) {
        try { return await bp.getDetectionAlerts(input.alertGroupId, input.skip, input.take, t.id); } catch (e) { errors.push(`${t.id}: ${(e as Error).message}`); }
      }
      console.error(`[blackpoint] getDetectionAlerts failed for ${input.alertGroupId} across ${tenants.length} tenants:`, errors);
      throw new Error("Detection alerts not found across any tenant");
    }),

  getDetectionCount: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        detectionType: z.string().optional(),
        since: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const filter = { detectionType: input.detectionType, since: input.since };
      if (input.tenantId) return bp.getDetectionCount(filter, input.tenantId);
      // Sum across all tenants
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getDetectionCount(filter, t.id))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
        .reduce((sum, r) => sum + r.value, 0);
    }),

  getDetectionsByWeek: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getDetectionsByWeek(input.startDate, input.endDate, input.tenantId);
      // Aggregate across tenants
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getDetectionsByWeek(input.startDate, input.endDate, t.id))
      );
      const weekMap = new Map<string, number>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const w of r.value) {
            const key = w.date.toISOString();
            weekMap.set(key, (weekMap.get(key) ?? 0) + w.count);
          }
        }
      }
      return Array.from(weekMap.entries())
        .map(([date, count]) => ({ date: new Date(date), count }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
    }),

  getTopDetectionsByEntity: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getTopDetectionsByEntity(input.startDate, input.endDate, input.limit, input.tenantId);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getTopDetectionsByEntity(input.startDate, input.endDate, input.limit, t.id))
      );
      const entityMap = new Map<string, number>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const e of r.value) entityMap.set(e.name, (entityMap.get(e.name) ?? 0) + e.count);
        }
      }
      return Array.from(entityMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit);
    }),

  getTopDetectionsByThreat: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getTopDetectionsByThreat(input.startDate, input.endDate, input.limit, input.tenantId);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getTopDetectionsByThreat(input.startDate, input.endDate, input.limit, t.id))
      );
      const threatMap = new Map<string, { count: number }>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const e of r.value) {
            const existing = threatMap.get(e.name);
            threatMap.set(e.name, { count: (existing?.count ?? 0) + e.count });
          }
        }
      }
      const total = Array.from(threatMap.values()).reduce((s, v) => s + v.count, 0);
      return Array.from(threatMap.entries())
        .map(([name, v]) => ({ name, count: v.count, percentage: total > 0 ? Math.round((v.count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, input.limit);
    }),

  // =========================================================================
  // Assets
  // =========================================================================

  getAssets: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        assetClass: z.string().optional(),
        search: z.string().optional(),
        sortByColumn: z.string().optional(),
        sortDirection: z.enum(["ASC", "DESC"]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const filter = {
        assetClass: input.assetClass,
        search: input.search,
        sortByColumn: input.sortByColumn,
        sortDirection: input.sortDirection,
      };
      if (input.tenantId) return bp.getAssets(filter, input.page, input.pageSize, input.tenantId);
      // Aggregate across tenants
      const tenants = await getTenantIds(bp);
      console.log(`[blackpoint] getAssets: querying ${tenants.length} tenants`);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getAssets(filter, 1, input.pageSize, t.id))
      );
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length > 0) console.error(`[blackpoint] getAssets: ${failed.length}/${tenants.length} tenants failed:`, failed.map(r => r.reason?.message ?? r.reason));
      const allData = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getAssets>>> => r.status === "fulfilled")
        .flatMap(r => r.value.data);
      const totalCount = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getAssets>>> => r.status === "fulfilled")
        .reduce((sum, r) => sum + (r.value.totalCount ?? 0), 0);
      console.log(`[blackpoint] getAssets: ${allData.length} assets, ${totalCount} total`);
      return { data: allData.slice(0, input.pageSize), hasMore: allData.length > input.pageSize, totalCount };
    }),

  getAssetById: protectedProcedure
    .input(z.object({ id: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getAssetById(input.id, input.tenantId);
      const tenants = await getTenantIds(bp);
      for (const t of tenants) {
        try { return await bp.getAssetById(input.id, t.id); } catch { /* try next */ }
      }
      throw new Error("Asset not found across any tenant");
    }),

  getAssetRelationships: protectedProcedure
    .input(
      z.object({
        assetId: z.string(),
        tenantId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getAssetRelationships(input.assetId, input.page, input.pageSize, input.tenantId);
      const tenants = await getTenantIds(bp);
      for (const t of tenants) {
        try { return await bp.getAssetRelationships(input.assetId, input.page, input.pageSize, t.id); } catch { /* try next */ }
      }
      throw new Error("Asset relationships not found");
    }),

  // =========================================================================
  // Tenants
  // =========================================================================

  getTenants: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenants(input.page, input.pageSize);
    }),

  getTenantById: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenantById(input.accountId, input.tenantId);
    }),

  // =========================================================================
  // Accounts
  // =========================================================================

  getAccounts: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccounts(input.skip, input.take);
    }),

  getAccountById: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccountById(input.accountId);
    }),

  // =========================================================================
  // Collections
  // =========================================================================

  getCollections: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCollections(input.skip, input.take);
    }),

  getCollectionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCollectionById(input.id);
    }),

  createCollection: adminProcedure
    .input(
      z.object({
        context: z.string(),
        name: z.string(),
        search: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createCollection(input as Parameters<typeof bp.createCollection>[0]);
      await auditLog({
        action: "blackpoint.collection.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  updateCollection: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.updateCollection(input.id, { name: input.name, search: input.search });
      await auditLog({
        action: "blackpoint.collection.update",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${input.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  deleteCollection: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteCollection(input.id);
      await auditLog({
        action: "blackpoint.collection.delete",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${input.id}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Cloud MDR — M365
  // =========================================================================

  getMs365Connections: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365Connections(input.tenantId);
    }),

  getMs365ConnectionById: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365ConnectionById(input.connectionId);
    }),

  getMs365ApprovedCountries: protectedProcedure
    .input(z.object({ connectionId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365ApprovedCountries(input.connectionId, input.tenantId);
    }),

  approveMs365Country: adminProcedure
    .input(z.object({ connectionId: z.string(), isoCountryCode: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.approveMs365Country(input.connectionId, input.isoCountryCode);
      await auditLog({
        action: "blackpoint.ms365.country.approve",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `connection:${input.connectionId}`,
        detail: { country: input.isoCountryCode },
      });
      return { success: true };
    }),

  removeMs365ApprovedCountry: adminProcedure
    .input(z.object({ connectionId: z.string(), isoCountryCode: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.removeMs365ApprovedCountry(input.connectionId, input.isoCountryCode);
      await auditLog({
        action: "blackpoint.ms365.country.remove",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `connection:${input.connectionId}`,
        detail: { country: input.isoCountryCode },
      });
      return { success: true };
    }),

  getMs365Users: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        tenantId: z.string().optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365Users(input.connectionId, input.skip, input.take, input.tenantId);
    }),

  // =========================================================================
  // Cloud MDR — Generic Connections
  // =========================================================================

  getConnectionApprovedCountries: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getConnectionApprovedCountries(input.connectionId, input.skip, input.take);
    }),

  getConnectionUsers: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getConnectionUsers(input.connectionId, input.skip, input.take);
    }),

  getIsoCountries: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getIsoCountries();
    }),

  // =========================================================================
  // Cloud MDR — Google
  // =========================================================================

  getGoogleOnboardings: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getGoogleOnboardings();
    }),

  getGoogleOnboardingById: protectedProcedure
    .input(z.object({ onboardingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getGoogleOnboardingById(input.onboardingId);
    }),

  // =========================================================================
  // Cloud MDR — Cisco Duo
  // =========================================================================

  getCiscoDuoOnboardings: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCiscoDuoOnboardings();
    }),

  getCiscoDuoOnboardingById: protectedProcedure
    .input(z.object({ onboardingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCiscoDuoOnboardingById(input.onboardingId);
    }),

  createCiscoDuoOnboarding: adminProcedure
    .input(
      z.object({
        host: z.string().optional(),
        ikey: z.string().optional(),
        skey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createCiscoDuoOnboarding(input);
      await auditLog({
        action: "blackpoint.cisco.onboarding.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `onboarding:${result.id}`,
      });
      return result;
    }),

  deleteCiscoDuoOnboarding: adminProcedure
    .input(z.object({ onboardingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteCiscoDuoOnboarding(input.onboardingId);
      await auditLog({
        action: "blackpoint.cisco.onboarding.delete",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `onboarding:${input.onboardingId}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Vulnerability Management — Vulnerabilities
  // =========================================================================

  getVulnerabilities: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getVulnerabilities(input.page, input.pageSize, input.tenantId);
      const tenants = await getTenantIds(bp);
      console.log(`[blackpoint] getVulnerabilities: querying ${tenants.length} tenants`);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getVulnerabilities(1, input.pageSize, t.id))
      );
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed.length > 0) console.error(`[blackpoint] getVulnerabilities: ${failed.length}/${tenants.length} failed:`, failed.map(r => r.reason?.message ?? r.reason));
      const allData = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getVulnerabilities>>> => r.status === "fulfilled")
        .flatMap(r => r.value.data);
      const totalCount = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getVulnerabilities>>> => r.status === "fulfilled")
        .reduce((sum, r) => sum + (r.value.meta?.totalItems ?? 0), 0);
      console.log(`[blackpoint] getVulnerabilities: ${allData.length} vulns, ${totalCount} total`);
      return { data: allData.slice(0, input.pageSize), meta: { currentPage: 1, totalItems: totalCount, totalPages: Math.ceil(totalCount / input.pageSize), pageSize: input.pageSize } };
    }),

  getVulnerabilityById: protectedProcedure
    .input(z.object({ id: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getVulnerabilityById(input.id, input.tenantId);
      const tenants = await getTenantIds(bp);
      for (const t of tenants) {
        try { return await bp.getVulnerabilityById(input.id, t.id); } catch { /* try next */ }
      }
      throw new Error("Vulnerability not found");
    }),

  getVulnerabilityAssets: protectedProcedure
    .input(
      z.object({
        vulnId: z.string(),
        tenantId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getVulnerabilityAssets(input.vulnId, input.page, input.pageSize, input.tenantId);
      const tenants = await getTenantIds(bp);
      for (const t of tenants) {
        try { return await bp.getVulnerabilityAssets(input.vulnId, input.page, input.pageSize, t.id); } catch { /* try next */ }
      }
      throw new Error("Vulnerability assets not found");
    }),

  getVulnerabilitySeverityStats: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input?.tenantId) return bp.getVulnerabilitySeverityStats(input.tenantId);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getVulnerabilitySeverityStats(t.id))
      );
      const severityMap = new Map<string, number>();
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const s of r.value) severityMap.set(s.severity, (severityMap.get(s.severity) ?? 0) + s.count);
        }
      }
      return Array.from(severityMap.entries()).map(([severity, count]) => ({ severity, count }));
    }),

  getVulnerabilityTenantStats: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getVulnerabilityTenantStats(t.id))
      );
      return results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getVulnerabilityTenantStats>>> => r.status === "fulfilled")
        .flatMap(r => r.value);
    }),

  // =========================================================================
  // Vulnerability Management — CVEs
  // =========================================================================

  getCveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCveById(input.id);
    }),

  getCveReferences: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCveReferences(input.id);
    }),

  // =========================================================================
  // Vulnerability Management — Scans
  // =========================================================================

  getScans: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScans(input.skip, input.take);
    }),

  getScanById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanById(input.id);
    }),

  createScan: adminProcedure
    .input(
      z.object({
        type: z.enum(["darkweb", "external", "local", "network"]),
        tenantId: z.string(),
        config: z.record(z.unknown()).optional(),
        assetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createScan(input);
      await auditLog({
        action: "blackpoint.scan.create",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${result.id}`,
        detail: { type: input.type, tenantId: input.tenantId },
      });
      return result;
    }),

  cancelScan: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.cancelScan(input.id);
      await auditLog({
        action: "blackpoint.scan.cancel",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${input.id}`,
      });
      return { success: true };
    }),

  deleteScan: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteScan(input.id);
      await auditLog({
        action: "blackpoint.scan.delete",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${input.id}`,
      });
      return { success: true };
    }),

  getScanCves: protectedProcedure
    .input(
      z.object({
        scanId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanCves(input.scanId, input.skip, input.take);
    }),

  // =========================================================================
  // Vulnerability Management — Scan Schedules
  // =========================================================================

  getScanSchedules: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanSchedules(input.skip, input.take);
    }),

  getScanScheduleById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanScheduleById(input.id);
    }),

  createScanSchedule: adminProcedure
    .input(
      z.object({
        type: z.enum(["darkweb", "external", "local", "network"]),
        tenantId: z.string(),
        name: z.string(),
        time: z.string(),
        frequency: z.enum(["daily", "monthly", "once", "weekly"]),
        config: z.record(z.unknown()).optional(),
        frequencyConfig: z.record(z.unknown()).optional(),
        assetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createScanSchedule(input);
      await auditLog({
        action: "blackpoint.scanSchedule.create",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${result.id}`,
        detail: { name: input.name, type: input.type },
      });
      return result;
    }),

  runScanSchedule: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.runScanSchedule(input.id);
      await auditLog({
        action: "blackpoint.scanSchedule.run",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${input.id}`,
      });
      return { success: true };
    }),

  deleteScanSchedule: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteScanSchedule(input.id);
      await auditLog({
        action: "blackpoint.scanSchedule.delete",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${input.id}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Vulnerability Management — Scans & Schedules Combined
  // =========================================================================

  getScansAndSchedules: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input.tenantId) return bp.getScansAndSchedules(input.page, input.pageSize, input.tenantId);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getScansAndSchedules(1, input.pageSize, t.id))
      );
      const allData = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getScansAndSchedules>>> => r.status === "fulfilled")
        .flatMap(r => r.value.data);
      const totalCount = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof bp.getScansAndSchedules>>> => r.status === "fulfilled")
        .reduce((sum, r) => sum + (r.value.meta?.totalItems ?? 0), 0);
      return { data: allData.slice(0, input.pageSize), meta: { currentPage: 1, totalItems: totalCount, totalPages: Math.ceil(totalCount / input.pageSize), pageSize: input.pageSize } };
    }),

  getScansAndSchedulesStats: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      if (input?.tenantId) return bp.getScansAndSchedulesStats(input.tenantId);
      const tenants = await getTenantIds(bp);
      const results = await Promise.allSettled(
        tenants.map(t => bp.getScansAndSchedulesStats(t.id))
      );
      const totals: Record<string, number> = {};
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const [k, v] of Object.entries(r.value)) {
            if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
          }
        }
      }
      return totals;
    }),

  // =========================================================================
  // Vulnerability Management — External & Dark Web
  // =========================================================================

  getExternalScanExposures: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getExternalScanExposures(input.id);
    }),

  getExternalScanReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getExternalScanReport(input.id);
    }),

  getDarkwebScanExposures: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDarkwebScanExposures(input.tenantId);
    }),

  getDarkwebScanReport: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDarkwebScanReport(input.tenantId);
    }),

  // =========================================================================
  // Notification Channels
  // =========================================================================

  getChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getChannels(input.accountId, input.tenantId);
    }),

  getEmailChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getEmailChannels(input.accountId, input.tenantId);
    }),

  createEmailChannel: adminProcedure
    .input(
      z.object({
        name: z.string(),
        emails: z.array(z.string().email()),
        enabled: z.boolean(),
        accountId: z.string(),
        tenantId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createEmailChannel(input);
      await auditLog({
        action: "blackpoint.emailChannel.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `emailChannel:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  getWebhookChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getWebhookChannels(input.accountId, input.tenantId);
    }),

  createWebhookChannel: adminProcedure
    .input(
      z.object({
        name: z.string(),
        enabled: z.boolean(),
        accountId: z.string(),
        url: z.string().url(),
        apiSecretNameHeader: z.string(),
        headers: z.record(z.unknown()),
        tenantId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createWebhookChannel(input);
      await auditLog({
        action: "blackpoint.webhookChannel.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `webhookChannel:${result.id}`,
        detail: { name: input.name, url: input.url },
      });
      return result;
    }),

  testEmailChannel: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.testEmailChannel(input.id);
      await auditLog({
        action: "blackpoint.email_channel.tested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `bp-email-channel:${input.id}`,
      });
      return { success: true };
    }),

  testWebhookChannel: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.testWebhookChannel(input.id);
      await auditLog({
        action: "blackpoint.webhook_channel.tested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `bp-webhook-channel:${input.id}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Users
  // =========================================================================

  getUsers: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getUsers(input.skip, input.take);
    }),

  getAccountUsers: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccountUsers(input.accountId, input.skip, input.take);
    }),

  getTenantUsers: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        tenantId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenantUsers(input.accountId, input.tenantId, input.skip, input.take);
    }),

  // =========================================================================
  // Contact Groups
  // =========================================================================

  getContactGroups: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroups(input.accountId);
    }),

  getContactGroupById: protectedProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroupById(input.accountId, input.contactGroupId);
    }),

  getContactGroupMembers: protectedProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroupMembers(input.accountId, input.contactGroupId);
    }),

  createContactGroup: adminProcedure
    .input(
      z.object({
        accountId: z.string(),
        name: z.string(),
        type: z.enum(["Informational", "Urgent", "Urgent & Informational"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createContactGroup(input.accountId, {
        name: input.name,
        type: input.type,
      });
      await auditLog({
        action: "blackpoint.contactGroup.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `contactGroup:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  deleteContactGroup: adminProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteContactGroup(input.accountId, input.contactGroupId);
      await auditLog({
        action: "blackpoint.contactGroup.delete",
        category: "API",
        actorId: ctx.user.id,
        resource: `contactGroup:${input.contactGroupId}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Health Check
  // =========================================================================

  healthCheck: protectedProcedure.query(async ({ ctx }) => {
    const bp = await getBP(ctx.prisma);
    return bp.healthCheck();
  }),
});
