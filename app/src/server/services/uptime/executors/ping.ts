import { execFile } from "child_process";
import { platform } from "os";
import * as net from "net";
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

/** Detect if a string is a raw IP address (v4 or v6) */
function isIpAddress(host: string): boolean {
  return net.isIP(host) !== 0;
}

/**
 * TCP connect fallback for environments where ICMP is blocked
 * (e.g. Azure Container Apps which don't grant CAP_NET_RAW).
 * Uses port 53 for IP addresses (DNS), port 80 for hostnames.
 */
function tcpPing(hostname: string, timeoutMs: number): Promise<ExecutorResult> {
  const start = performance.now();
  const port = isIpAddress(hostname) ? 53 : 80;

  return new Promise<ExecutorResult>((resolve) => {
    const socket = new net.Socket();

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({
        status: "DOWN",
        latencyMs: Math.round(performance.now() - start),
        message: `TCP ping to ${hostname}:${port} timeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    socket.connect(port, hostname, () => {
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      socket.destroy();
      resolve({
        status: "UP",
        latencyMs,
        message: `Ping to ${hostname}: ${latencyMs}ms (tcp)`,
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      socket.destroy();
      resolve({
        status: "DOWN",
        latencyMs,
        message: `TCP ping to ${hostname}:${port} failed: ${err.message}`,
      });
    });
  });
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
          // If ping failed due to permission/binary issues (not a network timeout),
          // fall back to TCP connect — works on Azure Container Apps where ICMP is blocked
          const msg = error.message.toLowerCase();
          const isPermissionOrBinaryError =
            msg.includes("permission") ||
            msg.includes("operation not permitted") ||
            msg.includes("enoent") ||
            msg.includes("command failed") ||
            msg.includes("spawn") ||
            msg.includes("not found");

          if (isPermissionOrBinaryError) {
            resolve(tcpPing(c.hostname, timeoutMs));
            return;
          }

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
