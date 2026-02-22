import * as tls from "tls";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, HttpConfig, TlsInfo } from "../types";

function parseStatusRange(expected: string): (code: number) => boolean {
  const ranges = expected.split(",").map((s) => s.trim());
  return (code: number) => {
    return ranges.some((range) => {
      if (range.includes("-")) {
        const [min, max] = range.split("-").map(Number);
        return code >= min && code <= max;
      }
      return code === Number(range);
    });
  };
}

function getTlsInfo(hostname: string, port: number): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.valid_to) {
          socket.destroy();
          resolve(null);
          return;
        }

        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor(
          (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        resolve({
          issuer:
            typeof cert.issuer === "object"
              ? cert.issuer.O || cert.issuer.CN || "Unknown"
              : String(cert.issuer),
          subject:
            typeof cert.subject === "object"
              ? cert.subject.CN || cert.subject.O || "Unknown"
              : String(cert.subject),
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          fingerprint: cert.fingerprint256 || cert.fingerprint || "",
        });
        socket.destroy();
      }
    );

    socket.on("error", () => {
      resolve(null);
    });

    setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, 5000);
  });
}

export class HttpExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as HttpConfig;
    const start = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = { ...c.headers };
      if (c.authType === "basic" && c.authUser) {
        const creds = Buffer.from(`${c.authUser}:${c.authPass || ""}`).toString(
          "base64"
        );
        headers["Authorization"] = `Basic ${creds}`;
      }

      const fetchOptions: RequestInit = {
        method: c.method || "GET",
        headers,
        signal: controller.signal,
        redirect: c.followRedirects === false ? "manual" : "follow",
      };

      if (
        c.body &&
        c.method &&
        !["GET", "HEAD"].includes(c.method.toUpperCase())
      ) {
        fetchOptions.body = c.body;
      }

      // Disable TLS verification if configured
      if (c.ignoreTls) {
        (fetchOptions as Record<string, unknown>).dispatcher = undefined;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      const response = await fetch(c.url, fetchOptions);
      clearTimeout(timeout);

      if (c.ignoreTls) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
      }

      const latencyMs = Math.round(performance.now() - start);

      // Check status code
      const isValidStatus = parseStatusRange(
        c.expectedStatus || "200-299"
      );
      if (!isValidStatus(response.status)) {
        return {
          status: "DOWN",
          latencyMs,
          message: `HTTP ${response.status} ${response.statusText} (expected ${c.expectedStatus || "200-299"})`,
        };
      }

      // Check keyword if configured
      if (c.keyword) {
        const body = await response.text();
        const found = body.includes(c.keyword);
        const shouldFind = !c.invertKeyword;

        if (found !== shouldFind) {
          return {
            status: "DOWN",
            latencyMs,
            message: c.invertKeyword
              ? `Keyword "${c.keyword}" found (should not be present)`
              : `Keyword "${c.keyword}" not found in response`,
          };
        }
      }

      // Get TLS info for HTTPS URLs
      let tlsInfo: TlsInfo | null = null;
      if (c.url.startsWith("https://")) {
        try {
          const urlObj = new URL(c.url);
          tlsInfo = await getTlsInfo(
            urlObj.hostname,
            Number(urlObj.port) || 443
          );
        } catch {
          // TLS info is best-effort, don't fail the check
        }
      }

      return {
        status: "UP",
        latencyMs,
        message: `HTTP ${response.status} ${response.statusText}`,
        tlsInfo,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      if (c.ignoreTls) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
      }

      const err = error as Error;
      if (err.name === "AbortError") {
        return {
          status: "DOWN",
          latencyMs,
          message: `Timeout after ${timeoutMs}ms`,
        };
      }
      return {
        status: "DOWN",
        latencyMs,
        message: err.message || "Unknown error",
      };
    }
  }
}
