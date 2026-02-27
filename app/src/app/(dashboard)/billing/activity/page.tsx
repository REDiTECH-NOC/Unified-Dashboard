"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Search,
  Filter,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  RefreshCw,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const VENDOR_LABELS: Record<string, { label: string; color: string }> = {
  ninjaone: { label: "NinjaOne", color: "text-blue-400" },
  sentinelone: { label: "SentinelOne", color: "text-purple-400" },
  cove: { label: "Cove", color: "text-teal-400" },
};

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Check }> = {
  detected: { label: "Detected", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: Search },
  approved: { label: "Approved", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", icon: Check },
  dismissed: { label: "Dismissed", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/30", icon: X },
  synced_to_psa: { label: "Synced to PSA", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: RefreshCw },
  auto_approved: { label: "Auto-Approved", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", icon: Check },
};

const ACTION_FILTERS = [
  { value: "", label: "All Actions" },
  { value: "detected", label: "Detected" },
  { value: "approved", label: "Approved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "synced_to_psa", label: "Synced to PSA" },
  { value: "auto_approved", label: "Auto-Approved" },
];

const VENDOR_FILTERS = [
  { value: "", label: "All Vendors" },
  { value: "ninjaone", label: "NinjaOne" },
  { value: "sentinelone", label: "SentinelOne" },
  { value: "cove", label: "Cove" },
];

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date | string | null): string {
  if (!date) return "\u2014";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BillingActivityPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);

  const activityQuery = trpc.billing.getBillingActivityLog.useQuery(
    {
      limit: 100,
      actionFilter: actionFilter || undefined,
      vendorFilter: vendorFilter || undefined,
      search: search || undefined,
    },
    { staleTime: 15_000 }
  );

  const items = activityQuery.data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/billing"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20">
            <ClipboardList className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Activity Log</h1>
            <p className="text-sm text-zinc-500">
              Reconciliation count changes, approvals, and PSA sync history
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
          />
        </div>

        {/* Action Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowActionDropdown(!showActionDropdown); setShowVendorDropdown(false); }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-950 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            <Filter className="h-3.5 w-3.5" />
            {ACTION_FILTERS.find((f) => f.value === actionFilter)?.label ?? "All Actions"}
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </button>
          {showActionDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl z-50">
              {ACTION_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setActionFilter(f.value); setShowActionDropdown(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    actionFilter === f.value ? "text-zinc-100 bg-zinc-800" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vendor Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowVendorDropdown(!showVendorDropdown); setShowActionDropdown(false); }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-950 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            {VENDOR_FILTERS.find((f) => f.value === vendorFilter)?.label ?? "All Vendors"}
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </button>
          {showVendorDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-zinc-800 bg-zinc-950 py-1 shadow-xl z-50">
              {VENDOR_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setVendorFilter(f.value); setShowVendorDropdown(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    vendorFilter === f.value ? "text-zinc-100 bg-zinc-800" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result count */}
        <div className="ml-auto text-xs text-zinc-500">
          {activityQuery.isLoading ? "Loading..." : `${items.length} entries`}
        </div>
      </div>

      {/* Activity Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[140px_1fr_1fr_1fr_70px_70px_70px_100px_110px_90px_1fr] px-4 py-2 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div>Date</div>
          <div>Account</div>
          <div>Contract</div>
          <div>Service</div>
          <div className="text-right">PSA</div>
          <div className="text-right">Vendor</div>
          <div className="text-right">Change</div>
          <div>Eff. Date</div>
          <div>Action</div>
          <div>Result</div>
          <div>User</div>
        </div>

        {/* Loading */}
        {activityQuery.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}

        {/* Empty */}
        {!activityQuery.isLoading && items.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-zinc-500">
            {search || actionFilter || vendorFilter
              ? "No activity entries match your filters."
              : "No activity yet. Run a reconciliation to start tracking changes."}
          </div>
        )}

        {/* Rows */}
        {items.map((entry) => {
          const actionCfg = ACTION_CONFIG[entry.action] ?? {
            label: entry.action,
            color: "text-zinc-400",
            bg: "bg-zinc-500/10 border-zinc-500/30",
            icon: Minus,
          };
          const ActionIcon = actionCfg.icon;
          const vendor = VENDOR_LABELS[entry.vendorToolId];

          return (
            <div
              key={entry.id}
              className="grid grid-cols-[140px_1fr_1fr_1fr_70px_70px_70px_100px_110px_90px_1fr] px-4 py-2.5 border-b border-zinc-800/50 items-center text-sm hover:bg-zinc-900/30 transition-colors"
            >
              {/* Date */}
              <div className="text-xs text-zinc-500">
                {formatDate(entry.createdAt)}
              </div>

              {/* Account */}
              <div className="text-zinc-200 truncate pr-2" title={entry.companyName}>
                {entry.companyName}
              </div>

              {/* Contract */}
              <div className="text-zinc-400 truncate pr-2" title={entry.agreementName ?? ""}>
                {entry.agreementName ?? "\u2014"}
              </div>

              {/* Service */}
              <div className="truncate pr-2" title={entry.vendorProductName ?? entry.productName}>
                <span className={vendor?.color ?? "text-zinc-400"}>
                  {entry.vendorProductName ?? entry.productName}
                </span>
              </div>

              {/* PSA Count */}
              <div className="text-right text-zinc-300 font-mono text-xs">
                {entry.psaQty}
              </div>

              {/* Vendor Count */}
              <div className="text-right text-zinc-300 font-mono text-xs">
                {entry.vendorQty}
              </div>

              {/* Change */}
              <div className="text-right font-mono text-xs">
                {entry.change === 0 ? (
                  <span className="text-zinc-500">0</span>
                ) : entry.change > 0 ? (
                  <span className="text-amber-400 inline-flex items-center gap-0.5 justify-end">
                    <ArrowUpRight className="h-3 w-3" />
                    +{entry.change}
                  </span>
                ) : (
                  <span className="text-blue-400 inline-flex items-center gap-0.5 justify-end">
                    <ArrowDownRight className="h-3 w-3" />
                    {entry.change}
                  </span>
                )}
              </div>

              {/* Effective Date */}
              <div className="text-xs text-zinc-500">
                {formatShortDate(entry.effectiveDate)}
              </div>

              {/* Action */}
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${actionCfg.bg} ${actionCfg.color}`}
                >
                  <ActionIcon className="h-3 w-3" />
                  {actionCfg.label}
                </span>
              </div>

              {/* Result */}
              <div className="text-xs">
                {entry.result === "success" ? (
                  <span className="text-green-400">Success</span>
                ) : entry.result === "pending" ? (
                  <span className="text-amber-400">Pending</span>
                ) : entry.result === "no_action" ? (
                  <span className="text-zinc-500">No Action</span>
                ) : entry.result === "failed" ? (
                  <span className="text-red-400">Failed</span>
                ) : (
                  <span className="text-zinc-500">{entry.result}</span>
                )}
              </div>

              {/* User */}
              <div className="text-xs text-zinc-400 truncate">
                {entry.actorName ?? "System"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more (if nextCursor exists) */}
      {activityQuery.data?.nextCursor && (
        <div className="text-center">
          <button
            onClick={() => {
              // For now, increase limit. Could implement true pagination later.
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Showing first {items.length} entries
          </button>
        </div>
      )}
    </div>
  );
}
