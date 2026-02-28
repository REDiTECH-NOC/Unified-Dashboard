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
  Globe,
  ArrowUpDown,
  UserCheck,
  Ticket,
  EyeOff,
  Eye,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimezone } from "@/hooks/use-timezone";
import { usePermissions } from "@/hooks/use-permissions";
import { AlertExpanded } from "./_components/alert-expanded";
import { ThreatDetailPanel } from "./_components/threat-detail-panel";
import { S1ManagementView } from "./_components/s1-management";
import { AvananManagementView } from "./_components/avanan-management";
import { BlackpointManagementView } from "./_components/bp-management";
import { DnsManagementView } from "./_components/dns-management";
import { AlertActionBar } from "./_components/alert-action-bar";
import { CreateTicketPanel } from "./_components/create-ticket-panel";

/* ─── TYPES ──────────────────────────────────────────────── */

type SourceKey = "sentinelone" | "blackpoint" | "ninjaone" | "uptime" | "cove" | "dropsuite" | "dnsfilter";
const ALL_SOURCES: SourceKey[] = ["sentinelone", "blackpoint", "ninjaone", "uptime", "cove", "dropsuite", "dnsfilter"];
const SOURCE_LABELS: Record<SourceKey, string> = {
  sentinelone: "S1", blackpoint: "BP", ninjaone: "Ninja", uptime: "Uptime", cove: "Cove", dropsuite: "DropSuite", dnsfilter: "DNS",
};

interface UnifiedAlert {
  id: string;
  source: "sentinelone" | "blackpoint" | "ninjaone" | "avanan" | "uptime" | "cove" | "dropsuite";
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
  /** Merged alert: both sources that contributed */
  mergedSources?: Array<{ source: string; sourceId: string; sourceLabel: string }>;
  /** Blackpoint enrichment for merged alerts */
  bpRaw?: Record<string, unknown>;
  bpSourceId?: string;
  bpRiskScore?: number;
  bpTicketStatus?: string;
  bpOrganizationSourceId?: string;
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
  errorMessage?: string;
  notConnected?: boolean;
  onClick?: () => void;
  active?: boolean;
}

function PlatformCard({ name, icon: Icon, iconColor, total, breakdowns, loading, error, errorMessage, notConnected, onClick, active }: PlatformCardProps) {
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
            <p className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]" title={errorMessage || "Connection Error"}>
              {errorMessage ? errorMessage.replace(/^\[.*?\]\s*/, "").substring(0, 40) : "Connection Error"}
            </p>
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
  dropsuite: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  dnsfilter: "text-violet-400 bg-violet-500/10 border-violet-500/20",
};

interface AlertRowProps {
  group: AlertGroup;
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  alertState?: {
    closed?: boolean;
    closeNote?: string | null;
    owner?: { id: string; name: string | null; avatar: string | null } | null;
    linkedTicketId?: string | null;
    linkedTicketSummary?: string | null;
  };
}

