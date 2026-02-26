/**
 * Redis-backed stale-while-revalidate cache for tRPC queries.
 *
 * Data survives container restarts (persisted in Redis).
 * Returns cached data instantly on repeat requests.
 * Triggers a non-blocking background refresh when data is older than `staleMs`.
 * First request with empty Redis cache fetches synchronously.
 *
 * Redis key format: `qc:{prefix}:{key}`
 * Redis value: JSON envelope `{ d: <data>, t: <epoch ms> }`
 * TTL: 24 hours (auto-expires truly old data)
 */
import { redis } from "@/lib/redis";

/** Track in-flight background refreshes (in-memory, no need to persist) */
const _bg = new Set<string>();

/** Redis TTL for cached entries — 24 hours */
const REDIS_TTL = 86_400;

/**
 * Fetch data with Redis-backed stale-while-revalidate caching.
 *
 * @param prefix  Namespace prefix (e.g. "edr", "bp", "rmm")
 * @param staleMs Staleness threshold in ms — triggers background refresh
 * @param key     Cache key (unique within the prefix)
 * @param fetchFn Async function that fetches fresh data
 * @returns       Cached or fresh data, typed as T (inferred from fetchFn)
 */
export async function cachedQuery<T>(
  prefix: string,
  staleMs: number,
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const redisKey = `qc:${prefix}:${key}`;

  // ── Try Redis cache first ──
  try {
    const raw = await redis.get(redisKey);
    if (raw) {
      const envelope = JSON.parse(raw) as { d: unknown; t: number };

      // If stale, trigger background refresh (non-blocking)
      if (Date.now() - envelope.t > staleMs && !_bg.has(redisKey)) {
        _bg.add(redisKey);
        fetchFn()
          .then((freshData) => {
            const payload = JSON.stringify({ d: freshData, t: Date.now() });
            return redis.set(redisKey, payload, "EX", REDIS_TTL);
          })
          .catch((err) => {
            console.error(`[query-cache] bg refresh error for ${redisKey}:`, err instanceof Error ? err.message : err);
          })
          .finally(() => _bg.delete(redisKey));
      }

      return envelope.d as T;
    }
  } catch (err) {
    // Redis read failure — fall through to live fetch
    console.error(`[query-cache] Redis read error for ${redisKey}:`, err instanceof Error ? err.message : err);
  }

  // ── Cold cache — fetch synchronously ──
  const data = await fetchFn();

  // Write to Redis (non-blocking — don't let Redis failure break the response)
  try {
    const payload = JSON.stringify({ d: data, t: Date.now() });
    await redis.set(redisKey, payload, "EX", REDIS_TTL);
  } catch (err) {
    console.error(`[query-cache] Redis write error for ${redisKey}:`, err instanceof Error ? err.message : err);
  }

  return data;
}
