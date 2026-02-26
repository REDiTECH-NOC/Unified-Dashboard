/**
 * Avanan (Check Point Harmony Email & Collaboration) HTTP client.
 *
 * Supports two API modes:
 *
 * **MSP SmartAPI** (smart-api-production-*.avanan.net):
 *   Auth: HMAC signature → GET /v1.0/auth → JWT token (1hr)
 *   Every request signed: sha256(base64(reqId + appId + date + path + secret))
 *   Headers: x-av-req-id, x-av-token, x-av-app-id, x-av-date, x-av-sig
 *   Endpoints: scopes, msp/tenants, msp/licenses, msp/addons, msp/users, msp/usage
 *
 * **Harmony Email API** (cloudinfra-gw-*.portal.checkpoint.com):
 *   Auth: POST /auth/external { clientId, accessKey } → Bearer token
 *   Headers: Authorization: Bearer <token>, x-av-req-id
 *   Endpoints: soar/events, soar/entities, actions, exceptions, download
 *
 * MSP mode is auto-detected when credentials include mspName.
 */

import { createHash, randomUUID } from "crypto";
import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult, RequestOptions } from "../_base/types";
import { ConnectorAuthError } from "../_base/errors";
import type {
  AvananResponse,
  AvananAuthResponse,
  AvananScope,
  AvananTaskStatus,
} from "./types";
import { AVANAN_REGIONS, AVANAN_MSP_REGIONS } from "./types";

