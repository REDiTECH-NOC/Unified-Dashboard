"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SearchBar } from "./_components/search-bar";
import { SearchResultsTable } from "./_components/search-results-table";
import { PermissionDebugPanel } from "./_components/permission-debug-panel";
import { SyncStatus } from "./_components/sync-status";
import { usePermissions } from "@/hooks/use-permissions";

export default function DocumentationSearchPage() {
  const { has } = usePermissions();
  const isAdmin = has("users.manage");

  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string | undefined>();
  const [sectionFilter, setSectionFilter] = useState<string | undefined>();
  const [assetTypeFilter, setAssetTypeFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const searchResults = trpc.documentation.search.useQuery(
    {
      query,
      orgId: orgFilter,
      section: sectionFilter as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents" | undefined,
      assetTypeId: assetTypeFilter,
      page,
      pageSize: 25,
    },
    {
      enabled: query.length > 0,
      staleTime: 30_000,
    }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">IT Glue Search</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Search across all cached IT Glue data, filtered by your permissions.
          </p>
        </div>
        {isAdmin && <SyncStatus />}
      </div>

      <SearchBar
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          setPage(1);
        }}
        orgFilter={orgFilter}
        onOrgFilterChange={(v) => {
          setOrgFilter(v);
          setPage(1);
        }}
        sectionFilter={sectionFilter}
        onSectionFilterChange={(v) => {
          setSectionFilter(v);
          setPage(1);
        }}
        assetTypeFilter={assetTypeFilter}
        onAssetTypeFilterChange={(v) => {
          setAssetTypeFilter(v);
          setPage(1);
        }}
      />

      <SearchResultsTable
        data={searchResults.data?.data ?? []}
        total={searchResults.data?.total ?? 0}
        totalBeforeFilter={searchResults.data?.totalBeforeFilter ?? 0}
        hasMore={searchResults.data?.hasMore ?? false}
        isLoading={searchResults.isLoading && query.length > 0}
        page={page}
        onPageChange={setPage}
        query={query}
      />

      {isAdmin && <PermissionDebugPanel />}
    </div>
  );
}
