/**
 * IT Glue Sync Service — caches IT Glue metadata locally for search & permissions.
 *
 * Syncs: organizations, flexible asset types, password categories, and asset metadata.
 * Does NOT cache passwords or sensitive content — only names/IDs for search and permissions.
 *
 * Follows the fleet-refresh pattern: sequential API calls, Redis progress tracking, concurrent lock.
 */

import type { PrismaClient } from "@prisma/client";
import { ConnectorFactory } from "../connectors/factory";
import { ItGlueDocumentationConnector } from "../connectors/itglue/connector";
import type { ITGluePasswordAttributes, ITGlueFlexibleAssetAttributes, ITGlueConfigurationAttributes, ITGlueContactAttributes, ITGlueOrganizationAttributes } from "../connectors/itglue/types";
import type { RequestOptions } from "../connectors/_base/types";
import { redis } from "@/lib/redis";

const LOCK_KEY = "itglue:sync:lock";
const PROGRESS_KEY = "itglue:sync:progress";
const LOCK_TTL = 3600; // 1 hour
const PROGRESS_TTL = 3600;
const INTER_REQUEST_DELAY_MS = 200; // 5 req/sec, well under IT Glue's 600/min

export interface ITGlueSyncResult {
  success: boolean;
  error?: string;
  orgs: { upserted: number; removed: number };
  assetTypes: { upserted: number };
  passwordCategories: { upserted: number };
  assets: { upserted: number; removed: number };
  durationMs: number;
}

interface SyncProgress {
  status: "running" | "completed" | "failed";
  phase: string;
  currentOrg?: string;
  orgsCompleted?: number;
  orgsTotal?: number;
  assetsUpserted?: number;
  startedAt: number;
  error?: string;
}

async function updateProgress(progress: Partial<SyncProgress>) {
  const existing = await redis.get(PROGRESS_KEY);
  const current: SyncProgress = existing
    ? JSON.parse(existing)
    : { status: "running", phase: "initializing", startedAt: Date.now() };

  const updated = { ...current, ...progress };
  await redis.set(PROGRESS_KEY, JSON.stringify(updated), "EX", PROGRESS_TTL);
}

