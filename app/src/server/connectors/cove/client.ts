/**
 * Cove Data Protection JSON-RPC client.
 *
 * Does NOT extend BaseHttpClient — Cove uses JSON-RPC 2.0 (single POST endpoint)
 * with a stateful visa token chain, fundamentally different from REST.
 *
 * Auth flow:
 * 1. Login(partner, username, password) → visa token
 * 2. Every subsequent call includes visa in body
 * 3. Every response returns a NEW visa (15-min expiry)
 * 4. Must use latest visa — old visas are invalidated
 *
 * Visa stored in Redis with 14-min TTL. Requests serialized via lock
 * to prevent visa chain conflicts from concurrent calls.
 */

import { redis } from "@/lib/redis";
import { ConnectorError, ConnectorAuthError } from "../_base/errors";
import { RateLimiter } from "../_base/rate-limiter";
import { retryWithBackoff } from "../_base/retry";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  CoveJsonRpcRequest,
  CoveJsonRpcResponse,
  CoveLoginResult,
  StorageNodeJsonRpcRequest,
  StorageNodeJsonRpcResponse,
} from "./types";

const API_URL = "https://api.backup.management/jsonapi";
const VISA_TTL_SECONDS = 840; // 14 minutes (1-min buffer below 15-min expiry)
const LOCK_TTL_MS = 10_000;
const LOCK_RETRY_DELAY_MS = 100;
const LOCK_MAX_WAIT_MS = 15_000;

