"use client";

import {
  ArrowLeft,
  BarChart3,
  Loader2,
  DollarSign,
  TrendingUp,
  Percent,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  CompanyRevenueChart,
  MarginByServiceChart,
  VendorDistributionChart,
  ContractExpiryTable,
} from "../_components/insights-charts";

export default function ContractInsightsPage() {
  const insightsQuery = trpc.billing.getContractInsights.useQuery(undefined, {
    staleTime: 120_000,
  });

  const data = insightsQuery.data;

  if (insightsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) return null;

  const kpiCards = [
    {
      label: "Monthly Revenue",
      value: `$${data.totals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
    },
    {
      label: "Monthly Profit",
      value: `$${Math.abs(data.totals.profit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: data.totals.profit >= 0 ? "text-green-400" : "text-red-400",
      bgColor: data.totals.profit >= 0 ? "bg-green-500/10" : "bg-red-500/10",
      borderColor: data.totals.profit >= 0 ? "border-green-500/20" : "border-red-500/20",
    },
    {
      label: "Overall Margin",
      value: `${data.totals.margin}%`,
      icon: Percent,
      color: data.totals.margin >= 50 ? "text-green-400" : data.totals.margin >= 25 ? "text-amber-400" : "text-red-400",
      bgColor: data.totals.margin >= 50 ? "bg-green-500/10" : data.totals.margin >= 25 ? "bg-amber-500/10" : "bg-red-500/10",
      borderColor: data.totals.margin >= 50 ? "border-green-500/20" : data.totals.margin >= 25 ? "border-amber-500/20" : "border-red-500/20",
    },
    {
      label: "Expiring in 90 Days",
      value: data.totals.expiringIn90Days,
      icon: Clock,
      color: data.totals.expiringIn90Days > 0 ? "text-amber-400" : "text-green-400",
      bgColor: data.totals.expiringIn90Days > 0 ? "bg-amber-500/10" : "bg-green-500/10",
      borderColor: data.totals.expiringIn90Days > 0 ? "border-amber-500/20" : "border-green-500/20",
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/billing"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
          <BarChart3 className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Contract Insights</h1>
          <p className="text-sm text-zinc-500">
            Revenue, profit, and contract analysis across {data.totals.agreementCount} companies
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
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
          </div>
        ))}
      </div>

      {/* Revenue & Profit by Company */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Revenue & Cost by Company</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Top 15 companies by monthly revenue (blue = revenue, red = cost)
          </p>
        </div>
        <div className="p-4">
          <CompanyRevenueChart data={data.companyFinancials} />
        </div>
      </div>

      {/* Two Column: Margin by Service + Vendor Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin by Service */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">Margin by Service</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Profit margin % per product/service type
            </p>
          </div>
          <div className="p-4">
            <MarginByServiceChart data={data.serviceBreakdown} />
          </div>
        </div>

        {/* Vendor Distribution */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">Vendor Distribution</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Revenue breakdown by vendor</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <VendorDistributionChart data={data.vendorDistribution} />
          </div>
        </div>
      </div>

      {/* Top & Bottom Profitable Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Profitable */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">Most Profitable Accounts</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {data.companyFinancials
              .slice(0, 10)
              .sort((a, b) => b.profit - a.profit)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-sm text-zinc-200">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.margin}% margin</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-green-400">
                      ${c.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-zinc-500">
                      ${c.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} rev
                    </div>
                  </div>
                </div>
              ))}
            {data.companyFinancials.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">No data</div>
            )}
          </div>
        </div>

        {/* Least Profitable */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">Least Profitable Accounts</h2>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {[...data.companyFinancials]
              .sort((a, b) => a.profit - b.profit)
              .slice(0, 10)
              .map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-sm text-zinc-200">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.margin}% margin</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${c.profit >= 0 ? "text-amber-400" : "text-red-400"}`}>
                      ${Math.abs(c.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-zinc-500">
                      ${c.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} rev
                    </div>
                  </div>
                </div>
              ))}
            {data.companyFinancials.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Contract Expiry Tracking */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Contract Expiry Tracking</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Agreements nearing expiration — revenue at risk
          </p>
        </div>
        <ContractExpiryTable data={data.expiringAgreements} />
      </div>
    </div>
  );
}
