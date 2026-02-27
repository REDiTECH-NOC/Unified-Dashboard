"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";

const TOOLTIP_STYLE = {
  backgroundColor: "#1c1c1e",
  border: "1px solid #27272a",
  borderRadius: "8px",
  fontSize: "12px",
};

function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

// ─── Company Revenue Chart ────────────────────────────────

interface CompanyFinancial {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export function CompanyRevenueChart({ data }: { data: CompanyFinancial[] }) {
  const top15 = data.slice(0, 15);

  if (top15.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No revenue data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, top15.length * 36)}>
      <BarChart data={top15} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
        <XAxis
          type="number"
          tickFormatter={formatCurrency}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            name === "revenue" ? "Revenue" : "Cost",
          ]}
          labelStyle={{ color: "#e4e4e7" }}
        />
        <Bar dataKey="revenue" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]} barSize={16} />
        <Bar dataKey="cost" fill={CHART_COLORS.red} fillOpacity={0.3} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Margin by Service Chart ──────────────────────────────

interface ServiceBreakdown {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  companyCount: number;
}

function getMarginColor(margin: number): string {
  if (margin >= 50) return CHART_COLORS.green;
  if (margin >= 25) return CHART_COLORS.amber;
  return CHART_COLORS.red;
}

export function MarginByServiceChart({ data }: { data: ServiceBreakdown[] }) {
  const sorted = [...data].sort((a, b) => b.margin - a.margin).slice(0, 15);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No service data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 32)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={180}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "Margin"]}
          labelStyle={{ color: "#e4e4e7" }}
        />
        <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={14}>
          {sorted.map((entry, i) => (
            <Cell key={i} fill={getMarginColor(entry.margin)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Vendor Distribution Donut ────────────────────────────

interface VendorData {
  name: string;
  revenue: number;
}

const VENDOR_COLORS: Record<string, string> = {
  NinjaOne: CHART_COLORS.blue,
  SentinelOne: CHART_COLORS.purple,
  Cove: CHART_COLORS.teal,
  Pax8: "#f97316", // orange-500
  Other: "#52525b", // zinc-600
};

export function VendorDistributionChart({ data }: { data: VendorData[] }) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
        No vendor data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={VENDOR_COLORS[entry.name] ?? VENDOR_COLORS.Other} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [
                `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                "Revenue",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-semibold text-zinc-200">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.revenue / total) * 100).toFixed(0) : "0";
          return (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: VENDOR_COLORS[entry.name] ?? VENDOR_COLORS.Other }}
              />
              <span className="text-xs text-zinc-300">{entry.name}</span>
              <span className="text-xs text-zinc-500">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Contract Expiry Table ────────────────────────────────

interface ExpiringAgreement {
  id: string;
  companyName: string;
  agreementName: string;
  endDate: string | Date;
  daysLeft: number;
  monthlyRevenue: number;
}

function getDaysLeftColor(days: number): string {
  if (days < 0) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (days <= 30) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (days <= 90) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-green-500/20 text-green-400 border-green-500/30";
}

export function ContractExpiryTable({ data }: { data: ExpiringAgreement[] }) {
  if (data.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500">
        No agreements with expiration dates found
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_100px_90px_100px] px-4 py-2 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <div>Company</div>
        <div>Agreement</div>
        <div>End Date</div>
        <div className="text-center">Days Left</div>
        <div className="text-right">Revenue</div>
      </div>
      {data.map((ag) => (
        <div
          key={ag.id}
          className="grid grid-cols-[1fr_1fr_100px_90px_100px] px-4 py-2.5 border-b border-zinc-800/50 items-center text-sm"
        >
          <div className="text-zinc-200 truncate">{ag.companyName}</div>
          <div className="text-zinc-400 truncate">{ag.agreementName}</div>
          <div className="text-zinc-500 text-xs">
            {new Date(ag.endDate).toLocaleDateString()}
          </div>
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${getDaysLeftColor(ag.daysLeft)}`}
            >
              {ag.daysLeft < 0 ? "Expired" : `${ag.daysLeft}d`}
            </span>
          </div>
          <div className="text-right text-zinc-300">
            {ag.monthlyRevenue > 0
              ? `$${ag.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : "\u2014"}
          </div>
        </div>
      ))}
    </>
  );
}
