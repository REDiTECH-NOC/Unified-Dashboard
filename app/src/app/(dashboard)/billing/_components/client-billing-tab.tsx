"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DollarSign,
  RefreshCw,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  Link2,
  Search,
  AlertTriangle,
  EyeOff,
  Eye,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ReconcileConfirmDialog } from "./reconcile-confirm-dialog";

const VENDOR_LABELS: Record<string, string> = {
  ninjaone: "NinjaOne",
  sentinelone: "SentinelOne",
  cove: "Cove Backup",
  pax8: "Pax8",
  blackpoint: "Blackpoint",
  avanan: "Avanan",
};

const VENDOR_COLORS: Record<string, string> = {
  ninjaone: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  sentinelone: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  cove: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  pax8: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  blackpoint: "text-red-400 bg-red-500/10 border-red-500/20",
  avanan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

export function ClientBillingTab({ companyId }: { companyId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<any>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const reconciliationQuery = trpc.billing.getCompanyReconciliation.useQuery(
    { companyId },
    { staleTime: 30_000 }
  );

  const reconcileMutation = trpc.billing.reconcileCompany.useMutation({
    onSuccess: () => reconciliationQuery.refetch(),
  });

  const reconcileItemMutation = trpc.billing.reconcileItemToPsa.useMutation({
    onSuccess: () => reconciliationQuery.refetch(),
  });

  const resolveMutation = trpc.billing.resolveItem.useMutation({
    onSuccess: () => reconciliationQuery.refetch(),
  });

  const updateNoteMutation = trpc.billing.updateItemNote.useMutation({
    onSuccess: () => {
      reconciliationQuery.refetch();
      setEditingNoteId(null);
      setNoteText("");
    },
  });

  const data = reconciliationQuery.data;

  const getDiffColor = (diff: number) => {
    if (diff > 0) return "text-red-400";
    if (diff < 0) return "text-amber-400";
    return "text-green-400";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return "text-amber-400 border-amber-500/20 bg-amber-500/5";
      case "approved": return "text-green-400 border-green-500/20 bg-green-500/5";
      case "dismissed": return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
      case "adjusted": return "text-blue-400 border-blue-500/20 bg-blue-500/5";
      default: return "text-zinc-400 border-zinc-500/20 bg-zinc-500/5";
    }
  };

  return (
    <div className="space-y-4">
      {/* Reconciliation Section */}
      <section className="rounded-lg border border-border/50 bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            Billing Reconciliation
          </h3>
          <button
            onClick={() => reconcileMutation.mutate({ companyId })}
            disabled={reconcileMutation.isPending}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-green-600 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {reconcileMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync & Reconcile
          </button>
        </div>

        {reconciliationQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : !data || data.reconciliationItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">
            {data?.agreements.length === 0
              ? "No active agreements found for this company."
              : "No reconciliation data yet. Click \"Sync & Reconcile\" to compare vendor counts."}
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="flex gap-3 text-xs">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
                <span className="text-zinc-500">Items: </span>
                <span className="text-zinc-200 font-medium">{data.reconciliationItems.length}</span>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
                <span className="text-zinc-500">Discrepancies: </span>
                <span className={`font-medium ${
                  data.reconciliationItems.filter((i: any) => i.discrepancy !== 0 && i.status === "pending").length > 0
                    ? "text-red-400" : "text-green-400"
                }`}>
                  {data.reconciliationItems.filter((i: any) => i.discrepancy !== 0 && i.status === "pending").length}
                </span>
              </div>
              {data.lastSnapshotAt && (
                <div className="rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
                  <span className="text-zinc-500">Last sync: </span>
                  <span className="text-zinc-300">
                    {new Date(data.lastSnapshotAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Items table */}
            <div className="rounded-lg border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_60px_60px_60px_80px_80px] px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <div>Product</div>
                <div>Vendor</div>
                <div className="text-right">PSA</div>
                <div className="text-right">Vendor</div>
                <div className="text-right">Diff</div>
                <div className="text-center">Status</div>
                <div className="text-center">Actions</div>
              </div>

              {data.reconciliationItems.map((item: any) => (
                <div key={item.id}>
                  <div className="grid grid-cols-[1fr_100px_60px_60px_60px_80px_80px] px-3 py-2 border-b border-zinc-800/50 items-center hover:bg-zinc-900/30 transition-colors text-sm">
                    <div>
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-left text-zinc-200 hover:text-white truncate"
                      >
                        {expandedId === item.id ? (
                          <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                        )}
                        <span className="truncate">{item.productName}</span>
                      </button>
                      {item.resolvedNote && editingNoteId !== item.id && (
                        <button
                          onClick={() => { setEditingNoteId(item.id); setNoteText(item.resolvedNote ?? ""); }}
                          className="flex items-center gap-1 ml-4 mt-0.5 text-[11px] text-zinc-500 italic hover:text-zinc-400 transition-colors"
                        >
                          <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate max-w-[180px]">{item.resolvedNote}</span>
                        </button>
                      )}
                    </div>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${
                      VENDOR_COLORS[item.vendorToolId] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                    }`}>
                      {VENDOR_LABELS[item.vendorToolId] ?? item.vendorToolId}
                    </span>
                    <div className="text-right font-mono text-zinc-300">{item.psaQty}</div>
                    <div className="text-right font-mono text-zinc-300">{item.vendorQty}</div>
                    <div className={`text-right font-mono font-medium ${getDiffColor(item.discrepancy)}`}>
                      {item.discrepancy > 0 ? "+" : ""}{item.discrepancy}
                    </div>
                    <div className="text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border capitalize ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        onClick={() => {
                          if (editingNoteId === item.id) {
                            setEditingNoteId(null);
                            setNoteText("");
                          } else {
                            setEditingNoteId(item.id);
                            setNoteText(item.resolvedNote ?? "");
                          }
                        }}
                        className={`p-0.5 rounded transition-colors ${
                          item.resolvedNote
                            ? "text-blue-400 hover:bg-blue-500/10"
                            : "text-zinc-500 hover:bg-zinc-500/10 hover:text-zinc-400"
                        }`}
                        title={item.resolvedNote ? "Edit note" : "Add note"}
                      >
                        {item.resolvedNote ? <MessageSquare className="h-3.5 w-3.5" /> : <Pencil className="h-3 w-3" />}
                      </button>
                      {item.status === "pending" && item.discrepancy !== 0 && item.additionPsaId && (
                        <button
                          onClick={() => setReconcileTarget(item)}
                          title="Reconcile to PSA"
                          className="p-0.5 rounded text-green-400 hover:bg-green-500/10"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {item.status === "pending" && (
                        <>
                          <button
                            onClick={() => resolveMutation.mutate({ itemId: item.id, action: "approve" })}
                            title="Approve"
                            className="p-0.5 rounded text-green-400 hover:bg-green-500/10"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => resolveMutation.mutate({ itemId: item.id, action: "dismiss" })}
                            title="Dismiss"
                            className="p-0.5 rounded text-zinc-400 hover:bg-zinc-500/10"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline note editor */}
                  {editingNoteId === item.id && (
                    <div className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateNoteMutation.mutate({ itemId: item.id, note: noteText });
                          } else if (e.key === "Escape") {
                            setEditingNoteId(null);
                            setNoteText("");
                          }
                        }}
                        placeholder='Add a note (e.g. "free backups we are providing x5")...'
                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                        autoFocus
                      />
                      <button
                        onClick={() => updateNoteMutation.mutate({ itemId: item.id, note: noteText })}
                        disabled={updateNoteMutation.isPending}
                        className="h-6 px-2 rounded text-[10px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {updateNoteMutation.isPending ? "..." : "Save"}
                      </button>
                      {item.resolvedNote && (
                        <button
                          onClick={() => updateNoteMutation.mutate({ itemId: item.id, note: "" })}
                          disabled={updateNoteMutation.isPending}
                          className="h-6 px-2 rounded text-[10px] border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingNoteId(null); setNoteText(""); }}
                        className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {expandedId === item.id && (
                    <div className="bg-zinc-900/30 border-b border-zinc-800/30 px-6 py-3 text-xs space-y-1">
                      <div><span className="text-zinc-500">Agreement:</span> <span className="text-zinc-300">{item.agreementName ?? "—"}</span></div>
                      <div><span className="text-zinc-500">Unit Price:</span> <span className="text-zinc-300">{item.unitPrice != null ? `$${item.unitPrice.toFixed(2)}` : "—"}</span></div>
                      <div><span className="text-zinc-500">Revenue Impact:</span> <span className={getDiffColor(item.discrepancy)}>{item.revenueImpact != null ? `$${Math.abs(item.revenueImpact).toFixed(2)}` : "—"}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {reconcileTarget && (
          <ReconcileConfirmDialog
            open={true}
            onClose={() => setReconcileTarget(null)}
            onConfirm={async () => {
              await reconcileItemMutation.mutateAsync({ itemId: reconcileTarget.id });
            }}
            productName={reconcileTarget.productName}
            companyName="this company"
            vendorName={VENDOR_LABELS[reconcileTarget.vendorToolId] ?? reconcileTarget.vendorToolId}
            psaQty={reconcileTarget.psaQty}
            vendorQty={reconcileTarget.vendorQty}
          />
        )}
      </section>

      {/* Vendor Products Section — shows live products from all linked vendors */}
      <VendorProductsSection companyId={companyId} />
    </div>
  );
}

// ─── Vendor Products with Inline Mapping ────────────────────

function VendorProductsSection({ companyId }: { companyId: string }) {
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
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

  const ignoreMutation = trpc.billing.ignoreVendorProduct.useMutation({
    onSuccess: () => vendorProductsQuery.refetch(),
  });

  const unignoreMutation = trpc.billing.unignoreVendorProduct.useMutation({
    onSuccess: () => vendorProductsQuery.refetch(),
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

  const toggleVendor = (toolId: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  };

  if (vendorProductsQuery.isLoading) {
    return (
      <section className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return (
      <section className="rounded-lg border border-border/50 bg-card p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-blue-400" />
          Vendor Products
        </h3>
        <div className="text-center py-6 text-sm text-zinc-500">
          No vendor products found. Link vendor accounts in Settings to see products.
        </div>
      </section>
    );
  }

  const totalProducts = products.length;
  const mappedCount = products.filter((p) => p.isMapped).length;
  const ignoredCount = products.filter((p) => p.isIgnored).length;

  return (
    <section className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-400" />
          Vendor Products
          <span className="text-[10px] text-zinc-500 font-normal">
            {mappedCount}/{totalProducts} mapped{ignoredCount > 0 && `, ${ignoredCount} ignored`}
          </span>
        </h3>
      </div>

      {/* Products by vendor — collapsible */}
      {Array.from(grouped.entries()).map(([toolId, vendorProducts]) => {
        const isExpanded = expandedVendors.has(toolId);
        const unmappedCount = vendorProducts.filter((p) => !p.isMapped && !p.isIgnored).length;

        return (
          <div key={toolId}>
            {/* Vendor header — clickable to expand/collapse */}
            <button
              onClick={() => toggleVendor(toolId)}
              className="w-full px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/50 flex items-center gap-2 hover:bg-zinc-900/60 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              )}
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${
                VENDOR_COLORS[toolId] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
              }`}>
                {VENDOR_LABELS[toolId] ?? toolId}
              </span>
              <span className="text-[10px] text-zinc-500">
                {vendorProducts.length} product{vendorProducts.length !== 1 ? "s" : ""}
              </span>
              {unmappedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ml-auto">
                  <AlertTriangle className="h-3 w-3" />
                  {unmappedCount} unmapped
                </span>
              )}
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-b border-zinc-800/30">
                <div className="grid grid-cols-[1fr_60px_60px_200px_36px] px-3 py-1.5 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-zinc-900/20">
                  <div>Product</div>
                  <div className="text-right">Qty</div>
                  <div className="text-center">Unit</div>
                  <div>CW Mapping</div>
                  <div></div>
                </div>

                {vendorProducts.map((p) => (
                  <div
                    key={`${p.toolId}:${p.productKey}`}
                    className={`grid grid-cols-[1fr_60px_60px_200px_36px] px-3 py-2 border-b border-zinc-800/50 items-center hover:bg-zinc-900/30 transition-colors text-sm ${
                      p.isIgnored ? "opacity-50" : ""
                    }`}
                  >
                    <span className="text-zinc-200 truncate">
                      {p.productName}
                      {p.isIgnored && (
                        <span className="ml-2 text-[10px] text-zinc-500 italic">ignored</span>
                      )}
                    </span>
                    <div className="text-right font-mono text-zinc-300">{p.quantity}</div>
                    <div className="text-center text-zinc-500 text-xs">{p.unit}</div>
                    <div className="relative">
                      {p.isMapped ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Link2 className="h-3 w-3 text-green-400 shrink-0" />
                          <span className="text-green-400 truncate">{p.cwProductName}</span>
                        </div>
                      ) : p.isIgnored ? (
                        <span className="text-[10px] text-zinc-500 italic">—</span>
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
                    {/* Ignore / Unignore button */}
                    <div className="flex justify-center">
                      {!p.isMapped && (
                        p.isIgnored ? (
                          <button
                            onClick={() => unignoreMutation.mutate({
                              companyId,
                              vendorToolId: p.toolId,
                              productKey: p.productKey,
                            })}
                            title="Stop ignoring"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => ignoreMutation.mutate({
                              companyId,
                              vendorToolId: p.toolId,
                              productKey: p.productKey,
                            })}
                            title="Ignore this product"
                            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
