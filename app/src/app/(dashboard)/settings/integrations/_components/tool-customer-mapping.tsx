"use client";

import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExternalOrg {
  id: string;
  name: string;
  deviceCount?: number;
  status?: string;
}

interface ToolCustomerMappingProps {
  toolId: string;
  displayName: string;
  /** Label for external entities (e.g. "Organizations", "Sites", "Customers") */
  entityLabel: string;
  /** The list of external orgs/sites from the tool */
  externalOrgs: ExternalOrg[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ToolCustomerMapping({
  toolId,
  displayName,
  entityLabel,
  externalOrgs,
  isLoading,
  isError,
}: ToolCustomerMappingProps) {
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing mappings for this tool
  const {
    data: mappings,
    refetch: refetchMappings,
  } = trpc.company.getMappingsByTool.useQuery({ toolId });

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

  // Build a lookup: externalId → mapping
  const mappingByExternalId = useMemo(() => {
    const map = new Map<string, NonNullable<typeof mappings>[number]>();
    if (mappings) {
      for (const m of mappings) {
        map.set(m.externalId, m);
      }
    }
    return map;
  }, [mappings]);

  // Filter external orgs by search
  const filtered = useMemo(() => {
    if (!externalOrgs) return [];
    if (!search) return externalOrgs;
    const term = search.toLowerCase();
    return externalOrgs.filter((o) => o.name.toLowerCase().includes(term));
  }, [externalOrgs, search]);

  // Stats
  const totalMapped = mappingByExternalId.size;
  const totalExternal = externalOrgs?.length ?? 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{entityLabel} Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading {entityLabel.toLowerCase()}...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{entityLabel} Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            {displayName} must be connected before mapping {entityLabel.toLowerCase()}
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
            <CardTitle className="text-base">{entityLabel} Mapping</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Link {displayName} {entityLabel.toLowerCase()} to your internal clients ({totalMapped} of {totalExternal} mapped)
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
            onClick={() => autoMatch.mutate({ toolId })}
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
            placeholder={`Search ${displayName} ${entityLabel.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className={cn(
            "grid gap-2 px-4 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground",
            "grid-cols-[1fr_200px]"
          )}>
            <span>{displayName} {entityLabel.slice(0, -1)}</span>
            <span>Linked Client</span>
          </div>

          {/* Rows */}
          <div className="max-h-[600px] overflow-y-auto divide-y divide-border/50">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No {entityLabel.toLowerCase()} found
              </div>
            ) : (
              filtered.map((org) => {
                const mapping = mappingByExternalId.get(org.id);
                const isLinking = linkingId === org.id;
                const isDropdownOpen = showDropdown === org.id;

                return (
                  <div
                    key={org.id}
                    className="grid grid-cols-[1fr_200px] gap-2 px-4 py-2.5 items-center hover:bg-muted/20 transition-colors"
                  >
                    {/* Org Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{org.name}</span>
                      {org.deviceCount !== undefined && (
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({org.deviceCount} devices)
                        </span>
                      )}
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
                            ref={activeInputRef}
                            type="text"
                            placeholder="Search clients..."
                            value={companySearch}
                            onChange={(e) => {
                              setCompanySearch(e.target.value);
                              setShowDropdown(org.id);
                            }}
                            onFocus={() => setShowDropdown(org.id)}
                            autoFocus
                            className="w-full px-2 py-1 text-sm bg-muted/50 border border-primary/50 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {isDropdownOpen && typeof document !== "undefined" && (() => {
                            const rect = activeInputRef.current?.getBoundingClientRect();
                            if (!rect) return null;
                            return createPortal(
                              <div
                                className="fixed z-[100] max-h-48 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg"
                                style={{
                                  bottom: `${window.innerHeight - rect.top + 4}px`,
                                  left: `${rect.left}px`,
                                  width: `${Math.max(rect.width, 250)}px`,
                                }}
                              >
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
                                          toolId,
                                          externalId: org.id,
                                          externalName: org.name,
                                        });
                                      }}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                                    >
                                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                      <span className="truncate">{company.name}</span>
                                      {company.integrationMappings?.some(
                                        (m: { toolId: string }) => m.toolId === toolId
                                      ) && (
                                        <Check className="h-3 w-3 text-green-400 ml-auto shrink-0" />
                                      )}
                                    </button>
                                  ))
                                )}
                              </div>,
                              document.body
                            );
                          })()}
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
                            setLinkingId(org.id);
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
