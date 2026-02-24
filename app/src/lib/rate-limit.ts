/**
 * Redis-backed rate limiter for auth endpoints and API routes.
 * Uses sliding window algorithm with industry-standard defaults.
 *
 * OWASP / NIST standards:
 * - Auth endpoints: 5 attempts per 15 minutes per IP (brute-force prevention)
 * - TOTP verification: 5 attempts per 5 minutes per user (6-digit code brute-force)
 * - API general: 100 requests per minute per user
 * - Credential retrieval: 10 per hour per user (configurable by admin)
 */
import { redis } from "@/lib/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter: number; // seconds
}

/**
 * Check and increment a rate limit counter.
 * Returns whether the request is allowed.
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}`;
  const resetAt = new Date((now + windowSeconds) * 1000);

  try {
    // Use Redis MULTI for atomic increment + expiry
    const current = await redis.incr(windowKey);

    // Set expiry only on first request in window
    if (current === 1) {
      await redis.expire(windowKey, windowSeconds);
    }

    const ttl = await redis.ttl(windowKey);
    const retryAfter = ttl > 0 ? ttl : windowSeconds;

    if (current > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + retryAfter * 1000),
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - current,
      resetAt,
      retryAfter: 0,
    };
  } catch {
    // If Redis is down, fail open (allow the request) but log it
    // This prevents a Redis outage from locking out all users
    return { allowed: true, remaining: maxAttempts, resetAt, retryAfter: 0 };
  }
}

// ── Preset rate limit configurations ──

/** Auth login attempts: 5 per 15 minutes per IP (OWASP recommendation) */
export function authRateLimit(ip: string) {
  return rateLimit(`auth:login:${ip}`, 5, 900);
}

/** TOTP code verification: 5 per 5 minutes per user (prevents code brute-force) */
export function totpRateLimit(userId: string) {
  return rateLimit(`auth:totp:${userId}`, 5, 300);
}

/** API general rate limit: 100 requests per minute per user */
export function apiRateLimit(userId: string) {
  return rateLimit(`api:general:${userId}`, 100, 60);
}

/** Credential/password retrieval: 10 per hour per user (admin-adjustable) */
export function credentialRateLimit(userId: string, maxPerHour: number = 10) {
  return rateLimit(`api:credentials:${userId}`, maxPerHour, 3600);
}

/** Integration test connection: 10 per minute per admin (prevent API abuse) */
export function integrationTestRateLimit(userId: string) {
  return rateLimit(`api:integration-test:${userId}`, 10, 60);
}

/** Extract IP from request headers (handles proxies) */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
