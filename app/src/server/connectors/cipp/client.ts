/**
 * CIPP HTTP client.
 *
 * Auth: OAuth 2.0 Client Credentials flow (identical pattern to NinjaOne).
 * Access tokens are cached in Redis with TTL.
 * Docs: https://docs.cipp.app/api-documentation/setup-and-authentication
 */

import { BaseHttpClient } from "../_base/http-client";
import { ConnectorAuthError } from "../_base/errors";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { CIPPTokenResponse } from "./types";
import { redis } from "@/lib/redis";

const TOKEN_CACHE_KEY = "oauth:cipp:access_token";

export class CIPPClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    // CIPP Azure Functions can be slow (cold starts, large tenant queries).
    // Default to 120s timeout; individual fast endpoints can override per-request.
    super({ ...config, timeoutMs: config.timeoutMs ?? 120_000 });
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  protected override async refreshAuth(): Promise<void> {
    await redis.del(TOKEN_CACHE_KEY);
  }

  /**
   * Get OAuth2 access token — cached in Redis, refreshed on expiry.
   */
  private async getAccessToken(): Promise<string> {
    const cached = await redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const { applicationId, applicationSecret, tenantId } = this.config.credentials;
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: applicationId,
        client_secret: applicationSecret,
        scope: `api://${applicationId}/.default`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ConnectorAuthError(
        "cipp",
        `OAuth token request failed: HTTP ${response.status} - ${body}`
      );
    }

    const data = (await response.json()) as CIPPTokenResponse;

    // Cache with TTL slightly less than expiry (2 min buffer, minimum 60s)
    const ttl = Math.max(data.expires_in - 120, 60);
    await redis.set(TOKEN_CACHE_KEY, data.access_token, "EX", ttl);

    return data.access_token;
  }

  /**
   * Convenience request wrapper for CIPP API calls.
   * CIPP returns raw JSON arrays/objects — no response envelope to unwrap.
   */
  async requestCIPP<T>(
    options: Parameters<BaseHttpClient["request"]>[0]
  ): Promise<T> {
    return this.request<T>(options);
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Lightweight call — list tenants (returns quickly even on cold start)
      await this.request<unknown>({
        path: "/api/ListTenants",
        params: { ClearCache: "false" },
        skipRateLimit: true,
        timeout: 30_000, // Tighter timeout for health check
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
