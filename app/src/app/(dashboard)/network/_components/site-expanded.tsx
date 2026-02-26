import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Gauge,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { DeviceRow } from "./device-row";

/* ─── Types ──────────────────────────────────────────────── */

interface NetworkSite {
  siteId: string;
  hostId: string;
  name: string;
}

interface NetworkHost {
  id: string;
  name?: string;
  type?: string;
  firmwareVersion?: string;
}

interface DeviceMeta {
  updateAvailable?: string | null;
  hostId?: string;
  [key: string]: unknown;
}

interface Device {
  sourceId: string;
  hostname: string;
  status: "online" | "offline" | "warning" | "unknown";
  model?: string;
  privateIp?: string;
  macAddress?: string;
  agentVersion?: string;
  metadata?: DeviceMeta;
}

interface Props {
  site: NetworkSite;
  host: NetworkHost | undefined;
  devices: Device[];
}

/* ─── Status sort order ──────────────────────────────────── */

const STATUS_ORDER: Record<string, number> = {
  offline: 0,
  warning: 1,
  unknown: 2,
  online: 3,
};

/* ─── Component ──────────────────────────────────────────── */

export function SiteExpanded({ site, host, devices }: Props) {
  /* ── ISP metrics — lazy loaded on expand ─────────────── */

  const ispQuery = trpc.network.getIspMetrics.useQuery(
    { hostId: site.hostId },
    {
      staleTime: 60_000,
      retry: 1,
    }
  );

  /* ── Sort devices: offline first, then updates, then online ─── */

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => {
      // Primary: status (offline first)
      const sa = STATUS_ORDER[a.status] ?? 2;
      const sb = STATUS_ORDER[b.status] ?? 2;
      if (sa !== sb) return sa - sb;

      // Secondary: has update available first
      const ua = (a.metadata as DeviceMeta | undefined)?.updateAvailable ? 0 : 1;
      const ub = (b.metadata as DeviceMeta | undefined)?.updateAvailable ? 0 : 1;
      if (ua !== ub) return ua - ub;

      // Tertiary: alphabetical
      return a.hostname.localeCompare(b.hostname);
    });
  }, [devices]);

  const offlineCount = devices.filter((d) => d.status === "offline").length;
  const updateCount = devices.filter(
    (d) => !!(d.metadata as DeviceMeta | undefined)?.updateAvailable
  ).length;

  const isp = ispQuery.data;

  return (
    <div className="border-t border-border/50 bg-accent/20 px-6 py-4 space-y-4">
      {/* ISP Metrics Bar */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-4 text-sm">
          {ispQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">Loading ISP metrics...</span>
            </div>
          ) : isp ? (
            <>
              {/* Latency */}
              {isp.latencyMs != null && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={cn(
                      "font-mono text-xs",
                      isp.latencyMs < 30
                        ? "text-green-400"
                        : isp.latencyMs < 80
                          ? "text-yellow-400"
                          : "text-red-400"
                    )}
                  >
                    {Math.round(isp.latencyMs)}ms
                  </span>
                </div>
              )}

              {/* Download */}
              {isp.downloadMbps != null && (
                <div className="flex items-center gap-1.5">
                  <ArrowDown className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-mono text-xs text-foreground">
                    {Math.round(isp.downloadMbps)} Mbps
                  </span>
                </div>
              )}

              {/* Upload */}
              {isp.uploadMbps != null && (
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="font-mono text-xs text-foreground">
                    {Math.round(isp.uploadMbps)} Mbps
                  </span>
                </div>
              )}

              {/* Packet Loss */}
              {isp.packetLossPercent != null && isp.packetLossPercent > 0 && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={cn(
                      "font-mono text-xs",
                      isp.packetLossPercent < 1
                        ? "text-green-400"
                        : isp.packetLossPercent < 5
                          ? "text-yellow-400"
                          : "text-red-400"
                    )}
                  >
                    {isp.packetLossPercent.toFixed(1)}% loss
                  </span>
                </div>
              )}

              {/* Uptime */}
              {isp.uptimePercent != null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Uptime:</span>
                  <span
                    className={cn(
                      "font-mono text-xs",
                      isp.uptimePercent >= 99
                        ? "text-green-400"
                        : isp.uptimePercent >= 95
                          ? "text-yellow-400"
                          : "text-red-400"
                    )}
                  >
                    {isp.uptimePercent.toFixed(1)}%
                  </span>
                </div>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              ISP metrics unavailable
            </span>
          )}
        </div>

        {/* Separator + summary */}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {host?.type && (
            <span className="bg-accent rounded px-2 py-0.5">{host.type}</span>
          )}
          {host?.firmwareVersion && (
            <span className="font-mono">{host.firmwareVersion}</span>
          )}
          <span>{devices.length} devices</span>
          {offlineCount > 0 && (
            <span className="text-red-400">{offlineCount} offline</span>
          )}
          {updateCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {updateCount} updates
            </span>
          )}
        </div>
      </div>

      {/* Device list */}
      {sortedDevices.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No devices found for this site.
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Device header */}
          <div className="flex items-center gap-3 px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span className="w-4" />
            <span className="flex-1 min-w-[120px]">Device</span>
            <span className="w-[100px] hidden md:block">Model</span>
            <span className="w-[110px] hidden lg:block">IP</span>
            <span className="w-[80px]">Status</span>
            <span className="w-[70px] hidden sm:block">Firmware</span>
            <span className="w-[24px]" />
          </div>

          {sortedDevices.map((device) => (
            <DeviceRow key={device.sourceId} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}
