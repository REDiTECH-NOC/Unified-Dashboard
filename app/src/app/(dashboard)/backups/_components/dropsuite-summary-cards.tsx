"use client";

import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  UserMinus,
  AlertTriangle,
  HardDrive,
  Archive,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
type SaasBackupHealth = "healthy" | "warning" | "overdue" | "failed" | "preparing" | "never_ran" | "unknown";

interface SaasBackupDashboardSummary {
  totalOrgs: number;
  totalActiveSeats: number;
  totalDeactivatedSeats: number;
  totalFreeSharedMailboxes: number;
  totalStorageBytes: number;
  archiveOrgs: number;
  orgHealthRollup: Record<SaasBackupHealth, number>;
  connectionFailures: number;
  orgSeatSummaries: Array<{
    orgName: string;
    orgId: string;
    activeSeats: number;
    deactivatedSeats: number;
    freeSharedMailboxes: number;
    archive: boolean;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface DropsuiteSummaryCardsProps {
  summary: SaasBackupDashboardSummary | undefined;
  isLoading: boolean;
  activeFilter: SaasBackupHealth | null;
  onFilterChange: (filter: SaasBackupHealth | null) => void;
}

const HEALTH_CARDS: Array<{
  key: SaasBackupHealth;
  label: string;
  color: string;
  textColor: string;
}> = [
  { key: "healthy", label: "Healthy", color: "bg-green-500/10 border-green-500/20", textColor: "text-green-400" },
  { key: "warning", label: "Warning", color: "bg-yellow-500/10 border-yellow-500/20", textColor: "text-yellow-400" },
  { key: "overdue", label: "Overdue", color: "bg-orange-500/10 border-orange-500/20", textColor: "text-orange-400" },
  { key: "failed", label: "Failed", color: "bg-red-500/10 border-red-500/20", textColor: "text-red-400" },
];

export function DropsuiteSummaryCards({
  summary,
  isLoading,
  activeFilter,
  onFilterChange,
}: DropsuiteSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
            <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
            <div className="h-6 w-12 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-3">
      {/* Top row: aggregate stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Organizations"
          value={summary.totalOrgs}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active Seats"
          value={summary.totalActiveSeats}
        />
        <StatCard
          icon={<UserMinus className="h-4 w-4" />}
          label="Deactivated"
          value={summary.totalDeactivatedSeats}
          muted
        />
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="Storage Used"
          value={formatBytes(summary.totalStorageBytes)}
        />
        <StatCard
          icon={<Archive className="h-4 w-4" />}
          label="Archive Orgs"
          value={summary.archiveOrgs}
          muted
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Conn. Failures"
          value={summary.connectionFailures}
          alert={summary.connectionFailures > 0}
        />
      </div>

      {/* Health filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {HEALTH_CARDS.map((card) => {
          const count = summary.orgHealthRollup[card.key] ?? 0;
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => onFilterChange(isActive ? null : card.key)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                isActive ? card.color : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {card.label}
              </p>
              <p className={cn("text-xl font-bold mt-0.5", isActive ? card.textColor : "text-zinc-100")}>
                {count}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  muted,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  muted?: boolean;
  alert?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-4",
      alert ? "bg-red-500/5 border-red-500/20" : "bg-zinc-900 border-zinc-800"
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("text-muted-foreground", alert && "text-red-400")}>{icon}</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn(
        "text-lg font-bold",
        alert ? "text-red-400" : muted ? "text-zinc-500" : "text-zinc-100"
      )}>
        {value}
      </p>
    </div>
  );
}