export async function getSyncProgress(): Promise<SyncProgress | null> {
  const raw = await redis.get(PROGRESS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Auto-paginate an IT Glue list endpoint, yielding all records across all pages.
 * Uses the connector's public requestListRaw method.
 */
async function paginateAll<T>(
  connector: ItGlueDocumentationConnector,
  options: RequestOptions & { sort?: string; filters?: Record<string, string>; include?: string },
  pageSize = 200
): Promise<Array<{ id: string; type: string; attributes: T }>> {
  const allRecords: Array<{ id: string; type: string; attributes: T }> = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await connector.requestListRaw<T>({
      ...options,
      page,
      pageSize,
    });
    allRecords.push(...response.data);

    const totalPages = response.meta?.["total-pages"] ?? 1;
    hasMore = page < totalPages;
    page++;

    if (hasMore) await delay(INTER_REQUEST_DELAY_MS);
  }

  return allRecords;
}

// ─── Sync Functions ─────────────────────────────────────────────────

async function syncOrganizations(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient
): Promise<{ upserted: number; removed: number }> {
  const allOrgs = await paginateAll<ITGlueOrganizationAttributes>(
    connector,
    { path: "/organizations", sort: "name" }
  );

  // Get CompanyIntegrationMappings for IT Glue to resolve companyId
  const mappings = await prisma.companyIntegrationMapping.findMany({
    where: { toolId: "itglue" },
    select: { externalId: true, companyId: true },
  });
  const mappingByExternalId = new Map(mappings.map((m) => [m.externalId, m.companyId]));

  const seenIds = new Set<string>();
  let upserted = 0;

  for (const org of allOrgs) {
    const itGlueId = org.id;
    seenIds.add(itGlueId);

    await prisma.iTGlueCachedOrg.upsert({
      where: { itGlueId },
      create: {
        itGlueId,
        name: org.attributes.name,
        shortName: org.attributes["short-name"] ?? null,
        status: org.attributes["organization-status-name"] ?? null,
        orgType: org.attributes["organization-type-name"] ?? null,
        companyId: mappingByExternalId.get(itGlueId) ?? null,
        syncedAt: new Date(),
      },
      update: {
        name: org.attributes.name,
        shortName: org.attributes["short-name"] ?? null,
        status: org.attributes["organization-status-name"] ?? null,
        orgType: org.attributes["organization-type-name"] ?? null,
        companyId: mappingByExternalId.get(itGlueId) ?? null,
        syncedAt: new Date(),
      },
    });
    upserted++;
  }

  // Remove orgs that no longer exist in IT Glue
  const removed = await prisma.iTGlueCachedOrg.deleteMany({
    where: { itGlueId: { notIn: Array.from(seenIds) } },
  });

  return { upserted, removed: removed.count };
}

async function syncFlexibleAssetTypes(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient
): Promise<{ upserted: number }> {
  const types = await connector.getFlexibleAssetTypes();
  let upserted = 0;

  for (const t of types) {
    await prisma.iTGlueCachedFlexibleAssetType.upsert({
      where: { itGlueId: t.id },
      create: {
        itGlueId: t.id,
        name: t.name,
        description: t.description ?? null,
        syncedAt: new Date(),
      },
      update: {
        name: t.name,
        description: t.description ?? null,
        syncedAt: new Date(),
      },
    });
    upserted++;
  }

  return { upserted };
}

async function syncOrgPasswords(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient,
  orgId: string,
  discoveredCategories: Map<string, string>
): Promise<number> {
  const allPasswords = await paginateAll<ITGluePasswordAttributes>(
    connector,
    { path: `/organizations/${orgId}/relationships/passwords`, sort: "name" }
  );

  let count = 0;
  for (const pw of allPasswords) {
    const categoryId = pw.attributes["password-category-id"]
      ? String(pw.attributes["password-category-id"])
      : null;
    const categoryName = pw.attributes["password-category-name"] ?? null;

    // Discover password categories from the data
    if (categoryId && categoryName) {
      discoveredCategories.set(categoryId, categoryName);
    }

    await prisma.iTGlueCachedAsset.upsert({
      where: { itGlueId: pw.id },
      create: {
        itGlueId: pw.id,
        orgId,
        section: "passwords",
        categoryId,
        categoryName,
        name: pw.attributes.name,
        itGlueUpdatedAt: pw.attributes["updated-at"]
          ? new Date(pw.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
      update: {
        orgId,
        section: "passwords",
        categoryId,
        categoryName,
        name: pw.attributes.name,
        itGlueUpdatedAt: pw.attributes["updated-at"]
          ? new Date(pw.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

async function syncOrgFlexibleAssets(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient,
  orgId: string
): Promise<number> {
  const allAssets = await paginateAll<ITGlueFlexibleAssetAttributes>(
    connector,
    { path: `/organizations/${orgId}/relationships/flexible_assets`, sort: "-updated-at" }
  );

  let count = 0;
  for (const asset of allAssets) {
    const categoryId = asset.attributes["flexible-asset-type-id"]
      ? String(asset.attributes["flexible-asset-type-id"])
      : null;
    const categoryName = asset.attributes["flexible-asset-type-name"] ?? null;

    await prisma.iTGlueCachedAsset.upsert({
      where: { itGlueId: asset.id },
      create: {
        itGlueId: asset.id,
        orgId,
        section: "flexible_assets",
        categoryId,
        categoryName,
        name: asset.attributes.name ?? `Flexible Asset ${asset.id}`,
        itGlueUpdatedAt: asset.attributes["updated-at"]
          ? new Date(asset.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
      update: {
        orgId,
        section: "flexible_assets",
        categoryId,
        categoryName,
        name: asset.attributes.name ?? `Flexible Asset ${asset.id}`,
        itGlueUpdatedAt: asset.attributes["updated-at"]
          ? new Date(asset.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

async function syncOrgConfigurations(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient,
  orgId: string
): Promise<number> {
  const allConfigs = await paginateAll<ITGlueConfigurationAttributes>(
    connector,
    { path: `/organizations/${orgId}/relationships/configurations`, sort: "name" }
  );

  let count = 0;
  for (const config of allConfigs) {
    const categoryId = config.attributes["configuration-type-id"]
      ? String(config.attributes["configuration-type-id"])
      : null;
    const categoryName = config.attributes["configuration-type-name"] ?? null;

    await prisma.iTGlueCachedAsset.upsert({
      where: { itGlueId: config.id },
      create: {
        itGlueId: config.id,
        orgId,
        section: "configurations",
        categoryId,
        categoryName,
        name: config.attributes.hostname ?? config.attributes.name,
        itGlueUpdatedAt: config.attributes["updated-at"]
          ? new Date(config.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
      update: {
        orgId,
        section: "configurations",
        categoryId,
        categoryName,
        name: config.attributes.hostname ?? config.attributes.name,
        itGlueUpdatedAt: config.attributes["updated-at"]
          ? new Date(config.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

async function syncOrgContacts(
  connector: ItGlueDocumentationConnector,
  prisma: PrismaClient,
  orgId: string
): Promise<number> {
  const allContacts = await paginateAll<ITGlueContactAttributes>(
    connector,
    { path: `/organizations/${orgId}/relationships/contacts`, sort: "last-name" }
  );

  let count = 0;
  for (const contact of allContacts) {
    const name = [contact.attributes["first-name"], contact.attributes["last-name"]]
      .filter(Boolean)
      .join(" ") || `Contact ${contact.id}`;

    await prisma.iTGlueCachedAsset.upsert({
      where: { itGlueId: contact.id },
      create: {
        itGlueId: contact.id,
        orgId,
        section: "contacts",
        name,
        itGlueUpdatedAt: contact.attributes["updated-at"]
          ? new Date(contact.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
      update: {
        orgId,
        section: "contacts",
        name,
        itGlueUpdatedAt: contact.attributes["updated-at"]
          ? new Date(contact.attributes["updated-at"])
          : null,
        syncedAt: new Date(),
      },
    });
    count++;
  }

  return count;
}

// ─── Main Orchestrator ──────────────────────────────────────────────

export async function runITGlueSync(
  prisma: PrismaClient,
  mode: "full" | "incremental" = "full"
): Promise<ITGlueSyncResult> {
  const startTime = Date.now();

  // Acquire lock
  const acquired = await redis.set(LOCK_KEY, "1", "EX", LOCK_TTL, "NX");
  if (!acquired) {
    return {
      success: false,
      error: "Sync already in progress",
      orgs: { upserted: 0, removed: 0 },
      assetTypes: { upserted: 0 },
      passwordCategories: { upserted: 0 },
      assets: { upserted: 0, removed: 0 },
      durationMs: Date.now() - startTime,
    };
  }

  const result: ITGlueSyncResult = {
    success: false,
    orgs: { upserted: 0, removed: 0 },
    assetTypes: { upserted: 0 },
    passwordCategories: { upserted: 0 },
    assets: { upserted: 0, removed: 0 },
    durationMs: 0,
  };

  try {
    await updateProgress({ status: "running", phase: "initializing", startedAt: startTime });

    // Get IT Glue connector
    const connector = (await ConnectorFactory.get(
      "documentation",
      prisma
    )) as ItGlueDocumentationConnector;

    // Phase 1: Sync organizations
    await updateProgress({ phase: "organizations" });
    result.orgs = await syncOrganizations(connector, prisma);

    // Update sync state
    await prisma.iTGlueSyncState.upsert({
      where: { entityType: "organizations" },
      create: { entityType: "organizations", lastSyncedAt: new Date(), totalSynced: result.orgs.upserted, status: "idle" },
      update: { lastSyncedAt: new Date(), totalSynced: result.orgs.upserted, status: "idle" },
    });

    // Phase 2: Sync flexible asset types
    await updateProgress({ phase: "flexible_asset_types" });
    result.assetTypes = await syncFlexibleAssetTypes(connector, prisma);

    await prisma.iTGlueSyncState.upsert({
      where: { entityType: "flexible_asset_types" },
      create: { entityType: "flexible_asset_types", lastSyncedAt: new Date(), totalSynced: result.assetTypes.upserted, status: "idle" },
      update: { lastSyncedAt: new Date(), totalSynced: result.assetTypes.upserted, status: "idle" },
    });

    // Phase 3: Sync assets per org
    await updateProgress({ phase: "assets", orgsCompleted: 0, assetsUpserted: 0 });
    const cachedOrgs = await prisma.iTGlueCachedOrg.findMany({
      where: mode === "full" ? {} : { status: "Active" },
      select: { itGlueId: true, name: true },
    });

    let totalAssetsUpserted = 0;
    const seenAssetIds = new Set<string>();
    const discoveredCategories = new Map<string, string>();

    for (let i = 0; i < cachedOrgs.length; i++) {
      const org = cachedOrgs[i];
      await updateProgress({
        currentOrg: org.name,
        orgsCompleted: i,
        orgsTotal: cachedOrgs.length,
        assetsUpserted: totalAssetsUpserted,
      });

      try {
        // Track all assets for this org before sync to detect removals
        const existingAssets = await prisma.iTGlueCachedAsset.findMany({
          where: { orgId: org.itGlueId },
          select: { itGlueId: true },
        });
        existingAssets.forEach((a) => seenAssetIds.add(a.itGlueId));

        const pwCount = await syncOrgPasswords(connector, prisma, org.itGlueId, discoveredCategories);
        const faCount = await syncOrgFlexibleAssets(connector, prisma, org.itGlueId);
        const cfgCount = await syncOrgConfigurations(connector, prisma, org.itGlueId);
        const ctCount = await syncOrgContacts(connector, prisma, org.itGlueId);

        totalAssetsUpserted += pwCount + faCount + cfgCount + ctCount;
      } catch (error) {
        console.error(`[ITGlue Sync] Failed to sync org ${org.name} (${org.itGlueId}):`, error);
        // Continue with next org — don't fail the whole sync
      }
    }

    // Upsert discovered password categories
    for (const [catId, catName] of discoveredCategories) {
      await prisma.iTGlueCachedPasswordCategory.upsert({
        where: { itGlueId: catId },
        create: { itGlueId: catId, name: catName, syncedAt: new Date() },
        update: { name: catName, syncedAt: new Date() },
      });
    }
    result.passwordCategories = { upserted: discoveredCategories.size };

    await prisma.iTGlueSyncState.upsert({
      where: { entityType: "password_categories" },
      create: { entityType: "password_categories", lastSyncedAt: new Date(), totalSynced: discoveredCategories.size, status: "idle" },
      update: { lastSyncedAt: new Date(), totalSynced: discoveredCategories.size, status: "idle" },
    });

    result.assets = { upserted: totalAssetsUpserted, removed: 0 };

    await prisma.iTGlueSyncState.upsert({
      where: { entityType: "assets" },
      create: { entityType: "assets", lastSyncedAt: new Date(), totalSynced: totalAssetsUpserted, status: "idle" },
      update: { lastSyncedAt: new Date(), totalSynced: totalAssetsUpserted, status: "idle" },
    });

    result.success = true;
    result.durationMs = Date.now() - startTime;

    await updateProgress({
      status: "completed",
      phase: "done",
      orgsCompleted: cachedOrgs.length,
      orgsTotal: cachedOrgs.length,
      assetsUpserted: totalAssetsUpserted,
    });
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    result.durationMs = Date.now() - startTime;

    await updateProgress({
      status: "failed",
      phase: "error",
      error: result.error,
    });

    console.error("[ITGlue Sync] Fatal error:", error);
  } finally {
    await redis.del(LOCK_KEY);
  }

  return result;
}
