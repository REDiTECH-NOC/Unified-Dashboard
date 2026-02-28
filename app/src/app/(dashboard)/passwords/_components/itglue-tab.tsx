"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/use-permissions";
import { SearchBar } from "../../documentation/search/_components/search-bar";
import { SearchResultsTable } from "../../documentation/search/_components/search-results-table";
import { PermissionDebugPanel } from "../../documentation/search/_components/permission-debug-panel";
import { SyncStatus } from "../../documentation/search/_components/sync-status";

export function ITGlueTab() {
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
      section: sectionFilter as
        | "passwords"
        | "flexible_assets"
        | "configurations"
        | "contacts"
        | "documents"
        | undefined,
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
      {/* Sync status for admins */}
      {isAdmin && (
        <div className="flex justify-end">
          <SyncStatus />
        </div>
      )}

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
