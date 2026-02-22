"use client";

import { cn } from "@/lib/utils";
import {
  Ticket,
  AlertTriangle,
  Monitor,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { statCards } from "@/data/dashboard-data";

const iconMap: Record<string, React.ElementType> = {
  Ticket,
  AlertTriangle,
  Monitor,
  ShieldCheck,
};

function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  const Icon = iconMap[icon] || Monitor;
  const isEmpty = value === "—";

  return (
    <div className="rounded-lg p-4 bg-muted/30 border border-border/50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className={cn("mt-1.5 text-2xl font-bold tracking-tight", isEmpty ? "text-muted-foreground" : "text-foreground")}>
            {value}
          </p>
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10">
          <Icon className="h-4 w-4 text-red-500" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{isEmpty ? "Awaiting data" : "Vs last month"}</span>
      </div>
    </div>
  );
}

export function StatOverviewModule() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 p-4">
      {statCards.map((card) => (
        <StatCard key={card.title} title={card.title} value={card.value} icon={card.icon} />
      ))}
    </div>
  );
}
