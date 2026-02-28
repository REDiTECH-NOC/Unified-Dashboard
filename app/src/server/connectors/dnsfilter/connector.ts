/**
 * DNSFilter Connector — implements IDnsSecurityConnector.
 *
 * Wraps DnsFilterClient and maps all responses through mappers
 * to the normalized DNS security interface types.
 */

import type { ConnectorConfig, HealthCheckResult, PaginatedResponse } from "../_base/types";
import type {
  IDnsSecurityConnector,
  DnsThreatEvent,
  DnsThreatSummary,
  DnsTrafficSummary,
  DnsTopDomain,
  DnsTopCategory,
  DnsQueryLogEntry,
  DnsOrganization,
  DnsNetwork,
  DnsPolicy,
  DnsRoamingClient,
  DnsAgentCounts,
  DnsCategory,
  DnsDomainLookup,
  DnsReportFilter,
  DnsUser,
  DnsCleanupResult,
  DnsBlockPage,
  DnsScheduledPolicy,
  DnsApplication,
  DnsApplicationCategory,
} from "../_interfaces/dns-security";
import { DnsFilterClient } from "./client";
import type { DnsFilterIpAddress } from "./types";
import {
  mapQueryLogToThreat,
  mapQueryLogEntry,
  mapTopDomain,
  mapTopCategory,
  mapOrganization,
  mapNetwork,
  mapPolicy,
  mapCategory,
  mapRoamingClient,
  mapDomainLookup,
  mapUser,
  mapBlockPage,
  mapScheduledPolicy,
  mapApplication,
  mapApplicationCategory,
} from "./mappers";

// DNSFilter query_logs API docs specify 72-hour max window;
// in practice it appears to tolerate ~9 days for aggregate queries.
// We clamp to 3 days for per-org queries (strict) and 9 days for aggregate (lenient).
const MAX_QUERY_LOG_DAYS_STRICT = 3;
const MAX_QUERY_LOG_DAYS_LENIENT = 9;

function clampQueryLogDates(requestedFrom: Date, requestedTo: Date, hasOrgFilter: boolean): { from: Date; to: Date } {
  const maxDays = hasOrgFilter ? MAX_QUERY_LOG_DAYS_STRICT : MAX_QUERY_LOG_DAYS_LENIENT;
  const maxFrom = new Date(requestedTo.getTime() - maxDays * 24 * 60 * 60 * 1000);
  return {
    from: requestedFrom < maxFrom ? maxFrom : requestedFrom,
    to: requestedTo,
  };
}

export class DnsFilterConnector implements IDnsSecurityConnector {
  private client: DnsFilterClient;

  constructor(config: ConnectorConfig) {
    this.client = new DnsFilterClient(config);
  }

  /** Fetch all org IDs for MSP-wide aggregate queries */
  private async getAllOrgIds(): Promise<string[]> {
    const orgsResp = await this.client.getOrganizations({ pageSize: 200 });
    return (orgsResp.data ?? []).map((o) => o.id);
  }

  /** Resolve org IDs: use provided list, or fetch all for MSP-wide */
  private async resolveOrgIds(ids?: string[]): Promise<string[]> {
    if (ids && ids.length > 0) return ids;
    return this.getAllOrgIds();
  }

  // ─── Threats (for Alerts page) ──────────────────────────

