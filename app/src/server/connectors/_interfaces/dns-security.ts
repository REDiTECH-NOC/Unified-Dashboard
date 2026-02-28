/**
 * DNS Security Connector Interface — for DNSFilter and future DNS security tools.
 *
 * Provides DNS-level threat protection analytics, content filtering policy
 * management, traffic reporting, and roaming client visibility.
 */

import type { HealthCheckResult, PaginatedResponse } from "../_base/types";

// ─── DNS Security normalized types ────────────────────────────────

/** A DNS threat event (blocked malicious query) */
export interface DnsThreatEvent {
  sourceToolId: string;
  sourceId: string;
  domain: string;
  fqdn?: string;
  category: string;
  categoryId?: number;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  severityScore: number;
  action: "blocked" | "allowed" | "monitored";
  source: "network" | "agent" | "proxy";
  networkName?: string;
  networkId?: string;
  organizationName?: string;
  organizationId?: string;
  agentHostname?: string;
  agentId?: string;
  queryType?: string;
  timestamp: Date;
  _raw?: unknown;
}

/** Aggregate traffic/threat summary */
export interface DnsTrafficSummary {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  threatRequests: number;
  /** Bucketed time-series data */
  timeSeries: Array<{
    timestamp: string;
    total: number;
    allowed: number;
    blocked: number;
    threats: number;
  }>;
}

/** Threat summary with severity breakdown */
export interface DnsThreatSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  timeSeries: Array<{
    timestamp: string;
    count: number;
  }>;
}

/** Top domain entry */
export interface DnsTopDomain {
  domain: string;
  total: number;
  blocked: number;
  allowed: number;
  category?: string;
  isThreat?: boolean;
}

/** Top category entry */
export interface DnsTopCategory {
  categoryId: number;
  categoryName: string;
  total: number;
  blocked: number;
  allowed: number;
  isSecurity?: boolean;
}

/** DNS query log entry */
export interface DnsQueryLogEntry {
  domain: string;
  fqdn?: string;
  category: string;
  categoryId?: number;
  result: "allowed" | "blocked";
  isThreat: boolean;
  queryType?: string;
  source: "network" | "agent" | "proxy";
  networkName?: string;
  agentHostname?: string;
  organizationName?: string;
  timestamp: Date;
  _raw?: unknown;
}

/** A DNSFilter organization */
export interface DnsOrganization {
  id: string;
  name: string;
  type?: string;
  status?: string;
  networkCount?: number;
  userCount?: number;
  _raw?: unknown;
}

/** A DNSFilter network (site) */
export interface DnsNetwork {
  id: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  policyId?: string;
  policyName?: string;
  scheduledPolicyId?: string;
  blockPageId?: string;
  ipAddresses?: string[];
  isProtected: boolean;
  secretKey?: string;
  localDomains?: string[];
  localResolvers?: string[];
  _raw?: unknown;
}

/** A DNS filtering policy */
export interface DnsPolicy {
  id: string;
  name: string;
  organizationId?: string;
  allowedDomains: string[];
  blockedDomains: string[];
  blockedCategories: number[];
  allowUnknownDomains?: boolean;
  googleSafesearch?: boolean;
  bingSafeSearch?: boolean;
  duckDuckGoSafeSearch?: boolean;
  ecosiaSafesearch?: boolean;
  yandexSafeSearch?: boolean;
  youtubeRestricted?: boolean;
  youtubeRestrictedLevel?: string;
  interstitial?: boolean;
  isGlobalPolicy?: boolean;
  canEdit?: boolean;
  allowListOnly?: boolean;
  lockVersion?: number;
  allowApplications?: string[];
  blockApplications?: string[];
  networkCount?: number;
  agentCount?: number;
  _raw?: unknown;
}

/** A block page configuration */
export interface DnsBlockPage {
  id: string;
  name: string;
  organizationId?: string;
  orgName?: string | null;
  email?: string | null;
  logoUuid?: string | null;
}

/** A scheduled policy (filtering schedule) */
export interface DnsScheduledPolicy {
  id: string;
  name: string;
  organizationId?: string;
  policyIds?: number[];
  timezone?: string;
}

/** An AppAware application */
export interface DnsApplication {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  homePageUrl?: string;
  icon?: string;
  categoryIds?: string[];
}

/** An AppAware application category */
export interface DnsApplicationCategory {
  id: string;
  name: string;
  description?: string;
}

/** A roaming client/agent */
export interface DnsRoamingClient {
  id: string;
  hostname: string;
  friendlyName?: string;
  agentType: string;
  agentVersion?: string;
  status: "active" | "disabled" | "uninstalled";
  agentState: "protected" | "unprotected" | "offline";
  policyId?: string;
  policyName?: string;
  scheduledPolicyId?: string;
  blockPageId?: string;
  organizationName?: string;
  networkId?: string;
  organizationId?: string;
  tags?: string[];
  lastSync?: Date;
  _raw?: unknown;
}

/** Result of agent cleanup operation */
export interface DnsCleanupResult {
  id: string;
  inactiveFor: number;
  completed: boolean;
  toDeleteCount: number;
}

/** Agent health counts */
export interface DnsAgentCounts {
  all: number;
  protected: number;
  unprotected: number;
  offline: number;
}

/** A content filtering category */
export interface DnsCategory {
  id: string;
  name: string;
  description?: string;
  isSecurity: boolean;
}

