"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketTable } from "./ticket-table";
import { TicketStatsBar } from "./ticket-stats-bar";
import { TicketStatusChipBar } from "./ticket-status-chip-bar";
import { TicketFilters, getTimeRangeDate, type TicketFilterValues } from "./ticket-filters";
import type { TicketRowData } from "./ticket-row";
import type { TicketHub } from "./use-ticket-hub";

const CLOSED_STATUSES = ["closed", "completed", "resolved", "cancelled", "canceled"];

function isClosedStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return CLOSED_STATUSES.some((s) => lower.includes(s));
}

interface TabAllTicketsProps {
  hub: TicketHub;
  /** Pre-fill company filter (from "Company Tickets" button) */
  initialCompanyId?: string;
  /** Pre-fill search with contact name (from "Contact Tickets" button) */
  initialContactSearch?: string;
  /** Deep-link to a specific ticket ID (from notification click) */
  initialTicketId?: string;
}

export function TabAllTickets({ hub, initialCompanyId, initialContactSearch, initialTicketId }: TabAllTicketsProps) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TicketFilterValues>(() => ({
    searchTerm: initialTicketId ?? initialContactSearch ?? "",
    companyFilter: initialCompanyId,
    timeRange: initialCompanyId || initialContactSearch || initialTicketId ? "all" : "30d",
  }));

  // Preferences
  const ticketPrefs = trpc.user.getTicketPreferences.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const savePrefs = trpc.user.saveTicketPreferences.useMutation({
    onSuccess: () => {
      utils.user.getTicketPreferences.invalidate();
    },
  });

  // Active boards — null until prefs load
  const [activeBoards, setActiveBoards] = useState<string[] | null>(null);
  // Active statuses for chip bar — null until initialized
  const [activeStatusFilters, setActiveStatusFilters] = useState<string[] | null>(null);

  const createdAfter = useMemo(() => getTimeRangeDate(filters.timeRange), [filters.timeRange]);

  // Detect ticket ID searches (pure digits, 3+ chars) → direct lookup
  const directTicketId = useMemo(() => {
    const term = filters.searchTerm.trim();
    if (/^\d{3,}$/.test(term)) return term;
    return null;
  }, [filters.searchTerm]);

  const directTicket = trpc.psa.getTicketById.useQuery(
    { id: directTicketId! },
    { enabled: !!directTicketId, retry: false, staleTime: 30_000 }
  );

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [
    filters.searchTerm,
    filters.priorityFilter,
    filters.companyFilter,
    filters.assignedFilter,
    filters.timeRange,
    activeBoards,
    activeStatusFilters,
  ]);

  // Initialize board chips from preferences
  useEffect(() => {
    if (activeBoards !== null) return;
    if (ticketPrefs.isLoading || hub.boards.isLoading) return;
    const allBoardIds = (hub.boards.data ?? []).map((b) => String(b.id));
    if (allBoardIds.length === 0) return;

    if (ticketPrefs.data?.allDefaultBoards && ticketPrefs.data.allDefaultBoards.length > 0) {
      const valid = ticketPrefs.data.allDefaultBoards.filter((id) => allBoardIds.includes(id));
      setActiveBoards(valid.length > 0 ? valid : allBoardIds);
    } else {
      setActiveBoards(allBoardIds); // show all by default
    }
  }, [activeBoards, ticketPrefs.data, ticketPrefs.isLoading, hub.boards.data, hub.boards.isLoading]);

  // Determine fetch mode
  const allBoardIds = useMemo(
    () => (hub.boards.data ?? []).map((b) => String(b.id)),
    [hub.boards.data]
  );
  const isAllBoards = useMemo(() => {
    if (!activeBoards || !allBoardIds.length) return true;
    return activeBoards.length === allBoardIds.length;
  }, [activeBoards, allBoardIds]);
  const isSingleBoard = (activeBoards?.length ?? 0) === 1 && !isAllBoards;
  const isMultiBoard = !isAllBoards && !isSingleBoard && (activeBoards?.length ?? 0) > 1;

  // Effective board filter for getTickets (single board mode)
  const effectiveBoardId = isSingleBoard ? activeBoards![0] : undefined;

  // Single/all-board query
  const singleBoardTickets = trpc.psa.getTickets.useQuery(
    {
      boardId: effectiveBoardId,
      priority: filters.priorityFilter,
      companyId: filters.companyFilter,
      assignedTo: filters.assignedFilter,
      searchTerm: filters.searchTerm || undefined,
      createdAfter,
      page,
      pageSize: 25,
    },
    {
      enabled: !isMultiBoard,
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  // Multi-board query
  const multiBoardTickets = trpc.psa.getMultiBoardData.useQuery(
    {
      boardIds: activeBoards ?? [],
      assignedTo: filters.assignedFilter,
    },
    {
      enabled: isMultiBoard && (activeBoards?.length ?? 0) > 0,
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  // Board statuses for the single-board case (used for status chips)
  const boardStatuses = trpc.psa.getBoardStatuses.useQuery(
    { boardId: effectiveBoardId! },
    { enabled: !!effectiveBoardId, staleTime: 5 * 60_000, retry: 1 }
  );

  // Available statuses for the chip bar
  const availableAllStatuses = useMemo(() => {
    if (isMultiBoard) {
      return (multiBoardTickets.data?.statuses ?? []).map((s) => s.name);
    }
    if (effectiveBoardId) {
      return (boardStatuses.data ?? []).map((s) => s.name);
    }
    // All boards mode — derive from ticket data
    const seen = new Set<string>();
    for (const t of singleBoardTickets.data?.data ?? []) seen.add(t.status);
    return Array.from(seen).sort();
  }, [isMultiBoard, multiBoardTickets.data, effectiveBoardId, boardStatuses.data, singleBoardTickets.data]);

  // Initialize status filter from preferences
  useEffect(() => {
    if (activeStatusFilters !== null) return;
    if (availableAllStatuses.length === 0) return;

    if (ticketPrefs.data?.allDefaultStatuses) {
      const valid = ticketPrefs.data.allDefaultStatuses.filter((s) =>
        availableAllStatuses.includes(s)
      );
      setActiveStatusFilters(
        valid.length > 0
          ? valid
          : availableAllStatuses.filter((s) => !isClosedStatus(s))
      );
    } else {
      setActiveStatusFilters(availableAllStatuses.filter((s) => !isClosedStatus(s)));
    }
  }, [activeStatusFilters, availableAllStatuses, ticketPrefs.data]);

  // Reset status filter when boards change (new statuses may appear)
  useEffect(() => {
    if (!availableAllStatuses.length || activeStatusFilters === null) return;
    const newStatuses = availableAllStatuses.filter(
      (s) => !activeStatusFilters.includes(s) && !isClosedStatus(s)
    );
    if (newStatuses.length > 0) {
      setActiveStatusFilters((prev) => [...(prev ?? []), ...newStatuses]);
    }
  }, [availableAllStatuses]);

  // Derive final ticket list
  const ticketData = useMemo(() => {
    let raw: TicketRowData[];

    if (isMultiBoard) {
      raw = multiBoardTickets.data?.tickets ?? [];
      // Apply client-side filters that getMultiBoardData doesn't support
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        raw = raw.filter(
          (t) =>
            t.summary.toLowerCase().includes(term) ||
            t.sourceId.includes(term)
        );
      }
      if (filters.priorityFilter) {
        raw = raw.filter((t) => t.priority === filters.priorityFilter);
      }
      if (filters.companyFilter) {
        raw = raw.filter((t) => t.companySourceId === filters.companyFilter);
      }
      if (createdAfter) {
        raw = raw.filter((t) => new Date(t.createdAt) >= createdAfter);
      }
    } else {
      raw = singleBoardTickets.data?.data ?? [];
    }

    // Apply status chip filter
    if (activeStatusFilters && activeStatusFilters.length > 0) {
      raw = raw.filter((t) => activeStatusFilters.includes(t.status));
    }

    return raw;
  }, [
    isMultiBoard,
    multiBoardTickets.data,
    singleBoardTickets.data,
    activeStatusFilters,
    filters.searchTerm,
    filters.priorityFilter,
    filters.companyFilter,
    createdAfter,
  ]);

  // Counts per status for the chip bar
  const countsByStatus = useMemo(() => {
    // Count from raw data (before status filter) so chips show actual counts
    let raw: TicketRowData[];
    if (isMultiBoard) {
      raw = multiBoardTickets.data?.tickets ?? [];
    } else {
      raw = singleBoardTickets.data?.data ?? [];
    }
    const counts: Record<string, number> = {};
    for (const t of raw) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [isMultiBoard, multiBoardTickets.data, singleBoardTickets.data]);

  const isLoading = isMultiBoard ? multiBoardTickets.isLoading : singleBoardTickets.isLoading;
  const hasError = isMultiBoard ? multiBoardTickets.error : singleBoardTickets.error;

  return (
    <div className="space-y-3">
      {/* Board chip bar */}
      {hub.boards.data && hub.boards.data.length > 1 && (
        <BoardChipBar
          boards={hub.boards.data}
          activeBoards={activeBoards ?? []}
          onChange={(boards) => {
            setActiveBoards(boards);
            // Reset status filters when boards change
            setActiveStatusFilters(null);
          }}
          onSaveDefault={(boards) => savePrefs.mutate({ allDefaultBoards: boards })}
          defaultBoards={ticketPrefs.data?.allDefaultBoards ?? null}
          isSaving={savePrefs.isPending}
        />
      )}

      {/* Status chip bar */}
      {availableAllStatuses.length > 0 && (
        <TicketStatusChipBar
          availableStatuses={availableAllStatuses}
          activeStatuses={activeStatusFilters ?? []}
          countsByStatus={countsByStatus}
          onChange={setActiveStatusFilters}
          onSaveDefault={(statuses) => savePrefs.mutate({ allDefaultStatuses: statuses })}
          defaultStatuses={ticketPrefs.data?.allDefaultStatuses ?? null}
          isSaving={savePrefs.isPending}
          label="Status:"
        />
      )}

      {/* Filters (search, priority, assignedTo, time range — board/status handled by chips) */}
      <TicketFilters
        values={filters}
        onChange={setFilters}
        hub={hub}
        boardStatuses={boardStatuses.data}
        hideBoard
        hideStatus
      />

      {/* Stats */}
      {!isLoading && ticketData.length > 0 && (
        <TicketStatsBar tickets={ticketData} />
      )}

      {/* Error state (PSA not connected) */}
      {hasError && ticketData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-border/30 bg-card/50">
          <AlertCircle className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Unable to load tickets</p>
          <p className="text-xs mt-1">
            {/not valid JSON|Unexpected token|fetch failed|NetworkError/i.test(
              (hasError as any)?.message ?? ""
            )
              ? "Connection error \u2014 try refreshing."
              : (hasError as any)?.message ?? "Unknown error"}
          </p>
          <p className="text-xs mt-3 text-muted-foreground">
            Make sure ConnectWise PSA is connected in Settings &gt; Integrations
          </p>
        </div>
      ) : (
        <TicketTable
          tickets={ticketData}
          pinnedTicket={
            directTicket.data && directTicketId ? directTicket.data : undefined
          }
          isLoading={isLoading}
          hasMore={isMultiBoard ? false : singleBoardTickets.data?.hasMore}
          page={page}
          onPageChange={setPage}
          showQuickActions
          hub={hub}
          emptyMessage="No tickets found"
          emptySubMessage={
            [
              filters.searchTerm,
              filters.priorityFilter,
              filters.companyFilter,
              filters.assignedFilter,
            ].some(Boolean) ||
            (activeStatusFilters && activeStatusFilters.length < availableAllStatuses.length)
              ? "Try adjusting your filters or toggling more statuses"
              : "No tickets in the selected time range"
          }
          autoExpandId={initialTicketId}
        />
      )}
    </div>
  );
}

/* ─── Board Chip Bar ─── */

function BoardChipBar({
  boards,
  activeBoards,
  onChange,
  onSaveDefault,
  defaultBoards,
  isSaving,
}: {
  boards: Array<{ id: string | number; name: string }>;
  activeBoards: string[];
  onChange: (ids: string[]) => void;
  onSaveDefault: (ids: string[]) => void;
  defaultBoards: string[] | null;
  isSaving: boolean;
}) {
  const allIds = useMemo(() => boards.map((b) => String(b.id)), [boards]);
  const isAllSelected = activeBoards.length === allIds.length;

  function toggle(id: string) {
    const next = activeBoards.includes(id)
      ? activeBoards.filter((b) => b !== id)
      : [...activeBoards, id];
    if (next.length === 0) return; // prevent empty selection
    onChange(next);
  }

  function selectAll() {
    onChange(allIds);
  }

  const isDirty = useMemo(() => {
    if (!defaultBoards) return activeBoards.length > 0;
    const sorted = [...activeBoards].sort();
    const defSorted = [...defaultBoards].sort();
    return JSON.stringify(sorted) !== JSON.stringify(defSorted);
  }, [activeBoards, defaultBoards]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">
        Boards:
      </span>
      <button
        onClick={selectAll}
        className={cn(
          "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer",
          isAllSelected
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/30 text-muted-foreground hover:text-foreground"
        )}
      >
        All
      </button>
      {boards.map((b) => {
        const bid = String(b.id);
        const isActive = activeBoards.includes(bid);
        return (
          <button
            key={bid}
            onClick={() => toggle(bid)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer",
              isActive && !isAllSelected
                ? "border-primary/50 bg-primary/10 text-primary"
                : isActive
                  ? "border-border/40 text-muted-foreground/70"
                  : "border-border/30 text-muted-foreground hover:text-foreground"
            )}
          >
            {b.name}
          </button>
        );
      })}
      <div className="flex items-center gap-1.5 ml-1">
        {isDirty && (
          <span className="text-[10px] text-amber-400/60">modified</span>
        )}
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <button
            onClick={() => onSaveDefault(activeBoards)}
            title="Save as my default boards"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border/20 hover:border-border/50 transition-colors cursor-pointer"
          >
            <Settings className="h-3 w-3" />
            Save default
          </button>
        )}
      </div>
    </div>
  );
}