  async getThreats(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsThreatEvent>> {
    const hasOrgFilter = !!filter?.organizationIds?.length;
    const { from, to } = clampQueryLogDates(
      filter?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filter?.to ?? new Date(),
      hasOrgFilter,
    );

    const resp = await this.client.getQueryLogs({
      from,
      to,
      organizationId: filter?.organizationIds?.[0],
      networkIds: filter?.networkIds,
      securityReport: true,
      result: "blocked",
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 50,
    });

    const threats = (resp.data?.values ?? []).map(mapQueryLogToThreat);
    const page = resp.data?.page;

    return {
      data: threats,
      hasMore: page ? page.self < page.last : false,
      nextCursor: page?.next,
      totalCount: page?.total,
    };
  }

  async getThreatSummary(from?: Date, to?: Date): Promise<DnsThreatSummary> {
    const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ?? new Date();

    // Resolve all org IDs for MSP-wide aggregate
    const orgIds = await this.getAllOrgIds();
    const resp = await this.client.getTotalThreats({
      from: fromDate,
      to: toDate,
      organizationIds: orgIds,
      bucketSize: "1day",
    });

    const buckets = resp.data?.values ?? [];
    let total = 0;
    const timeSeries = buckets.map((b) => {
      total += b.total;
      return { timestamp: b.bucket, count: b.total };
    });

    // Estimate severity breakdown — DNSFilter doesn't provide per-severity threat counts
    // Use heuristic: ~10% critical (malware/botnet), ~25% high (phishing), ~40% medium, ~25% low
    const critical = Math.round(total * 0.1);
    const high = Math.round(total * 0.25);
    const medium = Math.round(total * 0.4);
    const low = total - critical - high - medium;

    return { total, critical, high, medium, low, timeSeries };
  }

  // ─── Traffic Reports (for Network deep dive) ───────────

  async getTrafficSummary(filter?: DnsReportFilter): Promise<DnsTrafficSummary> {
    const from = filter?.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filter?.to ?? new Date();

    // Resolve org IDs: when none provided, fetch all for MSP-wide aggregate
    const orgIds = await this.resolveOrgIds(filter?.organizationIds);
    const [totalResp, threatsResp, blockedResp] = await Promise.all([
      this.client.getTotalRequests({ from, to, organizationIds: orgIds, bucketSize: "1day" }),
      this.client.getTotalThreats({ from, to, organizationIds: orgIds, bucketSize: "1day" }),
      this.client.getTotalRequests({ from, to, organizationIds: orgIds, type: "blocked", bucketSize: "1day" }),
    ]);

    const totalBuckets = totalResp.data?.values ?? [];
    const threatBuckets = threatsResp.data?.values ?? [];
    const blockedBuckets = blockedResp.data?.values ?? [];

    // Build time series by aligning buckets
    const threatMap = new Map(threatBuckets.map((b) => [b.bucket, b.total]));
    const blockedMap = new Map(blockedBuckets.map((b) => [b.bucket, b.total]));

    let totalRequests = 0;
    let blockedRequests = 0;
    let threatRequests = 0;

    const timeSeries = totalBuckets.map((b) => {
      const total = b.total;
      const threats = threatMap.get(b.bucket) ?? 0;
      const blocked = blockedMap.get(b.bucket) ?? 0;
      const allowed = total - blocked;

      totalRequests += total;
      blockedRequests += blocked;
      threatRequests += threats;

      return {
        timestamp: b.bucket,
        total,
        allowed,
        blocked,
        threats,
      };
    });

    return {
      totalRequests,
      allowedRequests: totalRequests - blockedRequests,
      blockedRequests,
      threatRequests,
      timeSeries,
    };
  }

  async getTopDomains(filter?: DnsReportFilter): Promise<DnsTopDomain[]> {
    const from = filter?.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filter?.to ?? new Date();

    const orgIds = await this.resolveOrgIds(filter?.organizationIds);
    const resp = await this.client.getTopDomains({
      from,
      to,
      organizationIds: orgIds,
      networkIds: filter?.networkIds,
      type: filter?.type,
      securityReport: filter?.securityReport,
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 25,
    });

    return (resp.data?.values ?? []).map((d) => mapTopDomain(d, filter?.type));
  }

  async getTopCategories(filter?: DnsReportFilter): Promise<DnsTopCategory[]> {
    const from = filter?.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = filter?.to ?? new Date();

    const orgIds = await this.resolveOrgIds(filter?.organizationIds);
    const resp = await this.client.getTopCategories({
      from,
      to,
      organizationIds: orgIds,
      networkIds: filter?.networkIds,
      type: filter?.type,
      securityReport: filter?.securityReport,
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 25,
    });

    return (resp.data?.values ?? []).map(mapTopCategory);
  }

  async getQueryLogs(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsQueryLogEntry>> {
    const hasOrgFilter = !!filter?.organizationIds?.length;
    const { from, to } = clampQueryLogDates(
      filter?.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
      filter?.to ?? new Date(),
      hasOrgFilter,
    );

    const resp = await this.client.getQueryLogs({
      from,
      to,
      organizationId: filter?.organizationIds?.[0],
      networkIds: filter?.networkIds,
      securityReport: filter?.securityReport,
      result: filter?.type === "all" ? undefined : filter?.type,
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 50,
    });

    const entries = (resp.data?.values ?? []).map(mapQueryLogEntry);
    const page = resp.data?.page;

    return {
      data: entries,
      hasMore: page ? page.self < page.last : false,
      nextCursor: page?.next,
      totalCount: page?.total,
    };
  }

  // ─── Organizations & Networks ──────────────────────────

  async getOrganizations(): Promise<DnsOrganization[]> {
    const resp = await this.client.getOrganizations();
    return (resp.data ?? []).map(mapOrganization);
  }

  async getNetworks(): Promise<DnsNetwork[]> {
    const resp = await this.client.getNetworks();

    // Build IP lookup from included resources
    const ipLookup = new Map<string, DnsFilterIpAddress>();
    if (resp.included) {
      for (const item of resp.included as DnsFilterIpAddress[]) {
        if (item.type === "ip_addresses") {
          ipLookup.set(item.id, item);
        }
      }
    }

    return (resp.data ?? []).map((net) => mapNetwork(net, ipLookup));
  }

  // ─── Policies ─────────────────────────────────────────

  async getPolicies(): Promise<DnsPolicy[]> {
    const resp = await this.client.getPolicies();
    return (resp.data ?? []).map(mapPolicy);
  }

  async getPolicyDetail(policyId: string): Promise<DnsPolicy> {
    const resp = await this.client.getPolicyById(policyId);
    return mapPolicy(resp.data);
  }

  async addAllowDomain(policyId: string, domain: string): Promise<void> {
    await this.client.addAllowDomain(policyId, domain);
  }

  async addBlockDomain(policyId: string, domain: string): Promise<void> {
    await this.client.addBlockDomain(policyId, domain);
  }

  async removeAllowDomain(policyId: string, domain: string): Promise<void> {
    await this.client.removeAllowDomain(policyId, domain);
  }

  async removeBlockDomain(policyId: string, domain: string): Promise<void> {
    await this.client.removeBlockDomain(policyId, domain);
  }

  async updatePolicy(policyId: string, updates: Record<string, unknown>): Promise<DnsPolicy> {
    const resp = await this.client.updatePolicy(policyId, updates);
    return mapPolicy(resp.data);
  }

  async addBlockedCategory(policyId: string, categoryId: number): Promise<void> {
    await this.client.addBlockedCategory(policyId, categoryId);
  }

  async removeBlockedCategory(policyId: string, categoryId: number): Promise<void> {
    await this.client.removeBlockedCategory(policyId, categoryId);
  }

  async addBlockedApplication(policyId: string, name: string): Promise<void> {
    await this.client.addBlockedApplication(policyId, name);
  }

  async removeBlockedApplication(policyId: string, name: string): Promise<void> {
    await this.client.removeBlockedApplication(policyId, name);
  }

  // ─── Block Pages ────────────────────────────────────────

  async getBlockPages(): Promise<DnsBlockPage[]> {
    const resp = await this.client.getBlockPages();
    return (resp.data ?? []).map(mapBlockPage);
  }

  async getBlockPageDetail(blockPageId: string): Promise<DnsBlockPage> {
    const resp = await this.client.getBlockPageById(blockPageId);
    return mapBlockPage(resp.data);
  }

  async updateBlockPage(blockPageId: string, updates: { name?: string; block_org_name?: string | null; block_email_addr?: string | null }): Promise<DnsBlockPage> {
    const resp = await this.client.updateBlockPage(blockPageId, updates);
    return mapBlockPage(resp.data);
  }

  // ─── Scheduled Policies ──────────────────────────────────

  async getScheduledPolicies(): Promise<DnsScheduledPolicy[]> {
    const resp = await this.client.getScheduledPolicies();
    return (resp.data ?? []).map(mapScheduledPolicy);
  }

  // ─── Network Detail / Local Domains / Resolvers ──────

  async getNetworkDetail(networkId: string): Promise<DnsNetwork> {
    const resp = await this.client.getNetworkById(networkId);
    return mapNetwork(resp.data);
  }

  async updateNetworkLocalDomains(networkId: string, domains: string[]): Promise<void> {
    await this.client.updateNetwork(networkId, { local_domains: domains });
  }

  async updateNetworkLocalResolvers(networkId: string, resolvers: string[]): Promise<void> {
    await this.client.updateNetwork(networkId, { local_resolvers: resolvers });
  }

  // ─── Roaming Clients ──────────────────────────────────

  async getRoamingClients(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsRoamingClient>> {
    const orgIds = await this.resolveOrgIds(filter?.organizationIds);

    const resp = await this.client.getUserAgents({
      organizationIds: orgIds.length > 0 ? orgIds : undefined,
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 50,
    });

    const clients = (resp.data ?? []).map(mapRoamingClient);
    const hasMore = !!resp.links?.next;

    return {
      data: clients,
      hasMore,
      totalCount: hasMore ? undefined : clients.length,
    };
  }

  async updateUserAgent(agentId: string, updates: { policy_id?: number | null; scheduled_policy_id?: number | null; block_page_id?: number | null; friendly_name?: string; tags?: string[] }): Promise<void> {
    await this.client.updateUserAgent(agentId, updates);
  }

  async getAgentCounts(organizationIds?: string[]): Promise<DnsAgentCounts> {
    const orgIds = await this.resolveOrgIds(organizationIds);

    const counts = await this.client.getUserAgentCounts({
      organizationIds: orgIds.length > 0 ? orgIds : undefined,
    });
    return {
      all: counts.all ?? 0,
      protected: counts.protected ?? 0,
      unprotected: counts.unprotected ?? 0,
      offline: counts.offline ?? 0,
    };
  }

  // ─── Agent Cleanup ──────────────────────────────────────

  async cleanupInactiveAgents(organizationIds: string[], inactiveDays: number): Promise<DnsCleanupResult> {
    const numericIds = organizationIds.map((id) => parseInt(id, 10));
    const resp = await this.client.createAgentCleanup({
      organizationIds: numericIds,
      inactiveFor: inactiveDays,
    });
    return {
      id: resp.data.id,
      inactiveFor: resp.data.attributes.inactive_for,
      completed: resp.data.attributes.completed,
      toDeleteCount: resp.data.attributes.to_delete_count,
    };
  }

  async getCleanupStatus(cleanupId: string): Promise<DnsCleanupResult> {
    const resp = await this.client.getAgentCleanupStatus(cleanupId);
    return {
      id: resp.data.id,
      inactiveFor: resp.data.attributes.inactive_for,
      completed: resp.data.attributes.completed,
      toDeleteCount: resp.data.attributes.to_delete_count,
    };
  }

  // ─── Users ──────────────────────────────────────────────

  async getUsers(): Promise<DnsUser[]> {
    const resp = await this.client.getUsers();
    return (resp.data ?? []).map(mapUser);
  }

  // ─── Applications (AppAware) ────────────────────────────

  async getApplications(): Promise<DnsApplication[]> {
    const resp = await this.client.getApplications();
    return (resp.data ?? []).map(mapApplication);
  }

  async getApplicationCategories(): Promise<DnsApplicationCategory[]> {
    const resp = await this.client.getApplicationCategories();
    return (resp.data ?? []).map(mapApplicationCategory);
  }

  // ─── Reference Data ────────────────────────────────────

  async getCategories(): Promise<DnsCategory[]> {
    const resp = await this.client.getCategories();
    return (resp.data ?? []).map(mapCategory);
  }

  async lookupDomain(fqdn: string): Promise<DnsDomainLookup> {
    const [resp, catsResp] = await Promise.all([
      this.client.lookupDomain(fqdn),
      this.client.getCategories(),
    ]);
    const categoryLookup = new Map(
      (catsResp.data ?? []).map((c) => [c.id, c.attributes.name])
    );
    return mapDomainLookup(resp.data as Parameters<typeof mapDomainLookup>[0], categoryLookup);
  }

  // ─── Health ────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
