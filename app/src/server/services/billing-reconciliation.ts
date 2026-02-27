/**
 * Billing Reconciliation Service
 *
 * Aggregates vendor counts from NinjaOne, SentinelOne, Cove, and Pax8,
 * then compares them against CW PSA agreement additions (billed quantities).
 * Creates point-in-time reconciliation snapshots for audit and review.
 *
 * Product types:
 *   NinjaOne:     workstations, servers, backup_workstations, backup_servers
 *   SentinelOne:  per-SKU (complete, control, etc.) — determined from site license tier
 *   Cove:         server_backup, workstation_backup, m365_backup
 *   Pax8:         per-subscription product name (auto-discovered from active subscriptions)
 */

import type { PrismaClient } from "@prisma/client";
import { ConnectorFactory } from "../connectors/factory";
import type { NinjaOneRmmConnector } from "../connectors/ninjaone/connector";
import type { SentinelOneEdrConnector } from "../connectors/sentinelone/connector";
import type { Pax8LicensingConnector } from "../connectors/pax8/connector";
import { isM365Tenant } from "../connectors/cove/mappers";

// ─── Types ──────────────────────────────────────────────────

export interface VendorCount {
  toolId: string;
  productKey: string;
  productName: string;
  count: number;
  unit: string;
  companyExternalId: string;
  lastSyncedAt?: Date;
}

export interface ReconciliationResult {
  snapshotId: string;
  companyId: string;
  companyName: string;
  totalItems: number;
  discrepancies: number;
  totalRevenueImpact: number;
}

// ─── Vendor Product Seeding ─────────────────────────────────

const KNOWN_VENDOR_PRODUCTS: Array<{ vendorToolId: string; productKey: string; productName: string; unit: string }> = [
  { vendorToolId: "ninjaone", productKey: "workstations", productName: "NinjaOne Workstations", unit: "devices" },
  { vendorToolId: "ninjaone", productKey: "servers", productName: "NinjaOne Servers", unit: "devices" },
  { vendorToolId: "ninjaone", productKey: "backup_workstations", productName: "NinjaOne Backup Workstations", unit: "devices" },
  { vendorToolId: "ninjaone", productKey: "backup_servers", productName: "NinjaOne Backup Servers", unit: "devices" },
  { vendorToolId: "sentinelone", productKey: "complete", productName: "SentinelOne Complete", unit: "agents" },
  { vendorToolId: "sentinelone", productKey: "control", productName: "SentinelOne Control", unit: "agents" },
  { vendorToolId: "cove", productKey: "server_backup", productName: "Cove Server Backup", unit: "devices" },
  { vendorToolId: "cove", productKey: "workstation_backup", productName: "Cove Workstation Backup", unit: "devices" },
  { vendorToolId: "cove", productKey: "m365_backup", productName: "Cove M365 Backup", unit: "tenants" },
  // Pax8: common products seeded — additional products auto-discovered during reconciliation
  { vendorToolId: "pax8", productKey: "microsoft_365_business_basic", productName: "Pax8 Microsoft 365 Business Basic", unit: "licenses" },
  { vendorToolId: "pax8", productKey: "microsoft_365_business_standard", productName: "Pax8 Microsoft 365 Business Standard", unit: "licenses" },
  { vendorToolId: "pax8", productKey: "microsoft_365_business_premium", productName: "Pax8 Microsoft 365 Business Premium", unit: "licenses" },
  { vendorToolId: "pax8", productKey: "microsoft_defender_for_business", productName: "Pax8 Microsoft Defender for Business", unit: "licenses" },
  { vendorToolId: "pax8", productKey: "microsoft_365_e3", productName: "Pax8 Microsoft 365 E3", unit: "licenses" },
  { vendorToolId: "pax8", productKey: "microsoft_365_e5", productName: "Pax8 Microsoft 365 E5", unit: "licenses" },
];

/** Ensure all known vendor products exist in DB (idempotent) */
async function ensureVendorProductsSeeded(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.billingVendorProduct.count();
  if (existing > 0) return; // Already seeded

  for (const p of KNOWN_VENDOR_PRODUCTS) {
    await prisma.billingVendorProduct.upsert({
      where: { vendorToolId_productKey: { vendorToolId: p.vendorToolId, productKey: p.productKey } },
      update: {},
      create: { ...p, isAutoDiscovered: true },
    });
  }
}

