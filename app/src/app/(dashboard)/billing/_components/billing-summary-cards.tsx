"use client";

import { AlertTriangle, DollarSign, TrendingUp, Wallet } from "lucide-react";

interface SummaryData {
  totalItems: number;
  discrepancies: number;
  totalRevenueImpact: number;
  matchedCount: number;
  companiesWithIssues: number;
  lastSyncAt: Date | null;
  revenue?: number;
  profit?: number;
  margin?: number;
}

export function BillingSummaryCards({ data }: { data: SummaryData }) {
  const cards = [
    {
      label: "Discrepancies",
      value: data.discrepancies,
      icon: AlertTriangle,
      color: data.discrepancies > 0 ? "text-red-400" : "text-green-400",
      bgColor: data.discrepancies > 0 ? "bg-red-500/10" : "bg-green-500/10",
      borderColor: data.discrepancies > 0 ? "border-red-500/20" : "border-green-500/20",
    },
    {
      label: "Revenue Impact",
      value: `$${Math.abs(data.totalRevenueImpact).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: data.totalRevenueImpact > 0 ? "Underbilled" : data.totalRevenueImpact < 0 ? "Overbilled" : "Balanced",
      icon: DollarSign,
      color: data.totalRevenueImpact > 0 ? "text-red-400" : data.totalRevenueImpact < 0 ? "text-amber-400" : "text-green-400",
      bgColor: data.totalRevenueImpact > 0 ? "bg-red-500/10" : data.totalRevenueImpact < 0 ? "bg-amber-500/10" : "bg-green-500/10",
      borderColor: data.totalRevenueImpact > 0 ? "border-red-500/20" : data.totalRevenueImpact < 0 ? "border-amber-500/20" : "border-green-500/20",
    },
    {
      label: "Monthly Revenue",
      value: data.revenue != null
        ? `$${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—",
      subtitle: "From CW agreements",
      icon: TrendingUp,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    {
      label: "Profit",
      value: data.profit != null
        ? `$${Math.abs(data.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—",
      subtitle: data.margin != null ? `${data.margin}% margin` : undefined,
      icon: Wallet,
      color: (data.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400",
      bgColor: (data.profit ?? 0) >= 0 ? "bg-green-500/10" : "bg-red-500/10",
      borderColor: (data.profit ?? 0) >= 0 ? "border-green-500/20" : "border-red-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border ${card.borderColor} ${card.bgColor} p-4`}
        >
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`h-4 w-4 ${card.color}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          {card.subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}
