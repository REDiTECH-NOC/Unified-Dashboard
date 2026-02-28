/**
 * DNSFilter HTTP Client
 *
 * Extends BaseHttpClient with DNSFilter API key authentication.
 * API base: https://api.dnsfilter.com
 * Auth: Authorization header with raw API key.
 */

import { BaseHttpClient } from "../_base/http-client";
import type { HealthCheckResult } from "../_base/types";
import type {
  DnsFilterTotalRequestsResponse,
  DnsFilterTotalThreatsResponse,
  DnsFilterTopDomainsResponse,
  DnsFilterTopCategoriesResponse,
  DnsFilterQueryLogsResponse,
  DnsFilterCategoryStatsResponse,
  DnsFilterOrganization,
  DnsFilterNetwork,
  DnsFilterPolicy,
  DnsFilterCategory,
  DnsFilterUserAgent,
  DnsFilterAgentCounts,
  DnsFilterCurrentUser,
  DnsFilterListResponse,
  DnsFilterApiResponse,
  DnsFilterIpAddress,
  DnsFilterDomain,
  DnsFilterUser,
  DnsFilterBlockPage,
  DnsFilterScheduledPolicy,
  DnsFilterApplication,
  DnsFilterApplicationCategory,
} from "./types";

// ─── Helper: format Date → DNSFilter UTC string ────────────────

function formatDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export class DnsFilterClient extends BaseHttpClient {
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: this.config.credentials.apiKey,
    };
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.request<DnsFilterCurrentUser>({
        path: "/v1/current_user",
        skipRateLimit: true,
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ─── Traffic Reports ───────────────────────────────────────

  async getTotalRequests(params: {
    from?: Date;
    to?: Date;
    organizationIds?: string[];
    networkIds?: string[];
    type?: string;
    bucketSize?: string;
    securityReport?: boolean;
  }): Promise<DnsFilterTotalRequestsResponse> {
    return this.request<DnsFilterTotalRequestsResponse>({
      path: "/v1/traffic_reports/total_requests",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationIds?.join(","),
        network_ids: params.networkIds?.join(","),
        type: params.type,
        bucket_size: params.bucketSize,
        security_report: params.securityReport,
      },
    });
  }

  async getTotalThreats(params: {
    from?: Date;
    to?: Date;
    organizationIds?: string[];
    networkIds?: string[];
    bucketSize?: string;
  }): Promise<DnsFilterTotalThreatsResponse> {
    return this.request<DnsFilterTotalThreatsResponse>({
      path: "/v1/traffic_reports/total_threats",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationIds?.join(","),
        network_ids: params.networkIds?.join(","),
        bucket_size: params.bucketSize,
      },
    });
  }

  async getTopDomains(params: {
    from?: Date;
    to?: Date;
    organizationIds?: string[];
    networkIds?: string[];
    type?: string;
    securityReport?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterTopDomainsResponse> {
    return this.request<DnsFilterTopDomainsResponse>({
      path: "/v1/traffic_reports/top_domains",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationIds?.join(","),
        network_ids: params.networkIds?.join(","),
        type: params.type,
        security_report: params.securityReport,
        "page[number]": params.page,
        "page[size]": params.pageSize ?? 25,
      },
    });
  }

  async getTopCategories(params: {
    from?: Date;
    to?: Date;
    organizationIds?: string[];
    networkIds?: string[];
    type?: string;
    securityReport?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterTopCategoriesResponse> {
    return this.request<DnsFilterTopCategoriesResponse>({
      path: "/v1/traffic_reports/top_categories",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationIds?.join(","),
        network_ids: params.networkIds?.join(","),
        type: params.type,
        security_report: params.securityReport,
        "page[number]": params.page,
        "page[size]": params.pageSize ?? 25,
      },
    });
  }

  async getQueryLogs(params: {
    from?: Date;
    to?: Date;
    organizationId?: string;
    networkIds?: string[];
    agentIds?: string[];
    result?: string;
    securityReport?: boolean;
    domain?: string;
    fqdn?: string;
    categoryIds?: string[];
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterQueryLogsResponse> {
    return this.request<DnsFilterQueryLogsResponse>({
      path: "/v1/traffic_reports/query_logs",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationId,
        network_ids: params.networkIds?.join(","),
        agent_ids: params.agentIds?.join(","),
        result: params.result,
        security_report: params.securityReport,
        domain: params.domain,
        fqdn: params.fqdn,
        category_ids: params.categoryIds?.join(","),
        "page[number]": params.page,
        "page[size]": params.pageSize ?? 50,
      },
    });
  }

  async getCategoryStats(params: {
    from?: Date;
    to?: Date;
    organizationId?: string;
    networkIds?: string[];
  }): Promise<DnsFilterCategoryStatsResponse> {
    return this.request<DnsFilterCategoryStatsResponse>({
      path: "/v1/traffic_reports/total_category_stats",
      params: {
        from: params.from ? formatDate(params.from) : undefined,
        to: params.to ? formatDate(params.to) : undefined,
        organization_id: params.organizationId,
        network_ids: params.networkIds?.join(","),
      },
    });
  }

  // ─── Organizations ─────────────────────────────────────────

  async getOrganizations(params?: {
    page?: number;
    pageSize?: number;
    name?: string;
  }): Promise<DnsFilterListResponse<DnsFilterOrganization>> {
    return this.request<DnsFilterListResponse<DnsFilterOrganization>>({
      path: "/v1/organizations/all",
      params: {
        basic_info: true,
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
        name: params?.name,
      },
    });
  }

  // ─── Networks ──────────────────────────────────────────────

  async getNetworks(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<DnsFilterListResponse<DnsFilterNetwork> & { included?: DnsFilterIpAddress[] }> {
    return this.request<DnsFilterListResponse<DnsFilterNetwork> & { included?: DnsFilterIpAddress[] }>({
      path: "/v1/networks/all",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
        search: params?.search,
        count_network_ips: true,
      },
    });
  }

  async getNetworkById(
    networkId: string
  ): Promise<DnsFilterApiResponse<DnsFilterNetwork>> {
    return this.request<DnsFilterApiResponse<DnsFilterNetwork>>({
      path: `/v1/networks/${networkId}`,
    });
  }

  async updateNetwork(
    networkId: string,
    attributes: { local_domains?: string[]; local_resolvers?: string[] }
  ): Promise<DnsFilterApiResponse<DnsFilterNetwork>> {
    return this.request<DnsFilterApiResponse<DnsFilterNetwork>>({
      method: "PATCH",
      path: `/v1/networks/${networkId}`,
      body: {
        data: {
          type: "networks",
          attributes,
        },
      },
    });
  }

  // ─── Agent Cleanup ──────────────────────────────────────────

  async createAgentCleanup(params: {
    organizationIds: number[];
    inactiveFor: number;
  }): Promise<{ data: { id: string; attributes: { inactive_for: number; completed: boolean; to_delete_count: number } } }> {
    return this.request({
      method: "POST",
      path: "/v1/user_agent_cleanups",
      body: {
        organization_ids: params.organizationIds,
        inactive_for: params.inactiveFor,
      },
    });
  }

  async getAgentCleanupStatus(
    cleanupId: string
  ): Promise<{ data: { id: string; attributes: { inactive_for: number; completed: boolean; to_delete_count: number } } }> {
    return this.request({
      path: `/v1/user_agent_cleanups/${cleanupId}`,
    });
  }

  // ─── Policies ──────────────────────────────────────────────

  async getPolicies(params?: {
    organizationId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterPolicy>> {
    return this.request<DnsFilterListResponse<DnsFilterPolicy>>({
      path: "/v1/policies/all",
      params: {
        organization_id: params?.organizationId,
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
      },
    });
  }

  async getPolicyById(policyId: string): Promise<DnsFilterApiResponse<DnsFilterPolicy>> {
    return this.request<DnsFilterApiResponse<DnsFilterPolicy>>({
      path: `/v1/policies/${policyId}`,
    });
  }

  async addAllowDomain(policyId: string, domain: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/add_whitelist_domain`,
      body: { domain },
    });
  }

  async addBlockDomain(policyId: string, domain: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/add_blacklist_domain`,
      body: { domain },
    });
  }

  async removeAllowDomain(policyId: string, domain: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/remove_whitelist_domain`,
      body: { domain },
    });
  }

  async removeBlockDomain(policyId: string, domain: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/remove_blacklist_domain`,
      body: { domain },
    });
  }

  async updatePolicy(
    policyId: string,
    policy: Record<string, unknown>
  ): Promise<DnsFilterApiResponse<DnsFilterPolicy>> {
    return this.request<DnsFilterApiResponse<DnsFilterPolicy>>({
      method: "PATCH",
      path: `/v1/policies/${policyId}`,
      body: { policy, include_relationships: true },
    });
  }

  async addBlockedCategory(policyId: string, categoryId: number): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/add_blacklist_category`,
      body: { category_id: categoryId, include_relationships: true },
    });
  }

  async removeBlockedCategory(policyId: string, categoryId: number): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/remove_blacklist_category`,
      body: { category_id: categoryId, include_relationships: true },
    });
  }

  async addBlockedApplication(policyId: string, name: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/add_blocked_application`,
      body: { name, include_relationships: true },
    });
  }

  async removeBlockedApplication(policyId: string, name: string): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1/policies/${policyId}/remove_blocked_application`,
      body: { name, include_relationships: true },
    });
  }

  // ─── Block Pages ────────────────────────────────────────────

  async getBlockPages(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterBlockPage>> {
    return this.request<DnsFilterListResponse<DnsFilterBlockPage>>({
      path: "/v1/block_pages/all",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
      },
    });
  }

  async getBlockPageById(blockPageId: string): Promise<DnsFilterApiResponse<DnsFilterBlockPage>> {
    return this.request<DnsFilterApiResponse<DnsFilterBlockPage>>({
      path: `/v1/block_pages/${blockPageId}`,
    });
  }

  async updateBlockPage(
    blockPageId: string,
    attrs: { name?: string; block_org_name?: string | null; block_email_addr?: string | null }
  ): Promise<DnsFilterApiResponse<DnsFilterBlockPage>> {
    return this.request<DnsFilterApiResponse<DnsFilterBlockPage>>({
      method: "PATCH",
      path: `/v1/block_pages/${blockPageId}`,
      body: { data: { type: "block_pages", attributes: attrs } },
    });
  }

  // ─── Scheduled Policies ─────────────────────────────────────

  async getScheduledPolicies(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterScheduledPolicy>> {
    return this.request<DnsFilterListResponse<DnsFilterScheduledPolicy>>({
      path: "/v1/scheduled_policies/all",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
      },
    });
  }

  // ─── Applications (AppAware) ────────────────────────────────

  async getApplications(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterApplication>> {
    return this.request<DnsFilterListResponse<DnsFilterApplication>>({
      path: "/v1/applications/all",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 500,
      },
    });
  }

  async getApplicationCategories(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterApplicationCategory>> {
    return this.request<DnsFilterListResponse<DnsFilterApplicationCategory>>({
      path: "/v1/application_categories",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
      },
    });
  }

  // ─── Categories ────────────────────────────────────────────

  async getCategories(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterCategory>> {
    return this.request<DnsFilterListResponse<DnsFilterCategory>>({
      path: "/v1/categories/all",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 200,
      },
    });
  }

  // ─── User Agents (Roaming Clients) ────────────────────────

  async getUserAgents(params?: {
    organizationIds?: string[];
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    sort?: string;
  }): Promise<DnsFilterListResponse<DnsFilterUserAgent>> {
    return this.request<DnsFilterListResponse<DnsFilterUserAgent>>({
      path: "/v1/user_agents",
      params: {
        organization_ids: params?.organizationIds?.join(","),
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 50,
        status: params?.status,
        search: params?.search,
        sort: params?.sort,
      },
    });
  }

  async updateUserAgent(
    agentId: string,
    userAgent: Record<string, unknown>
  ): Promise<DnsFilterApiResponse<DnsFilterUserAgent>> {
    return this.request<DnsFilterApiResponse<DnsFilterUserAgent>>({
      method: "PATCH",
      path: `/v1/user_agents/${agentId}`,
      body: { user_agent: userAgent },
    });
  }

  async getUserAgentCounts(params?: {
    organizationIds?: string[];
  }): Promise<DnsFilterAgentCounts> {
    return this.request<DnsFilterAgentCounts>({
      path: "/v1/user_agents/counts",
      params: {
        organization_ids: params?.organizationIds?.join(","),
        new_agent_states: true,
      },
    });
  }

  // ─── Users ────────────────────────────────────────────────

  async getUsers(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DnsFilterListResponse<DnsFilterUser>> {
    return this.request<DnsFilterListResponse<DnsFilterUser>>({
      path: "/v1/users",
      params: {
        "page[number]": params?.page,
        "page[size]": params?.pageSize ?? 100,
      },
    });
  }

  // ─── Domains ───────────────────────────────────────────────

  async lookupDomain(fqdn: string): Promise<DnsFilterApiResponse<DnsFilterDomain & { id?: number; name?: string; category?: string }>> {
    return this.request<DnsFilterApiResponse<DnsFilterDomain & { id?: number; name?: string; category?: string }>>({
      path: "/v1/domains/user_lookup",
      params: { fqdn },
    });
  }
}
