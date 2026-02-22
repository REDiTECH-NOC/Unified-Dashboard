import * as net from "net";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, PostgresqlConfig } from "../types";

/**
 * PostgreSQL executor — connects and sends a StartupMessage.
 * If we get an authentication response back, the server is healthy.
 * No driver dependency needed.
 */
export class PostgresqlExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as PostgresqlConfig;
    const port = c.port || 5432;
    const start = performance.now();

    return new Promise<ExecutorResult>((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const done = (result: ExecutorResult) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve(result);
      };

      const timer = setTimeout(() => {
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `PostgreSQL connection timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(port, c.host, () => {
        // Send StartupMessage (protocol 3.0)
        const user = c.username || "postgres";
        const db = c.database || "postgres";
        const params = `user\0${user}\0database\0${db}\0\0`;
        const len = 4 + 4 + Buffer.byteLength(params); // length + protocol version + params
        const buf = Buffer.alloc(len);
        buf.writeInt32BE(len, 0);
        buf.writeInt32BE(0x00030000, 4); // Protocol 3.0
        buf.write(params, 8);
        socket.write(buf);
      });

      socket.once("data", (data) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        // PostgreSQL responses start with a message type byte:
        // 'R' (0x52) = Authentication request — server is alive
        // 'E' (0x45) = Error — server is alive but rejected us (still UP)
        const msgType = String.fromCharCode(data[0]);

        if (msgType === "R" || msgType === "E") {
          done({
            status: "UP",
            latencyMs,
            message: `PostgreSQL server responding on ${c.host}:${port}`,
          });
        } else {
          done({
            status: "DOWN",
            latencyMs,
            message: `PostgreSQL unexpected response: ${msgType}`,
          });
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `PostgreSQL connection failed: ${err.message}`,
        });
      });
    });
  }
}
