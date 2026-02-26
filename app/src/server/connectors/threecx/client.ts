/**
 * 3CX HTTP Client — handles authentication with 60-second access tokens.
 *
 * Auth flow:
 * 1. POST /webclient/api/Login/GetAccessToken → { access_token, refresh_token }
 * 2. Access token cached in Redis for 45s (expires at 60s, leave buffer)
 * 3. Refresh token cached for 30 days
 * 4. On 401 → clear cache, re-authenticate on retry
 *
 * Unlike other connectors, each 3CX client is tied to a specific PBX instance.
 * The toolId is prefixed with "threecx:" + instanceId for per-instance rate limiting.
 */

import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import { BaseHttpClient } from "../_base/http-client";
import { ConnectorAuthError } from "../_base/errors";
import { redis } from "@/lib/redis";
import type { ThreecxLoginResponse, ThreecxSystemStatus } from "./types";

export class ThreecxClient extends BaseHttpClient {
  private instanceId: string;
  private fqdn: string;
  private extensionNumber: string;
  private password: string;

  constructor(
    instanceId: string,
    fqdn: string,
    extensionNumber: string,
    password: string
  ) {
    const config: ConnectorConfig = {
      toolId: `threecx:${instanceId}`,
      baseUrl: `https://${fqdn}/xapi/v1`,
      credentials: {},
      rateLimitMax: 30,
      rateLimitWindowMs: 60_000,
      timeoutMs: 15_000,
    };
    super(config);
    this.instanceId = instanceId;
    this.fqdn = fqdn;
    this.extensionNumber = extensionNumber;
    this.password = password;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { Authorization: `Bearer ${token}` };
  }

  protected override async refreshAuth(): Promise<void> {
    // Clear the cached token so the next getAccessToken() call re-authenticates
    await redis.del(`threecx:token:${this.instanceId}`);
  }

  private async getAccessToken(): Promise<string> {
    const cacheKey = `threecx:token:${this.instanceId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch {
      // Redis unavailable — proceed without cache
    }

    // Authenticate against the PBX
    const loginUrl = `https://${this.fqdn}/webclient/api/Login/GetAccessToken`;
    console.log(`[3CX] Authenticating to ${this.fqdn} as ext ${this.extensionNumber}...`);
    let response: Response;
    try {
      response = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Username: this.extensionNumber,
          Password: this.password,
          SecurityCode: "",
        }),
      });
    } catch (fetchErr) {
      console.error(`[3CX] Network error reaching ${loginUrl}:`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      throw new ConnectorAuthError(
        `threecx:${this.instanceId}`,
        `Cannot reach 3CX at ${this.fqdn}: ${fetchErr instanceof Error ? fetchErr.message : "Network error"}`
      );
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[3CX] Login failed for ${this.fqdn}: HTTP ${response.status}`, errBody);
      throw new ConnectorAuthError(
        `threecx:${this.instanceId}`,
        `3CX login failed: HTTP ${response.status} — ${errBody.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as ThreecxLoginResponse;

    if (data.Status !== "AuthSuccess" || !data.Token) {
      console.error(`[3CX] Auth rejected for ${this.fqdn}: Status=${data.Status}`, JSON.stringify(data));
      throw new ConnectorAuthError(
        `threecx:${this.instanceId}`,
        `3CX auth status: ${data.Status}`
      );
    }

    const accessToken = data.Token.access_token;

    // Cache access token for 45s (token expires at 60s)
    try {
      await redis.set(cacheKey, accessToken, "EX", 45);

      // Also cache the refresh token for future use
      if (data.Token.refresh_token) {
        await redis.set(
          `threecx:refresh:${this.instanceId}`,
          data.Token.refresh_token,
          "EX",
          86400 * 30 // 30 days
        );
      }
    } catch {
      // Redis unavailable — token still usable for this request
    }

    return accessToken;
  }

  /** Make a GET request to the 3CX XAPI */
  async xapiRequest<T>(path: string): Promise<T> {
    return this.request<T>({ path });
  }

  /** Make a POST action call to the 3CX XAPI (for restart, etc.) */
  async xapiAction<T = void>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ path, method: "POST", body });
  }

  /** Health check — fetch SystemStatus and verify connectivity */
  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const status = await this.request<ThreecxSystemStatus>({
        path: "/SystemStatus",
        skipRateLimit: true,
      });
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: `3CX v${status.Version} — ${status.ExtensionsRegistered}/${status.ExtensionsTotal} ext, ${status.CallsActive} calls`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }
}
