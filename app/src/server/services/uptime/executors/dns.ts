import { Resolver } from "dns/promises";
import type { MonitorExecutor } from "./base";
import type { ExecutorResult, DnsConfig } from "../types";

export class DnsExecutor implements MonitorExecutor {
  async execute(
    config: Record<string, unknown>,
    timeoutMs: number
  ): Promise<ExecutorResult> {
    const c = config as unknown as DnsConfig;
    const start = performance.now();

    const resolver = new Resolver();
    resolver.setServers([c.resolveServer || "1.1.1.1"]);

    try {
      const timer = setTimeout(() => {
        resolver.cancel();
      }, timeoutMs);

      let addresses: string[] = [];
      const recordType = c.recordType || "A";

      switch (recordType) {
        case "A":
          addresses = await resolver.resolve4(c.hostname);
          break;
        case "AAAA":
          addresses = await resolver.resolve6(c.hostname);
          break;
        case "CNAME": {
          const cnames = await resolver.resolveCname(c.hostname);
          addresses = cnames;
          break;
        }
        case "MX": {
          const mx = await resolver.resolveMx(c.hostname);
          addresses = mx.map((r) => `${r.priority} ${r.exchange}`);
          break;
        }
        case "NS":
          addresses = await resolver.resolveNs(c.hostname);
          break;
        case "TXT": {
          const txt = await resolver.resolveTxt(c.hostname);
          addresses = txt.map((r) => r.join(""));
          break;
        }
        case "SRV": {
          const srv = await resolver.resolveSrv(c.hostname);
          addresses = srv.map(
            (r) => `${r.priority} ${r.weight} ${r.port} ${r.name}`
          );
          break;
        }
        case "PTR":
          addresses = await resolver.resolvePtr(c.hostname);
          break;
        case "SOA": {
          const soa = await resolver.resolveSoa(c.hostname);
          addresses = [`${soa.nsname} ${soa.hostmaster}`];
          break;
        }
        case "CAA": {
          const caa = await resolver.resolveCaa(c.hostname);
          addresses = caa.map((r) => `${r.critical} ${r.issue || r.iodef || ""}`);
          break;
        }
        default:
          addresses = await resolver.resolve4(c.hostname);
      }

      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);

      // Check expected value if configured
      if (c.expectedValue) {
        const found = addresses.some((addr) =>
          addr.toLowerCase().includes(c.expectedValue!.toLowerCase())
        );
        if (!found) {
          return {
            status: "DOWN",
            latencyMs,
            message: `DNS ${recordType} for ${c.hostname}: expected "${c.expectedValue}" not found in [${addresses.join(", ")}]`,
            dnsResult: { resolvedAddresses: addresses, recordType },
          };
        }
      }

      if (addresses.length === 0) {
        return {
          status: "DOWN",
          latencyMs,
          message: `DNS ${recordType} for ${c.hostname}: no records found`,
          dnsResult: { resolvedAddresses: [], recordType },
        };
      }

      return {
        status: "UP",
        latencyMs,
        message: `DNS ${recordType} for ${c.hostname}: ${addresses.join(", ")}`,
        dnsResult: { resolvedAddresses: addresses, recordType },
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - start);
      const err = error as Error;
      return {
        status: "DOWN",
        latencyMs,
        message: `DNS resolution failed: ${err.message}`,
      };
    }
  }
}