// ─── Vendor Count Resolution ────────────────────────────────

/**
 * Fetches all vendor counts for a single company.
 * Uses CompanyIntegrationMapping to know which tools/orgs to query.
 */
export async function getVendorCountsForCompany(
  companyId: string,
  prisma: PrismaClient,
  toolIds?: string[]
): Promise<VendorCount[]> {
  const mappings = await prisma.companyIntegrationMapping.findMany({
    where: { companyId },
  });

  const counts: VendorCount[] = [];
  const targetTools = toolIds ?? ["ninjaone", "sentinelone", "cove", "pax8"];

  for (const mapping of mappings) {
    if (!targetTools.includes(mapping.toolId)) continue;

    try {
      switch (mapping.toolId) {
        case "ninjaone": {
          const toolCounts = await getNinjaOneCounts(mapping.externalId, prisma);
          counts.push(
            ...toolCounts.map((c) => ({ ...c, companyExternalId: mapping.externalId }))
          );
          break;
        }
        case "sentinelone": {
          const toolCounts = await getSentinelOneCounts(mapping.externalId, prisma);
          counts.push(
            ...toolCounts.map((c) => ({ ...c, companyExternalId: mapping.externalId }))
          );
          break;
        }
        case "cove": {
          const toolCounts = await getCoveCounts(mapping.externalId, prisma);
          counts.push(
            ...toolCounts.map((c) => ({ ...c, companyExternalId: mapping.externalId }))
          );
          break;
        }
        case "pax8": {
          const toolCounts = await getPax8Counts(mapping.externalId, prisma);
          counts.push(
            ...toolCounts.map((c) => ({ ...c, companyExternalId: mapping.externalId }))
          );
          break;
        }
      }
    } catch {
      // Tool not configured or API error — skip silently
    }
  }

  return counts;
}

/**
 * Bulk-fetch all vendor counts across all companies.
 * More efficient than per-company queries — does one API call per tool.
 */
