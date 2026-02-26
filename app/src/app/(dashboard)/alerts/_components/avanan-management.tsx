"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mail,
  Building2,
  Users,
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Package,
  AlertTriangle,
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── TAB TYPE ──────────────────────────────────────────── */

type AvananTab = "events" | "tenants" | "users";

/* ─── CONSTANTS ──────────────────────────────────────────── */

const TYPE_COLORS: Record<string, string> = {
  phishing: "#ef4444",
  spam: "#facc15",
  graymail: "#94a3b8",
  malware: "#a855f7",
  suspicious_malware: "#c084fc",
  suspicious_phishing: "#fb923c",
  dlp: "#14b8a6",
  anomaly: "#f97316",
  malicious_url_click: "#ec4899",
  shadow_it: "#6366f1",
  alert: "#f43f5e",
};

/** Column labels matching the Avanan portal */
const TYPE_LABELS: Record<string, string> = {
  phishing: "Phishing",
  malware: "Malware",
  suspicious_malware: "Suspicious Malware",
  suspicious_phishing: "Suspicious Phishing",
  dlp: "DLP",
  anomaly: "Anomaly Events",
  malicious_url_click: "Malicious URL Click",
  shadow_it: "Shadow IT",
  alert: "Alert",
  spam: "Spam",
  graymail: "Graymail",
};

/** Column order matching the Avanan portal layout */
const EVENT_TYPE_ORDER = [
  "phishing", "malware", "suspicious_malware", "dlp",
  "anomaly", "malicious_url_click", "shadow_it", "alert", "spam",
  "graymail", "suspicious_phishing",
];

const DEFAULT_COLOR = "#6b7280";

