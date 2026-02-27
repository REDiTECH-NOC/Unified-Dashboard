/**
 * Pax8 HTTP client.
 *
 * Auth: OAuth2 Client Credentials flow (JSON body, not form-urlencoded).
 * Access tokens are cached in Redis with ~23.5h TTL (24h expiry - 30m buffer).
 * Rate limit: 1000 req/min (we configure 900 for safety buffer).
 *
 * Docs: https://devx.pax8.com/docs/authentication
 */

import { BaseHttpClient } from "../_base/http-client";
import { ConnectorAuthError } from "../_base/errors";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { Pax8OAuthTokenResponse, Pax8PagedResponse } from "./types";
import { redis } from "@/lib/redis";

const TOKEN_CACHE_KEY = "oauth:pax8:access_token";
const TOKEN_URL = "https://api.pax8.com/v1/token";

export class Pax8Client extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  protected override async refreshAuth(): Promise<void> {
    await redis.del(TOKEN_CACHE_KEY);
  }

  /**
   * OAuth2 client_credentials token — cached in Redis, auto-refreshed.
   * Token is valid for 24 hours; we cache with a ~23.5h TTL.
   */
  private async getAccessToken(): Promise<string> {
    const cached = await redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const { clientId, clientSecret } = this.config.credentials;
    if (!clientId || !clientSecret) {
      throw new ConnectorAuthError(
        "pax8",
        "Missing Pax8 clientId or clientSecret"
      );
    }

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
        audience: "https://api.pax8.com",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ConnectorAuthError(
        "pax8",
        `OAuth token request failed: HTTP ${response.status} - ${body}`
      );
    }

    const data = (await response.json()) as Pax8OAuthTokenResponse;

    // Cache with TTL slightly less than expiry (24h - 30min buffer)
    const ttl = Math.max(data.expires_in - 1800, 60);
    await redis.set(TOKEN_CACHE_KEY, data.access_token, "EX", ttl);

    return data.access_token;
  }

  /**
   * Fetch all pages of a paginated Pax8 endpoint.
   * Pax8 uses page-based pagination: page starts at 0, content array.
   * Returns the full aggregated content array.
   */
  async fetchAllPages<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    pageSize = 200
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await this.request<Pax8PagedResponse<T>>({
        path,
        params: { ...params, page, size: pageSize },
      });

      all.push(...response.content);
      hasMore = response.page.number < response.page.totalPages - 1;
      page++;
    }

    return all;
  }

  /**
   * Fetch a single page (used for UI-side pagination).
   */
  async fetchPage<T>(
    path: string,
    page: number,
    pageSize: number,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<Pax8PagedResponse<T>> {
    return this.request<Pax8PagedResponse<T>>({
      path,
      params: { ...params, page, size: pageSize },
    });
  }

  /**
   * Fetch a single resource by ID.
   */
  async fetchOne<T>(path: string): Promise<T> {
    return this.request<T>({ path });
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.request<Pax8PagedResponse<unknown>>({
        path: "/companies",
        params: { page: 0, size: 1 },
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