export async function getAllVendorCounts(
  prisma: PrismaClient
): Promise<Map<string, VendorCount[]>> {
  const allMappings = await prisma.companyIntegrationMapping.findMany({
    where: { toolId: { in: ["ninjaone", "sentinelone", "cove", "pax8"] } },
    include: { company: { select: { id: true } } },
  });

  // Group mappings by toolId
  const byTool = new Map<string, typeof allMappings>();
  for (const m of allMappings) {
    const list = byTool.get(m.toolId) ?? [];
    list.push(m);
    byTool.set(m.toolId, list);
  }

  // Result: companyId -> VendorCount[]
  const result = new Map<string, VendorCount[]>();

  const appendCounts = (companyId: string, counts: VendorCount[]) => {
    const existing = result.get(companyId) ?? [];
    existing.push(...counts);
    result.set(companyId, existing);
  };

  // ─── NinjaOne: bulk query, classify by nodeClass ────────
  try {
    const ninjaMappings = byTool.get("ninjaone");
    if (ninjaMappings?.length) {
      const rmm = (await ConnectorFactory.get("rmm", prisma)) as NinjaOneRmmConnector;
      const [allDevices, allBackupJobs] = await Promise.all([
        rmm.queryDeviceHealth(),
        rmm.queryBackupJobs().catch(() => [] as Array<{ deviceId: number; organizationId?: number }>),
      ]);

      // Build set of device IDs with backup jobs, grouped by org
      const backupDeviceIds = new Set(allBackupJobs.map((j) => j.deviceId));

      // Classify devices by org + type
      type OrgCounts = { workstations: number; servers: number; backup_workstations: number; backup_servers: number };
      const orgCounts = new Map<string, OrgCounts>();

      for (const d of allDevices) {
        if (d.organizationId == null) continue;
        const orgId = String(d.organizationId);
        const counts = orgCounts.get(orgId) ?? { workstations: 0, servers: 0, backup_workstations: 0, backup_servers: 0 };

        const nc = (d.nodeClass ?? "").toUpperCase();
        const isServer = nc.includes("SERVER") || nc === "LINUX";
        const hasBackup = backupDeviceIds.has(d.deviceId);

        if (isServer) {
          counts.servers++;
          if (hasBackup) counts.backup_servers++;
        } else {
          counts.workstations++;
          if (hasBackup) counts.backup_workstations++;
        }

        orgCounts.set(orgId, counts);
      }

      for (const mapping of ninjaMappings) {
        const counts = orgCounts.get(mapping.externalId);
        if (!counts) continue;
        const now = new Date();
        const vendorCounts: VendorCount[] = [
          { toolId: "ninjaone", productKey: "workstations", productName: "NinjaOne Workstations", count: counts.workstations, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now },
          { toolId: "ninjaone", productKey: "servers", productName: "NinjaOne Servers", count: counts.servers, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now },
        ];
        if (counts.backup_workstations > 0) {
          vendorCounts.push({ toolId: "ninjaone", productKey: "backup_workstations", productName: "NinjaOne Backup Workstations", count: counts.backup_workstations, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now });
        }
        if (counts.backup_servers > 0) {
          vendorCounts.push({ toolId: "ninjaone", productKey: "backup_servers", productName: "NinjaOne Backup Servers", count: counts.backup_servers, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now });
        }
        appendCounts(mapping.companyId, vendorCounts);
      }
    }
  } catch {
    // NinjaOne not configured
  }

  // ─── SentinelOne: per-site SKU counts ────────
  try {
    const s1Mappings = byTool.get("sentinelone");
    if (s1Mappings?.length) {
      const edr = (await ConnectorFactory.get("edr", prisma)) as SentinelOneEdrConnector;
      // Fetch all sites once to get site→SKU map
      const allSites = await edr.getSites();
      const siteSkuMap = new Map<string, string>();
      for (const site of allSites) {
        if (site.sku) siteSkuMap.set(site.id, site.sku);
      }

      for (const mapping of s1Mappings) {
        try {
          const agentResult = await edr.getAgents(
            { siteId: mapping.externalId },
            undefined,
            1
          );
          const count = agentResult.totalCount ?? agentResult.data.length;
          const sku = siteSkuMap.get(mapping.externalId) ?? "unknown";
          const skuKey = sku.toLowerCase().replace(/\s+/g, "_");

          appendCounts(mapping.companyId, [{
            toolId: "sentinelone",
            productKey: skuKey,
            productName: `SentinelOne ${sku}`,
            count,
            unit: "agents",
            companyExternalId: mapping.externalId,
            lastSyncedAt: new Date(),
          }]);
        } catch {
          // Skip this site
        }
      }
    }
  } catch {
    // SentinelOne not configured
  }

  // ─── Cove: per-device-type counts ────────
  try {
    const coveMappings = byTool.get("cove");
    if (coveMappings?.length) {
      const backup = await ConnectorFactory.get("backup", prisma);
      const allDevices = await backup.getDevices();

      // Group by customer → type
      type CoveCounts = { server_backup: number; workstation_backup: number; m365_backup: number };
      const byCustomer = new Map<string, CoveCounts>();

      for (const d of allDevices) {
        const custId = d.customerSourceId;
        const counts = byCustomer.get(custId) ?? { server_backup: 0, workstation_backup: 0, m365_backup: 0 };

        if (isM365Tenant(d)) {
          counts.m365_backup++;
        } else if (d.osType === "server") {
          counts.server_backup++;
        } else {
          counts.workstation_backup++;
        }

        byCustomer.set(custId, counts);
      }

      for (const mapping of coveMappings) {
        const counts = byCustomer.get(mapping.externalId);
        if (!counts) continue;
        const now = new Date();
        const vendorCounts: VendorCount[] = [];
        if (counts.server_backup > 0) {
          vendorCounts.push({ toolId: "cove", productKey: "server_backup", productName: "Cove Server Backup", count: counts.server_backup, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now });
        }
        if (counts.workstation_backup > 0) {
          vendorCounts.push({ toolId: "cove", productKey: "workstation_backup", productName: "Cove Workstation Backup", count: counts.workstation_backup, unit: "devices", companyExternalId: mapping.externalId, lastSyncedAt: now });
        }
        if (counts.m365_backup > 0) {
          vendorCounts.push({ toolId: "cove", productKey: "m365_backup", productName: "Cove M365 Backup", count: counts.m365_backup, unit: "tenants", companyExternalId: mapping.externalId, lastSyncedAt: now });
        }
        appendCounts(mapping.companyId, vendorCounts);
      }
    }
  } catch {
    // Cove not configured
  }

  // ─── Pax8: subscription quantities per company ────────
  try {
    const pax8Mappings = byTool.get("pax8");
    if (pax8Mappings?.length) {
      const licensing = (await ConnectorFactory.get("licensing", prisma)) as Pax8LicensingConnector;
      const allSubsByCompany = await licensing.getAllActiveSubscriptions();

      for (const mapping of pax8Mappings) {
        const companySubs = allSubsByCompany.get(mapping.externalId);
        if (!companySubs?.length) continue;

        // Group by product name → sum quantities
        const byProduct = new Map<string, { name: string; qty: number }>();
        for (const sub of companySubs) {
          const key = sub.productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const existing = byProduct.get(key) ?? { name: sub.productName, qty: 0 };
          existing.qty += sub.quantity;
          byProduct.set(key, existing);
        }

        const now = new Date();
        const vendorCounts: VendorCount[] = Array.from(byProduct.entries()).map(
          ([productKey, { name, qty }]) => ({
            toolId: "pax8",
            productKey,
            productName: name,
            count: qty,
            unit: "licenses",
            companyExternalId: mapping.externalId,
            lastSyncedAt: now,
          })
        );
        appendCounts(mapping.companyId, vendorCounts);
      }
    }
  } catch {
    // Pax8 not configured
  }

  return result;
}

