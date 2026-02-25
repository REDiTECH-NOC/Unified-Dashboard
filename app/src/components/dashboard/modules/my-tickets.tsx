"use client";

import { useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { UserCheck, ArrowUpRight, Loader2, ExternalLink } from "lucide-react";
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

export function MyTicketsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const sortOrder = (config.sortOrder as string) || "priority";
  const maxItems = (config.maxItems as number) || 10;
  const { relative } = useTimezone();

  // Get current user's CW member identifier for filtering
  const myMember = trpc.psa.getMyMemberId.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const members = trpc.psa.getMembers.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const myIdentifier = useMemo(() => {
    if (!myMember.data || !members.data) return null;
    const match = members.data.find((m) => m.id === myMember.data);
    return match?.identifier ?? null;
  }, [myMember.data, members.data]);

  const tickets = trpc.psa.getTickets.useQuery(
    { assignedTo: myIdentifier!, pageSize: maxItems },
    {
      enabled: !!myIdentifier,
      refetchInterval: 60_000,
      staleTime: 25_000,
      retry: 1,
    }
  );

  // Sort tickets client-side based on config
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

  // Not mapped yet
  if (myMember.data === null) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <UserCheck className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Map your CW account</p>
          <p className="text-xs text-muted-foreground mt-1">Link your ConnectWise member in Settings to see your tickets.</p>
          <Link href="/settings/integrations/connectwise" className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-red-500 hover:text-red-400">
            CW Settings <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {renderConfig()}
      </>
    );
  }

  // Loading
  if (tickets.isLoading || myMember.isLoading) {
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
          <UserCheck className="h-6 w-6 text-muted-foreground mb-3" />
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
          <UserCheck className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No tickets assigned</p>
          <p className="text-xs text-muted-foreground mt-1">You have no open tickets in ConnectWise.</p>
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
                #{t.sourceId} · {t.companyName ?? "—"} · {t.status}
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {relative(t.updatedAt ?? t.createdAt)}
            </span>
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
      <ModuleConfigPanel title="My Tickets Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Sort order">
          <ConfigSelect
            value={sortOrder}
            onChange={(v) => onConfigChange({ ...config, sortOrder: v })}
            options={[
              { value: "priority", label: "Priority (high to low)" },
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first (most stale)" },
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
