/**
 * In-memory stale-while-revalidate cache for tRPC queries.
 *
 * Returns cached data instantly on repeat requests.
 * Triggers a non-blocking background refresh when data is older than `staleMs`.
 * First request (cold cache) fetches synchronously.
 *
 * Cache Map type is `unknown` — the generic `T` is inferred from `fetchFn` only,
 * ensuring tRPC procedure return types stay properly typed.
 */
export type QueryCacheMap = Map<string, { data: unknown; at: number }>;

export function cachedQuery<T>(
  cache: QueryCacheMap,
  bg: Set<string>,
  staleMs: number,
  key: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached) {
    if (Date.now() - cached.at > staleMs && !bg.has(key)) {
      bg.add(key);
      fetchFn()
        .then((d) => cache.set(key, { data: d, at: Date.now() }))
        .catch(() => {})
        .finally(() => bg.delete(key));
    }
    return Promise.resolve(cached.data as T);
  }
  return fetchFn().then((data) => {
    cache.set(key, { data, at: Date.now() });
    return data;
  });
}
