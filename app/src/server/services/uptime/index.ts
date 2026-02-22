import { UptimeScheduler } from "./scheduler";

const globalForUptime = globalThis as unknown as {
  __uptimeEngine?: UptimeScheduler;
};

export function getUptimeEngine(): UptimeScheduler {
  if (!globalForUptime.__uptimeEngine) {
    globalForUptime.__uptimeEngine = new UptimeScheduler();
  }
  return globalForUptime.__uptimeEngine;
}

export { UptimeScheduler } from "./scheduler";
export type {
  ExecutorResult,
  TlsInfo,
  DnsResult,
  HttpConfig,
  TcpConfig,
  PingConfig,
  DnsConfig,
  MonitorConfig,
} from "./types";
