import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis };

// Use lazyConnect to avoid errors during Next.js build (no Redis available).
// At runtime, we eagerly connect below so the first request doesn't pay the cost.
export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

// Eagerly connect at runtime (not during build) — avoids 100-200ms cold-start hit on Azure
if (typeof globalThis !== "undefined" && process.env.REDIS_URL) {
  redis.connect().catch(() => {});
}

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
