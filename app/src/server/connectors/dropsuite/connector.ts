/**
 * Dropsuite SaaS Backup connector.
 *
 * Implements ISaasBackupConnector — wraps DropsuiteClient with caching
 * and normalization via mappers.
 *
 * Caching: Redis stale-while-revalidate (same pattern as Cove).
 * SaaS backup data changes a few times per day, so generous cache windows.
 */

import { redis } from "@/lib/redis";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { NormalizedAlert } from "../_interfaces/common";
import type {
  ISaasBackupConnector,
  SaasBackupOrg,
  SaasBackupTenant,
  SaasBackupMailbox,
  SaasBackupAccount,
  SaasBackupJournal,
  SaasBackupNdrJournal,
  SaasBackupOneDrive,
  SaasBackupSharePoint,
  SaasBackupTeams,
  SaasBackupCalendar,
  SaasBackupContact,
  SaasBackupTask,
  SaasBackupRetentionPolicy,
  SaasBackupSharePointSite,
  SaasBackupTeamsGroup,
  SaasBackupDashboardSummary,
  SaasBackupTenantType,
  SaasBackupMailboxStatus,
  SaasBackupHealth,
} from "../_interfaces/saas-backup";
import { DropsuiteClient } from "./client";
import {
  mapUser, mapTenant, mapMailbox, mapBackupAccount,
  mapOneDrive, mapSharePoint, mapSharePointSite, mapTeams, mapTeamsGroup,
  mapCalendar, mapContact, mapTask, mapRetentionPolicy,
  deriveBackupHealth,
} from "./mappers";

// ─── Cache Config ───────────────────────────────────────────────

const FRESHNESS_ORGS      = 60 * 60;       // 1 hour — org data rarely changes
const FRESHNESS_TENANTS   = 30 * 60;       // 30 min
const FRESHNESS_MAILBOXES = 30 * 60;       // 30 min
const FRESHNESS_ACCOUNTS  = 15 * 60;       // 15 min — backup status changes more often
const FRESHNESS_SUMMARY   = 30 * 60;       // 30 min
const REDIS_TTL           = 24 * 60 * 60;  // 24 hours — stale data lives this long

/** In-flight refresh tracker — prevents duplicate concurrent refreshes */
const refreshInFlight = new Set<string>();

/** Envelope stored in Redis — data + timestamp for staleness checks */
interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

