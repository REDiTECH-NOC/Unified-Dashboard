"use client";

import { Loader2, Check, X, Search, RefreshCw, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  detected: { label: "Detected", color: "text-amber-400" },
  approved: { label: "Approved", color: "text-green-400" },
  dismissed: { label: "Dismissed", color: "text-zinc-400" },
  synced_to_psa: { label: "Synced to PSA", color: "text-blue-400" },
  auto_approved: { label: "Auto-Approved", color: "text-green-400" },
};

function formatTimeAgo(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

interface BillingActivityLogProps {
  companyId?: string;
  limit?: number;
}

/** Compact activity log for embedding in company detail pages */
export function BillingActivityLog({ companyId, limit = 15 }: BillingActivityLogProps) {
  const activityQuery = trpc.billing.getBillingActivityLog.useQuery(
    { companyId, limit },
    { staleTime: 30_000 }
  );

  const items = activityQuery.data?.items ?? [];

  if (activityQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-zinc-500">
        No billing activity yet. Run a reconciliation to get started.
      </div>
    );
  }

  return (
    <div>
      {/* Mini table header */}
      <div className="grid grid-cols-[1fr_1fr_60px_60px_55px_90px_80px_80px] px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-zinc-800">
        <div>Service</div>
        <div>Contract</div>
        <div className="text-right">PSA</div>
        <div className="text-right">Vendor</div>
        <div className="text-right">Chg</div>
        <div>Action</div>
        <div>User</div>
        <div className="text-right">When</div>
      </div>

      {items.map((entry) => {
        const cfg = ACTION_CONFIG[entry.action] ?? { label: entry.action, color: "text-zinc-400" };

        return (
          <div
            key={entry.id}
            className="grid grid-cols-[1fr_1fr_60px_60px_55px_90px_80px_80px] px-4 py-2 border-b border-zinc-800/50 items-center text-sm hover:bg-zinc-900/30 transition-colors"
          >
            <div className="text-zinc-300 truncate text-xs" title={entry.vendorProductName ?? entry.productName}>
              {entry.vendorProductName ?? entry.productName}
            </div>
            <div className="text-zinc-500 truncate text-xs">
              {entry.agreementName ?? "\u2014"}
            </div>
            <div className="text-right text-zinc-400 font-mono text-xs">{entry.psaQty}</div>
            <div className="text-right text-zinc-400 font-mono text-xs">{entry.vendorQty}</div>
            <div className="text-right font-mono text-xs">
              {entry.change === 0 ? (
                <span className="text-zinc-600">0</span>
              ) : entry.change > 0 ? (
                <span className="text-amber-400">+{entry.change}</span>
              ) : (
                <span className="text-blue-400">{entry.change}</span>
              )}
            </div>
            <div className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</div>
            <div className="text-zinc-500 text-xs truncate">{entry.actorName ?? "System"}</div>
            <div className="text-right text-[10px] text-zinc-600">{formatTimeAgo(entry.createdAt)}</div>
          </div>
        );
      })}
    </div>
  );
}
