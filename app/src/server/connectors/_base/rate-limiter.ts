/**
 * Redis-backed sliding window rate limiter.
 * Uses a sorted set with timestamps as scores to implement a sliding window.
 * Shared across container replicas via Redis.
 *
 * When the limit is reached, acquire() waits for a slot instead of throwing,
 * so long-running syncs naturally pace themselves under the API rate limit.
 */

import { redis } from "@/lib/redis";
import { ConnectorRateLimitError } from "./errors";

interface RateLimiterConfig {
  toolId: string;
  maxRequests: number;
  windowMs: number;
  /** Max time (ms) to wait for a slot before throwing. Default: 2 minutes. */
  maxWaitMs?: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Acquire a rate limit slot. Waits for a slot to open if the limit is
   * currently reached, up to maxWaitMs. Throws only if the wait times out.
   */
  async acquire(): Promise<void> {
    const key = `ratelimit:connector:${this.config.toolId}`;
    const maxWait = this.config.maxWaitMs ?? 120_000;
    const deadline = Date.now() + maxWait;

    while (true) {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      // Atomic pipeline: clean expired, count current
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zcard(key);
      const results = await pipeline.exec();

      const currentCount = (results?.[1]?.[1] as number) ?? 0;

      if (currentCount < this.config.maxRequests) {
        // Slot available — claim it
        const entryId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
        await redis
          .pipeline()
          .zadd(key, now.toString(), entryId)
          .pexpire(key, this.config.windowMs)
          .exec();
        return;
      }

      // No slot available — check if we can still wait
      if (Date.now() >= deadline) {
        throw new ConnectorRateLimitError(this.config.toolId, this.config.windowMs);
      }

      // Wait 1-1.2s before checking again (jitter avoids thundering herd)
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 200));
    }
  }
}
