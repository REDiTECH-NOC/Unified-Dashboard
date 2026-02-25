"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Shield,
  ShieldAlert,
  Mail,
  Monitor,
  Activity,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RefreshCw,
  Search,
  Unplug,
  ArrowLeft,
  Calendar,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/hooks/use-timezone";
import { AlertExpanded } from "./_components/alert-expanded";
import { ThreatDetailPanel } from "./_components/threat-detail-panel";
import { S1ManagementView } from "./_components/s1-management";

/* ─── TYPES ──────────────────────────────────────────────── */

interface UnifiedAlert {
  id: string;
  source: "sentinelone" | "blackpoint" | "ninjaone" | "avanan" | "uptime" | "cove";
  sourceLabel: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  severityScore: number;
  status: string;
  deviceHostname?: string;
  organizationName?: string;
  detectedAt: Date;
  /** S1-specific: file hash for VirusTotal link */
  fileHash?: string;
  /** S1-specific: classification (malicious, suspicious, etc.) */
  classification?: string;
  /** S1-specific: mitigation status */
  mitigationStatus?: string;
  /** Raw source ID for drill-down */
  sourceId: string;
}

interface AlertGroup {
  key: string;
  alerts: UnifiedAlert[];
  count: number;
  /** Highest-severity alert used for display */
  representative: UnifiedAlert;
  /** Unique hostnames across all alerts in the group */
  hostnames: string[];
  /** Earliest detection time */
  firstSeen: Date;
  /** Latest detection time */
  lastSeen: Date;
}

/* ─── TIME RANGE ────────────────────────────────────────── */

type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

const TIME_RANGE_OPTIONS: { id: TimeRange; label: string; shortLabel: string }[] = [
  { id: "24h", label: "Last 24 Hours", shortLabel: "24h" },
  { id: "7d", label: "Last 7 Days", shortLabel: "7d" },
  { id: "30d", label: "Last 30 Days", shortLabel: "30d" },
  { id: "90d", label: "Last 90 Days", shortLabel: "90d" },
  { id: "all", label: "All Time", shortLabel: "All" },
];

function getTimeRangeDate(range: TimeRange): Date | undefined {
  if (range === "all") return undefined;
  const now = new Date();
  switch (range) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
}

/* ─── SEVERITY HELPERS ───────────────────────────────────── */

