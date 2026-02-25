"use client";

import { cn } from "@/lib/utils";

export const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
  high:     { label: "High",     color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-500" },
  low:      { label: "Low",      color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30", dot: "bg-blue-400" },
  none:     { label: "None",     color: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/30", dot: "bg-zinc-400" },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

export const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low", "none"];

/** Map normalized priority back to CW API priority name */
export const PRIORITY_TO_CW: Record<Priority, string> = {
  critical: "Priority 1 - Critical",
  high: "Priority 2 - High",
  medium: "Priority 3 - Normal",
  low: "Priority 4 - Low",
  none: "Priority 4 - Low",
};

export function PriorityDot({ priority, className }: { priority: string; className?: string }) {
  const cfg = PRIORITY_CONFIG[priority as Priority];
  return <div className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", cfg?.dot ?? "bg-zinc-400", className)} />;
}

export function PriorityBadge({ priority, count }: { priority: Priority; count: number }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border", cfg.bg, cfg.color, cfg.border)}>
      {count} {cfg.label}
    </span>
  );
}
