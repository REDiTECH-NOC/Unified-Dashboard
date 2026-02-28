/**
 * DNSFilter API Response Types
 *
 * Based on the DNSFilter v1 API (JSON:API style).
 * API base: https://api.dnsfilter.com/v1
 * Auth: Authorization header with API key.
 */

// ─── JSON:API Wrappers ─────────────────────────────────────────

export interface DnsFilterApiResponse<T> {
  data: T;
}

export interface DnsFilterListResponse<T> {
  data: T[];
  links?: {
    first?: string;
    last?: string;
    prev?: string;
    next?: string;
  };
  included?: unknown[];
  meta?: Record<string, unknown>;
}

export interface DnsFilterIdType {
  id: string;
  type: string;
  uuid?: string;
}

// ─── Traffic Reports ─────────────────────────────────────────

export interface DnsFilterTrafficReportBucket {
  /** Timestamp for bucket start (e.g. "2026-02-20 00:00:00") */
  bucket: string;
  /** Total request count for this bucket */
  total: number;
  total_networks?: number;
  total_proxies?: number;
  total_agents?: number;
}

export interface DnsFilterTotalRequestsResponse {
  data: {
    organization_ids: number[];
    organization_names: string[];
    network_ids?: number[];
    network_names?: string[];
    values: DnsFilterTrafficReportBucket[];
  };
}

export interface DnsFilterTotalThreatsResponse {
  data: {
    organization_ids: number[];
    organization_names: string[];
    network_ids?: number[];
    network_names?: string[];
    values: DnsFilterTrafficReportBucket[];
  };
}

export interface DnsFilterTopDomainsResult {
  domain: string;
  total: number;
  total_networks: number;
  total_proxies: number;
  total_agents: number;
  categories?: Array<{ id: number; name: string }>;
}

export interface DnsFilterTopDomainsResponse {
  data: {
    organization_ids: number[];
    organization_names: string[];
    values: DnsFilterTopDomainsResult[];
    page?: DnsFilterPagination;
  };
}

export interface DnsFilterTopCategoriesResult {
  categoryid: number;
  category_id: number;
  category_name: string;
  methods?: number[];
  methods_names?: string[];
  total: number;
  total_networks: number;
  total_proxies: number;
  total_agents: number;
}

export interface DnsFilterTopCategoriesResponse {
  data: {
    organization_ids: number[];
    organization_names: string[];
    values: DnsFilterTopCategoriesResult[];
    page?: DnsFilterPagination;
  };
}

export interface DnsFilterQueryLogEntry {
  id?: number;
  domain: string;
  fqdn?: string;
  /** Timestamp e.g. "2026-02-27 22:32:05.846" */
  time: string;
  result?: string; // "allowed" | "blocked"
  threat?: boolean;
  question_type?: string;
  protocol?: string;
  /** Category IDs */
  categories?: number[];
  /** Category display names */
  categories_names?: string[];
  method?: number;
  method_name?: string;
  /** Network ID (no underscore in API) */
  networkid?: number;
  network_name?: string;
  /** Agent UUID */
  agentid?: string;
  /** Agent hostname */
  agentname?: string;
  agenttype?: string;
  request_address?: string;
  local_ipv4_address?: string;
  local_user_name?: string;
  local_user_login?: string;
  policy_id?: number;
  policy_name?: string;
  region?: string;
}

export interface DnsFilterQueryLogsResponse {
  data: {
    organization_id?: number;
    organization_ids?: string[];
    organization_name?: string;
    organization_names?: string[];
    network_id?: number;
    network_ids?: string[];
    values: DnsFilterQueryLogEntry[];
    page?: DnsFilterPagination;
  };
}

export interface DnsFilterCategoryStatsResponse {
  data: {
    organization_ids: number[];
    organization_names: string[];
    total_requests: number;
    allowed_requests: number;
    blocked_requests: number;
    threat_requests: number;
    values: Array<{
      category_id: number;
      category_name: string;
      total: number;
      blocked: number;
      allowed: number;
      is_security?: boolean;
    }>;
  };
}

export interface DnsFilterPagination {
  size: number;
  total: number;
  first: number;
  last: number;
  self: number;
  prev?: number;
  next?: number;
}

// ─── Organizations ───────────────────────────────────────────

export interface DnsFilterOrganization {
  id: string;
  type: "organizations";
  attributes: {
    id?: number;
    name: string;
    address?: string;
    type?: string;
    state?: string;
    total_networks?: number;
    total_users?: number;
    allow_create_network?: boolean;
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    networks?: { data: DnsFilterIdType[] };
  };
}

// ─── Networks ────────────────────────────────────────────────

export interface DnsFilterNetwork {
  id: string;
  type: "networks";
  attributes: {
    name: string;
    physical_address?: string;
    latitude?: number;
    longitude?: number;
    hostname?: string;
    secret_key?: string;
    local_domains?: string[];
    local_resolvers?: string[];
    block_page_id?: number;
    scheduled_policy_id?: number;
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    organization?: { data: DnsFilterIdType };
    ip_addresses?: { data: DnsFilterIdType[] };
    policy?: { data: DnsFilterIdType | null };
    scheduled_policy?: { data: DnsFilterIdType | null };
    block_page?: { data: DnsFilterIdType | null };
  };
}

