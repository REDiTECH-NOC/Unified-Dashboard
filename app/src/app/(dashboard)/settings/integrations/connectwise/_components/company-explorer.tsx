"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  X,
  Filter,
} from "lucide-react";

interface CompanyExplorerProps {
  syncMode: "auto" | "manual";
}

export function CompanyExplorer({ syncMode }: CompanyExplorerProps) {
  // ── Search & Pagination ──
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Load saved config to pre-populate explorer filters ──
  const { data: savedConfig } = trpc.integration.getSyncConfig.useQuery({ toolId: "connectwise" });

  // ── Independent explorer filters ──
  const [explorerStatuses, setExplorerStatuses] = useState<string[]>([]);
  const [explorerTypes, setExplorerTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const lastAppliedConfig = useRef<string>("");

  // ── Manual mode selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Sync explorer filters with saved config (applies on load + when config changes) ──
  useEffect(() => {
    if (!savedConfig) return;
    const configKey = JSON.stringify([savedConfig.syncStatuses, savedConfig.syncTypes]);
    if (configKey === lastAppliedConfig.current) return;
    lastAppliedConfig.current = configKey;
    setExplorerStatuses(savedConfig.syncStatuses ?? []);
    setExplorerTypes(savedConfig.syncTypes ?? []);
  }, [savedConfig]);

  // ── Debounce search ──
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [explorerStatuses, explorerTypes]);

  // Clear selections when switching modes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [syncMode]);

  // ── Queries ──
  const { data: cwStatuses } = trpc.psa.getCompanyStatuses.useQuery();
  const { data: cwTypes } = trpc.psa.getCompanyTypes.useQuery();

  const { data, isLoading, isFetching } = trpc.psa.getCompanies.useQuery({
    searchTerm: debouncedSearch || undefined,
    statuses: explorerStatuses.length > 0 ? explorerStatuses : undefined,
    types: explorerTypes.length > 0 ? explorerTypes : undefined,
    page,
    pageSize,
  });

  const { data: syncedMap } = trpc.company.getSyncedSourceIds.useQuery();

  const utils = trpc.useUtils();

  // ── Mutations ──
  const syncSelectedMutation = trpc.company.syncSelected.useMutation({
    onSuccess: () => {
      setSelectedIds(new Set());
      utils.company.getSyncedSourceIds.invalidate();
    },
  });

  const importSingle = trpc.company.importSingle.useMutation({
    onSuccess: () => {
      utils.company.getSyncedSourceIds.invalidate();
    },
  });

  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  function handleImportOne(sourceId: string) {
    importSingle.mutate(
      { psaCompanyId: sourceId },
      {
        onSuccess: () => {
          setImportedIds((prev) => new Set(prev).add(sourceId));
        },
      }
    );
  }

  function handleSyncSelected() {
    syncSelectedMutation.mutate({
      psaCompanyIds: Array.from(selectedIds),
    });
  }

  function toggleSelect(sourceId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!companies.length) return;
    if (selectedIds.size === companies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map((c) => c.sourceId)));
    }
  }

  function toggleExplorerStatus(name: string) {
    setExplorerStatuses((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }

  function toggleExplorerType(name: string) {
    setExplorerTypes((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  const companies = data?.data ?? [];
  const hasMore = data?.hasMore ?? false;
  const isManual = syncMode === "manual";
  const activeFilterCount = explorerStatuses.length + explorerTypes.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Company Explorer</CardTitle>
            {isFetching && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isManual
            ? "Select companies to sync into your local database"
            : "Browse ConnectWise companies — auto-synced companies are managed by your saved filters"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-sm h-9"
          />
        </div>

        {/* Filter controls */}
        {showFilters && (
          <div className="space-y-2 rounded-md border border-border/50 bg-muted/5 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-12">
                Status:
              </span>
              <div className="flex flex-wrap gap-1">
                {cwStatuses?.map((s) => (
                  <Button
                    key={s.id}
                    variant={
                      explorerStatuses.includes(s.name) ? "default" : "outline"
                    }
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => toggleExplorerStatus(s.name)}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-12">
                Type:
              </span>
              <div className="flex flex-wrap gap-1">
                {cwTypes?.map((t) => (
                  <Button
                    key={t.id}
                    variant={
                      explorerTypes.includes(t.name) ? "default" : "outline"
                    }
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => toggleExplorerType(t.name)}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-muted-foreground"
                onClick={() => {
                  setExplorerStatuses([]);
                  setExplorerTypes([]);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Active filter badges (collapsed view) */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {explorerStatuses.map((s) => (
              <Badge key={`s-${s}`} variant="secondary" className="text-[10px]">
                Status: {s}
              </Badge>
            ))}
            {explorerTypes.map((t) => (
              <Badge key={`t-${t}`} variant="outline" className="text-[10px]">
                Type: {t}
              </Badge>
            ))}
          </div>
        )}

        {/* Manual mode: selection bar */}
        {isManual && selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-2">
            <span className="text-xs text-primary">
              {selectedIds.size} company
              {selectedIds.size !== 1 ? "ies" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSyncSelected}
                disabled={syncSelectedMutation.isPending}
              >
                {syncSelectedMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                )}
                Sync Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Sync selected results */}
        {syncSelectedMutation.data && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2.5 text-xs text-green-400 flex items-center gap-2">
            <Check className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Synced {syncSelectedMutation.data.companies.created} new,{" "}
              {syncSelectedMutation.data.companies.synced} updated
              {syncSelectedMutation.data.companies.failed > 0 &&
                ` (${syncSelectedMutation.data.companies.failed} failed)`}
            </span>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No companies found matching your filters
          </div>
        ) : (
          <div className="rounded-md border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  {isManual && (
                    <th className="px-3 py-2 w-8">
                      <Checkbox
                        checked={
                          selectedIds.size > 0 &&
                          selectedIds.size === companies.length
                        }
                        indeterminate={
                          selectedIds.size > 0 &&
                          selectedIds.size < companies.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">
                    ID
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Type
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                    Phone
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground hidden xl:table-cell">
                    Location
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground w-24 text-center">
                    Sync
                  </th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const syncInfo = syncedMap?.[company.sourceId];
                  const isSynced = syncInfo?.syncEnabled === true;
                  const isSyncDisabled =
                    syncInfo && !syncInfo.syncEnabled;
                  const justImported = importedIds.has(company.sourceId);

                  return (
                    <tr
                      key={company.sourceId}
                      className="border-b border-border/30 hover:bg-muted/10 transition-colors"
                    >
                      {isManual && (
                        <td className="px-3 py-2">
                          {!isSynced && !justImported && (
                            <Checkbox
                              checked={selectedIds.has(company.sourceId)}
                              onCheckedChange={() =>
                                toggleSelect(company.sourceId)
                              }
                            />
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 font-medium truncate max-w-[200px]">
                        {company.name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {company.identifier ?? company.sourceId}
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        {company.status && (
                          <Badge
                            variant={
                              company.status === "Active"
                                ? "success"
                                : company.status === "Inactive"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-[10px]"
                          >
                            {company.status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden lg:table-cell">
                        {company.typeName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden lg:table-cell">
                        {company.phone ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs truncate max-w-[160px] hidden xl:table-cell">
                        {[company.address?.city, company.address?.state]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isSynced || justImported ? (
                          <Badge
                            variant="success"
                            className="text-[10px] gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                            Synced
                          </Badge>
                        ) : isSyncDisabled ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 inline-block" />
                            Disabled
                          </Badge>
                        ) : !isManual ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleImportOne(company.sourceId)}
                            disabled={importSingle.isPending}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {companies.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Page {page}
              {companies.length === pageSize && "+"}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="h-7 px-2"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
