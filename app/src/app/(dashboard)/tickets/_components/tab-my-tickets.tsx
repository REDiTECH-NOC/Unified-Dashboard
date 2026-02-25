"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { UserCheck, ArrowUpRight, Zap, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketTable } from "./ticket-table";
import { TicketStatsBar } from "./ticket-stats-bar";
import { TimeRangePicker, getTimeRangeDate, type TimeRange } from "./ticket-filters";
import { PRIORITY_ORDER, type Priority } from "./priority-badge";
import type { TicketHub } from "./use-ticket-hub";

type SortBy = "priority" | "newest" | "oldest" | "updated";

/** Statuses considered "closed" — filter these out of My Tickets */
const CLOSED_STATUSES = ["closed", "completed", "resolved", "cancelled", "canceled"];

function isClosedStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return CLOSED_STATUSES.some((s) => lower.includes(s));
}

interface TabMyTicketsProps {
  hub: TicketHub;
  onMyCountChange?: (count: number) => void;
}

export function TabMyTickets({ hub, onMyCountChange }: TabMyTicketsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const createdAfter = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);

  useEffect(() => { setPage(1); }, [timeRange, sortBy]);

  const tickets = trpc.psa.getTickets.useQuery(
    {
      assignedTo: hub.myIdentifier!,
      createdAfter,
      page,
      pageSize,
    },
    {
      enabled: !!hub.myIdentifier,
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  // Filter out closed tickets, then sort
  const sortedTickets = useMemo(() => {
    const data = (tickets.data?.data ?? []).filter((t) => !isClosedStatus(t.status));
    const arr = [...data];
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    switch (sortBy) {
      case "priority":
        arr.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
        break;
      case "newest":
        arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case "updated":
        arr.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime());
        break;
    }
    return arr;
  }, [tickets.data, sortBy]);

  // Quick stats
  const quickStats = useMemo(() => {
    const data = sortedTickets;
    return {
      critical: data.filter((t) => t.priority === "critical").length,
      high: data.filter((t) => t.priority === "high").length,
      total: data.length,
      updated: data.filter((t) => {
        const updated = new Date(t.updatedAt ?? t.createdAt);
        return Date.now() - updated.getTime() < 3600000;
      }).length,
    };
  }, [sortedTickets]);

  // Report count to parent for tab badge
  useEffect(() => {
    if (onMyCountChange) {
      onMyCountChange(sortedTickets.length);
    }
  }, [sortedTickets.length]);

  // Not mapped to CW yet
  if (hub.myMember.data === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-border/30 bg-card/50">
        <UserCheck className="h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium">Map your ConnectWise account</p>
        <p className="text-xs text-muted-foreground mt-1">
          Link your ConnectWise member in Settings to see your tickets here.
        </p>
        <Link
          href="/settings/integrations/connectwise"
          className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
        >
          CW Settings <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Quick stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={quickStats.total}
          icon={<Zap className="h-4 w-4" />}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          label="Critical"
          value={quickStats.critical}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-red-400"
          bgColor="bg-red-500/10"
          highlight={quickStats.critical > 0}
        />
        <StatCard
          label="High Priority"
          value={quickStats.high}
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-orange-400"
          bgColor="bg-orange-500/10"
        />
        <StatCard
          label="Updated < 1hr"
          value={quickStats.updated}
          icon={<Clock className="h-4 w-4" />}
          color="text-blue-400"
          bgColor="bg-blue-500/10"
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TicketStatsBar tickets={sortedTickets} />
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="h-8 rounded-md border border-border/50 bg-background px-3 text-xs"
          >
            <option value="priority">Sort: Priority</option>
            <option value="updated">Sort: Recently updated</option>
            <option value="newest">Sort: Newest first</option>
            <option value="oldest">Sort: Oldest first</option>
          </select>
          <TimeRangePicker value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Table */}
      <TicketTable
        tickets={sortedTickets}
        isLoading={tickets.isLoading || hub.myMember.isLoading}
        hasMore={tickets.data?.hasMore}
        page={page}
        onPageChange={setPage}
        showQuickActions
        hub={hub}
        emptyMessage="No open tickets assigned to you"
        emptySubMessage={timeRange !== "all" ? "Try expanding the time range" : "You have no open tickets in ConnectWise"}
      />
    </div>
  );
}

/* ─── Stat Card ─── */

function StatCard({
  label,
  value,
  icon,
  color,
  bgColor,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border border-border/20 px-4 py-3.5 flex items-center gap-3.5 transition-colors",
      highlight ? "bg-red-500/5 border-red-500/20" : "bg-card/50"
    )}>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", bgColor, color)}>
        {icon}
      </div>
      <div>
        <p className={cn("text-2xl font-bold tabular-nums leading-none", highlight && "text-red-400")}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