export class CoveClient {
  private config: ConnectorConfig;
  private rateLimiter: RateLimiter;
  private visaKey: string;
  private lockKey: string;
  private partnerIdKey: string;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter({
      toolId: config.toolId,
      maxRequests: config.rateLimitMax ?? 30,
      windowMs: config.rateLimitWindowMs ?? 60_000,
    });
    this.visaKey = `cove:visa:${config.toolId}`;
    this.lockKey = `cove:visa:lock:${config.toolId}`;
    this.partnerIdKey = `cove:partnerid:${config.toolId}`;
  }

  /**
   * Execute a Cove JSON-RPC method.
   * Automatically handles visa management, rate limiting, and retries.
   */
  async call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    await this.rateLimiter.acquire();

    return retryWithBackoff(
      () => this.serializedCall<T>(method, params),
      {
        maxRetries: 3,
        shouldRetry: (error) => {
          if (error instanceof ConnectorAuthError) return true;
          if (error instanceof ConnectorError) {
            return [500, 502, 503, 504].includes(error.statusCode ?? 0);
          }
          return false;
        },
        onRetry: async (_attempt, error) => {
          if (error instanceof ConnectorAuthError) {
            await redis.del(this.visaKey);
          }
        },
      }
    );
  }

  /**
   * Execute multiple calls under a single lock acquisition.
   * Avoids 2N Redis round-trips for lock acquire/release per call.
   * Individual failures return null without breaking the batch.
   */
  async callBatch<T>(
    calls: Array<{ method: string; params?: Record<string, unknown> }>,
  ): Promise<Array<T | null>> {
    if (calls.length === 0) return [];
    if (calls.length === 1) {
      const result = await this.call<T>(calls[0].method, calls[0].params);
      return [result];
    }

    await this.rateLimiter.acquire();

    // Extended lock TTL: ~1s per call + 10s buffer
    const batchLockTtl = calls.length * 1000 + 10_000;
    await this.acquireLockWithTtl(batchLockTtl);
    try {
      const results: Array<T | null> = [];
      for (const { method, params } of calls) {
        try {
          results.push(await this.executeCall<T>(method, params));
        } catch (err) {
          if (err instanceof ConnectorAuthError) {
            // Visa died mid-batch — clear and retry this one call
            await redis.del(this.visaKey);
            try {
              results.push(await this.executeCall<T>(method, params));
            } catch {
              results.push(null);
            }
          } else {
            results.push(null);
          }
        }
      }
      return results;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Serialize calls through a Redis lock to prevent visa chain conflicts.
   * Only one call at a time can use/update the visa.
   */
  private async serializedCall<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    // Login doesn't need serialization or a visa
    if (method === "Login") {
      return this.executeCall<T>(method, params);
    }

    await this.acquireLock();
    try {
      return await this.executeCall<T>(method, params);
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Execute a single JSON-RPC call.
   */
  private async executeCall<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const visa = method === "Login" ? undefined : await this.getOrRefreshVisa();

    const body: CoveJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "jsonrpc",
      method,
      ...(visa && { visa }),
      ...(params && { params }),
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new ConnectorError(
        "cove",
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const json = (await response.json()) as CoveJsonRpcResponse<T>;

    // Update visa chain — every response returns a new visa
    if (json.visa) {
      await redis.set(this.visaKey, json.visa, "EX", VISA_TTL_SECONDS);
    }

    // Handle JSON-RPC errors
    if (json.error) {
      console.error(`[Cove] ${method} JSON-RPC error:`, json.error);
      // -32001 or -32002 typically mean invalid/expired visa
      if (json.error.code === -32001 || json.error.code === -32002) {
        throw new ConnectorAuthError(
          "cove",
          `Visa expired or invalid: ${json.error.message}`
        );
      }
      throw new ConnectorError(
        "cove",
        `JSON-RPC error ${json.error.code}: ${json.error.message}`
      );
    }

    if (json.result === undefined || json.result === null) {
      throw new ConnectorError("cove", `No result in response for method ${method}`);
    }

    return json.result;
  }

  /**
   * Get current visa from Redis, or login to get a fresh one.
   */
  private async getOrRefreshVisa(): Promise<string> {
    const cached = await redis.get(this.visaKey);
    if (cached) return cached;
    return this.login();
  }

  /**
   * Authenticate with Cove and store the visa in Redis.
   */
  private async login(): Promise<string> {
    const { partner, username, password } = this.config.credentials;

    if (!partner || !username || !password) {
      throw new ConnectorAuthError(
        "cove",
        "Missing Cove credentials (partner, username, password)"
      );
    }

    const body: CoveJsonRpcRequest = {
      jsonrpc: "2.0",
      id: "jsonrpc",
      method: "Login",
      params: { partner, username, password },
    };

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new ConnectorAuthError(
        "cove",
        `Login HTTP ${response.status}: ${response.statusText}`
      );
    }

    const json = (await response.json()) as CoveJsonRpcResponse<{ result: CoveLoginResult }>;

    if (json.error) {
      throw new ConnectorAuthError(
        "cove",
        `Login failed: ${json.error.message}`
      );
    }

    if (!json.visa) {
      throw new ConnectorAuthError("cove", "Login succeeded but no visa returned");
    }

    await redis.set(this.visaKey, json.visa, "EX", VISA_TTL_SECONDS);

    // Cove Login wraps user info in result.result (double nesting)
    const userInfo = json.result?.result;
    if (userInfo?.PartnerId) {
      await redis.set(this.partnerIdKey, String(userInfo.PartnerId), "EX", VISA_TTL_SECONDS);
    }

    return json.visa;
  }

  /**
   * Get the partner ID from the last login.
   * If not cached, triggers a fresh login to obtain it.
   */
  async getPartnerId(): Promise<number> {
    const cached = await redis.get(this.partnerIdKey);
    if (cached) return Number(cached);

    // Force a fresh login to get the partner ID
    await redis.del(this.visaKey);
    await this.login();

    const id = await redis.get(this.partnerIdKey);
    if (!id) {
      throw new ConnectorAuthError("cove", "Login did not return a PartnerId");
    }
    return Number(id);
  }

  // ─── DRaaS REST API Calls ──────────────────────────────────────

  private static readonly DRAAS_BASE = "https://api.backup.management/draas/actual-statistics/v1";

  /**
   * Make a GET request to the Cove DRaaS REST API.
   * Auth: passes the current visa as Authorization Bearer header.
   */
  async draasGet<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    await this.rateLimiter.acquire();
    const visa = await this.getOrRefreshVisa();

    const url = new URL(`${CoveClient.DRAAS_BASE}${path}`);
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        url.searchParams.set(k, v);
      }
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${visa}`,
      },
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new ConnectorError(
        "cove",
        `DRaaS GET ${path} HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Make a POST request to the Cove DRaaS REST API.
   */
  async draasPost<T>(path: string, body: unknown): Promise<T> {
    await this.rateLimiter.acquire();
    const visa = await this.getOrRefreshVisa();

    const url = `${CoveClient.DRAAS_BASE}${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${visa}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new ConnectorError(
        "cove",
        `DRaaS POST ${path} HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  // ─── Storage Node Calls ────────────────────────────────────────

  /**
   * Execute a JSON-RPC call against a Cove storage node.
   *
   * Storage nodes use a different URL but still need the current visa.
   * The device-specific auth token goes in params, visa goes at body level.
   * No lock serialization needed since the storage node doesn't rotate visas.
   */
  async callStorageNode<T>(
    storageNodeUrl: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    // Storage node requests need the current visa at body level
    const visa = await this.getOrRefreshVisa();

    const body = {
      jsonrpc: "2.0" as const,
      id: "jsonrpc",
      method,
      params,
      visa,
    };

    const url = `${storageNodeUrl}/repserv_json`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    });

    if (!response.ok) {
      throw new ConnectorError(
        "cove",
        `Storage node HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    const json = (await response.json()) as StorageNodeJsonRpcResponse<T>;

    // Storage node may return a refreshed visa — save it to keep the chain alive
    if (json.visa) {
      await redis.set(this.visaKey, json.visa, "EX", VISA_TTL_SECONDS);
    }

    if (json.error) {
      console.error(`[Cove] Storage node ${method} error:`, json.error);
      throw new ConnectorError(
        "cove",
        `Storage node error ${json.error.code}: ${json.error.message}`
      );
    }

    if (json.result === undefined || json.result === null) {
      throw new ConnectorError("cove", `No result from storage node ${method}`);
    }

    return json.result;
  }

  // ─── Lock Management ──────────────────────────────────────────

  private async acquireLock(): Promise<void> {
    return this.acquireLockWithTtl(LOCK_TTL_MS);
  }

  private async acquireLockWithTtl(ttlMs: number): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < LOCK_MAX_WAIT_MS) {
      const acquired = await redis.set(
        this.lockKey,
        "1",
        "PX",
        ttlMs,
        "NX"
      );
      if (acquired === "OK") return;
      await new Promise((r) => setTimeout(r, LOCK_RETRY_DELAY_MS));
    }
    // Timeout — force-acquire (stale lock cleanup)
    await redis.set(this.lockKey, "1", "PX", ttlMs);
  }

  private async releaseLock(): Promise<void> {
    await redis.del(this.lockKey);
  }

  // ─── Health Check ─────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      // Attempt login to validate credentials
      await redis.del(this.visaKey); // Force fresh login
      await this.login();
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
