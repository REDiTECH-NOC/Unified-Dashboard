"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  UserCheck,
  ArrowUpRight,
  Zap,
  Clock,
  AlertTriangle,
  Layers,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketTable } from "./ticket-table";
import { TicketStatsBar } from "./ticket-stats-bar";
import { TicketMyStats } from "./ticket-my-stats";
import { TicketStatusChipBar, statusBorderColor } from "./ticket-status-chip-bar";
import { TimeRangePicker, getTimeRangeDate, type TimeRange } from "./ticket-filters";
import type { TicketRowData } from "./ticket-row";
import type { TicketHub } from "./use-ticket-hub";

type SortBy = "priority" | "newest" | "oldest" | "updated";

/** Statuses considered "closed" — used for default filter initialization */
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
  const utils = trpc.useUtils();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortBy, setSortBy] = useState<SortBy>("priority");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Preferences
  const ticketPrefs = trpc.user.getTicketPreferences.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const savePrefs = trpc.user.saveTicketPreferences.useMutation({
    onSuccess: () => {
      utils.user.getTicketPreferences.invalidate();
    },
  });

  // Status filter — null until prefs + data load
  const [activeStatuses, setActiveStatuses] = useState<string[] | null>(null);

  // Group-by-status toggle
  const [groupByStatus, setGroupByStatus] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const createdAfter = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);

  useEffect(() => {
    setPage(1);
  }, [timeRange, sortBy]);

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

  const allTicketData = tickets.data?.data ?? [];

  // Available statuses from the full dataset
  const availableStatuses = useMemo(() => {
    const seen = new Set<string>();
    for (const t of allTicketData) seen.add(t.status);
    return Array.from(seen).sort();
  }, [allTicketData]);

  // Counts per status
  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTicketData) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [allTicketData]);

  // Initialize active statuses from preferences once data is loaded
  useEffect(() => {
    if (activeStatuses !== null) return;
    if (ticketPrefs.isLoading) return;
    if (availableStatuses.length === 0) return;

    if (ticketPrefs.data?.myDefaultStatuses) {
      const valid = ticketPrefs.data.myDefaultStatuses.filter((s) =>
        availableStatuses.includes(s)
      );
      setActiveStatuses(valid.length > 0 ? valid : availableStatuses.filter((s) => !isClosedStatus(s)));
    } else {
      setActiveStatuses(availableStatuses.filter((s) => !isClosedStatus(s)));
    }
  }, [activeStatuses, ticketPrefs.data, ticketPrefs.isLoading, availableStatuses]);

  // When new statuses appear (e.g. time range change), auto-include non-closed ones
  useEffect(() => {
    if (!availableStatuses.length || activeStatuses === null) return;
    const newStatuses = availableStatuses.filter(
      (s) => !activeStatuses.includes(s) && !isClosedStatus(s)
    );
    if (newStatuses.length > 0) {
      setActiveStatuses((prev) => [...(prev ?? []), ...newStatuses]);
    }
  }, [availableStatuses]);

  // Filter by active statuses, then sort
  const sortedTickets = useMemo(() => {
    const data =
      activeStatuses === null
        ? []
        : activeStatuses.length === 0
          ? allTicketData
          : allTicketData.filter((t) => activeStatuses.includes(t.status));

    const arr = [...data];
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      none: 4,
    };
    switch (sortBy) {
      case "priority":
        arr.sort(
          (a, b) =>
            (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
        );
        break;
      case "newest":
        arr.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case "oldest":
        arr.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "updated":
        arr.sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime()
        );
        break;
    }
    return arr;
  }, [allTicketData, sortBy, activeStatuses]);

  // Grouped view data
  const groupedTickets = useMemo(() => {
    if (!groupByStatus) return null;
    const groups = new Map<string, TicketRowData[]>();
    for (const status of activeStatuses ?? []) {
      groups.set(status, []);
    }
    for (const t of sortedTickets) {
      const existing = groups.get(t.status);
      if (existing) existing.push(t);
      else groups.set(t.status, [t]);
    }
    return Array.from(groups.entries()).filter(([, ts]) => ts.length > 0);
  }, [sortedTickets, groupByStatus, activeStatuses]);

  // Quick stats (based on filtered tickets)
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
      {/* Stats panel (charts) */}
      {!tickets.isLoading && allTicketData.length > 0 && (
        <TicketMyStats allTickets={allTicketData} />
      )}

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Visible Tickets"
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

      {/* Status chip bar */}
      {availableStatuses.length > 0 && (
        <TicketStatusChipBar
          availableStatuses={availableStatuses}
          activeStatuses={activeStatuses ?? []}
          countsByStatus={countsByStatus}
          onChange={setActiveStatuses}
          onSaveDefault={(statuses) => {
            savePrefs.mutate({ myDefaultStatuses: statuses });
          }}
          defaultStatuses={ticketPrefs.data?.myDefaultStatuses ?? null}
          isSaving={savePrefs.isPending}
          label="Show:"
        />
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TicketStatsBar tickets={sortedTickets} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGroupByStatus(!groupByStatus)}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors cursor-pointer",
              groupByStatus
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Group by status
          </button>
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

      {/* Table — flat or grouped */}
      {groupByStatus && groupedTickets ? (
        <TicketGroupedView
          groups={groupedTickets}
          collapsedSections={collapsedSections}
          onToggleSection={(status) => {
            setCollapsedSections((prev) => {
              const next = new Set(prev);
              if (next.has(status)) next.delete(status);
              else next.add(status);
              return next;
            });
          }}
          isLoading={tickets.isLoading || hub.myMember.isLoading}
          hub={hub}
        />
      ) : (
        <TicketTable
          tickets={sortedTickets}
          isLoading={tickets.isLoading || hub.myMember.isLoading}
          hasMore={tickets.data?.hasMore}
          page={page}
          onPageChange={setPage}
          showQuickActions
          hub={hub}
          emptyMessage="No tickets matching your status filter"
          emptySubMessage={
            activeStatuses?.length === 0
              ? "Toggle some statuses above to see tickets"
              : timeRange !== "all"
                ? "Try expanding the time range"
                : "You have no open tickets in ConnectWise"
          }
        />
      )}
    </div>
  );
}

