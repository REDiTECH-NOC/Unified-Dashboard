"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Monitor,
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Bug,
  Radar,
  Server,
  Laptop,
  HardDrive,
  Globe,
  ExternalLink,
  Cloud,
  Users,
  Building2,
  MapPin,
  Link2,
  Skull,
  Ban,
  RotateCcw,
  Undo2,
  WifiOff,
  ScanLine,
  Maximize2,
} from "lucide-react";
import { ThreatDetailPanel } from "./threat-detail-panel";

/* ─── TAB TYPE ──────────────────────────────────────────── */

type BPTab = "detections" | "cloud" | "assets" | "vulnerabilities" | "scans" | "tenants";

/* ─── HELPERS ──────────────────────────────────────────── */

const riskColor = (score: number): string => {
  if (score >= 80) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (score >= 60) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (score >= 40) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (score >= 20) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
};

const sevBadge: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  informational: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const dotColor: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-zinc-500",
  warning: "bg-yellow-500",
  unknown: "bg-zinc-600",
};

const devIcon: Record<string, React.ElementType> = {
  server: Server, workstation: HardDrive, laptop: Laptop, other: Monitor,
};

const scanStatusStyle: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "in-progress": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  canceled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  new: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  disabled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const scanTypeStyle: Record<string, string> = {
  darkweb: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  external: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  local: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  network: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const CLOUD_DETECTION_TYPES = ["CLOUD_RESPONSE_M365", "CLOUD_RESPONSE", "M365", "AZURE_AD", "ENTRA_ID"];
const isCloudDetection = (types: string[]) => types.some(t => CLOUD_DETECTION_TYPES.some(c => t.toUpperCase().includes(c)));

function sinceDate(range: string): Date {
  const now = Date.now();
  const ms: Record<string, number> = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6, "90d": 7776e6 };
  return new Date(now - (ms[range] ?? 2592e6));
}