// ─── Per-tool Count Helpers (single-company) ────────────────

async function getNinjaOneCounts(
  orgId: string,
  prisma: PrismaClient
): Promise<Omit<VendorCount, "companyExternalId">[]> {
  const rmm = (await ConnectorFactory.get("rmm", prisma)) as NinjaOneRmmConnector;
  const [allDevices, allBackupJobs] = await Promise.all([
    rmm.queryDeviceHealth(),
    rmm.queryBackupJobs().catch(() => [] as Array<{ deviceId: number; organizationId?: number }>),
  ]);

  const backupDeviceIds = new Set(allBackupJobs.map((j) => j.deviceId));

  let workstations = 0, servers = 0, backupWorkstations = 0, backupServers = 0;

  for (const d of allDevices) {
    if (d.organizationId == null || String(d.organizationId) !== orgId) continue;
    const nc = (d.nodeClass ?? "").toUpperCase();
    const isServer = nc.includes("SERVER") || nc === "LINUX";
    const hasBackup = backupDeviceIds.has(d.deviceId);

    if (isServer) {
      servers++;
      if (hasBackup) backupServers++;
    } else {
      workstations++;
      if (hasBackup) backupWorkstations++;
    }
  }

  const now = new Date();
  const counts: Omit<VendorCount, "companyExternalId">[] = [
    { toolId: "ninjaone", productKey: "workstations", productName: "NinjaOne Workstations", count: workstations, unit: "devices", lastSyncedAt: now },
    { toolId: "ninjaone", productKey: "servers", productName: "NinjaOne Servers", count: servers, unit: "devices", lastSyncedAt: now },
  ];
  if (backupWorkstations > 0) {
    counts.push({ toolId: "ninjaone", productKey: "backup_workstations", productName: "NinjaOne Backup Workstations", count: backupWorkstations, unit: "devices", lastSyncedAt: now });
  }
  if (backupServers > 0) {
    counts.push({ toolId: "ninjaone", productKey: "backup_servers", productName: "NinjaOne Backup Servers", count: backupServers, unit: "devices", lastSyncedAt: now });
  }
  return counts;
}

