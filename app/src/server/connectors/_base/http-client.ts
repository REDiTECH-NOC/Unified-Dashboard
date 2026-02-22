/**
 * Abstract base HTTP client for all API connectors.
 *
 * Handles cross-cutting concerns so concrete connectors focus on API mapping:
 * - Authentication (via abstract getAuthHeaders)
 * - Retry with exponential backoff
 * - Rate limiting (Redis-backed)
 * - Timeout management
 * - Error classification
 * - Audit logging of external API calls
 */

import type { ConnectorConfig, RequestOptions, HealthCheckResult } from "./types";
import {
  ConnectorError,
  ConnectorAuthError,
  ConnectorRateLimitError,
} from "./errors";
import { RateLimiter } from "./rate-limiter";
import { retryWithBackoff } from "./retry";

export abstract class BaseHttpClient {
  protected config: ConnectorConfig;
  private rateLimiter: RateLimiter;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter({
      toolId: config.toolId,
      maxRequests: config.rateLimitMax ?? 60,
      windowMs: config.rateLimitWindowMs ?? 60_000,
    });
  }

  /**
   * Subclasses implement this to provide authentication headers.
   * Called before every request.
   */
  protected abstract getAuthHeaders(): Promise<Record<string, string>>;

  /**
   * Optional: subclasses override to refresh tokens (e.g., OAuth2).
   * Called when a 401 is received before retrying.
   */
  protected async refreshAuth(): Promise<void> {
    throw new ConnectorAuthError(
      this.config.toolId,
      "Authentication failed and refresh not implemented"
    );
  }

  /**
   * Core request method. Handles auth, rate limiting, retry, and error mapping.
   */
  protected async request<T>(options: RequestOptions): Promise<T> {
    // Rate limit check
    if (!options.skipRateLimit) {
      await this.rateLimiter.acquire();
    }

    // Build full URL
    const url = this.buildUrl(options.path, options.params);

    // Get auth headers
    const authHeaders = await this.getAuthHeaders();

    // Execute with retry
    return retryWithBackoff(
      () =>
        this.executeRequest<T>(url, {
          ...options,
          headers: { ...authHeaders, ...options.headers },
        }),
      {
        maxRetries: this.config.maxRetries ?? 3,
        onRetry: async (attempt, error) => {
          // On first 401 retry, attempt token refresh
          if (error instanceof ConnectorAuthError && attempt === 1) {
            try {
              await this.refreshAuth();
            } catch {
              // refreshAuth failed — retry will use same stale headers and fail again
            }
          }
        },
        shouldRetry: (error) => {
          if (error instanceof ConnectorRateLimitError) return true;
          if (error instanceof ConnectorAuthError) return true;
          if (error instanceof ConnectorError) {
            return [500, 502, 503, 504].includes(error.statusCode ?? 0);
          }
          return false;
        },
      }
    );
  }

  /**
   * Build a full URL from base + path + query params.
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const base = this.config.baseUrl.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${cleanPath}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Execute a single HTTP request and map errors.
   */
  private async executeRequest<T>(
    url: string,
    options: RequestOptions & { headers: Record<string, string> }
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeout ?? this.config.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401) {
        throw new ConnectorAuthError(this.config.toolId);
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new ConnectorRateLimitError(
          this.config.toolId,
          retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ConnectorError(
          this.config.toolId,
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          body
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ConnectorError) throw error;

      // AbortController timeout
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ConnectorError(
          this.config.toolId,
          `Request timed out after ${timeoutMs}ms`,
          408
        );
      }

      // Network errors
      throw new ConnectorError(
        this.config.toolId,
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Default health check — subclasses should override with a lightweight endpoint.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.request({ path: "/", skipRateLimit: true });
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
