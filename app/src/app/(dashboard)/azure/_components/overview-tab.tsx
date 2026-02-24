"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Bell,
  Server,
  Database,
  HardDrive,
  Cloud,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CostChart } from "./cost-chart";

const RESOURCE_TYPE_ICONS: Record<string, React.ElementType> = {
  "Microsoft.App/containerApps": Cloud,
  "Microsoft.DBforPostgreSQL/flexibleServers": Database,
  "Microsoft.Cache/Redis": HardDrive,
  "Microsoft.KeyVault/vaults": Server,
};

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Available: { color: "text-green-500", bg: "bg-green-500/10", icon: CheckCircle2 },
  Degraded: { color: "text-yellow-500", bg: "bg-yellow-500/10", icon: AlertTriangle },
  Unavailable: { color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
};

const SEVERITY_STYLES: Record<string, string> = {
  Sev0: "text-red-500 bg-red-500/10",
  Sev1: "text-orange-500 bg-orange-500/10",
  Sev2: "text-yellow-500 bg-yellow-500/10",
  Sev3: "text-blue-400 bg-blue-400/10",
  Sev4: "text-muted-foreground bg-muted/20",
};

export function OverviewTab() {
  const healthQuery = trpc.infrastructure.getResourceHealth.useQuery(undefined, {
    staleTime: 60_000,
  });
  const costQuery = trpc.infrastructure.getCostSummary.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const alertsQuery = trpc.infrastructure.getAlertsSummary.useQuery(undefined, {
    staleTime: 60_000,
  });

  const isLoading = healthQuery.isLoading || costQuery.isLoading || alertsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-muted/20 animate-pulse" />
      </div>
    );
  }

  // Check if any source is unavailable (not on Azure)
  if (healthQuery.data?.source === "unavailable") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Cloud className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">Azure Not Detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview data requires Azure managed identity. Configure your deployment first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Resource Health Summary */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Resources</p>
                <p className="text-2xl font-bold mt-1">
                  {healthQuery.data?.resources.length || 0}
                </p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-2.5">
                <Server className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {healthQuery.data?.resources.filter((r) => r.status === "Available").length || 0} healthy
            </p>
          </CardContent>
        </Card>

        {/* Cost Summary */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Month to Date</p>
                {(costQuery.data as { unsupported?: boolean })?.unsupported ? (
                  <p className="text-sm font-medium text-muted-foreground mt-1">N/A</p>
                ) : (
                  <p className="text-2xl font-bold mt-1">
                    ${costQuery.data?.total.toFixed(2) || "0.00"}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2.5">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {(costQuery.data as { message?: string })?.message || `${costQuery.data?.costs.length || 0} services`}
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold mt-1">
                  {alertsQuery.data?.total || 0}
                </p>
              </div>
              <div
                className={cn(
                  "rounded-lg p-2.5",
                  (alertsQuery.data?.total || 0) > 0
                    ? "bg-red-500/10"
                    : "bg-green-500/10"
                )}
              >
                <Bell
                  className={cn(
                    "h-5 w-5",
                    (alertsQuery.data?.total || 0) > 0
                      ? "text-red-500"
                      : "text-green-500"
                  )}
                />
              </div>
            </div>
            {alertsQuery.data && alertsQuery.data.total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                {Object.entries(alertsQuery.data.counts).map(([sev, count]) => (
                  <span
                    key={sev}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      SEVERITY_STYLES[sev] || "text-muted-foreground bg-muted/20"
                    )}
                  >
                    {sev}: {count}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resource Health Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Resource Health</CardTitle>
            <button
              onClick={() => healthQuery.refetch()}
              disabled={healthQuery.isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", healthQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {healthQuery.data?.resources.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No resource health data available
            </p>
          )}
          {healthQuery.data?.resources.map((resource) => {
            const style = STATUS_STYLES[resource.status] || STATUS_STYLES.Unavailable;
            const Icon =
              RESOURCE_TYPE_ICONS[resource.type] || Server;
            const StatusIcon = style.icon;

            return (
              <div
                key={resource.name}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {resource.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {resource.type.split("/").pop()} — {resource.summary}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-1 rounded flex-shrink-0",
                    style.color,
                    style.bg
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {resource.status}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      {costQuery.data && costQuery.data.costs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cost Breakdown — Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <CostChart costs={costQuery.data.costs} total={costQuery.data.total} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
