"use client";

import { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Clock, Server, GripVertical } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc";
import { CHART_COLORS } from "@/lib/chart-colors";
import { METRIC_MAP, METRIC_REGISTRY, METRIC_GROUPS } from "@/lib/metric-registry";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigToggle } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

// Metric IDs that come from the uptime monitor integration
const UPTIME_METRICS = new Set(["monitors-down", "monitors-up", "avg-response"]);

// Metric IDs that come from the PSA (ConnectWise tickets)
const TICKET_METRICS = new Set(["open-tickets", "unassigned-tickets", "my-open-tickets", "tickets-today"]);

// Extract hex color from iconColor class (e.g. "bg-red-500/10 text-red-500" → "#ef4444")
const ICON_COLOR_MAP: Record<string, string> = {
  red: CHART_COLORS.red,
  orange: CHART_COLORS.orange,
  amber: CHART_COLORS.amber,
  blue: CHART_COLORS.blue,
  purple: CHART_COLORS.purple,
  cyan: CHART_COLORS.cyan,
  green: CHART_COLORS.green,
  yellow: CHART_COLORS.amber,
};

function getSparkColor(iconColor: string): string {
  const match = iconColor.match(/text-(\w+)-500/);
  return (match && ICON_COLOR_MAP[match[1]]) || CHART_COLORS.blue;
}

