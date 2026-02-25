"use client";

import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Wifi,
  Router,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

export function NetworkHealthModule() {
  const summaryQuery = trpc.network.getSummary.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const devicesQuery = trpc.network.getDevices.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: summary, isLoading, error, isRefetching } = summaryQuery;

  if (error) {
    return (
      <div className="p-5 text-sm text-muted-foreground">
        <p>UniFi not configured.</p>
        <p className="text-xs mt-1">
          Go to Settings &rarr; Integrations to connect.
        </p>
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  const onlinePercent =
    summary.totalDevices > 0
      ? Math.round((summary.devicesOnline / summary.totalDevices) * 100)
      : 0;

  const devices = devicesQuery.data ?? [];

  return (
    <div className="p-5 space-y-3">
      {/* Stat row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Sites" value={summary.totalSites} />
        <StatCard label="Devices" value={summary.totalDevices} />
        <StatCard
          label="Online"
          value={`${onlinePercent}%`}
          color={onlinePercent >= 95 ? "text-green-500" : onlinePercent >= 80 ? "text-yellow-500" : "text-red-500"}
        />
        <StatCard
          label="Updates"
          value={summary.devicesPendingUpdate}
          color={summary.devicesPendingUpdate > 0 ? "text-amber-400" : "text-muted-foreground"}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between pb-1 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Devices
        </span>
        <div className="flex items-center gap-1.5">
          {isRefetching && (
            <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />
          )}
          <span className="text-[10px] text-muted-foreground">
            Auto-refresh 60s
          </span>
        </div>
      </div>

      {/* Device list */}
      <div className="space-y-1 max-h-[240px] overflow-y-auto pr-1">
        {devices.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No devices found.
          </p>
        ) : (
          devices.slice(0, 20).map((device) => {
            const meta = (device.metadata ?? {}) as Record<string, unknown>;
            const hasUpdate = meta.updateAvailable != null;
            const isOnline = device.status === "online";

            return (
              <div
                key={device.sourceId}
                className="flex items-center gap-3 py-1.5 group"
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg bg-muted/40",
                    isOnline ? "text-green-500" : "text-red-500"
                  )}
                >
                  {(meta.isConsole as boolean) ? (
                    <Router className="h-4 w-4" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                </div>

                {/* Name + Model */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {device.hostname}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate block">
                    {device.model}
                    {device.organizationName
                      ? ` \u2022 ${device.organizationName}`
                      : ""}
                  </span>
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasUpdate ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      <ArrowUpCircle className="h-3 w-3" />
                      Update
                    </span>
                  ) : isOnline ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-500/70 bg-green-500/5 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="h-3 w-3" />
                      {device.agentVersion ?? "Online"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500/70 bg-red-500/5 px-1.5 py-0.5 rounded">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </span>
                  )}

                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isOnline ? "bg-green-500" : "bg-red-500"
                    )}
                  />
                </div>
              </div>
            );
          })
        )}

        {devices.length > 20 && (
          <p className="text-xs text-muted-foreground pt-1">
            +{devices.length - 20} more devices
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-2.5 text-center">
      <div className={cn("text-lg font-bold", color ?? "text-foreground")}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
