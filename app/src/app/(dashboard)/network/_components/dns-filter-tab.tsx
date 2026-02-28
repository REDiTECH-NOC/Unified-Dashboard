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
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Monitor,
  Calendar,
  Settings,
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

/* ─── TIME RANGE ────────────────────────────────────────── */

type TimeRange = "24h" | "7d" | "30d" | "90d";

const TIME_RANGE_OPTIONS: { id: TimeRange; label: string; shortLabel: string }[] = [
  { id: "24h", label: "Last 24 Hours", shortLabel: "24h" },
  { id: "7d", label: "Last 7 Days", shortLabel: "7d" },
  { id: "30d", label: "Last 30 Days", shortLabel: "30d" },
  { id: "90d", label: "Last 90 Days", shortLabel: "90d" },
];

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
}

/* ─── SUB TABS ──────────────────────────────────────────── */

type SubTab = "overview" | "query-logs" | "policies" | "agents" | "lookup";

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "query-logs", label: "Query Logs" },
  { id: "policies", label: "Policies" },
  { id: "agents", label: "Roaming Clients" },
  { id: "lookup", label: "Domain Lookup" },
];

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

/* ─── MAIN TAB COMPONENT ────────────────────────────────── */

export function DnsFilterTab() {
  const { dateTime } = useTimezone();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const from = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);

  // ─── Queries ────────────────────────────────────────────

  const trafficSummary = trpc.dnsFilter.getTrafficSummary.useQuery(
    { from },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const topDomains = trpc.dnsFilter.getTopDomains.useQuery(
    { from, type: "blocked", pageSize: 15 },
    { retry: false, staleTime: 5 * 60_000, enabled: subTab === "overview" }
  );

  const topCategories = trpc.dnsFilter.getTopCategories.useQuery(
    { from, pageSize: 15 },
    { retry: false, staleTime: 5 * 60_000, enabled: subTab === "overview" }
  );

  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
    enabled: subTab === "overview" || subTab === "agents",
  });

  const isNotConfigured =
    trafficSummary.isError &&
    (trafficSummary.error?.message?.includes("not configured") ||
      trafficSummary.error?.message?.includes("No active"));

  if (isNotConfigured) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
        <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium text-foreground mb-1">DNS Filter not configured</p>
        <p className="text-sm text-muted-foreground mb-4">
          Add your DNSFilter API key in Settings to get started.
        </p>
        <a
          href="/settings/integrations"
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Configure Integration
        </a>
      </div>
    );
  }

  // ─── Chart Data ─────────────────────────────────────────

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
      {/* Sub-tab navigation + Time Range */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-accent p-0.5">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                subTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-accent rounded-lg border border-border p-0.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-0.5" />
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeRange(opt.id)}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                timeRange === opt.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {subTab === "overview" && (
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
      )}

      {/* ═══ QUERY LOGS TAB ═══ */}
      {subTab === "query-logs" && <QueryLogsSection from={from} />}

      {/* ═══ POLICIES TAB ═══ */}
      {subTab === "policies" && <PoliciesSection />}

      {/* ═══ ROAMING CLIENTS TAB ═══ */}
      {subTab === "agents" && <AgentsSection />}

      {/* ═══ DOMAIN LOOKUP TAB ═══ */}
      {subTab === "lookup" && <DomainLookupSection />}
    </div>
  );
}

/* ─── STAT MINI CARD ────────────────────────────────────── */

