"use client";

import {
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PbxInstance {
  id: string;
  name: string;
  status: string;
  callsActive: number | null;
  expirationDate: string | Date | null;
  maintenanceExpiresAt: string | Date | null;
  companyName: string | null;
  company: { id: string; name: string } | null;
}

interface PbxOverviewStatsProps {
  instances: PbxInstance[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="relative rounded-xl p-5 bg-card border border-border overflow-hidden">
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-px bg-gradient-to-r to-transparent",
          color.includes("blue") && "from-blue-500/30",
          color.includes("green") && "from-green-500/30",
          color.includes("red") && "from-red-500/30",
          color.includes("purple") && "from-purple-500/30"
        )}
      />
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PbxOverviewStats({ instances }: PbxOverviewStatsProps) {
  const total = instances.length;
  const online = instances.filter((i) => i.status === "online").length;
  const offline = total - online;
  // Find instances with licenses expiring within 90 days
  const expiringSoon = instances
    .map((i) => {
      const days = daysUntil(i.expirationDate);
      const maintDays = daysUntil(i.maintenanceExpiresAt);
      // Use whichever expires sooner
      const soonest =
        days !== null && maintDays !== null
          ? Math.min(days, maintDays)
          : days ?? maintDays;
      const expiringField =
        days !== null && maintDays !== null
          ? days <= maintDays
            ? "license"
            : "maintenance"
          : days !== null
            ? "license"
            : "maintenance";
      return { ...i, daysLeft: soonest, expiringField };
    })
    .filter((i) => i.daysLeft !== null && i.daysLeft <= 90)
    .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total PBXs"
          value={total}
          icon={Server}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          label="Online"
          value={online}
          icon={CheckCircle2}
          color="bg-green-500/10 text-green-500"
        />
        <StatCard
          label="Offline"
          value={offline}
          icon={XCircle}
          color="bg-red-500/10 text-red-500"
        />
        <StatCard
          label="Expiring (30d)"
          value={expiringSoon.filter((i) => i.daysLeft !== null && i.daysLeft <= 30).length}
          icon={AlertTriangle}
          color={expiringSoon.some((i) => i.daysLeft !== null && i.daysLeft <= 30) ? "bg-red-500/10 text-red-500" : "bg-purple-500/10 text-purple-500"}
        />
      </div>

      {expiringSoon.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-yellow-500">
              Expiring Licenses
            </span>
          </div>
          <div className="space-y-2">
            {expiringSoon.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-foreground">
                  {inst.company?.name ?? inst.companyName ?? inst.name}
                  <span className="text-muted-foreground ml-1.5">
                    ({inst.expiringField})
                  </span>
                </span>
                <span
                  className={cn(
                    "font-medium",
                    inst.daysLeft !== null && inst.daysLeft <= 30
                      ? "text-red-500"
                      : inst.daysLeft !== null && inst.daysLeft <= 60
                        ? "text-yellow-500"
                        : "text-orange-400"
                  )}
                >
                  {inst.daysLeft !== null && inst.daysLeft <= 0
                    ? "Expired"
                    : `${inst.daysLeft}d left`}{" "}
                  — {formatDate(inst.expiringField === "license" ? inst.expirationDate : inst.maintenanceExpiresAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
