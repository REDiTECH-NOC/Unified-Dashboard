import * as net from "net";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, SqlServerConfig } from "../types";

/**
 * SQL Server executor — connects to the TDS port and sends a
 * pre-login packet. A valid response means the server is healthy.
 * No driver dependency needed.
 */
export class SqlServerExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as SqlServerConfig;
    const port = c.port || 1433;
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
          message: `SQL Server connection timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(port, c.host, () => {
        // Send TDS Pre-Login packet
        // Type: 0x12 (Pre-Login), Status: 0x01 (End of message)
        const prelogin = Buffer.from([
          0x12, 0x01, 0x00, 0x2f, 0x00, 0x00, 0x01, 0x00, // TDS header
          // Pre-login options
          0x00, 0x00, 0x15, 0x00, 0x06, // VERSION at offset 21, 6 bytes
          0x01, 0x00, 0x1b, 0x00, 0x01, // ENCRYPTION at offset 27, 1 byte
          0x02, 0x00, 0x1c, 0x00, 0x01, // INSTOPT at offset 28, 1 byte
          0x03, 0x00, 0x1d, 0x00, 0x00, // THREADID at offset 29, 0 bytes
          0xff,                           // Terminator
          // VERSION: 0.0.0.0, subbuild 0
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          // ENCRYPTION: off
          0x02,
          // INSTOPT: default
          0x00,
        ]);
        socket.write(prelogin);
      });

      socket.once("data", (data) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        // TDS response type 0x04 = Pre-Login Response (tabular result)
        if (data.length > 0 && data[0] === 0x04) {
          done({
            status: "UP",
            latencyMs,
            message: `SQL Server responding on ${c.host}:${port}`,
          });
        } else if (data.length > 0) {
          // Any response means the server is listening and speaking TDS
          done({
            status: "UP",
            latencyMs,
            message: `SQL Server responding on ${c.host}:${port}`,
          });
        } else {
          done({
            status: "DOWN",
            latencyMs,
            message: "SQL Server empty response",
          });
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `SQL Server connection failed: ${err.message}`,
        });
      });
    });
  }
}