async function getSentinelOneCounts(
  siteId: string,
  prisma: PrismaClient
): Promise<Omit<VendorCount, "companyExternalId">[]> {
  const edr = (await ConnectorFactory.get("edr", prisma)) as SentinelOneEdrConnector;

  // Get site info for SKU
  const sites = await edr.getSites();
  const site = sites.find((s) => s.id === siteId);
  const sku = site?.sku ?? "unknown";
  const skuKey = sku.toLowerCase().replace(/\s+/g, "_");

  // Get agent count
  const result = await edr.getAgents({ siteId }, undefined, 1);
  const count = result.totalCount ?? result.data.length;

  return [
    {
      toolId: "sentinelone",
      productKey: skuKey,
      productName: `SentinelOne ${sku}`,
      count,
      unit: "agents",
      lastSyncedAt: new Date(),
    },
  ];
}

async function getCoveCounts(
  customerId: string,
  prisma: PrismaClient
): Promise<Omit<VendorCount, "companyExternalId">[]> {
  const backup = await ConnectorFactory.get("backup", prisma);
  const devices = await backup.getDevices({ customerId });

  let serverBackup = 0, workstationBackup = 0, m365Backup = 0;

  for (const d of devices) {
    if (isM365Tenant(d)) {
      m365Backup++;
    } else if (d.osType === "server") {
      serverBackup++;
    } else {
      workstationBackup++;
    }
  }

  const now = new Date();
  const counts: Omit<VendorCount, "companyExternalId">[] = [];
  if (serverBackup > 0) {
    counts.push({ toolId: "cove", productKey: "server_backup", productName: "Cove Server Backup", count: serverBackup, unit: "devices", lastSyncedAt: now });
  }
  if (workstationBackup > 0) {
    counts.push({ toolId: "cove", productKey: "workstation_backup", productName: "Cove Workstation Backup", count: workstationBackup, unit: "devices", lastSyncedAt: now });
  }
  if (m365Backup > 0) {
    counts.push({ toolId: "cove", productKey: "m365_backup", productName: "Cove M365 Backup", count: m365Backup, unit: "tenants", lastSyncedAt: now });
  }
  return counts;
}

async function getPax8Counts(
  companyExternalId: string,
  prisma: PrismaClient
): Promise<Omit<VendorCount, "companyExternalId">[]> {
  const licensing = (await ConnectorFactory.get("licensing", prisma)) as Pax8LicensingConnector;
  const subscriptions = await licensing.getSubscriptions({
    companyId: companyExternalId,
    status: "Active",
  });

  // Group subscriptions by product name → sum quantities
  const byProduct = new Map<string, { name: string; qty: number }>();
  for (const sub of subscriptions) {
    const key = sub.productName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const existing = byProduct.get(key) ?? { name: sub.productName, qty: 0 };
    existing.qty += sub.quantity;
    byProduct.set(key, existing);
  }

  const now = new Date();
  return Array.from(byProduct.entries()).map(([productKey, { name, qty }]) => ({
    toolId: "pax8",
    productKey,
    productName: name,
    count: qty,
    unit: "licenses",
    lastSyncedAt: now,
  }));
}

// ─── Reconciliation Engine ──────────────────────────────────

/**
 * Run reconciliation for a single company.
 * Compares vendor counts to CW agreement addition quantities
 * using BillingProductMapping to know which vendor product maps to which PSA product.
 */
