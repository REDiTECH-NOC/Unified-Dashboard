"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Ticket, Loader2, ExternalLink } from "lucide-react";
import { useTimezone } from "@/hooks/use-timezone";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
  none: "bg-zinc-500",
};

export function RecentTicketsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const boardFilter = (config.boardId as string) || undefined;
  const sortOrder = (config.sortOrder as string) || "newest";
  const maxItems = (config.maxItems as number) || 10;
  const { relative } = useTimezone();

  // Fetch boards for config panel dropdown
  const boards = trpc.psa.getBoards.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const tickets = trpc.psa.getTickets.useQuery(
    { boardId: boardFilter, pageSize: maxItems },
    {
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  // Sort tickets client-side
  const sortedTickets = useMemo(() => {
    const data = tickets.data?.data ?? [];
    const arr = [...data];
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    switch (sortOrder) {
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
  }, [tickets.data, sortOrder]);

  // Loading
  if (tickets.isLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  // Error
  if (tickets.error) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Ticket className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Failed to load tickets</p>
          <p className="text-xs text-muted-foreground mt-1">
            {/not valid JSON|Unexpected token|fetch failed|NetworkError/i.test(tickets.error.message)
              ? "Connection error — try refreshing."
              : tickets.error.message}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  // Empty
  if (sortedTickets.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <Ticket className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No recent tickets</p>
          <p className="text-xs text-muted-foreground mt-1">
            {boardFilter ? "No tickets on this board." : "No tickets found in ConnectWise."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="divide-y divide-border/30">
        {sortedTickets.map((t) => (
          <Link
            key={t.sourceId}
            href="/tickets"
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors"
          >
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_COLORS[t.priority])} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{t.summary}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                #{t.sourceId} · {t.companyName ?? "—"} · {t.assignedTo ?? "Unassigned"}
              </p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">
                {relative(t.updatedAt ?? t.createdAt)}
              </span>
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full mt-0.5",
                t.status.toLowerCase().includes("new") ? "bg-blue-500/10 text-blue-400" :
                t.status.toLowerCase().includes("progress") ? "bg-yellow-500/10 text-yellow-400" :
                t.status.toLowerCase().includes("wait") ? "bg-orange-500/10 text-orange-400" :
                t.status.toLowerCase().includes("close") || t.status.toLowerCase().includes("resolve") ? "bg-green-500/10 text-green-400" :
                "bg-muted text-muted-foreground"
              )}>
                {t.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
      {tickets.data && (tickets.data.totalCount ?? 0) > maxItems && (
        <Link href="/tickets" className="flex items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground hover:text-foreground border-t border-border/30">
          View all {tickets.data.totalCount ?? 0} tickets <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Ticket Feed Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Filter by board">
          <ConfigSelect
            value={boardFilter ?? ""}
            onChange={(v) => onConfigChange({ ...config, boardId: v || undefined })}
            options={[
              { value: "", label: "All boards" },
              ...(boards.data ?? []).map((b) => ({ value: String(b.id), label: b.name })),
            ]}
          />
        </ConfigSection>

        <ConfigSection label="Sort order">
          <ConfigSelect
            value={sortOrder}
            onChange={(v) => onConfigChange({ ...config, sortOrder: v })}
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "priority", label: "Priority (high to low)" },
              { value: "updated", label: "Recently updated" },
            ]}
          />
        </ConfigSection>

        <ConfigSection label="Max tickets shown">
          <ConfigSelect
            value={String(maxItems)}
            onChange={(v) => onConfigChange({ ...config, maxItems: parseInt(v, 10) })}
            options={[
              { value: "5", label: "5 tickets" },
              { value: "10", label: "10 tickets" },
              { value: "15", label: "15 tickets" },
              { value: "25", label: "25 tickets" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
