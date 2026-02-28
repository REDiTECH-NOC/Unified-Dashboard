/**
 * Keeper Router — tRPC procedures for Keeper Security MSP management.
 *
 * Uses IPasswordManagerConnector via ConnectorFactory.
 * All routes are read-only (monitoring/reporting, no account lifecycle actions yet).
 */

import { z } from "zod";
import { router, requirePerm } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { IPasswordManagerConnector } from "../connectors/_interfaces/password-manager";

async function getKeeper(prisma: Parameters<typeof ConnectorFactory.getByToolId>[1]) {
  return ConnectorFactory.getByToolId("keeper", prisma) as Promise<IPasswordManagerConnector>;
}

export const keeperRouter = router({
  // ─── Managed Companies ──────────────────────────────────────────

  listCompanies: requirePerm("keeper.view").query(async ({ ctx }) => {
    const keeper = await getKeeper(ctx.prisma);
    const companies = await keeper.listManagedCompanies();

    // Fetch current usage for all companies in parallel
    const companyIds = companies.map((c) => c.sourceId);
    let usageMap = new Map<string, Awaited<ReturnType<IPasswordManagerConnector["getCompanyUsage"]>>[number]>();

    if (companyIds.length > 0) {
      try {
        const usageData = await keeper.getCompanyUsage(companyIds);
        usageMap = new Map(usageData.map((u) => [u.companyId, u]));
      } catch {
        // Usage fetch may fail — still return companies without usage data
      }
    }

    // Merge usage into company data
    return companies.map((company) => {
      const usage = usageMap.get(company.sourceId);
      return {
        ...company,
        licensesUsed: usage?.licensesUsed ?? company.licensesUsed,
        storageUsedBytes: usage?.storageUsedBytes ?? company.storageUsedBytes,
        totalUsers: usage?.totalUsers ?? 0,
        activeUsers: usage?.activeUsers ?? 0,
        totalRecords: usage?.totalRecords ?? 0,
        totalSharedFolders: usage?.totalSharedFolders ?? 0,
        totalTeams: usage?.totalTeams ?? 0,
        securityAuditScore: usage?.securityAuditScore,
        breachWatchRecordsAtRisk: usage?.breachWatchRecordsAtRisk,
      };
    });
  }),

  // ─── Company Detail ─────────────────────────────────────────────

  getCompanyDetail: requirePerm("keeper.view")
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const keeper = await getKeeper(ctx.prisma);
      const [usage] = await keeper.getCompanyUsage([input.companyId]);
      return usage ?? null;
    }),

  // ─── Monthly Usage ──────────────────────────────────────────────

  getMonthlyUsage: requirePerm("keeper.view")
    .input(
      z.object({
        companyIds: z.array(z.string()),
        month: z.string().regex(/^\d{4}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const keeper = await getKeeper(ctx.prisma);
      return keeper.getMonthlyUsage(input.companyIds, input.month);
    }),

  // ─── Products ───────────────────────────────────────────────────

  getProducts: requirePerm("keeper.view").query(async ({ ctx }) => {
    const keeper = await getKeeper(ctx.prisma);
    return keeper.getProducts();
  }),
});