export async function reconcileCompany(
  companyId: string,
  prisma: PrismaClient,
  triggeredBy: string
): Promise<ReconciliationResult> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  // Resolve actor name for activity log
  let actorName: string | null = null;
  if (triggeredBy && triggeredBy !== "system") {
    const actor = await prisma.user.findUnique({
      where: { id: triggeredBy },
      select: { name: true },
    });
    actorName = actor?.name ?? null;
  }

  // 0. Ensure vendor products are seeded in DB
  await ensureVendorProductsSeeded(prisma);

  // 1. Get all active agreement additions for this company
  const additions = await prisma.agreementAddition.findMany({
    where: {
      agreement: { companyId, cancelledFlag: false },
      cancelledFlag: false,
      billCustomer: { not: "DoNotBill" },
    },
    include: {
      agreement: { select: { id: true, name: true, psaSourceId: true } },
    },
  });

  // 2. Get all vendor counts for this company
  const vendorCounts = await getVendorCountsForCompany(companyId, prisma);

  // 2b. Auto-create product assignments for discovered vendor-company links
  for (const vc of vendorCounts) {
    if (vc.count === 0) continue;
    const vendorProduct = await prisma.billingVendorProduct.findUnique({
      where: { vendorToolId_productKey: { vendorToolId: vc.toolId, productKey: vc.productKey } },
    });
    if (vendorProduct) {
      await prisma.companyBillingAssignment.upsert({
        where: { companyId_vendorProductId: { companyId, vendorProductId: vendorProduct.id } },
        update: {},
        create: { companyId, vendorProductId: vendorProduct.id, isAutoDiscovered: true },
      });
    }
  }

  // 3. Get all product mappings
  const mappings = await prisma.billingProductMapping.findMany({
    where: { isActive: true },
  });

  // 4. Create snapshot
  const snapshot = await prisma.reconciliationSnapshot.create({
    data: {
      companyId,
      triggeredBy,
      status: "in_progress",
    },
  });

  let discrepancies = 0;
  let totalRevenueImpact = 0;
  let totalItems = 0;

  // 5. For each vendor count, find matching PSA additions via product mapping
  for (const vc of vendorCounts) {
    // Find mappings for this vendor tool + product key
    // Also support legacy "all_devices" / "all_agents" wildcard keys
    const relevantMappings = mappings.filter(
      (m) =>
        m.vendorToolId === vc.toolId &&
        (m.vendorProductKey === vc.productKey ||
         m.vendorProductKey === "*" ||
         m.vendorProductKey === "all_devices" ||
         m.vendorProductKey === "all_agents")
    );

    for (const mapping of relevantMappings) {
      if (!mapping.psaProductName) continue;

      // Find matching additions by product name (case-insensitive partial match)
      const matchingAdditions = additions.filter((a) =>
        a.productName.toLowerCase().includes(mapping.psaProductName!.toLowerCase())
      );

      if (matchingAdditions.length === 0) {
        // Vendor has counts but no PSA addition found — still create an item
        const createdItem = await prisma.reconciliationItem.create({
          data: {
            snapshotId: snapshot.id,
            companyId,
            productName: mapping.psaProductName,
            vendorToolId: vc.toolId,
            vendorProductKey: vc.productKey,
            vendorProductName: vc.productName,
            psaQty: 0,
            vendorQty: vc.count,
            discrepancy: vc.count,
            unitPrice: null,
            revenueImpact: null,
            status: "pending",
          },
        });

        // Log activity: discrepancy detected (no PSA addition)
        await prisma.billingActivityEntry.create({
          data: {
            companyId,
            companyName: company.name,
            agreementName: null,
            productName: mapping.psaProductName!,
            vendorToolId: vc.toolId,
            vendorProductName: vc.productName,
            psaQty: 0,
            vendorQty: vc.count,
            change: vc.count,
            action: "detected",
            result: "pending",
            resultNote: "No matching PSA addition found",
            actorId: triggeredBy !== "system" ? triggeredBy : null,
            actorName: actorName ?? (triggeredBy === "system" ? "System" : null),
            snapshotId: snapshot.id,
            reconciliationItemId: createdItem.id,
          },
        });

        discrepancies++;
        totalItems++;
        continue;
      }

      // Sum up PSA quantities across matching additions
      const psaTotal = matchingAdditions.reduce((sum, a) => sum + a.quantity, 0);
      const avgPrice =
        matchingAdditions.reduce((sum, a) => sum + (a.unitPrice ?? 0), 0) /
        matchingAdditions.length;
      const diff = vc.count - psaTotal;
      const impact = diff * avgPrice;

      // Use first matching addition for the write-back IDs
      const firstAdd = matchingAdditions[0];

      const createdItem2 = await prisma.reconciliationItem.create({
        data: {
          snapshotId: snapshot.id,
          companyId,
          agreementId: firstAdd.agreement.id,
          agreementName: firstAdd.agreement.name,
          additionPsaId: firstAdd.psaSourceId,
          agreementPsaId: firstAdd.agreement.psaSourceId,
          productName: firstAdd.productName,
          vendorToolId: vc.toolId,
          vendorProductKey: vc.productKey,
          vendorProductName: vc.productName,
          psaQty: psaTotal,
          vendorQty: vc.count,
          discrepancy: diff,
          unitPrice: avgPrice || null,
          revenueImpact: impact || null,
          status: diff === 0 ? "approved" : "pending",
        },
      });

      // Log activity entry for every item (discrepancy or match)
      if (diff !== 0) {
        await prisma.billingActivityEntry.create({
          data: {
            companyId,
            companyName: company.name,
            agreementName: firstAdd.agreement.name,
            productName: firstAdd.productName,
            vendorToolId: vc.toolId,
            vendorProductName: vc.productName,
            psaQty: psaTotal,
            vendorQty: vc.count,
            change: diff,
            action: "detected",
            result: "pending",
            resultNote: diff > 0 ? `Underbilled by ${diff}` : `Overbilled by ${Math.abs(diff)}`,
            actorId: triggeredBy !== "system" ? triggeredBy : null,
            actorName: actorName ?? (triggeredBy === "system" ? "System" : null),
            snapshotId: snapshot.id,
            reconciliationItemId: createdItem2.id,
          },
        });
      } else {
        await prisma.billingActivityEntry.create({
          data: {
            companyId,
            companyName: company.name,
            agreementName: firstAdd.agreement.name,
            productName: firstAdd.productName,
            vendorToolId: vc.toolId,
            vendorProductName: vc.productName,
            psaQty: psaTotal,
            vendorQty: vc.count,
            change: 0,
            action: "auto_approved",
            result: "no_action",
            resultNote: "Counts match",
            actorId: triggeredBy !== "system" ? triggeredBy : null,
            actorName: actorName ?? (triggeredBy === "system" ? "System" : null),
            snapshotId: snapshot.id,
            reconciliationItemId: createdItem2.id,
          },
        });
      }

      if (diff !== 0) discrepancies++;
      totalRevenueImpact += impact;
      totalItems++;
    }
  }

  // 6. Update snapshot with summary
  await prisma.reconciliationSnapshot.update({
    where: { id: snapshot.id },
    data: {
      status: "completed",
      summary: {
        totalItems,
        discrepancies,
        totalRevenueImpact,
        matchedCount: totalItems - discrepancies,
      },
    },
  });

  return {
    snapshotId: snapshot.id,
    companyId,
    companyName: company.name,
    totalItems,
    discrepancies,
    totalRevenueImpact,
  };
}

