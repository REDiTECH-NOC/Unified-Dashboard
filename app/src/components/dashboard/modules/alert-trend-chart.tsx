"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { SEVERITY_COLORS, CHART_COLORS } from "@/lib/chart-colors";
import { ModuleConfigPanel, ConfigSection, ConfigSelect, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── SOURCE CONFIG ────────────────────────────────────────────── */

const ALERT_SOURCES = [
  { id: "sentinelone", label: "SentinelOne" },
  { id: "blackpoint", label: "Blackpoint" },
  { id: "ninjaone", label: "NinjaRMM" },
  { id: "uptime", label: "Uptime" },
  { id: "cove", label: "Cove" },
];

const SOURCE_COLORS: Record<string, string> = {
  sentinelone: CHART_COLORS.purple,
  blackpoint: CHART_COLORS.blue,
  ninjaone: CHART_COLORS.green,
  uptime: CHART_COLORS.rose,
  cove: CHART_COLORS.teal,
};

/* ─── COMPONENT ─────────────────────────────────────────────────── */

export function AlertTrendChartModule({
  config,
  onConfigChange,
  isConfigOpen,
  onConfigClose,
}: ModuleComponentProps) {
  const groupBy = (config.groupBy as string) || "severity";
  const sources = (config.sources as string[]) || [];

  const wantSource = (src: string) => sources.length === 0 || sources.includes(src);

  /* ── Data Fetching (same pattern as recent-alerts) ──────────── */

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

  /* ── Build unified alert list ───────────────────────────────── */

  interface SimpleAlert {
    source: string;
    severity: string;
  }

  const alerts = useMemo(() => {
    const list: SimpleAlert[] = [];

    if (s1Threats.data?.data) {
      for (const t of s1Threats.data.data) list.push({ source: "sentinelone", severity: t.severity });
    }
    if (bpDetections.data?.data) {
      for (const d of bpDetections.data.data) list.push({ source: "blackpoint", severity: d.severity });
    }
    if (ninjaAlerts.data?.data) {
      for (const a of ninjaAlerts.data.data) list.push({ source: "ninjaone", severity: a.severity });
    }
    if (uptimeMonitors.data) {
      for (const m of uptimeMonitors.data) {
        if (!m.active || (m.status !== "DOWN" && m.status !== "PENDING")) continue;
        list.push({ source: "uptime", severity: m.status === "DOWN" ? "critical" : "medium" });
      }
    }
    if (backupAlerts.data) {
      for (const a of backupAlerts.data as { severity?: string }[]) {
        list.push({ source: "cove", severity: a.severity ?? "medium" });
      }
    }

    return list;
  }, [s1Threats.data, bpDetections.data, ninjaAlerts.data, uptimeMonitors.data, backupAlerts.data]);

  /* ── Aggregate into chart data ──────────────────────────────── */

  const chartData = useMemo(() => {
    if (alerts.length === 0) return [];

    const counts = new Map<string, number>();

    for (const a of alerts) {
      const key = groupBy === "source" ? a.source : a.severity;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Sort: severity by defined order, source alphabetically
    const severityOrder = ["critical", "high", "medium", "low", "informational"];
    const entries = Array.from(counts.entries());

    if (groupBy === "severity") {
      entries.sort((a, b) => severityOrder.indexOf(a[0]) - severityOrder.indexOf(b[0]));
    } else {
      entries.sort((a, b) => b[1] - a[1]);
    }

    return entries.map(([name, value]) => ({
      name: groupBy === "source"
        ? ALERT_SOURCES.find((s) => s.id === name)?.label || name
        : name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: groupBy === "severity"
        ? SEVERITY_COLORS[name as keyof typeof SEVERITY_COLORS] || "#71717a"
        : SOURCE_COLORS[name] || "#71717a",
      key: name,
    }));
  }, [alerts, groupBy]);

  const totalAlerts = alerts.length;

  /* ── Loading / Error ────────────────────────────────────────── */

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

  /* ── Render ──────────────────────────────────────────────────── */

  if (anyLoading && alerts.length === 0) {
    return (
      <>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  if (allErrored || chartData.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">{allErrored ? "Unable to fetch alerts" : "No alerts"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {allErrored
              ? "Check your monitoring integrations."
              : "All clear — no active alerts from connected sources."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full px-2 pt-1">
        {/* Summary */}
        <div className="flex items-baseline gap-2 px-1 pb-1">
          <span className="text-lg font-semibold">{totalAlerts}</span>
          <span className="text-[10px] text-muted-foreground">
            active alert{totalAlerts !== 1 ? "s" : ""} by {groupBy}
          </span>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c1e",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${value}`, "Alerts"]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Alert Breakdown Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Group by">
          <ConfigSelect
            value={groupBy}
            onChange={(v) => onConfigChange({ ...config, groupBy: v })}
            options={[
              { value: "severity", label: "Severity" },
              { value: "source", label: "Source" },
            ]}
          />
        </ConfigSection>

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
      </ModuleConfigPanel>
    );
  }
}
