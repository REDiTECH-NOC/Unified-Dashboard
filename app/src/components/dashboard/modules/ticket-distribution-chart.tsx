"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_PALETTE, CHART_COLORS } from "@/lib/chart-colors";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── PRIORITY COLOR MAP ───────────────────────────────────────── */

const PRIORITY_COLORS: Record<string, string> = {
  Critical: CHART_COLORS.red,
  High: CHART_COLORS.orange,
  Medium: CHART_COLORS.amber,
  Normal: CHART_COLORS.blue,
  Low: CHART_COLORS.green,
};

/* ─── COMPONENT ─────────────────────────────────────────────────── */

export function TicketDistributionChartModule({
  config,
  onConfigChange,
  isConfigOpen,
  onConfigClose,
}: ModuleComponentProps) {
  const groupBy = (config.groupBy as string) || "status";
  const boardId = (config.boardId as string) || "";

  const ticketsQuery = trpc.psa.getTickets.useQuery(
    { boardId: boardId || undefined, pageSize: 100 },
    { retry: 1, staleTime: 30_000, refetchInterval: 60_000 }
  );

  const boardsQuery = trpc.psa.getBoards.useQuery(undefined, {
    staleTime: 300_000,
  });

  /* ── Aggregate into chart data ───────────────────────────────── */

  const chartData = useMemo(() => {
    const tickets = ticketsQuery.data?.data;
    if (!tickets || tickets.length === 0) return [];

    const counts = new Map<string, number>();

    for (const t of tickets) {
      let key: string;
      switch (groupBy) {
        case "priority":
          key = t.priority || "Unknown";
          break;
        case "board":
          key = t.board || "Unknown";
          break;
        default:
          key = t.status || "Unknown";
      }
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    // Sort by count descending
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    return sorted.map(([name, value], i) => ({
      name,
      value,
      color:
        groupBy === "priority"
          ? PRIORITY_COLORS[name] || CHART_PALETTE[i % CHART_PALETTE.length]
          : CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  }, [ticketsQuery.data, groupBy]);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

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

  if (ticketsQuery.isError || chartData.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No ticket data</p>
          <p className="text-xs text-muted-foreground mt-1">
            {ticketsQuery.isError
              ? "Unable to fetch tickets. Check your PSA integration."
              : "No tickets found for the selected filters."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full px-2 pt-1">
        {/* Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c1c1e",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${value}`, "Tickets"]}
              />
              {/* Center label */}
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground"
                style={{ fontSize: "20px", fontWeight: 600 }}
              >
                {total}
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "10px" }}
              >
                tickets
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center pb-2 px-1">
          {chartData.slice(0, 8).map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="truncate max-w-[80px]">{d.name}</span>
              <span className="font-medium text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Ticket Distribution Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Group by">
          <ConfigSelect
            value={groupBy}
            onChange={(v) => onConfigChange({ ...config, groupBy: v })}
            options={[
              { value: "status", label: "Status" },
              { value: "priority", label: "Priority" },
              { value: "board", label: "Board" },
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
