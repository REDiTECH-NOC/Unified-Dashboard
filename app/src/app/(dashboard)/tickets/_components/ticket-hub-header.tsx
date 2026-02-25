"use client";

import { Ticket, Plus, RefreshCw, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TicketHub } from "./use-ticket-hub";

export type TicketTab = "mine" | "all" | "calendar";

interface TicketHubHeaderProps {
  activeTab: TicketTab;
  onTabChange: (tab: TicketTab) => void;
  onCreateTicket: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  hub: TicketHub;
  myTicketCount?: number;
}

const TABS: { id: TicketTab; label: string; shortcut: string }[] = [
  { id: "mine", label: "My Tickets", shortcut: "1" },
  { id: "all", label: "All Tickets", shortcut: "2" },
  { id: "calendar", label: "Calendar", shortcut: "3" },
];

export function TicketHubHeader({
  activeTab,
  onTabChange,
  onCreateTicket,
  onRefresh,
  isFetching,
  hub,
  myTicketCount,
}: TicketHubHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <Ticket className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tickets</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFetching ? "Refreshing..." : "Manage and track service tickets"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onCreateTicket}
            size="sm"
            className="h-9 gap-1.5 px-4"
          >
            <Plus className="h-3.5 w-3.5" />
            New Ticket
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/40">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.id === "calendar" && <Calendar className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.id === "mine" && myTicketCount !== undefined && myTicketCount > 0 && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium tabular-nums">
                {myTicketCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
