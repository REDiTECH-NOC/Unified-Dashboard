/**
 * Base types for the connector infrastructure.
 * These types are shared across all connectors and the factory.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: HttpMethod;
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip rate limiting (used for health checks) */
  skipRateLimit?: boolean;
  /** Override default timeout in ms */
  timeout?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  /** Opaque cursor for next page (page number, cursor string, etc.) */
  nextCursor?: string | number;
  totalCount?: number;
}

export interface ConnectorConfig {
  toolId: string;
  baseUrl: string;
  /** Parsed from IntegrationConfig.config JSONB */
  credentials: Record<string, string>;
  /** Max requests per rate limit window (default: 60) */
  rateLimitMax?: number;
  /** Rate limit window in ms (default: 60000 = 1 minute) */
  rateLimitWindowMs?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Max retries on transient errors (default: 3) */
  maxRetries?: number;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  message?: string;
}
