"use client";

import { cn } from "@/lib/utils";

interface ColorBarDay {
  date: string;
  status: "success" | "partial" | "failed" | "missed" | "running" | "none";
}

const STATUS_COLORS: Record<ColorBarDay["status"], string> = {
  success: "bg-green-500",
  partial: "bg-amber-500",
  failed: "bg-red-500",
  missed: "bg-zinc-600",
  running: "bg-blue-500",
  none: "bg-zinc-800",
};

const STATUS_LABELS: Record<ColorBarDay["status"], string> = {
  success: "Successful",
  partial: "Completed with errors",
  failed: "Failed",
  missed: "No backup",
  running: "In progress",
  none: "No data",
};

export function ColorBar28Day({ days }: { days: ColorBarDay[] }) {
  if (!days || days.length === 0) {
    return <span className="text-xs text-zinc-500">No history</span>;
  }

  return (
    <div className="flex items-center gap-px" title="Last 28 days backup history">
      {days.map((day, i) => (
        <div
          key={i}
          className={cn("w-1.5 h-4 rounded-[1px] transition-opacity hover:opacity-80", STATUS_COLORS[day.status])}
          title={`${day.date}: ${STATUS_LABELS[day.status]}`}
        />
      ))}
    </div>
  );
}

export function ColorBarLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-400">
      {(["success", "partial", "failed", "missed", "running"] as const).map((status) => (
        <div key={status} className="flex items-center gap-1">
          <div className={cn("w-2.5 h-2.5 rounded-[1px]", STATUS_COLORS[status])} />
          <span>{STATUS_LABELS[status]}</span>
        </div>
      ))}
    </div>
  );
}
