"use client";

import { useState } from "react";
import { ArrowUpDown, Check, X, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { ReconcileConfirmDialog } from "./reconcile-confirm-dialog";
import { trpc } from "@/lib/trpc";

const VENDOR_LABELS: Record<string, string> = {
  ninjaone: "NinjaOne",
  sentinelone: "SentinelOne",
  cove: "Cove Backup",
  pax8: "Pax8",
  cipp: "CIPP",
  blackpoint: "Blackpoint",
  avanan: "Avanan",
};

const VENDOR_COLORS: Record<string, string> = {
  ninjaone: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  sentinelone: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  cove: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  pax8: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

interface ReconciliationItem {
  id: string;
  companyId: string;
  companyName: string;
  agreementName: string | null;
  productName: string;
  vendorToolId: string;
  vendorProductName: string | null;
  psaQty: number;
  vendorQty: number;
  discrepancy: number;
  unitPrice: number | null;
  revenueImpact: number | null;
  status: string;
  additionPsaId: string | null;
  agreementPsaId: string | null;
  snapshot: { snapshotAt: Date };
}

interface Props {
  items: ReconciliationItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onRefresh: () => void;
}

export function ReconciliationTable({
  items,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onRefresh,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<ReconciliationItem | null>(null);

  const reconcileMutation = trpc.billing.reconcileItemToPsa.useMutation({
    onSuccess: () => {
      onRefresh();
    },
  });

  const resolveMutation = trpc.billing.resolveItem.useMutation({
    onSuccess: () => {
      onRefresh();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      case "approved":
        return "text-green-400 border-green-500/20 bg-green-500/5";
      case "dismissed":
        return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
      case "adjusted":
        return "text-blue-400 border-blue-500/20 bg-blue-500/5";
      default:
        return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
    }
  };

  const getDiffColor = (diff: number) => {
    if (diff > 0) return "text-red-400"; // underbilling
    if (diff < 0) return "text-amber-400"; // overbilling
    return "text-green-400"; // match
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_1fr_120px_80px_80px_80px_100px_100px_80px] px-4 py-2 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedIds.size === items.length && items.length > 0}
              onChange={onSelectAll}
              className="rounded border-zinc-700"
            />
          </div>
          <div>Company</div>
          <div>Agreement</div>
          <div>Product</div>
          <div>Vendor</div>
          <div className="text-right">PSA Qty</div>
          <div className="text-right">Vendor Qty</div>
          <div className="text-right">Diff</div>
          <div className="text-right">Impact</div>
          <div className="text-center">Status</div>
          <div className="text-center">Actions</div>
        </div>

        {/* Rows */}
        {items.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">
            No reconciliation data yet. Run a reconciliation to compare vendor counts with PSA billing.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id}>
              <div
                className={`grid grid-cols-[40px_1fr_1fr_1fr_120px_80px_80px_80px_100px_100px_80px] px-4 py-2.5 border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/30 items-center ${
                  expandedId === item.id ? "bg-zinc-900/30" : ""
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    className="rounded border-zinc-700"
                  />
                </div>

                {/* Company */}
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="flex items-center gap-1 text-left text-sm text-zinc-100 hover:text-white"
                >
                  {expandedId === item.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  )}
                  <span className="truncate">{item.companyName}</span>
                </button>

                {/* Agreement */}
                <div className="text-sm text-zinc-400 truncate">
                  {item.agreementName ?? "—"}
                </div>

                {/* Product */}
                <div className="text-sm text-zinc-200 truncate">{item.productName}</div>

                {/* Vendor */}
                <div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs border ${
                      VENDOR_COLORS[item.vendorToolId] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                    }`}
                  >
                    {VENDOR_LABELS[item.vendorToolId] ?? item.vendorToolId}
                  </span>
                </div>

                {/* PSA Qty */}
                <div className="text-sm text-zinc-300 text-right font-mono">
                  {item.psaQty}
                </div>

                {/* Vendor Qty */}
                <div className="text-sm text-zinc-300 text-right font-mono">
                  {item.vendorQty}
                </div>

                {/* Diff */}
                <div className={`text-sm text-right font-mono font-medium ${getDiffColor(item.discrepancy)}`}>
                  {item.discrepancy > 0 ? "+" : ""}{item.discrepancy}
                </div>

                {/* Revenue Impact */}
                <div className={`text-sm text-right font-mono ${getDiffColor(item.discrepancy)}`}>
                  {item.revenueImpact != null
                    ? `${item.revenueImpact > 0 ? "+" : ""}$${Math.abs(item.revenueImpact).toFixed(0)}`
                    : "—"}
                </div>

                {/* Status */}
                <div className="text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs border capitalize ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  {item.status === "pending" && item.discrepancy !== 0 && item.additionPsaId && (
                    <button
                      onClick={() => setReconcileTarget(item)}
                      title="Reconcile to PSA"
                      className="p-1 rounded text-green-400 hover:bg-green-500/10 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                  {item.status === "pending" && (
                    <>
                      <button
                        onClick={() => resolveMutation.mutate({ itemId: item.id, action: "approve" })}
                        title="Approve"
                        className="p-1 rounded text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => resolveMutation.mutate({ itemId: item.id, action: "dismiss" })}
                        title="Dismiss"
                        className="p-1 rounded text-zinc-400 hover:bg-zinc-500/10 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === item.id && (
                <div className="bg-zinc-900/30 border-b border-zinc-800/30 px-8 py-4">
                  <div className="grid grid-cols-3 gap-6 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Product Details</div>
                      <div className="space-y-1">
                        <div><span className="text-zinc-500">PSA Product:</span> <span className="text-zinc-200">{item.productName}</span></div>
                        <div><span className="text-zinc-500">Vendor Product:</span> <span className="text-zinc-200">{item.vendorProductName ?? "—"}</span></div>
                        <div><span className="text-zinc-500">Unit Price:</span> <span className="text-zinc-200">{item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : "—"}</span></div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Comparison</div>
                      <div className="space-y-1">
                        <div><span className="text-zinc-500">PSA Billing Qty:</span> <span className="text-zinc-200 font-mono">{item.psaQty}</span></div>
                        <div><span className="text-zinc-500">Vendor Count:</span> <span className="text-zinc-200 font-mono">{item.vendorQty}</span></div>
                        <div><span className="text-zinc-500">Difference:</span> <span className={`font-mono font-medium ${getDiffColor(item.discrepancy)}`}>{item.discrepancy > 0 ? "+" : ""}{item.discrepancy}</span></div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Revenue Impact</div>
                      <div className="space-y-1">
                        <div><span className="text-zinc-500">Per Unit:</span> <span className="text-zinc-200">{item.unitPrice ? `$${item.unitPrice.toFixed(2)}` : "—"}</span></div>
                        <div><span className="text-zinc-500">Total Impact:</span> <span className={`font-medium ${getDiffColor(item.discrepancy)}`}>{item.revenueImpact != null ? `$${Math.abs(item.revenueImpact).toFixed(2)}` : "—"}</span></div>
                        <div><span className="text-zinc-500">{item.discrepancy > 0 ? "Underbilled" : item.discrepancy < 0 ? "Overbilled" : "Matched"}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Reconcile confirmation dialog */}
      {reconcileTarget && (
        <ReconcileConfirmDialog
          open={true}
          onClose={() => setReconcileTarget(null)}
          onConfirm={async () => {
            await reconcileMutation.mutateAsync({ itemId: reconcileTarget.id });
          }}
          productName={reconcileTarget.productName}
          companyName={reconcileTarget.companyName}
          vendorName={VENDOR_LABELS[reconcileTarget.vendorToolId] ?? reconcileTarget.vendorToolId}
          psaQty={reconcileTarget.psaQty}
          vendorQty={reconcileTarget.vendorQty}
        />
      )}
    </>
  );
}
