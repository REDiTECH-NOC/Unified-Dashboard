"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Package,
  Link2,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { BillingActivityLog } from "../_components/billing-activity-log";

const VENDOR_LABELS: Record<string, { label: string; color: string }> = {
  ninjaone: { label: "NinjaOne", color: "text-blue-400" },
  sentinelone: { label: "SentinelOne", color: "text-purple-400" },
  cove: { label: "Cove Backup", color: "text-teal-400" },
  pax8: { label: "Pax8", color: "text-orange-400" },
  blackpoint: { label: "Blackpoint", color: "text-red-400" },
  avanan: { label: "Avanan", color: "text-cyan-400" },
};

const VENDOR_TAG_COLORS: Record<string, string> = {
  ninjaone: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  sentinelone: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  cove: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  pax8: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  blackpoint: "text-red-400 bg-red-500/10 border-red-500/20",
  avanan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  dismissed: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  adjusted: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function CompanyBillingPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [expandedAgreements, setExpandedAgreements] = useState<Set<string>>(new Set());
  const autoReconcileTriggered = useRef(false);

  const reconciliationQuery = trpc.billing.getCompanyReconciliation.useQuery(
    { companyId },
    { staleTime: 30_000 }
  );

  const reconcileMutation = trpc.billing.reconcileCompany.useMutation({
    onSuccess: () => {
      reconciliationQuery.refetch();
    },
  });

  const reconcileItemMutation = trpc.billing.reconcileItemToPsa.useMutation({
    onSuccess: () => reconciliationQuery.refetch(),
  });

  const resolveItemMutation = trpc.billing.resolveItem.useMutation({
    onSuccess: () => reconciliationQuery.refetch(),
  });

  const data = reconciliationQuery.data;
  const isReconciling = reconcileMutation.isPending;

  // Auto-reconcile on first load when no snapshot exists
  useEffect(() => {
    if (
      data &&
      data.reconciliationItems.length === 0 &&
      !data.lastSnapshotAt &&
      !autoReconcileTriggered.current &&
      !reconcileMutation.isPending
    ) {
      autoReconcileTriggered.current = true;
      reconcileMutation.mutate({ companyId });
    }
  }, [data, companyId, reconcileMutation]);

  const toggleAgreement = (id: string) => {
    setExpandedAgreements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  if (reconciliationQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = data.reconciliationItems as any[];
  const pendingItems = items.filter((i: any) => i.status === "pending");
  const discrepancyCount = pendingItems.filter((i: any) => i.discrepancy !== 0).length;
  const revenueImpact = pendingItems.reduce((sum: number, i: any) => sum + (i.revenueImpact ?? 0), 0);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">{data.company.name}</h1>
            <p className="text-sm text-zinc-500">
              {data.company.identifier ? `${data.company.identifier} · ` : ""}
              Last reconciled: {formatTimeAgo(data.lastSnapshotAt)}
            </p>
          </div>
        </div>

        <button
          onClick={() => reconcileMutation.mutate({ companyId })}
          disabled={isReconciling}
          className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {isReconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isReconciling ? "Reconciling..." : "Re-Reconcile"}
        </button>
      </div>

      {/* Mini Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-xs text-zinc-500">Total Items</div>
          <div className="text-2xl font-semibold text-zinc-100">{items.length}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-xs text-zinc-500">Discrepancies</div>
          <div className={`text-2xl font-semibold ${discrepancyCount > 0 ? "text-amber-400" : "text-green-400"}`}>
            {discrepancyCount}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-xs text-zinc-500">Revenue Impact</div>
          <div className={`text-2xl font-semibold ${revenueImpact > 0 ? "text-red-400" : revenueImpact < 0 ? "text-green-400" : "text-zinc-400"}`}>
            ${Math.abs(revenueImpact).toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <div className="text-xs text-zinc-500">Vendor Integrations</div>
          <div className="flex gap-2 mt-1">
            {(data.integrationMappings as any[]).map((m: any) => {
              const v = VENDOR_LABELS[m.toolId];
              return (
                <span key={m.id} className={`text-sm font-medium ${v?.color ?? "text-zinc-400"}`}>
                  {v?.label ?? m.toolId}
                </span>
              );
            })}
            {data.integrationMappings.length === 0 && (
              <span className="text-sm text-zinc-500">None mapped</span>
            )}
          </div>
        </div>
      </div>

      {/* Vendor Products — live from APIs */}
      <VendorProductsSection companyId={companyId} />

      {/* Reconciliation Items */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Reconciliation</h2>
        </div>

        {isReconciling ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-green-400" />
            <span className="text-sm text-zinc-400">Fetching vendor counts and comparing...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-sm text-zinc-500">
              {data.integrationMappings.length === 0
                ? "No vendor integrations linked. Map this company to NinjaOne, SentinelOne, or Cove in Settings > Integrations."
                : "No mappings match this company's billing items. Set up product mappings in Billing > Mappings."}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_90px_90px_90px_90px_100px_120px] px-4 py-2 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <div>Vendor Product</div>
              <div>CW Billing Item</div>
              <div className="text-right">CW Qty</div>
              <div className="text-right">Actual</div>
              <div className="text-right">Diff</div>
              <div className="text-right">Impact</div>
              <div className="text-center">Status</div>
              <div className="text-center">Actions</div>
            </div>

            {items.map((item: any) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_1fr_90px_90px_90px_90px_100px_120px] px-4 py-3 border-b border-zinc-800/50 items-center hover:bg-zinc-900/30 transition-colors"
              >
                {/* Vendor product */}
                <div>
                  <div className="text-sm text-zinc-200">{item.vendorProductName ?? item.vendorToolId}</div>
                  <div className="text-xs text-zinc-500">
                    {VENDOR_LABELS[item.vendorToolId]?.label ?? item.vendorToolId}
                  </div>
                </div>

                {/* CW billing item */}
                <div className="text-sm text-zinc-300">
                  {item.productName}
                  {item.agreementName && (
                    <div className="text-xs text-zinc-500 truncate">{item.agreementName}</div>
                  )}
                </div>

                {/* CW Qty */}
                <div className="text-right text-sm text-zinc-400">{item.psaQty}</div>

                {/* Actual vendor count */}
                <div className="text-right text-sm text-zinc-200 font-medium">{item.vendorQty}</div>

                {/* Diff */}
                <div className={`text-right text-sm font-medium ${
                  item.discrepancy > 0
                    ? "text-red-400"
                    : item.discrepancy < 0
                    ? "text-amber-400"
                    : "text-green-400"
                }`}>
                  {item.discrepancy > 0 ? "+" : ""}{item.discrepancy}
                </div>

                {/* Revenue impact */}
                <div className={`text-right text-sm ${
                  (item.revenueImpact ?? 0) > 0
                    ? "text-red-400"
                    : (item.revenueImpact ?? 0) < 0
                    ? "text-amber-400"
                    : "text-zinc-500"
                }`}>
                  {item.revenueImpact
                    ? `$${Math.abs(item.revenueImpact).toFixed(2)}`
                    : "—"}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  {item.discrepancy === 0 && item.status === "approved" ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                      STATUS_COLORS[item.status] ?? STATUS_COLORS.pending
                    }`}>
                      {item.status}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-1">
                  {item.status === "pending" && (
                    <>
                      {item.additionPsaId && item.discrepancy !== 0 && (
                        <button
                          onClick={() => reconcileItemMutation.mutate({ itemId: item.id })}
                          disabled={reconcileItemMutation.isPending}
                          className="h-7 px-2 rounded text-[10px] font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                          title="Update CW quantity to match vendor count"
                        >
                          Fix
                        </button>
                      )}
                      <button
                        onClick={() => resolveItemMutation.mutate({ itemId: item.id, action: "approve" })}
                        disabled={resolveItemMutation.isPending}
                        className="h-7 px-2 rounded text-[10px] border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                      >
                        OK
                      </button>
                      {item.discrepancy !== 0 && (
                        <button
                          onClick={() => resolveItemMutation.mutate({ itemId: item.id, action: "dismiss" })}
                          disabled={resolveItemMutation.isPending}
                          className="h-7 px-2 rounded text-[10px] border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          Skip
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Agreements Section (collapsed by default, for reference) */}
      {data.agreements.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200">
              CW Agreements ({data.agreements.length})
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">All billed items from ConnectWise</p>
          </div>
          {(data.agreements as any[]).map((ag: any) => (
            <div key={ag.id}>
              <button
                onClick={() => toggleAgreement(ag.id)}
                className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
              >
                <div className="text-left">
                  <div className="text-sm text-zinc-200">{ag.name}</div>
                  <div className="text-xs text-zinc-500">
                    {ag.additions.length} addition{ag.additions.length !== 1 ? "s" : ""}
                  </div>
                </div>
                {expandedAgreements.has(ag.id) ? (
                  <ChevronUp className="h-4 w-4 text-zinc-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500" />
                )}
              </button>
              {expandedAgreements.has(ag.id) && ag.additions.length > 0 && (
                <div className="bg-zinc-900/20">
                  <div className="grid grid-cols-[1fr_100px_100px] px-6 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-zinc-800/30">
                    <div>Product</div>
                    <div className="text-right">Quantity</div>
                    <div className="text-right">Unit Price</div>
                  </div>
                  {ag.additions.map((add: any) => (
                    <div
                      key={add.id}
                      className="grid grid-cols-[1fr_100px_100px] px-6 py-2 border-b border-zinc-800/20 text-sm"
                    >
                      <div className="text-zinc-300">{add.productName}</div>
                      <div className="text-right text-zinc-400">{add.quantity}</div>
                      <div className="text-right text-zinc-500">
                        {add.unitPrice ? `$${add.unitPrice.toFixed(2)}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Activity Log */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Activity</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Recent billing actions for this company</p>
        </div>
        <BillingActivityLog companyId={companyId} limit={10} />
      </div>
    </div>
  );
}

// ─── Vendor Products with Inline Mapping ────────────────────

function VendorProductsSection({ companyId }: { companyId: string }) {
  const [mappingTarget, setMappingTarget] = useState<{
    toolId: string;
    productKey: string;
    productName: string;
  } | null>(null);
  const [cwSearch, setCwSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const vendorProductsQuery = trpc.billing.getCompanyVendorProducts.useQuery(
    { companyId },
    { staleTime: 60_000 }
  );

  const cwProductsQuery = trpc.billing.getCwProducts.useQuery(
    { searchTerm: cwSearch || undefined },
    { enabled: !!mappingTarget }
  );

  const quickMapMutation = trpc.billing.quickMapVendorProduct.useMutation({
    onSuccess: () => {
      vendorProductsQuery.refetch();
      setMappingTarget(null);
      setCwSearch("");
      setShowDropdown(false);
    },
  });

  const products = vendorProductsQuery.data;

  type VendorProduct = NonNullable<typeof products>[number];

  // Group products by vendor
  const grouped = useMemo(() => {
    if (!products) return new Map<string, VendorProduct[]>();
    const map = new Map<string, VendorProduct[]>();
    for (const p of products) {
      const list = map.get(p.toolId) ?? [];
      list.push(p);
      map.set(p.toolId, list);
    }
    return map;
  }, [products]);

  if (vendorProductsQuery.isLoading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          <span className="text-sm text-zinc-500">Loading vendor products...</span>
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-400" />
            Vendor Products
          </h2>
        </div>
        <div className="px-4 py-8 text-center text-sm text-zinc-500">
          No vendor products found. Link vendor accounts in Settings &gt; Integrations.
        </div>
      </div>
    );
  }

  const totalProducts = products.length;
  const mappedCount = products.filter((p) => p.isMapped).length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-400" />
            Vendor Products
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Live subscription counts from linked vendors ({mappedCount}/{totalProducts} mapped to CW)
          </p>
        </div>
      </div>

      {Array.from(grouped.entries()).map(([toolId, vendorProducts]) => (
        <div key={toolId}>
          {/* Vendor header */}
          <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/50 flex items-center gap-2">
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${
              VENDOR_TAG_COLORS[toolId] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
            }`}>
              {VENDOR_LABELS[toolId]?.label ?? toolId}
            </span>
            <span className="text-[10px] text-zinc-500">
              {vendorProducts.length} product{vendorProducts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Products table header */}
          <div className="grid grid-cols-[1fr_80px_80px_250px] px-4 py-1.5 border-b border-zinc-800/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <div>Product</div>
            <div className="text-right">Qty</div>
            <div className="text-center">Unit</div>
            <div>CW Mapping</div>
          </div>

          {/* Product rows */}
          {vendorProducts.map((p) => (
            <div
              key={`${p.toolId}:${p.productKey}`}
              className="grid grid-cols-[1fr_80px_80px_250px] px-4 py-2.5 border-b border-zinc-800/30 items-center hover:bg-zinc-900/30 transition-colors"
            >
              <div className="text-sm text-zinc-200 truncate pr-2">{p.productName}</div>
              <div className="text-right font-mono text-sm text-zinc-300">{p.quantity}</div>
              <div className="text-center text-xs text-zinc-500">{p.unit}</div>
              <div className="relative">
                {p.isMapped ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Link2 className="h-3 w-3 text-green-400 shrink-0" />
                    <span className="text-green-400 truncate">{p.cwProductName}</span>
                  </div>
                ) : mappingTarget?.productKey === p.productKey && mappingTarget?.toolId === p.toolId ? (
                  <div className="relative">
                    <div className="flex items-center gap-1">
                      <Search className="h-3 w-3 text-zinc-500 shrink-0" />
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search CW products..."
                        value={cwSearch}
                        onChange={(e) => {
                          setCwSearch(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        autoFocus
                        className="w-full px-2 py-1 text-xs bg-muted/50 border border-primary/50 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={() => {
                          setMappingTarget(null);
                          setCwSearch("");
                          setShowDropdown(false);
                        }}
                        className="text-zinc-500 hover:text-zinc-300 shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {showDropdown && typeof document !== "undefined" && (() => {
                      const rect = inputRef.current?.getBoundingClientRect();
                      if (!rect) return null;
                      return createPortal(
                        <div
                          className="fixed z-[100] max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg"
                          style={{
                            bottom: `${window.innerHeight - rect.top + 4}px`,
                            left: `${rect.left}px`,
                            width: `${Math.max(rect.width, 480)}px`,
                          }}
                        >
                          {cwProductsQuery.isLoading ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Searching...
                            </div>
                          ) : !cwProductsQuery.data?.length ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                              {cwSearch ? "No CW products found" : "Type to search CW products"}
                            </div>
                          ) : (
                            cwProductsQuery.data.map((cw) => (
                              <button
                                key={cw.id}
                                onClick={() => {
                                  quickMapMutation.mutate({
                                    vendorToolId: mappingTarget.toolId,
                                    vendorProductKey: mappingTarget.productKey,
                                    vendorProductName: mappingTarget.productName,
                                    psaProductName: cw.description ?? cw.identifier,
                                  });
                                }}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                                title={`${cw.description ?? cw.identifier}${cw.category ? ` (${cw.category})` : ""}`}
                              >
                                <span className="text-zinc-200">{cw.description ?? cw.identifier}</span>
                                {cw.category && (
                                  <span className="text-[10px] text-zinc-500 shrink-0">({cw.category})</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>,
                        document.body
                      );
                    })()}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setMappingTarget({
                        toolId: p.toolId,
                        productKey: p.productKey,
                        productName: p.productName,
                      });
                      setCwSearch("");
                    }}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />
                    Map to CW
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