export class DropsuiteConnector implements ISaasBackupConnector {
  private client: DropsuiteClient;
  private config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.client = new DropsuiteClient(config);
  }

  // ─── Stale-While-Revalidate Helpers ──────────────────────────

  private cacheKey(segment: string): string {
    return `dropsuite:${this.config.toolId}:${segment}`;
  }

  private async cacheGet<T>(key: string): Promise<CacheEnvelope<T> | null> {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CacheEnvelope<T>;
    } catch {
      return null;
    }
  }

  private async cacheSet<T>(key: string, data: T): Promise<void> {
    try {
      const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
      await redis.set(key, JSON.stringify(envelope), "EX", REDIS_TTL);
    } catch {
      // Cache write failure is non-fatal
    }
  }

  /**
   * Stale-while-revalidate: return cached data if fresh, else fetch.
   * If stale but within TTL, return stale + trigger background refresh.
   */
  private async cachedFetch<T>(
    segment: string,
    freshnessSec: number,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const key = this.cacheKey(segment);
    const envelope = await this.cacheGet<T>(key);

    if (envelope) {
      const ageSeconds = (Date.now() - envelope.cachedAt) / 1000;

      if (ageSeconds < freshnessSec) {
        return envelope.data;
      }

      // Stale — return cached data, trigger background refresh
      if (!refreshInFlight.has(key)) {
        refreshInFlight.add(key);
        fetchFn()
          .then((data) => this.cacheSet(key, data))
          .catch(() => {})
          .finally(() => refreshInFlight.delete(key));
      }
      return envelope.data;
    }

    // Cache miss — fetch synchronously
    const data = await fetchFn();
    await this.cacheSet(key, data);
    return data;
  }

  // ─── ISaasBackupConnector Implementation ──────────────────────

  /** Fetch and cache the plan catalog (maps plan_id → plan name/type/price) */
  private async getPlansMap(): Promise<Map<string, { name: string; productType: string; price: string }>> {
    const plans = await this.cachedFetch("plans", FRESHNESS_ORGS, async () => {
      const rawPlans = await this.client.getPlans();
      return rawPlans.map((p) => ({
        id: p.id,
        name: p.name,
        // Clean product_type: "res_archive" → "Archive", "res_backup" → "Backup"
        productType: p.product_type
          .replace(/^res_/, "")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        price: `${p.amount} ${p.currency}`,
      }));
    });
    const map = new Map<string, { name: string; productType: string; price: string }>();
    for (const p of plans) {
      map.set(p.id, { name: p.name, productType: p.productType, price: p.price });
    }
    return map;
  }

  async getOrganizations(): Promise<SaasBackupOrg[]> {
    return this.cachedFetch("orgs", FRESHNESS_ORGS, async () => {
      const [users, plansMap] = await Promise.all([
        this.client.getUsers(),
        this.getPlansMap(),
      ]);
      return users.map((raw) => {
        const org = mapUser(raw);
        const plan = org.planId ? plansMap.get(org.planId) : undefined;
        if (plan) {
          org.planName = plan.name;
          org.planType = plan.productType;
          org.planPrice = plan.price;
        }
        return org;
      });
    });
  }

  async getOrganizationTenants(
    orgSourceId: string,
    orgAuthToken: string,
    type?: SaasBackupTenantType
  ): Promise<SaasBackupTenant[]> {
    const suffix = type ? `:${type}` : "";
    return this.cachedFetch(`tenants:${orgSourceId}${suffix}`, FRESHNESS_TENANTS, async () => {
      const tenants = await this.client.getTenants(orgSourceId, orgAuthToken, type);
      return tenants.map(mapTenant);
    });
  }

  async getTenantMailboxes(
    orgSourceId: string,
    orgAuthToken: string,
    tenantId: number,
    type: SaasBackupTenantType,
    status?: SaasBackupMailboxStatus
  ): Promise<SaasBackupMailbox[]> {
    const suffix = status ? `:${status}` : "";
    return this.cachedFetch(`mailboxes:${orgSourceId}:${tenantId}${suffix}`, FRESHNESS_MAILBOXES, async () => {
      const mailboxes = await this.client.getTenantMailboxes(orgSourceId, orgAuthToken, tenantId, type, status);
      return mailboxes.map(mapMailbox);
    });
  }

  async getBackupAccounts(orgAuthToken: string): Promise<SaasBackupAccount[]> {
    // Use a hash of the token as cache key (tokens are per-org)
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`accounts:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const accounts = await this.client.getBackupAccounts(orgAuthToken);
      return accounts.map(mapBackupAccount);
    });
  }

  async getDeactivatedAccounts(orgAuthToken: string): Promise<SaasBackupAccount[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`deactivated:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const accounts = await this.client.getDeactivatedAccounts(orgAuthToken);
      return accounts.map(mapBackupAccount);
    });
  }

  async getConnectionFailures(orgAuthToken: string): Promise<SaasBackupAccount[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`failures:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const accounts = await this.client.getConnectionFailures(orgAuthToken);
      return accounts.map(mapBackupAccount);
    });
  }

  async getJournals(orgAuthToken: string): Promise<SaasBackupJournal[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`journals:${tokenHash}`, FRESHNESS_TENANTS, async () => {
      const journals = await this.client.getJournals(orgAuthToken);
      return journals.map((j) => ({
        id: j.id,
        email: j.email,
        organizationId: j.organization_id,
      }));
    });
  }

  async getNdrJournal(orgAuthToken: string): Promise<SaasBackupNdrJournal | null> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`ndr-journal:${tokenHash}`, FRESHNESS_TENANTS, async () => {
      try {
        const journal = await this.client.getNdrJournal(orgAuthToken);
        return { id: journal.id, email: journal.email };
      } catch {
        return null;
      }
    });
  }

  async getOneDrives(orgAuthToken: string): Promise<SaasBackupOneDrive[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`onedrives:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const drives = await this.client.getOneDrives(orgAuthToken);
      return drives.map(mapOneDrive);
    });
  }

  async getSharePoints(orgAuthToken: string): Promise<SaasBackupSharePoint[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`sharepoints:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const domains = await this.client.getSharePointDomains(orgAuthToken);
      return domains.map(mapSharePoint);
    });
  }

  async getSharePointSites(domainId: number, orgAuthToken: string): Promise<SaasBackupSharePointSite[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`sp-sites:${tokenHash}:${domainId}`, FRESHNESS_ACCOUNTS, async () => {
      const sites = await this.client.getSharePointSites(domainId, orgAuthToken);
      return sites.map(mapSharePointSite);
    });
  }

  async getTeamsAndGroups(orgAuthToken: string): Promise<SaasBackupTeams[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`teams:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const domains = await this.client.getTeamsDomains(orgAuthToken);
      return domains.map(mapTeams);
    });
  }

  async getTeamsGroups(domainId: number, orgAuthToken: string): Promise<SaasBackupTeamsGroup[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`teams-groups:${tokenHash}:${domainId}`, FRESHNESS_ACCOUNTS, async () => {
      const groups = await this.client.getTeamsGroups(domainId, orgAuthToken);
      return groups.map(mapTeamsGroup);
    });
  }

  async getCalendars(orgAuthToken: string): Promise<SaasBackupCalendar[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`calendars:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const calendars = await this.client.getCalendars(orgAuthToken);
      return calendars.map(mapCalendar);
    });
  }

  async getContacts(orgAuthToken: string): Promise<SaasBackupContact[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`contacts:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const contacts = await this.client.getContacts(orgAuthToken);
      return contacts.map(mapContact);
    });
  }

  async getTasks(orgAuthToken: string): Promise<SaasBackupTask[]> {
    const tokenHash = simpleHash(orgAuthToken);
    return this.cachedFetch(`tasks:${tokenHash}`, FRESHNESS_ACCOUNTS, async () => {
      const tasks = await this.client.getTasks(orgAuthToken);
      return tasks.map(mapTask);
    });
  }

  async getRetentionPolicies(orgSourceId: string, orgAuthToken: string): Promise<SaasBackupRetentionPolicy[]> {
    return this.cachedFetch(`retention:${orgSourceId}`, FRESHNESS_TENANTS, async () => {
      const policies = await this.client.getRetentionPolicies(orgSourceId, orgAuthToken);
      return policies.map(mapRetentionPolicy);
    });
  }

  async getDashboardSummary(): Promise<SaasBackupDashboardSummary> {
    return this.cachedFetch("summary", FRESHNESS_SUMMARY, async () => {
      const orgs = await this.getOrganizations();

      let totalActiveSeats = 0;
      let totalDeactivatedSeats = 0;
      let totalFreeSharedMailboxes = 0;
      let totalStorageBytes = 0;
      let archiveOrgs = 0;
      const healthCounts: Record<SaasBackupHealth, number> = {
        healthy: 0,
        warning: 0,
        overdue: 0,
        failed: 0,
        preparing: 0,
        never_ran: 0,
        unknown: 0,
      };

      // Map org sourceId → index for per-org storage aggregation
      const orgIndexMap = new Map<string, number>();
      const orgSeatSummaries: SaasBackupDashboardSummary["orgSeatSummaries"] = [];

      // Aggregate org-level stats (no API calls needed)
      for (const org of orgs) {
        totalActiveSeats += org.activeSeats;
        totalDeactivatedSeats += org.deactivatedSeats;
        totalFreeSharedMailboxes += org.freeSharedMailboxes;
        if (org.archive) archiveOrgs++;

        orgIndexMap.set(org.sourceId, orgSeatSummaries.length);
        orgSeatSummaries.push({
          orgName: org.organizationName,
          orgId: org.sourceId,
          activeSeats: org.activeSeats,
          deactivatedSeats: org.deactivatedSeats,
          freeSharedMailboxes: org.freeSharedMailboxes,
          archive: org.archive,
          storageBytes: 0, // Computed from backup accounts below
        });
      }

      // Fetch backup accounts in parallel (5 at a time) for health rollup + storage
      let computedTotalStorageBytes = 0;
      const CONCURRENCY = 5;
      for (let i = 0; i < orgs.length; i += CONCURRENCY) {
        const batch = orgs.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((org) => this.getBackupAccounts(org.authenticationToken))
        );
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          const orgIdx = orgIndexMap.get(batch[j].sourceId);
          if (result.status === "fulfilled") {
            let orgStorage = 0;
            for (const acct of result.value) {
              healthCounts[acct.health]++;
              orgStorage += acct.storageBytes;
            }
            if (orgIdx !== undefined) {
              orgSeatSummaries[orgIdx].storageBytes = orgStorage;
            }
            computedTotalStorageBytes += orgStorage;
          } else {
            healthCounts.unknown += batch[j].activeSeats;
          }
        }
      }

      // Use computed storage (summed from accounts) — org-level storage_used is unreliable
      totalStorageBytes = computedTotalStorageBytes > 0 ? computedTotalStorageBytes : totalStorageBytes;

      return {
        totalOrgs: orgs.length,
        totalActiveSeats,
        totalDeactivatedSeats,
        totalFreeSharedMailboxes,
        totalStorageBytes,
        archiveOrgs,
        orgHealthRollup: healthCounts,
        connectionFailures: 0, // Fetched on-demand per org, not in summary
        orgSeatSummaries,
      };
    });
  }

  async getActiveAlerts(): Promise<NormalizedAlert[]> {
    const orgs = await this.getOrganizations();
    const alerts: NormalizedAlert[] = [];

    // Fetch backup accounts in parallel (5 at a time)
    const CONCURRENCY = 5;
    for (let i = 0; i < orgs.length; i += CONCURRENCY) {
      const batch = orgs.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((org) => this.getBackupAccounts(org.authenticationToken).then((accounts) => ({ org, accounts })))
      );

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { org, accounts } = result.value;

        for (const acct of accounts) {
          if (acct.health === "healthy" || acct.health === "preparing" || acct.health === "unknown") continue;

          const severity: NormalizedAlert["severity"] =
            acct.health === "failed" ? "critical" :
            acct.health === "overdue" ? "high" :
            acct.health === "warning" ? "medium" :
            acct.health === "never_ran" ? "low" : "informational";

          const severityScore =
            acct.health === "failed" ? 9 :
            acct.health === "overdue" ? 7 :
            acct.health === "warning" ? 5 :
            acct.health === "never_ran" ? 3 : 1;

          const statusLabel = acct.currentBackupStatus ?? acct.health;
          alerts.push({
            sourceToolId: "dropsuite",
            sourceId: `ds-${acct.id}`,
            title: `SaaS Backup ${acct.health}: ${acct.email}`,
            message: `${org.organizationName} — ${acct.email} backup is ${statusLabel}` +
              (acct.lastBackup ? ` (last: ${new Date(acct.lastBackup).toLocaleDateString()})` : " (never backed up)"),
            severity,
            severityScore,
            category: "availability",
            status: "new",
            deviceHostname: acct.email,
            organizationName: org.organizationName,
            createdAt: acct.lastBackup ? new Date(acct.lastBackup) : new Date(acct.addedOn),
          });
        }
      }
    }

    // Sort by severity (highest first)
    return alerts.sort((a, b) => b.severityScore - a.severityScore);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}
