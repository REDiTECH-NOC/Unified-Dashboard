"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowUpRight, Loader2, ExternalLink } from "lucide-react";
import { useTimezone } from "@/hooks/use-timezone";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── CONFIG OPTIONS ────────────────────────────────────────────── */

const ALERT_SOURCES = [
  { id: "sentinelone", label: "SentinelOne" },
  { id: "blackpoint", label: "Blackpoint" },
  { id: "ninjaone", label: "NinjaRMM" },
  { id: "uptime", label: "Uptime Monitor" },
  { id: "cove", label: "Cove Backup" },
];

const SEVERITIES = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "informational", label: "Info" },
];

/* ─── SEVERITY / SOURCE STYLING ─────────────────────────────────── */

const severityConfig: Record<string, { label: string; dot: string; color: string }> = {
  critical:      { label: "Crit", dot: "bg-red-500",    color: "text-red-500" },
  high:          { label: "High", dot: "bg-orange-500",  color: "text-orange-500" },
  medium:        { label: "Med",  dot: "bg-yellow-500",  color: "text-yellow-500" },
  low:           { label: "Low",  dot: "bg-blue-400",    color: "text-blue-400" },
  informational: { label: "Info", dot: "bg-zinc-400",    color: "text-zinc-400" },
};

const sourceColors: Record<string, string> = {
  sentinelone: "text-purple-400 bg-purple-500/10",
  blackpoint:  "text-blue-400 bg-blue-500/10",
  ninjaone:    "text-emerald-400 bg-emerald-500/10",
  uptime:      "text-rose-400 bg-rose-500/10",
  cove:        "text-teal-400 bg-teal-500/10",
};

const sourceLabels: Record<string, string> = {
  sentinelone: "S1",
  blackpoint: "BP",
  ninjaone: "Ninja",
  uptime: "Uptime",
  cove: "Cove",
};

/* ─── UNIFIED ALERT TYPE ────────────────────────────────────────── */

interface CompactAlert {
  id: string;
  source: string;
  title: string;
  severity: string;
  severityScore: number;
  deviceHostname?: string;
  organizationName?: string;
  detectedAt: Date;
}

/* ─── COMPONENT ─────────────────────────────────────────────────── */

