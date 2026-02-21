"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Ticket,
  AlertTriangle,
  Monitor,
  ShieldCheck,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Circle,
  Plug,
  Bell,
  Activity,
} from "lucide-react";
import { statCards, integrationChecklist } from "@/data/dashboard-data";

const iconMap: Record<string, React.ElementType> = {
  Ticket,
  AlertTriangle,
  Monitor,
  ShieldCheck,
};

/* ─── STAT CARD ──────────────────────────────────────────────── */

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  const Icon = iconMap[icon] || Monitor;
  const isEmpty = value === "—";

  return (
    <div
      className="relative rounded-xl p-5 bg-card border border-border
                 shadow-card-light dark:shadow-card
                 hover:shadow-card-hover-light dark:hover:shadow-card-hover
                 hover:-translate-y-px transition-all duration-150 overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/20 to-transparent" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold tracking-tight",
              isEmpty ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {value}
          </p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10">
          <Icon className="h-5 w-5 text-red-500" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>{isEmpty ? "Awaiting data" : "Vs last month"}</span>
      </div>
    </div>
  );
}

/* ─── EMPTY STATE ────────────────────────────────────────────── */

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
        >
          {actionLabel}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ─── RECENT ALERTS ──────────────────────────────────────────── */

function RecentAlertsCard() {
  return (
    <div className="rounded-xl bg-card border border-border shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Recent Alerts
          </h3>
        </div>
        <Link
          href="/alerts"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>
      <EmptyState
        icon={AlertTriangle}
        title="No alerts"
        description="Connect your monitoring integrations to start receiving alerts."
        actionLabel="Configure Integrations"
        actionHref="/settings/integrations"
      />
    </div>
  );
}

/* ─── RECENT TICKETS ─────────────────────────────────────────── */

function RecentTicketsCard() {
  return (
    <div className="rounded-xl bg-card border border-border shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Recent Tickets
          </h3>
        </div>
        <Link
          href="/tickets"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </Link>
      </div>
      <EmptyState
        icon={Ticket}
        title="No tickets"
        description="Connect your PSA to see tickets here. AI will auto-triage incoming alerts."
        actionLabel="Connect PSA"
        actionHref="/settings/integrations"
      />
    </div>
  );
}

/* ─── SYSTEM HEALTH ──────────────────────────────────────────── */

function SystemHealthCard() {
  return (
    <div className="rounded-xl bg-card border border-border shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">
            System Health
          </h3>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {[
          { label: "Database", status: "connected" },
          { label: "Redis Cache", status: "connected" },
          { label: "AI Service", status: "pending" },
          { label: "n8n Automation", status: "pending" },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{item.label}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-medium",
                item.status === "connected"
                  ? "text-green-500"
                  : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  item.status === "connected" ? "bg-green-500" : "bg-muted-foreground"
                )}
              />
              {item.status === "connected" ? "Connected" : "Not configured"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── GETTING STARTED CHECKLIST ──────────────────────────────── */

function GettingStartedCard() {
  const completedCount = integrationChecklist.filter((i) => i.done).length;
  const totalCount = integrationChecklist.length;

  return (
    <div className="rounded-xl bg-card border border-border shadow-card-light dark:shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">
            Getting Started
          </h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount} complete
        </span>
      </div>
      <div className="p-5 space-y-3">
        {integrationChecklist.map((item) => (
          <Link
            key={item.key}
            href="/settings/integrations"
            className="flex items-center gap-3 group"
          >
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-red-500 transition-colors" />
            )}
            <span
              className={cn(
                "text-sm transition-colors",
                item.done
                  ? "text-muted-foreground line-through"
                  : "text-foreground group-hover:text-red-500"
              )}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────── */

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
          />
        ))}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
        <RecentAlertsCard />
        <RecentTicketsCard />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
        <SystemHealthCard />
        <GettingStartedCard />
      </div>
    </div>
  );
}