function StatCard({
  metricId,
  liveValue,
  sparkData,
  editing,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
}: {
  metricId: string;
  liveValue?: string;
  sparkData?: number[];
  editing?: boolean;
  index: number;
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (index: number) => void;
  isDragTarget?: boolean;
}) {
  const metric = METRIC_MAP.get(metricId);
  if (!metric) return null;

  const Icon = metric.icon;
  const displayValue = liveValue ?? metric.placeholderValue;
  const isLive = liveValue !== undefined;
  const sparkColor = getSparkColor(metric.iconColor);
  const hasSparkline = sparkData && sparkData.length > 1 && sparkData.some((v) => v > 0);
  const gradientId = `spark-${metricId}`;

  return (
    <div
      className={cn(
        "rounded-lg p-4 bg-muted/30 border border-border/50 transition-all",
        editing && "cursor-grab active:cursor-grabbing",
        isDragTarget && "ring-2 ring-red-500/50 border-red-500/30"
      )}
      draggable={editing}
      onDragStart={(e) => {
        if (!editing) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart?.(index);
      }}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e, index);
      }}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        onDrop?.(index);
      }}
      onDragEnd={(e) => {
        e.preventDefault();
        onDrop?.(-1);
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {editing && (
            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 opacity-50" />
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className={cn("mt-1.5 text-2xl font-bold tracking-tight", isLive ? "text-foreground" : "text-muted-foreground")}>
              {displayValue}
            </p>
          </div>
        </div>
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", metric.iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {hasSparkline && (
        <div className="mt-1.5 -mx-1">
          <ResponsiveContainer width="100%" height={28}>
            <AreaChart data={sparkData.map((v, i) => ({ v, i }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                fill={`url(#${gradientId})`}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", hasSparkline ? "mt-0.5" : "mt-2")}>
        <Clock className="h-3 w-3" />
        <span>{isLive ? (hasSparkline ? "30-day trend" : "Live") : "Awaiting integration"}</span>
      </div>
    </div>
  );
}

function SystemStatusCard() {
  const { data: health } = trpc.system.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const services = health?.services ?? [];
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const total = services.length;
  const allHealthy = healthyCount === total && total > 0;

  return (
    <div className="rounded-lg p-4 bg-muted/30 border border-border/50">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">System Status</p>
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg",
          allHealthy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
        )}>
          <Server className="h-4 w-4" />
        </div>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                svc.status === "healthy" ? "bg-green-500" : svc.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              )} />
              <span className="text-[11px] text-foreground truncate flex-1">{svc.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {svc.latencyMs !== null ? `${svc.latencyMs}ms` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatOverviewModule({ config, onConfigChange, isConfigOpen, onConfigClose, editing }: ModuleComponentProps) {
  const columns = (config.columns as number) || 4;
  const selectedMetrics = (config.metrics as string[]) || ["open-tickets", "active-alerts", "monitors-down", "servers-offline"];
  const showSparklines = config.showSparklines !== false; // default true

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((targetIndex: number) => {
    if (targetIndex === -1 || dragIndex === null) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    if (dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...selectedMetrics];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onConfigChange({ ...config, metrics: reordered });
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, selectedMetrics, config, onConfigChange]);

  // Only fetch data if relevant metrics are selected
  const needsUptime = selectedMetrics.some((id) => UPTIME_METRICS.has(id));
  const needsTickets = selectedMetrics.some((id) => TICKET_METRICS.has(id));

  const { data: uptimeMonitors } = trpc.uptime.list.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: needsUptime,
  });

  // Fetch all tickets (open) for stat metrics
  const { data: allTickets } = trpc.psa.getTickets.useQuery(
    { pageSize: 1 },
    { refetchInterval: 60_000, staleTime: 25_000, enabled: needsTickets, retry: 1 }
  );

  // Fetch my member info for "my open tickets" metric
  const needsMyTickets = selectedMetrics.includes("my-open-tickets");
  const { data: myMemberId } = trpc.psa.getMyMemberId.useQuery(undefined, {
    staleTime: 5 * 60_000,
    enabled: needsMyTickets,
    retry: 1,
  });
  const { data: membersList } = trpc.psa.getMembers.useQuery(undefined, {
    staleTime: 5 * 60_000,
    enabled: needsMyTickets && !!myMemberId,
    retry: 1,
  });

  const myIdentifier = useMemo(() => {
    if (!myMemberId || !membersList) return null;
    return membersList.find((m) => m.id === myMemberId)?.identifier ?? null;
  }, [myMemberId, membersList]);

  const { data: myTickets } = trpc.psa.getTickets.useQuery(
    { assignedTo: myIdentifier!, pageSize: 1 },
    { refetchInterval: 60_000, staleTime: 25_000, enabled: !!myIdentifier, retry: 1 }
  );

  // Sparkline: fetch 30 days of tickets for trend data
  const SPARK_DAYS = 30;
  const SPARK_BUCKETS = 10; // 10 buckets of ~3 days each
  const sparklineCreatedAfter = useMemo(
    () => new Date(Date.now() - SPARK_DAYS * 24 * 60 * 60 * 1000),
    []
  );
  const { data: sparkTickets } = trpc.psa.getTickets.useQuery(
    { createdAfter: sparklineCreatedAfter, pageSize: 100 },
    {
      refetchInterval: 120_000,
      staleTime: 60_000,
      enabled: showSparklines && needsTickets,
      retry: 1,
    }
  );

  // Build sparkline data: 30-day ticket volume in 10 buckets
  const sparkDataMap = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!sparkTickets?.data) return map;

    const bucketSize = SPARK_DAYS / SPARK_BUCKETS; // ~3 days per bucket
    const buckets: number[] = new Array(SPARK_BUCKETS).fill(0);
    for (const t of sparkTickets.data) {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      if (!created) continue;
      const daysAgo = (Date.now() - created.getTime()) / (24 * 60 * 60 * 1000);
      if (daysAgo >= 0 && daysAgo < SPARK_DAYS) {
        const bucketIdx = SPARK_BUCKETS - 1 - Math.floor(daysAgo / bucketSize);
        if (bucketIdx >= 0 && bucketIdx < SPARK_BUCKETS) {
          buckets[bucketIdx]++;
        }
      }
    }

    // All ticket metrics share the same trend line (tickets created per period)
    Array.from(TICKET_METRICS).forEach((id) => map.set(id, buckets));
    return map;
  }, [sparkTickets]);

  // Compute live values from fetched data
  const liveValues = useMemo(() => {
    const values = new Map<string, string>();

    // Uptime metrics
    if (uptimeMonitors) {
      const active = uptimeMonitors.filter((m) => m.active);
      const upCount = active.filter((m) => m.status === "UP").length;
      const downCount = active.filter((m) => m.status === "DOWN").length;

      values.set("monitors-up", String(upCount));
      values.set("monitors-down", String(downCount));

      const upMonitors = active.filter((m) => m.status === "UP");
      const latencies = upMonitors
        .map((m) => (m.latestHeartbeat as { latencyMs?: number } | null)?.latencyMs)
        .filter((l): l is number => typeof l === "number" && l > 0);
      if (latencies.length > 0) {
        const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
        values.set("avg-response", `${avg}ms`);
      }
    }

    // Ticket metrics
    if (allTickets) {
      values.set("open-tickets", String(allTickets.totalCount ?? allTickets.data.length));
    }
    if (myTickets) {
      values.set("my-open-tickets", String(myTickets.totalCount ?? myTickets.data.length));
    }

    return values;
  }, [uptimeMonitors, allTickets, myTickets]);

  const colsClass: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 xl:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
  };

  return (
    <>
      <div className={cn("grid gap-3 p-4", colsClass[columns] || colsClass[4])}>
        {selectedMetrics.map((id, index) =>
          id === "system-status" ? (
            <SystemStatusCard key={id} />
          ) : (
            <StatCard
              key={id}
              metricId={id}
              liveValue={liveValues.get(id)}
              sparkData={showSparklines ? sparkDataMap.get(id) : undefined}
              editing={editing}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragTarget={dragOverIndex === index && dragIndex !== index}
            />
          )
        )}
      </div>

      <ModuleConfigPanel title="Key Metrics Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Columns per row">
          <div className="flex gap-2">
            {[2, 3, 4, 6].map((n) => (
              <button
                key={n}
                onClick={() => onConfigChange({ ...config, columns: n })}
                className={cn(
                  "w-10 h-8 rounded-lg border text-xs font-medium transition-colors",
                  columns === n ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Display">
          <ConfigToggle
            label="Show sparklines (30-day trend)"
            checked={showSparklines}
            onChange={(v) => onConfigChange({ ...config, showSparklines: v })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Mini trend charts on metrics with historical data.
          </p>
        </ConfigSection>

        <ConfigSection label="Selected metrics">
          <p className="text-[10px] text-muted-foreground mb-2">
            Click to toggle. Metrics appear in the order shown.
          </p>
          {METRIC_GROUPS.map((group) => (
            <div key={group} className="mb-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {METRIC_REGISTRY.filter((m) => m.group === group).map((metric) => {
                  const isActive = selectedMetrics.includes(metric.id);
                  return (
                    <ConfigChip
                      key={metric.id}
                      label={metric.label}
                      active={isActive}
                      onClick={() => {
                        const next = isActive
                          ? selectedMetrics.filter((id) => id !== metric.id)
                          : [...selectedMetrics, metric.id];
                        onConfigChange({ ...config, metrics: next });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
