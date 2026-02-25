"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { useTimezone } from "@/hooks/use-timezone";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── COMPONENT ─────────────────────────────────────────────────── */

export function TicketVolumeChartModule({
  config,
  onConfigChange,
  isConfigOpen,
  onConfigClose,
}: ModuleComponentProps) {
  const timeRange = (config.timeRange as number) || 14;
  const boardId = (config.boardId as string) || "";
  const { dateShort } = useTimezone();

  const createdAfter = useMemo(
    () => new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000),
    [timeRange]
  );

  /* ── Data Fetching ───────────────────────────────────────────── */

  const ticketsQuery = trpc.psa.getTickets.useQuery(
    {
      boardId: boardId || undefined,
      createdAfter,
      pageSize: 100,
    },
    { retry: 1, staleTime: 60_000, refetchInterval: 120_000 }
  );

  const boardsQuery = trpc.psa.getBoards.useQuery(undefined, {
    staleTime: 300_000,
  });

  /* ── Bucket tickets by day ───────────────────────────────────── */

  const chartData = useMemo(() => {
    const tickets = ticketsQuery.data?.data ?? [];

    // Build day buckets for the full time range
    const buckets = new Map<string, number>();
    for (let d = 0; d < timeRange; d++) {
      const date = new Date(Date.now() - (timeRange - 1 - d) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      buckets.set(key, 0);
    }

    // Count tickets per day
    for (const t of tickets) {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      if (!created) continue;
      const key = created.toISOString().slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + 1);
      }
    }

    return Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      time: new Date(date).getTime(),
      count,
    }));
  }, [ticketsQuery.data, timeRange]);

  /* ── Stats ───────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalTickets = ticketsQuery.data?.totalCount ?? chartData.reduce((s, d) => s + d.count, 0);
    const daysWithData = chartData.filter((d) => d.count > 0).length;
    const avgPerDay = daysWithData > 0
      ? (chartData.reduce((s, d) => s + d.count, 0) / timeRange).toFixed(1)
      : "0";
    return { total: totalTickets, avgPerDay };
  }, [ticketsQuery.data, chartData, timeRange]);

  /* ── Board options for config ────────────────────────────────── */

  const boardOptions = useMemo(() => {
    const boards = boardsQuery.data ?? [];
    return [
      { value: "", label: "All Boards" },
      ...boards.map((b) => ({ value: b.id, label: b.name })),
    ];
  }, [boardsQuery.data]);

  /* ── Render ──────────────────────────────────────────────────── */

  if (ticketsQuery.isLoading) {
    return (
      <>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Unable to fetch tickets</p>
          <p className="text-xs text-muted-foreground mt-1">Check your PSA integration.</p>
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
          <span className="text-lg font-semibold">{stats.total}</span>
          <span className="text-[10px] text-muted-foreground">
            tickets in {timeRange}d &middot; {stats.avgPerDay}/day avg
          </span>
        </div>

        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v) => dateShort(v)}
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                width={24}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c1e",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                labelFormatter={(v) => dateShort(v)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${value}`, "Tickets"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={CHART_COLORS.blue}
                fill="url(#volumeGrad)"
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Ticket Volume Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Time range">
          <ConfigSelect
            value={String(timeRange)}
            onChange={(v) => onConfigChange({ ...config, timeRange: parseInt(v, 10) })}
            options={[
              { value: "7", label: "Last 7 days" },
              { value: "14", label: "Last 14 days" },
              { value: "30", label: "Last 30 days" },
            ]}
          />
        </ConfigSection>

        <ConfigSection label="Filter by board">
          <ConfigSelect
            value={boardId}
            onChange={(v) => onConfigChange({ ...config, boardId: v })}
            options={boardOptions}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
