"use client";

import { useMemo, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Columns3, Loader2 } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigSelect, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  none: "bg-zinc-500",
};

const COLUMN_COLORS = [
  "border-blue-500",
  "border-yellow-500",
  "border-orange-500",
  "border-purple-500",
  "border-red-500",
  "border-green-500",
  "border-cyan-500",
  "border-pink-500",
];

export function TicketBoardModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  // Config: multi-board via boardIds array (migrates from legacy single boardId)
  const boardIds: string[] = useMemo(() => {
    if (Array.isArray(config.boardIds) && config.boardIds.length > 0) return config.boardIds as string[];
    if (config.board) return [config.board as string];
    return [];
  }, [config.boardIds, config.board]);
  const maxPerColumn = (config.maxPerColumn as number) || 5;
  const hiddenStatuses = (config.hiddenStatuses as string[]) || [];
  const myTicketsOnly = config.myTicketsOnly !== false; // Default true

  // Fetch boards for the config panel
  const boards = trpc.psa.getBoards.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // Auto-select first board if none configured
  useEffect(() => {
    if (boardIds.length === 0 && boards.data && boards.data.length > 0) {
      onConfigChange({ ...config, boardIds: [String(boards.data[0].id)], myTicketsOnly: true });
    }
  }, [boardIds.length, boards.data]);

  // Get current user's CW member identifier for "My Tickets" filtering
  const myMember = trpc.psa.getMyMemberId.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const members = trpc.psa.getMembers.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: !!myMember.data,
  });

  const myIdentifier = useMemo(() => {
    if (!myMember.data || !members.data) return null;
    const match = members.data.find((m) => m.id === myMember.data);
    return match?.identifier ?? null;
  }, [myMember.data, members.data]);

  // Single server-side call that fetches statuses + tickets for all boards
  const boardData = trpc.psa.getMultiBoardData.useQuery(
    {
      boardIds,
      ...(myTicketsOnly && myIdentifier ? { assignedTo: myIdentifier } : {}),
    },
    {
      enabled: boardIds.length > 0 && (!myTicketsOnly || myIdentifier !== null || !myMember.data),
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  const isLoading =
    boardData.isLoading ||
    (myTicketsOnly && (myMember.isLoading || members.isLoading));

  // Group tickets by status into columns
  const columns = useMemo(() => {
    if (!boardData.data) return [];
    const { statuses, tickets } = boardData.data;
    if (statuses.length === 0) return [];

    const ticketsByStatus = new Map<string, typeof tickets>();
    for (const s of statuses) {
      ticketsByStatus.set(s.name, []);
    }
    for (const t of tickets) {
      const existing = ticketsByStatus.get(t.status);
      if (existing) existing.push(t);
      else ticketsByStatus.set(t.status, [t]);
    }
    return statuses
      .filter((s) => !hiddenStatuses.includes(s.name))
      .map((s, i) => ({
        status: s.name,
        color: COLUMN_COLORS[i % COLUMN_COLORS.length],
        tickets: ticketsByStatus.get(s.name) ?? [],
      }));
  }, [boardData.data, hiddenStatuses]);

  if (boardIds.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Columns3 className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No board selected</p>
          <p className="text-xs text-muted-foreground mt-1">Click the gear icon to select boards.</p>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  if (boardData.error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Columns3 className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Failed to load board</p>
          <p className="text-xs text-muted-foreground mt-1">
            {/not valid JSON|Unexpected token|fetch failed|NetworkError/i.test(boardData.error.message)
              ? "Connection error — try refreshing."
              : boardData.error.message}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (columns.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Columns3 className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">
            {myTicketsOnly ? "No tickets assigned to you" : "No statuses found"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {myTicketsOnly
              ? "Try switching to All Tickets in settings."
              : "Selected boards have no active statuses."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  const totalTickets = boardData.data?.totalTickets ?? 0;

  return (
    <>
      {/* Mode toggle bar */}
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onConfigChange({ ...config, myTicketsOnly: true })}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
              myTicketsOnly
                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            My Tickets
          </button>
          <button
            onClick={() => onConfigChange({ ...config, myTicketsOnly: false })}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors",
              !myTicketsOnly
                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Tickets
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {totalTickets} ticket{totalTickets !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {columns.map((col) => (
            <div key={col.status} className={cn("w-44 shrink-0 rounded-lg border-t-2 bg-muted/20 p-2", col.color)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-foreground uppercase tracking-wide truncate">
                  {col.status}
                </span>
                <span className="text-[10px] text-muted-foreground">{col.tickets.length}</span>
              </div>
              <div className="space-y-1.5 min-h-[60px]">
                {col.tickets.length === 0 ? (
                  <div className="rounded bg-muted/30 border border-border/50 p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">No tickets</p>
                  </div>
                ) : (
                  col.tickets.slice(0, maxPerColumn).map((t) => (
                    <Link
                      key={t.sourceId}
                      href="/tickets"
                      className="block rounded bg-card border border-border/50 p-2 hover:border-border transition-colors"
                    >
                      <div className="flex items-start gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0", PRIORITY_DOT[t.priority])} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium truncate">{t.summary}</p>
                          <p className="text-[9px] text-muted-foreground truncate">
                            {t.companyName ?? "—"}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
                {col.tickets.length > maxPerColumn && (
                  <p className="text-[9px] text-center text-muted-foreground">
                    +{col.tickets.length - maxPerColumn} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Ticket Board Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Ticket filter">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onConfigChange({ ...config, myTicketsOnly: true })}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                myTicketsOnly
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              My Tickets
            </button>
            <button
              onClick={() => onConfigChange({ ...config, myTicketsOnly: false })}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                !myTicketsOnly
                  ? "border-red-500/50 bg-red-500/10 text-red-400"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              All Tickets
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {myTicketsOnly
              ? "Showing only tickets assigned to you."
              : "Showing all tickets from selected boards."}
          </p>
        </ConfigSection>

        <ConfigSection label="Boards">
          <p className="text-[10px] text-muted-foreground mb-2">
            Select one or more boards. Tickets from all selected boards are combined.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(boards.data ?? []).map((b) => {
              const bid = String(b.id);
              const isSelected = boardIds.includes(bid);
              return (
                <ConfigChip
                  key={bid}
                  label={b.name}
                  active={isSelected}
                  onClick={() => {
                    const next = isSelected
                      ? boardIds.filter((id) => id !== bid)
                      : [...boardIds, bid];
                    onConfigChange({ ...config, boardIds: next, board: undefined });
                  }}
                />
              );
            })}
          </div>
        </ConfigSection>

        {boardData.data && boardData.data.statuses.length > 0 && (
          <ConfigSection label="Visible statuses">
            <p className="text-[10px] text-muted-foreground mb-2">
              Click to toggle columns. Hidden statuses won&apos;t appear on the board.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {boardData.data.statuses.map((s) => {
                const isVisible = !hiddenStatuses.includes(s.name);
                return (
                  <ConfigChip
                    key={s.name}
                    label={s.name}
                    active={isVisible}
                    onClick={() => {
                      const next = isVisible
                        ? [...hiddenStatuses, s.name]
                        : hiddenStatuses.filter((n) => n !== s.name);
                      onConfigChange({ ...config, hiddenStatuses: next });
                    }}
                  />
                );
              })}
            </div>
          </ConfigSection>
        )}

        <ConfigSection label="Max tickets per column">
          <ConfigSelect
            value={String(maxPerColumn)}
            onChange={(v) => onConfigChange({ ...config, maxPerColumn: parseInt(v, 10) })}
            options={[
              { value: "3", label: "3 tickets" },
              { value: "5", label: "5 tickets" },
              { value: "10", label: "10 tickets" },
              { value: "15", label: "15 tickets" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
