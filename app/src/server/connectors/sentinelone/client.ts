/**
 * SentinelOne HTTP client.
 *
 * Auth: API Token in Authorization header as "ApiToken {token}"
 * Base URL: https://<tenant>.sentinelone.net/web/api/v2.1
 * Docs: Available in SentinelOne Ops Center → Help → API Hub
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { S1Response } from "./types";

export class SentinelOneClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `ApiToken ${this.config.credentials.apiToken}`,
    };
  }

  /**
   * Make a request and unwrap S1's standard response envelope.
   * S1 wraps all responses in { data: T, pagination?: { nextCursor, totalItems } }
   */
  async requestS1<T>(options: Parameters<BaseHttpClient["request"]>[0]): Promise<{
    data: T;
    nextCursor?: string;
    totalItems?: number;
  }> {
    const response = await this.request<S1Response<T>>(options);

    if (response.errors && response.errors.length > 0) {
      const err = response.errors[0];
      throw new Error(
        `[sentinelone] API error ${err.code}: ${err.title}${err.detail ? ` - ${err.detail}` : ""}`
      );
    }

    return {
      data: response.data,
      nextCursor: response.pagination?.nextCursor ?? undefined,
      totalItems: response.pagination?.totalItems,
    };
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Lightweight call to get account info
      await this.request<unknown>({
        path: "/accounts",
        params: { limit: 1 },
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
