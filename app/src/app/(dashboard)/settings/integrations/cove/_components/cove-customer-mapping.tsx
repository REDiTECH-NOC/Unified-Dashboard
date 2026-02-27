"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Search,
  Link2,
  Unlink,
  Loader2,
  Check,
  AlertTriangle,
  Building2,
  HardDrive,
  ChevronDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CoveCustomer {
  sourceId: string;
  name: string;
  totalDevices: number;
  healthyDevices: number;
  warningDevices: number;
  failedDevices: number;
  overdueDevices: number;
  overallStatus: string;
  totalStorageBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function CoveCustomerMapping() {
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState<string | null>(null);

  // Fetch Cove customers from the backup connector
  const {
    data: coveCustomers,
    isLoading: customersLoading,
    isError: customersError,
  } = trpc.backup.getCustomers.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing mappings for "cove" tool
  const {
    data: mappings,
    refetch: refetchMappings,
  } = trpc.company.getMappingsByTool.useQuery({ toolId: "cove" });

  // Fetch internal companies for the linking dropdown
  const { data: companiesResult } = trpc.company.list.useQuery(
    { pageSize: 100, searchTerm: companySearch || undefined }
  );
  const companies = companiesResult?.data ?? [];

  // Mutations
  const setMapping = trpc.company.setMapping.useMutation({
    onSuccess: () => {
      refetchMappings();
      setLinkingId(null);
      setShowDropdown(null);
      setCompanySearch("");
    },
  });
  const removeMapping = trpc.company.removeMapping.useMutation({
    onSuccess: () => refetchMappings(),
  });

  const autoMatch = trpc.companyMatching.autoMatch.useMutation({
    onSuccess: (result) => {
      refetchMappings();
      setAutoMatchResult(result);
    },
  });
  const [autoMatchResult, setAutoMatchResult] = useState<{
    autoMatched: number;
    suggested: number;
    unmatched: number;
  } | null>(null);

  // Build a lookup: coveSourceId → mapping
  const mappingByExternalId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof mappings>[number]>();
    if (mappings) {
      for (const m of mappings) {
        map.set(m.externalId, m);
      }
    }
    return map;
  }, [mappings]);

  // Filter Cove customers by search
  const filtered = useMemo(() => {
    if (!coveCustomers) return [];
    const items = coveCustomers as CoveCustomer[];
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter((c) => c.name.toLowerCase().includes(term));
  }, [coveCustomers, search]);

  // Stats
  const totalMapped = mappingByExternalId.size;
  const totalCove = (coveCustomers as CoveCustomer[] | undefined)?.length ?? 0;

  if (customersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading Cove customers...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customersError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            Cove must be connected before mapping customers
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Customer Mapping</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Link Cove backup customers to your internal clients ({totalMapped} of {totalCove} mapped)
            </p>
            {autoMatchResult && (
              <p className="text-xs text-green-400 mt-1">
                Auto-matched {autoMatchResult.autoMatched}, {autoMatchResult.suggested} suggested, {autoMatchResult.unmatched} unmatched
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => autoMatch.mutate({ toolId: "cove" })}
            disabled={autoMatch.isPending}
            className="gap-1.5"
          >
            {autoMatch.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Auto-Match
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search Cove customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_100px_200px] gap-2 px-4 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
            <span>Cove Customer</span>
            <span className="text-center">Devices</span>
            <span className="text-center">Status</span>
            <span>Linked Client</span>
          </div>

          {/* Rows */}
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No customers found
              </div>
            ) : (
              filtered.map((customer) => {
                const mapping = mappingByExternalId.get(customer.sourceId);
                const isLinking = linkingId === customer.sourceId;
                const isDropdownOpen = showDropdown === customer.sourceId;

                return (
                  <div
                    key={customer.sourceId}
                    className="grid grid-cols-[1fr_100px_100px_200px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* Customer Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{customer.name}</span>
                    </div>

                    {/* Device Count */}
                    <div className="text-center text-sm text-muted-foreground">
                      {customer.totalDevices}
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <StatusBadge status={customer.overallStatus} failed={customer.failedDevices} overdue={customer.overdueDevices} />
                    </div>

                    {/* Linked Client */}
                    <div className="relative">
                      {mapping ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3 w-3 text-green-400 shrink-0" />
                          <span className="text-sm text-green-400 truncate">
                            {mapping.company.name}
                          </span>
                          <button
                            onClick={() => removeMapping.mutate({ mappingId: mapping.id })}
                            className="ml-auto text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                            title="Unlink"
                          >
                            <Unlink className="h-3 w-3" />
                          </button>
                        </div>
                      ) : isLinking ? (
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search clients..."
                            value={companySearch}
                            onChange={(e) => {
                              setCompanySearch(e.target.value);
                              setShowDropdown(customer.sourceId);
                            }}
                            onFocus={() => setShowDropdown(customer.sourceId)}
                            autoFocus
                            className="w-full px-2 py-1 text-sm bg-muted/50 border border-primary/50 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {isDropdownOpen && (
                            <div className="absolute z-50 bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg">
                              {companies.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  No clients found
                                </div>
                              ) : (
                                companies.map((company) => (
                                  <button
                                    key={company.id}
                                    onClick={() => {
                                      setMapping.mutate({
                                        companyId: company.id,
                                        toolId: "cove",
                                        externalId: customer.sourceId,
                                        externalName: customer.name,
                                      });
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                                  >
                                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span className="truncate">{company.name}</span>
                                    {company.integrationMappings?.some(
                                      (m: { toolId: string }) => m.toolId === "cove"
                                    ) && (
                                      <Check className="h-3 w-3 text-green-400 ml-auto shrink-0" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setLinkingId(null);
                              setShowDropdown(null);
                              setCompanySearch("");
                            }}
                            className="absolute -right-6 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setLinkingId(customer.sourceId);
                            setCompanySearch("");
                          }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Link2 className="h-3 w-3" />
                          Link to client
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  failed,
  overdue,
}: {
  status: string;
  failed: number;
  overdue: number;
}) {
  if (status === "healthy") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Healthy
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        {failed} failed
      </span>
    );
  }
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-orange-400">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
        {overdue} overdue
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      {status}
    </span>
  );
}