const severityConfig = {
  critical: { label: "Critical", color: "text-red-500", bg: "bg-red-500", bgLight: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
  high:     { label: "High",     color: "text-orange-500", bg: "bg-orange-500", bgLight: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-500" },
  medium:   { label: "Medium",   color: "text-yellow-500", bg: "bg-yellow-500", bgLight: "bg-yellow-500/10", border: "border-yellow-500/30", dot: "bg-yellow-500" },
  low:      { label: "Low",      color: "text-blue-400", bg: "bg-blue-400", bgLight: "bg-blue-400/10", border: "border-blue-400/30", dot: "bg-blue-400" },
  informational: { label: "Info", color: "text-zinc-400", bg: "bg-zinc-400", bgLight: "bg-zinc-400/10", border: "border-zinc-400/30", dot: "bg-zinc-400" },
} as const;

type SeverityKey = keyof typeof severityConfig;

function SeverityBadge({ severity }: { severity: SeverityKey }) {
  const cfg = severityConfig[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", cfg.bgLight, cfg.color, cfg.border, "border")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

/* ─── PLATFORM CARD ──────────────────────────────────────── */

interface SeverityCount {
  label: string;
  count: number;
  severity: SeverityKey;
}

interface PlatformCardProps {
  name: string;
  icon: React.ElementType;
  iconColor: string;
  total: number;
  breakdowns: SeverityCount[];
  loading?: boolean;
  error?: boolean;
  notConnected?: boolean;
  onClick?: () => void;
  active?: boolean;
}

function PlatformCard({ name, icon: Icon, iconColor, total, breakdowns, loading, error, notConnected, onClick, active }: PlatformCardProps) {
  if (notConnected) {
    return (
      <div className="relative rounded-xl p-4 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden opacity-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Unplug className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Not Connected</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="relative rounded-xl p-4 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{name}</p>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative rounded-xl p-4 bg-card border border-red-500/20 shadow-card-light dark:shadow-card overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10">
            <Icon className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{name}</p>
            <p className="text-xs text-red-400 mt-0.5">Connection Error</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-xl p-4 bg-card border shadow-card-light dark:shadow-card overflow-hidden text-left w-full transition-all",
        active ? "border-red-500/50 ring-1 ring-red-500/20" : "border-border hover:border-muted-foreground/30"
      )}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/20 to-transparent" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{name}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{total}</p>
          </div>
        </div>
      </div>

      {/* Severity breakdown */}
      {breakdowns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {breakdowns.filter(b => b.count > 0).map((b) => {
            const cfg = severityConfig[b.severity];
            return (
              <div key={b.label} className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                <span className="text-[10px] text-muted-foreground">{b.label}</span>
                <span className={cn("text-[10px] font-semibold", cfg.color)}>{b.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Severity bar */}
      {total > 0 && breakdowns.some(b => b.count > 0) && (
        <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-accent">
          {breakdowns.filter(b => b.count > 0).map((b) => {
            const cfg = severityConfig[b.severity];
            const pct = (b.count / total) * 100;
            return (
              <div
                key={b.label}
                className={cn("h-full", cfg.bg)}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${b.count}`}
              />
            );
          })}
        </div>
      )}
    </button>
  );
}

/* ─── ALERT ROW ──────────────────────────────────────────── */

const sourceColors: Record<string, string> = {
  sentinelone: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  blackpoint: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  ninjaone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  avanan: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  uptime: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  cove: "text-teal-400 bg-teal-500/10 border-teal-500/20",
};

function AlertRow({ group, expanded, onToggle }: { group: AlertGroup; expanded: boolean; onToggle: () => void }) {
  const { dateTime } = useTimezone();
  const alert = group.representative;
  const cfg = severityConfig[alert.severity];

  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group",
        expanded ? "bg-accent/40" : "hover:bg-accent/50"
      )}
    >
      {/* Severity dot */}
      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{alert.title}</span>
          {/* Group count badge */}
          {group.count > 1 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
              {group.count}
            </span>
          )}
          <SeverityBadge severity={alert.severity} />
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", sourceColors[alert.source])}>
            {alert.sourceLabel}
          </span>
          {alert.mitigationStatus && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded border",
              alert.mitigationStatus === "mitigated" || alert.mitigationStatus === "resolved"
                ? "text-green-400 bg-green-500/10 border-green-500/20"
                : "text-red-400 bg-red-500/10 border-red-500/20"
            )}>
              {alert.mitigationStatus === "mitigated" || alert.mitigationStatus === "resolved" ? "Mitigated" : "Not Mitigated"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {/* Show unique hostnames for groups, single hostname otherwise */}
          {group.count > 1 ? (
            group.hostnames.length > 0 && (
              <span className="text-xs text-muted-foreground truncate">
                {group.hostnames.slice(0, 3).join(", ")}
                {group.hostnames.length > 3 && ` +${group.hostnames.length - 3} more`}
              </span>
            )
          ) : (
            alert.deviceHostname && (
              <span className="text-xs text-muted-foreground truncate">{alert.deviceHostname}</span>
            )
          )}
          {alert.organizationName && (
            <span className="text-[10px] text-muted-foreground">{alert.organizationName}</span>
          )}
          {group.count === 1 && alert.description && (
            <span className="text-[10px] text-muted-foreground truncate hidden lg:inline">{alert.description}</span>
          )}
        </div>
      </div>

      {/* File hash / VirusTotal */}
      {alert.fileHash && (
        <a
          href={`https://www.virustotal.com/gui/file/${alert.fileHash}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hidden md:flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors shrink-0"
          title="View on VirusTotal"
        >
          <ExternalLink className="h-3 w-3" />
          VT
        </a>
      )}

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
        {dateTime(group.lastSeen)}
      </span>

      {/* Expand/collapse indicator */}
      {expanded ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────── */

type SourceFilter = "all" | "sentinelone" | "blackpoint" | "ninjaone" | "uptime" | "cove";
type SeverityFilter = "all" | SeverityKey;

export default function AlertsPage() {
  const router = useRouter();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  // ─── S1 Integration State ───────────────────────────────
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [detailThreatId, setDetailThreatId] = useState<string | null>(null);
  const [showS1Management, setShowS1Management] = useState(false);

  // ─── Time Range Computation ──────────────────────────────
  const createdAfter = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);
  const timeRangeLabel = TIME_RANGE_OPTIONS.find((t) => t.id === timeRange)?.label ?? "Last 30 Days";

  // ─── Data Fetching ─────────────────────────────────────
  // Fetch active threats/alerts from each platform
  // Errors are expected when connectors aren't configured

  const s1Threats = trpc.edr.getThreats.useQuery(
    { pageSize: 100, createdAfter },
    { retry: false, refetchInterval: 60000 }
  );

  const bpDetections = trpc.blackpoint.getDetections.useQuery(
    { take: 100, since: createdAfter },
    { retry: false, refetchInterval: 60000 }
  );

  const ninjaAlerts = trpc.rmm.getAlerts.useQuery(
    { pageSize: 100, createdAfter },
    { retry: false, refetchInterval: 60000 }
  );

  const uptimeMonitors = trpc.uptime.list.useQuery(
    {},
    { retry: false, refetchInterval: 60000 }
  );

  const backupAlerts = trpc.backup.getAlerts.useQuery(
    undefined,
    { retry: false, refetchInterval: 120000 }
  );

  const utils = trpc.useUtils();

  // ─── Compute Platform Summaries ────────────────────────

  const s1Summary = useMemo(() => {
    if (!s1Threats.data?.data) return null;
    const threats = s1Threats.data.data;
    let malicious = 0, suspicious = 0, mitigated = 0, notMitigated = 0;
    for (const t of threats) {
      const raw = t._raw as { threatInfo?: { confidenceLevel?: string; mitigationStatus?: string } } | undefined;
      const conf = raw?.threatInfo?.confidenceLevel?.toLowerCase() ?? "";
      const mitStatus = raw?.threatInfo?.mitigationStatus?.toLowerCase() ?? "";

      if (conf === "malicious") malicious++;
      else if (conf === "suspicious") suspicious++;

      if (mitStatus === "mitigated" || t.status === "mitigated" || t.status === "resolved") mitigated++;
      else notMitigated++;
    }
    return {
      total: s1Threats.data.totalCount ?? threats.length,
      malicious,
      suspicious,
      mitigated,
      notMitigated,
    };
  }, [s1Threats.data]);

  const bpSummary = useMemo(() => {
    if (!bpDetections.data?.data) return null;
    const detections = bpDetections.data.data;
    let critical = 0, high = 0, medium = 0, low = 0;
    for (const d of detections) {
      switch (d.severity) {
        case "critical": critical++; break;
        case "high": high++; break;
        case "medium": medium++; break;
        case "low": low++; break;
      }
    }
    return {
      total: bpDetections.data.totalCount ?? detections.length,
      critical,
      high,
      medium,
      low,
    };
  }, [bpDetections.data]);

  const ninjaSummary = useMemo(() => {
    if (!ninjaAlerts.data?.data) return null;
    const alerts = ninjaAlerts.data.data;
    let critical = 0, high = 0, medium = 0, low = 0;
    for (const a of alerts) {
      switch (a.severity) {
        case "critical": critical++; break;
        case "high": high++; break;
        case "medium": medium++; break;
        case "low": low++; break;
      }
    }
    return {
      total: ninjaAlerts.data.totalCount ?? alerts.length,
      critical,
      high,
      medium,
      low,
    };
  }, [ninjaAlerts.data]);

  const uptimeSummary = useMemo(() => {
    if (!uptimeMonitors.data) return null;
    const monitors = uptimeMonitors.data;
    let down = 0, pending = 0, up = 0;
    for (const m of monitors) {
      if (!m.active) continue;
      if (m.status === "DOWN") down++;
      else if (m.status === "PENDING") pending++;
      else up++;
    }
    return { total: down + pending, down, pending, up, monitorCount: monitors.length };
  }, [uptimeMonitors.data]);

  const backupSummary = useMemo(() => {
    if (!backupAlerts.data) return null;
    const alerts = backupAlerts.data as { severity: string }[];
    let critical = 0, high = 0, medium = 0;
    for (const a of alerts) {
      switch (a.severity) {
        case "critical": critical++; break;
        case "high": high++; break;
        case "medium": medium++; break;
      }
    }
    return { total: alerts.length, critical, high, medium };
  }, [backupAlerts.data]);

  // ─── Build Unified Alert List ──────────────────────────

  const unifiedAlerts = useMemo(() => {
    const alerts: UnifiedAlert[] = [];

    // SentinelOne threats
    if (s1Threats.data?.data) {
      for (const t of s1Threats.data.data) {
        const raw = t._raw as { threatInfo?: { confidenceLevel?: string; mitigationStatus?: string; sha256?: string; sha1?: string; md5?: string } } | undefined;
        alerts.push({
          id: `s1-${t.sourceId}`,
          source: "sentinelone",
          sourceLabel: "SentinelOne",
          title: t.title,
          description: t.description,
          severity: t.severity,
          severityScore: t.severityScore,
          status: t.status,
          deviceHostname: t.deviceHostname,
          organizationName: t.organizationName,
          detectedAt: new Date(t.detectedAt),
          fileHash: t.indicators?.fileHash ?? raw?.threatInfo?.sha256,
          classification: raw?.threatInfo?.confidenceLevel,
          mitigationStatus: raw?.threatInfo?.mitigationStatus ?? t.status,
          sourceId: t.sourceId,
        });
      }
    }

    // Blackpoint detections
    if (bpDetections.data?.data) {
      for (const d of bpDetections.data.data) {
        alerts.push({
          id: `bp-${d.sourceId}`,
          source: "blackpoint",
          sourceLabel: "Blackpoint",
          title: d.title,
          description: d.description,
          severity: d.severity,
          severityScore: d.severityScore,
          status: d.status,
          deviceHostname: d.deviceHostname,
          organizationName: d.organizationName,
          detectedAt: new Date(d.detectedAt),
          sourceId: d.sourceId,
        });
      }
    }

    // NinjaRMM alerts
    if (ninjaAlerts.data?.data) {
      for (const a of ninjaAlerts.data.data) {
        alerts.push({
          id: `ninja-${a.sourceId}`,
          source: "ninjaone",
          sourceLabel: "NinjaRMM",
          title: a.title,
          description: a.message,
          severity: a.severity,
          severityScore: a.severityScore,
          status: a.status,
          deviceHostname: a.deviceHostname,
          organizationName: a.organizationName,
          detectedAt: new Date(a.createdAt),
          sourceId: a.sourceId,
        });
      }
    }

    // Uptime monitors (DOWN = critical, PENDING = medium)
    if (uptimeMonitors.data) {
      for (const m of uptimeMonitors.data) {
        if (!m.active) continue;
        if (m.status !== "DOWN" && m.status !== "PENDING") continue;
        const isDown = m.status === "DOWN";
        alerts.push({
          id: `uptime-${m.id}`,
          source: "uptime",
          sourceLabel: "Uptime",
          title: `${m.name} is ${isDown ? "DOWN" : "PENDING"}`,
          description: m.description || `${m.type} monitor${m.company ? ` — ${m.company.name}` : ""}`,
          severity: isDown ? "critical" : "medium",
          severityScore: isDown ? 90 : 50,
          status: m.status,
          organizationName: m.company?.name,
          detectedAt: new Date(m.lastStatusChange || m.lastCheckedAt || m.updatedAt),
          sourceId: m.id,
        });
      }
    }

    // Cove backup alerts (failed, overdue, warning)
    if (backupAlerts.data) {
      for (const a of backupAlerts.data as {
        sourceId: string; title: string; message?: string; severity: string;
        severityScore: number; status: string; deviceHostname?: string;
        organizationName?: string; createdAt: string | Date;
      }[]) {
        const sevMap: Record<string, SeverityKey> = { critical: "critical", high: "high", medium: "medium", low: "low" };
        alerts.push({
          id: `cove-${a.sourceId}`,
          source: "cove",
          sourceLabel: "Cove Backup",
          title: a.title,
          description: a.message,
          severity: sevMap[a.severity] ?? "medium",
          severityScore: (a.severityScore ?? 5) * 10,
          status: a.status,
          deviceHostname: a.deviceHostname,
          organizationName: a.organizationName,
          detectedAt: new Date(a.createdAt),
          sourceId: a.sourceId,
        });
      }
    }

    // Sort by severity score descending, then by date descending
    alerts.sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      return b.detectedAt.getTime() - a.detectedAt.getTime();
    });

    return alerts;
  }, [s1Threats.data, bpDetections.data, ninjaAlerts.data, uptimeMonitors.data, backupAlerts.data]);

  // ─── Filter Alerts ─────────────────────────────────────

  const filteredAlerts = useMemo(() => {
    let result = unifiedAlerts;

    if (sourceFilter !== "all") {
      result = result.filter((a) => a.source === sourceFilter);
    }
    if (severityFilter !== "all") {
      result = result.filter((a) => a.severity === severityFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.deviceHostname?.toLowerCase().includes(q) ||
          a.organizationName?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [unifiedAlerts, sourceFilter, severityFilter, searchQuery]);

  // ─── Group Alerts ───────────────────────────────────────

  const groupedAlerts = useMemo(() => {
    const groupMap: Record<string, UnifiedAlert[]> = {};
    for (const alert of filteredAlerts) {
      // Group by source + title (e.g., all "updater.exe" S1 alerts become one row)
      const key = `${alert.source}::${alert.title}`;
      if (groupMap[key]) {
        groupMap[key].push(alert);
      } else {
        groupMap[key] = [alert];
      }
    }

    const groups: AlertGroup[] = [];
    for (const key of Object.keys(groupMap)) {
      const groupAlerts = groupMap[key];
      // Sort within group: newest first
      groupAlerts.sort((a: UnifiedAlert, b: UnifiedAlert) => b.detectedAt.getTime() - a.detectedAt.getTime());
      const hostnameSet: Record<string, true> = {};
      for (const a of groupAlerts) {
        if (a.deviceHostname) hostnameSet[a.deviceHostname] = true;
      }
      const hostnames = Object.keys(hostnameSet);
      groups.push({
        key,
        alerts: groupAlerts,
        count: groupAlerts.length,
        representative: groupAlerts[0],
        hostnames,
        firstSeen: groupAlerts[groupAlerts.length - 1].detectedAt,
        lastSeen: groupAlerts[0].detectedAt,
      });
    }

    // Sort groups by highest severity score desc, then most recent alert desc
    groups.sort((a, b) => {
      if (b.representative.severityScore !== a.representative.severityScore)
        return b.representative.severityScore - a.representative.severityScore;
      return b.lastSeen.getTime() - a.lastSeen.getTime();
    });

    return groups;
  }, [filteredAlerts]);

  // ─── Loading / Connected States ────────────────────────

  const anyLoading = s1Threats.isLoading || bpDetections.isLoading || ninjaAlerts.isLoading || uptimeMonitors.isLoading || backupAlerts.isLoading;
  const totalAlerts = (s1Summary?.total ?? 0) + (bpSummary?.total ?? 0) + (ninjaSummary?.total ?? 0) + (uptimeSummary?.total ?? 0) + (backupSummary?.total ?? 0);

  function refreshAll() {
    utils.edr.getThreats.invalidate();
    utils.blackpoint.getDetections.invalidate();
    utils.rmm.getAlerts.invalidate();
    utils.uptime.list.invalidate();
    utils.backup.getAlerts.invalidate();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Alert Triage</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Unified alert queue from all security and monitoring tools
              {!anyLoading && <span className="ml-2 text-foreground font-medium">{totalAlerts} active</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
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
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent hover:bg-accent/80 text-foreground text-sm font-medium transition-colors border border-border"
          >
            <RefreshCw className={cn("h-4 w-4", anyLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Platform Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* SentinelOne */}
        <PlatformCard
          name="SentinelOne"
          icon={ShieldAlert}
          iconColor="bg-purple-500/10 text-purple-500"
          total={s1Summary?.total ?? 0}
          breakdowns={s1Summary ? [
            { label: "Malicious", count: s1Summary.malicious, severity: "critical" },
            { label: "Suspicious", count: s1Summary.suspicious, severity: "high" },
            { label: "Not Mitigated", count: s1Summary.notMitigated, severity: "medium" },
            { label: "Mitigated", count: s1Summary.mitigated, severity: "low" },
          ] : []}
          loading={s1Threats.isLoading}
          error={s1Threats.isError && !s1Threats.data}
          notConnected={s1Threats.isError && s1Threats.error?.message?.includes("No active")}
          onClick={() => {
            if (showS1Management) {
              setShowS1Management(false);
            } else {
              setShowS1Management(true);
              setExpandedGroupKey(null);
              setDetailThreatId(null);
            }
          }}
          active={showS1Management || sourceFilter === "sentinelone"}
        />

        {/* Blackpoint */}
        <PlatformCard
          name="Blackpoint"
          icon={Shield}
          iconColor="bg-blue-500/10 text-blue-500"
          total={bpSummary?.total ?? 0}
          breakdowns={bpSummary ? [
            { label: "Critical", count: bpSummary.critical, severity: "critical" },
            { label: "High", count: bpSummary.high, severity: "high" },
            { label: "Medium", count: bpSummary.medium, severity: "medium" },
            { label: "Low", count: bpSummary.low, severity: "low" },
          ] : []}
          loading={bpDetections.isLoading}
          error={bpDetections.isError && !bpDetections.data}
          notConnected={bpDetections.isError && bpDetections.error?.message?.includes("No active")}
          onClick={() => setSourceFilter(sourceFilter === "blackpoint" ? "all" : "blackpoint")}
          active={sourceFilter === "blackpoint"}
        />

        {/* NinjaRMM */}
        <PlatformCard
          name="NinjaRMM"
          icon={Monitor}
          iconColor="bg-emerald-500/10 text-emerald-500"
          total={ninjaSummary?.total ?? 0}
          breakdowns={ninjaSummary ? [
            { label: "Critical", count: ninjaSummary.critical, severity: "critical" },
            { label: "High", count: ninjaSummary.high, severity: "high" },
            { label: "Medium", count: ninjaSummary.medium, severity: "medium" },
            { label: "Low", count: ninjaSummary.low, severity: "low" },
          ] : []}
          loading={ninjaAlerts.isLoading}
          error={ninjaAlerts.isError && !ninjaAlerts.data}
          notConnected={ninjaAlerts.isError && ninjaAlerts.error?.message?.includes("No active")}
          onClick={() => setSourceFilter(sourceFilter === "ninjaone" ? "all" : "ninjaone")}
          active={sourceFilter === "ninjaone"}
        />

        {/* Uptime Monitors */}
        <PlatformCard
          name="Uptime Monitors"
          icon={Activity}
          iconColor="bg-rose-500/10 text-rose-500"
          total={uptimeSummary?.total ?? 0}
          breakdowns={uptimeSummary ? [
            { label: "Down", count: uptimeSummary.down, severity: "critical" },
            { label: "Pending", count: uptimeSummary.pending, severity: "medium" },
          ] : []}
          loading={uptimeMonitors.isLoading}
          error={uptimeMonitors.isError && !uptimeMonitors.data}
          onClick={() => router.push("/monitoring")}
        />

        {/* Cove Backups */}
        <PlatformCard
          name="Backups"
          icon={HardDrive}
          iconColor="bg-teal-500/10 text-teal-500"
          total={backupSummary?.total ?? 0}
          breakdowns={backupSummary ? [
            { label: "Failed", count: backupSummary.critical, severity: "critical" },
            { label: "Overdue", count: backupSummary.high, severity: "high" },
            { label: "Warning", count: backupSummary.medium, severity: "medium" },
          ] : []}
          loading={backupAlerts.isLoading}
          error={backupAlerts.isError && !backupAlerts.data && !backupAlerts.error?.message?.includes("not configured") && !backupAlerts.error?.message?.includes("No active")}
          notConnected={backupAlerts.isError && (backupAlerts.error?.message?.includes("not configured") || backupAlerts.error?.message?.includes("No active"))}
          onClick={() => setSourceFilter(sourceFilter === "cove" ? "all" : "cove")}
          active={sourceFilter === "cove"}
        />

        {/* Avanan — placeholder */}
        <PlatformCard
          name="Avanan"
          icon={Mail}
          iconColor="bg-amber-500/10 text-amber-500"
          total={0}
          breakdowns={[]}
          notConnected
        />
      </div>

      {/* S1 Management View — shown when S1 card is clicked */}
      {showS1Management ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowS1Management(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to All Alerts
            </button>
          </div>
          <S1ManagementView />
        </div>
      ) : (
        <>
          {/* Unified Alert Feed */}
          <div className="rounded-xl border border-border bg-card">
            {/* Feed Header */}
            <div className="px-4 py-3 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  All Alerts
                  <span className="ml-2 text-muted-foreground font-normal">
                    {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""} in {groupedAlerts.length} group{groupedAlerts.length !== 1 ? "s" : ""}
                    {" "}&middot; {timeRangeLabel}
                  </span>
                </h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFilters && "rotate-180")} />
                  Filters
                </button>
              </div>

              {/* Filter row */}
              {showFilters && (
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Search */}
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      className="w-full h-8 pl-8 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                      placeholder="Search alerts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Severity filter */}
                  <div className="flex gap-1">
                    {(["all", "critical", "high", "medium", "low"] as const).map((s) => {
                      const cfg = s === "all" ? null : severityConfig[s];
                      const isActive = severityFilter === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setSeverityFilter(s)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                            isActive && cfg ? `${cfg.border} ${cfg.bgLight} ${cfg.color}` :
                              isActive ? "border-red-500/50 bg-red-500/10 text-foreground" :
                                "border-border bg-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {s === "all" ? "All" : severityConfig[s].label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Clear filters */}
                  {(sourceFilter !== "all" || severityFilter !== "all" || searchQuery) && (
                    <button
                      onClick={() => { setSourceFilter("all"); setSeverityFilter("all"); setSearchQuery(""); }}
                      className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Alert List */}
            {anyLoading && unifiedAlerts.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle className="mb-3 h-10 w-10 opacity-30" />
                {unifiedAlerts.length === 0 ? (
                  <>
                    <p className="text-sm font-medium">No alerts</p>
                    <p className="text-xs mt-1">Connect security tools in Settings to start receiving alerts</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">No alerts match your filters</p>
                    <button
                      onClick={() => { setSourceFilter("all"); setSeverityFilter("all"); setSearchQuery(""); }}
                      className="text-xs mt-2 text-red-500 hover:underline"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {groupedAlerts.map((group) => (
                  <div key={group.key}>
                    <AlertRow
                      group={group}
                      expanded={expandedGroupKey === group.key}
                      onToggle={() => setExpandedGroupKey(expandedGroupKey === group.key ? null : group.key)}
                    />
                    {/* Inline expansion */}
                    {expandedGroupKey === group.key && (
                      <AlertExpanded
                        source={group.representative.source}
                        alerts={group.alerts}
                        onOpenDetail={(sourceId) => {
                          if (group.representative.source === "sentinelone") {
                            setDetailThreatId(sourceId);
                          }
                        }}
                        onClose={() => setExpandedGroupKey(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Threat Detail Side Panel */}
      {detailThreatId && (
        <ThreatDetailPanel
          threatId={detailThreatId}
          onClose={() => setDetailThreatId(null)}
        />
      )}
    </div>
  );
}