function AlertRow({ group, expanded, onToggle, selected, onSelect, alertState }: AlertRowProps) {
  const { dateTime } = useTimezone();
  const alert = group.representative;
  const cfg = severityConfig[alert.severity];
  const isClosed = alertState?.closed;

  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group cursor-pointer",
        expanded ? "bg-accent/40" : "hover:bg-accent/50",
        selected && "bg-primary/5 border-l-2 border-l-primary",
        isClosed && "opacity-50"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(e); }}
        className="shrink-0 flex items-center justify-center w-5 h-5 rounded transition-colors"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
        )}
      </button>

      {/* Severity dot */}
      <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-medium text-foreground truncate", isClosed && "line-through")}>{alert.title}</span>
          {/* Group count badge */}
          {group.count > 1 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
              {group.count}
            </span>
          )}
          <SeverityBadge severity={alert.severity} />
          {alert.mergedSources ? (
            <span className="inline-flex items-center gap-0.5">
              {alert.mergedSources.map(ms => (
                <span key={ms.source} className={cn("text-[10px] px-1.5 py-0.5 rounded border", sourceColors[ms.source])}>
                  {ms.source === "sentinelone" ? "S1" : ms.source === "blackpoint" ? "BP" : ms.sourceLabel}
                </span>
              ))}
            </span>
          ) : (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", sourceColors[alert.source])}>
              {alert.sourceLabel}
            </span>
          )}
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
          {/* Closed badge */}
          {isClosed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-500/30 bg-zinc-500/10 text-zinc-400">
              Closed
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

      {/* Owner avatar */}
      {alertState?.owner && (
        <div
          className="shrink-0 flex items-center gap-1"
          title={`Assigned to ${alertState.owner.name || "Unknown"}`}
        >
          {alertState.owner.avatar ? (
            <img src={alertState.owner.avatar} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-blue-500/20 flex items-center justify-center">
              <UserCheck className="h-3 w-3 text-blue-400" />
            </div>
          )}
          <span className="text-[10px] text-blue-400 hidden lg:inline">
            {alertState.owner.name?.split(" ")[0]}
          </span>
        </div>
      )}

      {/* Linked ticket badge */}
      {alertState?.linkedTicketId && (
        <span
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary/20 bg-primary/5 text-[10px] text-primary font-mono"
          title={alertState.linkedTicketSummary || `Ticket #${alertState.linkedTicketId}`}
        >
          <Ticket className="h-3 w-3" />
          #{alertState.linkedTicketId}
        </span>
      )}

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
    </div>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────── */

type SeverityFilter = "all" | SeverityKey;
type SortMode = "severity" | "newest";

/* ─── Source → Permission Mapping ──────────────────────── */

const SOURCE_PERMISSION_MAP: Record<SourceKey, string> = {
  sentinelone: "alerts.sentinelone.view",
  blackpoint: "alerts.blackpoint.view",
  ninjaone: "alerts.ninjaone.view",
  uptime: "alerts.view",           // uptime uses the parent alerts permission
  cove: "alerts.cove.view",
  dropsuite: "alerts.cove.view",   // dropsuite alerts are backup alerts, same permission
  dnsfilter: "alerts.dnsfilter.view",
};

export default function AlertsPage() {
  const router = useRouter();
  const { has, isLoading: permsLoading } = usePermissions();

  // Filter visible sources based on permissions
  const visibleSources = useMemo(() => {
    if (permsLoading) return ALL_SOURCES; // Show all while loading to avoid flash
    return ALL_SOURCES.filter((s) => has(SOURCE_PERMISSION_MAP[s]));
  }, [permsLoading, has]);

  const [activeSources, setActiveSources] = useState<Set<SourceKey>>(new Set(ALL_SOURCES));
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Sync active sources when permissions finish loading
  const [permsSynced, setPermsSynced] = useState(false);
  if (!permsLoading && !permsSynced) {
    setActiveSources(new Set(visibleSources));
    setPermsSynced(true);
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [sortMode, setSortMode] = useState<SortMode>("severity");

  // ─── S1 / Avanan Integration State ──────────────────────
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [detailThreatId, setDetailThreatId] = useState<string | null>(null);
  const [showS1Management, setShowS1Management] = useState(false);
  const [showAvananManagement, setShowAvananManagement] = useState(false);
  const [showBpManagement, setShowBpManagement] = useState(false);
  const [showDnsManagement, setShowDnsManagement] = useState(false);

  // ─── Multi-Select & Alert State ─────────────────────────────
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [createTicketAlerts, setCreateTicketAlerts] = useState<UnifiedAlert[]>([]);

  // ─── Source Filter Helpers ─────────────────────────────────
  const allSourcesActive = activeSources.size === visibleSources.length || activeSources.size === 0;

  function toggleSource(source: SourceKey) {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
        if (next.size === 0) return new Set(visibleSources);
      } else {
        next.add(source);
      }
      return next;
    });
  }

  function setOnlySource(source: SourceKey) {
    if (activeSources.size === 1 && activeSources.has(source)) {
      setActiveSources(new Set(visibleSources));
    } else {
      setActiveSources(new Set([source]));
    }
  }

  // ─── Time Range Computation ──────────────────────────────
  const createdAfter = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);
  const timeRangeLabel = TIME_RANGE_OPTIONS.find((t) => t.id === timeRange)?.label ?? "Last 30 Days";

  // ─── Data Fetching ─────────────────────────────────────
  // Fetch active threats/alerts from each platform
  // Errors are expected when connectors aren't configured

  // staleTime on all queries: React Query returns cached data instantly on re-navigation,
  // then refreshes in the background. Cards never show spinners on subsequent visits.
  const s1Threats = trpc.edr.getThreats.useQuery(
    { pageSize: 100, status: "unresolved" },
    { retry: false, refetchInterval: 60000, staleTime: 5 * 60_000 }
  );

  const bpDetections = trpc.blackpoint.getDetections.useQuery(
    { take: 100, since: createdAfter },
    { retry: false, refetchInterval: 60000, staleTime: 5 * 60_000 }
  );

  const ninjaAlerts = trpc.rmm.getAlerts.useQuery(
    { pageSize: 100, createdAfter },
    { retry: false, refetchInterval: 60000, staleTime: 5 * 60_000 }
  );

  const uptimeMonitors = trpc.uptime.list.useQuery(
    {},
    { retry: false, refetchInterval: 60000, staleTime: 5 * 60_000 }
  );

  const backupAlerts = trpc.backup.getAlerts.useQuery(
    undefined,
    { retry: false, refetchInterval: 120000, staleTime: 5 * 60_000 }
  );

  const dsBackupAlerts = trpc.saasBackup.getAlerts.useQuery(
    undefined,
    { retry: false, refetchInterval: 120000, staleTime: 5 * 60_000 }
  );

  const avananTenants = trpc.emailSecurity.listTenants.useQuery(undefined, {
    retry: false,
    refetchInterval: 300000,
    staleTime: 10 * 60_000,
  });

  const avananEventStats = trpc.emailSecurity.getEventStats.useQuery(
    { days: 30 },
    {
      retry: 1,
      refetchInterval: 600000, // 10 min — server handles staleness
      staleTime: 10 * 60_000,  // Don't refetch for 10 min (server caches 30 min)
    }
  );

  const dnsFilterThreats = trpc.dnsFilter.getThreatSummary.useQuery(
    { from: createdAfter },
    { retry: false, refetchInterval: 60000, staleTime: 5 * 60_000 }
  );

  const utils = trpc.useUtils();

  // ─── Alert States (overlay: ownership, closed, tickets) ────
  // We can't query until we have alert IDs, so this runs after unifiedAlerts are computed.
  // This is declared here but actually populated after unifiedAlerts memo below.
  // We use a ref pattern: fetch is triggered by the alertIds memo.

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
    const coveData = (backupAlerts.data ?? []) as { severity: string }[];
    const dsData = (dsBackupAlerts.data ?? []) as { severity: string }[];
    if (coveData.length === 0 && dsData.length === 0 && !backupAlerts.data && !dsBackupAlerts.data) return null;

    let coveCritical = 0, coveHigh = 0, coveMedium = 0;
    for (const a of coveData) {
      if (a.severity === "critical") coveCritical++;
      else if (a.severity === "high") coveHigh++;
      else if (a.severity === "medium") coveMedium++;
    }
    let dsCritical = 0, dsHigh = 0, dsMedium = 0;
    for (const a of dsData) {
      if (a.severity === "critical") dsCritical++;
      else if (a.severity === "high") dsHigh++;
      else if (a.severity === "medium") dsMedium++;
    }
    return {
      total: coveData.length + dsData.length,
      critical: coveCritical + dsCritical,
      high: coveHigh + dsHigh,
      medium: coveMedium + dsMedium,
      coveTotal: coveData.length,
      dsTotal: dsData.length,
      coveCritical, coveHigh, coveMedium,
      dsCritical, dsHigh, dsMedium,
    };
  }, [backupAlerts.data, dsBackupAlerts.data]);

  const avananSummary = useMemo(() => {
    if (!avananTenants.data) return null;
    let active = 0, expired = 0, totalUsers = 0;
    for (const t of avananTenants.data) {
      if (t.isDeleted) continue;
      const statusCode = t.status?.toLowerCase() ?? "";
      if (statusCode === "success") active++;
      else expired++;
      totalUsers += t.users ?? 0;
    }
    const hasEventStats = !!avananEventStats.data;
    const eventTotal = avananEventStats.data?.total ?? 0;
    const phishing = avananEventStats.data?.byType?.phishing ?? 0;
    const spam = avananEventStats.data?.byType?.spam ?? 0;
    const malware = avananEventStats.data?.byType?.malware ?? 0;
    // Show event total when available, otherwise show tenant count
    return { total: hasEventStats ? eventTotal : active, active, expired, totalUsers, phishing, spam, malware };
  }, [avananTenants.data, avananEventStats.data]);

  const dnsFilterSummary = useMemo(() => {
    if (!dnsFilterThreats.data) return null;
    const d = dnsFilterThreats.data;
    return {
      total: d.total,
      critical: d.critical,
      high: d.high,
      medium: d.medium,
      low: d.low,
    };
  }, [dnsFilterThreats.data]);

  // ─── Build Unified Alert List ──────────────────────────

  const unifiedAlerts = useMemo(() => {
    const alerts: UnifiedAlert[] = [];

    // ── Step 1: Build S1 alerts + hostname lookup for merge ──
    const s1Alerts: UnifiedAlert[] = [];
    const s1ByHostname = new Map<string, { alert: UnifiedAlert; index: number }[]>();

    if (s1Threats.data?.data) {
      for (const t of s1Threats.data.data) {
        const raw = t._raw as { threatInfo?: { confidenceLevel?: string; mitigationStatus?: string; sha256?: string; sha1?: string; md5?: string } } | undefined;
        const s1Alert: UnifiedAlert = {
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
        };
        const idx = s1Alerts.length;
        s1Alerts.push(s1Alert);

        if (t.deviceHostname) {
          const key = t.deviceHostname.toLowerCase();
          if (!s1ByHostname.has(key)) s1ByHostname.set(key, []);
          s1ByHostname.get(key)!.push({ alert: s1Alert, index: idx });
        }
      }
    }

    // ── Step 2: Build BP alerts, merging with S1 where applicable ──
    const mergedS1Indices = new Set<number>();

    if (bpDetections.data?.data) {
      for (const d of bpDetections.data.data) {
        const bpRaw = d._raw as Record<string, unknown> | undefined;
        const alertTypes = (bpRaw?.alertTypes as string[]) ?? [];
        const isSentinelOne = alertTypes.some(t => t.toUpperCase().includes("SENTINELONE"));

        if (isSentinelOne && d.deviceHostname) {
          const key = d.deviceHostname.toLowerCase();
          const candidates = s1ByHostname.get(key);

          if (candidates && candidates.length > 0) {
            // Find closest-in-time unmerged S1 alert on same hostname
            const bpTime = new Date(d.detectedAt).getTime();
            let bestMatch: { alert: UnifiedAlert; index: number } | null = null;
            let bestTimeDiff = Infinity;

            for (const c of candidates) {
              if (mergedS1Indices.has(c.index)) continue;
              const diff = Math.abs(c.alert.detectedAt.getTime() - bpTime);
              if (diff < bestTimeDiff) {
                bestTimeDiff = diff;
                bestMatch = c;
              }
            }

            if (bestMatch) {
              mergedS1Indices.add(bestMatch.index);
              const s1a = bestMatch.alert;
              const higherScore = Math.max(s1a.severityScore, d.severityScore);
              const higherSeverity = higherScore === s1a.severityScore ? s1a.severity : d.severity;
              const ticketStatus = (bpRaw?.ticket as Record<string, unknown> | undefined)?.status as string | undefined;

              alerts.push({
                ...s1a,
                id: `merged-${s1a.sourceId}-${d.sourceId}`,
                severity: higherSeverity,
                severityScore: higherScore,
                mergedSources: [
                  { source: "sentinelone", sourceId: s1a.sourceId, sourceLabel: "SentinelOne" },
                  { source: "blackpoint", sourceId: d.sourceId, sourceLabel: "Blackpoint" },
                ],
                bpRaw: bpRaw ?? undefined,
                bpSourceId: d.sourceId,
                bpRiskScore: (bpRaw?.riskScore as number) ?? d.severityScore * 10,
                bpTicketStatus: ticketStatus,
                bpOrganizationSourceId: d.organizationSourceId ?? (bpRaw?.customerId as string),
              });
              continue;
            }
          }
        }

        // No merge — standalone BP alert (pass bpRaw for detail view)
        const ticketStatus = (bpRaw?.ticket as Record<string, unknown> | undefined)?.status as string | undefined;
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
          bpRaw: bpRaw ?? undefined,
          bpRiskScore: (bpRaw?.riskScore as number) ?? d.severityScore * 10,
          bpTicketStatus: ticketStatus,
          bpOrganizationSourceId: d.organizationSourceId ?? (bpRaw?.customerId as string),
        });
      }
    }

    // ── Step 3: Add non-merged S1 alerts ──
    for (let i = 0; i < s1Alerts.length; i++) {
      if (!mergedS1Indices.has(i)) {
        alerts.push(s1Alerts[i]);
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

    // Uptime monitors (DOWN = critical, WARNING = medium)
    if (uptimeMonitors.data) {
      for (const m of uptimeMonitors.data) {
        if (!m.active) continue;
        if (m.status !== "DOWN" && m.status !== "WARNING") continue;
        const isDown = m.status === "DOWN";
        alerts.push({
          id: `uptime-${m.id}`,
          source: "uptime",
          sourceLabel: "Uptime",
          title: `${m.name} is ${isDown ? "DOWN" : "WARNING"}`,
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

    // Dropsuite SaaS backup alerts (failed, overdue, warning, never_ran)
    if (dsBackupAlerts.data) {
      for (const a of dsBackupAlerts.data as {
        sourceId: string; title: string; message?: string; severity: string;
        severityScore: number; status: string; deviceHostname?: string;
        organizationName?: string; createdAt: string | Date;
      }[]) {
        const sevMap: Record<string, SeverityKey> = { critical: "critical", high: "high", medium: "medium", low: "low" };
        alerts.push({
          id: `ds-${a.sourceId}`,
          source: "dropsuite",
          sourceLabel: "DropSuite",
          title: a.title,
          description: a.message,
          severity: sevMap[a.severity] ?? "medium",
          severityScore: (a.severityScore ?? 5) * 10,
          status: a.status ?? "new",
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
  }, [s1Threats.data, bpDetections.data, ninjaAlerts.data, uptimeMonitors.data, backupAlerts.data, dsBackupAlerts.data]);

  // ─── Alert State Overlay ─────────────────────────────────
  const allAlertIds = useMemo(() => unifiedAlerts.map((a) => a.id), [unifiedAlerts]);

  const alertStatesQuery = trpc.alertAction.getStates.useQuery(
    { alertIds: allAlertIds },
    { enabled: allAlertIds.length > 0, staleTime: 30_000 }
  );
  const alertStates = alertStatesQuery.data ?? {};

  // Count closed alerts per source for platform card adjustments
  const closedBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [, state] of Object.entries(alertStates)) {
      if (state.closed) {
        counts[state.source] = (counts[state.source] ?? 0) + 1;
      }
    }
    return counts;
  }, [alertStates]);

  // ─── Filter Alerts ─────────────────────────────────────

  const filteredAlerts = useMemo(() => {
    let result = unifiedAlerts;

    // Filter out closed alerts unless toggled on
    if (!showClosed) {
      result = result.filter((a) => !alertStates[a.id]?.closed);
    }

    if (!allSourcesActive) {
      result = result.filter((a) => {
        if (a.mergedSources) {
          return a.mergedSources.some(ms => activeSources.has(ms.source as SourceKey));
        }
        return activeSources.has(a.source as SourceKey);
      });
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
  }, [unifiedAlerts, alertStates, showClosed, allSourcesActive, activeSources, severityFilter, searchQuery]);

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

    // Sort groups based on selected sort mode
    if (sortMode === "newest") {
      // Pure chronological: newest alerts first
      groups.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
    } else {
      // Default: severity first, then most recent
      groups.sort((a, b) => {
        if (b.representative.severityScore !== a.representative.severityScore)
          return b.representative.severityScore - a.representative.severityScore;
        return b.lastSeen.getTime() - a.lastSeen.getTime();
      });
    }

    return groups;
  }, [filteredAlerts, sortMode]);

  // ─── Loading / Connected States ────────────────────────

  const anyLoading = s1Threats.isLoading || bpDetections.isLoading || ninjaAlerts.isLoading || uptimeMonitors.isLoading || backupAlerts.isLoading || dnsFilterThreats.isLoading;
  const totalClosedCount = Object.values(closedBySource).reduce((sum, c) => sum + c, 0);
  const totalAlerts = Math.max(0, (s1Summary?.total ?? 0) + (bpSummary?.total ?? 0) + (ninjaSummary?.total ?? 0) + (uptimeSummary?.total ?? 0) + (backupSummary?.total ?? 0) + (dnsFilterSummary?.total ?? 0) - totalClosedCount);

  function refreshAll() {
    utils.edr.getThreats.invalidate();
    utils.blackpoint.getDetections.invalidate();
    utils.rmm.getAlerts.invalidate();
    utils.uptime.list.invalidate();
    utils.backup.getAlerts.invalidate();
    utils.emailSecurity.listTenants.invalidate();
    utils.emailSecurity.getEventStats.invalidate();
    utils.dnsFilter.getThreatSummary.invalidate();
    utils.alertAction.getStates.invalidate();
  }

  // ─── Multi-Select Helpers ───────────────────────────────
  function toggleAlertSelection(alertId: string) {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(alertId)) next.delete(alertId);
      else next.add(alertId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedAlertIds.size === filteredAlerts.length) {
      setSelectedAlertIds(new Set());
    } else {
      setSelectedAlertIds(new Set(filteredAlerts.map((a) => a.id)));
    }
  }

  const closedCount = useMemo(() => {
    return Object.values(alertStates).filter((s) => s.closed).length;
  }, [alertStates]);

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        {/* SentinelOne */}
        {has("alerts.sentinelone.view") && <PlatformCard
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
          notConnected={s1Threats.isError && (s1Threats.error?.message?.includes("No active") || s1Threats.error?.message?.includes("not configured"))}
          onClick={() => {
            if (showS1Management) {
              setShowS1Management(false);
            } else {
              setShowS1Management(true);
              setShowAvananManagement(false);
              setShowBpManagement(false);
              setShowDnsManagement(false);
              setExpandedGroupKey(null);
              setDetailThreatId(null);
            }
          }}
          active={showS1Management || (activeSources.size === 1 && activeSources.has("sentinelone"))}
        />}

        {/* Blackpoint */}
        {has("alerts.blackpoint.view") && <PlatformCard
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
          errorMessage={bpDetections.error?.message}
          notConnected={bpDetections.isError && (bpDetections.error?.message?.includes("No active") || bpDetections.error?.message?.includes("not configured"))}
          onClick={() => {
            if (showBpManagement) {
              setShowBpManagement(false);
            } else {
              setShowBpManagement(true);
              setShowS1Management(false);
              setShowAvananManagement(false);
              setShowDnsManagement(false);
              setExpandedGroupKey(null);
              setDetailThreatId(null);
            }
          }}
          active={showBpManagement}
        />}

        {/* NinjaRMM */}
        {has("alerts.ninjaone.view") && <PlatformCard
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
          notConnected={ninjaAlerts.isError && (ninjaAlerts.error?.message?.includes("No active") || ninjaAlerts.error?.message?.includes("not configured"))}
          onClick={() => setOnlySource("ninjaone")}
          active={activeSources.size === 1 && activeSources.has("ninjaone")}
        />}

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

        {/* Backups (Cove + Dropsuite) — split card */}
        {(has("alerts.cove.view") || has("backups.cove.view") || has("backups.dropsuite.view")) && (() => {
          const bkLoading = backupAlerts.isLoading && dsBackupAlerts.isLoading;
          const bkBothError = backupAlerts.isError && dsBackupAlerts.isError && !backupAlerts.data && !dsBackupAlerts.data;
          const bkNotConn = bkBothError && (backupAlerts.error?.message?.includes("not configured") || backupAlerts.error?.message?.includes("No active")) && (dsBackupAlerts.error?.message?.includes("not configured") || dsBackupAlerts.error?.message?.includes("No active"));
          const bkActive = (activeSources.has("cove") || activeSources.has("dropsuite")) && activeSources.size <= 2 && !activeSources.has("sentinelone");

          if (bkNotConn) return (
            <div className="relative rounded-xl p-4 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden opacity-50">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent"><HardDrive className="h-5 w-5 text-muted-foreground" /></div>
                <div><p className="text-xs text-muted-foreground">Backups</p><div className="flex items-center gap-1.5 mt-0.5"><Unplug className="h-3 w-3 text-muted-foreground" /><p className="text-xs text-muted-foreground">Not Connected</p></div></div>
              </div>
            </div>
          );

          if (bkLoading) return (
            <div className="relative rounded-xl p-4 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/10"><HardDrive className="h-5 w-5 text-teal-500" /></div>
                <div><p className="text-xs text-muted-foreground">Backups</p><Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" /></div>
              </div>
            </div>
          );

          const coveN = backupSummary?.coveTotal ?? 0;
          const dsN = backupSummary?.dsTotal ?? 0;
          const totalN = backupSummary?.total ?? 0;

          return (
            <button
              onClick={() => {
                const both = activeSources.has("cove") && activeSources.has("dropsuite") && activeSources.size === 2;
                setActiveSources(both ? new Set(ALL_SOURCES) : new Set(["cove", "dropsuite"]));
              }}
              className={cn(
                "relative rounded-xl p-4 bg-card border shadow-card-light dark:shadow-card overflow-hidden text-left w-full transition-all",
                bkActive ? "border-red-500/50 ring-1 ring-red-500/20" : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-teal-500/20 via-cyan-500/20 to-transparent" />

              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/10"><HardDrive className="h-5 w-5 text-teal-500" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Backups</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">{totalN}</p>
                </div>
              </div>

              {/* Two-column: Cove | Dropsuite */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span className="text-[10px] font-semibold text-teal-400">Cove</span>
                    <span className="text-[10px] font-bold text-foreground ml-auto">{coveN}</span>
                  </div>
                  {backupSummary && coveN > 0 && (
                    <div className="space-y-0.5 pl-3">
                      {backupSummary.coveCritical > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" /><span className="text-[9px] text-muted-foreground">Failed</span><span className="text-[9px] font-semibold text-red-500 ml-auto">{backupSummary.coveCritical}</span></div>}
                      {backupSummary.coveHigh > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-500" /><span className="text-[9px] text-muted-foreground">Overdue</span><span className="text-[9px] font-semibold text-orange-500 ml-auto">{backupSummary.coveHigh}</span></div>}
                      {backupSummary.coveMedium > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-yellow-500" /><span className="text-[9px] text-muted-foreground">Warning</span><span className="text-[9px] font-semibold text-yellow-500 ml-auto">{backupSummary.coveMedium}</span></div>}
                    </div>
                  )}
                  {backupAlerts.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-3" />}
                </div>

                <div className="space-y-1.5 border-l border-border/50 pl-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-semibold text-cyan-400">DropSuite</span>
                    <span className="text-[10px] font-bold text-foreground ml-auto">{dsN}</span>
                  </div>
                  {backupSummary && dsN > 0 && (
                    <div className="space-y-0.5 pl-3">
                      {backupSummary.dsCritical > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500" /><span className="text-[9px] text-muted-foreground">Failed</span><span className="text-[9px] font-semibold text-red-500 ml-auto">{backupSummary.dsCritical}</span></div>}
                      {backupSummary.dsHigh > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-orange-500" /><span className="text-[9px] text-muted-foreground">Overdue</span><span className="text-[9px] font-semibold text-orange-500 ml-auto">{backupSummary.dsHigh}</span></div>}
                      {backupSummary.dsMedium > 0 && <div className="flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-yellow-500" /><span className="text-[9px] text-muted-foreground">Warning</span><span className="text-[9px] font-semibold text-yellow-500 ml-auto">{backupSummary.dsMedium}</span></div>}
                    </div>
                  )}
                  {dsBackupAlerts.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-3" />}
                </div>
              </div>

              {totalN > 0 && (
                <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-accent">
                  {((backupSummary?.coveCritical ?? 0) + (backupSummary?.dsCritical ?? 0)) > 0 && <div className="h-full bg-red-500" style={{ width: `${(((backupSummary?.coveCritical ?? 0) + (backupSummary?.dsCritical ?? 0)) / totalN) * 100}%` }} />}
                  {((backupSummary?.coveHigh ?? 0) + (backupSummary?.dsHigh ?? 0)) > 0 && <div className="h-full bg-orange-500" style={{ width: `${(((backupSummary?.coveHigh ?? 0) + (backupSummary?.dsHigh ?? 0)) / totalN) * 100}%` }} />}
                  {((backupSummary?.coveMedium ?? 0) + (backupSummary?.dsMedium ?? 0)) > 0 && <div className="h-full bg-yellow-500" style={{ width: `${(((backupSummary?.coveMedium ?? 0) + (backupSummary?.dsMedium ?? 0)) / totalN) * 100}%` }} />}
                </div>
              )}
            </button>
          );
        })()}

        {/* Avanan / Check Point Harmony Email */}
        {has("alerts.avanan.view") && <PlatformCard
          name="Avanan"
          icon={Mail}
          iconColor="bg-amber-500/10 text-amber-500"
          total={avananSummary?.total ?? 0}
          breakdowns={avananSummary ? (
            avananSummary.phishing || avananSummary.spam || avananSummary.malware
              ? [
                  { label: "Phishing", count: avananSummary.phishing, severity: "critical" as const },
                  { label: "Malware", count: avananSummary.malware, severity: "high" as const },
                  { label: "Spam", count: avananSummary.spam, severity: "medium" as const },
                ]
              : [
                  { label: "Active Tenants", count: avananSummary.active, severity: "low" as const },
                  { label: "Expired", count: avananSummary.expired, severity: "critical" as const },
                ]
          ) : []}
          loading={avananTenants.isLoading}
          error={avananTenants.isError && !avananTenants.data}
          notConnected={avananTenants.isError && (avananTenants.error?.message?.includes("No active") || avananTenants.error?.message?.includes("not configured"))}
          onClick={() => {
            if (showAvananManagement) {
              setShowAvananManagement(false);
            } else {
              setShowAvananManagement(true);
              setShowS1Management(false);
              setShowBpManagement(false);
              setShowDnsManagement(false);
              setExpandedGroupKey(null);
              setDetailThreatId(null);
            }
          }}
          active={showAvananManagement}
        />}

        {/* DNS Filter */}
        {has("alerts.dnsfilter.view") && <PlatformCard
          name="DNS Filter"
          icon={Globe}
          iconColor="bg-violet-500/10 text-violet-500"
          total={dnsFilterSummary?.total ?? 0}
          breakdowns={dnsFilterSummary ? [
            { label: "Critical", count: dnsFilterSummary.critical, severity: "critical" },
            { label: "High", count: dnsFilterSummary.high, severity: "high" },
            { label: "Medium", count: dnsFilterSummary.medium, severity: "medium" },
            { label: "Low", count: dnsFilterSummary.low, severity: "low" },
          ] : []}
          loading={dnsFilterThreats.isLoading}
          error={dnsFilterThreats.isError && !dnsFilterThreats.data && !dnsFilterThreats.error?.message?.includes("not configured") && !dnsFilterThreats.error?.message?.includes("No active")}
          notConnected={dnsFilterThreats.isError && (dnsFilterThreats.error?.message?.includes("not configured") || dnsFilterThreats.error?.message?.includes("No active"))}
          onClick={() => {
            if (showDnsManagement) {
              setShowDnsManagement(false);
            } else {
              setShowDnsManagement(true);
              setShowS1Management(false);
              setShowAvananManagement(false);
              setShowBpManagement(false);
              setExpandedGroupKey(null);
              setDetailThreatId(null);
            }
          }}
          active={showDnsManagement}
        />}
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
      ) : showBpManagement ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBpManagement(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to All Alerts
            </button>
          </div>
          <BlackpointManagementView />
        </div>
      ) : showAvananManagement ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAvananManagement(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to All Alerts
            </button>
          </div>
          <AvananManagementView />
        </div>
      ) : showDnsManagement ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDnsManagement(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to All Alerts
            </button>
          </div>
          <DnsManagementView />
        </div>
      ) : (
        <>
          {/* Unified Alert Feed */}
          <div className="rounded-xl border border-border bg-card">
            {/* Feed Header */}
            <div className="px-4 py-3 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  {allSourcesActive ? "All Alerts" : "Filtered Alerts"}
                  <span className="ml-2 text-muted-foreground font-normal">
                    {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""} in {groupedAlerts.length} group{groupedAlerts.length !== 1 ? "s" : ""}
                    {" "}&middot; {timeRangeLabel}
                    {!allSourcesActive && <> &middot; {activeSources.size} source{activeSources.size !== 1 ? "s" : ""}</>}
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

                  {/* Source filter checkboxes */}
                  <div className="flex gap-1 items-center">
                    {visibleSources.map((s) => {
                      const isChecked = activeSources.has(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleSource(s)}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                            isChecked
                              ? sourceColors[s]
                              : "border-border bg-transparent text-muted-foreground/50 hover:text-muted-foreground"
                          )}
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-sm border transition-colors",
                            isChecked ? "bg-current border-current" : "border-muted-foreground/40"
                          )} />
                          {SOURCE_LABELS[s]}
                        </button>
                      );
                    })}
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

                  {/* Sort mode */}
                  <div className="flex gap-1 items-center">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    {(["severity", "newest"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSortMode(s)}
                        className={cn(
                          "px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                          sortMode === s
                            ? "border-red-500/50 bg-red-500/10 text-foreground"
                            : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {s === "severity" ? "Severity" : "Newest"}
                      </button>
                    ))}
                  </div>

                  {/* Show Closed toggle */}
                  <button
                    onClick={() => setShowClosed(!showClosed)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                      showClosed
                        ? "border-zinc-500/50 bg-zinc-500/10 text-zinc-300"
                        : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {showClosed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {showClosed ? "Showing Closed" : "Show Closed"}
                    {closedCount > 0 && (
                      <span className="ml-0.5 text-[9px] opacity-70">({closedCount})</span>
                    )}
                  </button>

                  {/* Clear filters */}
                  {(!allSourcesActive || severityFilter !== "all" || searchQuery || sortMode !== "severity") && (
                    <button
                      onClick={() => { setActiveSources(new Set(visibleSources)); setSeverityFilter("all"); setSearchQuery(""); setSortMode("severity"); }}
                      className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Select All row */}
            {filteredAlerts.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border/30 bg-accent/20">
                <button
                  onClick={toggleSelectAll}
                  className="shrink-0 flex items-center justify-center w-5 h-5 rounded"
                >
                  {selectedAlertIds.size === filteredAlerts.length && filteredAlerts.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
                  )}
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {selectedAlertIds.size > 0
                    ? `${selectedAlertIds.size} of ${filteredAlerts.length} selected`
                    : "Select all"}
                </span>
              </div>
            )}

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
                      onClick={() => { setActiveSources(new Set(visibleSources)); setSeverityFilter("all"); setSearchQuery(""); }}
                      className="text-xs mt-2 text-red-500 hover:underline"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {groupedAlerts.map((group) => {
                  const repAlertState = alertStates[group.representative.id];
                  return (
                    <div key={group.key}>
                      <AlertRow
                        group={group}
                        expanded={expandedGroupKey === group.key}
                        onToggle={() => setExpandedGroupKey(expandedGroupKey === group.key ? null : group.key)}
                        selected={selectedAlertIds.has(group.representative.id)}
                        onSelect={(e) => {
                          e.stopPropagation();
                          toggleAlertSelection(group.representative.id);
                        }}
                        alertState={repAlertState}
                      />
                      {/* Inline expansion */}
                      {expandedGroupKey === group.key && (
                        <AlertExpanded
                          source={group.representative.source}
                          alerts={group.alerts}
                          alertStates={alertStates}
                          onOpenDetail={(sourceId) => {
                            if (group.representative.source === "sentinelone") {
                              setDetailThreatId(sourceId);
                            }
                          }}
                          onClose={() => setExpandedGroupKey(null)}
                          onOpenCreateTicket={(alertItems) => {
                            // AlertItem from expanded view has the fields CreateTicketPanel needs
                            setCreateTicketAlerts(alertItems as unknown as UnifiedAlert[]);
                            setShowCreateTicket(true);
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inline Create Ticket Panel */}
          {showCreateTicket && createTicketAlerts.length > 0 && (
            <CreateTicketPanel
              alerts={createTicketAlerts}
              alertStates={alertStates}
              onClose={() => {
                setShowCreateTicket(false);
                setCreateTicketAlerts([]);
              }}
              onSuccess={() => {
                setShowCreateTicket(false);
                setCreateTicketAlerts([]);
                setSelectedAlertIds(new Set());
                utils.alertAction.getStates.invalidate();
              }}
            />
          )}

          {/* Bulk Action Bar */}
          {selectedAlertIds.size > 0 && (
            <AlertActionBar
              selectedAlerts={filteredAlerts
                .filter((a) => selectedAlertIds.has(a.id))
                .map((a) => ({
                  id: a.id,
                  source: a.source,
                  title: a.title,
                  severity: a.severity,
                  deviceHostname: a.deviceHostname,
                  organizationName: a.organizationName,
                }))}
              onClearSelection={() => setSelectedAlertIds(new Set())}
              onOpenCreateTicket={() => {
                const selected = filteredAlerts.filter((a) => selectedAlertIds.has(a.id));
                setCreateTicketAlerts(selected);
                setShowCreateTicket(true);
              }}
            />
          )}
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
