"use client";

import { useMemo } from "react";
import { PRIORITY_CONFIG, PRIORITY_ORDER, PriorityBadge, type Priority } from "./priority-badge";

interface TicketStatsBarProps {
  tickets: Array<{ priority: string }>;
}

export function TicketStatsBar({ tickets }: TicketStatsBarProps) {
  const stats = useMemo(() => {
    const byPriority = {} as Record<Priority, number>;
    for (const t of tickets) {
      const p = t.priority as Priority;
      byPriority[p] = (byPriority[p] || 0) + 1;
    }
    return { total: tickets.length, byPriority };
  }, [tickets]);

  if (stats.total === 0) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-muted-foreground">
        {stats.total} ticket{stats.total !== 1 ? "s" : ""}
      </span>
      <div className="flex gap-1.5">
        {PRIORITY_ORDER
          .filter((p) => stats.byPriority[p])
          .map((p) => (
            <PriorityBadge key={p} priority={p} count={stats.byPriority[p]} />
          ))}
      </div>
    </div>
  );
}
