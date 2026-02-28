"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ShieldAlert,
  Shield,
  Monitor,
  Activity,
  HardDrive,
  Mail,
  Globe,
  Loader2,
  Unplug,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

/* ─── Types ──────────────────────────────────────────────── */

type SeverityKey = "critical" | "high" | "medium" | "low" | "informational";

const severityConfig = {
  critical: { label: "Critical", color: "text-red-500", bg: "bg-red-500", dot: "bg-red-500" },
  high: { label: "High", color: "text-orange-500", bg: "bg-orange-500", dot: "bg-orange-500" },
  medium: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500", dot: "bg-yellow-500" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400", dot: "bg-blue-400" },
  informational: { label: "Info", color: "text-zinc-400", bg: "bg-zinc-400", dot: "bg-zinc-400" },
} as const;

interface SeverityCount {
  label: string;
  count: number;
  severity: SeverityKey;
}

interface SubSourceData {
  name: string;
  color: string;        // e.g. "teal" or "cyan"
  dotClass: string;     // e.g. "bg-teal-400"
  textClass: string;    // e.g. "text-teal-400"
  count: number;
  breakdowns: SeverityCount[];
  loading?: boolean;
}

interface PlatformCardData {
  id: string;
  name: string;
  icon: React.ElementType;
  iconColor: string;
  total: number;
  breakdowns: SeverityCount[];
  loading: boolean;
  error: boolean;
  notConnected: boolean;
  subSources?: SubSourceData[];
}

type SourceKey = "sentinelone" | "blackpoint" | "ninjaone" | "uptime" | "backups" | "avanan" | "dnsfilter";

const ALL_SOURCES: SourceKey[] = ["sentinelone", "blackpoint", "ninjaone", "uptime", "backups", "avanan", "dnsfilter"];

/* ─── Platform Card Component ────────────────────────────── */

