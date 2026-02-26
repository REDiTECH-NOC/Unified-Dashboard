"use client";

import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_PALETTE } from "@/lib/chart-colors";
import { PRIORITY_CONFIG, PRIORITY_ORDER, type Priority } from "./priority-badge";
import type { TicketRowData } from "./ticket-row";

const PRIORITY_FILLS: Record<Priority, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#60a5fa",
  none: "#71717a",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#1c1c1e",
  border: "1px solid #27272a",
  borderRadius: "8px",
  fontSize: "11px",
};

interface TicketMyStatsProps {
  allTickets: TicketRowData[];
}

export function TicketMyStats({ allTickets }: TicketMyStatsProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("rcc-tickets-stats-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("rcc-tickets-stats-collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);

  const statusChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTickets) {
      counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      }));
  }, [allTickets]);

  const priorityData = useMemo(() => {
    return PRIORITY_ORDER.map((p) => ({
      name: PRIORITY_CONFIG[p].label,
      value: allTickets.filter((t) => t.priority === p).length,
      fill: PRIORITY_FILLS[p],
    })).filter((d) => d.value > 0);
  }, [allTickets]);

  const total = allTickets.length;

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-border/20 bg-card/50 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/10 transition-colors cursor-pointer"
      >
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          My Stats
          <span className="text-foreground font-semibold normal-case text-xs">
            {total} total
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-border/15">
          {/* Status donut */}
          <div className="p-4 md:border-r border-border/15">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Tickets by Status
            </p>
            <div className="flex gap-3 items-center">
              <div className="h-32 w-32 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="45%"
                      outerRadius="70%"
                      paddingAngle={statusChartData.length > 1 ? 2 : 0}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v) => [v, "tickets"]}
                    />
                    <text
                      x="50%"
                      y="48%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground"
                      style={{ fontSize: "16px", fontWeight: 600 }}
                    >
                      {total}
                    </text>
                    <text
                      x="50%"
                      y="60%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground"
                      style={{ fontSize: "9px" }}
                    >
                      tickets
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                {statusChartData.map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="font-medium text-foreground ml-auto pl-2 tabular-nums">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority bar */}
          <div className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Tickets by Priority
            </p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priorityData}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "#71717a" }}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [v, "tickets"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {priorityData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
