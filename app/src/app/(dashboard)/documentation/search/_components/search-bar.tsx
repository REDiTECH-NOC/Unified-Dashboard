"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  orgFilter?: string;
  onOrgFilterChange: (orgId: string | undefined) => void;
  sectionFilter?: string;
  onSectionFilterChange: (section: string | undefined) => void;
  assetTypeFilter?: string;
  onAssetTypeFilterChange: (typeId: string | undefined) => void;
}

const SECTIONS = [
  { value: "passwords", label: "Passwords" },
  { value: "flexible_assets", label: "Flexible Assets" },
  { value: "configurations", label: "Configurations" },
  { value: "contacts", label: "Contacts" },
  { value: "documents", label: "Documents" },
];

export function SearchBar({
  query,
  onQueryChange,
  orgFilter,
  onOrgFilterChange,
  sectionFilter,
  onSectionFilterChange,
  assetTypeFilter,
  onAssetTypeFilterChange,
}: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onQueryChange(localQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, onQueryChange]);

  // Load cached orgs for filter dropdown
  const cachedOrgs = trpc.itGluePerm.getCachedOrgs.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // Load asset types and password categories for filter
  const assetTypes = trpc.itGluePerm.getCachedAssetTypes.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const passwordCategories = trpc.itGluePerm.getCachedPasswordCategories.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // Show asset types or password categories based on section filter
  const categoryOptions =
    sectionFilter === "passwords"
      ? (passwordCategories.data ?? []).map((c: { itGlueId: string; name: string }) => ({ value: c.itGlueId, label: c.name }))
      : sectionFilter === "flexible_assets"
        ? (assetTypes.data ?? []).map((t: { itGlueId: string; name: string }) => ({ value: t.itGlueId, label: t.name }))
        : [];

  const hasFilters = orgFilter || sectionFilter || assetTypeFilter;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Search IT Glue assets..."
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
        />
        {localQuery && (
          <button
            onClick={() => {
              setLocalQuery("");
              onQueryChange("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <Select
          value={orgFilter ?? "all"}
          onValueChange={(v) => onOrgFilterChange(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-white">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-white">All Organizations</SelectItem>
            {(cachedOrgs.data ?? []).map((org: { itGlueId: string; name: string }) => (
              <SelectItem key={org.itGlueId} value={org.itGlueId} className="text-white">
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sectionFilter ?? "all"}
          onValueChange={(v) => {
            onSectionFilterChange(v === "all" ? undefined : v);
            onAssetTypeFilterChange(undefined); // Reset type filter when section changes
          }}
        >
          <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-700 text-white">
            <SelectValue placeholder="All Sections" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-white">All Sections</SelectItem>
            {SECTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-white">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {categoryOptions.length > 0 && (
          <Select
            value={assetTypeFilter ?? "all"}
            onValueChange={(v) => onAssetTypeFilterChange(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-white">All Types</SelectItem>
              {categoryOptions.map((c: { value: string; label: string }) => (
                <SelectItem key={c.value} value={c.value} className="text-white">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onOrgFilterChange(undefined);
              onSectionFilterChange(undefined);
              onAssetTypeFilterChange(undefined);
            }}
            className="text-zinc-400 hover:text-white"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
