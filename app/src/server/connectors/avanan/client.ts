/**
 * Avanan (Check Point Harmony Email & Collaboration) HTTP client.
 *
 * Auth flow:
 * 1. POST /auth/external with { clientId, accessKey } → Bearer token
 * 2. All subsequent requests use Authorization: Bearer <token>
 * 3. Every request includes x-av-req-id (UUID) for tracing
 *
 * MSP mode:
 * - One API key manages all client tenants
 * - GET /scopes → list available tenant scopes ("{farm}:{tenant}")
 * - Query endpoints accept optional scopes[] to filter by tenant
 * - Action endpoints require a single scope when multi-tenant
 * - MSP management endpoints require msp_name header
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult, RequestOptions } from "../_base/types";
import { ConnectorAuthError } from "../_base/errors";
import type {
  AvananResponse,
  AvananAuthResponse,
  AvananScope,
  AvananTaskStatus,
} from "./types";
import { AVANAN_REGIONS } from "./types";

function generateRequestId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AvananClient extends BaseHttpClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private authBaseUrl: string;

  constructor(config: ConnectorConfig) {
    const region = config.credentials.region || "us";
    const regionConfig = AVANAN_REGIONS[region];

    if (!regionConfig) {
      throw new ConnectorAuthError(
        "avanan",
        `Unknown Avanan region: ${region}. Valid: ${Object.keys(AVANAN_REGIONS).join(", ")}`
      );
    }

    const resolved = {
      ...config,
      baseUrl: regionConfig.apiBase,
    };
    super(resolved);

    this.authBaseUrl = regionConfig.authBase;
  }

  /**
   * Authenticate and obtain a Bearer token.
   * Tokens are cached until expiry with 5 min safety margin.
   */
  private async authenticate(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt - 5 * 60_000) {
      return this.accessToken;
    }

    const { clientId, accessKey } = this.config.credentials;

    if (!clientId || !accessKey) {
      throw new ConnectorAuthError(
        "avanan",
        "Missing clientId or accessKey (Client Secret) in credentials"
      );
    }

    const response = await fetch(`${this.authBaseUrl}/auth/external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, accessKey }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ConnectorAuthError(
        "avanan",
        `Authentication failed (HTTP ${response.status}): ${body}`
      );
    }

    const data = (await response.json()) as AvananAuthResponse;
    this.accessToken = data.data.token;
    const expiresInMs = (data.data.expiresIn ?? 3600) * 1000;
    this.tokenExpiresAt = now + expiresInMs;

    return this.accessToken;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();
    return {
      Authorization: `Bearer ${token}`,
      "x-av-req-id": generateRequestId(),
      Accept: "application/json",
    };
  }

  protected override async refreshAuth(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    await this.authenticate();
  }

  /**
   * Build scope-specific headers. The SmartAPI spec requires a `scopes` header
   * on scoped requests, and `msp_name` for MSP management endpoints.
   */
  private buildScopeHeaders(scope?: string, mspName?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (scope) headers["scopes"] = scope;
    if (mspName) headers["msp_name"] = mspName;
    return headers;
  }

  /**
   * Make a request and unwrap Avanan's response envelope.
   * Returns { data, scrollId, totalRecords }.
   */
  async requestAvanan<T>(
    options: RequestOptions,
  ): Promise<{
    data: T[];
    scrollId?: string;
    totalRecords: number;
  }> {
    const response = await this.request<AvananResponse<T>>(options);

    return {
      data: response.responseData ?? [],
      scrollId: response.responseEnvelope?.scrollId ?? undefined,
      totalRecords: response.responseEnvelope?.totalRecordsNumber ?? 0,
    };
  }

  /**
   * Make a raw request (for actions that return non-standard shapes).
   */
  async requestRaw<T>(
    options: RequestOptions,
  ): Promise<T> {
    return this.request<T>(options);
  }

  // ── Task Status ──

  /**
   * Check the status of an async action task (quarantine, restore, etc.).
   * Actions return taskIds — poll this to check completion.
   */
  async getTaskStatus(taskId: number): Promise<AvananTaskStatus> {
    const response = await this.requestRaw<{ responseData: AvananTaskStatus }>({
      path: `/v1.0/task/${taskId}`,
    });
    return response.responseData;
  }

  // ── Download ──

  /**
   * Download an entity (email file) — returns raw Buffer.
   */
  async downloadEntityFile(
    entityId: string,
    original = false,
  ): Promise<Buffer> {
    const token = await this.authenticate();
    const url = `${this.config.baseUrl}/v1.0/download/entity/${entityId}?original=${original}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-av-req-id": generateRequestId(),
      },
    });

    if (!response.ok) {
      throw new Error(
        `[avanan] Failed to download entity ${entityId}: HTTP ${response.status}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ── MSP Scopes ──

  async getScopes(): Promise<AvananScope[]> {
    const response = await this.requestAvanan<AvananScope>({
      path: "/v1.0/scopes",
    });
    return response.data;
  }

  // ── MSP Management (scoped requests with msp_name header) ──

  async mspRequest<T>(
    options: RequestOptions,
    mspName?: string,
  ): Promise<T> {
    const headers = this.buildScopeHeaders(undefined, mspName || this.config.credentials.mspName);
    return this.request<T>({
      ...options,
      headers: { ...headers, ...options.headers },
    });
  }

  async mspRequestAvanan<T>(
    options: RequestOptions,
    mspName?: string,
  ): Promise<{
    data: T[];
    scrollId?: string;
    totalRecords: number;
  }> {
    const headers = this.buildScopeHeaders(undefined, mspName || this.config.credentials.mspName);
    const response = await this.request<AvananResponse<T>>({
      ...options,
      headers: { ...headers, ...options.headers },
    });

    return {
      data: response.responseData ?? [],
      scrollId: response.responseEnvelope?.scrollId ?? undefined,
      totalRecords: response.responseEnvelope?.totalRecordsNumber ?? 0,
    };
  }

  // ── Health Check ──

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.getScopes();
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: "Connected to Check Point Harmony Email & Collaboration",
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
