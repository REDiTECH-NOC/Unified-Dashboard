/**
 * Fleet Cache — Redis-backed cache for NinjaOne fleet query data.
 *
 * Caches bulk query results (device health, OS distribution, volumes, etc.)
 * with TTLs tuned to data volatility. NinjaOne rate limits are 10 req / 10 min
 * on query endpoints, so caching is mandatory.
 */

import { redis } from "./redis";

const CACHE_PREFIX = "fleet:ninjaone:";
const META_PREFIX = "fleet:meta:";

export type FleetEndpoint =
  | "device-health"
  | "processors"
  | "volumes"
  | "operating-systems"
  | "computer-systems"
  | "software"
  | "antivirus-status"
  | "antivirus-threats"
  | "os-patch-installs"
  | "backup-jobs";

/** TTLs in seconds, tuned by data volatility */
const CACHE_TTLS: Record<FleetEndpoint, number> = {
  "device-health": 15 * 60,       // 15 min — status changes often
  "antivirus-status": 15 * 60,    // 15 min
  "antivirus-threats": 5 * 60,    // 5 min — security-critical
  "backup-jobs": 15 * 60,         // 15 min
  "volumes": 30 * 60,             // 30 min — disk doesn't change fast
  "os-patch-installs": 30 * 60,   // 30 min
  "operating-systems": 60 * 60,   // 1 hour — static
  "computer-systems": 60 * 60,    // 1 hour — hardware is static
  "processors": 60 * 60,          // 1 hour
  "software": 60 * 60,            // 1 hour
};

/** All fleet endpoints in order of refresh priority (most volatile first) */
export const FLEET_ENDPOINTS: FleetEndpoint[] = [
  "antivirus-threats",
  "device-health",
  "antivirus-status",
  "backup-jobs",
  "os-patch-installs",
  "volumes",
  "operating-systems",
  "computer-systems",
  "processors",
  "software",
];

export interface FleetCacheEntry<T = unknown> {
  data: T[];
  cachedAt: number;     // epoch ms
  ageMs: number;        // how old the cache is
  isStale: boolean;     // past TTL
  endpoint: FleetEndpoint;
}

/**
 * Get cached fleet data for an endpoint.
 * Returns null if cache is empty (not just stale).
 */
export async function getFleetData<T = unknown>(
  endpoint: FleetEndpoint
): Promise<FleetCacheEntry<T> | null> {
  const raw = await redis.get(CACHE_PREFIX + endpoint);
  if (!raw) return null;

  const parsed = JSON.parse(raw) as { data: T[]; cachedAt: number };
  const ageMs = Date.now() - parsed.cachedAt;
  const ttlMs = CACHE_TTLS[endpoint] * 1000;

  return {
    data: parsed.data,
    cachedAt: parsed.cachedAt,
    ageMs,
    isStale: ageMs > ttlMs,
    endpoint,
  };
}

/**
 * Store fleet data in Redis with the appropriate TTL.
 * Data is stored with a generous TTL (3x the staleness threshold)
 * so stale data can still be served while refreshing.
 */
export async function setFleetData<T>(
  endpoint: FleetEndpoint,
  data: T[]
): Promise<void> {
  const payload = JSON.stringify({ data, cachedAt: Date.now() });
  // Store for 3x TTL — allows stale-while-revalidate pattern
  const ttl = CACHE_TTLS[endpoint] * 3;
  await redis.set(CACHE_PREFIX + endpoint, payload, "EX", ttl);

  // Update metadata
  await redis.set(META_PREFIX + endpoint + ":lastRefresh", String(Date.now()));
}

/**
 * Invalidate one or all fleet cache keys.
 */
export async function invalidateFleetCache(
  endpoint?: FleetEndpoint
): Promise<void> {
  if (endpoint) {
    await redis.del(CACHE_PREFIX + endpoint);
  } else {
    const keys = FLEET_ENDPOINTS.map((e) => CACHE_PREFIX + e);
    if (keys.length > 0) await redis.del(...keys);
  }
}

/**
 * Get refresh status for all fleet endpoints.
 */
export async function getFleetRefreshStatus(): Promise<
  Array<{
    endpoint: FleetEndpoint;
    lastRefresh: number | null;
    ttlSeconds: number;
    isStale: boolean;
    hasCachedData: boolean;
  }>
> {
  const results = await Promise.all(
    FLEET_ENDPOINTS.map(async (endpoint) => {
      const lastRefreshStr = await redis.get(
        META_PREFIX + endpoint + ":lastRefresh"
      );
      const lastRefresh = lastRefreshStr ? Number(lastRefreshStr) : null;
      const hasCachedData = (await redis.exists(CACHE_PREFIX + endpoint)) === 1;
      const isStale = lastRefresh
        ? Date.now() - lastRefresh > CACHE_TTLS[endpoint] * 1000
        : true;

      return {
        endpoint,
        lastRefresh,
        ttlSeconds: CACHE_TTLS[endpoint],
        isStale,
        hasCachedData,
      };
    })
  );

  return results;
}

/**
 * Check if a fleet refresh is currently in progress (prevents concurrent refreshes).
 */
export async function isFleetRefreshInProgress(): Promise<boolean> {
  return (await redis.exists(META_PREFIX + "refreshing")) === 1;
}

/**
 * Set/clear the refresh-in-progress flag.
 */
export async function setFleetRefreshInProgress(
  inProgress: boolean
): Promise<void> {
  if (inProgress) {
    // Auto-expires after 15 min to prevent deadlocks
    await redis.set(META_PREFIX + "refreshing", "1", "EX", 15 * 60);
  } else {
    await redis.del(META_PREFIX + "refreshing");
  }
}
