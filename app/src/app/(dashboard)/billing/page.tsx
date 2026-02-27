"use client";

import { useState } from "react";
import {
  DollarSign,
  RefreshCw,
  Loader2,
  Play,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Sliders,
  BarChart3,
  Link2,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { BillingSummaryCards } from "./_components/billing-summary-cards";

const VENDOR_LABELS: Record<string, { label: string; color: string }> = {
  ninjaone: { label: "Ninja", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  sentinelone: { label: "S1", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  cove: { label: "Cove", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
};

export default function BillingPage() {
  const [search, setSearch] = useState("");

  const summaryQuery = trpc.billing.getReconciliationSummary.useQuery(undefined, {
    staleTime: 60_000,
  });

  const revenueQuery = trpc.billing.getRevenueAndProfit.useQuery(undefined, {
    staleTime: 60_000,
  });

  const companiesQuery = trpc.billing.getCompanyBillingSummaries.useQuery(undefined, {
    staleTime: 30_000,
  });

  const lastSyncQuery = trpc.billing.getLastSyncTime.useQuery(undefined, {
    staleTime: 30_000,
  });

  const reconcileAllMutation = trpc.billing.reconcileAll.useMutation({
    onSuccess: () => {
      summaryQuery.refetch();
      revenueQuery.refetch();
      companiesQuery.refetch();
      lastSyncQuery.refetch();
    },
  });

  const syncAllMutation = trpc.billing.syncAllVendorCounts.useMutation({
    onSuccess: () => {
      summaryQuery.refetch();
      revenueQuery.refetch();
      companiesQuery.refetch();
      lastSyncQuery.refetch();
    },
  });

  const syncProductsMutation = trpc.billing.syncVendorProducts.useMutation({
    onSuccess: () => {
      companiesQuery.refetch();
    },
  });

  const isSyncing = reconcileAllMutation.isPending || syncAllMutation.isPending;

  const filteredCompanies = (companiesQuery.data ?? []).filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.identifier && c.identifier.toLowerCase().includes(search.toLowerCase()))
  );

  const formatTimeAgo = (date: Date | string | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return `${Math.floor(diffHrs / 24)}d ago`;
  };

  // Merge summary data with revenue/profit
  const summaryData = summaryQuery.data
    ? {
        ...summaryQuery.data,
        revenue: revenueQuery.data?.revenue,
        profit: revenueQuery.data?.profit,
        margin: revenueQuery.data?.margin,
      }
    : undefined;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Billing Reconciliation</h1>
            <p className="text-sm text-zinc-500">
              Last synced: {formatTimeAgo(lastSyncQuery.data ?? null)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/billing/activity"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            Activity Log
          </Link>
          <Link
            href="/billing/insights"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Insights
          </Link>
          <Link
            href="/billing/settings"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Sliders className="h-4 w-4" />
            Settings
          </Link>
          <Link
            href="/billing/mappings"
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Link2 className="h-4 w-4" />
            Mappings
          </Link>
          <button
            onClick={() => syncProductsMutation.mutate()}
            disabled={syncProductsMutation.isPending}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Discover vendor products from APIs"
          >
            {syncProductsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Products
          </button>
          <button
            onClick={() => reconcileAllMutation.mutate()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Reconciliation
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryData && <BillingSummaryCards data={summaryData} />}

      {/* Search */}
      <div className="relative w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
        />
      </div>

      {/* Company Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_100px_120px_130px_30px] px-4 py-2 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div>Company</div>
          <div>Vendors</div>
          <div className="text-center">Items</div>
          <div className="text-center">Discrepancies</div>
          <div>Last Sync</div>
          <div />
        </div>

        {companiesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-zinc-500">
            {search
              ? "No companies match your search."
              : "No companies with agreements found. Run a CW sync first."}
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <Link
              key={company.id}
              href={`/billing/${company.id}`}
              className="grid grid-cols-[1fr_140px_100px_120px_130px_30px] px-4 py-3 border-b border-zinc-800/50 items-center hover:bg-zinc-900/50 transition-colors group"
            >
              {/* Company name */}
              <div>
                <div className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">
                  {company.name}
                </div>
                {company.identifier && (
                  <div className="text-xs text-zinc-500">{company.identifier}</div>
                )}
              </div>

              {/* Vendor badges */}
              <div className="flex gap-1 flex-wrap">
                {company.vendorTools.map((tool) => {
                  const v = VENDOR_LABELS[tool];
                  return v ? (
                    <span
                      key={tool}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${v.color}`}
                    >
                      {v.label}
                    </span>
                  ) : null;
                })}
              </div>

              {/* Total items */}
              <div className="text-center text-sm text-zinc-400">
                {company.totalItems || "\u2014"}
              </div>

              {/* Discrepancies */}
              <div className="flex justify-center">
                {company.discrepancies > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    {company.discrepancies}
                  </span>
                ) : company.totalItems > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    OK
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">{"\u2014"}</span>
                )}
              </div>

              {/* Last sync */}
              <div className="text-xs text-zinc-500">
                {formatTimeAgo(company.lastSyncAt)}
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </div>
            </Link>
          ))
        )}
      </div>

    </div>
  );
}
