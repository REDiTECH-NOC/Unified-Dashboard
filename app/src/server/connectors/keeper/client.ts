/**
 * Keeper Security MSP HTTP client.
 *
 * Auth: JWT HS512 tokens with 5-minute expiration.
 * Token is self-signed using the MSP API secret — no auth endpoint needed.
 *
 * Uses Node.js crypto for HMAC-SHA512 signing (no external JWT library).
 */

import { createHmac } from "crypto";
import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import { ConnectorAuthError } from "../_base/errors";
import type {
  KeeperAccount,
  KeeperCurrentUsageRequest,
  KeeperCurrentUsageResponse,
  KeeperMonthlyUsageRequest,
  KeeperMonthlyUsageResponse,
  KeeperProduct,
  KeeperListResponse,
} from "./types";

/** Base64url encode (no padding, URL-safe) */
function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export class KeeperClient extends BaseHttpClient {
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: ConnectorConfig) {
    super(config);
  }

  // ── JWT Token Generation ──────────────────────────────────────

  /**
   * Build a JWT HS512 token for Keeper API authentication.
   * Self-signed using the MSP API secret — tokens expire after 5 minutes.
   * We refresh at 4 minutes to avoid clock-skew rejections.
   */
  private generateToken(): string {
    const { apiKey, privateKey } = this.config.credentials;

    if (!apiKey || !privateKey) {
      throw new ConnectorAuthError(
        "keeper",
        "Missing apiKey or privateKey in credentials"
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 300; // 5 minutes

    const header = base64url(JSON.stringify({ alg: "HS512", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        sub: apiKey,
        iat: now,
        exp,
      })
    );

    const signingInput = `${header}.${payload}`;
    const signature = base64url(
      createHmac("sha512", privateKey).update(signingInput).digest()
    );

    return `${signingInput}.${signature}`;
  }

  /**
   * Get a valid JWT token (cached for 4 minutes).
   */
  private getToken(): string {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    this.cachedToken = this.generateToken();
    this.tokenExpiresAt = now + 4 * 60_000; // Refresh 1 minute before expiry
    return this.cachedToken;
  }

  // ── BaseHttpClient Implementation ─────────────────────────────

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.getToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  protected override async refreshAuth(): Promise<void> {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  // ── API Methods ───────────────────────────────────────────────

  /** GET /accounts — list all managed companies */
  async getAccounts(): Promise<KeeperAccount[]> {
    const response = await this.request<KeeperListResponse<KeeperAccount>>({
      path: "/accounts",
    });
    return response.data ?? [];
  }

  /** POST /current-usage — real-time usage for specified companies */
  async getCurrentUsage(
    enterpriseIds: number[]
  ): Promise<KeeperCurrentUsageResponse[]> {
    const body: KeeperCurrentUsageRequest = { enterprise_ids: enterpriseIds };
    const response = await this.request<
      KeeperListResponse<KeeperCurrentUsageResponse>
    >({
      method: "POST",
      path: "/current-usage",
      body,
    });
    return response.data ?? [];
  }

  /** POST /monthly-usage — historical billing for specified companies */
  async getMonthlyUsage(
    enterpriseIds: number[],
    month: string
  ): Promise<KeeperMonthlyUsageResponse[]> {
    const body: KeeperMonthlyUsageRequest = {
      enterprise_ids: enterpriseIds,
      month,
    };
    const response = await this.request<
      KeeperListResponse<KeeperMonthlyUsageResponse>
    >({
      method: "POST",
      path: "/monthly-usage",
      body,
    });
    return response.data ?? [];
  }

  /** GET /msp-products — product catalog with SKU mappings */
  async getProducts(): Promise<KeeperProduct[]> {
    const response = await this.request<KeeperListResponse<KeeperProduct>>({
      path: "/msp-products",
    });
    return response.data ?? [];
  }

  // ── Health Check ──────────────────────────────────────────────

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.getAccounts();
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: "Connected to Keeper Security MSP API",
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
