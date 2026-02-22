/**
 * UniFi HTTP client.
 *
 * Supports two API layers through a single API key:
 *
 * 1. Site Manager API (cloud): /ea/* endpoints
 *    - High-level monitoring across all managed sites
 *    - Read-only: hosts, sites, devices (summary), ISP metrics
 *
 * 2. Network Server API (via Cloud Connector): /v1/connector/consoles/{hostId}/proxy/*
 *    - Full management of a specific console/controller
 *    - ~67 endpoints: devices, clients, networks, WiFi, firewall, ACL, DNS, etc.
 *    - Requires console firmware >= 5.0.3
 *
 * Auth: X-API-Key header for all requests.
 * Base URL: https://api.ui.com
 */

import { BaseHttpClient } from "../_base/http-client";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type { UnifiHostResponse } from "./types";

export class UnifiClient extends BaseHttpClient {
  constructor(config: ConnectorConfig) {
    super(config);
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return { "X-API-Key": this.config.credentials.apiKey };
  }

  // ─── Cloud Connector Proxy ─────────────────────────────────────
  // Routes requests through the cloud to a specific console's
  // Network Server API. Same API key, automatic proxying.

  private proxyPath(hostId: string, path: string): string {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `/v1/connector/consoles/${hostId}/proxy/network/integration/v1/${clean}`;
  }

  async proxyGet<T>(
    hostId: string,
    path: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    return this.request<T>({
      path: this.proxyPath(hostId, path),
      params: params as Record<string, string | number | boolean | undefined>,
    });
  }

  async proxyPost<T>(
    hostId: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    return this.request<T>({
      method: "POST",
      path: this.proxyPath(hostId, path),
      body,
    });
  }

  async proxyPut<T>(
    hostId: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    return this.request<T>({
      method: "PUT",
      path: this.proxyPath(hostId, path),
      body,
    });
  }

  async proxyDelete<T = void>(
    hostId: string,
    path: string
  ): Promise<T> {
    return this.request<T>({
      method: "DELETE",
      path: this.proxyPath(hostId, path),
    });
  }

  // ─── Site Manager API (cloud) ──────────────────────────────────
  // Direct cloud API calls for /ea/* endpoints.

  async cloudGet<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    return this.request<T>({ path, params });
  }

  // ─── Health Check ──────────────────────────────────────────────

  override async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.request<UnifiHostResponse>({
        path: "/ea/hosts",
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
