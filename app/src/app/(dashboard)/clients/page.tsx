"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Building2,
  Search,
  Loader2,
  RefreshCw,
  ChevronRight,
  Phone,
  Unplug,
  Settings,
} from "lucide-react";
import Link from "next/link";

// ── Types ──
type CompanyRow = {
  id: string;
  name: string;
  psaSourceId: string;
  identifier: string | null;
  status: string;
  type: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lastSyncedAt: string | Date | null;
  syncEnabled: boolean;
  syncSource: string;
  integrationMappings: Array<{
    id: string;
    toolId: string;
    externalId: string;
    externalName: string | null;
  }>;
  _count: {
    threecxInstances: number;
    contacts: number;
    sites: number;
  };
};

// ── Status colors ──
const STATUS_COLORS: Record<string, string> = {
  Active: "text-green-400 border-green-500/30 bg-green-500/10",
  Inactive: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10",
  "Not Approved": "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "text-zinc-400 border-zinc-500/30 bg-zinc-500/10";
}

export default function ClientsPage() {
  const utils = trpc.useUtils();
  const router = useRouter();
  const { relative } = useTimezone();

  // ── Filter state ──
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // ── Data ──
  const companies = trpc.company.list.useQuery(
    {
      searchTerm: searchTerm || undefined,
      status: statusFilter || undefined,
      page,
      pageSize,
    },
    { staleTime: 30_000, refetchInterval: 120_000 }
  );

  const data = (companies.data?.data ?? []) as CompanyRow[];
  const totalCount = companies.data?.totalCount ?? 0;
  const totalPages = companies.data?.totalPages ?? 1;

  // ── Stats ──
  const stats = useMemo(() => {
    return {
      total: totalCount,
      active: data.filter((c) => c.status === "Active").length,
      withPhone: data.filter((c) => c._count.threecxInstances > 0).length,
      withContacts: data.filter((c) => c._count.contacts > 0).length,
    };
  }, [data, totalCount]);

  // ── Filter reset ──
  const hasFilters = searchTerm || statusFilter;
  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("");
    setPage(1);
  }

  // ── Refresh ──
  function handleRefresh() {
    utils.company.list.invalidate();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Clients
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalCount} synced {totalCount === 1 ? "company" : "companies"} from ConnectWise
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleRefresh}
            disabled={companies.isFetching}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 mr-1.5",
                companies.isFetching && "animate-spin"
              )}
            />
            Refresh
          </Button>
          <Link href="/settings/integrations/connectwise">
            <Button variant="outline" size="sm" className="h-8">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              CW Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Search + Status Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="h-8 pl-8 text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {["", "Active", "Inactive", "Not Approved"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                statusFilter === s
                  ? s === ""
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : statusColor(s)
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Stats Row */}
      {!companies.isLoading && totalCount > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{stats.total}</span>{" "}
            total
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="font-medium text-green-400">{stats.active}</span>{" "}
            active on page
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="font-medium text-foreground">{stats.withContacts}</span>{" "}
            with contacts
          </span>
          <span className="text-border">|</span>
          <span>
            <span className="font-medium text-foreground">{stats.withPhone}</span>{" "}
            with 3CX
          </span>
        </div>
      )}

      {/* Table */}
      {companies.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : companies.error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Unplug className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{companies.error.message}</p>
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="mb-3 h-10 w-10 opacity-50" />
            {hasFilters ? (
              <>
                <p className="text-sm font-medium">No clients match your filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No clients synced yet</p>
                <p className="text-xs mt-1">
                  Sync companies from ConnectWise PSA in{" "}
                  <Link
                    href="/settings/integrations/connectwise"
                    className="text-primary hover:underline"
                  >
                    CW Settings
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_100px_100px_80px_60px_60px_100px] gap-2 px-4 py-2 border-b border-border/50 bg-muted/20">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Company
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-center">
              Contacts
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-center">
              Sites
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-center">
              3CX
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-right">
              Last Sync
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {data.map((company) => (
              <button
                key={company.id}
                onClick={() => router.push(`/clients/${company.id}`)}
                className="w-full grid grid-cols-[1fr_100px_100px_80px_60px_60px_100px] gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
              >
                {/* Company Name + Identifier */}
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {company.name}
                    </span>
                    {company.identifier && (
                      <span className="text-[10px] text-muted-foreground">
                        {company.identifier}
                      </span>
                    )}
                  </div>
                </div>

                {/* Type */}
                <div className="flex items-center">
                  <span className="text-xs text-muted-foreground truncate">
                    {company.type ?? "—"}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 text-[10px]",
                      statusColor(company.status)
                    )}
                  >
                    {company.status}
                  </Badge>
                </div>

                {/* Contacts */}
                <div className="flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    {company._count.contacts || "—"}
                  </span>
                </div>

                {/* Sites */}
                <div className="flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    {company._count.sites || "—"}
                  </span>
                </div>

                {/* 3CX */}
                <div className="flex items-center justify-center">
                  {company._count.threecxInstances > 0 ? (
                    <Phone className="h-3 w-3 text-green-400" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>

                {/* Last Sync */}
                <div className="flex items-center justify-end">
                  <span className="text-[10px] text-muted-foreground">
                    {company.lastSyncedAt
                      ? relative(company.lastSyncedAt)
                      : "—"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/10">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs px-2"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
