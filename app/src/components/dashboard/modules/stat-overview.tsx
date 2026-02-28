"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Clock, Server, GripVertical } from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc";
import { CHART_COLORS, CHART_PALETTE } from "@/lib/chart-colors";
import { METRIC_MAP, METRIC_REGISTRY, METRIC_GROUPS } from "@/lib/metric-registry";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigToggle } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

// Metric group sets for conditional data fetching
const TICKET_METRICS = new Set(["my-open-tickets"]);
const SECURITY_METRICS = new Set(["s1-threats", "bp-alerts", "ninja-alerts"]);
const BACKUP_METRICS = new Set(["failed-backups", "backups-overdue"]);
const UPTIME_METRICS = new Set(["monitors-down"]);
const RMM_METRICS = new Set(["endpoints-online"]);
const EMAIL_METRICS = new Set(["email-threats"]);
const DNS_METRICS = new Set(["dns-blocked"]);
const PHONE_METRICS = new Set(["active-calls"]);

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

interface StatusBreakdown {
  status: string;
  count: number;
}

function StatCard({
  metricId,
  liveValue,
  sparkData,
  statusBreakdown,
  editing,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
  onClick,
}: {
  metricId: string;
  liveValue?: string;
  sparkData?: number[];
  statusBreakdown?: StatusBreakdown[];
  editing?: boolean;
  index: number;
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (index: number) => void;
  isDragTarget?: boolean;
  onClick?: () => void;
}) {
  const metric = METRIC_MAP.get(metricId);
  if (!metric) return null;

  const Icon = metric.icon;
  const displayValue = liveValue ?? metric.placeholderValue;
  const isLive = liveValue !== undefined;
  const sparkColor = getSparkColor(metric.iconColor);
  const hasSparkline = sparkData && sparkData.length > 1 && sparkData.some((v) => v > 0);
  const gradientId = `spark-${metricId}`;
  const hasBreakdown = statusBreakdown && statusBreakdown.length > 0;

  const Wrapper = onClick && !editing ? "button" : "div";

  return (
    <Wrapper
      className={cn(
        "rounded-lg p-4 bg-muted/30 border border-border/50 transition-all text-left w-full",
        editing && "cursor-grab active:cursor-grabbing",
        isDragTarget && "ring-2 ring-red-500/50 border-red-500/30",
        onClick && !editing && "hover:border-muted-foreground/30 cursor-pointer"
      )}
      onClick={!editing ? onClick : undefined}
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
            {!hasBreakdown && (
              <p className={cn("mt-1.5 text-2xl font-bold tracking-tight", isLive ? "text-foreground" : "text-muted-foreground")}>
                {displayValue}
              </p>
            )}
          </div>
        </div>
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", metric.iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Donut chart breakdown (for my-open-tickets) */}
      {hasBreakdown && (
        <div className="mt-1 flex items-center gap-2">
          {/* Donut */}
          <div className="w-[100px] h-[100px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusBreakdown.map((item, i) => ({
                    name: item.status,
                    value: item.count,
                    color: CHART_PALETTE[i % CHART_PALETTE.length],
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="92%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {statusBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground"
                  style={{ fontSize: "18px", fontWeight: 700 }}
                >
                  {displayValue}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend — all statuses, tight layout */}
          <div className="flex-1 min-w-0 space-y-px">
            {statusBreakdown.map((item, i) => (
              <div key={item.status} className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
                <span className="text-[10px] text-muted-foreground truncate">{item.status}</span>
                <span className="text-[10px] font-semibold text-foreground ml-auto shrink-0">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSparkline && !hasBreakdown && (
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

      {!hasBreakdown && (
        <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", hasSparkline ? "mt-0.5" : "mt-2")}>
          <Clock className="h-3 w-3" />
          <span>{isLive ? (hasSparkline ? "30-day trend" : "Live") : "Awaiting integration"}</span>
        </div>
      )}
    </Wrapper>
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
  const router = useRouter();
  const columns = (config.columns as number) || 4;
  const selectedMetrics = (config.metrics as string[]) || ["open-tickets", "my-open-tickets", "active-calls"];
  const showSparklines = config.showSparklines !== false;

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
  const needsTickets = selectedMetrics.some((id) => TICKET_METRICS.has(id));
  const needsSecurity = selectedMetrics.some((id) => SECURITY_METRICS.has(id));
  const needsBackup = selectedMetrics.some((id) => BACKUP_METRICS.has(id));
  const needsUptime = selectedMetrics.some((id) => UPTIME_METRICS.has(id));
  const needsRmm = selectedMetrics.some((id) => RMM_METRICS.has(id));
  const needsEmail = selectedMetrics.some((id) => EMAIL_METRICS.has(id));
  const needsDns = selectedMetrics.some((id) => DNS_METRICS.has(id));
  const needsPhone = selectedMetrics.some((id) => PHONE_METRICS.has(id));

  // Fetch my member info for "my tickets" metric
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

  // Fetch up to 100 of my tickets to get status breakdown
  const { data: myTickets } = trpc.psa.getTickets.useQuery(
    { assignedTo: myIdentifier!, pageSize: 100 },
    { refetchInterval: 60_000, staleTime: 25_000, enabled: !!myIdentifier, retry: 1 }
  );

  // ─── Security metrics ──────────────────────────────────
  const { data: s1Data } = trpc.edr.getThreats.useQuery(
    { pageSize: 1, status: "unresolved" },
    { refetchInterval: 60_000, staleTime: 25_000, enabled: needsSecurity && selectedMetrics.includes("s1-threats"), retry: 1 }
  );
  const { data: bpCount } = trpc.blackpoint.getDetectionCount.useQuery(
    {},
    { refetchInterval: 60_000, staleTime: 25_000, enabled: needsSecurity && selectedMetrics.includes("bp-alerts"), retry: 1 }
  );
  const { data: ninjaData } = trpc.rmm.getAlerts.useQuery(
    { pageSize: 1 },
    { refetchInterval: 60_000, staleTime: 25_000, enabled: needsSecurity && selectedMetrics.includes("ninja-alerts"), retry: 1 }
  );

  // ─── Backup metrics ──────────────────────────────────
  const { data: coveAlerts } = trpc.backup.getAlerts.useQuery(undefined, {
    refetchInterval: 120_000, staleTime: 60_000, enabled: needsBackup, retry: 1,
  });
  const { data: dsAlerts } = trpc.saasBackup.getAlerts.useQuery(undefined, {
    refetchInterval: 120_000, staleTime: 60_000, enabled: needsBackup, retry: 1,
  });

  // ─── Uptime metrics ──────────────────────────────────
  const { data: uptimeMonitors } = trpc.uptime.list.useQuery(undefined, {
    refetchInterval: 60_000, staleTime: 25_000, enabled: needsUptime, retry: 1,
  });

  // ─── RMM fleet metrics ───────────────────────────────
  const { data: fleetHealth } = trpc.rmm.getFleetHealth.useQuery(
    {},
    { refetchInterval: 120_000, staleTime: 60_000, enabled: needsRmm, retry: 1 }
  );

  // ─── Email metrics ───────────────────────────────────
  const { data: emailStats } = trpc.emailSecurity.getEventStats.useQuery(
    { days: 30 },
    { refetchInterval: 600_000, staleTime: 300_000, enabled: needsEmail, retry: 1 }
  );

  // ─── DNS metrics ─────────────────────────────────────
  const { data: dnsThreats } = trpc.dnsFilter.getThreatSummary.useQuery(
    {},
    { refetchInterval: 60_000, staleTime: 25_000, enabled: needsDns, retry: 1 }
  );

  // ─── Phone metrics (3CX) ──────────────────────────────
  const { data: pbxOverview } = trpc.threecx.getDashboardOverview.useQuery(undefined, {
    refetchInterval: 30_000, staleTime: 15_000, enabled: needsPhone, retry: 1,
  });

  // Sparkline: fetch 30 days of tickets for trend data
  const SPARK_DAYS = 30;
  const SPARK_BUCKETS = 10;
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

    const bucketSize = SPARK_DAYS / SPARK_BUCKETS;
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

    Array.from(TICKET_METRICS).forEach((id) => map.set(id, buckets));
    return map;
  }, [sparkTickets]);

  // Filter out closed tickets — use exact matches only; CW sub-statuses like "Completed--" are NOT closed
  const CLOSED_STATUSES = useMemo(() => new Set(["closed", "completed", "cancelled", "canceled", "resolved"]), []);
  const myOpenTickets = useMemo(() => {
    if (!myTickets?.data) return [];
    return myTickets.data.filter((t) => {
      const status = (t.status || "").toLowerCase().replace(/[-–—>]+$/, "").trim();
      return !CLOSED_STATUSES.has(status);
    });
  }, [myTickets, CLOSED_STATUSES]);

  const myTicketBreakdown = useMemo((): StatusBreakdown[] => {
    if (myOpenTickets.length === 0) return [];
    const statusMap = new Map<string, number>();
    for (const ticket of myOpenTickets) {
      // Clean trailing dashes/separators from CW sub-statuses (e.g. "Scheduled Remote--" → "Scheduled Remote")
      const status = (ticket.status || "Unknown").replace(/[-–—>]+$/, "").trim();
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    }
    return Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [myOpenTickets]);

  // Compute live values from fetched data
  const liveValues = useMemo(() => {
    const values = new Map<string, string>();

    // Ticket metrics — only non-closed tickets
    if (myTickets) {
      values.set("my-open-tickets", String(myOpenTickets.length));
    }

    // Security metrics
    if (s1Data) {
      values.set("s1-threats", String(s1Data.totalCount ?? s1Data.data.length));
    }
    if (bpCount !== undefined && bpCount !== null) {
      values.set("bp-alerts", String(bpCount));
    }
    if (ninjaData) {
      values.set("ninja-alerts", String(ninjaData.totalCount ?? ninjaData.data.length));
    }

    // Backup metrics
    if (coveAlerts || dsAlerts) {
      const coveArr = (coveAlerts ?? []) as { severity: string }[];
      const dsArr = (dsAlerts ?? []) as { severity: string }[];
      const failed = coveArr.filter((a) => a.severity === "critical").length + dsArr.filter((a) => a.severity === "critical").length;
      const overdue = coveArr.filter((a) => a.severity === "high").length + dsArr.filter((a) => a.severity === "high").length;
      values.set("failed-backups", String(failed));
      values.set("backups-overdue", String(overdue));
    }

    // Uptime metrics
    if (uptimeMonitors) {
      const down = uptimeMonitors.filter((m: { active: boolean; status: string }) => m.active && m.status === "DOWN").length;
      values.set("monitors-down", String(down));
    }

    // RMM fleet metrics
    if (fleetHealth?.data) {
      const online = (fleetHealth.data as { offline?: boolean }[]).filter((d) => !d.offline).length;
      values.set("endpoints-online", String(online));
    }

    // Email metrics
    if (emailStats) {
      const phishing = emailStats.byType?.phishing ?? 0;
      const malware = emailStats.byType?.malware ?? 0;
      values.set("email-threats", String(phishing + malware));
    }

    // DNS metrics
    if (dnsThreats) {
      values.set("dns-blocked", String(dnsThreats.total ?? 0));
    }

    // Phone metrics (3CX)
    if (pbxOverview) {
      const totalActiveCalls = pbxOverview.reduce((sum: number, p: { callsActive?: number | null }) => sum + (p.callsActive ?? 0), 0);
      values.set("active-calls", String(totalActiveCalls));
    }

    return values;
  }, [myTickets, myOpenTickets, s1Data, bpCount, ninjaData, coveAlerts, dsAlerts, uptimeMonitors, fleetHealth, emailStats, dnsThreats, pbxOverview]);

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
              statusBreakdown={id === "my-open-tickets" ? myTicketBreakdown : undefined}
              editing={editing}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragTarget={dragOverIndex === index && dragIndex !== index}
              onClick={id === "my-open-tickets" ? () => router.push("/tickets?view=mine") : undefined}
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
                          ? selectedMetrics.filter((mid) => mid !== metric.id)
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
