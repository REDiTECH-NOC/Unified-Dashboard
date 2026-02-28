"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/hooks/use-timezone";
import {
  Wifi,
  Globe,
  Server,
  Clock,
  Activity,
  ExternalLink,
  Loader2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { AlertTicketLink } from "./alert-ticket-link";

interface UptimeAlertDetailProps {
  alert: {
    sourceId: string;
    title: string;
    severity: string;
    deviceHostname?: string;
    organizationName?: string;
    detectedAt: Date;
  };
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  HTTP: Globe, TCP: Server, PING: Wifi, DNS: Globe,
};

function statusDot(status: string | null | undefined) {
  switch (status) {
    case "UP": return "bg-green-500";
    case "DOWN": return "bg-red-500";
    case "WARNING": return "bg-amber-500";
    default: return "bg-zinc-500";
  }
}

function statusColor(status: string | null | undefined) {
  switch (status) {
    case "UP": return "text-green-500";
    case "DOWN": return "text-red-500";
    case "WARNING": return "text-amber-500";
    default: return "text-muted-foreground";
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function timeAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m ago`;
}

export function UptimeAlertDetail({ alert, onClose }: UptimeAlertDetailProps) {
  const router = useRouter();
  const { dateTime, time } = useTimezone();
  const monitorId = alert.sourceId;

  const { data: monitor, isLoading } = trpc.uptime.get.useQuery(
    { id: monitorId },
    { refetchInterval: 15000 }
  );
  const { data: stats } = trpc.uptime.stats.useQuery(
    { monitorId },
    { refetchInterval: 30000, enabled: !!monitorId }
  );
  const { data: incidents } = trpc.uptime.incidents.useQuery(
    { monitorId, limit: 5 },
    { refetchInterval: 30000, enabled: !!monitorId }
  );

  if (isLoading) {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading monitor details...
        </div>
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">Close</button>
      </div>
    );
  }

  if (!monitor) {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50 space-y-3">
        <p className="text-xs text-muted-foreground">Monitor not found.</p>
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">Close</button>
      </div>
    );
  }

  const config = (monitor.config as Record<string, unknown>) || {};
  const target = (config.url as string) || (config.hostname as string) || "—";
  const TypeIcon = typeIcons[monitor.type] || Activity;
  const openIncident = incidents?.find((i) => !i.resolvedAt);
  const recentHeartbeats = monitor.heartbeats.slice(0, 10);

  return (
    <div className="px-6 py-4 bg-accent/20 border-t border-border/50 animate-in slide-in-from-top-2 duration-200 space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-3 h-3 rounded-full", statusDot(monitor.status))} />
          <span className={cn("text-sm font-semibold", statusColor(monitor.status))}>
            {monitor.status}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground border border-border">
            <TypeIcon className="h-3 w-3 inline mr-1" />{monitor.type}
          </span>
          {monitor.company && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {(monitor.company as { name: string }).name}
            </span>
          )}
        </div>
        <button
          onClick={() => router.push("/monitoring")}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium bg-accent border border-border text-foreground hover:bg-accent/80 transition-colors"
        >
          Open in Monitoring <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Monitor Info */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Monitor</p>
          <div className="space-y-1.5 text-xs">
            <Row label="Target" value={target} mono />
            <Row label="Interval" value={`${monitor.intervalSeconds}s`} />
            <Row label="Timeout" value={`${monitor.timeoutMs}ms`} />
            <Row label="Max Retries" value={String(monitor.maxRetries)} />
            {monitor.latencyWarningMs && (
              <Row label="Latency Warn" value={`>${monitor.latencyWarningMs}ms`} />
            )}
            {monitor.packetLossWarningPct && (
              <Row label="Loss Warn" value={`>${monitor.packetLossWarningPct}%`} />
            )}
          </div>
        </div>

        {/* Current Incident */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {openIncident ? "Active Incident" : "Status"}
          </p>
          {openIncident ? (
            <div className="space-y-1.5 text-xs">
              <Row label="Started" value={dateTime(openIncident.startedAt)} />
              <Row label="Duration" value={timeAgo(new Date(openIncident.startedAt))} highlight="red" />
              {openIncident.cause && <Row label="Cause" value={openIncident.cause} />}
              <Row label="Alert Sent" value={openIncident.alertSentAt ? dateTime(openIncident.alertSentAt) : "—"} />
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <Row label="Status" value={monitor.status} highlight={monitor.status === "UP" ? "green" : "amber"} />
              {monitor.lastCheckedAt && (
                <Row label="Last Check" value={dateTime(monitor.lastCheckedAt)} />
              )}
              {monitor.lastStatusChange && (
                <Row label="Since" value={dateTime(monitor.lastStatusChange)} />
              )}
            </div>
          )}
        </div>

        {/* Uptime Stats */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Uptime</p>
          <div className="space-y-1.5 text-xs">
            <UptimeStat label="24h" value={stats?.uptime24h} />
            <UptimeStat label="7d" value={stats?.uptime7d} />
            <UptimeStat label="30d" value={stats?.uptime30d} />
            {stats?.avgLatency24h != null && (
              <Row label="Avg Latency" value={`${Math.round(stats.avgLatency24h)}ms`} />
            )}
          </div>
        </div>
      </div>

      {/* Recent Checks */}
      {recentHeartbeats.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Recent Checks</p>
          <div className="flex gap-px h-5 items-end">
            {recentHeartbeats.slice().reverse().map((hb, i) => (
              <div
                key={hb.id}
                className={cn(
                  "flex-1 rounded-sm min-w-1",
                  hb.status === "UP" ? "bg-green-500" : hb.status === "DOWN" ? "bg-red-500" : hb.status === "WARNING" ? "bg-amber-500" : "bg-zinc-600"
                )}
                style={{ height: hb.latencyMs ? `${Math.min(100, Math.max(20, (hb.latencyMs / 500) * 100))}%` : "20%" }}
                title={`${time(hb.timestamp)} — ${hb.status} ${hb.latencyMs ? `${hb.latencyMs}ms` : ""} ${hb.message || ""}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/50">
            <span>oldest</span>
            <span>latest</span>
          </div>
        </div>
      )}

      {/* Incident History */}
      {incidents && incidents.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Incident History</p>
          <div className="space-y-1">
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-accent/30">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                  inc.status === "DOWN" ? "bg-red-500" : "bg-amber-500"
                )} />
                <span className="text-muted-foreground shrink-0">{dateTime(inc.startedAt)}</span>
                <span className={cn("font-medium shrink-0",
                  inc.status === "DOWN" ? "text-red-500" : "text-amber-500"
                )}>{inc.status}</span>
                {inc.cause && <span className="text-muted-foreground truncate">{inc.cause}</span>}
                <span className={cn("ml-auto text-[10px] shrink-0",
                  inc.resolvedAt ? "text-muted-foreground" : "text-red-400 font-medium"
                )}>
                  {inc.resolvedAt && inc.durationSecs != null
                    ? formatDuration(inc.durationSecs)
                    : "ongoing"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Link + Close */}
      <AlertTicketLink
        hostname={alert.deviceHostname}
        organizationName={alert.organizationName}
        alertContext={{
          title: alert.title,
          severity: alert.severity,
          source: "uptime",
          deviceHostname: alert.deviceHostname,
          detectedAt: alert.detectedAt,
        }}
      />
      <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">Close</button>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */

function Row({ label, value, mono, highlight }: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "red" | "green" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        "text-right truncate",
        mono && "font-mono text-[11px]",
        highlight === "red" ? "text-red-400 font-medium" :
        highlight === "green" ? "text-green-400 font-medium" :
        highlight === "amber" ? "text-amber-400 font-medium" :
        "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

function UptimeStat({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const pct = value.toFixed(2);
  const color = value >= 99 ? "text-green-400" : value >= 95 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color)}>{pct}%</span>
    </div>
  );
}