export class AvananClient extends BaseHttpClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private authBaseUrl: string;
  private isMsp: boolean;

  constructor(config: ConnectorConfig) {
    const region = config.credentials.region || "us";
    const isMsp = !!config.credentials.mspName;

    // MSP mode → SmartAPI endpoints; standard mode → Harmony Email endpoints
    const regionMap = isMsp ? AVANAN_MSP_REGIONS : AVANAN_REGIONS;
    const regionConfig = regionMap[region];

    if (!regionConfig) {
      const validRegions = Object.keys(regionMap).join(", ");
      throw new ConnectorAuthError(
        "avanan",
        `Unknown Avanan region: ${region}. Valid: ${validRegions}`
      );
    }

    const resolved = {
      ...config,
      baseUrl: regionConfig.apiBase,
    };
    super(resolved);

    this.authBaseUrl = regionConfig.authBase;
    this.isMsp = isMsp;
  }

  // ── Authentication ──

  /**
   * SmartAPI HMAC authentication.
   * GET /v1.0/auth with signature headers → raw JWT text (1hr TTL).
   *
   * Signature: sha256(base64(reqId + clientId + date + clientSecret))
   * Note: auth endpoint does NOT include path in the sig.
   */
  private async authenticateSmartApi(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt - 5 * 60_000) {
      return this.accessToken;
    }

    const { clientId, accessKey } = this.config.credentials;

    if (!clientId || !accessKey) {
      throw new ConnectorAuthError(
        "avanan",
        "Missing clientId or accessKey in credentials"
      );
    }

    const reqId = randomUUID();
    const date = new Date().toISOString().split(".")[0]; // No milliseconds
    const sig = this.computeSignature(reqId, date); // No path for auth

    const response = await fetch(`${this.authBaseUrl}/v1.0/auth`, {
      headers: {
        "x-av-req-id": reqId,
        "x-av-token": "",
        "x-av-app-id": clientId,
        "x-av-date": date,
        "x-av-sig": sig,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ConnectorAuthError(
        "avanan",
        `SmartAPI auth failed (HTTP ${response.status}): ${body}`
      );
    }

    // Response body is the raw JWT string
    this.accessToken = (await response.text()).trim();
    this.tokenExpiresAt = now + 3600 * 1000; // 1 hour

    return this.accessToken;
  }

  /**
   * Harmony Email API authentication (standard, non-MSP).
   * POST /auth/external { clientId, accessKey } → Bearer token.
   */
  private async authenticateHarmony(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt - 5 * 60_000) {
      return this.accessToken;
    }

    const { clientId, accessKey } = this.config.credentials;

    if (!clientId || !accessKey) {
      throw new ConnectorAuthError(
        "avanan",
        "Missing clientId or accessKey in credentials"
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

  // ── HMAC Signature ──

  /**
   * Compute HMAC signature for SmartAPI requests.
   *
   * Auth endpoint:     sha256(base64(reqId + clientId + date + secret))
   * All other requests: sha256(base64(reqId + clientId + date + pathWithQuery + secret))
   */
  private computeSignature(reqId: string, date: string, path?: string): string {
    const { clientId, accessKey } = this.config.credentials;
    const parts = path
      ? reqId + clientId + date + path + accessKey
      : reqId + clientId + date + accessKey;
    const b64 = Buffer.from(parts).toString("base64");
    return createHash("sha256").update(b64).digest("hex");
  }

  // ── Request Override ──

  /**
   * Override request() to compute per-request HMAC headers inline.
   *
   * SmartAPI requires the request path in every signature. Since concurrent
   * requests share this client instance (factory cache), we CANNOT use an
   * instance variable to pass the path to getAuthHeaders() — that races.
   * Instead, we compute the full auth headers here and pass them via
   * options.headers so they override the (empty) base getAuthHeaders().
   */
  protected override async request<T>(options: RequestOptions): Promise<T> {
    if (this.isMsp) {
      // Build the full path with query params — must match what BaseHttpClient.buildUrl() produces
      const base = this.config.baseUrl.replace(/\/$/, "");
      const cleanPath = options.path.startsWith("/") ? options.path : `/${options.path}`;
      const url = new URL(`${base}${cleanPath}`);

      if (options.params) {
        for (const [key, value] of Object.entries(options.params)) {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        }
      }

      const requestPath = url.pathname + url.search;

      // Compute per-request auth headers with correct path in signature
      const token = await this.authenticateSmartApi();
      const reqId = randomUUID();
      const date = new Date().toISOString().split(".")[0];
      const sig = this.computeSignature(reqId, date, requestPath);

      const mspHeaders = {
        "x-av-req-id": reqId,
        "x-av-token": token,
        "x-av-app-id": this.config.credentials.clientId,
        "x-av-date": date,
        "x-av-sig": sig,
        Accept: "application/json",
      };

      // Merge into options.headers so they override getAuthHeaders() output
      return super.request<T>({
        ...options,
        headers: { ...mspHeaders, ...options.headers },
      });
    }

    return super.request<T>(options);
  }

  /**
   * Provide authentication headers for every request.
   *
   * For MSP mode, per-request HMAC headers are computed in request() override
   * and passed via options.headers — this method returns empty for MSP to avoid
   * overwriting the correct per-request signature.
   *
   * For Harmony Email API: Authorization: Bearer, x-av-req-id
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.isMsp) {
      // MSP auth headers are computed per-request in request() override
      return {};
    }

    // Harmony Email API (non-MSP)
    const token = await this.authenticateHarmony();
    return {
      Authorization: `Bearer ${token}`,
      "x-av-req-id": randomUUID(),
      Accept: "application/json",
    };
  }

  protected override async refreshAuth(): Promise<void> {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    // Token will be re-fetched on next getAuthHeaders() call
  }

  // ── Avanan Response Unwrapping ──

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
      totalRecords: response.responseEnvelope?.totalRecordsNumber ?? response.responseEnvelope?.recordsNumber ?? 0,
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
   * Requires a scope query parameter for multi-tenant apps.
   */
  async getTaskStatus(taskId: number, scope?: string): Promise<AvananTaskStatus> {
    const response = await this.requestRaw<{ responseData: AvananTaskStatus }>({
      path: `/v1.0/task/${taskId}`,
      params: scope ? { scope } : undefined,
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
    scope?: string,
  ): Promise<Buffer> {
    const path = `/v1.0/download/entity/${entityId}`;
    const params = new URLSearchParams({ original: String(original) });
    if (scope) params.set("scope", scope);
    const fullPath = `${path}?${params.toString()}`;

    if (this.isMsp) {
      const token = await this.authenticateSmartApi();
      const reqId = randomUUID();
      const date = new Date().toISOString().split(".")[0];
      const sig = this.computeSignature(reqId, date, fullPath);

      const url = `${this.config.baseUrl}${fullPath}`;
      const response = await fetch(url, {
        headers: {
          "x-av-req-id": reqId,
          "x-av-token": token,
          "x-av-app-id": this.config.credentials.clientId,
          "x-av-date": date,
          "x-av-sig": sig,
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

    // Harmony Email API mode
    const token = await this.authenticateHarmony();
    const url = `${this.config.baseUrl}${fullPath}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-av-req-id": randomUUID(),
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
    const response = await this.requestAvanan<string>({
      path: "/v1.0/scopes",
    });

    // SmartAPI returns flat string array ["mt-prod-3:reditech", ...],
    // Harmony returns objects [{ scope: "..." }, ...].
    // Normalize to AvananScope[].
    return response.data.map((item) => {
      if (typeof item === "string") {
        return { scope: item };
      }
      return item as unknown as AvananScope;
    });
  }

  // ── Health Check ──

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.getScopes();
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: this.isMsp
          ? "Connected to Check Point SmartAPI (MSP)"
          : "Connected to Check Point Harmony Email & Collaboration",
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
