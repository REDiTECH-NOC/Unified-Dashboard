"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { Server, Monitor, Cloud, Loader2 } from "lucide-react";

interface BackupDashboardSummary {
  totalDevices: number;
  totalCustomers: number;
  byStatus: Record<string, number>;
  totalStorageBytes: number;
  totalProtectedBytes: number;
  totalSelectedBytes: number;
  byDeviceType: { servers: number; workstations: number; m365: number; unknown: number };
  bySessionStatus: {
    completed: number;
    completedWithErrors: number;
    inProcess: number;
    failed: number;
    noBackups: number;
  };
  backedUpRecency: {
    lessThan1h: number;
    oneToFourHours: number;
    fourTo24Hours: number;
    twentyFourTo48Hours: number;
    moreThan48Hours: number;
    noBackups: number;
  };
  m365Summary: {
    tenantCount: number;
    licenseCount: number;
    totalSelectedBytes: number;
    totalUsedBytes: number;
  };
}

interface BackupChartsProps {
  summary: BackupDashboardSummary | null;
  isLoading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

/* ─── Donut helper — reusable across widgets ──────────────── */

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

/* ─── Widget 1: Devices ───────────────────────────────────── */

function DevicesWidget({ summary }: { summary: BackupDashboardSummary }) {
  const { byDeviceType, totalSelectedBytes, totalStorageBytes, m365Summary } = summary;

  // Cove separates physical devices from M365 tenants — exclude M365 from device count
  const physicalDevices = byDeviceType.servers + byDeviceType.workstations + byDeviceType.unknown;
  // Selected/Used storage for physical devices only (subtract M365 storage)
  const physSelectedBytes = totalSelectedBytes - m365Summary.totalSelectedBytes;
  const physUsedBytes = totalStorageBytes - m365Summary.totalUsedBytes;

  const data = [
    { name: "Servers", value: byDeviceType.servers, color: CHART_COLORS.blue },
    { name: "Workstations", value: byDeviceType.workstations, color: CHART_COLORS.purple },
    { name: "Other", value: byDeviceType.unknown, color: "#52525b" },
  ];

  const legendItems = data
    .filter((d) => d.value > 0)
    .map((d) => ({ label: d.name, value: d.value, color: d.color }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Server className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-zinc-200">{physicalDevices} Devices</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={String(physicalDevices)} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
          <div className="mt-3 pt-2 border-t border-zinc-800/50 space-y-0.5">
            <p className="text-[11px] text-zinc-500">
              {formatBytes(physSelectedBytes > 0 ? physSelectedBytes : totalSelectedBytes)} Selected size
            </p>
            <p className="text-[11px] text-zinc-500">
              {formatBytes(physUsedBytes > 0 ? physUsedBytes : totalStorageBytes)} Used storage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Widget 2: M365 Tenants ──────────────────────────────── */

function M365Widget({ summary }: { summary: BackupDashboardSummary }) {
  const { m365Summary } = summary;

  if (m365Summary.tenantCount === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cloud className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-zinc-200">
          {m365Summary.tenantCount} Microsoft 365 {m365Summary.tenantCount === 1 ? "tenant" : "tenants"}
        </h3>
      </div>
      <div className="space-y-2.5">
        <StatRow label="M365 domains" value={m365Summary.tenantCount} />
        <StatRow
          label="Billable users"
          value={m365Summary.licenseCount > 0 ? m365Summary.licenseCount : "—"}
        />
        <StatRow label="Selected size" value={formatBytes(m365Summary.totalSelectedBytes)} />
        <StatRow label="Used storage" value={formatBytes(m365Summary.totalUsedBytes)} />
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

/* ─── Widget 3: Backups Completed ─────────────────────────── */

function BackupsCompletedWidget({ summary }: { summary: BackupDashboardSummary }) {
  const { bySessionStatus, totalDevices } = summary;

  const completedPct = totalDevices > 0
    ? Math.round((bySessionStatus.completed / totalDevices) * 100)
    : 0;

  const data = [
    { name: "Completed", value: bySessionStatus.completed, color: CHART_COLORS.green },
    { name: "Completed with errors", value: bySessionStatus.completedWithErrors, color: CHART_COLORS.amber },
    { name: "In process", value: bySessionStatus.inProcess, color: CHART_COLORS.blue },
    { name: "Failed", value: bySessionStatus.failed, color: CHART_COLORS.red },
    { name: "No backups", value: bySessionStatus.noBackups, color: "#52525b" },
  ];

  const legendItems = data.map((d) => ({ label: d.name, value: d.value, color: d.color }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">{completedPct}% Backups completed</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={`${completedPct}%`} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
        </div>
      </div>
    </div>
  );
}

/* ─── Widget 4: Backed Up < 24 Hours ─────────────────────── */

function RecencyWidget({ summary }: { summary: BackupDashboardSummary }) {
  const { backedUpRecency, totalDevices } = summary;

  const within24h = backedUpRecency.lessThan1h + backedUpRecency.oneToFourHours + backedUpRecency.fourTo24Hours;
  const pct = totalDevices > 0 ? Math.round((within24h / totalDevices) * 100) : 0;

  const data = [
    { name: "< 1 hour ago", value: backedUpRecency.lessThan1h, color: CHART_COLORS.green },
    { name: "1 - 4 hours", value: backedUpRecency.oneToFourHours, color: CHART_COLORS.teal },
    { name: "4 - 24 hours", value: backedUpRecency.fourTo24Hours, color: CHART_COLORS.amber },
    { name: "24 - 48 hours", value: backedUpRecency.twentyFourTo48Hours, color: CHART_COLORS.orange },
    { name: "> 48 hours", value: backedUpRecency.moreThan48Hours, color: CHART_COLORS.red },
    { name: "No backups", value: backedUpRecency.noBackups, color: "#52525b" },
  ];

  const legendItems = data
    .filter((d) => d.value > 0)
    .map((d) => ({ label: d.name, value: d.value, color: d.color }));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">{pct}% Backed up &lt; 24 hours</h3>
      </div>
      <div className="flex items-start gap-4">
        <MiniDonut data={data} centerLabel={`${pct}%`} />
        <div className="flex-1 min-w-0">
          <Legend items={legendItems} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Export ─────────────────────────────────────────── */

export function BackupCharts({ summary, isLoading }: BackupChartsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading statistics...
      </div>
    );
  }

  if (!summary || summary.totalDevices === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <DevicesWidget summary={summary} />
      <M365Widget summary={summary} />
      <BackupsCompletedWidget summary={summary} />
      <RecencyWidget summary={summary} />
    </div>
  );
}
