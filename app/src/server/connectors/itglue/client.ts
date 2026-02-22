/**
 * IT Glue HTTP client.
 *
 * Auth: API Key in x-api-key header.
 * Format: JSON:API (compound documents).
 * Rate limit: 3000 requests per 5 minutes.
 * Docs: https://api.itglue.com/developer/
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult, RequestOptions } from "../_base/types";
import type { ITGlueListResponse, ITGlueSingleResponse } from "./types";

export class ItGlueClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super({
      ...config,
      rateLimitMax: config.rateLimitMax ?? 550, // Stay under 3000/5min ≈ 600/min
      rateLimitWindowMs: config.rateLimitWindowMs ?? 60_000,
    });
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      "x-api-key": this.config.credentials.apiKey,
    };
  }

  /**
   * Make a paginated JSON:API request.
   * Handles page[number], page[size], filter[key], and include params.
   */
  async requestList<T>(
    options: RequestOptions & {
      page?: number;
      pageSize?: number;
      filters?: Record<string, string>;
      include?: string;
      sort?: string;
    }
  ): Promise<ITGlueListResponse<T>> {
    const params: Record<string, string | number | boolean | undefined> = {
      ...options.params,
      "page[number]": options.page ?? 1,
      "page[size]": Math.min(options.pageSize ?? 50, 1000),
    };

    if (options.include) params.include = options.include;
    if (options.sort) params.sort = options.sort;

    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        params[`filter[${key}]`] = value;
      }
    }

    return this.request<ITGlueListResponse<T>>({
      ...options,
      params,
    });
  }

  /**
   * Make a single-resource JSON:API request.
   */
  async requestSingle<T>(
    options: RequestOptions & { include?: string }
  ): Promise<ITGlueSingleResponse<T>> {
    const params: Record<string, string | number | boolean | undefined> = {
      ...options.params,
    };

    if (options.include) params.include = options.include;

    return this.request<ITGlueSingleResponse<T>>({
      ...options,
      params,
    });
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.requestList({
        path: "/organizations",
        pageSize: 1,
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
