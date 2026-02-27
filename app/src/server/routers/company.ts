/**
 * Company Router — manages local Company records synced from the PSA.
 *
 * PSA (ConnectWise) is the source of truth. Companies are synced into
 * a local table so all other integrations can map their orgs/sites to them.
 * Sub-entities (contacts, sites, configurations, agreements) are also synced.
 *
 * Two sync modes:
 *   Auto  — filter by CW status/type, syncs all matching. Handles removal policy.
 *   Manual — user selects specific companies via the explorer.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";
import { ConnectorError } from "../connectors/_base/errors";
import { redis } from "@/lib/redis";
import type { NormalizedOrganization } from "../connectors/_interfaces/common";
import type { ConnectWisePsaConnector } from "../connectors/connectwise/connector";
import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

// ─── Sync Progress (Redis-backed) ───────────────────────────
const SYNC_PROGRESS_KEY = "cw:sync:progress";
const SYNC_PROGRESS_TTL = 3600; // 1 hour

interface SyncProgress {
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  current: number;
  total: number;
  phase: string;
  counts: {
    companies: { synced: number; created: number; unmatched: number; removed: number };
    contacts: { synced: number; created: number; skipped: boolean; error?: string };
    sites: { synced: number; created: number; skipped: boolean; error?: string };
    configurations: { synced: number; created: number; skipped: boolean; error?: string };
    agreements: { synced: number; created: number; skipped: boolean; error?: string };
  };
  error?: string;
}

async function setSyncProgress(progress: SyncProgress) {
  await redis.set(SYNC_PROGRESS_KEY, JSON.stringify(progress), "EX", SYNC_PROGRESS_TTL);
}

async function getSyncProgress(): Promise<SyncProgress | null> {
  const raw = await redis.get(SYNC_PROGRESS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function classifySyncError(err: unknown): string {
  if (err instanceof ConnectorError) {
    if (err.statusCode === 401) return "Authentication failed — check API credentials";
    if (err.statusCode === 403) return "CW permissions needed";
    if (err.statusCode === 429) return "Rate limited by ConnectWise — try again shortly";
    if (err.statusCode === 404) return "API endpoint not found — check CW version";
    if (err.statusCode && err.statusCode >= 500) return `ConnectWise server error (${err.statusCode})`;
    return err.message;
  }
  if (err instanceof Error) {
    if (err.message.includes("timed out") || err.message.includes("timeout")) return "Request timed out";
    return err.message;
  }
  return "Unknown error";
}

// ─── Sub-Entity Sync Helper ─────────────────────────────────
// Syncs contacts, sites, configurations, and agreements for a single company.
// Called by both runAutoSync and syncSelected.

interface SubEntityCounts {
  contacts: { synced: number; created: number; skipped: boolean; error?: string };
  sites: { synced: number; created: number; skipped: boolean; error?: string };
  configurations: { synced: number; created: number; skipped: boolean; error?: string };
  agreements: { synced: number; created: number; skipped: boolean; error?: string };
  additions: { synced: number; created: number; skipped: boolean; error?: string };
}

async function syncCompanySubEntities(
  prisma: PrismaClient,
  connector: ConnectWisePsaConnector,
  localCompanyId: string,
  psaSourceId: string
): Promise<SubEntityCounts> {
  const counts: SubEntityCounts = {
    contacts: { synced: 0, created: 0, skipped: false },
    sites: { synced: 0, created: 0, skipped: false },
    configurations: { synced: 0, created: 0, skipped: false },
    agreements: { synced: 0, created: 0, skipped: false },
    additions: { synced: 0, created: 0, skipped: false },
  };

  // ── Contacts ──
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await connector.getContacts(psaSourceId, undefined, page, 100);
      for (const contact of result.data) {
        const raw = contact._raw as Record<string, unknown> | undefined;
        const commItems = raw?.communicationItems;
        // Extract email/phone from communicationItems
        let email: string | undefined;
        let phone: string | undefined;
        let mobilePhone: string | undefined;
        if (Array.isArray(commItems)) {
          for (const item of commItems as Array<{ communicationType?: string; type?: { name?: string }; value?: string; defaultFlag?: boolean }>) {
            if (item.communicationType === "Email" && item.defaultFlag) {
              email = item.value;
            } else if (item.communicationType === "Phone") {
              if (item.type?.name === "Direct" || item.type?.name === "Work") {
                phone = phone || item.value;
              } else if (item.type?.name === "Cell") {
                mobilePhone = item.value;
              }
            }
          }
        }
        // Fallback to normalized fields
        email = email || contact.email || undefined;
        phone = phone || contact.phone || undefined;

        const existing = await prisma.companyContact.findUnique({
          where: { psaSourceId: contact.sourceId },
        });

        const data = {
          firstName: contact.firstName,
          lastName: contact.lastName,
          title: contact.title || null,
          email: email || null,
          phone: phone || null,
          mobilePhone: mobilePhone || null,
          defaultFlag: (raw?.defaultFlag as boolean) ?? false,
          inactiveFlag: (raw?.inactiveFlag as boolean) ?? false,
          communicationItems: commItems as Prisma.InputJsonValue ?? undefined,
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await prisma.companyContact.update({ where: { id: existing.id }, data });
          counts.contacts.synced++;
        } else {
          await prisma.companyContact.create({
            data: { ...data, companyId: localCompanyId, psaSourceId: contact.sourceId },
          });
          counts.contacts.created++;
        }
      }
      hasMore = result.hasMore;
      page++;
    }
  } catch (err) {
    const reason = classifySyncError(err);
    console.error("[CW Sync] Contacts sync failed:", reason, err);
    counts.contacts.skipped = true;
    counts.contacts.error = reason;
  }

  // ── Sites ──
  try {
    const sites = await connector.getCompanySites(psaSourceId);
    for (const site of sites) {
      const existing = await prisma.companySite.findUnique({
        where: { psaSourceId: String(site.id) },
      });

      const data = {
        name: site.name,
        addressLine1: site.addressLine1 || null,
        city: site.city || null,
        state: site.state || null,
        zip: site.zip || null,
        country: site.country?.name || null,
        phone: site.phoneNumber || null,
        primaryFlag: site.primaryAddressFlag ?? false,
        inactiveFlag: site.inactiveFlag ?? false,
        lastSyncedAt: new Date(),
      };

      if (existing) {
        await prisma.companySite.update({ where: { id: existing.id }, data });
        counts.sites.synced++;
      } else {
        await prisma.companySite.create({
          data: { ...data, companyId: localCompanyId, psaSourceId: String(site.id) },
        });
        counts.sites.created++;
      }
    }
  } catch (err) {
    const reason = classifySyncError(err);
    console.error("[CW Sync] Sites sync failed:", reason, err);
    counts.sites.skipped = true;
    counts.sites.error = reason;
  }

  // ── Configurations ──
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await connector.getCompanyConfigurations(psaSourceId, page, 100);
      for (const config of result.data) {
        const existing = await prisma.companyConfiguration.findUnique({
          where: { psaSourceId: String(config.id) },
        });

        const data = {
          name: config.name,
          type: config.type?.name || null,
          status: config.status?.name || null,
          serialNumber: config.serialNumber || null,
          modelNumber: config.modelNumber || null,
          osType: config.osType || null,
          osInfo: config.osInfo || null,
          ipAddress: config.ipAddress || null,
          macAddress: config.macAddress || null,
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await prisma.companyConfiguration.update({ where: { id: existing.id }, data });
          counts.configurations.synced++;
        } else {
          await prisma.companyConfiguration.create({
            data: { ...data, companyId: localCompanyId, psaSourceId: String(config.id) },
          });
          counts.configurations.created++;
        }
      }
      hasMore = result.hasMore;
      page++;
    }
  } catch (err) {
    const reason = classifySyncError(err);
    console.error("[CW Sync] Configurations sync failed:", reason, err);
    counts.configurations.skipped = true;
    counts.configurations.error = reason;
  }

  // ── Agreements ──
  const syncedAgreements: Array<{ cwId: string; localId: string }> = [];
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await connector.getCompanyAgreements(psaSourceId, page, 100);
      for (const agr of result.data) {
        const existing = await prisma.companyAgreement.findUnique({
          where: { psaSourceId: String(agr.id) },
        });

        const data = {
          name: agr.name,
          type: agr.type?.name || null,
          startDate: agr.startDate ? new Date(agr.startDate) : null,
          endDate: agr.endDate ? new Date(agr.endDate) : null,
          cancelledFlag: agr.cancelledFlag ?? false,
          noEndingDateFlag: agr.noEndingDateFlag ?? false,
          billAmount: agr.billAmount ?? null,
          billCycle: agr.billCycle?.name || null,
          lastSyncedAt: new Date(),
        };

        let localId: string;
        if (existing) {
          await prisma.companyAgreement.update({ where: { id: existing.id }, data });
          localId = existing.id;
          counts.agreements.synced++;
        } else {
          const created = await prisma.companyAgreement.create({
            data: { ...data, companyId: localCompanyId, psaSourceId: String(agr.id) },
          });
          localId = created.id;
          counts.agreements.created++;
        }
        // Track for additions sync (skip cancelled agreements)
        if (!agr.cancelledFlag) {
          syncedAgreements.push({ cwId: String(agr.id), localId });
        }
      }
      hasMore = result.hasMore;
      page++;
    }
  } catch (err) {
    const reason = classifySyncError(err);
    console.error("[CW Sync] Agreements sync failed:", reason, err);
    counts.agreements.skipped = true;
    counts.agreements.error = reason;
  }

  // ── Agreement Additions (billing line items) ──
  console.log(`[CW Sync] Syncing additions for ${syncedAgreements.length} agreements:`, syncedAgreements.map(a => a.cwId));
  try {
    for (const agr of syncedAgreements) {
      let addPage = 1;
      let addHasMore = true;
      while (addHasMore) {
        const addResult = await connector.getAgreementAdditions(agr.cwId, addPage, 100);
        console.log(`[CW Sync] Agreement ${agr.cwId}: got ${addResult.data.length} additions (page ${addPage})`);
        for (const add of addResult.data) {
          const existing = await prisma.agreementAddition.findUnique({
            where: { psaSourceId: String(add.id) },
          });

          const addData = {
            productId: add.product?.id ? String(add.product.id) : null,
            productName: add.product?.description || add.description || "Unknown Product",
            description: add.description || null,
            quantity: add.quantity ?? 0,
            unitPrice: add.unitPrice ?? null,
            unitCost: add.unitCost ?? null,
            effectiveDate: add.effectiveDate ? new Date(add.effectiveDate) : null,
            endDate: add.cancelledDate ? new Date(add.cancelledDate) : null,
            cancelledFlag: !!add.cancelledDate,
            billCustomer: add.billCustomer || null,
            taxableFlag: add.taxableFlag ?? false,
            lastSyncedAt: new Date(),
          };

          if (existing) {
            await prisma.agreementAddition.update({ where: { id: existing.id }, data: addData });
            counts.additions.synced++;
          } else {
            await prisma.agreementAddition.create({
              data: { ...addData, agreementId: agr.localId, psaSourceId: String(add.id) },
            });
            counts.additions.created++;
          }
        }
        addHasMore = addResult.hasMore;
        addPage++;
      }
    }
  } catch (err) {
    console.error("[CW Sync] Agreement additions sync failed:", err);
    counts.additions.skipped = true;
  }

  return counts;
}

// Extract company fields from a NormalizedOrganization
function extractCompanyFields(org: NormalizedOrganization) {
  const raw = org._raw as Record<string, unknown> | undefined;
  const identifier =
    raw && typeof raw.identifier === "string" ? raw.identifier : undefined;
  const typeName = (raw?.types as Array<{ name?: string }> | undefined)?.[0]?.name ?? null;

  return {
    name: org.name,
    identifier,
    type: typeName,
    status: org.status ?? "Active",
    phone: org.phone,
    website: org.website,
    addressLine1: org.address?.street,
    city: org.address?.city,
    state: org.address?.state,
    zip: org.address?.zip,
    country: org.address?.country,
    lastSyncedAt: new Date(),
  };
}

export const companyRouter = router({
  // ─── List & Read ───────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        searchTerm: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.searchTerm) {
        where.name = { contains: input.searchTerm, mode: "insensitive" };
      }
      if (input.status) {
        where.status = input.status;
      }

      const [companies, totalCount] = await Promise.all([
        ctx.prisma.company.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            integrationMappings: true,
            _count: { select: { threecxInstances: true, contacts: true, sites: true } },
          },
        }),
        ctx.prisma.company.count({ where }),
      ]);

      return {
        data: companies,
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.id },
        include: {
          integrationMappings: true,
          threecxInstances: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              fqdn: true,
              status: true,
              version: true,
              callsActive: true,
              extensionsRegistered: true,
              extensionsTotal: true,
              trunksRegistered: true,
              trunksTotal: true,
            },
          },
          contacts: {
            where: { inactiveFlag: false },
            orderBy: [{ defaultFlag: "desc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              title: true,
              email: true,
              phone: true,
              mobilePhone: true,
              defaultFlag: true,
            },
          },
          sites: {
            orderBy: [{ primaryFlag: "desc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              addressLine1: true,
              city: true,
              state: true,
              zip: true,
              phone: true,
              primaryFlag: true,
              inactiveFlag: true,
            },
          },
          _count: {
            select: {
              configurations: true,
              agreements: true,
            },
          },
        },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      return company;
    }),

  // ─── Update Custom Fields ──────────────────────────────────

  updateCustomFields: adminProcedure
    .input(
      z.object({
        id: z.string(),
        afterHoursAlertProcedure: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {};
      if (input.afterHoursAlertProcedure !== undefined)
        data.afterHoursAlertProcedure = input.afterHoursAlertProcedure;
      if (input.notes !== undefined) data.notes = input.notes;

      const company = await ctx.prisma.company.update({
        where: { id: input.id },
        data,
      });

      await auditLog({
        action: "company.custom_fields.updated",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${input.id}`,
        detail: { fields: Object.keys(data) },
      });

      return company;
    }),

  // ─── Link / Unlink 3CX Instance ───────────────────────────

  linkThreecx: adminProcedure
    .input(
      z.object({
        companyId: z.string(),
        threecxInstanceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.update({
        where: { id: input.threecxInstanceId },
        data: { companyId: input.companyId },
      });

      await auditLog({
        action: "company.threecx.linked",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${input.companyId}`,
        detail: {
          threecxInstanceId: input.threecxInstanceId,
          name: instance.name,
        },
      });

      return { success: true };
    }),

  unlinkThreecx: adminProcedure
    .input(z.object({ threecxInstanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.update({
        where: { id: input.threecxInstanceId },
        data: { companyId: null },
      });

      await auditLog({
        action: "company.threecx.unlinked",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: {
          threecxInstanceId: input.threecxInstanceId,
          name: instance.name,
        },
      });

      return { success: true };
    }),

  // ─── Sync Status ────────────────────────────────────────────

  getSyncedSourceIds: protectedProcedure.query(async ({ ctx }) => {
    const companies = await ctx.prisma.company.findMany({
      select: { psaSourceId: true, syncEnabled: true, syncSource: true },
    });
    const map: Record<string, { syncEnabled: boolean; syncSource: string }> = {};
    for (const c of companies) {
      map[c.psaSourceId] = { syncEnabled: c.syncEnabled, syncSource: c.syncSource };
    }
    return map;
  }),

  // ─── Auto Sync ──────────────────────────────────────────────

  runAutoSync: adminProcedure.mutation(async ({ ctx }) => {
    // Check if a sync is already running
    const existing = await getSyncProgress();
    if (existing?.status === "running") {
      return { started: false, message: "Sync already in progress" };
    }

    // Capture user context before returning (ctx won't be available in background)
    const userId = ctx.user.id;
    const prisma = ctx.prisma as unknown as PrismaClient;

    // Set initial progress
    await setSyncProgress({
      status: "running",
      startedAt: new Date().toISOString(),
      current: 0,
      total: 0,
      phase: "Loading config...",
      counts: {
        companies: { synced: 0, created: 0, unmatched: 0, removed: 0 },
        contacts: { synced: 0, created: 0, skipped: false },
        sites: { synced: 0, created: 0, skipped: false },
        configurations: { synced: 0, created: 0, skipped: false },
        agreements: { synced: 0, created: 0, skipped: false },
      },
    });

    // Fire and forget — sync runs in the background
    void (async () => {
      try {
        // 1. Load sync config
        const configRow = await prisma.integrationConfig.findUnique({
          where: { toolId: "connectwise" },
        });
        const raw = (configRow?.config as Record<string, unknown>) ?? {};
        const statuses = (raw.syncStatuses as string[]) ?? [];
        const types = (raw.syncTypes as string[]) ?? [];
        const removalPolicy = (raw.removalPolicy as string) ?? "keep";
        const removalDays = (raw.removalDays as number) ?? 30;

        const psa = await ConnectorFactory.get("psa", prisma);
        const connector = psa as ConnectWisePsaConnector;

        // 2. Fetch ALL matching CW companies (paginated)
        const allCwCompanies: NormalizedOrganization[] = [];
        let page = 1;
        const pageSize = 100;
        let hasMore = true;

        await setSyncProgress({
          status: "running",
          startedAt: new Date().toISOString(),
          current: 0,
          total: 0,
          phase: "Fetching companies from ConnectWise...",
          counts: {
            companies: { synced: 0, created: 0, unmatched: 0, removed: 0 },
            contacts: { synced: 0, created: 0, skipped: false },
            sites: { synced: 0, created: 0, skipped: false },
            configurations: { synced: 0, created: 0, skipped: false },
            agreements: { synced: 0, created: 0, skipped: false },
          },
        });

        while (hasMore) {
          const result = await psa.getCompanies(
            {
              statuses: statuses.length > 0 ? statuses : undefined,
              types: types.length > 0 ? types : undefined,
            },
            page,
            pageSize
          );
          allCwCompanies.push(...result.data);
          hasMore = result.hasMore;
          page++;
        }

        // 3. Build set of CW source IDs
        const cwSourceIds = new Set(allCwCompanies.map((c) => c.sourceId));

        // 4. Upsert each CW company + sub-entities
        const counts = {
          companies: { synced: 0, created: 0, unmatched: 0, removed: 0 },
          contacts: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
          sites: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
          configurations: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
          agreements: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
        };

        for (let i = 0; i < allCwCompanies.length; i++) {
          const org = allCwCompanies[i];
          const fields = extractCompanyFields(org);
          const existingCompany = await prisma.company.findUnique({
            where: { psaSourceId: org.sourceId },
          });

          let localId: string;

          if (existingCompany) {
            await prisma.company.update({
              where: { id: existingCompany.id },
              data: {
                ...fields,
                syncEnabled: true,
                syncSource: "auto",
                unmatchedSince: null,
              },
            });
            localId = existingCompany.id;
            counts.companies.synced++;
          } else {
            const created = await prisma.company.create({
              data: {
                ...fields,
                psaSourceId: org.sourceId,
                syncEnabled: true,
                syncSource: "auto",
                unmatchedSince: null,
              },
            });
            localId = created.id;
            counts.companies.created++;
          }

          // Sync sub-entities
          const sub = await syncCompanySubEntities(prisma, connector, localId, org.sourceId);
          counts.contacts.synced += sub.contacts.synced;
          counts.contacts.created += sub.contacts.created;
          if (sub.contacts.skipped) {
            counts.contacts.skipped = true;
            counts.contacts.error ??= sub.contacts.error;
          }
          counts.sites.synced += sub.sites.synced;
          counts.sites.created += sub.sites.created;
          if (sub.sites.skipped) {
            counts.sites.skipped = true;
            counts.sites.error ??= sub.sites.error;
          }
          counts.configurations.synced += sub.configurations.synced;
          counts.configurations.created += sub.configurations.created;
          if (sub.configurations.skipped) {
            counts.configurations.skipped = true;
            counts.configurations.error ??= sub.configurations.error;
          }
          counts.agreements.synced += sub.agreements.synced;
          counts.agreements.created += sub.agreements.created;
          if (sub.agreements.skipped) {
            counts.agreements.skipped = true;
            counts.agreements.error ??= sub.agreements.error;
          }

          // Update progress every company
          if (i % 2 === 0 || i === allCwCompanies.length - 1) {
            await setSyncProgress({
              status: "running",
              startedAt: new Date().toISOString(),
              current: i + 1,
              total: allCwCompanies.length,
              phase: `Syncing ${org.name}...`,
              counts,
            });
          }
        }

        // 5. Handle unmatched auto-synced companies
        await setSyncProgress({
          status: "running",
          startedAt: new Date().toISOString(),
          current: allCwCompanies.length,
          total: allCwCompanies.length,
          phase: "Processing unmatched companies...",
          counts,
        });

        const autoCompanies = await prisma.company.findMany({
          where: { syncSource: "auto" },
          select: { id: true, psaSourceId: true, unmatchedSince: true },
        });

        const now = new Date();

        for (const local of autoCompanies) {
          if (!cwSourceIds.has(local.psaSourceId)) {
            if (!local.unmatchedSince) {
              await prisma.company.update({
                where: { id: local.id },
                data: { unmatchedSince: now, syncEnabled: false },
              });
              counts.companies.unmatched++;
            } else if (removalPolicy === "remove_after_days") {
              const daysSince = Math.floor(
                (now.getTime() - local.unmatchedSince.getTime()) / (86400000)
              );
              if (daysSince >= removalDays) {
                await prisma.company.delete({ where: { id: local.id } });
                counts.companies.removed++;
              } else {
                await prisma.company.update({
                  where: { id: local.id },
                  data: { syncEnabled: false },
                });
                counts.companies.unmatched++;
              }
            } else {
              await prisma.company.update({
                where: { id: local.id },
                data: { syncEnabled: false },
              });
              counts.companies.unmatched++;
            }
          }
        }

        // 6. Update lastSync
        await prisma.integrationConfig.update({
          where: { toolId: "connectwise" },
          data: { lastSync: new Date() },
        });

        await auditLog({
          action: "company.sync.auto",
          category: "DATA",
          actorId: userId,
          detail: { ...counts, totalFromCW: allCwCompanies.length },
        });

        // Mark completed
        await setSyncProgress({
          status: "completed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          current: allCwCompanies.length,
          total: allCwCompanies.length,
          phase: "Sync complete",
          counts,
        });
      } catch (err) {
        console.error("[CW Sync] Background sync failed:", err);
        const progress = await getSyncProgress();
        await setSyncProgress({
          status: "failed",
          startedAt: progress?.startedAt ?? new Date().toISOString(),
          current: progress?.current ?? 0,
          total: progress?.total ?? 0,
          phase: "Sync failed",
          counts: progress?.counts ?? {
            companies: { synced: 0, created: 0, unmatched: 0, removed: 0 },
            contacts: { synced: 0, created: 0, skipped: false },
            sites: { synced: 0, created: 0, skipped: false },
            configurations: { synced: 0, created: 0, skipped: false },
            agreements: { synced: 0, created: 0, skipped: false },
          },
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    })();

    return { started: true };
  }),

  // ─── Sync Progress (polled by UI) ────────────────────────────

  syncProgress: protectedProcedure.query(async () => {
    return getSyncProgress();
  }),

  // ─── Manual Sync (selected companies) ───────────────────────

  syncSelected: adminProcedure
    .input(
      z.object({
        psaCompanyIds: z.array(z.string()).min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const connector = psa as ConnectWisePsaConnector;

      const counts = {
        companies: { synced: 0, created: 0, failed: 0 },
        contacts: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
        sites: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
        configurations: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
        agreements: { synced: 0, created: 0, skipped: false, error: undefined as string | undefined },
      };

      for (const psaId of input.psaCompanyIds) {
        try {
          const org = await psa.getCompanyById(psaId);
          const fields = extractCompanyFields(org);
          const existing = await ctx.prisma.company.findUnique({
            where: { psaSourceId: org.sourceId },
          });

          let localId: string;

          if (existing) {
            await ctx.prisma.company.update({
              where: { id: existing.id },
              data: { ...fields, syncEnabled: true, syncSource: "manual" },
            });
            localId = existing.id;
            counts.companies.synced++;
          } else {
            const created = await ctx.prisma.company.create({
              data: {
                ...fields,
                psaSourceId: org.sourceId,
                syncEnabled: true,
                syncSource: "manual",
              },
            });
            localId = created.id;
            counts.companies.created++;
          }

          // Sync sub-entities
          const sub = await syncCompanySubEntities(
            ctx.prisma as unknown as PrismaClient,
            connector,
            localId,
            psaId
          );
          counts.contacts.synced += sub.contacts.synced;
          counts.contacts.created += sub.contacts.created;
          if (sub.contacts.skipped) {
            counts.contacts.skipped = true;
            counts.contacts.error ??= sub.contacts.error;
          }
          counts.sites.synced += sub.sites.synced;
          counts.sites.created += sub.sites.created;
          if (sub.sites.skipped) {
            counts.sites.skipped = true;
            counts.sites.error ??= sub.sites.error;
          }
          counts.configurations.synced += sub.configurations.synced;
          counts.configurations.created += sub.configurations.created;
          if (sub.configurations.skipped) {
            counts.configurations.skipped = true;
            counts.configurations.error ??= sub.configurations.error;
          }
          counts.agreements.synced += sub.agreements.synced;
          counts.agreements.created += sub.agreements.created;
          if (sub.agreements.skipped) {
            counts.agreements.skipped = true;
            counts.agreements.error ??= sub.agreements.error;
          }
        } catch {
          counts.companies.failed++;
        }
      }

      await auditLog({
        action: "company.sync.manual",
        category: "DATA",
        actorId: ctx.user.id,
        detail: { ...counts, requested: input.psaCompanyIds.length },
      });

      return counts;
    }),

  // ─── Unsync (disable sync for a company) ────────────────────

  unsyncCompany: adminProcedure
    .input(z.object({ psaSourceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findUnique({
        where: { psaSourceId: input.psaSourceId },
      });
      if (!company) throw new Error("Company not found in local database");

      await ctx.prisma.company.update({
        where: { id: company.id },
        data: { syncEnabled: false },
      });

      await auditLog({
        action: "company.sync.disabled",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${company.id}`,
        detail: { psaSourceId: input.psaSourceId, name: company.name },
      });

      return { success: true };
    }),

  // ─── Refresh all synced companies ───────────────────────────

  syncAll: adminProcedure.mutation(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    const connector = psa as ConnectWisePsaConnector;

    const companies = await ctx.prisma.company.findMany({
      where: { syncEnabled: true },
      select: { id: true, psaSourceId: true },
    });

    let synced = 0;
    let failed = 0;

    for (const local of companies) {
      try {
        const org = await psa.getCompanyById(local.psaSourceId);
        const fields = extractCompanyFields(org);

        await ctx.prisma.company.update({
          where: { id: local.id },
          data: fields,
        });

        // Also refresh sub-entities
        await syncCompanySubEntities(
          ctx.prisma as unknown as PrismaClient,
          connector,
          local.id,
          local.psaSourceId
        );
        synced++;
      } catch {
        failed++;
      }
    }

    await auditLog({
      action: "company.sync.all",
      category: "DATA",
      actorId: ctx.user.id,
      detail: { synced, failed, total: companies.length },
    });

    return { synced, failed, total: companies.length };
  }),

  // ─── Single Import (used by explorer per-row action) ────────

  importSingle: adminProcedure
    .input(z.object({ psaCompanyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const connector = psa as ConnectWisePsaConnector;
      const org: NormalizedOrganization = await psa.getCompanyById(
        input.psaCompanyId
      );

      const fields = extractCompanyFields(org);

      const company = await ctx.prisma.company.upsert({
        where: { psaSourceId: org.sourceId },
        update: { ...fields, syncEnabled: true, syncSource: "manual" },
        create: {
          ...fields,
          psaSourceId: org.sourceId,
          syncEnabled: true,
          syncSource: "manual",
        },
      });

      // Sync sub-entities for this company
      await syncCompanySubEntities(
        ctx.prisma as unknown as PrismaClient,
        connector,
        company.id,
        org.sourceId
      );

      await auditLog({
        action: "company.import.single",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${company.id}`,
        detail: { psaSourceId: org.sourceId, name: org.name },
      });

      return company;
    }),

  // ─── Integration Mappings ──────────────────────────────────

  getMappingsByTool: protectedProcedure
    .input(z.object({ toolId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.companyIntegrationMapping.findMany({
        where: { toolId: input.toolId },
        include: { company: { select: { id: true, name: true, status: true } } },
        orderBy: { externalName: "asc" },
      });
    }),

  getMappings: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.companyIntegrationMapping.findMany({
        where: { companyId: input.companyId },
        orderBy: { toolId: "asc" },
      });
    }),

  setMapping: adminProcedure
    .input(
      z.object({
        companyId: z.string(),
        toolId: z.string(),
        externalId: z.string(),
        externalName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.companyIntegrationMapping.upsert({
        where: {
          companyId_toolId: {
            companyId: input.companyId,
            toolId: input.toolId,
          },
        },
        update: {
          externalId: input.externalId,
          externalName: input.externalName,
          matchMethod: "manual",
          matchScore: null,
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        },
        create: {
          companyId: input.companyId,
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
          matchMethod: "manual",
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        },
      });

      await auditLog({
        action: "company.mapping.set",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${input.companyId}`,
        detail: {
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
        },
      });

      return mapping;
    }),

  removeMapping: adminProcedure
    .input(z.object({ mappingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.companyIntegrationMapping.delete({
        where: { id: input.mappingId },
      });

      await auditLog({
        action: "company.mapping.removed",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${mapping.companyId}`,
        detail: { toolId: mapping.toolId, externalId: mapping.externalId },
      });

      return { success: true };
    }),

  // ─── Lookup Helper ─────────────────────────────────────────

  resolveExternalId: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        toolId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // For ConnectWise, use psaSourceId directly
      if (input.toolId === "connectwise") {
        const company = await ctx.prisma.company.findUnique({
          where: { id: input.companyId },
          select: { psaSourceId: true },
        });
        return { externalId: company?.psaSourceId ?? null };
      }

      // For other tools, look up the mapping
      const mapping = await ctx.prisma.companyIntegrationMapping.findUnique({
        where: {
          companyId_toolId: {
            companyId: input.companyId,
            toolId: input.toolId,
          },
        },
      });

      return { externalId: mapping?.externalId ?? null };
    }),
});
