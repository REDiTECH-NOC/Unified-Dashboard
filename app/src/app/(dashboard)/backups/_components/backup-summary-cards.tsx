"use client";

import {
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  WifiOff,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BackupSummaryCardsProps {
  totalDevices: number;
  byStatus: Record<string, number>;
  totalCustomers: number;
  isLoading: boolean;
  activeFilter: string | undefined;
  onFilterChange: (status: string | undefined) => void;
}

const CARDS = [
  {
    key: undefined as string | undefined,
    label: "Total Devices",
    icon: HardDrive,
    color: "text-zinc-300",
    bg: "bg-zinc-800/50",
    border: "border-zinc-700/50",
    getValue: (s: Record<string, number>) =>
      Object.values(s).reduce((a, b) => a + b, 0),
  },
  {
    key: "healthy",
    label: "Healthy",
    icon: CheckCircle2,
    color: "text-green-400",
    bg: "bg-green-500/5",
    border: "border-green-500/20",
    getValue: (s: Record<string, number>) => s.healthy ?? 0,
  },
  {
    key: "warning",
    label: "Warning",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    getValue: (s: Record<string, number>) => s.warning ?? 0,
  },
  {
    key: "failed",
    label: "Failed",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    getValue: (s: Record<string, number>) => s.failed ?? 0,
  },
  {
    key: "overdue",
    label: "Overdue",
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-500/5",
    border: "border-orange-500/20",
    getValue: (s: Record<string, number>) => s.overdue ?? 0,
  },
  {
    key: "offline",
    label: "Offline",
    icon: WifiOff,
    color: "text-zinc-400",
    bg: "bg-zinc-800/50",
    border: "border-zinc-700/50",
    getValue: (s: Record<string, number>) => s.offline ?? 0,
  },
] as const;

export function BackupSummaryCards({
  byStatus,
  isLoading,
  activeFilter,
  onFilterChange,
}: BackupSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = isLoading ? null : card.getValue(byStatus);
        const isActive = activeFilter === card.key;

        return (
          <button
            key={card.label}
            onClick={() => onFilterChange(isActive ? undefined : card.key)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 transition-all text-left",
              isActive
                ? `${card.bg} ${card.border} ring-1 ring-current/20`
                : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", card.color)} />
              <span className="text-xs text-zinc-400">{card.label}</span>
            </div>
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            ) : (
              <span className={cn("text-2xl font-semibold", card.color)}>
                {value}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