/** Friendly error message — detects common BP API errors */
function friendlyError(msg: string): string {
  if (msg.includes("400")) return "Not available for this tenant (feature may not be enabled)";
  if (msg.includes("403")) return "Access denied — check API permissions";
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) return "Rate limited — try again in a moment";
  return msg;
}

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function BlackpointManagementView() {
  const { dateTime } = useTimezone();
  const [tab, setTab] = useState<BPTab>("detections");
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [timeRange, setTimeRange] = useState("30d");
  const [statusFilter, setStatusFilter] = useState("");
  const [detTypeFilter, setDetTypeFilter] = useState<"all" | "endpoint" | "cloud">("all");
  const [tenantFilter, setTenantFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const since = useMemo(() => sinceDate(timeRange), [timeRange]);

  /* ─── Queries ─── */

  const detections = trpc.blackpoint.getDetections.useQuery(
    { since, search: dSearch || undefined, take: 200 },
    { refetchInterval: 60000, retry: false, enabled: tab === "detections" }
  );

  const detCount = trpc.blackpoint.getDetectionCount.useQuery(
    { since },
    { refetchInterval: 60000, retry: false }
  );

  const topThreats = trpc.blackpoint.getTopDetectionsByThreat.useQuery(
    { startDate: since, limit: 5 },
    { refetchInterval: 300000, retry: false, enabled: tab === "detections" }
  );

  const tenants = trpc.blackpoint.getTenants.useQuery(
    { pageSize: 100 },
    { staleTime: 15 * 60_000, retry: false }
  );

  const vulnStats = trpc.blackpoint.getVulnerabilitySeverityStats.useQuery(
    undefined,
    { refetchInterval: 300000, retry: false, staleTime: 300000 }
  );

  /* ─── Mutations ─── */

  const cancelScan = trpc.blackpoint.cancelScan.useMutation({
    onSuccess: () => utils.blackpoint.getScansAndSchedules.invalidate(),
  });
  const runSchedule = trpc.blackpoint.runScanSchedule.useMutation({
    onSuccess: () => utils.blackpoint.getScansAndSchedules.invalidate(),
  });

  /* ─── Computed ─── */

  const tenantList = useMemo(() => {
    if (!tenants.data?.data) return [];
    return tenants.data.data.map(t => ({ id: t.sourceId, name: t.name, _raw: t._raw }));
  }, [tenants.data]);

  const tenantName = (id: string) => tenantList.find(t => t.id === id)?.name ?? id.substring(0, 8);

  const detStats = useMemo(() => {
    if (!detections.data?.data) return null;
    const list = detections.data.data;
    let active = 0, resolved = 0, critical = 0, high = 0, endpoint = 0, cloud = 0;
    for (const d of list) {
      if (d.status === "active" || d.status === "in_progress") active++; else resolved++;
      if (d.severity === "critical") critical++;
      else if (d.severity === "high") high++;
      const types = ((d._raw as Record<string, unknown>)?.alertTypes as string[]) ?? [];
      if (isCloudDetection(types)) cloud++; else endpoint++;
    }
    return { total: detections.data.totalCount ?? list.length, active, resolved, critical, high, endpoint, cloud };
  }, [detections.data]);

  const vulnStatsMap = useMemo((): Record<string, number> | null => {
    if (!vulnStats.data) return null;
    const s: Record<string, number> = { total: 0 };
    for (const v of vulnStats.data) { s[v.severity.toLowerCase()] = v.count; s.total += v.count; }
    return s;
  }, [vulnStats.data]);

  /* ─── Filtered Detections ─── */

  const filteredDet = useMemo(() => {
    if (!detections.data?.data) return [];
    let list = detections.data.data;
    if (statusFilter === "open") list = list.filter(d => d.status === "active" || d.status === "in_progress");
    else if (statusFilter === "resolved") list = list.filter(d => d.status === "resolved" || d.status === "mitigated");
    if (detTypeFilter !== "all") {
      list = list.filter(d => {
        const types = ((d._raw as Record<string, unknown>)?.alertTypes as string[]) ?? [];
        return detTypeFilter === "cloud" ? isCloudDetection(types) : !isCloudDetection(types);
      });
    }
    if (tenantFilter) {
      list = list.filter(d => (d._raw as Record<string, unknown>)?.customerId === tenantFilter);
    }
    return list;
  }, [detections.data, statusFilter, detTypeFilter, tenantFilter]);

  /* ─── Refresh All ─── */

  const refreshAll = () => {
    utils.blackpoint.getDetections.invalidate();
    utils.blackpoint.getDetectionCount.invalidate();
    utils.blackpoint.getAssets.invalidate();
    utils.blackpoint.getVulnerabilities.invalidate();
    utils.blackpoint.getVulnerabilitySeverityStats.invalidate();
    utils.blackpoint.getScansAndSchedules.invalidate();
    utils.blackpoint.getTopDetectionsByThreat.invalidate();
    utils.blackpoint.getTenants.invalidate();
    utils.blackpoint.getMs365Connections.invalidate();
  };

  const isLoading = detections.isFetching;

  const TABS: { id: BPTab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "detections", label: "Detections", icon: ShieldAlert, count: detStats?.total },
    { id: "cloud", label: "Cloud Security", icon: Cloud, count: tenantList.length > 0 ? tenantList.length : undefined },
    { id: "assets", label: "Assets", icon: Monitor, count: tenantList.length > 0 ? tenantList.length : undefined },
    { id: "vulnerabilities", label: "Vulnerabilities", icon: Bug, count: vulnStatsMap?.total },
    { id: "scans", label: "Scans", icon: Radar, count: tenantList.length > 0 ? tenantList.length : undefined },
    { id: "tenants", label: "Tenants", icon: Building2, count: tenantList.length },
  ];

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Blackpoint CompassOne</h2>
            <p className="text-[11px] text-muted-foreground">
              MDR &middot; {tenantList.length} tenant{tenantList.length !== 1 ? "s" : ""} monitored
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenantList.length > 1 && (
            <select
              value={tenantFilter}
              onChange={e => setTenantFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none focus:ring-1 focus:ring-blue-500/50 max-w-[180px]"
            >
              <option value="">All Tenants</option>
              {tenantList.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={refreshAll}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent hover:bg-accent/80 text-xs font-medium text-foreground border border-border transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ═══ STAT CARDS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Stat label="Detections" value={detCount.data ?? detStats?.total ?? "—"} sub={detStats ? `${detStats.active} open` : undefined} color="text-foreground" />
        <Stat label="Endpoint MDR" value={detStats?.endpoint ?? "—"} color="text-blue-400" dot="bg-blue-500" />
        <Stat label="Cloud / M365" value={detStats?.cloud ?? "—"} color="text-purple-400" dot="bg-purple-500" />
        <Stat label="Tenants" value={tenantList.length || "—"} color="text-foreground" />
        <Stat label="Vulnerabilities" value={vulnStatsMap?.total ?? "—"} sub={vulnStatsMap?.critical ? `${vulnStatsMap.critical} critical` : undefined} color="text-orange-400" />
        <Stat label="Critical" value={vulnStatsMap?.critical ?? "—"} color="text-red-400" dot="bg-red-500" />
      </div>

      {/* ═══ TAB BAR ═══ */}
      <div className="flex gap-0.5 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(""); setDSearch(""); setExpandedId(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.id ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="text-[9px] px-1.5 py-0 rounded-full bg-accent text-muted-foreground border border-border ml-0.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ DETECTIONS ═══ */}
      {tab === "detections" && (
        <div className="space-y-3">
          {topThreats.data && topThreats.data.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">Top:</span>
              {topThreats.data.slice(0, 5).map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-foreground border border-border">
                  {t.name} <span className="text-muted-foreground">({t.count})</span>
                </span>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2.5 flex-wrap">
              <SearchInput value={search} onChange={setSearch} placeholder="Search detections..." />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-7 px-2.5 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none focus:ring-1 focus:ring-blue-500/50">
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="h-7 px-2.5 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none focus:ring-1 focus:ring-blue-500/50 max-w-[200px]">
                <option value="">All Tenants</option>
                {tenantList.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["all", "endpoint", "cloud"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setDetTypeFilter(v)}
                    className={cn(
                      "px-2.5 py-1.5 text-[10px] font-medium transition-colors capitalize",
                      detTypeFilter === v
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === "all" ? "All" : v === "endpoint" ? "Endpoint MDR" : "Cloud / M365"}
                  </button>
                ))}
              </div>
              <div className="flex gap-0.5 ml-auto">
                {["24h", "7d", "30d", "90d"].map(r => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded-md transition-colors",
                      timeRange === r ? "bg-blue-500/10 text-blue-400 border border-blue-500/30" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <DataList
              loading={detections.isLoading}
              error={detections.isError ? detections.error.message : undefined}
              empty={filteredDet.length === 0}
              emptyIcon={ShieldCheck}
              emptyMsg="No detections in this time range"
            >
              {filteredDet.map(det => {
                const raw = det._raw as Record<string, unknown> | undefined;
                const risk = (raw?.riskScore as number) ?? det.severityScore * 10;
                const alertCount = (raw?.alertCount as number) ?? 1;
                const types = (raw?.alertTypes as string[]) ?? [];
                const isCloud = isCloudDetection(types);
                const expanded = expandedId === det.sourceId;

                // Extract detail from the representative alert (already in initial response — no extra API call)
                const alert = raw?.alert as Record<string, unknown> | undefined;
                const action = alert?.action as string | undefined;
                const hostname = (alert?.hostname as string) ?? det.deviceHostname;
                const username = alert?.username as string | undefined;
                const provider = alert?.eventProvider as string | undefined;
                const framework = alert?.threatFramework as string | undefined;
                const isSentinelOne = types.some(t => t.toUpperCase().includes("SENTINELONE"));

                return (
                  <div key={det.sourceId} className={cn(expanded && "bg-accent/20")}>
                    <div
                      className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/40 transition-colors cursor-pointer group"
                      onClick={() => setExpandedId(expanded ? null : det.sourceId)}
                    >
                      {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold tabular-nums w-9 text-center shrink-0", riskColor(risk))}>
                        {risk}
                      </span>
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isCloud ? "bg-purple-500" : "bg-blue-500")} title={isCloud ? "Cloud / M365" : "Endpoint MDR"} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground truncate">
                            {types.length > 0 ? types.join(", ") : det.title}
                          </span>
                          {alertCount > 1 && (
                            <span className="text-[9px] px-1.5 py-0 rounded-full bg-accent text-muted-foreground border border-border shrink-0">
                              {alertCount}
                            </span>
                          )}
                          {isSentinelOne && (
                            <span className="text-[9px] px-1.5 py-0 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0 flex items-center gap-0.5" title="SentinelOne detection — expand for S1 details">
                              <Link2 className="h-2.5 w-2.5" />S1
                            </span>
                          )}
                        </div>
                        {/* Inline detail from initial API call — no extra request */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {typeof raw?.customerId === "string" && (
                            <span className="text-[10px] text-blue-400/70 font-medium">{tenantName(raw.customerId)}</span>
                          )}
                          {action && <span className="text-[10px] text-foreground/70">{action}</span>}
                          {hostname && <span className="text-[10px] text-muted-foreground">Host: {hostname}</span>}
                          {username && <span className="text-[10px] text-muted-foreground">User: {username}</span>}
                          {provider && <span className="text-[10px] text-muted-foreground">Via: {provider}</span>}
                          {framework && <span className="text-[10px] text-muted-foreground/50 truncate max-w-[200px]">{framework}</span>}
                        </div>
                      </div>
                      <Badge
                        className={det.status === "resolved" || det.status === "mitigated"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"}
                      >
                        {det.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0 tabular-nums">
                        {dateTime(det.detectedAt)}
                      </span>
                    </div>
                    {expanded && (
                      <DetectionExpanded
                        alertGroupId={det.sourceId}
                        tenantId={(det._raw as { customerId?: string })?.customerId}
                        dateTime={dateTime}
                        alertCount={alertCount}
                        rawAlert={alert}
                        isSentinelOne={isSentinelOne}
                        hostname={hostname}
                      />
                    )}
                  </div>
                );
              })}
            </DataList>
          </div>
        </div>
      )}

      {/* ═══ CLOUD SECURITY (tenant-grouped) ═══ */}
      {tab === "cloud" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Cloud className="h-4 w-4 text-purple-400" />
                Microsoft 365 Cloud Identity &amp; Threat Detection
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Only tenants with M365 cloud identity connections are shown below
              </p>
            </div>

            {tenantFilter ? (
              <TenantCloudExpanded tenantId={tenantFilter} dateTime={dateTime} />
            ) : (
              <DataList
                loading={tenants.isLoading}
                error={tenants.isError ? tenants.error.message : undefined}
                empty={tenantList.length === 0}
                emptyIcon={Building2}
                emptyMsg="No tenants with M365 cloud identity connections found"
              >
                {tenantList.map(tenant => (
                  <TenantCloudRow key={tenant.id} tenantId={tenant.id} tenantName={tenant.name} dateTime={dateTime} />
                ))}
              </DataList>
            )}
          </div>
        </div>
      )}

      {/* ═══ ASSETS (tenant-grouped) ═══ */}
      {tab === "assets" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4 text-cyan-400" />
                Endpoint Agents by Tenant
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Expand a tenant to view their monitored endpoints and agent status
              </p>
            </div>

            {tenantFilter ? (
              <TenantAssetsExpanded tenantId={tenantFilter} dateTime={dateTime} />
            ) : (
              <DataList
                loading={tenants.isLoading}
                error={tenants.isError ? tenants.error.message : undefined}
                empty={tenantList.length === 0}
                emptyIcon={Building2}
                emptyMsg="No tenants found"
              >
                {tenantList.map(tenant => (
                  <TenantAssetsRow key={tenant.id} tenantId={tenant.id} tenantName={tenant.name} dateTime={dateTime} />
                ))}
              </DataList>
            )}
          </div>
        </div>
      )}

      {/* ═══ VULNERABILITIES (tenant-grouped) ═══ */}
      {tab === "vulnerabilities" && (
        <div className="space-y-3">
          {vulnStatsMap && vulnStatsMap.total > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium">{vulnStatsMap.total} total:</span>
              {(["critical", "high", "medium", "low"] as const).map(s => {
                const c = vulnStatsMap[s] ?? 0;
                if (c === 0) return null;
                return (
                  <span key={s} className={cn("text-[10px] px-2 py-0.5 rounded-full border", sevBadge[s])}>
                    {s}: {c}
                  </span>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Bug className="h-4 w-4 text-orange-400" />
                Vulnerabilities by Tenant
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Expand a tenant to view CVEs, CVSS scores, and affected assets
              </p>
            </div>

            {tenantFilter ? (
              <TenantVulnsExpanded tenantId={tenantFilter} dateTime={dateTime} />
            ) : (
              <DataList
                loading={tenants.isLoading}
                error={tenants.isError ? tenants.error.message : undefined}
                empty={tenantList.length === 0}
                emptyIcon={Building2}
                emptyMsg="No tenants found"
              >
                {tenantList.map(tenant => (
                  <TenantVulnsRow key={tenant.id} tenantId={tenant.id} tenantName={tenant.name} dateTime={dateTime} />
                ))}
              </DataList>
            )}
          </div>
        </div>
      )}

      {/* ═══ SCANS (tenant-grouped) ═══ */}
      {tab === "scans" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Radar className="h-4 w-4 text-cyan-400" />
                Scans &amp; Schedules by Tenant
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Dark web, external, local, and network vulnerability scans
              </p>
            </div>

            {tenantFilter ? (
              <TenantScansExpanded
                tenantId={tenantFilter}
                dateTime={dateTime}
                cancelScan={cancelScan}
                runSchedule={runSchedule}
              />
            ) : (
              <DataList
                loading={tenants.isLoading}
                error={tenants.isError ? tenants.error.message : undefined}
                empty={tenantList.length === 0}
                emptyIcon={Building2}
                emptyMsg="No tenants found"
              >
                {tenantList.map(tenant => (
                  <TenantScansRow
                    key={tenant.id}
                    tenantId={tenant.id}
                    tenantName={tenant.name}
                    dateTime={dateTime}
                    cancelScan={cancelScan}
                    runSchedule={runSchedule}
                  />
                ))}
              </DataList>
            )}
          </div>
        </div>
      )}

      {/* ═══ TENANTS ═══ */}
      {tab === "tenants" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-400" />
              Managed Tenants
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {tenantList.length} tenant{tenantList.length !== 1 ? "s" : ""} in your CompassOne account
            </p>
          </div>
          <DataList
            loading={tenants.isLoading}
            error={tenants.isError ? tenants.error.message : undefined}
            empty={tenantList.length === 0}
            emptyIcon={Building2}
            emptyMsg="No tenants found"
          >
            {tenantList.map(tenant => {
              const expanded = expandedTenantId === tenant.id;
              const raw = tenant._raw as Record<string, unknown> | undefined;
              return (
                <div key={tenant.id} className={cn(expanded && "bg-accent/20")}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
                    onClick={() => setExpandedTenantId(expanded ? null : tenant.id)}
                  >
                    {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-foreground">{tenant.name}</span>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{tenant.id}</p>
                    </div>
                    {typeof raw?.edition === "string" && (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">{raw.edition}</Badge>
                    )}
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">Active</Badge>
                  </div>
                  {expanded && (
                    <div className="border-t border-border/30 bg-accent/20 px-8 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">Tenant ID</span>
                          <span className="font-mono text-foreground/80 text-[11px]">{tenant.id}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">Name</span>
                          <span className="text-foreground/80">{tenant.name}</span>
                        </div>
                        {typeof raw?.edition === "string" && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Edition</span>
                            <span className="text-foreground/80">{raw.edition}</span>
                          </div>
                        )}
                        {typeof raw?.securityPostureRating === "number" && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Security Posture</span>
                            <span className={cn("font-bold", riskColor(raw.securityPostureRating))}>{raw.securityPostureRating}</span>
                          </div>
                        )}
                        {typeof raw?.cloudUsersCount === "number" && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Cloud Users</span>
                            <span className="text-foreground/80">{raw.cloudUsersCount}</span>
                          </div>
                        )}
                        {typeof raw?.endpointAgentsCount === "number" && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Endpoint Agents</span>
                            <span className="text-foreground/80">{raw.endpointAgentsCount}</span>
                          </div>
                        )}
                        {typeof raw?.renewalDate === "string" && (
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-medium block">Renewal Date</span>
                            <span className="text-foreground/80">{dateTime(raw.renewalDate)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">Client Link</span>
                          <span className="text-muted-foreground italic text-[11px]">Not linked</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium block">Actions</span>
                          <button className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">Link to Client</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </DataList>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TENANT CLOUD ROW — expandable tenant → M365 ITDR
   ═══════════════════════════════════════════════════════════ */

function TenantCloudRow({ tenantId, tenantName, dateTime }: {
  tenantId: string; tenantName: string; dateTime: (d: Date | string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Eagerly fetch M365 connections to determine if this tenant has cloud identity configured
  const ms365 = trpc.blackpoint.getMs365Connections.useQuery(
    { tenantId },
    { retry: false, staleTime: 300000 }
  );

  // Hide tenants with no M365 connections (or that returned errors — likely no cloud identity configured)
  if (ms365.isLoading) return null; // Don't flash rows while checking
  if (ms365.isError) return null;
  if (!ms365.data || (Array.isArray(ms365.data) && ms365.data.length === 0)) return null;

  const connCount = Array.isArray(ms365.data) ? ms365.data.length : 0;

  return (
    <div className={cn(expanded && "bg-accent/10")}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <div className="h-7 w-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
          <Cloud className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground">{tenantName}</span>
        </div>
        {connCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{connCount} connection{connCount !== 1 ? "s" : ""}</span>
        )}
      </div>
      {expanded && <TenantCloudExpanded tenantId={tenantId} dateTime={dateTime} />}
    </div>
  );
}

function TenantCloudExpanded({ tenantId, dateTime }: { tenantId: string; dateTime: (d: Date | string) => string }) {
  const ms365 = trpc.blackpoint.getMs365Connections.useQuery(
    { tenantId },
    { retry: false, staleTime: 300000 }
  );

  if (ms365.isLoading) return <div className="px-8 py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (ms365.isError) return <div className="px-8 py-3 text-[10px] text-muted-foreground">{friendlyError(ms365.error.message)}</div>;
  if (!ms365.data || (Array.isArray(ms365.data) && ms365.data.length === 0)) {
    return <div className="px-8 py-3 text-[10px] text-muted-foreground">No M365 connections — Cloud MDR may not be enabled for this tenant</div>;
  }

  return (
    <div className="border-t border-border/30 bg-accent/20">
      {Array.isArray(ms365.data) && ms365.data.map((conn: Record<string, unknown>) => (
        <Ms365ConnectionRow key={conn.id as string} connection={conn} tenantId={tenantId} dateTime={dateTime} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TENANT ASSET ROW — expandable tenant → asset list
   ═══════════════════════════════════════════════════════════ */

function TenantAssetsRow({ tenantId, tenantName, dateTime }: {
  tenantId: string; tenantName: string; dateTime: (d: Date | string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const assets = trpc.blackpoint.getAssets.useQuery(
    { tenantId, pageSize: 200 },
    { retry: false, enabled: expanded, staleTime: 300000 }
  );

  const count = assets.data?.totalCount;
  const online = assets.data?.data?.filter(a => a.status === "online").length ?? 0;

  return (
    <div className={cn(expanded && "bg-accent/10")}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Monitor className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground">{tenantName}</span>
        </div>
        {count != null && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-muted-foreground">{count} agent{count !== 1 ? "s" : ""}</span>
            {online > 0 && <span className="text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{online}</span>}
            {count > online && <span className="text-zinc-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />{count - online}</span>}
          </div>
        )}
        {assets.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      </div>
      {expanded && <TenantAssetsExpanded tenantId={tenantId} dateTime={dateTime} />}
    </div>
  );
}

function TenantAssetsExpanded({ tenantId, dateTime }: { tenantId: string; dateTime: (d: Date | string) => string }) {
  const assets = trpc.blackpoint.getAssets.useQuery(
    { tenantId, pageSize: 200 },
    { retry: false, staleTime: 300000 }
  );

  if (assets.isLoading) return <div className="px-8 py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (assets.isError) return <div className="px-8 py-3 text-[10px] text-muted-foreground">{friendlyError(assets.error.message)}</div>;
  if (!assets.data?.data?.length) return <div className="px-8 py-3 text-[10px] text-muted-foreground">No endpoint agents found — CRAFT may not be enabled for this tenant</div>;

  return (
    <div className="border-t border-border/30 bg-accent/20">
      {assets.data.data.map(asset => {
        const Icon = devIcon[asset.deviceType ?? "other"] ?? Monitor;
        const meta = asset.metadata as Record<string, unknown> | undefined;
        const cls = (meta?.assetClass as string) ?? "DEVICE";
        const tags = (meta?.tags as string[]) ?? [];

        return (
          <div key={asset.sourceId} className="flex items-center gap-2.5 px-8 py-2 hover:bg-accent/40 transition-colors group border-b border-border/20 last:border-0">
            <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor[asset.status] ?? dotColor.unknown)} />
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground truncate">{asset.hostname}</span>
                <Badge className="bg-accent text-muted-foreground border-border uppercase">{cls}</Badge>
              </div>
              <div className="flex items-center gap-2.5 mt-0.5">
                {asset.os && <span className="text-[10px] text-muted-foreground">{asset.os} {asset.osVersion ?? ""}</span>}
                {asset.privateIp && <span className="text-[10px] text-muted-foreground font-mono">{asset.privateIp}</span>}
                {asset.publicIp && (
                  <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                    <Globe className="h-2.5 w-2.5" />{asset.publicIp}
                  </span>
                )}
                {tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[9px] px-1 py-0 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{tag}</span>
                ))}
              </div>
            </div>
            {asset.lastSeen && (
              <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0 tabular-nums">{dateTime(asset.lastSeen)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TENANT VULNS ROW — expandable tenant → vulnerability list
   ═══════════════════════════════════════════════════════════ */

function TenantVulnsRow({ tenantId, tenantName, dateTime }: {
  tenantId: string; tenantName: string; dateTime: (d: Date | string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedVulnId, setExpandedVulnId] = useState<string | null>(null);

  const sevStats = trpc.blackpoint.getVulnerabilitySeverityStats.useQuery(
    { tenantId },
    { retry: false, enabled: expanded, staleTime: 300000 }
  );

  const statsMap = useMemo((): Record<string, number> => {
    if (!sevStats.data) return {};
    const m: Record<string, number> = { total: 0 };
    for (const v of sevStats.data) { m[v.severity.toLowerCase()] = v.count; m.total += v.count; }
    return m;
  }, [sevStats.data]);

  return (
    <div className={cn(expanded && "bg-accent/10")}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Bug className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground">{tenantName}</span>
        </div>
        {statsMap.total > 0 && (
          <div className="flex items-center gap-1.5">
            {statsMap.critical > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 tabular-nums">{statsMap.critical}C</span>}
            {statsMap.high > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20 tabular-nums">{statsMap.high}H</span>}
            {statsMap.medium > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/20 tabular-nums">{statsMap.medium}M</span>}
            {statsMap.low > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20 tabular-nums">{statsMap.low}L</span>}
            <span className="text-[10px] text-muted-foreground">{statsMap.total} total</span>
          </div>
        )}
        {sevStats.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <TenantVulnsExpanded tenantId={tenantId} dateTime={dateTime} expandedVulnId={expandedVulnId} setExpandedVulnId={setExpandedVulnId} />
      )}
    </div>
  );
}

function TenantVulnsExpanded({ tenantId, dateTime, expandedVulnId, setExpandedVulnId }: {
  tenantId: string; dateTime: (d: Date | string) => string;
  expandedVulnId?: string | null; setExpandedVulnId?: (id: string | null) => void;
}) {
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null);
  const vulns = trpc.blackpoint.getVulnerabilities.useQuery(
    { tenantId, pageSize: 200 },
    { retry: false, staleTime: 300000 }
  );

  const expId = expandedVulnId ?? localExpandedId;
  const setExpId = setExpandedVulnId ?? setLocalExpandedId;

  if (vulns.isLoading) return <div className="px-8 py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (vulns.isError) return <div className="px-8 py-3 text-[10px] text-muted-foreground">{friendlyError(vulns.error.message)}</div>;
  if (!vulns.data?.data?.length) return <div className="px-8 py-3 text-[10px] text-muted-foreground">No vulnerabilities — CRAFT scanning may not be enabled for this tenant</div>;

  const list = vulns.data.data as Array<{ id: string; name: string; cveId?: string | null; severity?: string | null; baseScore?: number | null; assetsAmount?: number | null; exploitability?: string | null; description?: string | null; solution?: string | null; foundOn: string; lastSeenOn: string }>;

  return (
    <div className="border-t border-border/30 bg-accent/20">
      {list.map(vuln => {
        const expanded = expId === vuln.id;
        const s = (vuln.severity ?? "medium").toLowerCase();
        return (
          <div key={vuln.id} className={cn(expanded && "bg-accent/30")}>
            <div
              className="flex items-center gap-2.5 px-8 py-2 hover:bg-accent/40 transition-colors cursor-pointer group border-b border-border/20 last:border-0"
              onClick={() => setExpId(expanded ? null : vuln.id)}
            >
              {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              {vuln.baseScore != null && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold tabular-nums w-9 text-center shrink-0", riskColor(vuln.baseScore * 10))}>
                  {vuln.baseScore.toFixed(1)}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {vuln.cveId && <span className="text-[10px] font-mono text-blue-400 shrink-0">{vuln.cveId}</span>}
                  <span className="text-xs font-medium text-foreground truncate">{vuln.name}</span>
                </div>
                {vuln.assetsAmount != null && vuln.assetsAmount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{vuln.assetsAmount} asset{vuln.assetsAmount !== 1 ? "s" : ""}</span>
                )}
              </div>
              <Badge className={sevBadge[s] ?? sevBadge.medium}>{s}</Badge>
              {vuln.exploitability === "Attacked" && <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Exploited</Badge>}
            </div>
            {expanded && <VulnExpanded vulnId={vuln.id} vuln={vuln} dateTime={dateTime} />}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TENANT SCANS ROW — expandable tenant → scan list
   ═══════════════════════════════════════════════════════════ */

function TenantScansRow({ tenantId, tenantName, dateTime, cancelScan, runSchedule }: {
  tenantId: string; tenantName: string; dateTime: (d: Date | string) => string;
  cancelScan: { mutate: (v: { id: string }) => void; isPending: boolean };
  runSchedule: { mutate: (v: { id: string }) => void; isPending: boolean };
}) {
  const [expanded, setExpanded] = useState(false);
  const scans = trpc.blackpoint.getScansAndSchedules.useQuery(
    { tenantId, pageSize: 200 },
    { retry: false, enabled: expanded, staleTime: 300000 }
  );

  const count = scans.data?.meta?.totalItems;

  return (
    <div className={cn(expanded && "bg-accent/10")}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Radar className="h-3.5 w-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground">{tenantName}</span>
        </div>
        {count != null && <span className="text-[10px] text-muted-foreground">{count} scan{count !== 1 ? "s" : ""}</span>}
        {scans.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <TenantScansExpanded tenantId={tenantId} dateTime={dateTime} cancelScan={cancelScan} runSchedule={runSchedule} />
      )}
    </div>
  );
}

function TenantScansExpanded({ tenantId, dateTime, cancelScan, runSchedule }: {
  tenantId: string; dateTime: (d: Date | string) => string;
  cancelScan: { mutate: (v: { id: string }) => void; isPending: boolean };
  runSchedule: { mutate: (v: { id: string }) => void; isPending: boolean };
}) {
  const scans = trpc.blackpoint.getScansAndSchedules.useQuery(
    { tenantId, pageSize: 200 },
    { retry: false, staleTime: 300000 }
  );

  if (scans.isLoading) return <div className="px-8 py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (scans.isError) return <div className="px-8 py-3 text-[10px] text-muted-foreground">{friendlyError(scans.error.message)}</div>;
  if (!scans.data?.data?.length) return <div className="px-8 py-3 text-[10px] text-muted-foreground">No scans or schedules — CRAFT scanning may not be enabled</div>;

  const list = scans.data.data as Array<{ id: string; name: string; type: string; status: string; frequency: string; sourceTable: string; createdOn: string; tenantId: string }>;

  return (
    <div className="border-t border-border/30 bg-accent/20">
      {list.map(scan => (
        <div key={scan.id} className="flex items-center gap-2.5 px-8 py-2 hover:bg-accent/40 transition-colors group border-b border-border/20 last:border-0">
          <Badge className={scanTypeStyle[scan.type] ?? "bg-accent text-muted-foreground border-border"}>{scan.type}</Badge>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">{scan.name || `Scan ${scan.id.substring(0, 8)}`}</span>
              {scan.frequency && scan.frequency !== "once" && (
                <Badge className="bg-accent text-muted-foreground border-border">{scan.frequency}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">{scan.sourceTable === "scanschedule" ? "Schedule" : "Scan"}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{dateTime(new Date(scan.createdOn))}</span>
            </div>
          </div>
          <Badge className={scanStatusStyle[scan.status] ?? "bg-accent text-muted-foreground border-border"}>{scan.status}</Badge>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
            {scan.status === "in-progress" && (
              <button onClick={() => cancelScan.mutate({ id: scan.id })} disabled={cancelScan.isPending} className="text-[10px] px-2 py-1 rounded-md hover:bg-red-500/10 text-red-400 transition-colors">Cancel</button>
            )}
            {scan.sourceTable === "scanschedule" && scan.status === "active" && (
              <button onClick={() => runSchedule.mutate({ id: scan.id })} disabled={runSchedule.isPending} className="text-[10px] px-2 py-1 rounded-md hover:bg-green-500/10 text-green-400 transition-colors">Run</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DETECTION EXPANDED — individual alerts in group
   Only fetches additional alerts if the group has more than 1.
   The representative alert data is already shown inline.
   ═══════════════════════════════════════════════════════════ */

function DetectionExpanded({ alertGroupId, tenantId, dateTime, alertCount, rawAlert, isSentinelOne, hostname }: {
  alertGroupId: string; tenantId?: string; dateTime: (d: Date | string) => string; alertCount: number;
  rawAlert?: Record<string, unknown>; isSentinelOne?: boolean; hostname?: string;
}) {
  const [showS1, setShowS1] = useState(false);

  // Only fetch if there are multiple alerts to show
  const alerts = trpc.blackpoint.getDetectionAlerts.useQuery(
    { alertGroupId, tenantId, take: 50 },
    { retry: false, enabled: alertCount > 1 }
  );

  // Inline S1 threat search — find matching S1 threats by hostname
  const s1Threats = trpc.edr.getThreats.useQuery(
    { searchTerm: hostname ?? "", pageSize: 5 },
    { retry: false, enabled: showS1 && !!hostname }
  );

  // Extract enrichment fields from the representative alert (no extra API call)
  const reasons = rawAlert?.reasons as Array<Record<string, unknown>> | undefined;
  const socActions = rawAlert?.socReportingActions as Array<Record<string, unknown>> | undefined;
  const anomalyPct = rawAlert?.anomalyPercentile as number | undefined;
  const ruleName = rawAlert?.ruleName as string | undefined;
  const threatFw = rawAlert?.threatFramework as string | undefined;

  // Format a reason entry — these have {name, value} structure
  const fmtReason = (r: Record<string, unknown>) => {
    if (typeof r.name === "string") return r.name + (r.value !== undefined && r.value !== 0 ? `: ${r.value}` : "");
    if (typeof r.reason === "string") return r.reason;
    if (typeof r.description === "string") return r.description;
    return JSON.stringify(r);
  };

  // Render the enrichment section (shown for all detections)
  const enrichmentSection = (
    <div className="px-8 py-3 space-y-2.5 border-b border-border/20">
      {/* SOC Reporting Actions — closest to CompassOne's "Detection Summary" */}
      {socActions && socActions.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">SOC Analysis</span>
          {socActions.map((action, i) => {
            const label = typeof action.action === "string" ? action.action : null;
            const desc = typeof action.description === "string" ? action.description : null;
            const status = typeof action.status === "string" ? action.status : null;
            return (
              <div key={i} className="mb-1.5">
                {label && <p className="text-xs text-foreground font-medium">{label}{status && <span className="text-[10px] text-muted-foreground ml-2">({status})</span>}</p>}
                {desc && <p className="text-[10px] text-foreground/70 mt-0.5">{desc}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Reasons — why the detection was flagged */}
      {reasons && reasons.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase block mb-1">Detection Reasons</span>
          {reasons.map((reason, i) => (
            <p key={i} className="text-[10px] text-foreground/70">&bull; {fmtReason(reason)}</p>
          ))}
        </div>
      )}

      {/* Threat intelligence row */}
      {(ruleName || threatFw || anomalyPct != null) && (
        <div className="flex items-center gap-4 flex-wrap">
          {ruleName && (
            <div className="flex items-baseline gap-1"><span className="text-[10px] text-muted-foreground/60">Rule:</span><span className="text-[10px] text-foreground/70">{ruleName}</span></div>
          )}
          {threatFw && (
            <div className="flex items-baseline gap-1"><span className="text-[10px] text-muted-foreground/60">Framework:</span><span className="text-[10px] text-foreground/70 truncate max-w-[250px]">{threatFw}</span></div>
          )}
          {anomalyPct != null && (
            <div className="flex items-baseline gap-1"><span className="text-[10px] text-muted-foreground/60">Anomaly:</span><span className="text-[10px] text-foreground/70">{anomalyPct}th percentile</span></div>
          )}
        </div>
      )}

      {/* S1 inline cross-reference for SentinelOne detections */}
      {isSentinelOne && hostname && (
        <div className="mt-1">
          <button
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-medium transition-colors",
              showS1 ? "text-purple-300" : "text-purple-400 hover:text-purple-300"
            )}
            onClick={() => setShowS1(!showS1)}
          >
            {showS1 ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Link2 className="h-3 w-3" />
            SentinelOne Alerts for &ldquo;{hostname}&rdquo;
          </button>
          {showS1 && (
            <div className="mt-2 ml-5 rounded-lg border border-purple-500/20 bg-purple-500/5 overflow-hidden">
              {s1Threats.isLoading && <div className="px-4 py-3"><Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" /></div>}
              {s1Threats.isError && <div className="px-4 py-2.5 text-[10px] text-muted-foreground">Failed to load S1 threats: {friendlyError(s1Threats.error.message)}</div>}
              {s1Threats.data && s1Threats.data.data.length === 0 && (
                <div className="px-4 py-2.5 text-[10px] text-muted-foreground">No matching SentinelOne threats found for this hostname</div>
              )}
              {s1Threats.data && s1Threats.data.data.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 border-b border-purple-500/20 bg-purple-500/10">
                    <span className="text-[9px] text-purple-400 uppercase font-medium">SentinelOne — {s1Threats.data.data.length} matching threat{s1Threats.data.data.length !== 1 ? "s" : ""}</span>
                  </div>
                  {s1Threats.data.data.map(threat => (
                    <InlineS1Threat key={threat.sourceId} threat={threat} dateTime={dateTime} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fallback when no enrichment data is available */}
      {!socActions?.length && !reasons?.length && !ruleName && !isSentinelOne && (
        <p className="text-[10px] text-muted-foreground">No additional enrichment data available from the API — the detection summary shown in CompassOne is generated by Blackpoint&apos;s BROC AI and not exposed via their API</p>
      )}
    </div>
  );

  if (alertCount <= 1) {
    return (
      <div className="border-t border-border/30 bg-accent/30">
        {enrichmentSection}
      </div>
    );
  }

  if (alerts.isLoading) return (
    <div className="border-t border-border/30 bg-accent/30">
      {enrichmentSection}
      <div className="px-8 py-3"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div>
    </div>
  );
  if (alerts.isError || !alerts.data?.data?.length) {
    return (
      <div className="border-t border-border/30 bg-accent/30">
        {enrichmentSection}
        <div className="px-8 py-2.5 text-[10px] text-muted-foreground">{alerts.isError ? `Failed to load: ${friendlyError(alerts.error.message)}` : "No individual alerts"}</div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/30 bg-accent/30">
      {enrichmentSection}
      <div className="px-8 py-1.5 border-b border-border/20">
        <span className="text-[9px] text-muted-foreground uppercase font-medium">{alerts.data.data.length} individual alerts in this group</span>
      </div>
      {alerts.data.data.map(alertItem => {
        const raw = alertItem._raw as Record<string, unknown> | undefined;
        return (
          <div key={alertItem.sourceId} className="flex items-start gap-2.5 px-8 py-2 border-b border-border/20 last:border-0">
            <Badge className={sevBadge[alertItem.severity] ?? sevBadge.medium}>{alertItem.severity}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">{alertItem.title}</p>
              {alertItem.message && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{alertItem.message}</p>}
              <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                {alertItem.deviceHostname && <span className="text-[10px] text-muted-foreground">Host: {alertItem.deviceHostname}</span>}
                {typeof raw?.username === "string" && <span className="text-[10px] text-muted-foreground">User: {raw.username}</span>}
                {typeof raw?.eventProvider === "string" && <span className="text-[10px] text-muted-foreground">Via: {raw.eventProvider}</span>}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{dateTime(alertItem.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INLINE S1 THREAT — full controls inside BP detection
   ═══════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InlineS1Threat({ threat, dateTime }: { threat: any; dateTime: (d: Date | string) => string }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const threatId = threat.sourceId as string;

  const s1raw = threat._raw as Record<string, unknown> | undefined;
  const info = s1raw?.threatInfo as Record<string, unknown> | undefined;
  const realtime = s1raw?.agentRealtimeInfo as Record<string, unknown> | undefined;
  const detection = s1raw?.agentDetectionInfo as Record<string, unknown> | undefined;

  const agentId = (realtime?.agentId ?? s1raw?.agentId) as string | undefined;
  const isIsolated = realtime?.agentNetworkStatus === "disconnected";

  // Mutations
  const mitigate = trpc.edr.mitigateThreat.useMutation({ onSuccess: () => { utils.edr.getThreats.invalidate(); } });
  const updateStatus = trpc.edr.updateIncidentStatus.useMutation({ onSuccess: () => { utils.edr.getThreats.invalidate(); } });
  const updateVerdict = trpc.edr.updateAnalystVerdict.useMutation({ onSuccess: () => { utils.edr.getThreats.invalidate(); } });
  const isolate = trpc.edr.isolateDevice.useMutation({ onSuccess: () => { utils.edr.getThreats.invalidate(); } });
  const unisolate = trpc.edr.unisolateDevice.useMutation({ onSuccess: () => { utils.edr.getThreats.invalidate(); } });
  const triggerScan = trpc.edr.triggerFullScan.useMutation();

  const anyPending = mitigate.isPending || updateStatus.isPending || updateVerdict.isPending || isolate.isPending || unisolate.isPending || triggerScan.isPending;

  return (
    <>
      <div className="px-4 py-3 border-b border-purple-500/10 last:border-0">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Badge className={sevBadge[threat.severity] ?? sevBadge.medium}>{threat.severity}</Badge>
          <span className="text-xs text-foreground font-medium truncate">{threat.title}</span>
          <Badge className={threat.status === "resolved" || threat.status === "mitigated"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
          }>{threat.status}</Badge>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0 tabular-nums">{dateTime(threat.detectedAt)}</span>
        </div>

        {/* Device / File / Process info */}
        <div className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px]">
          <div className="space-y-0.5">
            <span className="text-[9px] text-muted-foreground/50 uppercase font-medium block">Device</span>
            {threat.deviceHostname && <div><span className="text-muted-foreground">Hostname:</span> <span className="text-foreground">{threat.deviceHostname}</span></div>}
            {typeof detection?.agentOsName === "string" && <div><span className="text-muted-foreground">OS:</span> <span className="text-foreground">{detection.agentOsName}</span></div>}
            {typeof detection?.agentIpV4 === "string" && <div><span className="text-muted-foreground">IP:</span> <span className="text-foreground">{detection.agentIpV4}</span></div>}
            {typeof detection?.siteName === "string" && <div><span className="text-muted-foreground">Site:</span> <span className="text-foreground">{detection.siteName}</span></div>}
            {typeof detection?.groupName === "string" && <div><span className="text-muted-foreground">Group:</span> <span className="text-foreground">{detection.groupName}</span></div>}
            {realtime && <div><span className="text-muted-foreground">Network:</span> <span className={isIsolated ? "text-red-400" : "text-green-400"}>{isIsolated ? "isolated" : "connected"}</span></div>}
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-muted-foreground/50 uppercase font-medium block">File / Process</span>
            {threat.indicators?.filePath && <div><span className="text-muted-foreground">Path:</span> <span className="text-foreground truncate block max-w-[250px]" title={threat.indicators.filePath}>{threat.indicators.filePath}</span></div>}
            {typeof info?.originatorProcess === "string" && <div><span className="text-muted-foreground">Process:</span> <span className="text-foreground">{info.originatorProcess}</span></div>}
            {typeof info?.processUser === "string" && <div><span className="text-muted-foreground">User:</span> <span className="text-foreground">{info.processUser}</span></div>}
            {typeof info?.publisherName === "string" && <div><span className="text-muted-foreground">Publisher:</span> <span className="text-foreground">{info.publisherName}</span></div>}
            {typeof info?.detectionType === "string" && <div><span className="text-muted-foreground">Detection:</span> <span className="text-foreground">{info.detectionType}</span></div>}
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-muted-foreground/50 uppercase font-medium block">Indicators</span>
            {typeof info?.classification === "string" && <div><span className="text-muted-foreground">Class:</span> <span className="text-foreground">{info.classification}</span></div>}
            {typeof info?.confidenceLevel === "string" && <div><span className="text-muted-foreground">Confidence:</span> <span className="text-foreground">{info.confidenceLevel}</span></div>}
            {typeof info?.analystVerdict === "string" && <div><span className="text-muted-foreground">Verdict:</span> <span className="text-foreground">{info.analystVerdict}</span></div>}
            {threat.indicators?.fileHash && <div><span className="text-muted-foreground">SHA256:</span> <span className="text-foreground font-mono truncate block max-w-[200px]" title={threat.indicators.fileHash}>{threat.indicators.fileHash}</span></div>}
            {typeof info?.storyline === "string" && <div><span className="text-muted-foreground">Storyline:</span> <span className="text-foreground font-mono">{info.storyline}</span></div>}
            {typeof info?.fileSize === "number" && <div><span className="text-muted-foreground">Size:</span> <span className="text-foreground">{(info.fileSize / 1024).toFixed(1)} KB</span></div>}
            {typeof info?.initiatedBy === "string" && <div><span className="text-muted-foreground">Initiated:</span> <span className="text-foreground">{info.initiatedBy}</span></div>}
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {/* Mitigate actions */}
          <span className="text-[9px] text-muted-foreground/50 uppercase font-medium">Mitigate:</span>
          {([
            { action: "kill", label: "Kill", icon: Skull, cls: "hover:bg-red-500/10 text-red-400" },
            { action: "quarantine", label: "Quarantine", icon: Ban, cls: "hover:bg-red-500/10 text-red-400" },
            { action: "remediate", label: "Remediate", icon: RotateCcw, cls: "hover:bg-orange-500/10 text-orange-400" },
            { action: "rollback", label: "Rollback", icon: Undo2, cls: "hover:bg-red-500/10 text-red-400" },
          ] as const).map(a => (
            <button
              key={a.action}
              disabled={anyPending}
              onClick={() => mitigate.mutate({ threatId, action: a.action })}
              className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors border border-transparent hover:border-border", a.cls, anyPending && "opacity-50")}
            >
              <a.icon className="h-3 w-3" />{a.label}
            </button>
          ))}

          <div className="w-px h-4 bg-border/30 mx-1" />

          {/* Device actions */}
          <span className="text-[9px] text-muted-foreground/50 uppercase font-medium">Device:</span>
          {agentId && (
            <button
              disabled={anyPending}
              onClick={() => isIsolated ? unisolate.mutate({ agentId }) : isolate.mutate({ agentId })}
              className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors border border-transparent hover:border-border", isIsolated ? "hover:bg-green-500/10 text-green-400" : "hover:bg-red-500/10 text-red-400", anyPending && "opacity-50")}
            >
              <WifiOff className="h-3 w-3" />{isIsolated ? "Reconnect" : "Isolate"}
            </button>
          )}
          {agentId && (
            <button
              disabled={anyPending}
              onClick={() => triggerScan.mutate({ agentId })}
              className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors border border-transparent hover:border-border hover:bg-blue-500/10 text-blue-400", anyPending && "opacity-50")}
            >
              <ScanLine className="h-3 w-3" />Scan
            </button>
          )}

          <div className="w-px h-4 bg-border/30 mx-1" />

          {/* Status & Verdict */}
          <select
            value={typeof info?.incidentStatus === "string" ? info.incidentStatus : ""}
            onChange={e => updateStatus.mutate({ threatIds: [threatId], status: e.target.value as "resolved" | "in_progress" | "unresolved" })}
            disabled={anyPending}
            className="h-6 px-1.5 rounded bg-accent border border-border text-[10px] text-foreground outline-none"
          >
            <option value="unresolved">Unresolved</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="suspicious">Suspicious</option>
          </select>
          <select
            value={typeof info?.analystVerdict === "string" ? info.analystVerdict : ""}
            onChange={e => updateVerdict.mutate({ threatIds: [threatId], verdict: e.target.value as "undefined" | "true_positive" | "false_positive" | "suspicious" })}
            disabled={anyPending}
            className="h-6 px-1.5 rounded bg-accent border border-border text-[10px] text-foreground outline-none"
          >
            <option value="undefined">No Verdict</option>
            <option value="true_positive">True Positive</option>
            <option value="false_positive">False Positive</option>
            <option value="suspicious">Suspicious</option>
          </select>

          {/* Full Details button */}
          <button
            onClick={() => setDetailId(threatId)}
            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors ml-auto font-medium"
          >
            Full Details <Maximize2 className="h-3 w-3" />
          </button>
        </div>

        {anyPending && <div className="mt-1.5 flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin text-purple-400" /><span className="text-[10px] text-muted-foreground">Processing...</span></div>}
        {(mitigate.isError || updateStatus.isError || updateVerdict.isError || isolate.isError || unisolate.isError) && (
          <p className="mt-1 text-[10px] text-red-400">Action failed — check SentinelOne connectivity</p>
        )}
      </div>

      {/* Full detail slide-out panel */}
      {detailId && <ThreatDetailPanel threatId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   VULN EXPANDED — details for a single vulnerability
   ═══════════════════════════════════════════════════════════ */

function VulnExpanded({ vulnId, vuln, dateTime }: {
  vulnId: string;
  vuln: { description?: string | null; solution?: string | null; foundOn: string; lastSeenOn: string; cveId?: string | null };
  dateTime: (d: Date | string) => string;
}) {
  const vulnAssets = trpc.blackpoint.getVulnerabilityAssets.useQuery({ vulnId, pageSize: 20 }, { retry: false });
  const cveRefs = trpc.blackpoint.getCveReferences.useQuery({ id: vulnId }, { retry: false, enabled: !!vuln.cveId });

  return (
    <div className="border-t border-border/30 bg-accent/20 px-10 py-4 space-y-3">
      {vuln.description && (
        <div><span className="text-[10px] font-medium text-muted-foreground uppercase">Description</span><p className="text-xs text-foreground/80 mt-0.5">{vuln.description}</p></div>
      )}
      {vuln.solution && (
        <div><span className="text-[10px] font-medium text-muted-foreground uppercase">Solution</span><p className="text-xs text-foreground/80 mt-0.5">{vuln.solution}</p></div>
      )}
      <div className="flex gap-6">
        <div><span className="text-[10px] font-medium text-muted-foreground uppercase">First Found</span><p className="text-xs text-foreground/80 mt-0.5">{dateTime(vuln.foundOn)}</p></div>
        <div><span className="text-[10px] font-medium text-muted-foreground uppercase">Last Seen</span><p className="text-xs text-foreground/80 mt-0.5">{dateTime(vuln.lastSeenOn)}</p></div>
      </div>
      {cveRefs.data && cveRefs.data.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase">References</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {cveRefs.data.map((ref, i) => (
              <a key={i} href={(ref as { url?: string }).url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
                {(ref as { name?: string }).name ?? "Reference"}<ExternalLink className="h-2.5 w-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
      {vulnAssets.isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : vulnAssets.data && (
        <div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            Affected Assets ({((vulnAssets.data as { meta?: { totalItems?: number } }).meta?.totalItems) ?? 0})
          </span>
          <div className="mt-1 space-y-1">
            {((vulnAssets.data as { data?: Array<{ id: string; name: string; hostname?: string; platform?: string }> }).data ?? []).slice(0, 10).map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs text-foreground/80">
                <Monitor className="h-3 w-3 text-muted-foreground" /><span>{a.hostname ?? a.name}</span>
                {a.platform && <span className="text-[10px] text-muted-foreground">({a.platform})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   M365 CONNECTION ROW
   ═══════════════════════════════════════════════════════════ */

function Ms365ConnectionRow({ connection, tenantId, dateTime }: { connection: Record<string, unknown>; tenantId: string; dateTime: (d: Date | string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const connId = connection.id as string;

  const users = trpc.blackpoint.getMs365Users.useQuery(
    { connectionId: connId, tenantId, take: 50 },
    { retry: false, enabled: expanded }
  );
  const countries = trpc.blackpoint.getMs365ApprovedCountries.useQuery(
    { connectionId: connId, tenantId },
    { retry: false, enabled: expanded }
  );

  return (
    <div className={cn(expanded && "bg-accent/20")}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
          <Cloud className="h-4 w-4 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-medium text-foreground">M365 Connection</span>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{connId.substring(0, 16)}...</p>
        </div>
        <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">ITDR</Badge>
      </div>

      {expanded && (
        <div className="border-t border-border/30 bg-accent/20 px-8 py-4 space-y-4">
          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Approved Countries
            </span>
            {countries.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-1" />
            ) : Array.isArray(countries.data) && countries.data.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {countries.data.map((c: { code?: string; name?: string }, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    {c.name ?? c.code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-1">No country restrictions configured</p>
            )}
          </div>

          <div>
            <span className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
              <Users className="h-3 w-3" /> Monitored Users {users.data && `(${(users.data as { total?: number }).total ?? (users.data as { items?: unknown[] }).items?.length ?? 0})`}
            </span>
            {users.isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mt-1" />
            ) : users.data && (users.data as { items?: unknown[] }).items ? (
              <div className="mt-1.5 space-y-1 max-h-[300px] overflow-y-auto">
                {((users.data as { items?: Array<{ id: string; email: string; name: string; enabled: boolean; licensed: boolean }> }).items ?? []).slice(0, 30).map(u => (
                  <div key={u.id} className="flex items-center gap-2.5 py-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", u.enabled ? "bg-green-500" : "bg-zinc-500")} />
                    <span className="text-xs text-foreground">{u.name || u.email}</span>
                    {u.name && <span className="text-[10px] text-muted-foreground">{u.email}</span>}
                    {u.licensed && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Licensed</Badge>}
                    {!u.enabled && <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20">Disabled</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-1">No users found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function Stat({ label, value, sub, color, dot }: { label: string; value: number | string; sub?: string; color: string; dot?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5">
        {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
        <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      </div>
      <p className={cn("text-lg font-bold mt-1 leading-none", color)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap", className)}>{children}</span>;
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        className="w-full h-7 pl-8 pr-3 rounded-lg bg-accent border border-border text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-blue-500/50"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function DataList({ loading, error, empty, emptyIcon: Icon, emptyMsg, children }: {
  loading: boolean; error?: string; empty: boolean; emptyIcon: React.ElementType; emptyMsg: string; children: React.ReactNode;
}) {
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <AlertTriangle className="h-6 w-6 opacity-30 mb-2" />
      <p className="text-xs">Failed to load data</p>
      <p className="text-[10px] mt-1 text-red-400 max-w-md text-center">{friendlyError(error)}</p>
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-6 w-6 opacity-20 mb-2" />
      <p className="text-[11px]">{emptyMsg}</p>
    </div>
  );
  return <div className="divide-y divide-border/40">{children}</div>;
}
