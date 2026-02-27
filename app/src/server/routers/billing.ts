/**
 * Billing Router — contract reconciliation / Gradient MSP replacement.
 *
 * Manages product mappings, reconciliation runs, vendor count syncing,
 * and CW agreement addition write-back.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { ConnectWisePsaConnector } from "../connectors/connectwise/connector";
import type { SentinelOneEdrConnector } from "../connectors/sentinelone/connector";
import type { Pax8LicensingConnector } from "../connectors/pax8/connector";
import type { AvananEmailSecurityConnector } from "../connectors/avanan/connector";
import { auditLog } from "@/lib/audit";
import {
  reconcileCompany,
  getVendorCountsForCompany,
  getAllVendorCounts,
  getLiveVendorCount,
} from "../services/billing-reconciliation";
import { refreshCompanyAgreements } from "./company";

export const billingRouter = router({
  // ─── Reconciliation Summary ──────────────────────────────

  /** Global reconciliation stats from the latest snapshot per company */
  getReconciliationSummary: protectedProcedure.query(async ({ ctx }) => {
    const latestSnapshots = await ctx.prisma.reconciliationSnapshot.findMany({
      where: { status: "completed" },
      orderBy: { snapshotAt: "desc" },
      distinct: ["companyId"],
      select: { id: true },
    });

    const snapshotIds = latestSnapshots.map((s) => s.id);

    if (snapshotIds.length === 0) {
      return {
        totalItems: 0,
        discrepancies: 0,
        totalRevenueImpact: 0,
        matchedCount: 0,
        companiesWithIssues: 0,
        lastSyncAt: null,
      };
    }

    const items = await ctx.prisma.reconciliationItem.findMany({
      where: { snapshotId: { in: snapshotIds } },
      select: {
        discrepancy: true,
        revenueImpact: true,
        companyId: true,
        status: true,
      },
    });

    const companiesWithIssues = new Set(
      items.filter((i) => i.discrepancy !== 0 && i.status === "pending").map((i) => i.companyId)
    ).size;

    const pending = items.filter((i) => i.status === "pending");

    const lastSync = await ctx.prisma.reconciliationSnapshot.findFirst({
      where: { status: "completed" },
      orderBy: { snapshotAt: "desc" },
      select: { snapshotAt: true },
    });

    return {
      totalItems: items.length,
      discrepancies: pending.filter((i) => i.discrepancy !== 0).length,
      totalRevenueImpact: pending.reduce((sum, i) => sum + (i.revenueImpact ?? 0), 0),
      matchedCount: items.filter((i) => i.discrepancy === 0 || i.status !== "pending").length,
      companiesWithIssues,
      lastSyncAt: lastSync?.snapshotAt ?? null,
    };
  }),

  // ─── Company Billing Summaries (main landing page) ─────

  /** Returns per-company billing summary for the company list page */
  getCompanyBillingSummaries: protectedProcedure.query(async ({ ctx }) => {
    // Get all companies with agreements
    const companies = await ctx.prisma.company.findMany({
      where: {
        agreements: { some: { cancelledFlag: false } },
        syncEnabled: true,
      },
      select: { id: true, name: true, identifier: true },
      orderBy: { name: "asc" },
    });

    if (companies.length === 0) return [];

    const companyIds = companies.map((c) => c.id);

    // Latest snapshot per company
    const latestSnapshots = await ctx.prisma.reconciliationSnapshot.findMany({
      where: { status: "completed", companyId: { in: companyIds } },
      orderBy: { snapshotAt: "desc" },
      distinct: ["companyId"],
      select: { id: true, companyId: true, snapshotAt: true },
    });

    const snapshotMap = new Map(latestSnapshots.map((s) => [s.companyId, s]));
    const snapshotIds = latestSnapshots.map((s) => s.id);

    // Get all items from latest snapshots
    const items = snapshotIds.length > 0
      ? await ctx.prisma.reconciliationItem.findMany({
          where: { snapshotId: { in: snapshotIds } },
          select: {
            companyId: true,
            vendorToolId: true,
            discrepancy: true,
            revenueImpact: true,
            status: true,
          },
        })
      : [];

    // Group items by company
    const itemsByCompany = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByCompany.get(item.companyId) ?? [];
      list.push(item);
      itemsByCompany.set(item.companyId, list);
    }

    // Get vendor tools per company from integration mappings
    const mappings = await ctx.prisma.companyIntegrationMapping.findMany({
      where: {
        companyId: { in: companyIds },
        toolId: { in: ["ninjaone", "sentinelone", "cove", "pax8", "blackpoint", "avanan"] },
      },
      select: { companyId: true, toolId: true },
    });

    const toolsByCompany = new Map<string, Set<string>>();
    for (const m of mappings) {
      const tools = toolsByCompany.get(m.companyId) ?? new Set<string>();
      tools.add(m.toolId);
      toolsByCompany.set(m.companyId, tools);
    }

    return companies.map((company) => {
      const companyItems = itemsByCompany.get(company.id) ?? [];
      const snapshot = snapshotMap.get(company.id);
      const pendingItems = companyItems.filter((i) => i.status === "pending");
      const discrepancyCount = pendingItems.filter((i) => i.discrepancy !== 0).length;
      const revenueImpact = pendingItems.reduce((sum, i) => sum + (i.revenueImpact ?? 0), 0);
      const vendorTools = Array.from(toolsByCompany.get(company.id) ?? new Set<string>());

      return {
        id: company.id,
        name: company.name,
        identifier: company.identifier,
        vendorTools,
        totalItems: companyItems.length,
        discrepancies: discrepancyCount,
        revenueImpact,
        lastSyncAt: snapshot?.snapshotAt ?? null,
      };
    });
  }),

  // ─── Reconciliation Items (main table) ───────────────────

  getReconciliationItems: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        vendorToolId: z.string().optional(),
        status: z.enum(["pending", "approved", "dismissed", "adjusted"]).optional(),
        discrepancyOnly: z.boolean().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      const latestSnapshots = await ctx.prisma.reconciliationSnapshot.findMany({
        where: { status: "completed" },
        orderBy: { snapshotAt: "desc" },
        distinct: ["companyId"],
        select: { id: true },
      });
      where.snapshotId = { in: latestSnapshots.map((s) => s.id) };

      if (input.companyId) where.companyId = input.companyId;
      if (input.vendorToolId) where.vendorToolId = input.vendorToolId;
      if (input.status) where.status = input.status;
      if (input.discrepancyOnly) where.discrepancy = { not: 0 };
      if (input.search) {
        where.OR = [
          { productName: { contains: input.search, mode: "insensitive" } },
          { vendorProductName: { contains: input.search, mode: "insensitive" } },
          { agreementName: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.prisma.reconciliationItem.findMany({
          where: where as any,
          orderBy: [{ discrepancy: "desc" }, { createdAt: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            snapshot: { select: { snapshotAt: true } },
          },
        }),
        ctx.prisma.reconciliationItem.count({ where: where as any }),
      ]);

      const companyIds = Array.from(new Set(items.map((i) => i.companyId)));
      const companies = await ctx.prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });
      const companyMap = new Map(companies.map((c) => [c.id, c.name]));

      return {
        items: items.map((item) => ({
          ...item,
          companyName: companyMap.get(item.companyId) ?? "Unknown",
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  // ─── Per-Company Reconciliation Detail ───────────────────

  getCompanyReconciliation: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findUniqueOrThrow({
        where: { id: input.companyId },
        select: { id: true, name: true, psaSourceId: true, identifier: true },
      });

      const agreements = await ctx.prisma.companyAgreement.findMany({
        where: { companyId: input.companyId, cancelledFlag: false },
        include: {
          additions: {
            where: { cancelledFlag: false },
            orderBy: { productName: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const latestSnapshot = await ctx.prisma.reconciliationSnapshot.findFirst({
        where: { companyId: input.companyId, status: "completed" },
        orderBy: { snapshotAt: "desc" },
      });

      const reconciliationItems = latestSnapshot
        ? await ctx.prisma.reconciliationItem.findMany({
            where: { snapshotId: latestSnapshot.id },
            orderBy: [{ discrepancy: "desc" }],
          })
        : [];

      const integrationMappings = await ctx.prisma.companyIntegrationMapping.findMany({
        where: {
          companyId: input.companyId,
          toolId: { in: ["ninjaone", "sentinelone", "cove", "pax8", "blackpoint", "avanan"] },
        },
      });

      return {
        company,
        agreements,
        reconciliationItems,
        integrationMappings,
        lastSnapshotAt: latestSnapshot?.snapshotAt ?? null,
      };
    }),

  // ─── Reconciliation Actions ──────────────────────────────

  reconcileCompany: adminProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Refresh CW agreements + additions from the CW API first
      // so reconciliation compares against the latest billed quantities
      try {
        await refreshCompanyAgreements(ctx.prisma, input.companyId);
      } catch (err) {
        console.error("[Billing] CW agreement refresh failed, proceeding with cached data:", err);
      }

      const result = await reconcileCompany(
        input.companyId,
        ctx.prisma,
        ctx.user.id
      );

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_RECONCILE",
        category: "DATA",
        detail: {
          companyId: input.companyId,
          companyName: result.companyName,
          totalItems: result.totalItems,
          discrepancies: result.discrepancies,
        },
      });

      return result;
    }),

  reconcileAll: adminProcedure.mutation(async ({ ctx }) => {
    const companies = await ctx.prisma.company.findMany({
      where: {
        agreements: { some: { cancelledFlag: false } },
        syncEnabled: true,
      },
      select: { id: true, name: true },
    });

    const results: Array<{ companyId: string; companyName: string; discrepancies: number; error?: string }> = [];

    for (const company of companies) {
      try {
        // Refresh CW agreements + additions before reconciling
        try {
          await refreshCompanyAgreements(ctx.prisma, company.id);
        } catch {
          // Non-fatal — proceed with cached data
        }
        const result = await reconcileCompany(company.id, ctx.prisma, ctx.user.id);
        results.push({
          companyId: company.id,
          companyName: company.name,
          discrepancies: result.discrepancies,
        });
      } catch (err) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          discrepancies: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    await auditLog({
      actorId: ctx.user.id,
      action: "BILLING_RECONCILE_ALL",
      category: "DATA",
      detail: {
        companiesProcessed: results.length,
        totalDiscrepancies: results.reduce((sum, r) => sum + r.discrepancies, 0),
      },
    });

    return results;
  }),

  resolveItem: adminProcedure
    .input(
      z.object({
        itemId: z.string(),
        action: z.enum(["approve", "dismiss"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const statusMap = { approve: "approved", dismiss: "dismissed" } as const;

      const item = await ctx.prisma.reconciliationItem.update({
        where: { id: input.itemId },
        data: {
          status: statusMap[input.action],
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          resolvedNote: input.note ?? null,
        },
      });

      // Get company name for activity log
      const company = await ctx.prisma.company.findUnique({
        where: { id: item.companyId },
        select: { name: true },
      });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_RESOLVE_ITEM",
        category: "DATA",
        detail: {
          itemId: input.itemId,
          action: input.action,
          companyId: item.companyId,
          productName: item.productName,
        },
      });

      // Activity log entry
      await ctx.prisma.billingActivityEntry.create({
        data: {
          companyId: item.companyId,
          companyName: company?.name ?? "Unknown",
          agreementName: item.agreementName,
          productName: item.productName,
          vendorToolId: item.vendorToolId,
          vendorProductName: item.vendorProductName,
          psaQty: item.psaQty,
          vendorQty: item.vendorQty,
          change: item.discrepancy,
          action: input.action === "approve" ? "approved" : "dismissed",
          result: "success",
          resultNote: input.note ?? (input.action === "approve" ? "Approved by user" : "Dismissed by user"),
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email,
          snapshotId: item.snapshotId,
          reconciliationItemId: item.id,
        },
      });

      return item;
    }),

  bulkResolveItems: adminProcedure
    .input(
      z.object({
        itemIds: z.array(z.string()),
        action: z.enum(["approve", "dismiss"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const statusMap = { approve: "approved", dismiss: "dismissed" } as const;

      // Fetch items before update for activity logging
      const items = await ctx.prisma.reconciliationItem.findMany({
        where: { id: { in: input.itemIds } },
      });

      await ctx.prisma.reconciliationItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: {
          status: statusMap[input.action],
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          resolvedNote: input.note ?? null,
        },
      });

      // Get company names for activity log
      const companyIds = Array.from(new Set(items.map((i) => i.companyId)));
      const companies = await ctx.prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });
      const companyMap = new Map(companies.map((c) => [c.id, c.name]));

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_BULK_RESOLVE",
        category: "DATA",
        detail: {
          itemIds: input.itemIds,
          action: input.action,
          count: input.itemIds.length,
        },
      });

      // Activity log entries for each item
      for (const item of items) {
        await ctx.prisma.billingActivityEntry.create({
          data: {
            companyId: item.companyId,
            companyName: companyMap.get(item.companyId) ?? "Unknown",
            agreementName: item.agreementName,
            productName: item.productName,
            vendorToolId: item.vendorToolId,
            vendorProductName: item.vendorProductName,
            psaQty: item.psaQty,
            vendorQty: item.vendorQty,
            change: item.discrepancy,
            action: input.action === "approve" ? "approved" : "dismissed",
            result: "success",
            resultNote: input.note ?? `Bulk ${input.action}`,
            actorId: ctx.user.id,
            actorName: ctx.user.name ?? ctx.user.email,
            snapshotId: item.snapshotId,
            reconciliationItemId: item.id,
          },
        });
      }

      return { updated: input.itemIds.length };
    }),

  // ─── Reconcile to PSA (write-back) ──────────────────────

  reconcileItemToPsa: adminProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.reconciliationItem.findUniqueOrThrow({
        where: { id: input.itemId },
      });

      if (!item.additionPsaId || !item.agreementPsaId) {
        throw new Error("Cannot reconcile: no PSA addition linked to this item");
      }

      const mapping = await ctx.prisma.companyIntegrationMapping.findFirst({
        where: { companyId: item.companyId, toolId: item.vendorToolId },
      });
      if (!mapping) {
        throw new Error(`No integration mapping found for ${item.vendorToolId}`);
      }

      const liveCount = await getLiveVendorCount(
        item.vendorToolId,
        mapping.externalId,
        ctx.prisma,
        item.vendorProductKey ?? undefined
      );

      const psa = (await ConnectorFactory.get(
        "psa",
        ctx.prisma
      )) as ConnectWisePsaConnector;

      const oldQty = item.psaQty;
      await psa.updateAgreementAdditionQty(
        item.agreementPsaId,
        item.additionPsaId,
        liveCount
      );

      await ctx.prisma.agreementAddition.updateMany({
        where: { psaSourceId: item.additionPsaId },
        data: { quantity: liveCount, lastSyncedAt: new Date() },
      });

      await ctx.prisma.reconciliationItem.update({
        where: { id: input.itemId },
        data: {
          status: "adjusted",
          psaQty: liveCount,
          vendorQty: liveCount,
          discrepancy: 0,
          revenueImpact: 0,
          resolvedBy: ctx.user.id,
          resolvedAt: new Date(),
          resolvedNote: `Updated PSA qty from ${oldQty} to ${liveCount}`,
        },
      });

      // Get company name for activity log
      const company = await ctx.prisma.company.findUnique({
        where: { id: item.companyId },
        select: { name: true },
      });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_RECONCILE_TO_PSA",
        category: "DATA",
        detail: {
          companyId: item.companyId,
          product: item.productName,
          vendor: item.vendorToolId,
          productKey: item.vendorProductKey,
          oldQty,
          newQty: liveCount,
          agreementPsaId: item.agreementPsaId,
          additionPsaId: item.additionPsaId,
        },
      });

      // Activity log: synced to PSA
      await ctx.prisma.billingActivityEntry.create({
        data: {
          companyId: item.companyId,
          companyName: company?.name ?? "Unknown",
          agreementName: item.agreementName,
          productName: item.productName,
          vendorToolId: item.vendorToolId,
          vendorProductName: item.vendorProductName,
          psaQty: oldQty,
          vendorQty: liveCount,
          change: liveCount - oldQty,
          effectiveDate: new Date(),
          action: "synced_to_psa",
          result: "success",
          resultNote: `PSA qty updated: ${oldQty} → ${liveCount}`,
          actorId: ctx.user.id,
          actorName: ctx.user.name ?? ctx.user.email,
          snapshotId: item.snapshotId,
          reconciliationItemId: item.id,
        },
      });

      return { oldQty, newQty: liveCount, productName: item.productName };
    }),

  bulkReconcileToPsa: adminProcedure
    .input(z.object({ itemIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const results: Array<{
        itemId: string;
        productName: string;
        oldQty: number;
        newQty: number;
        error?: string;
      }> = [];

      for (const itemId of input.itemIds) {
        try {
          const item = await ctx.prisma.reconciliationItem.findUniqueOrThrow({
            where: { id: itemId },
          });

          if (!item.additionPsaId || !item.agreementPsaId) {
            results.push({
              itemId,
              productName: item.productName,
              oldQty: item.psaQty,
              newQty: item.psaQty,
              error: "No PSA addition linked",
            });
            continue;
          }

          const mapping = await ctx.prisma.companyIntegrationMapping.findFirst({
            where: { companyId: item.companyId, toolId: item.vendorToolId },
          });
          if (!mapping) {
            results.push({
              itemId,
              productName: item.productName,
              oldQty: item.psaQty,
              newQty: item.psaQty,
              error: `No mapping for ${item.vendorToolId}`,
            });
            continue;
          }

          const liveCount = await getLiveVendorCount(
            item.vendorToolId,
            mapping.externalId,
            ctx.prisma,
            item.vendorProductKey ?? undefined
          );

          const psa = (await ConnectorFactory.get(
            "psa",
            ctx.prisma
          )) as ConnectWisePsaConnector;

          await psa.updateAgreementAdditionQty(
            item.agreementPsaId,
            item.additionPsaId,
            liveCount
          );

          await ctx.prisma.agreementAddition.updateMany({
            where: { psaSourceId: item.additionPsaId },
            data: { quantity: liveCount, lastSyncedAt: new Date() },
          });

          await ctx.prisma.reconciliationItem.update({
            where: { id: itemId },
            data: {
              status: "adjusted",
              psaQty: liveCount,
              vendorQty: liveCount,
              discrepancy: 0,
              revenueImpact: 0,
              resolvedBy: ctx.user.id,
              resolvedAt: new Date(),
              resolvedNote: `Bulk update: PSA qty from ${item.psaQty} to ${liveCount}`,
            },
          });

          // Activity log: bulk synced to PSA
          const bulkCompany = await ctx.prisma.company.findUnique({
            where: { id: item.companyId },
            select: { name: true },
          });
          await ctx.prisma.billingActivityEntry.create({
            data: {
              companyId: item.companyId,
              companyName: bulkCompany?.name ?? "Unknown",
              agreementName: item.agreementName,
              productName: item.productName,
              vendorToolId: item.vendorToolId,
              vendorProductName: item.vendorProductName,
              psaQty: item.psaQty,
              vendorQty: liveCount,
              change: liveCount - item.psaQty,
              effectiveDate: new Date(),
              action: "synced_to_psa",
              result: "success",
              resultNote: `Bulk sync: PSA qty ${item.psaQty} → ${liveCount}`,
              actorId: ctx.user.id,
              actorName: ctx.user.name ?? ctx.user.email,
              snapshotId: item.snapshotId,
              reconciliationItemId: item.id,
            },
          });

          results.push({
            itemId,
            productName: item.productName,
            oldQty: item.psaQty,
            newQty: liveCount,
          });
        } catch (err) {
          results.push({
            itemId,
            productName: "Unknown",
            oldQty: 0,
            newQty: 0,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      await auditLog({
        action: "billing.bulk_reconcile_to_psa",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `reconciliation-items:${input.itemIds.length}`,
        detail: {
          itemCount: input.itemIds.length,
          successCount: results.filter((r) => !r.error).length,
          errorCount: results.filter((r) => r.error).length,
        },
      });

      return results;
    }),

  // ─── Vendor Count Sync ───────────────────────────────────

  syncVendorCounts: adminProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const counts = await getVendorCountsForCompany(input.companyId, ctx.prisma);
      const result = await reconcileCompany(input.companyId, ctx.prisma, ctx.user.id);
      await auditLog({
        action: "billing.vendor_counts.synced",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${input.companyId}`,
        detail: { companyId: input.companyId, vendorCounts: counts },
      });
      return { vendorCounts: counts, reconciliation: result };
    }),

  syncAllVendorCounts: adminProcedure.mutation(async ({ ctx }) => {
    const companies = await ctx.prisma.company.findMany({
      where: {
        agreements: { some: { cancelledFlag: false } },
        syncEnabled: true,
      },
      select: { id: true, name: true },
    });

    let processed = 0;
    let errors = 0;
    for (const company of companies) {
      try {
        await reconcileCompany(company.id, ctx.prisma, ctx.user.id);
        processed++;
      } catch {
        errors++;
      }
    }

    await ctx.prisma.billingSyncConfig.updateMany({
      data: { lastSyncAt: new Date(), lastSyncStatus: errors > 0 ? "completed_with_errors" : "completed" },
    });

    await auditLog({
      action: "billing.vendor_counts.sync_all",
      category: "DATA",
      actorId: ctx.user.id,
      detail: { processed, errors, total: companies.length },
    });

    return { processed, errors, total: companies.length };
  }),

  getLastSyncTime: protectedProcedure.query(async ({ ctx }) => {
    const lastSnapshot = await ctx.prisma.reconciliationSnapshot.findFirst({
      where: { status: "completed" },
      orderBy: { snapshotAt: "desc" },
      select: { snapshotAt: true },
    });
    return lastSnapshot?.snapshotAt ?? null;
  }),

  // ─── Sync Schedule Config ────────────────────────────────

  getSyncSchedule: protectedProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.billingSyncConfig.findFirst();
    return (
      config ?? {
        enabled: false,
        frequency: "weekly",
        dayOfWeek: 1,
        hourUtc: 6,
        lastSyncAt: null,
        lastSyncStatus: null,
      }
    );
  }),

  updateSyncSchedule: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        frequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
        dayOfWeek: z.number().min(0).max(6).default(1),
        hourUtc: z.number().min(0).max(23).default(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.billingSyncConfig.findFirst();

      let result;
      if (existing) {
        result = await ctx.prisma.billingSyncConfig.update({
          where: { id: existing.id },
          data: { ...input, updatedBy: ctx.user.id },
        });
      } else {
        result = await ctx.prisma.billingSyncConfig.create({
          data: { ...input, updatedBy: ctx.user.id },
        });
      }

      await auditLog({
        action: "billing.sync_schedule.updated",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: { enabled: input.enabled, frequency: input.frequency, dayOfWeek: input.dayOfWeek, hourUtc: input.hourUtc },
      });

      return result;
    }),

  // ─── Product Mappings ────────────────────────────────────

  getProductMappings: protectedProcedure
    .input(
      z.object({
        vendorToolId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.billingProductMapping.findMany({
        where: input.vendorToolId ? { vendorToolId: input.vendorToolId } : {},
        orderBy: [{ vendorToolId: "asc" }, { vendorProductName: "asc" }],
      });
    }),

  createProductMapping: adminProcedure
    .input(
      z.object({
        vendorToolId: z.string(),
        vendorProductKey: z.string(),
        vendorProductName: z.string(),
        psaProductName: z.string().optional(),
        countMethod: z.string().default("per_device"),
        unitLabel: z.string().default("devices"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.billingProductMapping.create({
        data: { ...input, createdBy: ctx.user.id },
      });
      await auditLog({
        action: "billing.product_mapping.created",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `mapping:${result.id}`,
        detail: { vendorToolId: input.vendorToolId, vendorProductKey: input.vendorProductKey, vendorProductName: input.vendorProductName },
      });
      return result;
    }),

  updateProductMapping: adminProcedure
    .input(
      z.object({
        id: z.string(),
        psaProductName: z.string().optional(),
        countMethod: z.string().optional(),
        unitLabel: z.string().optional(),
        isActive: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const result = await ctx.prisma.billingProductMapping.update({
        where: { id },
        data,
      });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_MAPPING_UPDATE",
        category: "DATA",
        detail: { mappingId: id, changes: data },
      });

      return result;
    }),

  deleteProductMapping: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.billingProductMapping.findUnique({
        where: { id: input.id },
      });

      const result = await ctx.prisma.billingProductMapping.delete({
        where: { id: input.id },
      });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_MAPPING_DELETE",
        category: "DATA",
        detail: {
          mappingId: input.id,
          vendorToolId: mapping?.vendorToolId,
          vendorProductName: mapping?.vendorProductName,
        },
      });

      return result;
    }),

  // ─── Vendor Products (DB-backed) ─────────────────────────

  /** Get vendor products from DB — replaces hardcoded lists */
  getVendorProducts: protectedProcedure
    .input(z.object({ toolId: z.string() }))
    .query(async ({ ctx, input }) => {
      let dbProducts = await ctx.prisma.billingVendorProduct.findMany({
        where: { vendorToolId: input.toolId, isActive: true },
        orderBy: { productName: "asc" },
      });

      // Auto-seed known defaults into DB on first access
      if (dbProducts.length === 0) {
        const defaults: Record<string, Array<{ productKey: string; productName: string; unit: string }>> = {
          ninjaone: [
            { productKey: "workstations", productName: "NinjaOne Workstations", unit: "devices" },
            { productKey: "servers", productName: "NinjaOne Servers", unit: "devices" },
            { productKey: "backup_workstations", productName: "NinjaOne Backup Workstations", unit: "devices" },
            { productKey: "backup_servers", productName: "NinjaOne Backup Servers", unit: "devices" },
          ],
          sentinelone: [
            { productKey: "complete", productName: "SentinelOne Complete", unit: "agents" },
            { productKey: "control", productName: "SentinelOne Control", unit: "agents" },
          ],
          cove: [
            { productKey: "server_backup", productName: "Cove Server Backup", unit: "devices" },
            { productKey: "workstation_backup", productName: "Cove Workstation Backup", unit: "devices" },
            { productKey: "m365_backup", productName: "Cove M365 Backup", unit: "tenants" },
          ],
          blackpoint: [
            { productKey: "response_compliance", productName: "Blackpoint Response + Compliance", unit: "devices" },
            { productKey: "endpoint_mdr_essentials", productName: "Blackpoint Endpoint MDR Essentials", unit: "devices" },
            { productKey: "cloud_mdr_essentials", productName: "Blackpoint Cloud MDR Essentials", unit: "devices" },
            { productKey: "cloud_endpoint_mdr_essentials", productName: "Blackpoint Cloud & Endpoint MDR Essentials", unit: "devices" },
            { productKey: "core", productName: "Blackpoint Core", unit: "devices" },
            { productKey: "standard", productName: "Blackpoint Standard", unit: "devices" },
          ],
        };

        // Pax8: auto-discover from live subscriptions instead of static defaults
        if (input.toolId === "pax8") {
          try {
            const licensing = (await ConnectorFactory.get("licensing", ctx.prisma)) as Pax8LicensingConnector;
            const allSubs = await licensing.getSubscriptions();
            const productMap = new Map<string, string>();
            for (const sub of allSubs) {
              if (!sub.productName) continue;
              const existing = productMap.get(sub.productId);
              if (!existing || /^Product [0-9a-f-]{8,}/.test(existing)) {
                productMap.set(sub.productId, sub.productName);
              }
            }
            for (const [productId, name] of Array.from(productMap)) {
              const isFallback = /^Product [0-9a-f-]{8,}/.test(name);
              const key = isFallback
                ? `product_${productId}`
                : name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
              const displayName = isFallback ? `Unknown Product (${productId.slice(0, 8)})` : name;
              await ctx.prisma.billingVendorProduct.upsert({
                where: { vendorToolId_productKey: { vendorToolId: "pax8", productKey: key } },
                update: {},
                create: {
                  vendorToolId: "pax8",
                  productKey: key,
                  productName: displayName,
                  unit: "licenses",
                  isAutoDiscovered: true,
                },
              });
            }
          } catch {
            // Pax8 not configured — no products to seed
          }
        } else if (input.toolId === "avanan") {
          // Avanan: auto-discover packages from live tenant data
          try {
            const emailSec = (await ConnectorFactory.getByToolId<"email_security">("avanan", ctx.prisma)) as AvananEmailSecurityConnector;
            const tenants = await emailSec.listTenants();
            const packageMap = new Map<string, string>();
            for (const t of tenants) {
              if (t.isDeleted || !t.packageCodeName) continue;
              if (!packageMap.has(t.packageCodeName)) {
                packageMap.set(t.packageCodeName, t.packageName || t.packageCodeName);
              }
            }
            for (const [codeName, displayName] of Array.from(packageMap)) {
              const key = codeName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
              await ctx.prisma.billingVendorProduct.upsert({
                where: { vendorToolId_productKey: { vendorToolId: "avanan", productKey: key } },
                update: {},
                create: {
                  vendorToolId: "avanan",
                  productKey: key,
                  productName: displayName,
                  unit: "users",
                  isAutoDiscovered: true,
                },
              });
            }
          } catch {
            // Avanan not configured — no products to seed
          }
        } else {
          const toSeed = defaults[input.toolId] ?? [];
          for (const p of toSeed) {
            await ctx.prisma.billingVendorProduct.upsert({
              where: { vendorToolId_productKey: { vendorToolId: input.toolId, productKey: p.productKey } },
              update: {},
              create: { vendorToolId: input.toolId, ...p, isAutoDiscovered: true },
            });
          }
        }

        // Re-query after seeding
        dbProducts = await ctx.prisma.billingVendorProduct.findMany({
          where: { vendorToolId: input.toolId, isActive: true },
          orderBy: { productName: "asc" },
        });
      }

      return dbProducts.map((p) => ({
        key: p.productKey,
        name: p.productName,
        unit: p.unit,
        isAutoDiscovered: p.isAutoDiscovered,
        id: p.id,
      }));
    }),

  /** Admin creates a manual vendor product */
  createVendorProduct: adminProcedure
    .input(
      z.object({
        vendorToolId: z.string(),
        productKey: z.string(),
        productName: z.string(),
        unit: z.string().default("devices"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.billingVendorProduct.create({
        data: {
          ...input,
          isAutoDiscovered: false,
          createdBy: ctx.user.id,
        },
      });
      await auditLog({
        action: "billing.vendor_product.created",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `vendor-product:${result.id}`,
        detail: { vendorToolId: input.vendorToolId, productKey: input.productKey, productName: input.productName },
      });
      return result;
    }),

  /** Admin deletes a manual vendor product */
  deleteVendorProduct: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.prisma.billingVendorProduct.findUniqueOrThrow({
        where: { id: input.id },
      });
      if (product.isAutoDiscovered) {
        throw new Error("Cannot delete auto-discovered products. Deactivate instead.");
      }
      // Delete assignments first
      await ctx.prisma.companyBillingAssignment.deleteMany({
        where: { vendorProductId: input.id },
      });
      const result = await ctx.prisma.billingVendorProduct.delete({
        where: { id: input.id },
      });
      await auditLog({
        action: "billing.vendor_product.deleted",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `vendor-product:${input.id}`,
        detail: { vendorToolId: product.vendorToolId, productName: product.productName },
      });
      return result;
    }),

  /** Toggle active state for a vendor product */
  toggleVendorProduct: adminProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.billingVendorProduct.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      await auditLog({
        action: "billing.vendor_product.toggled",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `vendor-product:${input.id}`,
        detail: { isActive: input.isActive, productName: result.productName },
      });
      return result;
    }),

  // ─── Company Billing Assignments ─────────────────────────

  /** Get product assignments for a company */
  getCompanyAssignments: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.companyBillingAssignment.findMany({
        where: { companyId: input.companyId },
        include: {
          vendorProduct: true,
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  /** Assign a vendor product to a company */
  assignProductToCompany: adminProcedure
    .input(
      z.object({
        companyId: z.string(),
        vendorProductId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.companyBillingAssignment.create({
        data: {
          companyId: input.companyId,
          vendorProductId: input.vendorProductId,
          isAutoDiscovered: false,
        },
        include: { vendorProduct: true },
      });
      await auditLog({
        action: "billing.product_assignment.created",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${input.companyId}`,
        detail: { companyId: input.companyId, vendorProductId: input.vendorProductId, productName: result.vendorProduct.productName },
      });
      return result;
    }),

  /** Remove a product assignment from a company */
  removeProductFromCompany: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.companyBillingAssignment.findUniqueOrThrow({
        where: { id: input.id },
        include: { vendorProduct: true },
      });
      const result = await ctx.prisma.companyBillingAssignment.delete({
        where: { id: input.id },
      });
      await auditLog({
        action: "billing.product_assignment.removed",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${assignment.companyId}`,
        detail: { companyId: assignment.companyId, vendorProductId: assignment.vendorProductId, productName: assignment.vendorProduct.productName },
      });
      return result;
    }),

  // ─── Per-Company Vendor Products (Live) ─────────────────

  /** Fetch live vendor products for a specific company with mapping status */
  getCompanyVendorProducts: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch live vendor counts for this company
      const vendorCounts = await getVendorCountsForCompany(
        input.companyId,
        ctx.prisma
      );

      // Fetch all existing product mappings to check mapping status
      const existingMappings = await ctx.prisma.billingProductMapping.findMany({
        where: { vendorToolId: { in: ["ninjaone", "sentinelone", "cove", "pax8", "blackpoint", "avanan"] } },
      });

      const mappingLookup = new Map<string, { id: string; psaProductName: string | null }>();
      for (const m of existingMappings) {
        mappingLookup.set(`${m.vendorToolId}:${m.vendorProductKey}`, {
          id: m.id,
          psaProductName: m.psaProductName,
        });
      }

      return vendorCounts.map((vc) => {
        const mapping = mappingLookup.get(`${vc.toolId}:${vc.productKey}`);
        return {
          toolId: vc.toolId,
          productKey: vc.productKey,
          productName: vc.productName,
          quantity: vc.count,
          unit: vc.unit,
          isMapped: !!mapping?.psaProductName,
          mappingId: mapping?.id ?? null,
          cwProductName: mapping?.psaProductName ?? null,
        };
      });
    }),

  /** Quick-map a vendor product to a CW product from the company billing page */
  quickMapVendorProduct: adminProcedure
    .input(z.object({
      vendorToolId: z.string(),
      vendorProductKey: z.string(),
      vendorProductName: z.string(),
      psaProductName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Ensure the vendor product exists in BillingVendorProduct
      await ctx.prisma.billingVendorProduct.upsert({
        where: {
          vendorToolId_productKey: {
            vendorToolId: input.vendorToolId,
            productKey: input.vendorProductKey,
          },
        },
        update: {},
        create: {
          vendorToolId: input.vendorToolId,
          productKey: input.vendorProductKey,
          productName: input.vendorProductName,
          unit: "licenses",
          isAutoDiscovered: true,
        },
      });

      // Create the product mapping
      const mapping = await ctx.prisma.billingProductMapping.create({
        data: {
          vendorToolId: input.vendorToolId,
          vendorProductKey: input.vendorProductKey,
          vendorProductName: input.vendorProductName,
          psaProductName: input.psaProductName,
          countMethod: "per_license",
          unitLabel: "licenses",
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_QUICK_MAP",
        category: "DATA",
        detail: {
          vendorToolId: input.vendorToolId,
          vendorProductName: input.vendorProductName,
          psaProductName: input.psaProductName,
        },
      });

      return mapping;
    }),

  // ─── Sync Vendor Products from APIs ──────────────────────

  /** Auto-discover products from vendor APIs and upsert into BillingVendorProduct */
  syncVendorProducts: adminProcedure.mutation(async ({ ctx }) => {
    const created: string[] = [];
    const updated: string[] = [];

    // Known NinjaOne products
    const ninjaProducts = [
      { productKey: "workstations", productName: "NinjaOne Workstations", unit: "devices" },
      { productKey: "servers", productName: "NinjaOne Servers", unit: "devices" },
      { productKey: "backup_workstations", productName: "NinjaOne Backup Workstations", unit: "devices" },
      { productKey: "backup_servers", productName: "NinjaOne Backup Servers", unit: "devices" },
    ];
    for (const p of ninjaProducts) {
      const existing = await ctx.prisma.billingVendorProduct.findUnique({
        where: { vendorToolId_productKey: { vendorToolId: "ninjaone", productKey: p.productKey } },
      });
      if (!existing) {
        await ctx.prisma.billingVendorProduct.create({
          data: { vendorToolId: "ninjaone", ...p, isAutoDiscovered: true },
        });
        created.push(`ninjaone:${p.productKey}`);
      }
    }

    // SentinelOne: discover SKUs from sites
    try {
      const edr = (await ConnectorFactory.get("edr", ctx.prisma)) as SentinelOneEdrConnector;
      const sites = await edr.getSites();
      const skus = new Set<string>();
      for (const site of sites) {
        if (site.sku) skus.add(site.sku);
      }
      for (const sku of Array.from(skus)) {
        const key = sku.toLowerCase().replace(/\s+/g, "_");
        const existing = await ctx.prisma.billingVendorProduct.findUnique({
          where: { vendorToolId_productKey: { vendorToolId: "sentinelone", productKey: key } },
        });
        if (!existing) {
          await ctx.prisma.billingVendorProduct.create({
            data: {
              vendorToolId: "sentinelone",
              productKey: key,
              productName: `SentinelOne ${sku}`,
              unit: "agents",
              isAutoDiscovered: true,
            },
          });
          created.push(`sentinelone:${key}`);
        }
      }
    } catch {
      // S1 not configured
    }

    // Known Cove products
    const coveProducts = [
      { productKey: "server_backup", productName: "Cove Server Backup", unit: "devices" },
      { productKey: "workstation_backup", productName: "Cove Workstation Backup", unit: "devices" },
      { productKey: "m365_backup", productName: "Cove M365 Backup", unit: "tenants" },
    ];
    for (const p of coveProducts) {
      const existing = await ctx.prisma.billingVendorProduct.findUnique({
        where: { vendorToolId_productKey: { vendorToolId: "cove", productKey: p.productKey } },
      });
      if (!existing) {
        await ctx.prisma.billingVendorProduct.create({
          data: { vendorToolId: "cove", ...p, isAutoDiscovered: true },
        });
        created.push(`cove:${p.productKey}`);
      }
    }

    // Pax8: discover ALL subscription product names (enriched with real names)
    try {
      const licensing = (await ConnectorFactory.get("licensing", ctx.prisma)) as Pax8LicensingConnector;

      // Clean up old entries with UUID-based fallback names from before enrichment
      const deleted = await ctx.prisma.billingVendorProduct.deleteMany({
        where: {
          vendorToolId: "pax8",
          productName: { startsWith: "Pax8 Product " },
          isAutoDiscovered: true,
        },
      });
      if (deleted.count > 0) {
        updated.push(`pax8:cleaned_${deleted.count}_bad_entries`);
      }

      // Fetch ALL subscriptions (not just active) so we discover every product
      const allSubs = await licensing.getSubscriptions();
      // Collect unique products: productId → best available name
      const productMap = new Map<string, string>();
      for (const sub of allSubs) {
        if (!sub.productName) continue;
        const existing = productMap.get(sub.productId);
        // Prefer enriched name over fallback
        if (!existing || /^Product [0-9a-f-]{8,}/.test(existing)) {
          productMap.set(sub.productId, sub.productName);
        }
      }
      for (const [productId, name] of Array.from(productMap)) {
        // Use real name as key when enriched, product ID when not
        const isFallback = /^Product [0-9a-f-]{8,}/.test(name);
        const key = isFallback
          ? `product_${productId}`
          : name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const displayName = isFallback ? `Unknown Product (${productId.slice(0, 8)})` : name;
        const existing = await ctx.prisma.billingVendorProduct.findUnique({
          where: { vendorToolId_productKey: { vendorToolId: "pax8", productKey: key } },
        });
        if (!existing) {
          await ctx.prisma.billingVendorProduct.create({
            data: {
              vendorToolId: "pax8",
              productKey: key,
              productName: displayName,
              unit: "licenses",
              isAutoDiscovered: true,
            },
          });
          created.push(`pax8:${key}`);
        }
      }
    } catch {
      // Pax8 not configured
    }

    // Blackpoint: all known editions (API doesn't expose edition per tenant)
    {
      const bpEditions = [
        { productKey: "response_compliance", productName: "Blackpoint Response + Compliance", unit: "devices" },
        { productKey: "endpoint_mdr_essentials", productName: "Blackpoint Endpoint MDR Essentials", unit: "devices" },
        { productKey: "cloud_mdr_essentials", productName: "Blackpoint Cloud MDR Essentials", unit: "devices" },
        { productKey: "cloud_endpoint_mdr_essentials", productName: "Blackpoint Cloud & Endpoint MDR Essentials", unit: "devices" },
        { productKey: "core", productName: "Blackpoint Core", unit: "devices" },
        { productKey: "standard", productName: "Blackpoint Standard", unit: "devices" },
      ];
      for (const bp of bpEditions) {
        const existing = await ctx.prisma.billingVendorProduct.findUnique({
          where: { vendorToolId_productKey: { vendorToolId: "blackpoint", productKey: bp.productKey } },
        });
        if (!existing) {
          await ctx.prisma.billingVendorProduct.create({
            data: { vendorToolId: "blackpoint", ...bp, isAutoDiscovered: true },
          });
          created.push(`blackpoint:${bp.productKey}`);
        }
      }
    }

    // Avanan: discover package types from tenant data
    try {
      const emailSec = (await ConnectorFactory.getByToolId<"email_security">("avanan", ctx.prisma)) as import("../connectors/avanan/connector").AvananEmailSecurityConnector;
      const tenants = await emailSec.listTenants();
      const packageSet = new Map<string, string>();
      for (const t of tenants) {
        if (t.packageCodeName && !t.isDeleted) {
          const key = t.packageCodeName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          if (!packageSet.has(key)) {
            packageSet.set(key, t.packageName || t.packageCodeName);
          }
        }
      }
      for (const [key, name] of Array.from(packageSet)) {
        const existing = await ctx.prisma.billingVendorProduct.findUnique({
          where: { vendorToolId_productKey: { vendorToolId: "avanan", productKey: key } },
        });
        if (!existing) {
          await ctx.prisma.billingVendorProduct.create({
            data: {
              vendorToolId: "avanan",
              productKey: key,
              productName: `Avanan ${name}`,
              unit: "users",
              isAutoDiscovered: true,
            },
          });
          created.push(`avanan:${key}`);
        }
      }
    } catch {
      // Avanan not configured
    }

    await auditLog({
      actorId: ctx.user.id,
      action: "BILLING_SYNC_VENDOR_PRODUCTS",
      category: "DATA",
      detail: { created, updated },
    });

    return { created: created.length, updated: updated.length, products: created };
  }),

  /** Search CW product catalog for PSA side of mapping */
  getCwProducts: protectedProcedure
    .input(z.object({ searchTerm: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const psa = (await ConnectorFactory.get(
          "psa",
          ctx.prisma
        )) as ConnectWisePsaConnector;
        const result = await psa.getProducts(1, 50, input.searchTerm);
        // CW catalog returns the same product multiple times (Agreement, Inventory, etc. types).
        // Deduplicate by description (display name) so users see each product once.
        const seen = new Set<string>();
        return result.data
          .filter((p) => {
            const key = (p.description ?? p.identifier ?? String(p.id)).toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((p) => ({
            id: p.id,
            identifier: p.identifier,
            description: p.description,
            category: p.category?.name,
            price: p.price,
            cost: p.cost,
          }));
      } catch {
        return [];
      }
    }),

  // ─── Agreement Data ──────────────────────────────────────

  getCompanyAdditions: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.agreementAddition.findMany({
        where: {
          agreement: { companyId: input.companyId, cancelledFlag: false },
          cancelledFlag: false,
        },
        include: {
          agreement: { select: { id: true, name: true, psaSourceId: true } },
        },
        orderBy: { productName: "asc" },
      });
    }),

  getAgreementAdditions: protectedProcedure
    .input(z.object({ agreementId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.agreementAddition.findMany({
        where: { agreementId: input.agreementId, cancelledFlag: false },
        orderBy: { productName: "asc" },
      });
    }),

  // ─── Companies with Agreements (for filters) ────────────

  getCompaniesWithAgreements: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.company.findMany({
      where: {
        agreements: { some: { cancelledFlag: false } },
        syncEnabled: true,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  // ─── Revenue & Profit (summary cards) ──────────────────

  getRevenueAndProfit: protectedProcedure.query(async ({ ctx }) => {
    const additions = await ctx.prisma.agreementAddition.findMany({
      where: {
        cancelledFlag: false,
        billCustomer: { not: "DoNotBill" },
        agreement: {
          cancelledFlag: false,
          company: { syncEnabled: true },
        },
      },
      select: { quantity: true, unitPrice: true, unitCost: true },
    });

    let revenue = 0;
    let cost = 0;
    for (const a of additions) {
      revenue += (a.unitPrice ?? 0) * a.quantity;
      cost += (a.unitCost ?? 0) * a.quantity;
    }

    const profit = revenue - cost;
    return {
      revenue: Math.round(revenue * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
    };
  }),

  // ─── Billing Activity Log ──────────────────────────────

  getBillingActivityLog: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
        actionFilter: z.string().optional(), // "detected" | "approved" | "dismissed" | "synced_to_psa" | "auto_approved"
        vendorFilter: z.string().optional(), // "ninjaone" | "sentinelone" | "cove"
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (input.companyId) {
        where.companyId = input.companyId;
      }
      if (input.actionFilter) {
        where.action = input.actionFilter;
      }
      if (input.vendorFilter) {
        where.vendorToolId = input.vendorFilter;
      }
      if (input.search) {
        where.OR = [
          { companyName: { contains: input.search, mode: "insensitive" } },
          { productName: { contains: input.search, mode: "insensitive" } },
          { vendorProductName: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const items = await ctx.prisma.billingActivityEntry.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where,
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  // ─── Billing Settings ──────────────────────────────────

  getBillingSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.billingSettings.findFirst();
    return (
      settings ?? {
        id: null as string | null,
        defaultEffectiveDate: "today",
        customEffectiveDay: null as number | null,
        defaultContractView: "active_only",
        autoApproveMatches: true,
        showCostData: true,
      }
    );
  }),

  updateBillingSettings: adminProcedure
    .input(
      z.object({
        defaultEffectiveDate: z.enum(["today", "cycle_start", "custom"]).optional(),
        customEffectiveDay: z.number().min(1).max(28).nullish(),
        defaultContractView: z.enum(["all", "active_only", "discrepancies_only"]).optional(),
        autoApproveMatches: z.boolean().optional(),
        showCostData: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.billingSettings.findFirst();

      const result = existing
        ? await ctx.prisma.billingSettings.update({
            where: { id: existing.id },
            data: { ...input, updatedBy: ctx.user.id },
          })
        : await ctx.prisma.billingSettings.create({
            data: {
              defaultEffectiveDate: input.defaultEffectiveDate ?? "today",
              customEffectiveDay: input.customEffectiveDay ?? null,
              defaultContractView: input.defaultContractView ?? "active_only",
              autoApproveMatches: input.autoApproveMatches ?? true,
              showCostData: input.showCostData ?? true,
              updatedBy: ctx.user.id,
            },
          });

      await auditLog({
        actorId: ctx.user.id,
        action: "BILLING_SETTINGS_UPDATE",
        category: "DATA",
        detail: input,
      });

      return result;
    }),

  // ─── Contract Insights ─────────────────────────────────

  getContractInsights: protectedProcedure.query(async ({ ctx }) => {
    // Fetch all active additions with company and agreement info
    const additions = await ctx.prisma.agreementAddition.findMany({
      where: {
        cancelledFlag: false,
        billCustomer: { not: "DoNotBill" },
        agreement: {
          cancelledFlag: false,
          company: { syncEnabled: true },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        unitCost: true,
        productName: true,
        agreement: {
          select: {
            companyId: true,
            name: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Per-company financials
    const companyMap = new Map<
      string,
      { name: string; revenue: number; cost: number }
    >();
    // Per-service financials
    const serviceMap = new Map<
      string,
      { revenue: number; cost: number; companyIds: Set<string> }
    >();
    // Vendor distribution
    const vendorMap = new Map<string, number>();

    let totalRevenue = 0;
    let totalCost = 0;

    for (const a of additions) {
      const rev = (a.unitPrice ?? 0) * a.quantity;
      const cst = (a.unitCost ?? 0) * a.quantity;
      totalRevenue += rev;
      totalCost += cst;

      // Company
      const cid = a.agreement.companyId;
      const cname = a.agreement.company.name;
      const existing = companyMap.get(cid) ?? { name: cname, revenue: 0, cost: 0 };
      existing.revenue += rev;
      existing.cost += cst;
      companyMap.set(cid, existing);

      // Service
      const svc = a.productName;
      const sExisting = serviceMap.get(svc) ?? {
        revenue: 0,
        cost: 0,
        companyIds: new Set<string>(),
      };
      sExisting.revenue += rev;
      sExisting.cost += cst;
      sExisting.companyIds.add(cid);
      serviceMap.set(svc, sExisting);

      // Vendor distribution — detect vendor from product name prefix
      const lowerName = svc.toLowerCase();
      let vendor = "Other";
      if (lowerName.includes("ninjaone") || lowerName.includes("ninja")) vendor = "NinjaOne";
      else if (lowerName.includes("sentinelone") || lowerName.includes("s1")) vendor = "SentinelOne";
      else if (lowerName.includes("cove")) vendor = "Cove";
      else if (lowerName.includes("pax8") || lowerName.includes("microsoft 365") || lowerName.includes("m365")) vendor = "Pax8";
      else if (lowerName.includes("blackpoint")) vendor = "Blackpoint";
      else if (lowerName.includes("avanan") || lowerName.includes("harmony") || lowerName.includes("check point")) vendor = "Avanan";
      vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + rev);
    }

    // Sort companies by revenue desc
    const companyFinancials = Array.from(companyMap.entries())
      .map(([id, c]) => ({
        id,
        name: c.name,
        revenue: Math.round(c.revenue * 100) / 100,
        cost: Math.round(c.cost * 100) / 100,
        profit: Math.round((c.revenue - c.cost) * 100) / 100,
        margin: c.revenue > 0 ? Math.round(((c.revenue - c.cost) / c.revenue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Sort services by revenue desc
    const serviceBreakdown = Array.from(serviceMap.entries())
      .map(([name, s]) => ({
        name,
        revenue: Math.round(s.revenue * 100) / 100,
        cost: Math.round(s.cost * 100) / 100,
        profit: Math.round((s.revenue - s.cost) * 100) / 100,
        margin: s.revenue > 0 ? Math.round(((s.revenue - s.cost) / s.revenue) * 10000) / 100 : 0,
        companyCount: s.companyIds.size,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Vendor distribution sorted by revenue
    const vendorDistribution = Array.from(vendorMap.entries())
      .map(([name, revenue]) => ({
        name,
        revenue: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Expiring agreements
    const now = new Date();
    const expiringAgreements = await ctx.prisma.companyAgreement.findMany({
      where: {
        cancelledFlag: false,
        noEndingDateFlag: false,
        endDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        endDate: true,
        companyId: true,
        company: { select: { name: true } },
        additions: {
          where: { cancelledFlag: false },
          select: { quantity: true, unitPrice: true },
        },
      },
      orderBy: { endDate: "asc" },
      take: 50,
    });

    const expiringFormatted = expiringAgreements
      .map((ag) => {
        const endDate = ag.endDate!;
        const daysLeft = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        const monthlyRevenue = ag.additions.reduce(
          (sum, a) => sum + (a.unitPrice ?? 0) * a.quantity,
          0
        );
        return {
          id: ag.id,
          companyName: ag.company.name,
          agreementName: ag.name,
          endDate,
          daysLeft,
          monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        };
      })
      .filter((ag) => ag.daysLeft > -30) // Include recently expired too
      .slice(0, 30);

    const totalProfit = totalRevenue - totalCost;

    return {
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        cost: Math.round(totalCost * 100) / 100,
        profit: Math.round(totalProfit * 100) / 100,
        margin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 10000) / 100 : 0,
        agreementCount: companyFinancials.length,
        expiringIn90Days: expiringFormatted.filter((a) => a.daysLeft >= 0 && a.daysLeft <= 90).length,
      },
      companyFinancials,
      serviceBreakdown,
      vendorDistribution,
      expiringAgreements: expiringFormatted,
    };
  }),
});
