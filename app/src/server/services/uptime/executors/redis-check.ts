import type { MonitorExecutor } from "./base";
import type { ExecutorResult, RedisConfig } from "../types";

export class RedisExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as RedisConfig;
    const start = performance.now();

    try {
      const Redis = (await import("ioredis")).default;
      const client = new Redis(c.connectionString, {
        connectTimeout: timeoutMs,
        commandTimeout: timeoutMs,
        lazyConnect: true,
        tls: c.connectionString.startsWith("rediss://")
          ? { rejectUnauthorized: !c.ignoreTls }
          : undefined,
      });

      await client.connect();
      const pong = await client.ping();
      const latencyMs = Math.round(performance.now() - start);
      const info = await client.info("server");
      const versionMatch = info.match(/redis_version:(\S+)/);
      await client.quit();

      return {
        status: pong === "PONG" ? "UP" : "DOWN",
        latencyMs,
        message: `Redis ${pong === "PONG" ? "OK" : "unexpected response"}${versionMatch ? ` (v${versionMatch[1]})` : ""}`,
      };
    } catch (error) {
      return {
        status: "DOWN",
        latencyMs: Math.round(performance.now() - start),
        message: `Redis connection failed: ${(error as Error).message}`,
      };
    }
  }
}