/* ─── Grouped View ─── */

function TicketGroupedView({
  groups,
  collapsedSections,
  onToggleSection,
  isLoading,
  hub,
}: {
  groups: Array<[string, TicketRowData[]]>;
  collapsedSections: Set<string>;
  onToggleSection: (status: string) => void;
  isLoading: boolean;
  hub: TicketHub;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-border/30 bg-card/50">
        <p className="text-sm font-medium">No tickets matching your status filter</p>
        <p className="text-xs mt-1 text-muted-foreground/70">Toggle some statuses above to see tickets</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([status, tickets]) => {
        const isCollapsed = collapsedSections.has(status);
        return (
          <div
            key={status}
            className="rounded-xl border border-border/20 overflow-hidden"
          >
            <button
              onClick={() => onToggleSection(status)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-muted/10 cursor-pointer",
                "border-l-2",
                statusBorderColor(status)
              )}
            >
              <div className="flex items-center gap-2.5">
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {status}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted/20 text-muted-foreground">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
              </span>
            </button>

            {!isCollapsed && (
              <TicketTable
                tickets={tickets}
                isLoading={false}
                hasMore={false}
                page={1}
                onPageChange={() => {}}
                showQuickActions
                hub={hub}
                emptyMessage=""
              />
            )}
          </div>
        );
      })}
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
    <div
      className={cn(
        "rounded-xl border border-border/20 px-4 py-3.5 flex items-center gap-3.5 transition-colors",
        highlight ? "bg-red-500/5 border-red-500/20" : "bg-card/50"
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center",
          bgColor,
          color
        )}
      >
        {icon}
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            highlight && "text-red-400"
          )}
        >
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}
