"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_CONFIG, type Priority } from "./priority-badge";
import type { TicketHub } from "./use-ticket-hub";

/* ─── Time range ─── */
export type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

export const TIME_RANGES: { id: TimeRange; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
];

export function getTimeRangeDate(range: TimeRange): Date | undefined {
  if (range === "all") return undefined;
  const ms = { "24h": 86400000, "7d": 604800000, "30d": 2592000000, "90d": 7776000000 };
  return new Date(Date.now() - ms[range]);
}

/* ─── Time Range Picker ─── */
export function TimeRangePicker({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex rounded-md border border-border/50 overflow-hidden">
      {TIME_RANGES.map((r, i) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium transition-colors",
            i > 0 && "border-l border-border/50",
            value === r.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Full filter bar (All Tickets tab) ─── */
export interface TicketFilterValues {
  searchTerm: string;
  boardFilter?: string;
  statusFilter?: string;
  priorityFilter?: Priority;
  companyFilter?: string;
  assignedFilter?: string;
  timeRange: TimeRange;
}

interface TicketFiltersProps {
  values: TicketFilterValues;
  onChange: (values: TicketFilterValues) => void;
  hub: TicketHub;
  boardStatuses?: Array<{ id: string; name: string }>;
  showAssigned?: boolean;
  hideBoard?: boolean;
  hideStatus?: boolean;
}

export function TicketFilters({ values, onChange, hub, boardStatuses, showAssigned = true, hideBoard = false, hideStatus = false }: TicketFiltersProps) {
  const [searchInput, setSearchInput] = useState(values.searchTerm);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      onChange({ ...values, searchTerm: val });
    }, 400);
  }, [values, onChange]);

  // Sync if values.searchTerm is cleared externally
  useEffect(() => {
    if (!values.searchTerm && searchInput) setSearchInput("");
  }, [values.searchTerm]);

  const activeCount = [
    !hideBoard && values.boardFilter,
    !hideStatus && values.statusFilter,
    values.priorityFilter,
    values.companyFilter,
    values.assignedFilter,
    values.searchTerm,
  ].filter(Boolean).length;

  function clear() {
    setSearchInput("");
    onChange({
      searchTerm: "",
      boardFilter: undefined,
      statusFilter: undefined,
      priorityFilter: undefined,
      companyFilter: undefined,
      assignedFilter: undefined,
      timeRange: values.timeRange,
    });
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tickets by summary..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 h-8 text-xs"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Board */}
        {!hideBoard && (
          <div>
            <select
              value={values.boardFilter ?? ""}
              onChange={(e) => onChange({
                ...values,
                boardFilter: e.target.value || undefined,
                statusFilter: undefined,
              })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">All Boards</option>
              {hub.boards.data?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status */}
        {!hideStatus && (
          <div>
            <select
              value={values.statusFilter ?? ""}
              onChange={(e) => onChange({ ...values, statusFilter: e.target.value || undefined })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              disabled={!values.boardFilter}
            >
              <option value="">{values.boardFilter ? "All Statuses" : "Select board first"}</option>
              {boardStatuses?.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Priority */}
        <div>
          <select
            value={values.priorityFilter ?? ""}
            onChange={(e) => onChange({ ...values, priorityFilter: (e.target.value || undefined) as Priority | undefined })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">All Priorities</option>
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        </div>

        {/* Assigned To */}
        {showAssigned && (
          <div>
            <select
              value={values.assignedFilter ?? ""}
              onChange={(e) => onChange({ ...values, assignedFilter: e.target.value || undefined })}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">All Members</option>
              {hub.members.data?.map((m) => (
                <option key={m.id} value={m.identifier}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Time range */}
        <TimeRangePicker value={values.timeRange} onChange={(v) => onChange({ ...values, timeRange: v })} />

        {/* Clear */}
        {activeCount > 0 && (
          <button onClick={clear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Clear filters
            <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-0.5">{activeCount}</Badge>
          </button>
        )}
      </div>
    </div>
  );
}
