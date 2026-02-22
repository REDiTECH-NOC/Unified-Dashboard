/**
 * Redis-backed sliding window rate limiter.
 * Uses a sorted set with timestamps as scores to implement a sliding window.
 * Shared across container replicas via Redis.
 */

import { redis } from "@/lib/redis";
import { ConnectorRateLimitError } from "./errors";

interface RateLimiterConfig {
  toolId: string;
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Acquire a rate limit slot. Throws ConnectorRateLimitError if limit exceeded.
   */
  async acquire(): Promise<void> {
    const key = `ratelimit:connector:${this.config.toolId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Atomic pipeline: clean expired, count current, add new entry
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    const results = await pipeline.exec();

    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= this.config.maxRequests) {
      throw new ConnectorRateLimitError(this.config.toolId, this.config.windowMs);
    }

    // Add new entry and set expiry
    const entryId = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    await redis
      .pipeline()
      .zadd(key, now.toString(), entryId)
      .pexpire(key, this.config.windowMs)
      .exec();
  }
}
