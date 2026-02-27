"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Server,
  Monitor,
  HardDrive,
  Database,
  Mail,
  Cloud,
  FileText,
  Layers,
  Globe,
  Shield,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { ColorBar28Day } from "@/app/(dashboard)/backups/_components/color-bar";
import { AlertTicketLink } from "./alert-ticket-link";

/* ─── Types (mirroring backend) ──────────────────────────── */

interface ColorBarDay {
  date: string;
  status: "success" | "partial" | "failed" | "missed" | "running" | "none";
}

interface BackupDataSource {
  type: string;
  label: string;
  lastSessionStatus: string | null;
  lastSessionTimestamp: string | null;
  lastSuccessfulTimestamp: string | null;
  errorsCount: number | null;
  selectedCount: number | null;
  processedCount: number | null;
  selectedSizeBytes: number | null;
  processedSizeBytes: number | null;
  protectedSizeBytes: number | null;
  sessionDurationSeconds: number | null;
  colorBar28Days: ColorBarDay[];
}

interface BackupDevice {
  sourceId: string;
  deviceName: string;
  computerName: string;
  customerName: string;
  customerSourceId: string;
  os: string | null;
  osType: "workstation" | "server" | null;
  overallStatus: string;
  usedStorageBytes: number;
  selectedSizeBytes: number;
  lastSessionTimestamp: string | null;
  lastSuccessfulTimestamp: string | null;
  colorBar28Days: ColorBarDay[];
  dataSources: BackupDataSource[];
  internalIps: string | null;
  externalIps: string | null;
  storageLocation: string | null;
  agentVersion: string | null;
}

interface SessionHistoryEntry {
  timestamp: string;
  dataSourceType: string;
  dataSourceLabel: string;
  status: string | null;
  durationSeconds: number | null;
  errorsCount: number | null;
  selectedCount: number | null;
  processedCount: number | null;
  selectedSizeBytes: number | null;
  processedSizeBytes: number | null;
}

/* ─── Helpers ────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function daysSinceColor(isoDate: string | null): { text: string; color: string } {
  if (!isoDate) return { text: "Never", color: "text-zinc-500" };
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return { text: "< 1 day", color: "text-green-400" };
  if (days <= 2) return { text: `${days} day${days > 1 ? "s" : ""}`, color: "text-amber-400" };
  return { text: `${days} days`, color: "text-red-400" };
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-green-500", warning: "bg-amber-500", failed: "bg-red-500",
  overdue: "bg-orange-500", offline: "bg-zinc-500", never_ran: "bg-zinc-600", unknown: "bg-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy", warning: "Warning", failed: "Failed", overdue: "Overdue",
  offline: "Offline", never_ran: "Never Ran", unknown: "Unknown",
  in_process: "In Progress", completed: "Completed", completed_with_errors: "Errors",
  aborted: "Aborted", interrupted: "Interrupted", not_started: "Not Started",
  over_quota: "Over Quota", restarted: "Restarted", in_progress_with_faults: "Faults",
};

const SESSION_STATUS_COLOR: Record<string, string> = {
  completed: "text-green-400", in_process: "text-blue-400", failed: "text-red-400",
  completed_with_errors: "text-amber-400", aborted: "text-red-400",
  interrupted: "text-amber-400", over_quota: "text-amber-400",
  in_progress_with_faults: "text-amber-400", not_started: "text-zinc-500",
  restarted: "text-blue-400",
};

const SOURCE_ICONS: Record<string, React.ElementType> = {
  files: FileText, system_state: Layers, mssql: Database, vss_mssql: Database,
  exchange: Mail, vss_exchange: Mail, network_shares: Globe,
  vmware: Server, hyperv: Server, vdr: HardDrive, bmr: Shield,
  m365_exchange: Cloud, m365_onedrive: Cloud, m365_sharepoint: Cloud, m365_teams: Cloud,
  oracle: Database, mysql: Database,
};

/* ─── Detail Row ─────────────────────────────────────────── */

