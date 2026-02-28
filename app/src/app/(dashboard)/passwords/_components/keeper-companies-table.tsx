"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  Building2,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KeeperCompanyDetail } from "./keeper-company-detail";

interface KeeperCompany {
  sourceToolId: string;
  sourceId: string;
  name: string;
  status: string;
  plan: string;
  licensesUsed: number;
  licensesTotal: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  addOns: string[];
  expiresAt?: Date | string | null;
  totalUsers: number;
  activeUsers: number;
  totalRecords: number;
  totalSharedFolders: number;
  totalTeams: number;
  securityAuditScore?: number | null;
  breachWatchRecordsAtRisk?: number | null;
}

type SortKey = "name" | "status" | "users" | "records" | "licenses" | "security";
type SortDir = "asc" | "desc";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trial: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  expired: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  suspended: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  unknown: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-xs font-medium rounded-full border capitalize",
        STATUS_STYLES[status] ?? STATUS_STYLES.unknown
      )}
    >
      {status}
    </span>
  );
}

interface Props {
  companies: KeeperCompany[];
  isLoading: boolean;
}

export function KeeperCompaniesTable({ companies, isLoading }: Props) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = companies;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.plan.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "users":
          return (a.activeUsers - b.activeUsers) * dir;
        case "records":
          return (a.totalRecords - b.totalRecords) * dir;
        case "licenses":
          return (a.licensesUsed - b.licensesUsed) * dir;
        case "security":
          return ((a.securityAuditScore ?? 0) - (b.securityAuditScore ?? 0)) * dir;
        default:
          return 0;
      }
    });

    return result;
  }, [companies, search, statusFilter, sortKey, sortDir]);

  // Status counts for filter buttons
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    for (const c of companies) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  }, [companies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading managed companies...
      </div>
    );
  }

  const SortHeader = ({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => (
    <button
      onClick={() => toggleSort(sortKeyName)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors",
        className
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          sortKey === sortKeyName ? "text-zinc-200" : "text-zinc-600"
        )}
      />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "active", "trial", "expired"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize",
                statusFilter === status
                  ? "bg-zinc-700 border-zinc-600 text-zinc-100"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
              )}
            >
              {status} {statusCounts[status] != null ? `(${statusCounts[status]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_100px_100px_100px_100px_100px] gap-4 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
          <SortHeader label="Company" sortKeyName="name" />
          <SortHeader label="Status" sortKeyName="status" />
          <SortHeader label="Users" sortKeyName="users" />
          <SortHeader label="Records" sortKeyName="records" />
          <SortHeader label="Licenses" sortKeyName="licenses" />
          <SortHeader label="Storage" sortKeyName="name" />
          <SortHeader label="Security" sortKeyName="security" />
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <Building2 className="h-8 w-8 mb-2 text-zinc-600" />
            <p className="text-sm">No companies found</p>
          </div>
        ) : (
          filtered.map((company) => {
            const isExpanded = expandedId === company.sourceId;
            return (
              <div key={company.sourceId}>
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : company.sourceId)
                  }
                  className={cn(
                    "w-full grid grid-cols-[1fr_100px_100px_100px_100px_100px_100px] gap-4 px-4 py-3 text-left transition-colors",
                    isExpanded
                      ? "bg-zinc-900/50"
                      : "hover:bg-zinc-900/30"
                  )}
                >
                  {/* Company name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {company.name}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center">
                    <StatusBadge status={company.status} />
                  </div>

                  {/* Users */}
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-300">
                      {company.activeUsers}
                      <span className="text-zinc-500"> / {company.totalUsers}</span>
                    </span>
                  </div>

                  {/* Records */}
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-300">
                      {company.totalRecords.toLocaleString()}
                    </span>
                  </div>

                  {/* Licenses */}
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-300">
                      {company.licensesUsed}
                      <span className="text-zinc-500"> / {company.licensesTotal}</span>
                    </span>
                  </div>

                  {/* Storage */}
                  <div className="flex items-center">
                    <span className="text-sm text-zinc-300">
                      {formatBytes(company.storageUsedBytes)}
                    </span>
                  </div>

                  {/* Security Score */}
                  <div className="flex items-center">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        company.securityAuditScore != null && company.securityAuditScore >= 80
                          ? "text-emerald-400"
                          : company.securityAuditScore != null && company.securityAuditScore >= 50
                            ? "text-amber-400"
                            : company.securityAuditScore != null
                              ? "text-red-400"
                              : "text-zinc-500"
                      )}
                    >
                      {company.securityAuditScore != null
                        ? `${company.securityAuditScore}%`
                        : "—"}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && <KeeperCompanyDetail company={company} />}
              </div>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <p className="text-xs text-zinc-500">
        Showing {filtered.length} of {companies.length} managed companies
      </p>
    </div>
  );
}
