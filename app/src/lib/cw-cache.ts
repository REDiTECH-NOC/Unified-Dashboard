/**
 * CW Cache — Redis-backed cache for ConnectWise PSA API responses.
 *
 * Caches ticket lists, boards, statuses, and members with TTLs tuned
 * to data volatility. Makes CW feel fast even when the API is slow.
 */

import { redis } from "./redis";
import { createHash } from "crypto";

const PREFIX = "cw:psa:";

export type CwCacheEndpoint =
  | "tickets"
  | "ticket-notes"
  | "boards"
  | "board-statuses"
  | "members"
  | "workTypes";

/** TTLs in seconds — shorter for volatile data, longer for static */
const CACHE_TTLS: Record<CwCacheEndpoint, number> = {
  tickets: 30,              // 30s — users need near-real-time
  "ticket-notes": 30,       // 30s — notes change when techs work tickets
  boards: 5 * 60,           // 5 min — boards rarely change
  "board-statuses": 5 * 60, // 5 min — statuses rarely change
  members: 5 * 60,          // 5 min — team list is stable
  workTypes: 60 * 60,       // 1 hour — work types rarely change
};

/** Build a short hash from params for cache keys */
function hashParams(params?: unknown): string {
  if (!params) return "_";
  const str = JSON.stringify(params);
  return createHash("md5").update(str).digest("hex").slice(0, 12);
}

/** Build the full Redis key */
function cacheKey(endpoint: CwCacheEndpoint, params?: unknown): string {
  return `${PREFIX}${endpoint}:${hashParams(params)}`;
}

/**
 * Get cached data. Returns null if not cached.
 */
export async function getCwCache<T = unknown>(
  endpoint: CwCacheEndpoint,
  params?: unknown
): Promise<T | null> {
  try {
    const raw = await redis.get(cacheKey(endpoint, params));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Store data in cache with the endpoint's TTL.
 */
export async function setCwCache(
  endpoint: CwCacheEndpoint,
  params: unknown,
  data: unknown
): Promise<void> {
  try {
    const key = cacheKey(endpoint, params);
    const ttl = CACHE_TTLS[endpoint];
    await redis.set(key, JSON.stringify(data), "EX", ttl);
  } catch {
    // Cache write failure is non-fatal — just means next request hits API
  }
}

/**
 * Invalidate all ticket-related caches (after create/update/note/time).
 * Uses SCAN to find matching keys without blocking Redis.
 */
export async function invalidateCwTicketCaches(): Promise<void> {
  try {
    const patterns = [`${PREFIX}tickets:*`, `${PREFIX}ticket-notes:*`];
    for (const pattern of patterns) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== "0");
    }
  } catch {
    // Non-fatal
  }
}
