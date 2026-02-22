"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  Database,
  Server,
  HardDrive,
  Workflow,
  BarChart3,
  RefreshCw,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "RCC App": Server,
  PostgreSQL: Database,
  Redis: HardDrive,
  n8n: Workflow,
  Grafana: BarChart3,
};

const STATUS_CONFIG = {
  healthy: {
    color: "text-green-500",
    bg: "bg-green-500",
    label: "Healthy",
    Icon: CheckCircle2,
  },
  degraded: {
    color: "text-yellow-500",
    bg: "bg-yellow-500",
    label: "Degraded",
    Icon: AlertTriangle,
  },
  down: {
    color: "text-red-500",
    bg: "bg-red-500",
    label: "Down",
    Icon: XCircle,
  },
} as const;

export function SystemHealthModule() {
  const healthQuery = trpc.system.health.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data, isLoading, isRefetching } = healthQuery;

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5 text-sm text-muted-foreground">
        Unable to fetch system health.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2.5">
      {/* Overall status bar */}
      <div className="flex items-center justify-between pb-2 mb-1 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              data.status === "healthy" ? "bg-green-500" : "bg-yellow-500"
            )}
          />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {data.status === "healthy" ? "All Systems Operational" : "Issues Detected"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isRefetching && (
            <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />
          )}
          <span className="text-[10px] text-muted-foreground">
            Auto-refresh 30s
          </span>
        </div>
      </div>

      {/* Service list */}
      {data.services.map((service) => {
        const Icon = SERVICE_ICONS[service.name] ?? Server;
        const statusConfig = STATUS_CONFIG[service.status];

        return (
          <div
            key={service.name}
            className="flex items-center gap-3 py-1.5 group"
          >
            {/* Icon */}
            <div
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg bg-muted/40",
                statusConfig.color
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            {/* Name + Message */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {service.name}
                </span>
                {service.latencyMs !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    {service.latencyMs}ms
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate block">
                {service.message}
              </span>
            </div>

            {/* Status + Update badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {service.updateAvailable ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                  <ArrowUpCircle className="h-3 w-3" />
                  {service.latestVersion ?? "Update"}
                </span>
              ) : service.version && service.status === "healthy" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-500/70 bg-green-500/5 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3 w-3" />
                  Current
                </span>
              ) : null}

              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  statusConfig.bg
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
