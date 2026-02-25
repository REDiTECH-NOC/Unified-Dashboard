"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2, Settings2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTimezone } from "@/hooks/use-timezone";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── TIME RANGES ──────────────────────────────────────────────── */

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
] as const;

/* ─── COMPONENT ─────────────────────────────────────────────────── */

export function UptimeLatencyChartModule({
  config,
  onConfigChange,
  isConfigOpen,
  onConfigClose,
}: ModuleComponentProps) {
  const monitorId = (config.monitorId as string) || "";
  const timeRange = (config.timeRange as number) || 24;
  const { timeShort, dateShort, dateTime } = useTimezone();

  /* ── Data Fetching ───────────────────────────────────────────── */

  const monitorsQuery = trpc.uptime.list.useQuery(
    {},
    { staleTime: 300_000 }
  );

  const heartbeatsQuery = trpc.uptime.heartbeats.useQuery(
    { monitorId, hours: timeRange, limit: 200 },
    { enabled: !!monitorId, refetchInterval: 60_000, staleTime: 25_000 }
  );

  /* ── Chart data ──────────────────────────────────────────────── */

  const chartData = useMemo(() => {
    return (heartbeatsQuery.data?.items || [])
      .filter((hb) => hb.latencyMs !== null)
      .map((hb) => ({
        time: new Date(hb.timestamp).getTime(),
        latency: hb.latencyMs,
      }))
      .reverse();
  }, [heartbeatsQuery.data]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latencies = chartData.map((d) => d.latency || 0);
    return {
      min: Math.min(...latencies),
      avg: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length),
      max: Math.max(...latencies),
    };
  }, [chartData]);

  /* ── Monitor options for config ──────────────────────────────── */

  const monitorOptions = useMemo(() => {
    const monitors = monitorsQuery.data ?? [];
    return [
      { value: "", label: "Select a monitor..." },
      ...monitors.map((m) => ({ value: m.id, label: m.name })),
    ];
  }, [monitorsQuery.data]);

  const monitorName = monitorsQuery.data?.find((m) => m.id === monitorId)?.name;

  /* ── Render ──────────────────────────────────────────────────── */

  // No monitor selected
  if (!monitorId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <Settings2 className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Select a monitor</p>
          <p className="text-xs text-muted-foreground mt-1">
            Open settings to choose which monitor to track.
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (heartbeatsQuery.isLoading) {
    return (
      <>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full px-2 pt-1">
        {/* Header with time range buttons */}
        <div className="flex items-center justify-between px-1 pb-1">
          <p className="text-[10px] text-muted-foreground truncate max-w-[60%]">
            {monitorName || "Monitor"}
          </p>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.hours}
                onClick={() => onConfigChange({ ...config, timeRange: r.hours })}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded transition-colors",
                  timeRange === r.hours
                    ? "bg-red-600 text-white"
                    : "bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradModule" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => (timeRange <= 24 ? timeShort(v) : dateShort(v))}
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1c1e",
                      border: "1px solid #27272a",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                    labelFormatter={(v) => dateTime(v)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value}ms`, "Latency"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#ef4444"
                    fill="url(#latencyGradModule)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stats row */}
            {stats && (
              <div className="flex gap-4 px-1 pb-2 text-[10px] text-muted-foreground">
                <span>
                  Min: <span className="text-green-500 font-medium">{stats.min}ms</span>
                </span>
                <span>
                  Avg: <span className="text-foreground font-medium">{stats.avg}ms</span>
                </span>
                <span>
                  Max: <span className="text-red-500 font-medium">{stats.max}ms</span>
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            No data yet
          </div>
        )}
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Response Time Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Monitor">
          <ConfigSelect
            value={monitorId}
            onChange={(v) => onConfigChange({ ...config, monitorId: v })}
            options={monitorOptions}
          />
        </ConfigSection>

        <ConfigSection label="Time range">
          <ConfigSelect
            value={String(timeRange)}
            onChange={(v) => onConfigChange({ ...config, timeRange: parseInt(v, 10) })}
            options={TIME_RANGES.map((r) => ({
              value: String(r.hours),
              label: r.label === "7d" ? "7 days" : `${r.hours} hour${r.hours > 1 ? "s" : ""}`,
            }))}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