/**
 * Get a live vendor count for a single item (used by the Reconcile button).
 * Fetches real-time data from the vendor API — not cached.
 * When productKey is provided, returns count for that specific product type.
 */
export async function getLiveVendorCount(
  toolId: string,
  externalId: string,
  prisma: PrismaClient,
  productKey?: string
): Promise<number> {
  switch (toolId) {
    case "ninjaone": {
      const counts = await getNinjaOneCounts(externalId, prisma);
      if (productKey) {
        return counts.find((c) => c.productKey === productKey)?.count ?? 0;
      }
      return counts.reduce((sum, c) => sum + c.count, 0);
    }
    case "sentinelone": {
      const counts = await getSentinelOneCounts(externalId, prisma);
      if (productKey) {
        return counts.find((c) => c.productKey === productKey)?.count ?? 0;
      }
      return counts[0]?.count ?? 0;
    }
    case "cove": {
      const counts = await getCoveCounts(externalId, prisma);
      if (productKey) {
        return counts.find((c) => c.productKey === productKey)?.count ?? 0;
      }
      return counts.reduce((sum, c) => sum + c.count, 0);
    }
    case "pax8": {
      const counts = await getPax8Counts(externalId, prisma);
      if (productKey) {
        return counts.find((c) => c.productKey === productKey)?.count ?? 0;
      }
      return counts.reduce((sum, c) => sum + c.count, 0);
    }
    default:
      return 0;
  }
}
