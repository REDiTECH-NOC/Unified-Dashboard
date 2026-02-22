/**
 * NinjaOne HTTP client.
 *
 * Auth: OAuth2 Client Credentials flow.
 * Access tokens are cached in Redis with TTL.
 * Docs: https://app.ninjarmm.com/apidocs/
 */

import { BaseHttpClient } from "../_base/http-client";
import { ConnectorAuthError } from "../_base/errors";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { NinjaOAuthTokenResponse } from "./types";
import { redis } from "@/lib/redis";

const TOKEN_CACHE_KEY = "oauth:ninjaone:access_token";

export class NinjaOneClient extends BaseHttpClient {
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
   * Get OAuth2 access token — cached in Redis, refreshed on expiry.
   */
  private async getAccessToken(): Promise<string> {
    const cached = await redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const { clientId, clientSecret } = this.config.credentials;
    const instanceUrl = this.config.credentials.instanceUrl ?? "https://app.ninjarmm.com";
    const tokenUrl = `${instanceUrl}/oauth/token`;

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "monitoring management control",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ConnectorAuthError(
        "ninjaone",
        `OAuth token request failed: HTTP ${response.status} - ${body}`
      );
    }

    const data = (await response.json()) as NinjaOAuthTokenResponse;

    // Cache with TTL slightly less than expiry
    const ttl = Math.max(data.expires_in - 120, 60);
    await redis.set(TOKEN_CACHE_KEY, data.access_token, "EX", ttl);

    return data.access_token;
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Use organizations endpoint as a lightweight health check
      await this.request<unknown[]>({
        path: "/organizations",
        params: { pageSize: 1 },
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
