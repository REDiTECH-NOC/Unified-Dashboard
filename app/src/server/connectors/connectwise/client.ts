/**
 * ConnectWise Manage HTTP client.
 *
 * Auth: Basic Auth with base64(companyId+publicKey:privateKey)
 * Also requires a clientId header for API member identification.
 * Rate limit: 60 requests/minute.
 * Docs: https://developer.connectwise.com/
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { CWSystemInfo } from "./types";

export class ConnectWiseClient extends BaseHttpClient {
  private authToken: string;

  constructor(config: ConnectorConfig) {
    super({
      ...config,
      rateLimitMax: config.rateLimitMax ?? 55, // Stay under 60/min limit
      rateLimitWindowMs: config.rateLimitWindowMs ?? 60_000,
    });

    const { companyId, publicKey, privateKey } = config.credentials;
    this.authToken = Buffer.from(
      `${companyId}+${publicKey}:${privateKey}`
    ).toString("base64");
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Basic ${this.authToken}`,
      clientId: this.config.credentials.clientId ?? "",
    };
  }

  /**
   * Build CEQL conditions string from a filter object.
   * ConnectWise uses conditions like: status/name="Open" AND priority/name="High"
   */
  buildConditions(
    filters: Record<string, { value: string | number | boolean; op?: string } | undefined>
  ): string | undefined {
    const parts: string[] = [];
    for (const [field, filter] of Object.entries(filters)) {
      if (!filter) continue;
      const { value, op = "=" } = filter;
      if (typeof value === "string") {
        if (op === "like") {
          parts.push(`${field} like "%${value}%"`);
        } else {
          parts.push(`${field}${op}"${value}"`);
        }
      } else {
        parts.push(`${field}${op}${value}`);
      }
    }
    return parts.length > 0 ? parts.join(" AND ") : undefined;
  }

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const info = await this.request<CWSystemInfo>({
        path: "/system/info",
        skipRateLimit: true,
      });
      return {
        ok: true,
        latencyMs: Date.now() - start,
        message: `ConnectWise v${info.version}`,
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