function PlatformCard({ card, onClick }: { card: PlatformCardData; onClick?: () => void }) {
  const { name, icon: Icon, iconColor, total, breakdowns, loading, error, notConnected } = card;

  if (notConnected) {
    return (
      <div className="relative rounded-xl p-4 bg-card border border-border shadow-card-light dark:shadow-card overflow-hidden opacity-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Unplug className="h-3 w-3 text-muted-foreground shrink-0" />
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
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{name}</p>
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
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 shrink-0">
            <Icon className="h-5 w-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{name}</p>
            <p className="text-xs text-red-400 mt-0.5">Error</p>
          </div>
        </div>
      </div>
    );
  }

  const hasSubSources = card.subSources && card.subSources.length > 0;

  return (
    <button
      onClick={onClick}
      className="relative rounded-xl p-4 bg-card border border-border hover:border-muted-foreground/30 shadow-card-light dark:shadow-card overflow-hidden text-left w-full transition-all"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/20 to-transparent" />

      <div className="flex items-center gap-3 mb-3">
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{name}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* Two-column sub-source layout (e.g. Cove | Dropsuite) */}
      {hasSubSources ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {card.subSources!.map((src, i) => (
              <div key={src.name} className={cn("space-y-1.5", i > 0 && "border-l border-border/50 pl-3")}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", src.dotClass)} />
                  <span className={cn("text-[10px] font-semibold", src.textClass)}>{src.name}</span>
                  <span className="text-[10px] font-bold text-foreground ml-auto">{src.count}</span>
                </div>
                {src.count > 0 && (
                  <div className="space-y-0.5 pl-3">
                    {src.breakdowns.filter((b) => b.count > 0).map((b) => {
                      const cfg = severityConfig[b.severity];
                      return (
                        <div key={b.label} className="flex items-center gap-1">
                          <span className={cn("w-1 h-1 rounded-full", cfg.dot)} />
                          <span className="text-[9px] text-muted-foreground">{b.label}</span>
                          <span className={cn("text-[9px] font-semibold ml-auto", cfg.color)}>{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {src.loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-3" />}
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-accent">
              {breakdowns.filter((b) => b.count > 0).map((b) => {
                const cfg = severityConfig[b.severity];
                const pct = (b.count / total) * 100;
                return (
                  <div key={b.label} className={cn("h-full", cfg.bg)} style={{ width: `${pct}%` }} title={`${b.label}: ${b.count}`} />
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {breakdowns.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {breakdowns.filter((b) => b.count > 0).map((b) => {
                const cfg = severityConfig[b.severity];
                return (
                  <div key={b.label} className="flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{b.label}</span>
                    <span className={cn("text-[10px] font-semibold", cfg.color)}>{b.count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {total > 0 && breakdowns.some((b) => b.count > 0) && (
            <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-accent">
              {breakdowns.filter((b) => b.count > 0).map((b) => {
                const cfg = severityConfig[b.severity];
                const pct = (b.count / total) * 100;
                return (
                  <div key={b.label} className={cn("h-full", cfg.bg)} style={{ width: `${pct}%` }} title={`${b.label}: ${b.count}`} />
                );
              })}
            </div>
          )}
        </>
      )}
    </button>
  );
}

/* ─── Alert Cards Module ─────────────────────────────────── */

export function AlertCardsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const router = useRouter();
  const sources = (config.sources as string[]) || ALL_SOURCES;
  const columns = (config.columns as number) || 0; // 0 = auto

  // ─── Data Queries (conditional per source) ─────────────
  const showS1 = sources.includes("sentinelone");
  const showBp = sources.includes("blackpoint");
  const showNinja = sources.includes("ninjaone");
  const showUptime = sources.includes("uptime");
  const showBackups = sources.includes("backups");
  const showAvanan = sources.includes("avanan");
  const showDns = sources.includes("dnsfilter");

  const s1Threats = trpc.edr.getThreats.useQuery(
    { pageSize: 100, status: "unresolved" },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: showS1 }
  );

  const bpDetections = trpc.blackpoint.getDetections.useQuery(
    { take: 200 },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: showBp }
  );

  const ninjaAlerts = trpc.rmm.getAlerts.useQuery(
    { pageSize: 100 },
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: showNinja }
  );

  const uptimeMonitors = trpc.uptime.list.useQuery(
    undefined,
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: showUptime }
  );

  const backupAlerts = trpc.backup.getAlerts.useQuery(
    undefined,
    { retry: 1, refetchInterval: 120_000, staleTime: 60_000, enabled: showBackups }
  );

  const dsBackupAlerts = trpc.saasBackup.getAlerts.useQuery(
    undefined,
    { retry: 1, refetchInterval: 120_000, staleTime: 60_000, enabled: showBackups }
  );

  const avananTenants = trpc.emailSecurity.listTenants.useQuery(undefined, {
    retry: 1, refetchInterval: 300_000, staleTime: 120_000, enabled: showAvanan,
  });
  const avananEventStats = trpc.emailSecurity.getEventStats.useQuery(
    { days: 30 },
    { retry: 1, refetchInterval: 600_000, staleTime: 300_000, enabled: showAvanan }
  );

  const dnsFilterThreats = trpc.dnsFilter.getThreatSummary.useQuery(
    {},
    { retry: 1, refetchInterval: 60_000, staleTime: 25_000, enabled: showDns }
  );

  // ─── Compute Platform Summaries ────────────────────────

  const isNotConnected = (q: { isError: boolean; error?: { message?: string } | null }): boolean => {
    if (!q.isError) return false;
    const msg = q.error?.message?.toLowerCase() ?? "";
    return msg.includes("not configured") || msg.includes("no active") || msg.includes("no integration");
  };

  const cards = useMemo((): PlatformCardData[] => {
    const result: PlatformCardData[] = [];

    // SentinelOne
    if (showS1) {
      const data = s1Threats.data?.data;
      let malicious = 0, suspicious = 0, mitigated = 0, notMitigated = 0, total = 0;
      if (data) {
        total = s1Threats.data?.totalCount ?? data.length;
        for (const t of data) {
          const raw = t._raw as { threatInfo?: { confidenceLevel?: string; mitigationStatus?: string } } | undefined;
          const conf = raw?.threatInfo?.confidenceLevel?.toLowerCase() ?? "";
          const mitStatus = raw?.threatInfo?.mitigationStatus?.toLowerCase() ?? "";
          if (conf === "malicious") malicious++;
          else if (conf === "suspicious") suspicious++;
          if (mitStatus === "mitigated" || t.status === "mitigated" || t.status === "resolved") mitigated++;
          else notMitigated++;
        }
      }
      result.push({
        id: "sentinelone", name: "SentinelOne", icon: ShieldAlert, iconColor: "bg-purple-500/10 text-purple-500",
        total, loading: s1Threats.isLoading, error: s1Threats.isError && !s1Threats.data && !isNotConnected(s1Threats),
        notConnected: isNotConnected(s1Threats),
        breakdowns: data ? [
          { label: "Malicious", count: malicious, severity: "critical" },
          { label: "Suspicious", count: suspicious, severity: "high" },
          { label: "Not Mitigated", count: notMitigated, severity: "medium" },
          { label: "Mitigated", count: mitigated, severity: "low" },
        ] : [],
      });
    }

    // Blackpoint
    if (showBp) {
      const data = bpDetections.data?.data;
      let critical = 0, high = 0, medium = 0, low = 0, total = 0;
      if (data) {
        total = bpDetections.data?.totalCount ?? data.length;
        for (const d of data) {
          switch (d.severity) {
            case "critical": critical++; break;
            case "high": high++; break;
            case "medium": medium++; break;
            case "low": low++; break;
          }
        }
      }
      result.push({
        id: "blackpoint", name: "Blackpoint", icon: Shield, iconColor: "bg-blue-500/10 text-blue-500",
        total, loading: bpDetections.isLoading, error: bpDetections.isError && !bpDetections.data && !isNotConnected(bpDetections),
        notConnected: isNotConnected(bpDetections),
        breakdowns: data ? [
          { label: "Critical", count: critical, severity: "critical" },
          { label: "High", count: high, severity: "high" },
          { label: "Medium", count: medium, severity: "medium" },
          { label: "Low", count: low, severity: "low" },
        ] : [],
      });
    }

    // NinjaRMM
    if (showNinja) {
      const data = ninjaAlerts.data?.data;
      let critical = 0, high = 0, medium = 0, low = 0, total = 0;
      if (data) {
        total = ninjaAlerts.data?.totalCount ?? data.length;
        for (const a of data) {
          switch (a.severity) {
            case "critical": critical++; break;
            case "high": high++; break;
            case "medium": medium++; break;
            case "low": low++; break;
          }
        }
      }
      result.push({
        id: "ninjaone", name: "NinjaRMM", icon: Monitor, iconColor: "bg-emerald-500/10 text-emerald-500",
        total, loading: ninjaAlerts.isLoading, error: ninjaAlerts.isError && !ninjaAlerts.data && !isNotConnected(ninjaAlerts),
        notConnected: isNotConnected(ninjaAlerts),
        breakdowns: data ? [
          { label: "Critical", count: critical, severity: "critical" },
          { label: "High", count: high, severity: "high" },
          { label: "Medium", count: medium, severity: "medium" },
          { label: "Low", count: low, severity: "low" },
        ] : [],
      });
    }

    // Uptime Monitors
    if (showUptime) {
      const data = uptimeMonitors.data;
      let down = 0, pending = 0, total = 0;
      if (data) {
        for (const m of data) {
          if (!m.active) continue;
          if (m.status === "DOWN") down++;
          else if (m.status === "PENDING") pending++;
        }
        total = down + pending;
      }
      result.push({
        id: "uptime", name: "Uptime Monitors", icon: Activity, iconColor: "bg-rose-500/10 text-rose-500",
        total, loading: uptimeMonitors.isLoading, error: uptimeMonitors.isError && !isNotConnected(uptimeMonitors),
        notConnected: isNotConnected(uptimeMonitors),
        breakdowns: data ? [
          { label: "Down", count: down, severity: "critical" },
          { label: "Pending", count: pending, severity: "medium" },
        ] : [],
      });
    }

    // Backups (Cove + Dropsuite — two-column split card)
    if (showBackups) {
      const coveData = (backupAlerts.data ?? []) as { severity: string }[];
      const dsData = (dsBackupAlerts.data ?? []) as { severity: string }[];
      const bothLoading = backupAlerts.isLoading && dsBackupAlerts.isLoading;
      const bothNotConnected = isNotConnected(backupAlerts) && isNotConnected(dsBackupAlerts);
      const bothError = backupAlerts.isError && dsBackupAlerts.isError && !backupAlerts.data && !dsBackupAlerts.data && !bothNotConnected;

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

      const total = coveData.length + dsData.length;
      result.push({
        id: "backups", name: "Backups", icon: HardDrive, iconColor: "bg-teal-500/10 text-teal-500",
        total, loading: bothLoading, error: bothError,
        notConnected: bothNotConnected,
        breakdowns: [
          { label: "Failed", count: coveCritical + dsCritical, severity: "critical" },
          { label: "Overdue", count: coveHigh + dsHigh, severity: "high" },
          { label: "Warning", count: coveMedium + dsMedium, severity: "medium" },
        ],
        subSources: [
          {
            name: "Cove", color: "teal", dotClass: "bg-teal-400", textClass: "text-teal-400",
            count: coveData.length, loading: backupAlerts.isLoading,
            breakdowns: [
              { label: "Failed", count: coveCritical, severity: "critical" },
              { label: "Overdue", count: coveHigh, severity: "high" },
              { label: "Warning", count: coveMedium, severity: "medium" },
            ],
          },
          {
            name: "DropSuite", color: "cyan", dotClass: "bg-cyan-400", textClass: "text-cyan-400",
            count: dsData.length, loading: dsBackupAlerts.isLoading,
            breakdowns: [
              { label: "Failed", count: dsCritical, severity: "critical" },
              { label: "Overdue", count: dsHigh, severity: "high" },
              { label: "Warning", count: dsMedium, severity: "medium" },
            ],
          },
        ],
      });
    }

    // Avanan (Email Security)
    if (showAvanan) {
      const hasStats = !!avananEventStats.data;
      const phishing = avananEventStats.data?.byType?.phishing ?? 0;
      const malware = avananEventStats.data?.byType?.malware ?? 0;
      const spam = avananEventStats.data?.byType?.spam ?? 0;
      const eventTotal = avananEventStats.data?.total ?? 0;

      let active = 0;
      if (avananTenants.data) {
        for (const t of avananTenants.data) {
          if (!(t as { isDeleted?: boolean }).isDeleted) {
            const statusCode = ((t as { status?: string }).status ?? "").toLowerCase();
            if (statusCode === "success") active++;
          }
        }
      }

      const total = hasStats ? eventTotal : active;
      result.push({
        id: "avanan", name: "Avanan", icon: Mail, iconColor: "bg-amber-500/10 text-amber-500",
        total, loading: avananTenants.isLoading,
        error: avananTenants.isError && !avananTenants.data && !isNotConnected(avananTenants),
        notConnected: isNotConnected(avananTenants),
        breakdowns: hasStats
          ? [
              { label: "Phishing", count: phishing, severity: "critical" },
              { label: "Malware", count: malware, severity: "high" },
              { label: "Spam", count: spam, severity: "medium" },
            ]
          : [],
      });
    }

    // DNS Filter
    if (showDns) {
      const data = dnsFilterThreats.data;
      result.push({
        id: "dnsfilter", name: "DNS Filter", icon: Globe, iconColor: "bg-violet-500/10 text-violet-500",
        total: data?.total ?? 0, loading: dnsFilterThreats.isLoading,
        error: dnsFilterThreats.isError && !dnsFilterThreats.data && !isNotConnected(dnsFilterThreats),
        notConnected: isNotConnected(dnsFilterThreats),
        breakdowns: data ? [
          { label: "Critical", count: data.critical, severity: "critical" },
          { label: "High", count: data.high, severity: "high" },
          { label: "Medium", count: data.medium, severity: "medium" },
          { label: "Low", count: data.low, severity: "low" },
        ] : [],
      });
    }

    return result;
  }, [
    showS1, showBp, showNinja, showUptime, showBackups, showAvanan, showDns,
    s1Threats.data, s1Threats.isLoading, s1Threats.isError, s1Threats.error,
    bpDetections.data, bpDetections.isLoading, bpDetections.isError, bpDetections.error,
    ninjaAlerts.data, ninjaAlerts.isLoading, ninjaAlerts.isError, ninjaAlerts.error,
    uptimeMonitors.data, uptimeMonitors.isLoading, uptimeMonitors.isError, uptimeMonitors.error,
    backupAlerts.data, backupAlerts.isLoading, backupAlerts.isError, backupAlerts.error,
    dsBackupAlerts.data, dsBackupAlerts.isLoading, dsBackupAlerts.isError, dsBackupAlerts.error,
    avananTenants.data, avananTenants.isLoading, avananTenants.isError, avananTenants.error,
    avananEventStats.data,
    dnsFilterThreats.data, dnsFilterThreats.isLoading, dnsFilterThreats.isError, dnsFilterThreats.error,
  ]);

  // Dynamic grid: columns=0 means auto-fit based on card count
  const gridStyle = columns > 0
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : undefined;

  const autoGridClass = columns > 0
    ? ""
    : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <>
      <div className="p-4">
        <div className={cn("grid gap-3", autoGridClass)} style={gridStyle}>
          {cards.map((card) => (
            <PlatformCard
              key={card.id}
              card={card}
              onClick={() => router.push("/alerts")}
            />
          ))}
        </div>
      </div>

      <ModuleConfigPanel title="Alert Overview Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Cards per row">
          <ConfigSelect
            value={String(columns)}
            onChange={(v) => onConfigChange({ ...config, columns: parseInt(v, 10) })}
            options={[
              { value: "0", label: "Auto (responsive)" },
              { value: "2", label: "2 per row" },
              { value: "3", label: "3 per row" },
              { value: "4", label: "4 per row" },
              { value: "5", label: "5 per row" },
              { value: "6", label: "6 per row" },
              { value: "7", label: "7 per row" },
            ]}
          />
        </ConfigSection>
        <ConfigSection label="Sources to display">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "sentinelone", label: "SentinelOne" },
              { id: "blackpoint", label: "Blackpoint" },
              { id: "ninjaone", label: "NinjaRMM" },
              { id: "uptime", label: "Uptime" },
              { id: "backups", label: "Backups" },
              { id: "avanan", label: "Avanan" },
              { id: "dnsfilter", label: "DNS Filter" },
            ].map((s) => (
              <ConfigChip
                key={s.id}
                label={s.label}
                active={sources.includes(s.id)}
                onClick={() => {
                  const next = sources.includes(s.id)
                    ? sources.filter((x: string) => x !== s.id)
                    : [...sources, s.id];
                  onConfigChange({ ...config, sources: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
