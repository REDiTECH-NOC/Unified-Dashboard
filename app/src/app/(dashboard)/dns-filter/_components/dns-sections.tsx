"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Globe,
  ShieldAlert,
  Ban,
  Activity,
  Search,
  Loader2,
  Monitor,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ─── SHARED PROPS ────────────────────────────────────────── */

interface OrgFilterProps {
  organizationIds?: string[];
}

/* ─── CUSTOM TOOLTIP ────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── STAT MINI CARD ────────────────────────────────────── */

export function StatMini({
  label,
  value,
  loading,
  icon: Icon,
  iconColor,
  subtitle,
}: {
  label: string;
  value?: number | string;
  loading?: boolean;
  icon: React.ElementType;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl p-3 bg-card border border-border">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
      ) : (
        <p className="text-xl font-bold text-foreground mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value ?? "—"}
        </p>
      )}
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/* ─── OVERVIEW SECTION ──────────────────────────────────── */

export function OverviewSection({ from, organizationIds }: { from: Date } & OrgFilterProps) {
  const trafficSummary = trpc.dnsFilter.getTrafficSummary.useQuery(
    { from, organizationIds },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const topDomains = trpc.dnsFilter.getTopDomains.useQuery(
    { from, type: "blocked", pageSize: 15, organizationIds },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const topCategories = trpc.dnsFilter.getTopCategories.useQuery(
    { from, pageSize: 15, organizationIds },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(
    organizationIds ? { organizationIds } : undefined,
    { retry: false, staleTime: 5 * 60_000 }
  );

  const chartData = useMemo(() => {
    if (!trafficSummary.data?.timeSeries) return [];
    return trafficSummary.data.timeSeries.map((d) => ({
      date: new Date(d.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Allowed: d.allowed,
      Blocked: d.blocked,
      Threats: d.threats,
    }));
  }, [trafficSummary.data]);

  const categoryChartData = useMemo(() => {
    if (!topCategories.data) return [];
    return topCategories.data.slice(0, 10).map((c) => ({
      name: c.categoryName.length > 20 ? c.categoryName.substring(0, 20) + "..." : c.categoryName,
      requests: c.total,
      isSecurity: c.isSecurity,
    }));
  }, [topCategories.data]);

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatMini label="Total Queries" value={trafficSummary.data?.totalRequests} loading={trafficSummary.isLoading} icon={Activity} iconColor="text-blue-500" />
        <StatMini label="Allowed" value={trafficSummary.data?.allowedRequests} loading={trafficSummary.isLoading} icon={Globe} iconColor="text-green-500" />
        <StatMini label="Blocked" value={trafficSummary.data?.blockedRequests} loading={trafficSummary.isLoading} icon={Ban} iconColor="text-red-500" />
        <StatMini label="Threats" value={trafficSummary.data?.threatRequests} loading={trafficSummary.isLoading} icon={ShieldAlert} iconColor="text-orange-500" />
        <StatMini
          label="Roaming Clients"
          value={agentCounts.data ? `${agentCounts.data.protected} / ${agentCounts.data.all}` : undefined}
          loading={agentCounts.isLoading}
          icon={Monitor}
          iconColor="text-violet-500"
          subtitle="protected / total"
        />
      </div>

      {/* Traffic Chart */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-4">Traffic Overview</h3>
        {trafficSummary.isLoading ? (
          <div className="flex items-center justify-center h-[280px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Allowed" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
              <Area type="monotone" dataKey="Blocked" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              <Area type="monotone" dataKey="Threats" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
            No traffic data available
          </div>
        )}
      </div>

      {/* Two columns: Top Blocked Domains + Top Categories */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Blocked Domains */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Top Blocked Domains</h3>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {topDomains.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (topDomains.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No blocked domains</div>
            ) : (
              (topDomains.data ?? []).map((d, i) => (
                <div key={d.domain} className="px-4 py-2 flex items-center gap-3 hover:bg-accent/50 transition-colors">
                  <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                  <Globe className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{d.domain}</p>
                    {d.category && <p className="text-[10px] text-muted-foreground">{d.category}</p>}
                  </div>
                  <span className="text-xs font-medium text-red-400">{d.total.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Categories Chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-4">Top Categories</h3>
          {topCategories.isLoading ? (
            <div className="flex items-center justify-center h-[360px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : categoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="requests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[360px] text-sm text-muted-foreground">
              No category data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── QUERY LOGS SECTION ────────────────────────────────── */

export function QueryLogsSection({ from, organizationIds }: { from: Date } & OrgFilterProps) {
  const { dateTime } = useTimezone();
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "allowed" | "blocked">("all");
  const [securityOnly, setSecurityOnly] = useState(false);

  const logs = trpc.dnsFilter.getQueryLogs.useQuery(
    {
      from,
      organizationIds,
      type: filterType === "all" ? undefined : filterType,
      securityReport: securityOnly || undefined,
      page,
      pageSize: 50,
    },
    { retry: false, staleTime: 60_000 }
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-accent p-0.5">
          {(["all", "allowed", "blocked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilterType(f); setPage(1); }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize",
                filterType === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={securityOnly}
            onChange={(e) => { setSecurityOnly(e.target.checked); setPage(1); }}
            className="rounded border-border"
          />
          Threats only
        </label>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Domain</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Result</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Source</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : (logs.data?.data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">No query logs found</td></tr>
              ) : (
                (logs.data?.data ?? []).map((entry, i) => (
                  <tr key={i} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2">
                      <p className="text-foreground truncate max-w-[300px]">{entry.domain}</p>
                      {entry.fqdn && entry.fqdn !== entry.domain && (
                        <p className="text-[10px] text-muted-foreground truncate">{entry.fqdn}</p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn("text-xs", entry.isThreat ? "text-red-400" : "text-muted-foreground")}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border",
                        entry.result === "blocked"
                          ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : "text-green-400 bg-green-500/10 border-green-500/20"
                      )}>
                        {entry.result}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground capitalize">
                      {entry.source}
                      {entry.networkName && <span className="ml-1">({entry.networkName})</span>}
                    </td>
                    <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {dateTime(entry.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(logs.data?.hasMore || page > 1) && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!logs.data?.hasMore}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DOMAIN LOOKUP SECTION ─────────────────────────────── */

export function DomainLookupSection() {
  const [query, setQuery] = useState("");
  const [searchFqdn, setSearchFqdn] = useState("");

  const lookup = trpc.dnsFilter.lookupDomain.useQuery(
    { fqdn: searchFqdn },
    { enabled: !!searchFqdn, retry: false }
  );

  function handleSearch() {
    if (query.trim()) {
      setSearchFqdn(query.trim());
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-accent flex-1 max-w-[500px]">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Enter domain to lookup (e.g., example.com)"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="h-10 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Lookup
        </button>
      </div>

      {/* Results */}
      {lookup.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {lookup.isError && (
        <div className="rounded-xl border border-red-500/20 bg-card p-6 text-center">
          <p className="text-sm text-red-400">Domain lookup failed. The domain may not be in the DNSFilter database.</p>
        </div>
      )}

      {lookup.data && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-6 w-6 text-violet-500" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">{lookup.data.domain || searchFqdn}</h3>
              {lookup.data.host && <p className="text-xs text-muted-foreground">{lookup.data.host}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Categories</h4>
              <div className="flex flex-wrap gap-1.5">
                {lookup.data.categories.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Uncategorized</span>
                ) : (
                  lookup.data.categories.map((c) => (
                    <span key={c.id} className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {c.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {lookup.data.application && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Application</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{lookup.data.application.name}</span>
                  {lookup.data.application.category && (
                    <span className="text-[10px] text-muted-foreground">({lookup.data.application.category})</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!searchFqdn && (
        <div className="text-center py-12 text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Enter a domain name to check its DNSFilter categorization.</p>
        </div>
      )}
    </div>
  );
}
