import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { SiteExpanded } from "./site-expanded";

/* ─── Types ──────────────────────────────────────────────── */

interface NetworkSite {
  siteId: string;
  hostId: string;
  name: string;
  description?: string;
}

interface NetworkHost {
  id: string;
  name?: string;
  type?: string;
  firmwareVersion?: string;
  ipAddress?: string;
}

interface DeviceMeta {
  productLine?: string;
  updateAvailable?: string | null;
  hostId?: string;
  hostName?: string;
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
  organizationSourceId?: string;
  organizationName?: string;
  metadata?: DeviceMeta;
}

type StatusFilter = "all" | "online" | "offline" | "updates";

interface Props {
  sites: NetworkSite[];
  hosts: NetworkHost[];
  devices: Device[];
  isLoading: boolean;
  search: string;
  statusFilter: StatusFilter;
  hostFilter: string;
}

/* ─── Enriched site row ──────────────────────────────────── */

interface SiteRow {
  site: NetworkSite;
  host: NetworkHost | undefined;
  siteDevices: Device[];
  onlineCount: number;
  offlineCount: number;
  updateCount: number;
  alertCount: number;
}

/* ─── Component ──────────────────────────────────────────── */

export function SiteTable({
  sites,
  hosts,
  devices,
  isLoading,
  search,
  statusFilter,
  hostFilter,
}: Props) {
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);

  /* ── Build enriched site rows ────────────────────────── */

  const hostMap = useMemo(() => {
    const m = new Map<string, NetworkHost>();
    for (const h of hosts) m.set(h.id, h);
    return m;
  }, [hosts]);

  // Group devices by hostId — try organizationSourceId first, then metadata.hostId
  const devicesByHost = useMemo(() => {
    const m = new Map<string, Device[]>();
    for (const d of devices) {
      const hid =
        d.organizationSourceId ||
        (d.metadata as DeviceMeta | undefined)?.hostId;
      if (!hid) continue;
      const arr = m.get(hid) ?? [];
      arr.push(d);
      m.set(hid, arr);
    }
    return m;
  }, [devices]);

  const rows: SiteRow[] = useMemo(() => {
    return sites.map((site) => {
      const host = hostMap.get(site.hostId);
      const siteDevices = devicesByHost.get(site.hostId) ?? [];
      const onlineCount = siteDevices.filter((d) => d.status === "online").length;
      const offlineCount = siteDevices.filter((d) => d.status === "offline").length;
      const updateCount = siteDevices.filter(
        (d) => !!(d.metadata as DeviceMeta | undefined)?.updateAvailable
      ).length;
      return {
        site,
        host,
        siteDevices,
        onlineCount,
        offlineCount,
        updateCount,
        alertCount: offlineCount + updateCount,
      };
    });
  }, [sites, hostMap, devicesByHost]);

  /* ── Apply filters ──────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = rows;

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.site.name.toLowerCase().includes(q) ||
          (r.host?.name ?? "").toLowerCase().includes(q) ||
          (r.site.description ?? "").toLowerCase().includes(q)
      );
    }

    // Host type filter
    if (hostFilter !== "all") {
      result = result.filter((r) => r.host?.type === hostFilter);
    }

    // Status filter
    if (statusFilter === "online") {
      result = result.filter(
        (r) => r.siteDevices.length > 0 && r.offlineCount === 0
      );
    } else if (statusFilter === "offline") {
      result = result.filter((r) => r.offlineCount > 0);
    } else if (statusFilter === "updates") {
      result = result.filter((r) => r.updateCount > 0);
    }

    return result;
  }, [rows, search, hostFilter, statusFilter]);

  /* ── Loading skeleton ──────────────────────────────── */

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex gap-4">
          {["w-48", "w-24", "w-32", "w-16", "w-12"].map((w, i) => (
            <div key={i} className={cn("h-3 bg-muted rounded animate-pulse", w)} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-border/50 flex gap-4">
            {["w-4", "w-40", "w-20", "w-28", "w-12", "w-8"].map((w, j) => (
              <div key={j} className={cn("h-3 bg-muted/50 rounded animate-pulse", w)} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  /* ── Empty state ───────────────────────────────────── */

  if (filtered.length === 0 && rows.length > 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No sites match the current filters.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No sites found. Check your UniFi API configuration.
        </p>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────── */

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="hidden sm:flex items-center gap-0 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <span className="w-6" />
        <span className="flex-1 min-w-[180px]">Site</span>
        <span className="w-[160px] hidden md:block">Controller</span>
        <span className="w-[70px] text-center">Devices</span>
        <span className="w-[60px] text-center">Status</span>
        <span className="w-[50px] text-center">Alerts</span>
      </div>

      {/* Rows */}
      {filtered.map((row) => {
        const isExpanded = expandedSiteId === row.site.siteId;
        const siteStatus =
          row.siteDevices.length === 0
            ? "unknown"
            : row.offlineCount === row.siteDevices.length
              ? "offline"
              : row.offlineCount > 0 || row.updateCount > 0
                ? "warning"
                : "online";

        return (
          <div key={row.site.siteId}>
            {/* Site row */}
            <button
              onClick={() =>
                setExpandedSiteId(isExpanded ? null : row.site.siteId)
              }
              className={cn(
                "w-full flex items-center gap-0 px-4 py-3 text-sm transition-colors text-left",
                "hover:bg-accent/50",
                isExpanded && "bg-accent/30"
              )}
            >
              {/* Chevron */}
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 mr-2",
                  isExpanded && "rotate-90"
                )}
              />

              {/* Site name */}
              <div className="flex-1 min-w-[180px] truncate">
                <span className="font-medium text-foreground">
                  {row.site.name}
                </span>
              </div>

              {/* Controller — show host name (e.g., "GYC-Unifi-Datacenter") */}
              <span className="w-[160px] text-muted-foreground truncate hidden md:block">
                {row.host?.name ?? row.host?.type ?? "—"}
              </span>

              {/* Device count */}
              <span className="w-[70px] text-center text-muted-foreground">
                {row.siteDevices.length}
              </span>

              {/* Status */}
              <div className="w-[60px] flex justify-center">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    siteStatus === "online" && "bg-green-500",
                    siteStatus === "warning" && "bg-yellow-500",
                    siteStatus === "offline" && "bg-red-500",
                    siteStatus === "unknown" && "bg-zinc-500"
                  )}
                />
              </div>

              {/* Alert count */}
              <div className="w-[50px] flex justify-center">
                {row.alertCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {row.alertCount}
                  </span>
                )}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <SiteExpanded
                site={row.site}
                host={row.host}
                devices={row.siteDevices}
              />
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        {filtered.length} of {rows.length} sites
      </div>
    </div>
  );
}
