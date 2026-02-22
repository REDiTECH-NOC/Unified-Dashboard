import type { MonitorExecutor } from "./base";
import type { ExecutorResult, DockerConfig } from "../types";

/**
 * Docker executor — queries the Docker Engine API to check
 * container status. Works with both TCP and Unix socket hosts.
 */
export class DockerExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as DockerConfig;
    const start = performance.now();

    try {
      // Docker API: GET /containers/{id}/json
      const host = c.dockerHost || "http://localhost:2375";
      const url = `${host}/containers/${encodeURIComponent(c.containerId)}/json`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        return {
          status: "DOWN",
          latencyMs,
          message: `Docker API error: HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        State?: { Status?: string; Running?: boolean; Health?: { Status?: string } };
        Name?: string;
      };

      const running = data.State?.Running === true;
      const healthStatus = data.State?.Health?.Status;
      const containerName = data.Name?.replace(/^\//, "") || c.containerId;

      if (!running) {
        return {
          status: "DOWN",
          latencyMs,
          message: `Container "${containerName}" is ${data.State?.Status || "not running"}`,
        };
      }

      // If container has a health check, use it
      if (healthStatus && healthStatus !== "healthy") {
        return {
          status: "DOWN",
          latencyMs,
          message: `Container "${containerName}" running but health: ${healthStatus}`,
        };
      }

      return {
        status: "UP",
        latencyMs,
        message: `Container "${containerName}" running${healthStatus ? ` (${healthStatus})` : ""}`,
      };
    } catch (error) {
      return {
        status: "DOWN",
        latencyMs: Math.round(performance.now() - start),
        message: `Docker check failed: ${(error as Error).message}`,
      };
    }
  }
}
