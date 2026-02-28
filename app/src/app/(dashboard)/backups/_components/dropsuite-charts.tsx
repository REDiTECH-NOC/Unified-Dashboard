"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { Building2, Users, HardDrive, Loader2 } from "lucide-react";

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
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

/* ─── Donut helper ─────────────────────────────────────────── */

function MiniDonut({
  data,
  centerLabel,
  size = 90,
}: {
  data: { name: string; value: number; color: string }[];
  centerLabel?: string;
  size?: number;
}) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    filtered.push({ name: "none", value: 1, color: "#27272a" });
  }
  const inner = size * 0.3;
  const outer = size * 0.44;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={filtered.length > 1 ? 2 : 0}
            strokeWidth={0}
          >
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-zinc-100">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

function Legend({
  items,
}: {
  items: { label: string; value: number | string; color: string }[];
}) {
  return (
    <div className="flex flex-col gap-1 text-xs min-w-0">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-zinc-400 truncate">{item.label}</span>
          <span className="text-zinc-200 font-medium ml-auto tabular-nums">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Widget 1: Backup Health Distribution ─────────────────── */

function HealthWidget({ summary }: { summary: SaasBackupDashboardSummary }) {
  const { orgHealthRollup } = summary;
  const totalAccounts = Object.values(orgHealthRollup).reduce((a, b) => a + b, 0);
  const healthyPct = totalAccounts > 0
    ? Math.round((orgHealthRollup.healthy / totalAccounts) * 100)
    : 0;

  const data = [
    { name: "Healthy", value: orgHealthRollup.healthy, color: CHART_COLORS.green },
    { name: "Warning", value: orgHealthRollup.warning, color: CHART_COLORS.amber },
    { name: "Overdue", value: orgHealthRollup.overdue, color: CHART_COLORS.orange },
    { name: "Failed", value: orgHealthRollup.failed, color: CHART_COLORS.red },
    { name: "Preparing", value: orgHealthRollup.preparing, color: CHART_COLORS.blue },
    { name: "Never ran", value: orgHealthRollup.never_ran, color: "#52525b" },
  ];

  const legendItems = data
    .filter((d) => d.value > 0)
    .map((d) => ({ label: d.name, value: d.value, color: d.color }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">{healthyPct}% Healthy</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={`${healthyPct}%`} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
        </div>
      </div>
    </div>
  );
}

/* ─── Widget 2: Seats by Organization (top 6) ──────────────── */

function OrgSeatsWidget({ summary }: { summary: SaasBackupDashboardSummary }) {
  const { orgSeatSummaries } = summary;
  const sorted = [...orgSeatSummaries].sort((a, b) => b.activeSeats - a.activeSeats);
  const top = sorted.slice(0, 6);
  const palette = [
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.cyan,
    CHART_COLORS.teal,
    CHART_COLORS.amber,
    CHART_COLORS.pink,
  ];

  const data = top.map((org, i) => ({
    name: org.orgName,
    value: org.activeSeats,
    color: palette[i % palette.length],
  }));

  const legendItems = data.map((d) => ({
    label: d.name.length > 18 ? d.name.slice(0, 18) + "..." : d.name,
    value: d.value,
    color: d.color,
  }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Seats by Org</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={String(summary.totalActiveSeats)} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
        </div>
      </div>
    </div>
  );
}

/* ─── Widget 3: Seat Breakdown ─────────────────────────────── */

function SeatBreakdownWidget({ summary }: { summary: SaasBackupDashboardSummary }) {
  const data = [
    { name: "Active", value: summary.totalActiveSeats, color: CHART_COLORS.green },
    { name: "Deactivated", value: summary.totalDeactivatedSeats, color: CHART_COLORS.red },
    { name: "Free shared", value: summary.totalFreeSharedMailboxes, color: CHART_COLORS.cyan },
  ];

  const total = data.reduce((a, d) => a + d.value, 0);
  const legendItems = data
    .filter((d) => d.value > 0)
    .map((d) => ({ label: d.name, value: d.value, color: d.color }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-green-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Seat Breakdown</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={String(total)} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
          <div className="mt-3 pt-2 border-t border-zinc-800/50">
            <p className="text-[11px] text-zinc-500">
              {formatBytes(summary.totalStorageBytes)} total storage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Widget 4: Storage per Organization ───────────────────── */

function StorageWidget({ summary }: { summary: SaasBackupDashboardSummary }) {
  const { orgSeatSummaries, totalStorageBytes, totalOrgs } = summary;
  const avgPerOrg = totalOrgs > 0 ? totalStorageBytes / totalOrgs : 0;
  const avgPerSeat = summary.totalActiveSeats > 0 ? totalStorageBytes / summary.totalActiveSeats : 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="h-4 w-4 text-teal-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Storage</h3>
      </div>
      <div className="space-y-2.5">
        <StatRow label="Total storage" value={formatBytes(totalStorageBytes)} />
        <StatRow label="Avg. per org" value={formatBytes(avgPerOrg)} />
        <StatRow label="Avg. per seat" value={formatBytes(avgPerSeat)} />
        <StatRow label="Organizations" value={totalOrgs} />
        <StatRow label="Archive orgs" value={summary.archiveOrgs} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-medium tabular-nums">{value}</span>
    </div>
  );
}

/* ─── Main Export ──────────────────────────────────────────── */

interface DropsuiteChartsProps {
  summary: SaasBackupDashboardSummary | undefined;
  isLoading: boolean;
}

export function DropsuiteCharts({ summary, isLoading }: DropsuiteChartsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading statistics...
      </div>
    );
  }

  if (!summary || summary.totalOrgs === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <HealthWidget summary={summary} />
      <OrgSeatsWidget summary={summary} />
      <SeatBreakdownWidget summary={summary} />
      <StorageWidget summary={summary} />
    </div>
  );
}
