"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Wifi,
  Shield,
  Search,
  Loader2,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NetworkSummaryCards } from "./_components/network-summary-cards";
import { SiteTable } from "./_components/site-table";

/* ─── Types ──────────────────────────────────────────────── */

type ProviderTab = "unifi" | "watchguard";
type StatusFilter = "all" | "online" | "offline" | "updates";

/* ─── Page ───────────────────────────────────────────────── */

export default function NetworkPage() {
  const [provider, setProvider] = useState<ProviderTab>("unifi");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [hostFilter, setHostFilter] = useState<string>("all");

  /* ── Queries ──────────────────────────────────────────── */

  const summaryQuery = trpc.network.getSummary.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const hostsQuery = trpc.network.getHosts.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const sitesQuery = trpc.network.getSites.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const devicesQuery = trpc.network.getDevices.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });

  const isLoading =
    summaryQuery.isLoading ||
    hostsQuery.isLoading ||
    sitesQuery.isLoading ||
    devicesQuery.isLoading;

  const isError =
    summaryQuery.isError &&
    hostsQuery.isError &&
    sitesQuery.isError;

  /* ── Derived: unique host types for filter dropdown ──── */

  const hostTypes = useMemo(() => {
    if (!hostsQuery.data) return [];
    const types = new Set<string>();
    for (const h of hostsQuery.data) {
      if (h.type) types.add(h.type);
    }
    return Array.from(types).sort();
  }, [hostsQuery.data]);

  /* ── Filter state active? ────────────────────────────── */

  const hasFilters = search || statusFilter !== "all" || hostFilter !== "all";

  /* ── Tab buttons ──────────────────────────────────────── */

  const providerTabs: { id: ProviderTab; label: string; icon: React.ElementType }[] = [
    { id: "unifi", label: "UniFi", icon: Wifi },
    { id: "watchguard", label: "WatchGuard", icon: Shield },
  ];

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Network</h1>
          <p className="text-sm text-muted-foreground">
            Monitor network infrastructure across all sites
          </p>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 rounded-lg bg-accent p-1">
          {providerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProvider(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                provider === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* UniFi tab content */}
      {provider === "unifi" && (
        <>
          {/* Error state — not configured */}
          {isError && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
              <Wifi className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-foreground mb-1">
                UniFi not configured
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your UniFi API key in Settings to get started.
              </p>
              <a
                href="/settings/integrations"
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Configure Integration
              </a>
            </div>
          )}

          {/* Summary cards */}
          {!isError && (
            <NetworkSummaryCards
              summary={summaryQuery.data}
              isLoading={summaryQuery.isLoading}
            />
          )}

          {/* Filters */}
          {!isError && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-accent flex-1 min-w-[200px] max-w-[320px]">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sites..."
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>

              {/* Host type filter */}
              {hostTypes.length > 1 && (
                <select
                  value={hostFilter}
                  onChange={(e) => setHostFilter(e.target.value)}
                  className="h-9 rounded-lg bg-accent px-3 text-sm text-foreground border-none outline-none cursor-pointer"
                >
                  <option value="all">All Controllers</option>
                  {hostTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}

              {/* Status filter */}
              <div className="flex gap-1 rounded-lg bg-accent p-0.5">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "online", label: "Online" },
                    { id: "offline", label: "Offline" },
                    { id: "updates", label: "Updates" },
                  ] as { id: StatusFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      statusFilter === f.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setHostFilter("all");
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}

              {/* Loading indicator */}
              {(summaryQuery.isFetching || devicesQuery.isFetching) &&
                !isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
                )}
            </div>
          )}

          {/* Site table */}
          {!isError && (
            <SiteTable
              sites={sitesQuery.data ?? []}
              hosts={hostsQuery.data ?? []}
              devices={devicesQuery.data ?? []}
              isLoading={isLoading}
              search={search}
              statusFilter={statusFilter}
              hostFilter={hostFilter}
            />
          )}
        </>
      )}

      {/* WatchGuard tab — Coming Soon */}
      {provider === "watchguard" && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-foreground mb-1">
            WatchGuard Coming Soon
          </p>
          <p className="text-sm text-muted-foreground">
            Firewall monitoring and management will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
}
