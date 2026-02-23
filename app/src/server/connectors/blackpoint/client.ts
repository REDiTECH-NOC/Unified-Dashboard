/**
 * Blackpoint CompassOne HTTP client.
 *
 * Auth: Bearer JWT token in Authorization header
 * Base URL: https://api.blackpointcyber.com
 * Tenant scoping: x-tenant-id header (optional — omit for account-level endpoints)
 * Pagination: skip/take (most endpoints) or page/pageSize (TE_ user endpoints)
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult, RequestOptions } from "../_base/types";
import type { BPPaginatedResponse } from "./types";

export class BlackpointClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${this.config.credentials.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Make a request with optional tenant scoping.
   * Most Blackpoint endpoints accept x-tenant-id to scope results to a specific customer.
   */
  async requestBP<T>(
    options: RequestOptions & { tenantId?: string }
  ): Promise<T> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.tenantId) {
      headers["x-tenant-id"] = options.tenantId;
    }
    return this.request<T>({ ...options, headers });
  }

  /**
   * Make a paginated request using skip/take pattern.
   * Returns the full paginated envelope with items, total, etc.
   */
  async requestPaginated<T>(
    options: RequestOptions & { tenantId?: string; skip?: number; take?: number }
  ): Promise<BPPaginatedResponse<T>> {
    const params = {
      ...options.params,
      skip: options.skip ?? 0,
      take: options.take ?? 100,
    };
    return this.requestBP<BPPaginatedResponse<T>>({
      ...options,
      params,
    });
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Lightweight call — list tenants with take=1
      await this.request<unknown>({
        path: "/v1/tenants",
        params: { take: 1 },
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
}