export function RecentAlertsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const sources = (config.sources as string[]) || [];
  const severities = (config.severities as string[]) || [];
  const sortOrder = (config.sortOrder as string) || "newest";
  const maxItems = (config.maxItems as number) || 15;
  const { relative } = useTimezone();

  /* ── Data Fetching ─────────────────────────────────────────── */

  const wantSource = (src: string) => sources.length === 0 || sources.includes(src);

  const s1Threats = trpc.edr.getThreats.useQuery(
    { pageSize: 50 },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: wantSource("sentinelone") }
  );

  const bpDetections = trpc.blackpoint.getDetections.useQuery(
    { take: 50 },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: wantSource("blackpoint") }
  );

  const ninjaAlerts = trpc.rmm.getAlerts.useQuery(
    { pageSize: 50 },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: wantSource("ninjaone") }
  );

  const uptimeMonitors = trpc.uptime.list.useQuery(
    {},
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: wantSource("uptime") }
  );

  const backupAlerts = trpc.backup.getAlerts.useQuery(
    undefined,
    { retry: 1, refetchInterval: 120_000, staleTime: 60_000, enabled: wantSource("cove") }
  );

  /* ── Build Unified Alert List ──────────────────────────────── */

  const alerts = useMemo(() => {
    const list: CompactAlert[] = [];

    // SentinelOne
    if (s1Threats.data?.data) {
      for (const t of s1Threats.data.data) {
        list.push({
          id: `s1-${t.sourceId}`,
          source: "sentinelone",
          title: t.title,
          severity: t.severity,
          severityScore: t.severityScore,
          deviceHostname: t.deviceHostname,
          organizationName: t.organizationName,
          detectedAt: new Date(t.detectedAt),
        });
      }
    }

    // Blackpoint
    if (bpDetections.data?.data) {
      for (const d of bpDetections.data.data) {
        list.push({
          id: `bp-${d.sourceId}`,
          source: "blackpoint",
          title: d.title,
          severity: d.severity,
          severityScore: d.severityScore,
          deviceHostname: d.deviceHostname,
          organizationName: d.organizationName,
          detectedAt: new Date(d.detectedAt),
        });
      }
    }

    // NinjaRMM
    if (ninjaAlerts.data?.data) {
      for (const a of ninjaAlerts.data.data) {
        list.push({
          id: `ninja-${a.sourceId}`,
          source: "ninjaone",
          title: a.title,
          severity: a.severity,
          severityScore: a.severityScore,
          deviceHostname: a.deviceHostname,
          organizationName: a.organizationName,
          detectedAt: new Date(a.createdAt),
        });
      }
    }

    // Uptime (only DOWN / PENDING monitors)
    if (uptimeMonitors.data) {
      for (const m of uptimeMonitors.data) {
        if (!m.active || (m.status !== "DOWN" && m.status !== "PENDING")) continue;
        const isDown = m.status === "DOWN";
        list.push({
          id: `uptime-${m.id}`,
          source: "uptime",
          title: `${m.name} is ${isDown ? "DOWN" : "PENDING"}`,
          severity: isDown ? "critical" : "medium",
          severityScore: isDown ? 90 : 50,
          organizationName: m.company?.name,
          detectedAt: new Date(m.lastStatusChange || m.lastCheckedAt || m.updatedAt),
        });
      }
    }

    // Cove Backup alerts
    if (backupAlerts.data) {
      for (const a of backupAlerts.data as {
        sourceId: string; title: string; severity: string;
        severityScore: number; deviceHostname?: string;
        organizationName?: string; createdAt: string | Date;
      }[]) {
        list.push({
          id: `cove-${a.sourceId}`,
          source: "cove",
          title: a.title,
          severity: a.severity ?? "medium",
          severityScore: (a.severityScore ?? 5) * 10,
          deviceHostname: a.deviceHostname,
          organizationName: a.organizationName,
          detectedAt: new Date(a.createdAt),
        });
      }
    }

    return list;
  }, [s1Threats.data, bpDetections.data, ninjaAlerts.data, uptimeMonitors.data, backupAlerts.data]);

  /* ── Filter & Sort ─────────────────────────────────────────── */

  const filtered = useMemo(() => {
    let result = alerts;

    // Severity filter
    if (severities.length > 0) {
      result = result.filter((a) => severities.includes(a.severity));
    }

    // Sort
    switch (sortOrder) {
      case "newest":
        result = [...result].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
        break;
      case "oldest":
        result = [...result].sort((a, b) => a.detectedAt.getTime() - b.detectedAt.getTime());
        break;
      case "severity":
      default:
        result = [...result].sort((a, b) => {
          if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
          return b.detectedAt.getTime() - a.detectedAt.getTime();
        });
        break;
    }

    return result.slice(0, maxItems);
  }, [alerts, severities, sortOrder, maxItems]);

  /* ── Loading State ─────────────────────────────────────────── */

  const anyLoading =
    (wantSource("sentinelone") && s1Threats.isLoading) ||
    (wantSource("blackpoint") && bpDetections.isLoading) ||
    (wantSource("ninjaone") && ninjaAlerts.isLoading) ||
    (wantSource("uptime") && uptimeMonitors.isLoading) ||
    (wantSource("cove") && backupAlerts.isLoading);

  const allErrored =
    (!wantSource("sentinelone") || s1Threats.isError) &&
    (!wantSource("blackpoint") || bpDetections.isError) &&
    (!wantSource("ninjaone") || ninjaAlerts.isError) &&
    (!wantSource("uptime") || uptimeMonitors.isError) &&
    (!wantSource("cove") || backupAlerts.isError);

  const totalCount = alerts.length;

  /* ── Render ────────────────────────────────────────────────── */

  if (anyLoading && alerts.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  if (allErrored) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No alerts</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Connect your monitoring integrations to start receiving alerts.
          </p>
          <Link
            href="/settings/integrations"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
          >
            Configure Integrations
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (filtered.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No alerts</p>
          <p className="text-xs text-muted-foreground mt-1">
            {severities.length > 0
              ? "No alerts match your severity filters."
              : "All clear — no active alerts from connected sources."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="divide-y divide-border/30">
        {filtered.map((alert) => {
          const sev = severityConfig[alert.severity] ?? severityConfig.medium;
          return (
            <Link
              key={alert.id}
              href="/alerts"
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors"
            >
              {/* Severity dot */}
              <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sev.dot)} />

              {/* Main content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{alert.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {alert.deviceHostname ?? alert.organizationName ?? "—"}
                </p>
              </div>

              {/* Source badge */}
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium",
                sourceColors[alert.source] ?? "text-zinc-400 bg-zinc-500/10"
              )}>
                {sourceLabels[alert.source] ?? alert.source}
              </span>

              {/* Timestamp */}
              <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:block">
                {relative(alert.detectedAt)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* "View all" footer when more alerts exist */}
      {totalCount > maxItems && (
        <Link
          href="/alerts"
          className="flex items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground hover:text-foreground border-t border-border/30"
        >
          View all {totalCount} alerts <ExternalLink className="h-3 w-3" />
        </Link>
      )}

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Alert Feed Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Filter by source">
          <p className="text-[10px] text-muted-foreground mb-2">Leave empty to show all sources.</p>
          <div className="flex flex-wrap gap-1.5">
            {ALERT_SOURCES.map((src) => (
              <ConfigChip
                key={src.id}
                label={src.label}
                active={sources.includes(src.id)}
                onClick={() => {
                  const next = sources.includes(src.id)
                    ? sources.filter((s) => s !== src.id)
                    : [...sources, src.id];
                  onConfigChange({ ...config, sources: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Filter by severity">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((sev) => (
              <ConfigChip
                key={sev.id}
                label={sev.label}
                active={severities.includes(sev.id)}
                onClick={() => {
                  const next = severities.includes(sev.id)
                    ? severities.filter((s) => s !== sev.id)
                    : [...severities, sev.id];
                  onConfigChange({ ...config, severities: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Sort order">
          <ConfigSelect
            value={sortOrder}
            onChange={(v) => onConfigChange({ ...config, sortOrder: v })}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "severity", label: "Severity (high to low)" },
            ]}
          />
        </ConfigSection>

        <ConfigSection label="Max alerts shown">
          <ConfigSelect
            value={String(maxItems)}
            onChange={(v) => onConfigChange({ ...config, maxItems: parseInt(v, 10) })}
            options={[
              { value: "5", label: "5 alerts" },
              { value: "10", label: "10 alerts" },
              { value: "15", label: "15 alerts" },
              { value: "25", label: "25 alerts" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
