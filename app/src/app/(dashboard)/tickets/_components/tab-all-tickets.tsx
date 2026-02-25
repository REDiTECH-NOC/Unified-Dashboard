"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AlertCircle } from "lucide-react";
import { TicketTable } from "./ticket-table";
import { TicketStatsBar } from "./ticket-stats-bar";
import { TicketFilters, getTimeRangeDate, type TicketFilterValues } from "./ticket-filters";
import type { TicketHub } from "./use-ticket-hub";

interface TabAllTicketsProps {
  hub: TicketHub;
  /** Pre-fill company filter (from "Company Tickets" button) */
  initialCompanyId?: string;
  /** Pre-fill search with contact name (from "Contact Tickets" button) */
  initialContactSearch?: string;
}

export function TabAllTickets({ hub, initialCompanyId, initialContactSearch }: TabAllTicketsProps) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TicketFilterValues>(() => ({
    searchTerm: initialContactSearch ?? "",
    companyFilter: initialCompanyId,
    timeRange: initialCompanyId || initialContactSearch ? "all" : "30d",
  }));

  const createdAfter = useMemo(() => getTimeRangeDate(filters.timeRange), [filters.timeRange]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [
    filters.searchTerm,
    filters.boardFilter,
    filters.statusFilter,
    filters.priorityFilter,
    filters.companyFilter,
    filters.assignedFilter,
    filters.timeRange,
  ]);

  const boardStatuses = trpc.psa.getBoardStatuses.useQuery(
    { boardId: filters.boardFilter! },
    { enabled: !!filters.boardFilter, staleTime: 5 * 60_000, retry: 1 }
  );

  const tickets = trpc.psa.getTickets.useQuery(
    {
      boardId: filters.boardFilter,
      status: filters.statusFilter,
      priority: filters.priorityFilter,
      companyId: filters.companyFilter,
      assignedTo: filters.assignedFilter,
      searchTerm: filters.searchTerm || undefined,
      createdAfter,
      page,
      pageSize: 25,
    },
    {
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  const ticketData = tickets.data?.data ?? [];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <TicketFilters
        values={filters}
        onChange={setFilters}
        hub={hub}
        boardStatuses={boardStatuses.data}
      />

      {/* Stats */}
      {!tickets.isLoading && ticketData.length > 0 && (
        <TicketStatsBar tickets={ticketData} />
      )}

      {/* Error state (PSA not connected) */}
      {tickets.error && ticketData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-border/30 bg-card/50">
          <AlertCircle className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Unable to load tickets</p>
          <p className="text-xs mt-1">
            {/not valid JSON|Unexpected token|fetch failed|NetworkError/i.test(tickets.error.message)
              ? "Connection error \u2014 try refreshing."
              : tickets.error.message}
          </p>
          <p className="text-xs mt-3 text-muted-foreground">Make sure ConnectWise PSA is connected in Settings &gt; Integrations</p>
        </div>
      ) : (
        <TicketTable
          tickets={ticketData}
          isLoading={tickets.isLoading}
          hasMore={tickets.data?.hasMore}
          page={page}
          onPageChange={setPage}
          hub={hub}
          emptyMessage="No tickets found"
          emptySubMessage={
            [filters.searchTerm, filters.boardFilter, filters.statusFilter, filters.priorityFilter, filters.companyFilter, filters.assignedFilter].some(Boolean)
              ? "Try adjusting your filters"
              : "No tickets in the selected time range"
          }
        />
      )}
    </div>
  );
}