function StatMini({
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

/* ─── QUERY LOGS SECTION ────────────────────────────────── */

function QueryLogsSection({ from }: { from: Date }) {
  const { dateTime } = useTimezone();
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<"all" | "allowed" | "blocked">("all");
  const [securityOnly, setSecurityOnly] = useState(false);

  const logs = trpc.dnsFilter.getQueryLogs.useQuery(
    {
      from,
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
                      <span className={cn(
                        "text-xs",
                        entry.isThreat ? "text-red-400" : "text-muted-foreground"
                      )}>
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
        {logs.data?.hasMore && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <button onClick={() => setPage((p) => p + 1)} className="text-xs text-muted-foreground hover:text-foreground">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── POLICIES SECTION ──────────────────────────────────── */

function PoliciesSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [addTarget, setAddTarget] = useState<{ policyId: string; type: "allow" | "block" } | null>(null);

  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  const utils = trpc.useUtils();
  const addAllow = trpc.dnsFilter.addAllowDomain.useMutation({
    onSuccess: () => { utils.dnsFilter.getPolicies.invalidate(); setNewDomain(""); setAddTarget(null); },
  });
  const addBlock = trpc.dnsFilter.addBlockDomain.useMutation({
    onSuccess: () => { utils.dnsFilter.getPolicies.invalidate(); setNewDomain(""); setAddTarget(null); },
  });
  const removeAllow = trpc.dnsFilter.removeAllowDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const removeBlock = trpc.dnsFilter.removeBlockDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  function handleAddDomain() {
    if (!addTarget || !newDomain.trim()) return;
    if (addTarget.type === "allow") {
      addAllow.mutate({ policyId: addTarget.policyId, domain: newDomain.trim() });
    } else {
      addBlock.mutate({ policyId: addTarget.policyId, domain: newDomain.trim() });
    }
  }

  if (policies.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(policies.data ?? []).map((policy) => {
        const isExpanded = expandedId === policy.id;
        return (
          <div key={policy.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : policy.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{policy.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-green-400">{policy.allowedDomains.length} allowed</span>
                  <span className="text-[10px] text-red-400">{policy.blockedDomains.length} blocked</span>
                  <span className="text-[10px] text-muted-foreground">{policy.blockedCategories.length} blocked categories</span>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 py-3 border-t border-border space-y-4">
                {/* Allowed Domains */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-green-400">Allowed Domains</h4>
                    <button
                      onClick={() => setAddTarget({ policyId: policy.id, type: "allow" })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {policy.allowedDomains.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground">None</span>
                    ) : (
                      policy.allowedDomains.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                          {d}
                          <button
                            onClick={() => removeAllow.mutate({ policyId: policy.id, domain: d })}
                            className="hover:text-red-400 transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Blocked Domains */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-red-400">Blocked Domains</h4>
                    <button
                      onClick={() => setAddTarget({ policyId: policy.id, type: "block" })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {policy.blockedDomains.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground">None</span>
                    ) : (
                      policy.blockedDomains.map((d) => (
                        <span key={d} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                          {d}
                          <button
                            onClick={() => removeBlock.mutate({ policyId: policy.id, domain: d })}
                            className="hover:text-green-400 transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Add Domain Input */}
                {addTarget?.policyId === policy.id && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                      placeholder="Enter domain (e.g., example.com)"
                      className="flex-1 h-8 px-3 rounded-md bg-accent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAddDomain}
                      disabled={!newDomain.trim() || addAllow.isPending || addBlock.isPending}
                      className={cn(
                        "h-8 px-3 rounded-md text-xs font-medium transition-colors",
                        addTarget.type === "allow"
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white",
                        (addAllow.isPending || addBlock.isPending) && "opacity-50"
                      )}
                    >
                      {addTarget.type === "allow" ? "Allow" : "Block"}
                    </button>
                    <button
                      onClick={() => { setAddTarget(null); setNewDomain(""); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(policies.data ?? []).length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No policies found</div>
      )}
    </div>
  );
}

/* ─── AGENTS SECTION ────────────────────────────────────── */

function AgentsSection() {
  const { dateTime } = useTimezone();
  const [page, setPage] = useState(1);

  const agents = trpc.dnsFilter.getRoamingClients.useQuery(
    { page, pageSize: 50 },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-4">
      {/* Agent Counts */}
      {agentCounts.data && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatMini label="Total Agents" value={agentCounts.data.all} icon={Monitor} iconColor="text-blue-500" />
          <StatMini label="Protected" value={agentCounts.data.protected} icon={ShieldAlert} iconColor="text-green-500" />
          <StatMini label="Unprotected" value={agentCounts.data.unprotected} icon={Ban} iconColor="text-red-500" />
          <StatMini label="Offline" value={agentCounts.data.offline} icon={Activity} iconColor="text-yellow-500" />
        </div>
      )}

      {/* Agent Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Hostname</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Version</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">State</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Last Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : (agents.data?.data ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No roaming clients found</td></tr>
              ) : (
                (agents.data?.data ?? []).map((agent) => (
                  <tr key={agent.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2">
                      <p className="text-foreground">{agent.hostname}</p>
                      {agent.friendlyName && agent.friendlyName !== agent.hostname && (
                        <p className="text-[10px] text-muted-foreground">{agent.friendlyName}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground capitalize">{agent.agentType}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{agent.agentVersion ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border capitalize",
                        agent.status === "active"
                          ? "text-green-400 bg-green-500/10 border-green-500/20"
                          : agent.status === "disabled"
                          ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                      )}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border capitalize",
                        agent.agentState === "protected"
                          ? "text-green-400 bg-green-500/10 border-green-500/20"
                          : agent.agentState === "unprotected"
                          ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                      )}>
                        {agent.agentState}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                      {agent.lastSync ? dateTime(agent.lastSync) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── DOMAIN LOOKUP SECTION ─────────────────────────────── */

function DomainLookupSection() {
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
            {/* Categories */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Categories</h4>
              <div className="flex flex-wrap gap-1.5">
                {lookup.data.categories.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Uncategorized</span>
                ) : (
                  lookup.data.categories.map((c) => (
                    <span
                      key={c.id}
                      className="text-xs px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20"
                    >
                      {c.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Application */}
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