const DATE_RANGE_OPTIONS = [
  { label: "Last 24h", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const STATE_FILTER_OPTIONS: Array<{ label: string; states: string[] | undefined }> = [
  { label: "All Events", states: undefined },
  { label: "Pending Only", states: ["new", "detected", "pending", "in_progress"] },
  { label: "Remediated", states: ["remediated", "dismissed", "exception"] },
];

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function AvananManagementView() {
  const [activeTab, setActiveTab] = useState<AvananTab>("events");
  const [searchTerm, setSearchTerm] = useState("");
  const [eventDays, setEventDays] = useState(30);
  const [eventStates, setEventStates] = useState<string[] | undefined>(undefined);

  const utils = trpc.useUtils();

  // ─── Data Queries ─────────────────────────────────────

  const tenants = trpc.emailSecurity.listTenants.useQuery(undefined, {
    retry: false,
    refetchInterval: 300000,
  });

  const licenses = trpc.emailSecurity.listLicenses.useQuery(undefined, {
    retry: false,
  });

  const addOns = trpc.emailSecurity.listAddOns.useQuery(undefined, {
    retry: false,
  });

  const users = trpc.emailSecurity.listUsers.useQuery(undefined, {
    retry: false,
    enabled: activeTab === "users",
  });

  const eventStats = trpc.emailSecurity.getEventStats.useQuery(
    { days: eventDays, eventStates },
    {
      retry: false,
      refetchInterval: 300000,
      staleTime: 5 * 60_000, // Use cached data for 5 min (server also caches)
    }
  );

  function refreshAll() {
    utils.emailSecurity.listTenants.invalidate();
    utils.emailSecurity.listLicenses.invalidate();
    utils.emailSecurity.listAddOns.invalidate();
    utils.emailSecurity.listUsers.invalidate();
    utils.emailSecurity.getEventStats.invalidate();
  }

  // ─── Tenant Stats ──────────────────────────────────────

  const tenantStats = useMemo(() => {
    if (!tenants.data) return null;
    let active = 0, expired = 0, deleted = 0, totalUsers = 0;
    const packageCounts: Record<string, number> = {};
    for (const t of tenants.data) {
      if (t.isDeleted) { deleted++; continue; }
      const statusCode = t.status?.toLowerCase() ?? "";
      if (statusCode === "success") active++;
      else expired++;
      totalUsers += t.users ?? 0;
      const pkg = t.packageName || t.packageCodeName || "Unknown";
      packageCounts[pkg] = (packageCounts[pkg] ?? 0) + 1;
    }
    return { total: tenants.data.length, active, expired, deleted, totalUsers, packageCounts };
  }, [tenants.data]);

  // ─── Filtered Tenants ──────────────────────────────────

  const filteredTenants = useMemo(() => {
    if (!tenants.data) return [];
    let result = tenants.data.filter((t) => !t.isDeleted);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.companyName?.toLowerCase().includes(q) ||
          t.domain?.toLowerCase().includes(q) ||
          t.packageName?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aActive = a.status?.toLowerCase() === "success";
      const bActive = b.status?.toLowerCase() === "success";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return (b.users ?? 0) - (a.users ?? 0);
    });
    return result;
  }, [tenants.data, searchTerm]);

  // ─── Filtered Users ────────────────────────────────────

  const filteredUsers = useMemo(() => {
    if (!users.data) return [];
    if (!searchTerm) return users.data;
    const q = searchTerm.toLowerCase();
    return users.data.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users.data, searchTerm]);

  // ─── Tabs ──────────────────────────────────────────────

  const tabs = [
    { id: "events" as const, label: "Security Events", icon: ShieldAlert, count: eventStats.data?.total },
    { id: "tenants" as const, label: "Tenants", icon: Building2, count: tenantStats?.active },
    { id: "users" as const, label: "MSP Users", icon: Users, count: users.data?.length },
  ];

  const isAnyFetching = tenants.isFetching || eventStats.isFetching;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
            <Mail className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Check Point Harmony Email & Collaboration</h2>
            <p className="text-xs text-muted-foreground">
              MSP email security management via SmartAPI
              {tenantStats && (
                <span className="ml-1">
                  &middot; {tenantStats.active} paying customer{tenantStats.active !== 1 ? "s" : ""}
                  &middot; {tenantStats.totalUsers} protected user{tenantStats.totalUsers !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 h-8 px-3 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-xs font-medium transition-colors border border-border"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isAnyFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      {tenantStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard
            label="Security Events"
            value={eventStats.data?.total ?? (eventStats.isLoading ? "..." : "—")}
            icon={ShieldAlert}
            color="text-amber-400"
          />
          <StatCard label="Paying Customers" value={tenantStats.active} icon={ShieldCheck} color="text-green-500" />
          <StatCard label="Protected Users" value={tenantStats.totalUsers} icon={Users} color="text-blue-400" />
          <StatCard label="License Types" value={licenses.data?.length ?? "—"} icon={Package} color="text-purple-400" />
          <StatCard
            label="Expired / Issues"
            value={tenantStats.expired}
            icon={AlertTriangle}
            color={tenantStats.expired > 0 ? "text-red-400" : "text-zinc-500"}
          />
        </div>
      )}

      {/* Package Distribution */}
      {tenantStats && Object.keys(tenantStats.packageCounts).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Packages:</span>
          {Object.entries(tenantStats.packageCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([pkg, count]) => (
              <span key={pkg} className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-foreground border border-border">
                {pkg.replace("Email & Collaboration ", "")} <span className="text-muted-foreground">({count})</span>
              </span>
            ))}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-6 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(""); }}
              className={cn(
                "flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-amber-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-amber-500/10 text-amber-400" : "bg-accent text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search (tenants tab only — users tab has its own search with Add button) */}
      {activeTab === "tenants" && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "events" && (
        <SecurityEventsTab
          stats={eventStats.data}
          loading={eventStats.isLoading}
          fetching={eventStats.isFetching}
          tenants={tenants.data}
          days={eventDays}
          onDaysChange={setEventDays}
          eventStates={eventStates}
          onEventStatesChange={setEventStates}
        />
      )}
      {activeTab === "tenants" && (
        <TenantsTab tenants={filteredTenants} loading={tenants.isLoading} />
      )}
      {activeTab === "users" && (
        <UsersTab users={filteredUsers} loading={users.isLoading} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      )}
    </div>
  );
}

/* ─── STAT CARD ──────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl p-3 bg-card border border-border">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

/* ─── SECURITY EVENTS TAB ──────────────────────────────── */

interface EventStatsData {
  total: number;
  totalRecords: number;
  byType: Record<string, number>;
  byState: Record<string, number>;
  bySeverity: Record<string, number>;
  byDay: Record<string, number>;
  byCustomer: Record<string, number>;
  byCustomerByType: Record<string, Record<string, number>>;
  days: number;
}

interface TenantData {
  id: number;
  domain: string;
  companyName: string;
  deploymentMode: string;
  users: number | null;
  maxLicensedUsers: number | null;
  status: string;
  statusDescription: string;
  packageName: string;
  packageCodeName: string;
  addons: Array<{ id: number; name: string }>;
  isDeleted: boolean;
  tenantRegion: string;
  pocDateStart?: string;
  pocDateExpiration?: string;
}

function SecurityEventsTab({ stats, loading, fetching, tenants, days, onDaysChange, eventStates, onEventStatesChange }: {
  stats?: EventStatsData;
  loading: boolean;
  fetching: boolean;
  tenants?: TenantData[];
  days: number;
  onDaysChange: (days: number) => void;
  eventStates: string[] | undefined;
  onEventStatesChange: (states: string[] | undefined) => void;
}) {
  const [search, setSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!dateOpen && !stateOpen) return;
    function handleClick(e: MouseEvent) {
      if (dateOpen && dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
      if (stateOpen && stateRef.current && !stateRef.current.contains(e.target as Node)) {
        setStateOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dateOpen, stateOpen]);

  // Map customerId → companyName using tenant data
  const customerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (tenants) {
      for (const t of tenants) {
        if (t.domain) map[t.domain] = t.companyName || t.domain;
      }
    }
    return map;
  }, [tenants]);

  // Derive event type columns — sorted by portal column order, then by count
  const eventTypeColumns = useMemo(() => {
    if (!stats?.byType) return [];
    return Object.entries(stats.byType)
      .map(([type, count]) => ({
        key: type,
        label: TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " "),
        color: TYPE_COLORS[type] || DEFAULT_COLOR,
        count,
      }))
      .sort((a, b) => {
        const aIdx = EVENT_TYPE_ORDER.indexOf(a.key);
        const bIdx = EVENT_TYPE_ORDER.indexOf(b.key);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return b.count - a.count;
      });
  }, [stats]);

  // Build per-tenant rows with search filtering
  const tenantRows = useMemo(() => {
    if (!stats?.byCustomerByType) return [];
    return Object.entries(stats.byCustomerByType)
      .map(([customerId, types]) => {
        const total = Object.values(types).reduce((sum, n) => sum + n, 0);
        const name = customerNameMap[customerId] || customerId;
        return { customerId, name, total, types };
      })
      .filter((row) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return row.name.toLowerCase().includes(q) || row.customerId.toLowerCase().includes(q);
      })
      .sort((a, b) => b.total - a.total);
  }, [stats, customerNameMap, search]);

  // Filtered totals for footer
  const filteredTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    let grand = 0;
    for (const row of tenantRows) {
      grand += row.total;
      for (const [type, count] of Object.entries(row.types)) {
        totals[type] = (totals[type] || 0) + count;
      }
    }
    return { grand, byType: totals };
  }, [tenantRows]);

  // Daily trend data
  const dailyData = useMemo(() => {
    if (!stats?.byDay) return [];
    const result: { date: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = stats.days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().substring(0, 10);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      result.push({ date: key, label, count: stats.byDay[key] || 0 });
    }
    return result;
  }, [stats]);

  const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.days === days)?.label || `Last ${days} days`;
  const stateLabel = STATE_FILTER_OPTIONS.find((o) =>
    o.states === eventStates || (o.states && eventStates && o.states.join(",") === eventStates.join(","))
  )?.label || "All Events";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">Loading security events...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Range Dropdown */}
        <div ref={dateRef} className="relative">
          <button
            onClick={() => { setDateOpen(!dateOpen); setStateOpen(false); }}
            className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground flex items-center gap-2 hover:bg-accent/80 transition-colors"
          >
            {dateLabel}
            <ChevronDown className={cn("h-3 w-3 transition-transform", dateOpen && "rotate-180")} />
          </button>
          {dateOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => { onDaysChange(opt.days); setDateOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                    days === opt.days ? "text-amber-400 font-medium" : "text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Show Tenants With (Event State Filter) */}
        <div ref={stateRef} className="relative">
          <button
            onClick={() => { setStateOpen(!stateOpen); setDateOpen(false); }}
            className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground flex items-center gap-2 hover:bg-accent/80 transition-colors"
          >
            {stateLabel}
            <ChevronDown className={cn("h-3 w-3 transition-transform", stateOpen && "rotate-180")} />
          </button>
          {stateOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
              {STATE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => { onEventStatesChange(opt.states); setStateOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                    stateLabel === opt.label ? "text-amber-400 font-medium" : "text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset */}
        {(search || days !== 30 || eventStates !== undefined) && (
          <button
            onClick={() => { setSearch(""); onDaysChange(30); onEventStatesChange(undefined); }}
            className="h-8 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors"
          >
            Reset
          </button>
        )}

        {/* Fetching indicator */}
        {fetching && !loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        )}
      </div>

      {stats && stats.total > 0 ? (
        <>
          {/* Summary */}
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-medium">{stats.total.toLocaleString()}</span> events across{" "}
            <span className="text-foreground font-medium">{Object.keys(stats.byCustomer).length}</span> tenants
          </p>

          {/* Per-Tenant Event Table */}
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[70px]">
                    Total
                  </th>
                  {eventTypeColumns.map((col) => (
                    <th key={col.key} className="text-center px-3 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[90px]">
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {tenantRows.length === 0 ? (
                  <tr>
                    <td colSpan={2 + eventTypeColumns.length} className="text-center py-8 text-sm text-muted-foreground">
                      No tenants match your search
                    </td>
                  </tr>
                ) : (
                  tenantRows.map((row) => (
                    <tr key={row.customerId} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium text-foreground truncate max-w-[220px]" title={row.customerId}>
                          {row.name}
                        </p>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <span className="text-sm font-bold text-foreground">{row.total}</span>
                      </td>
                      {eventTypeColumns.map((col) => {
                        const count = row.types[col.key] || 0;
                        return (
                          <td key={col.key} className="text-center px-3 py-2.5">
                            {count > 0 ? (
                              <span className="text-xs font-medium text-foreground">{count}</span>
                            ) : (
                              <span className="text-xs text-zinc-600">&mdash;</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {tenantRows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-accent/30">
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-medium text-foreground">
                        Total ({tenantRows.length} tenant{tenantRows.length !== 1 ? "s" : ""})
                      </span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-foreground">{filteredTotals.grand}</span>
                    </td>
                    {eventTypeColumns.map((col) => (
                      <td key={col.key} className="text-center px-3 py-2.5">
                        <span className="text-xs font-bold text-foreground">{filteredTotals.byType[col.key] || 0}</span>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Daily Trend */}
          {dailyData.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Daily Event Trend</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.floor(dailyData.length / 8)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#a1a1aa" }}
                    itemStyle={{ color: "#f5f5f5" }}
                    formatter={(value) => [String(value ?? 0), "Events"]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldAlert className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No security events in the selected period</p>
        </div>
      )}
    </div>
  );
}

/* ─── TENANTS TAB ──────────────────────────────────────── */

function TenantsTab({ tenants, loading }: {
  tenants: TenantData[];
  loading: boolean;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm font-medium">No tenants found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr_200px_80px_90px_100px] gap-3 px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border bg-accent/30">
        <span>Tenant</span>
        <span>License</span>
        <span className="text-center">Users</span>
        <span className="text-center">Region</span>
        <span className="text-center">Status</span>
      </div>

      <div className="divide-y divide-border/50">
        {tenants.map((tenant) => {
          const statusCode = tenant.status?.toLowerCase() ?? "unknown";
          const isActive = statusCode === "success";
          const isExpanded = expandedId === tenant.id;

          return (
            <div key={tenant.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                className={cn(
                  "w-full grid grid-cols-[1fr_200px_80px_90px_100px] gap-3 px-4 py-3 text-left transition-colors group",
                  isExpanded ? "bg-accent/40" : "hover:bg-accent/30"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isActive ? "bg-green-500" : "bg-yellow-500")} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tenant.companyName || tenant.domain}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{tenant.domain}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {(tenant.packageName || tenant.packageCodeName || "—").replace("Email & Collaboration ", "")}
                  </span>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-xs text-foreground font-medium">{tenant.users ?? "—"}</span>
                </div>

                <div className="flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground uppercase">{tenant.tenantRegion || "—"}</span>
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border",
                    isActive
                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                      : statusCode === "warning"
                        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                        : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                  )}>
                    {tenant.statusDescription || (isActive ? "Active" : "Expired")}
                  </span>
                  <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 py-4 bg-accent/20 border-t border-border/50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <DetailItem label="Deployment Mode" value={tenant.deploymentMode || "—"} />
                    <DetailItem label="Tenant ID" value={String(tenant.id)} />
                    <DetailItem label="Full Package" value={tenant.packageName || tenant.packageCodeName || "—"} />
                    <DetailItem label="Max Users Limit" value={tenant.maxLicensedUsers ? String(tenant.maxLicensedUsers) : "Unlimited"} />
                    {tenant.pocDateStart && <DetailItem label="Trial Start" value={tenant.pocDateStart} />}
                    {tenant.pocDateExpiration && <DetailItem label="Trial Expiry" value={tenant.pocDateExpiration} />}
                  </div>
                  {tenant.addons.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Add-ons</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tenant.addons.map((addon) => (
                          <span key={addon.id} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {addon.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_200px_80px_90px_100px] gap-3 px-4 py-2.5 border-t border-border bg-accent/30">
        <span className="text-xs font-medium text-foreground">Total ({tenants.length} tenant{tenants.length !== 1 ? "s" : ""})</span>
        <span />
        <span className="text-xs font-medium text-foreground text-center">{tenants.reduce((sum, t) => sum + (t.users ?? 0), 0)}</span>
        <span />
        <span />
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs text-foreground mt-0.5">{value}</p>
    </div>
  );
}

/* ─── USERS TAB ──────────────────────────────────────── */

/** SmartAPI role values — these are customer portal roles (the only ones the API exposes) */
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "operations", label: "Operations" },
  { value: "user", label: "User" },
  { value: "read-only", label: "Read Only" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "text-red-400 bg-red-500/10 border-red-500/20",
  operations: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  user: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "read-only": "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

/** MSP role values — accepted by UPDATE endpoint */
const MSP_ROLE_OPTIONS = [
  { value: "", label: "— No change —" },
  { value: "Admin", label: "MSP Admin" },
  { value: "Help Desk", label: "MSP Help Desk" },
];

/** Tenant access modes — accepted by UPDATE endpoint */
const TENANT_ACCESS_OPTIONS = [
  { value: "", label: "— No change —" },
  { value: "All", label: "All Tenants" },
  { value: "Except", label: "All Except..." },
  { value: "Only", label: "Only Specific..." },
];

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  directLogin: boolean;
  samlLogin: boolean;
  viewPrivateData: boolean;
  sendAlerts: boolean;
  receiveWeeklyReports: boolean;
  /** Write-only MSP fields (accepted on update, not returned by list) */
  mspRole: string;
  mspTenantAccess: string;
  mspTenants: string;
}

const EMPTY_FORM: UserFormData = {
  email: "",
  firstName: "",
  lastName: "",
  role: "admin",
  directLogin: true,
  samlLogin: false,
  viewPrivateData: false,
  sendAlerts: false,
  receiveWeeklyReports: false,
  mspRole: "",
  mspTenantAccess: "",
  mspTenants: "",
};

type MspUserData = {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  sendAlerts?: boolean;
  receiveWeeklyReports?: boolean;
  directLogin?: boolean;
  samlLogin?: boolean;
  viewPrivateData?: boolean;
};

function UsersTab({ users, loading, searchTerm, onSearchChange }: {
  users: MspUserData[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (v: string) => void;
}) {
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<MspUserData | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const createMut = trpc.emailSecurity.createUser.useMutation({
    onSuccess: () => {
      utils.emailSecurity.listUsers.invalidate();
      closeModal();
    },
    onError: (err) => setError(err.message),
  });

  const updateMut = trpc.emailSecurity.updateUser.useMutation({
    onSuccess: () => {
      utils.emailSecurity.listUsers.invalidate();
      closeModal();
    },
    onError: (err) => setError(err.message),
  });

  const deleteMut = trpc.emailSecurity.deleteUser.useMutation({
    onSuccess: () => {
      utils.emailSecurity.listUsers.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => setError(err.message),
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingUser(null);
    setError(null);
    setModalMode("add");
  }

  function openEdit(user: MspUserData) {
    setForm({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role || "admin",
      directLogin: user.directLogin ?? true,
      samlLogin: user.samlLogin ?? false,
      viewPrivateData: user.viewPrivateData ?? false,
      sendAlerts: user.sendAlerts ?? false,
      receiveWeeklyReports: user.receiveWeeklyReports ?? false,
      mspRole: "",
      mspTenantAccess: "",
      mspTenants: "",
    });
    setEditingUser(user);
    setError(null);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingUser(null);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const shared = {
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      role: form.role,
      directLogin: form.directLogin,
      samlLogin: form.samlLogin,
      sendAlerts: form.sendAlerts,
      receiveWeeklyReports: form.receiveWeeklyReports,
    };

    if (modalMode === "add") {
      if (!form.email.trim()) { setError("Email is required"); return; }
      createMut.mutate({ email: form.email.trim(), ...shared });
    } else if (modalMode === "edit" && editingUser) {
      // Include MSP write-only fields only if user explicitly set them
      const mspFields: Record<string, unknown> = {};
      if (form.mspRole) mspFields.mspRole = form.mspRole;
      if (form.mspTenantAccess) mspFields.mspTenantAccess = form.mspTenantAccess;
      if (form.mspTenantAccess && form.mspTenantAccess !== "All" && form.mspTenants.trim()) {
        mspFields.mspTenants = form.mspTenants.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      }
      updateMut.mutate({ userId: editingUser.id, ...shared, ...mspFields } as Parameters<typeof updateMut.mutate>[0]);
    }
  }

  const isMutating = createMut.isPending || updateMut.isPending;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Add User Button */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 h-8 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium transition-colors border border-amber-500/20"
        >
          <Plus className="h-3.5 w-3.5" />
          Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No users found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_130px_100px_140px_80px] gap-3 px-4 py-2.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border bg-accent/30">
            <span>User</span>
            <span>Role</span>
            <span className="text-center">Auth</span>
            <span className="text-center">Permissions</span>
            <span className="text-center">Actions</span>
          </div>

          <div className="divide-y divide-border/50">
            {users.map((user) => {
              const roleKey = user.role?.toLowerCase() ?? "";
              const roleColor = ROLE_COLORS[roleKey] || "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
              const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

              return (
                <div key={user.id} className="grid grid-cols-[1fr_130px_100px_140px_80px] gap-3 px-4 py-3 items-center hover:bg-accent/30 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{name || user.email}</p>
                    {name && <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>}
                  </div>

                  <div>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border capitalize", roleColor)}>
                      {user.role || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    {user.samlLogin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">SSO</span>
                    )}
                    {user.directLogin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Direct</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    {user.sendAlerts && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400" title="Receives Alerts">Alerts</span>
                    )}
                    {user.viewPrivateData && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400" title="Can View Private Data">PII</span>
                    )}
                    {user.receiveWeeklyReports && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400" title="Weekly Reports">Reports</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit user"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deleteConfirm === user.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMut.mutate({ userId: user.id })}
                          disabled={deleteMut.isPending}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Confirm delete"
                        >
                          {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(user.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:text-red-300"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* User Modal (Add/Edit) — matches Avanan portal layout */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto py-8">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {modalMode === "add" ? "Add MSP User" : "Edit MSP User"}
              </h3>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} placeholder="First" />
                <FormField label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} placeholder="Last" />
              </div>
              <FormField
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                placeholder="user@example.com"
                disabled={modalMode === "edit"}
                required
              />

              {/* ── Role ── */}
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Portal Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full mt-1 h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* ── Authentication ── */}
              <SectionHeader label="Authentication" />
              <div className="flex flex-col gap-2">
                <ToggleSwitch label="Password Login (Direct)" checked={form.directLogin} onChange={(v) => setForm({ ...form, directLogin: v })} />
                <ToggleSwitch label="SAML / SSO Login" checked={form.samlLogin} onChange={(v) => setForm({ ...form, samlLogin: v })} />
              </div>

              {/* ── Permissions ── */}
              <SectionHeader label="Permissions & Notifications" />
              <div className="flex flex-col gap-2">
                <ToggleSwitch label="View Private Data" checked={form.viewPrivateData} onChange={(v) => setForm({ ...form, viewPrivateData: v })} />
                <ToggleSwitch label="Send Alerts" checked={form.sendAlerts} onChange={(v) => setForm({ ...form, sendAlerts: v })} />
                <ToggleSwitch label="Receive Weekly Reports" checked={form.receiveWeeklyReports} onChange={(v) => setForm({ ...form, receiveWeeklyReports: v })} />
              </div>

              {/* ── MSP Settings (write-only — accepted on update, not readable) ── */}
              {modalMode === "edit" && (
                <>
                  <SectionHeader label="MSP Settings" />
                  <p className="text-[10px] text-muted-foreground/60 -mt-2">
                    These settings can be changed but current values cannot be read back from the API. Leave on &ldquo;No change&rdquo; to keep the current setting.
                  </p>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">MSP Role</label>
                    <select
                      value={form.mspRole}
                      onChange={(e) => setForm({ ...form, mspRole: e.target.value })}
                      className="w-full mt-1 h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      {MSP_ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tenant Access</label>
                    <select
                      value={form.mspTenantAccess}
                      onChange={(e) => setForm({ ...form, mspTenantAccess: e.target.value })}
                      className="w-full mt-1 h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      {TENANT_ACCESS_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {(form.mspTenantAccess === "Except" || form.mspTenantAccess === "Only") && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Tenant IDs <span className="normal-case">(comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        value={form.mspTenants}
                        onChange={(e) => setForm({ ...form, mspTenants: e.target.value })}
                        placeholder="123, 456, 789"
                        className="w-full mt-1 h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500/50"
                      />
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Enter numeric tenant IDs from the Tenants tab
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Error */}
              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-9 px-4 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="h-9 px-4 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-black transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {modalMode === "add" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── SECTION HEADER ──────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

/* ─── FORM FIELD ──────────────────────────────────────── */

function FormField({ label, type = "text", value, onChange, placeholder, disabled, required }: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={cn(
          "w-full mt-1 h-9 px-3 rounded-lg bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-amber-500/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ─── TOGGLE SWITCH ──────────────────────────────────── */

function ToggleSwitch({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked
            ? "bg-amber-500 border-amber-600"
            : "bg-zinc-700 border-zinc-600"
        )}
      >
        <span className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    </label>
  );
}