/** Domain lookup result */
export interface DnsDomainLookup {
  domain: string;
  host?: string;
  categories: Array<{ id: string; name: string }>;
  application?: { id: number; name: string; category: string };
}

/** A DNSFilter portal user */
export interface DnsUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  organizationId?: string;
  createdAt?: Date;
  lastSignIn?: Date;
}

/** Common filter options for traffic reports */
export interface DnsReportFilter {
  from?: Date;
  to?: Date;
  organizationIds?: string[];
  networkIds?: string[];
  agentIds?: string[];
  type?: "all" | "allowed" | "blocked";
  securityReport?: boolean;
  page?: number;
  pageSize?: number;
}

// ─── Interface ────────────────────────────────────────────────────────

export interface IDnsSecurityConnector {
  // ─── Threats (for Alerts page) ──────────────────────────
  /** Get threat events (blocked security queries) */
  getThreats(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsThreatEvent>>;

  /** Get aggregate threat summary with severity breakdown */
  getThreatSummary(from?: Date, to?: Date): Promise<DnsThreatSummary>;

  // ─── Traffic Reports (for Network deep dive) ───────────
  /** Get traffic summary (total/allowed/blocked/threats over time) */
  getTrafficSummary(filter?: DnsReportFilter): Promise<DnsTrafficSummary>;

  /** Get top domains by request count */
  getTopDomains(filter?: DnsReportFilter): Promise<DnsTopDomain[]>;

  /** Get top categories by request count */
  getTopCategories(filter?: DnsReportFilter): Promise<DnsTopCategory[]>;

  /** Get paginated DNS query logs */
  getQueryLogs(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsQueryLogEntry>>;

  // ─── Organizations & Networks ──────────────────────────
  getOrganizations(): Promise<DnsOrganization[]>;
  getNetworks(): Promise<DnsNetwork[]>;

  // ─── Policies ─────────────────────────────────────────
  getPolicies(): Promise<DnsPolicy[]>;
  getPolicyDetail(policyId: string): Promise<DnsPolicy>;
  updatePolicy(policyId: string, updates: Partial<{
    name: string;
    blacklist_categories: number[];
    allow_unknown_domains: boolean;
    google_safesearch: boolean;
    bing_safe_search: boolean;
    duck_duck_go_safe_search: boolean;
    ecosia_safesearch: boolean;
    yandex_safe_search: boolean;
    youtube_restricted: boolean;
    youtube_restricted_level: string;
    interstitial: boolean;
    allow_list_only: boolean;
    block_applications: string[];
    allow_applications: string[];
  }>): Promise<DnsPolicy>;
  addAllowDomain(policyId: string, domain: string): Promise<void>;
  addBlockDomain(policyId: string, domain: string): Promise<void>;
  removeAllowDomain(policyId: string, domain: string): Promise<void>;
  removeBlockDomain(policyId: string, domain: string): Promise<void>;
  addBlockedCategory(policyId: string, categoryId: number): Promise<void>;
  removeBlockedCategory(policyId: string, categoryId: number): Promise<void>;
  addBlockedApplication(policyId: string, name: string): Promise<void>;
  removeBlockedApplication(policyId: string, name: string): Promise<void>;

  // ─── Block Pages ────────────────────────────────────────
  getBlockPages(): Promise<DnsBlockPage[]>;
  getBlockPageDetail(blockPageId: string): Promise<DnsBlockPage>;
  updateBlockPage(blockPageId: string, updates: { name?: string; block_org_name?: string | null; block_email_addr?: string | null }): Promise<DnsBlockPage>;

  // ─── Scheduled Policies ──────────────────────────────────
  getScheduledPolicies(): Promise<DnsScheduledPolicy[]>;

  // ─── Networks (detail) ──────────────────────────────
  getNetworkDetail(networkId: string): Promise<DnsNetwork>;
  updateNetworkLocalDomains(networkId: string, domains: string[]): Promise<void>;
  updateNetworkLocalResolvers(networkId: string, resolvers: string[]): Promise<void>;

  // ─── Roaming Clients ──────────────────────────────────
  getRoamingClients(filter?: DnsReportFilter): Promise<PaginatedResponse<DnsRoamingClient>>;
  getAgentCounts(organizationIds?: string[]): Promise<DnsAgentCounts>;
  updateUserAgent(agentId: string, updates: { policy_id?: number | null; scheduled_policy_id?: number | null; block_page_id?: number | null; friendly_name?: string; tags?: string[] }): Promise<void>;
  cleanupInactiveAgents(organizationIds: string[], inactiveDays: number): Promise<DnsCleanupResult>;
  getCleanupStatus(cleanupId: string): Promise<DnsCleanupResult>;

  // ─── Users ───────────────────────────────────────────
  getUsers(): Promise<DnsUser[]>;

  // ─── Applications (AppAware) ──────────────────────────
  getApplications(): Promise<DnsApplication[]>;
  getApplicationCategories(): Promise<DnsApplicationCategory[]>;

  // ─── Reference Data ────────────────────────────────────
  getCategories(): Promise<DnsCategory[]>;
  lookupDomain(fqdn: string): Promise<DnsDomainLookup>;

  // ─── Health ────────────────────────────────────────────
  healthCheck(): Promise<HealthCheckResult>;
}
