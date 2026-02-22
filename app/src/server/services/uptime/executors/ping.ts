import { execFile } from "child_process";
import { platform } from "os";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, PingConfig } from "../types";

function parsePingOutput(stdout: string): number | null {
  // Linux/macOS: rtt min/avg/max/mdev = 1.234/5.678/9.012/1.234 ms
  const rttMatch = stdout.match(
    /(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*[\d.]+\/([\d.]+)/
  );
  if (rttMatch) return Math.round(parseFloat(rttMatch[1]));

  // Windows: Average = 5ms
  const winMatch = stdout.match(/Average\s*=\s*(\d+)\s*ms/i);
  if (winMatch) return parseInt(winMatch[1], 10);

  // Fallback: time=X.XX ms
  const timeMatch = stdout.match(/time[=<]\s*([\d.]+)\s*ms/);
  if (timeMatch) return Math.round(parseFloat(timeMatch[1]));

  return null;
}

export class PingExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as PingConfig;
    const start = performance.now();
    const isWindows = platform() === "win32";

    const args: string[] = [];

    // Count flag
    args.push(isWindows ? "-n" : "-c", "1");

    // Timeout flag (seconds for Linux/macOS, milliseconds for Windows)
    if (isWindows) {
      args.push("-w", String(timeoutMs));
    } else {
      args.push("-W", String(Math.ceil(timeoutMs / 1000)));
    }

    // Packet size
    if (c.packetSize && c.packetSize !== 56) {
      args.push(isWindows ? "-l" : "-s", String(c.packetSize));
    }

    args.push(c.hostname);

    return new Promise<ExecutorResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          status: "DOWN",
          latencyMs: Math.round(performance.now() - start),
          message: `Ping timeout after ${timeoutMs}ms`,
        });
      }, timeoutMs + 2000); // Extra buffer for process overhead

      execFile("ping", args, { timeout: timeoutMs + 2000 }, (error, stdout) => {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);

        if (error) {
          resolve({
            status: "DOWN",
            latencyMs,
            message: `Ping to ${c.hostname} failed: ${error.message}`,
          });
          return;
        }

        const rtt = parsePingOutput(stdout);
        resolve({
          status: "UP",
          latencyMs: rtt ?? latencyMs,
          message: `Ping to ${c.hostname}: ${rtt !== null ? `${rtt}ms` : "success"}`,
        });
      });
    });
  }
}