function DetailRow({ label, value, valueClass }: { label: string; value: string | null | undefined; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
      <span className={cn("text-[10px] text-right font-medium truncate max-w-[180px]", valueClass ?? "text-foreground")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────── */

interface CoveAlertDetailProps {
  alert: {
    sourceId: string;
    title: string;
    deviceHostname?: string;
    organizationName?: string;
    severity: string;
    detectedAt: Date;
  };
}

/* ─── Main Component ─────────────────────────────────────── */

export function CoveAlertDetail({ alert }: CoveAlertDetailProps) {
  const router = useRouter();

  // Extract device ID: "backup-failed-12345" → "12345"
  const deviceId = useMemo(() => alert.sourceId.replace(/^backup-\w+-/, ""), [alert.sourceId]);

  const device = trpc.backup.getDeviceById.useQuery(
    { id: deviceId },
    { retry: 1, staleTime: 60_000 }
  );

  const history = trpc.backup.getDeviceHistory.useQuery(
    { deviceId, days: 7 },
    { retry: 1, staleTime: 120_000 }
  );

  const partnerId = trpc.backup.getCovePartnerId.useQuery(undefined, {
    retry: 1,
    staleTime: 10 * 60_000, // 10 min — partner ID rarely changes
  });

  if (device.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading backup details...</span>
      </div>
    );
  }

  if (device.error || !device.data) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <span className="text-xs text-muted-foreground">
          {device.error ? "Failed to load device details" : "Device not found"}
        </span>
      </div>
    );
  }

  const d = device.data as BackupDevice;
  const lastSuccess = daysSinceColor(d.lastSuccessfulTimestamp);
  const DeviceIcon = d.osType === "server" ? Server : Monitor;
  const recentSessions = (history.data as SessionHistoryEntry[] | undefined)?.slice(0, 5) ?? [];

  // Build Cove portal URLs — format: https://backup.management/#/backup/overview/view/{partnerId}(panel:device-properties/{deviceId}/{tab})
  const covePortalUrl = (tab: string) =>
    partnerId.data
      ? `https://backup.management/#/backup/overview/view/${partnerId.data}(panel:device-properties/${deviceId}/${tab})`
      : "https://backup.management";

  // Build failure summary from data sources
  const failedSources = d.dataSources.filter(
    (ds) => ds.lastSessionStatus && ["failed", "completed_with_errors", "aborted", "interrupted", "over_quota", "in_progress_with_faults"].includes(ds.lastSessionStatus)
  );
  const totalErrors = d.dataSources.reduce((sum, ds) => sum + (ds.errorsCount ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* ── Failure Summary Banner ──────────────────────── */}
      {(failedSources.length > 0 || totalErrors > 0) && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span className="text-[11px] font-medium text-red-400">Backup Failure Details</span>
            </div>
            <a
              href={covePortalUrl("errors")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-red-400/80 hover:text-red-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View error log in Cove
            </a>
          </div>
          <div className="space-y-1 pl-6">
            {failedSources.map((ds) => {
              const statusLabel = STATUS_LABEL[ds.lastSessionStatus!] ?? ds.lastSessionStatus;
              const processedPct = ds.selectedCount && ds.processedCount != null
                ? Math.round((ds.processedCount / ds.selectedCount) * 100)
                : null;
              return (
                <div key={ds.type} className="text-[10px]">
                  <span className="text-foreground font-medium">{ds.label}</span>
                  <span className="text-red-400 ml-1.5">{statusLabel}</span>
                  {ds.errorsCount != null && ds.errorsCount > 0 && (
                    <span className="text-red-400/80 ml-1.5">— {ds.errorsCount} error{ds.errorsCount !== 1 ? "s" : ""}</span>
                  )}
                  {processedPct !== null && processedPct < 100 && (
                    <span className="text-amber-400/80 ml-1.5">— {processedPct}% processed ({ds.processedCount?.toLocaleString()}/{ds.selectedCount?.toLocaleString()} items)</span>
                  )}
                  {ds.lastSessionStatus === "over_quota" && (
                    <span className="text-amber-400/80 ml-1.5">— storage quota exceeded</span>
                  )}
                </div>
              );
            })}
            {failedSources.length === 0 && totalErrors > 0 && (
              <span className="text-[10px] text-red-400/80">{totalErrors} error{totalErrors !== 1 ? "s" : ""} across all data sources</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 pl-6">
            Detailed error messages are only available in the Cove portal — the API provides error counts only.
          </p>
        </div>
      )}

      {/* ── 3-Column Info Grid ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Device Info */}
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <DeviceIcon className="h-4 w-4 text-teal-400" />
            <span className="text-[11px] font-medium text-foreground">Device Info</span>
          </div>
          <DetailRow label="Hostname" value={d.computerName || d.deviceName} />
          <DetailRow label="Customer" value={d.customerName} />
          <DetailRow label="OS" value={d.os} />
          <DetailRow label="Type" value={d.osType === "server" ? "Server" : "Workstation"} />
          {d.internalIps && <DetailRow label="Internal IP" value={d.internalIps} />}
          {d.externalIps && <DetailRow label="External IP" value={d.externalIps} />}
          {d.agentVersion && <DetailRow label="Agent" value={`v${d.agentVersion}`} />}
        </div>

        {/* Column 2: Backup Status */}
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-teal-400" />
            <span className="text-[11px] font-medium text-foreground">Backup Status</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Status</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[d.overallStatus] ?? "bg-zinc-600")} />
              <span className={cn("text-[10px] font-medium",
                d.overallStatus === "healthy" ? "text-green-400" :
                d.overallStatus === "failed" ? "text-red-400" :
                d.overallStatus === "warning" ? "text-amber-400" :
                d.overallStatus === "overdue" ? "text-orange-400" : "text-muted-foreground"
              )}>
                {STATUS_LABEL[d.overallStatus] ?? d.overallStatus}
              </span>
            </div>
          </div>
          <DetailRow label="Last Backup" value={formatRelativeTime(d.lastSessionTimestamp)} />
          <DetailRow
            label="Since Success"
            value={lastSuccess.text}
            valueClass={lastSuccess.color}
          />
          <DetailRow label="Storage Used" value={formatBytes(d.usedStorageBytes)} />
          <DetailRow label="Selected Size" value={formatBytes(d.selectedSizeBytes)} />
          {d.storageLocation && <DetailRow label="Location" value={d.storageLocation} />}
        </div>

        {/* Column 3: Data Sources */}
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-teal-400" />
            <span className="text-[11px] font-medium text-foreground">Data Sources</span>
          </div>
          {d.dataSources.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">No active sources</span>
          ) : (
            <div className="space-y-2">
              {d.dataSources.map((ds) => {
                const Icon = SOURCE_ICONS[ds.type] ?? FileText;
                const statusColor = ds.lastSessionStatus
                  ? (SESSION_STATUS_COLOR[ds.lastSessionStatus] ?? "text-muted-foreground")
                  : "text-zinc-500";
                return (
                  <div key={ds.type} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] text-foreground flex-1 truncate">{ds.label}</span>
                      <span className={cn("text-[10px] font-medium", statusColor)}>
                        {ds.lastSessionStatus ? (STATUS_LABEL[ds.lastSessionStatus] ?? ds.lastSessionStatus) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-5">
                      <span className="text-[10px] text-zinc-400">
                        {formatRelativeTime(ds.lastSessionTimestamp)}
                      </span>
                      {ds.errorsCount != null && ds.errorsCount > 0 && (
                        <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> {ds.errorsCount} errors
                        </span>
                      )}
                    </div>
                    {ds.colorBar28Days && ds.colorBar28Days.length > 0 && (
                      <div className="pl-5">
                        <ColorBar28Day days={ds.colorBar28Days} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 28-Day Color Bar (full width) ───────────────── */}
      {d.colorBar28Days && d.colorBar28Days.length > 0 && (
        <div className="p-3 rounded-lg border border-border/30 bg-muted/5">
          <span className="text-[10px] text-muted-foreground mb-1.5 block">28-Day Backup History</span>
          <ColorBar28Day days={d.colorBar28Days} />
        </div>
      )}

      {/* ── Recent Sessions ─────────────────────────────── */}
      {recentSessions.length > 0 && (
        <div className="p-3 rounded-lg border border-border/30 bg-muted/5">
          <span className="text-[10px] text-muted-foreground mb-2 block">Recent Sessions (7 days)</span>
          <div className="space-y-1.5">
            {recentSessions.map((s, i) => {
              const Icon = SOURCE_ICONS[s.dataSourceType] ?? FileText;
              const statusColor = s.status ? (SESSION_STATUS_COLOR[s.status] ?? "text-muted-foreground") : "text-zinc-500";
              return (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground w-[80px] flex-shrink-0 truncate">
                    {new Date(s.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" "}
                    {new Date(s.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground truncate flex-1">{s.dataSourceLabel}</span>
                  <span className={cn("font-medium flex-shrink-0", statusColor)}>
                    {s.status ? (STATUS_LABEL[s.status] ?? s.status) : "—"}
                  </span>
                  {s.errorsCount != null && s.errorsCount > 0 && (
                    <span className="text-red-400 flex-shrink-0">{s.errorsCount} err</span>
                  )}
                  {s.selectedCount != null && s.processedCount != null && s.processedCount < s.selectedCount && (
                    <span className="text-amber-400/70 flex-shrink-0">{s.processedCount}/{s.selectedCount}</span>
                  )}
                  <span className="text-muted-foreground flex-shrink-0">{formatDuration(s.durationSeconds)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Related Tickets ────────────────────────────── */}
      <AlertTicketLink
        hostname={d.computerName || d.deviceName}
        organizationName={d.customerName}
        organizationSourceId={d.customerSourceId}
        toolId="cove"
        alertContext={{
          title: alert.title,
          severity: alert.severity,
          source: "cove",
          deviceHostname: d.computerName || d.deviceName,
          detectedAt: alert.detectedAt,
        }}
      />

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/backups?device=${deviceId}`)}
          className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
        >
          <ArrowRight className="h-3 w-3" />
          Open in Backups
        </button>
        <a
          href={covePortalUrl("errors")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-muted-foreground border border-border hover:text-foreground hover:border-muted-foreground/40 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View in Cove
        </a>
      </div>
    </div>
  );
}
