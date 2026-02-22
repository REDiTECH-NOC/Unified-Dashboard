import * as net from "net";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, MysqlConfig } from "../types";

/**
 * MySQL executor — connects to the MySQL port and reads the initial
 * handshake packet. If we receive a valid greeting (protocol v10),
 * the server is healthy. No driver dependency needed.
 */
export class MysqlExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as MysqlConfig;
    const port = c.port || 3306;
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
          message: `MySQL connection timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      socket.connect(port, c.host, () => {
        // Wait for MySQL greeting packet
      });

      socket.once("data", (data) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        // MySQL protocol: first byte after 4-byte header is protocol version
        // Protocol version 10 = MySQL 3.21.0+
        if (data.length > 4) {
          const protocolVersion = data[4];
          // Extract server version string (null-terminated after protocol byte)
          let version = "";
          if (protocolVersion === 10 || protocolVersion === 9) {
            const versionEnd = data.indexOf(0, 5);
            if (versionEnd > 5) {
              version = data.subarray(5, versionEnd).toString("utf8");
            }
          }

          if (protocolVersion === 10 || protocolVersion === 9) {
            done({
              status: "UP",
              latencyMs,
              message: `MySQL server responding${version ? ` (v${version})` : ""}`,
            });
          } else {
            done({
              status: "DOWN",
              latencyMs,
              message: `MySQL unexpected protocol version: ${protocolVersion}`,
            });
          }
        } else {
          done({
            status: "DOWN",
            latencyMs,
            message: "MySQL invalid handshake response",
          });
        }
      });

      socket.on("error", (err) => {
        clearTimeout(timer);
        done({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `MySQL connection failed: ${err.message}`,
        });
      });
    });
  }
}
