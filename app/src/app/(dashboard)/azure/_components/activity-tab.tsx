"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Bell,
  RefreshCw,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/hooks/use-timezone";

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "3d", hours: 72 },
  { label: "7d", hours: 168 },
];

const SEVERITY_STYLES: Record<string, { color: string; bg: string }> = {
  Sev0: { color: "text-red-500", bg: "bg-red-500/10" },
  Sev1: { color: "text-orange-500", bg: "bg-orange-500/10" },
  Sev2: { color: "text-yellow-500", bg: "bg-yellow-500/10" },
  Sev3: { color: "text-blue-400", bg: "bg-blue-400/10" },
  Sev4: { color: "text-muted-foreground", bg: "bg-muted/20" },
};

const ALERT_STATE_ICONS: Record<string, React.ElementType> = {
  New: AlertTriangle,
  Acknowledged: Clock,
  Closed: CheckCircle2,
};

const STATUS_COLORS: Record<string, string> = {
  Succeeded: "text-green-500",
  Failed: "text-red-400",
  Started: "text-blue-400",
  Accepted: "text-yellow-400",
};

export function ActivityTab() {
  const { dateTime } = useTimezone();
  const [hours, setHours] = useState(24);

  const activityQuery = trpc.infrastructure.getActivityLog.useQuery(
    { hours },
    { staleTime: 60_000 }
  );
  const alertsQuery = trpc.infrastructure.getAlerts.useQuery(undefined, {
    staleTime: 60_000,
  });

  const isLoading = activityQuery.isLoading || alertsQuery.isLoading;

  if (activityQuery.data?.source === "unavailable") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <Cloud className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">Azure Not Detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activity logs and alerts require Azure managed identity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Azure Monitor Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Azure Monitor Alerts</CardTitle>
            </div>
            <button
              onClick={() => alertsQuery.refetch()}
              disabled={alertsQuery.isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", alertsQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {alertsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (alertsQuery.data?.alerts.length || 0) === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertsQuery.data?.alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.Sev4;
                const StateIcon = ALERT_STATE_ICONS[alert.state] || AlertTriangle;

                return (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border"
                  >
                    <div className={cn("rounded-md p-1.5 mt-0.5", style.bg)}>
                      <StateIcon className={cn("h-3.5 w-3.5", style.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {alert.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0", style.color)}
                        >
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {alert.state}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {alert.targetResource} — {alert.description || alert.condition}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Fired: {dateTime(alert.firedAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Activity Log</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Time range selector */}
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.hours}
                    onClick={() => setHours(range.hours)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded transition-colors",
                      hours === range.hours
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => activityQuery.refetch()}
                disabled={activityQuery.isFetching}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-3 w-3", activityQuery.isFetching && "animate-spin")}
                />
                Refresh
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (activityQuery.data?.events.length || 0) === 0 ? (
            <div className="py-6 text-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No activity in the last {hours < 24 ? `${hours}h` : `${hours / 24}d`}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[140px_1fr_120px_80px] gap-2 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <span>Time</span>
                <span>Operation</span>
                <span>Caller</span>
                <span className="text-right">Status</span>
              </div>
              {/* Rows */}
              {activityQuery.data?.events.map((event, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[140px_1fr_120px_80px] gap-2 px-3 py-2 rounded hover:bg-muted/30 text-xs items-center"
                >
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {dateTime(event.timestamp)}
                  </span>
                  <div className="truncate">
                    <span className="text-foreground">{event.operation}</span>
                    {event.resourceType && (
                      <span className="text-muted-foreground ml-1">
                        ({event.resourceType.split("/").pop()})
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground truncate">{event.caller}</span>
                  <span
                    className={cn(
                      "text-right text-xs",
                      STATUS_COLORS[event.status] || "text-muted-foreground"
                    )}
                  >
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
