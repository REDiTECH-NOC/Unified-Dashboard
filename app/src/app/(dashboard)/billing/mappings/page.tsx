"use client";

import { useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  Loader2,
  Info,
  Search,
  Link2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const VENDOR_TABS = [
  { id: "ninjaone", label: "NinjaOne", color: "text-blue-400 border-blue-500/30" },
  { id: "sentinelone", label: "SentinelOne", color: "text-purple-400 border-purple-500/30" },
  { id: "cove", label: "Cove Backup", color: "text-teal-400 border-teal-500/30" },
  { id: "pax8", label: "Pax8", color: "text-orange-400 border-orange-500/30" },
];

export default function MappingsPage() {
  const [activeTab, setActiveTab] = useState("ninjaone");
  const [showCreateProductDialog, setShowCreateProductDialog] = useState(false);
  const [createProductForm, setCreateProductForm] = useState({
    productKey: "",
    productName: "",
    unit: "devices",
  });
  const [productSearch, setProductSearch] = useState("");
  const [mappingTarget, setMappingTarget] = useState<string | null>(null);
  const [cwSearch, setCwSearch] = useState("");
  const [showCwDropdown, setShowCwDropdown] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const cwInputRef = useRef<HTMLInputElement>(null);

  const vendorProductsQuery = trpc.billing.getVendorProducts.useQuery(
    { toolId: activeTab },
    { staleTime: 60_000 }
  );

  const mappingsQuery = trpc.billing.getProductMappings.useQuery(
    { vendorToolId: activeTab },
    { staleTime: 60_000 }
  );

  const cwProductsQuery = trpc.billing.getCwProducts.useQuery(
    { searchTerm: cwSearch || undefined },
    { enabled: !!mappingTarget && cwSearch.length > 0 }
  );

  const quickMapMutation = trpc.billing.quickMapVendorProduct.useMutation({
    onSuccess: () => {
      mappingsQuery.refetch();
      vendorProductsQuery.refetch();
      setMappingTarget(null);
      setCwSearch("");
      setShowCwDropdown(false);
    },
  });

  const deleteMappingMutation = trpc.billing.deleteProductMapping.useMutation({
    onSuccess: () => {
      mappingsQuery.refetch();
      vendorProductsQuery.refetch();
    },
  });

  const createProductMutation = trpc.billing.createVendorProduct.useMutation({
    onSuccess: () => {
      vendorProductsQuery.refetch();
      setShowCreateProductDialog(false);
      setCreateProductForm({ productKey: "", productName: "", unit: "devices" });
    },
  });

  const deleteProductMutation = trpc.billing.deleteVendorProduct.useMutation({
    onSuccess: () => vendorProductsQuery.refetch(),
  });

  const syncMutation = trpc.billing.syncVendorProducts.useMutation({
    onSuccess: () => vendorProductsQuery.refetch(),
  });

  // Build mapping lookup: vendorProductKey → mapping
  const mappingByKey = useMemo(() => {
    const map = new Map<string, { id: string; psaProductName: string | null }>();
    if (mappingsQuery.data) {
      for (const m of mappingsQuery.data as any[]) {
        map.set(m.vendorProductKey, {
          id: m.id,
          psaProductName: m.psaProductName,
        });
      }
    }
    return map;
  }, [mappingsQuery.data]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    const products = vendorProductsQuery.data ?? [];
    if (!productSearch) return products;
    const term = productSearch.toLowerCase();
    return products.filter(
      (p: any) =>
        p.name.toLowerCase().includes(term) ||
        p.key.toLowerCase().includes(term)
    );
  }, [vendorProductsQuery.data, productSearch]);

  const totalProducts = vendorProductsQuery.data?.length ?? 0;
  const mappedCount = vendorProductsQuery.data?.filter(
    (p: any) => mappingByKey.get(p.key)?.psaProductName
  ).length ?? 0;

  const handleCreateProduct = () => {
    if (!createProductForm.productKey || !createProductForm.productName) return;
    createProductMutation.mutate({
      vendorToolId: activeTab,
      ...createProductForm,
    });
  };

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700">
            <Settings className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Service Mappings</h1>
            <p className="text-sm text-zinc-500">
              Map vendor products to PSA billing items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Sync Products
          </button>
        </div>
      </div>

      {/* Vendor Tabs */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 w-fit">
        {VENDOR_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setProductSearch("");
              setMappingTarget(null);
            }}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vendor Products with Inline Mapping */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">
              Vendor Products
              <span className="ml-2 text-[10px] text-zinc-500 font-normal">
                {mappedCount}/{totalProducts} mapped
              </span>
              {activeTab === "pax8" && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-orange-400 font-normal">
                  <Info className="h-3 w-3" />
                  Auto-discovered from Pax8 subscriptions
                </span>
              )}
              {activeTab === "sentinelone" && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-blue-400 font-normal">
                  <Info className="h-3 w-3" />
                  Auto-discovered from SentinelOne sites
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={() => setShowCreateProductDialog(true)}
            className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Create Product
          </button>
        </div>

        {/* Search bar */}
        {totalProducts > 10 && (
          <div className="px-4 py-2 border-b border-zinc-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder={`Search ${totalProducts} products...`}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary text-zinc-300 placeholder:text-zinc-600"
              />
            </div>
          </div>
        )}

        {vendorProductsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-500">
            {productSearch
              ? "No products match your search."
              : "No products defined. Click \"Sync Products\" to auto-discover, or create manually."}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_250px_60px] px-4 py-1.5 border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <div>Product</div>
              <div>CW Mapping</div>
              <div className="text-center">Actions</div>
            </div>

            {/* Product rows */}
            <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-800/30">
              {filteredProducts.map((p: any) => {
                const mapping = mappingByKey.get(p.key);
                const isMapped = !!mapping?.psaProductName;
                const isMapping = mappingTarget === p.key;

                return (
                  <div
                    key={p.key}
                    className="grid grid-cols-[1fr_250px_60px] px-4 py-2.5 items-center hover:bg-zinc-900/30 transition-colors"
                  >
                    {/* Product info */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm text-zinc-200 truncate">{p.name}</span>
                      <span className="text-[10px] text-zinc-500 shrink-0">({p.unit})</span>
                      {p.isAutoDiscovered && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                          Auto
                        </span>
                      )}
                    </div>

                    {/* CW Mapping */}
                    <div className="relative">
                      {isMapped ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3 w-3 text-green-400 shrink-0" />
                          <span className="text-xs text-green-400 truncate">
                            {mapping!.psaProductName}
                          </span>
                          <button
                            onClick={() => {
                              if (mapping?.id) {
                                deleteMappingMutation.mutate({ id: mapping.id });
                              }
                            }}
                            className="ml-auto text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                            title="Remove mapping"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : isMapping ? (
                        <div className="relative">
                          <div className="flex items-center gap-1">
                            <Search className="h-3 w-3 text-zinc-500 shrink-0" />
                            <input
                              ref={cwInputRef}
                              type="text"
                              placeholder="Search CW products..."
                              value={cwSearch}
                              onChange={(e) => {
                                setCwSearch(e.target.value);
                                setShowCwDropdown(true);
                              }}
                              onFocus={() => setShowCwDropdown(true)}
                              autoFocus
                              className="w-full px-2 py-1 text-xs bg-zinc-900 border border-primary/50 rounded focus:outline-none focus:ring-1 focus:ring-primary text-zinc-300"
                            />
                            <button
                              onClick={() => {
                                setMappingTarget(null);
                                setCwSearch("");
                                setShowCwDropdown(false);
                              }}
                              className="text-zinc-500 hover:text-zinc-300 shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {showCwDropdown && typeof document !== "undefined" && (() => {
                            const rect = cwInputRef.current?.getBoundingClientRect();
                            if (!rect) return null;
                            return createPortal(
                              <div
                                className="fixed z-[100] max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg"
                                style={{
                                  bottom: `${window.innerHeight - rect.top + 4}px`,
                                  left: `${rect.left}px`,
                                  width: `${Math.max(rect.width, 300)}px`,
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
                                  cwProductsQuery.data.map((cw: any) => (
                                    <button
                                      key={cw.id}
                                      onClick={() => {
                                        quickMapMutation.mutate({
                                          vendorToolId: activeTab,
                                          vendorProductKey: p.key,
                                          vendorProductName: p.name,
                                          psaProductName: cw.description ?? cw.identifier,
                                        });
                                      }}
                                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors flex items-center gap-2"
                                    >
                                      <span className="truncate">{cw.description ?? cw.identifier}</span>
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
                            setMappingTarget(p.key);
                            setCwSearch("");
                          }}
                          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <Link2 className="h-3 w-3" />
                          Map to CW
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-center">
                      {!p.isAutoDiscovered && (
                        <button
                          onClick={() => deleteProductMutation.mutate({ id: p.id! })}
                          className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Existing Mappings (collapsible) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
        <button
          onClick={() => setShowMappings(!showMappings)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/30 transition-colors"
        >
          <h2 className="text-sm font-medium text-zinc-200">
            All Mappings ({mappingsQuery.data?.length ?? 0})
          </h2>
          {showMappings ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {showMappings && (
          <>
            <div className="grid grid-cols-[1fr_1fr_120px_100px_60px] px-4 py-2 border-t border-b border-zinc-800 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <div>Vendor Product</div>
              <div>PSA Product Match</div>
              <div>Count Method</div>
              <div>Unit</div>
              <div className="text-center">Delete</div>
            </div>

            {mappingsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : mappingsQuery.data?.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No mappings configured yet. Use the &quot;Map to CW&quot; buttons above.
              </div>
            ) : (
              (mappingsQuery.data as any[])?.map((mapping: any) => (
                <div
                  key={mapping.id}
                  className="grid grid-cols-[1fr_1fr_120px_100px_60px] px-4 py-3 border-b border-zinc-800/50 items-center hover:bg-zinc-900/30 transition-colors"
                >
                  <div>
                    <div className="text-sm text-zinc-200">{mapping.vendorProductName}</div>
                    <div className="text-xs text-zinc-500">{mapping.vendorProductKey}</div>
                  </div>
                  <div className="text-sm text-zinc-300">
                    {mapping.psaProductName || <span className="text-zinc-600 italic">Not mapped</span>}
                  </div>
                  <div className="text-sm text-zinc-400">{mapping.countMethod}</div>
                  <div className="text-sm text-zinc-400">{mapping.unitLabel}</div>
                  <div className="flex justify-center">
                    <button
                      onClick={() => deleteMappingMutation.mutate({ id: mapping.id })}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Create Product Dialog */}
      {showCreateProductDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateProductDialog(false)} />
          <div className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
              Create Manual Product ({VENDOR_TABS.find((t) => t.id === activeTab)?.label})
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Product Key</label>
                <input
                  type="text"
                  value={createProductForm.productKey}
                  onChange={(e) =>
                    setCreateProductForm({
                      ...createProductForm,
                      productKey: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                  placeholder="e.g., premium_support"
                  className="w-full h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Product Name</label>
                <input
                  type="text"
                  value={createProductForm.productName}
                  onChange={(e) =>
                    setCreateProductForm({ ...createProductForm, productName: e.target.value })
                  }
                  placeholder="e.g., Premium Support Package"
                  className="w-full h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Unit</label>
                <input
                  type="text"
                  value={createProductForm.unit}
                  onChange={(e) =>
                    setCreateProductForm({ ...createProductForm, unit: e.target.value })
                  }
                  className="w-full h-9 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateProductDialog(false)}
                className="h-9 px-4 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduct}
                disabled={!createProductForm.productKey || !createProductForm.productName || createProductMutation.isPending}
                className="h-9 px-4 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
