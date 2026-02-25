"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Ticket, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TicketRow, type TicketRowData } from "./ticket-row";
import type { TicketHub } from "./use-ticket-hub";

import { GRID_COLS, GRID_COLS_ACTIONS } from "./grid-layout";

type SortField = "id" | "summary" | "board" | "company" | "status" | "hours" | "item" | "updated" | "priority";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, none: 4,
};

interface TicketTableProps {
  tickets: TicketRowData[];
  isLoading: boolean;
  hasMore?: boolean;
  page: number;
  onPageChange: (page: number) => void;
  showQuickActions?: boolean;
  hub: TicketHub;
  emptyMessage?: string;
  emptySubMessage?: string;
}

export function TicketTable({
  tickets,
  isLoading,
  hasMore = false,
  page,
  onPageChange,
  showQuickActions = false,
  hub,
  emptyMessage = "No tickets found",
  emptySubMessage,
}: TicketTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
  }

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortField(null); setSortDir("asc"); } // third click clears sort
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField, sortDir]);

  const sortedTickets = useMemo(() => {
    if (!sortField) return tickets;

    return [...tickets].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "id":
          cmp = Number(a.sourceId) - Number(b.sourceId);
          break;
        case "summary":
          cmp = (a.summary ?? "").localeCompare(b.summary ?? "");
          break;
        case "board":
          cmp = (a.board ?? "").localeCompare(b.board ?? "");
          break;
        case "company":
          cmp = (a.companyName ?? "").localeCompare(b.companyName ?? "");
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "");
          break;
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
          break;
        case "hours": {
          const aH = (a._raw as any)?.actualHours ?? 0;
          const bH = (b._raw as any)?.actualHours ?? 0;
          cmp = aH - bH;
          break;
        }
        case "item": {
          const aI = (a._raw as any)?.item?.name ?? "";
          const bI = (b._raw as any)?.item?.name ?? "";
          cmp = aI.localeCompare(bI);
          break;
        }
        case "updated": {
          const aT = (a.updatedAt ?? a.createdAt).getTime();
          const bT = (b.updatedAt ?? b.createdAt).getTime();
          cmp = aT - bT;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tickets, sortField, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-xl border border-border/30 bg-card/50">
        <Ticket className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">{emptyMessage}</p>
        {emptySubMessage && <p className="text-xs mt-1 text-muted-foreground/70">{emptySubMessage}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className={cn(
        "grid items-center gap-x-3 px-5 py-2.5 border-b border-border/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/5",
        showQuickActions ? GRID_COLS_ACTIONS : GRID_COLS
      )}>
        <div />
        <SortHeader field="priority" label="" current={sortField} dir={sortDir} onSort={toggleSort} />
        <SortHeader field="id" label="#" current={sortField} dir={sortDir} onSort={toggleSort} />
        <SortHeader field="summary" label="Summary" current={sortField} dir={sortDir} onSort={toggleSort} />
        <SortHeader field="board" label="Board" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden md:flex" />
        <SortHeader field="company" label="Company" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden lg:flex" />
        <SortHeader field="status" label="Status" current={sortField} dir={sortDir} onSort={toggleSort} justify="center" />
        <SortHeader field="hours" label="Hours" current={sortField} dir={sortDir} onSort={toggleSort} justify="right" className="hidden md:flex" />
        <SortHeader field="item" label="Item" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden xl:flex" />
        <SortHeader field="updated" label="Updated" current={sortField} dir={sortDir} onSort={toggleSort} justify="right" className="hidden sm:flex" />
        {showQuickActions && <div />}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/15">
        {sortedTickets.map((ticket) => (
          <TicketRow
            key={ticket.sourceId}
            ticket={ticket}
            expanded={expandedId === ticket.sourceId}
            onToggle={toggleExpand}
            showQuickActions={showQuickActions}
            hub={hub}
          />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-muted/5">
        <span className="text-xs text-muted-foreground">
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} &middot; Page {page}
          {sortField && <span className="ml-2 text-primary/70">Sorted by {sortField}</span>}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable Column Header ─── */
function SortHeader({
  field, label, current, dir, onSort, className, justify,
}: {
  field: SortField;
  label: string;
  current: SortField | null;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
  justify?: "left" | "center" | "right";
}) {
  const active = current === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={cn(
        "flex items-center gap-0.5 select-none cursor-pointer hover:text-foreground transition-colors group",
        justify === "center" && "justify-center",
        justify === "right" && "justify-end",
        active && "text-foreground",
        className,
      )}
    >
      {label && <span>{label}</span>}
      <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3" />
        )}
      </span>
    </button>
  );
}
