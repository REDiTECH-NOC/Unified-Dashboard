import * as net from "net";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, TcpConfig } from "../types";

export class TcpExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as TcpConfig;
    const start = performance.now();

    return new Promise<ExecutorResult>((resolve) => {
      const socket = new net.Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `Connection timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(c.port, c.hostname, () => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({
          status: "UP",
          latencyMs,
          message: `TCP connection to ${c.hostname}:${c.port} successful`,
        });
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);
        socket.destroy();
        resolve({
          status: "DOWN",
          latencyMs,
          message: `TCP connection failed: ${err.message}`,
        });
      });
    });
  }
}