export interface DnsFilterIpAddress {
  id: string;
  type: "ip_addresses";
  attributes: {
    ip?: string;
    address?: string;
    network_id?: number;
    organization_id?: number;
  };
}

// ─── Policies ────────────────────────────────────────────────

export interface DnsFilterPolicy {
  id: string;
  type: "policies";
  attributes: {
    name: string;
    organization_id?: number;
    whitelist_domains?: string[];
    blacklist_domains?: string[];
    blacklist_categories?: number[];
    allow_unknown_domains?: boolean;
    google_safesearch?: boolean;
    bing_safe_search?: boolean;
    duck_duck_go_safe_search?: boolean;
    ecosia_safesearch?: boolean;
    yandex_safe_search?: boolean;
    youtube_restricted?: boolean;
    youtube_restricted_level?: string;
    interstitial?: boolean;
    is_global_policy?: boolean;
    can_edit?: boolean;
    allow_list_only?: boolean;
    lock_version?: number;
    allow_applications?: string[];
    block_applications?: string[];
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    organization?: { data: DnsFilterIdType };
    network_policies?: { data: DnsFilterIdType[] };
    agent_policies?: { data: DnsFilterIdType[] };
    networks?: { data: DnsFilterIdType[] };
  };
}

// ─── Categories ──────────────────────────────────────────────

export interface DnsFilterCategory {
  id: string;
  type: "categories";
  attributes: {
    name: string;
    description?: string;
    source?: string;
    security?: boolean;
    internal?: boolean;
  };
  relationships?: {
    child_categories?: { data: DnsFilterIdType[] };
    parent_categories?: { data: DnsFilterIdType[] };
  };
}

// ─── User Agents (Roaming Clients) ──────────────────────────

export interface DnsFilterUserAgent {
  id: string;
  type: "user_agents";
  attributes: {
    agent_type?: string;
    agent_version?: string;
    client_id?: string;
    hostname?: string;
    friendly_name?: string;
    status?: string; // "active" | "disabled" | "uninstalled"
    agent_state?: string; // "Protected" | "Unprotected" | "Offline"
    last_sync?: string;
    os_version?: string;
    ip_address?: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    network?: { data: DnsFilterIdType | null };
    policy?: { data: DnsFilterIdType | null };
    scheduled_policy?: { data: DnsFilterIdType | null };
    organization?: { data: DnsFilterIdType };
  };
}

export interface DnsFilterAgentCounts {
  all: number;
  protected: number;
  unprotected: number;
  offline: number;
}

// ─── Domains ─────────────────────────────────────────────────

export interface DnsFilterDomain {
  id: string;
  type: "domains";
  attributes: {
    host?: string;
    name?: string;
  };
  relationships?: {
    categories?: { data: DnsFilterIdType[] };
  };
}

// ─── Users ──────────────────────────────────────────────────

export interface DnsFilterUser {
  id: string;
  type: "users";
  attributes: {
    email: string;
    name?: string;
    role?: string;
    created_at?: string;
    last_sign_in_at?: string;
    organization_id?: number;
  };
}

// ─── Current User (for health check) ────────────────────────

export interface DnsFilterCurrentUser {
  data: {
    id: string;
    type: "users";
    attributes: {
      name: string;
      email: string;
    };
  };
}

// ─── Block Pages ────────────────────────────────────────────

export interface DnsFilterBlockPage {
  id: string;
  type: "block_pages";
  attributes: {
    name: string;
    organization_id?: number;
    block_org_name?: string | null;
    block_email_addr?: string | null;
    block_logo_uuid?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    organization?: { data: DnsFilterIdType };
  };
}

// ─── Scheduled Policies ─────────────────────────────────────

export interface DnsFilterScheduledPolicy {
  id: string;
  type: "scheduled_policies";
  attributes: {
    name: string;
    organization_id?: number;
    policy_ids?: number[];
    timezone?: string;
    created_at?: string;
    updated_at?: string;
  };
  relationships?: {
    organization?: { data: DnsFilterIdType };
  };
}

// ─── Applications (AppAware) ────────────────────────────────

export interface DnsFilterApplication {
  id: string;
  type: "applications";
  attributes: {
    name: string;
    display_name?: string;
    description?: string;
    home_page_url?: string;
    favicon?: string;
    icon?: string;
  };
  relationships?: {
    categories?: { data: DnsFilterIdType[] };
  };
}

export interface DnsFilterApplicationCategory {
  id: string;
  type: "application_categories";
  attributes: {
    name: string;
    description?: string;
  };
}

// ─── Security categories that map to higher severity ────────

export const DNS_SECURITY_CATEGORIES = new Set([
  "Botnet",
  "Compromised & Links to Malware",
  "Cryptomining",
  "DNS Tunneling",
  "Malware",
  "Newly Seen Domains",
  "Phishing & Deception",
  "Potentially Harmful",
  "Proxy & Filter Avoidance",
  "Spam",
  "Spyware",
  "Typosquatting",
]);
