"use client";

import { useMemo } from "react";
import { Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function statusChipStyle(status: string): { active: string; inactive: string } {
  const s = status.toLowerCase();
  if (s.includes("new"))
    return {
      active: "border-blue-500/50 bg-blue-500/10 text-blue-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("progress"))
    return {
      active: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("waiting") || s.includes("client"))
    return {
      active: "border-orange-500/50 bg-orange-500/10 text-orange-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("complet") || s.includes("resolv"))
    return {
      active: "border-green-500/50 bg-green-500/10 text-green-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("close") || s.includes("cancel"))
    return {
      active: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("schedul"))
    return {
      active: "border-purple-500/50 bg-purple-500/10 text-purple-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  if (s.includes("pending"))
    return {
      active: "border-amber-500/50 bg-amber-500/10 text-amber-400",
      inactive: "border-border/30 text-muted-foreground hover:text-foreground",
    };
  return {
    active: "border-border bg-muted text-foreground",
    inactive: "border-border/30 text-muted-foreground hover:text-foreground",
  };
}

export function statusBorderColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("new")) return "border-l-blue-500";
  if (s.includes("progress")) return "border-l-yellow-500";
  if (s.includes("waiting") || s.includes("client")) return "border-l-orange-500";
  if (s.includes("complet") || s.includes("resolv")) return "border-l-green-500";
  if (s.includes("close") || s.includes("cancel")) return "border-l-zinc-500";
  if (s.includes("schedul")) return "border-l-purple-500";
  if (s.includes("pending")) return "border-l-amber-500";
  return "border-l-border";
}

interface TicketStatusChipBarProps {
  availableStatuses: string[];
  activeStatuses: string[];
  countsByStatus?: Record<string, number>;
  onChange: (statuses: string[]) => void;
  onSaveDefault: (statuses: string[]) => void;
  defaultStatuses: string[] | null;
  isSaving?: boolean;
  label?: string;
}

export function TicketStatusChipBar({
  availableStatuses,
  activeStatuses,
  countsByStatus,
  onChange,
  onSaveDefault,
  defaultStatuses,
  isSaving = false,
  label,
}: TicketStatusChipBarProps) {
  const isDirty = useMemo(() => {
    if (!defaultStatuses) return activeStatuses.length > 0;
    const sorted = [...activeStatuses].sort();
    const defSorted = [...defaultStatuses].sort();
    return JSON.stringify(sorted) !== JSON.stringify(defSorted);
  }, [activeStatuses, defaultStatuses]);

  function toggle(status: string) {
    const next = activeStatuses.includes(status)
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status];
    onChange(next);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {label && (
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">
          {label}
        </span>
      )}
      {availableStatuses.map((status) => {
        const isActive = activeStatuses.includes(status);
        const style = statusChipStyle(status);
        const count = countsByStatus?.[status];
        return (
          <button
            key={status}
            onClick={() => toggle(status)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer",
              isActive ? style.active : style.inactive
            )}
          >
            {status}
            {count !== undefined && (
              <span
                className={cn(
                  "text-[9px] tabular-nums",
                  isActive ? "opacity-70" : "opacity-40"
                )}
              >
                {count}
              </span>
            )}
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
            onClick={() => onSaveDefault(activeStatuses)}
            title="Save as my default filter"
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
