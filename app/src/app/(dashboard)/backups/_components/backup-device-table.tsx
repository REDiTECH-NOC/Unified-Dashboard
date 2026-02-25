"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Server,
  Monitor,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Database,
  Mail,
  Cloud,
  FileText,
  Layers,
  ExternalLink,
  Globe,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ColorBar28Day } from "./color-bar";

/* ─── Types mirroring backend normalized types ─────────────── */

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
  selectedCount: number | null;
  processedCount: number | null;
  selectedSizeBytes: number | null;
  processedSizeBytes: number | null;
  errorsCount: number | null;
  protectedSizeBytes: number | null;
  sessionDurationSeconds: number | null;
  licenseItems: number | null;
  colorBar28Days: ColorBarDay[];
}

export interface BackupDevice {
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
  protectedSizeBytes: number;
  lastSessionTimestamp: string | null;
  lastSuccessfulTimestamp: string | null;
  colorBar28Days: ColorBarDay[];
  activeDataSources: string[];
  dataSources: BackupDataSource[];
  agentVersion: string | null;
  internalIps: string | null;
  externalIps: string | null;
  macAddress: string | null;
  email: string | null;
  creationDate: string | null;
  storageLocation: string | null;
  accountType: string | null;
  productName: string | null;
  lsvEnabled: boolean;
  lsvStatus: string | null;
  storageStatus: string | null;
}

/* ─── Helpers ──────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return "Never";
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function daysSinceLastSuccess(isoDate: string | null): {
  text: string;
  color: string;
} {
  if (!isoDate) return { text: "Never", color: "text-zinc-500" };
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return { text: "< 1 day", color: "text-green-400" };
  if (days <= 2)
    return { text: `${days} day${days > 1 ? "s" : ""}`, color: "text-amber-400" };
  return { text: `${days} days`, color: "text-red-400" };
}

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-green-500",
  warning: "bg-amber-500",
  failed: "bg-red-500",
  overdue: "bg-orange-500",
  offline: "bg-zinc-500",
  never_ran: "bg-zinc-600",
  unknown: "bg-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  warning: "Warning",
  failed: "Failed",
  overdue: "Overdue",
  offline: "Offline",
  never_ran: "Never Ran",
  unknown: "Unknown",
  in_process: "In Progress",
  completed: "Completed",
  completed_with_errors: "Errors",
  aborted: "Aborted",
  interrupted: "Interrupted",
  not_started: "Not Started",
  over_quota: "Over Quota",
  no_selection: "No Selection",
  restarted: "Restarted",
  in_progress_with_faults: "Faults",
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

const STORAGE_STATUS_COLORS: Record<string, { label: string; color: string }> = {
  synchronized: { label: "Synchronized", color: "text-green-400" },
  running: { label: "Running", color: "text-blue-400" },
  offline: { label: "Offline", color: "text-zinc-500" },
  failed: { label: "Failed", color: "text-red-400" },
  undefined: { label: "Undefined", color: "text-zinc-500" },
};

type ExpandTab = "overview" | "history" | "errors" | "recovery";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  files: FileText,
  system_state: Layers,
  mssql: Database,
  vss_mssql: Database,
  exchange: Mail,
  vss_exchange: Mail,
  network_shares: Globe,
  vmware: Server,
  hyperv: Server,
  vdr: HardDrive,
  bmr: Shield,
  m365_exchange: Cloud,
  m365_onedrive: Cloud,
  m365_sharepoint: Cloud,
  m365_teams: Cloud,
  oracle: Database,
  mysql: Database,
};

/* ─── Active Source Icons (derived from dataSources array) ─── */

function ActiveSourceIcons({ dataSources }: { dataSources: BackupDataSource[] }) {
  const activeSources = dataSources.filter((ds) => ds.type !== "total");

  if (activeSources.length === 0) return <span className="text-zinc-600">—</span>;

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {activeSources.slice(0, 5).map((ds) => {
        const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
        return (
          <span key={ds.type} title={ds.label}>
            <Icon className="h-3 w-3 text-zinc-400" />
          </span>
        );
      })}
      {activeSources.length > 5 && (
        <span className="text-[10px] text-zinc-500">+{activeSources.length - 5}</span>
      )}
    </div>
  );
}

/* ─── Expanded Detail — Tabbed View ──────────────────────── */

function DeviceExpandedDetail({ device }: { device: BackupDevice }) {
  const [activeTab, setActiveTab] = useState<ExpandTab>("overview");
  const dataSources = (device.dataSources ?? []).filter(
    (ds) => ds.type !== "total"
  );
  const totalErrors = dataSources.reduce((sum, ds) => sum + (ds.errorsCount ?? 0), 0);
  const coveDeviceUrl = `https://backup.management/#/accounts/${device.sourceId}`;

  const tabs: { id: ExpandTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "history", label: "History", icon: Clock },
    { id: "errors", label: `Errors${totalErrors > 0 ? ` (${totalErrors})` : ""}`, icon: AlertTriangle },
    { id: "recovery", label: "Recovery", icon: ShieldCheck },
  ];

  return (
    <div className="bg-zinc-900/30 border-t border-zinc-800/50">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-6 pt-3 pb-0 border-b border-zinc-800/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-teal-400 text-teal-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <a
          href={coveDeviceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors pb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
          Open in Cove
        </a>
      </div>

      {/* Tab content */}
      <div className="px-6 py-4">
        {activeTab === "overview" && (
          <OverviewTab device={device} dataSources={dataSources} />
        )}
        {activeTab === "history" && (
          <HistoryTab device={device} dataSources={dataSources} coveUrl={coveDeviceUrl} />
        )}
        {activeTab === "errors" && (
          <ErrorsTab device={device} dataSources={dataSources} totalErrors={totalErrors} coveUrl={coveDeviceUrl} />
        )}
        {activeTab === "recovery" && (
          <RecoveryTab device={device} dataSources={dataSources} coveUrl={coveDeviceUrl} />
        )}
      </div>
    </div>
  );
}

/* ─── Overview Tab ────────────────────────────────────────── */

function OverviewTab({
  device,
  dataSources,
}: {
  device: BackupDevice;
  dataSources: BackupDataSource[];
}) {
  const storageInfo = STORAGE_STATUS_COLORS[device.storageStatus ?? ""] ?? {
    label: device.storageStatus ?? "—",
    color: "text-zinc-500",
  };

  return (
    <>
      {/* Device metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 mb-4 text-xs">
        <MetaField label="OS" value={device.os} />
        <MetaField label="Internal IP" value={device.internalIps} />
        <MetaField label="Agent Version" value={device.agentVersion} />
        <MetaField label="Storage Location" value={device.storageLocation} />
        <MetaField label="External IP" value={device.externalIps} />
        <MetaField label="MAC Address" value={device.macAddress} />
        <MetaField label="Product" value={device.productName} />
        <MetaField label="Email" value={device.email} />
        <MetaField label="Created" value={formatDate(device.creationDate)} />
        <MetaField label="Account Type" value={device.accountType} />
        <div>
          <span className="text-zinc-500">LSV: </span>
          <span className={device.lsvEnabled ? "text-green-400" : "text-zinc-500"}>
            {device.lsvEnabled ? "Enabled" : "Disabled"}
          </span>
          {device.lsvStatus && (
            <span className="text-zinc-500 ml-1">({device.lsvStatus})</span>
          )}
        </div>
        <div>
          <span className="text-zinc-500">Storage Status: </span>
          <span className={storageInfo.color}>{storageInfo.label}</span>
        </div>
      </div>

      {/* Per-source data table */}
      {dataSources.length === 0 ? (
        <div className="py-3 text-xs text-zinc-500">
          No per-source breakdown available for this device.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1.5 font-medium">Data Source</th>
                <th className="text-left py-1.5 font-medium">Status</th>
                <th className="text-left py-1.5 font-medium">Last Backup</th>
                <th className="text-left py-1.5 font-medium">Last Success</th>
                <th className="text-right py-1.5 font-medium">Duration</th>
                <th className="text-right py-1.5 font-medium">Files</th>
                <th className="text-right py-1.5 font-medium">Selected</th>
                <th className="text-right py-1.5 font-medium">Protected</th>
                <th className="text-right py-1.5 font-medium">Errors</th>
                <th className="text-left py-1.5 font-medium pl-3">28-Day History</th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((ds) => {
                const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
                return (
                  <tr key={ds.type} className="border-b border-zinc-800/50">
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-zinc-300">{ds.label}</span>
                      </div>
                    </td>
                    <td className="py-1.5">
                      <span
                        className={cn(
                          "text-xs",
                          ds.lastSessionStatus === "completed" && "text-green-400",
                          ds.lastSessionStatus === "failed" && "text-red-400",
                          ds.lastSessionStatus === "completed_with_errors" &&
                            "text-amber-400",
                          ds.lastSessionStatus === "in_process" && "text-blue-400",
                          !ds.lastSessionStatus && "text-zinc-500"
                        )}
                      >
                        {STATUS_LABEL[ds.lastSessionStatus ?? ""] ??
                          ds.lastSessionStatus ??
                          "—"}
                      </span>
                    </td>
                    <td className="py-1.5 text-zinc-400">
                      {formatRelativeTime(ds.lastSessionTimestamp)}
                    </td>
                    <td className="py-1.5 text-zinc-400">
                      {formatRelativeTime(ds.lastSuccessfulTimestamp)}
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right">
                      {formatDuration(ds.sessionDurationSeconds)}
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right tabular-nums">
                      {ds.selectedCount != null ? ds.selectedCount.toLocaleString() : "—"}
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right">
                      {ds.selectedSizeBytes
                        ? formatBytes(ds.selectedSizeBytes)
                        : "—"}
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right">
                      {ds.protectedSizeBytes
                        ? formatBytes(ds.protectedSizeBytes)
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        className={cn(
                          ds.errorsCount && ds.errorsCount > 0
                            ? "text-red-400 font-medium"
                            : "text-zinc-500"
                        )}
                      >
                        {ds.errorsCount ?? 0}
                      </span>
                    </td>
                    <td className="py-1.5 pl-3">
                      <ColorBar28Day days={ds.colorBar28Days} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ─── History Tab ─────────────────────────────────────────── */

function formatSessionTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function HistoryTab({
  device,
  dataSources,
  coveUrl,
}: {
  device: BackupDevice;
  dataSources: BackupDataSource[];
  coveUrl: string;
}) {
  const history = trpc.backup.getDeviceHistory.useQuery(
    { deviceId: device.sourceId, days: 30 },
    { staleTime: 10 * 60 * 1000 }
  );

  // Deduplicate in case API returns multiple rows for same timestamp+source
  const sessions = useMemo(() => {
    if (!history.data) return [];
    const seen = new Set<string>();
    return history.data.filter((entry) => {
      const key = `${entry.timestamp}:${entry.dataSourceType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [history.data]);

  return (
    <div className="space-y-4">
      {/* Overall 28-day color bar — always show from cached device data */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-zinc-300">28-Day Overview</span>
        </div>
        <div className="bg-zinc-800/30 rounded-lg p-3">
          <ColorBar28Day days={device.colorBar28Days} />
        </div>
      </div>

      {/* Session history table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-300">Session History (30 days)</span>
          {history.isLoading && (
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <div className="animate-spin h-3 w-3 border border-zinc-600 border-t-zinc-300 rounded-full" />
              Loading...
            </span>
          )}
        </div>

        {history.isError && (
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-3 text-xs text-red-400">
            Failed to load session history. {history.error?.message}
          </div>
        )}

        {sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-1.5 font-medium">Date/Time</th>
                  <th className="text-left py-1.5 font-medium">Data Source</th>
                  <th className="text-left py-1.5 font-medium">Status</th>
                  <th className="text-right py-1.5 font-medium">Duration</th>
                  <th className="text-right py-1.5 font-medium">Errors</th>
                  <th className="text-right py-1.5 font-medium">Selected</th>
                  <th className="text-right py-1.5 font-medium">Files</th>
                  <th className="text-right py-1.5 font-medium">Processed</th>
                  <th className="text-right py-1.5 font-medium">Transferred</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((entry, idx) => {
                  const Icon = SOURCE_ICONS[entry.dataSourceType] ?? HardDrive;
                  return (
                    <tr
                      key={`${entry.timestamp}-${entry.dataSourceType}-${idx}`}
                      className="border-b border-zinc-800/50"
                    >
                      <td className="py-1.5 text-zinc-400 whitespace-nowrap">
                        {formatSessionTimestamp(entry.timestamp)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-zinc-400" />
                          <span className="text-zinc-300">{entry.dataSourceLabel}</span>
                        </div>
                      </td>
                      <td className="py-1.5">
                        <span
                          className={cn(
                            "text-xs",
                            entry.status === "completed" && "text-green-400",
                            entry.status === "failed" && "text-red-400",
                            entry.status === "completed_with_errors" && "text-amber-400",
                            entry.status === "in_process" && "text-blue-400",
                            !entry.status && "text-zinc-500"
                          )}
                        >
                          {STATUS_LABEL[entry.status ?? ""] ?? entry.status ?? "—"}
                        </span>
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {formatDuration(entry.durationSeconds)}
                      </td>
                      <td className="py-1.5 text-right">
                        <span
                          className={cn(
                            entry.errorsCount && entry.errorsCount > 0
                              ? "text-red-400 font-medium"
                              : "text-zinc-500"
                          )}
                        >
                          {entry.errorsCount ?? 0}
                        </span>
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {entry.selectedSizeBytes
                          ? formatBytes(entry.selectedSizeBytes)
                          : "—"}
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right tabular-nums">
                        {entry.selectedCount != null
                          ? entry.selectedCount.toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {entry.processedSizeBytes
                          ? formatBytes(entry.processedSizeBytes)
                          : "—"}
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {entry.transferredSizeBytes
                          ? formatBytes(entry.transferredSizeBytes)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !history.isLoading && (
            <div className="py-6 text-center text-xs text-zinc-500">
              No session history available for this device.
            </div>
          )
        )}
      </div>

      {/* Per-source 28-day bars */}
      {dataSources.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-medium text-zinc-400">Per Data Source — 28-Day Bars</span>
          {dataSources.map((ds) => {
            const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
            const statusColor =
              ds.lastSessionStatus === "completed"
                ? "text-green-400"
                : ds.lastSessionStatus === "failed"
                  ? "text-red-400"
                  : ds.lastSessionStatus === "completed_with_errors"
                    ? "text-amber-400"
                    : "text-zinc-500";
            return (
              <div key={ds.type} className="bg-zinc-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-xs text-zinc-300">{ds.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className={statusColor}>
                      {STATUS_LABEL[ds.lastSessionStatus ?? ""] ?? "—"}
                    </span>
                    <span className="text-zinc-500">
                      {formatRelativeTime(ds.lastSessionTimestamp)}
                    </span>
                  </div>
                </div>
                <ColorBar28Day days={ds.colorBar28Days} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Errors Tab ──────────────────────────────────────────── */

function ErrorsTab({
  device,
  dataSources,
  totalErrors,
  coveUrl,
}: {
  device: BackupDevice;
  dataSources: BackupDataSource[];
  totalErrors: number;
  coveUrl: string;
}) {
  // Fetch session history to show error timeline
  const history = trpc.backup.getDeviceHistory.useQuery(
    { deviceId: device.sourceId, days: 30 },
    { staleTime: 10 * 60 * 1000 }
  );

  // Filter to sessions with errors
  const errorSessions = useMemo(() => {
    if (!history.data) return [];
    return history.data.filter(
      (entry) => entry.errorsCount != null && entry.errorsCount > 0
    );
  }, [history.data]);

  // Current error summary from device data
  const sourcesWithErrors = dataSources.filter(
    (ds) => ds.errorsCount != null && ds.errorsCount > 0
  );

  if (totalErrors === 0 && errorSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <CheckCircle2 className="h-8 w-8 text-green-500/50 mb-2" />
        <p className="text-sm text-zinc-400">No errors in the last 30 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current session error summary */}
      {sourcesWithErrors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-zinc-200">
              {totalErrors} error{totalErrors !== 1 ? "s" : ""} in last session
            </span>
          </div>
          <div className="space-y-1.5">
            {sourcesWithErrors.map((ds) => {
              const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
              return (
                <div
                  key={ds.type}
                  className="flex items-center justify-between bg-zinc-800/30 rounded-lg px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs text-zinc-300 font-medium">{ds.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-zinc-500">
                      {formatRelativeTime(ds.lastSessionTimestamp)}
                    </span>
                    <span
                      className={cn(
                        ds.lastSessionStatus === "completed" && "text-green-400",
                        ds.lastSessionStatus === "failed" && "text-red-400",
                        ds.lastSessionStatus === "completed_with_errors" && "text-amber-400",
                      )}
                    >
                      {STATUS_LABEL[ds.lastSessionStatus ?? ""] ?? "—"}
                    </span>
                    <span className="text-red-400 font-semibold tabular-nums">
                      {ds.errorsCount} error{(ds.errorsCount ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error history timeline */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-300">Error History (30 days)</span>
          {history.isLoading && (
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <div className="animate-spin h-3 w-3 border border-zinc-600 border-t-zinc-300 rounded-full" />
              Loading...
            </span>
          )}
        </div>

        {errorSessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-1.5 font-medium">Date/Time</th>
                  <th className="text-left py-1.5 font-medium">Data Source</th>
                  <th className="text-left py-1.5 font-medium">Status</th>
                  <th className="text-right py-1.5 font-medium">Errors</th>
                  <th className="text-right py-1.5 font-medium">Selected</th>
                  <th className="text-right py-1.5 font-medium">Processed</th>
                </tr>
              </thead>
              <tbody>
                {errorSessions.map((entry, idx) => {
                  const Icon = SOURCE_ICONS[entry.dataSourceType] ?? HardDrive;
                  return (
                    <tr
                      key={`${entry.timestamp}-${entry.dataSourceType}-${idx}`}
                      className="border-b border-zinc-800/50"
                    >
                      <td className="py-1.5 text-zinc-400 whitespace-nowrap">
                        {formatSessionTimestamp(entry.timestamp)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-zinc-400" />
                          <span className="text-zinc-300">{entry.dataSourceLabel}</span>
                        </div>
                      </td>
                      <td className="py-1.5">
                        <span
                          className={cn(
                            entry.status === "completed" && "text-green-400",
                            entry.status === "failed" && "text-red-400",
                            entry.status === "completed_with_errors" && "text-amber-400",
                            !entry.status && "text-zinc-500"
                          )}
                        >
                          {STATUS_LABEL[entry.status ?? ""] ?? entry.status ?? "—"}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <span className="text-red-400 font-medium tabular-nums">
                          {entry.errorsCount}
                        </span>
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {entry.selectedSizeBytes ? formatBytes(entry.selectedSizeBytes) : "—"}
                      </td>
                      <td className="py-1.5 text-zinc-400 text-right">
                        {entry.processedSizeBytes ? formatBytes(entry.processedSizeBytes) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !history.isLoading && sourcesWithErrors.length === 0 && (
            <div className="py-4 text-center text-xs text-zinc-500">
              No errors found in the last 30 days.
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          For detailed error messages and affected files,{" "}
          <a
            href={coveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300"
            onClick={(e) => e.stopPropagation()}
          >
            view in Cove
          </a>
          .
        </span>
      </div>
    </div>
  );
}

/* ─── Recovery Tab ────────────────────────────────────────── */

function RecoveryTab({
  device,
  dataSources,
  coveUrl,
}: {
  device: BackupDevice;
  dataSources: BackupDataSource[];
  coveUrl: string;
}) {
  // Show recovery readiness — last successful backup per source
  const sourcesWithSuccess = dataSources.filter(
    (ds) => ds.lastSuccessfulTimestamp != null
  );
  const sourcesNeverSucceeded = dataSources.filter(
    (ds) => ds.lastSuccessfulTimestamp == null
  );

  return (
    <div className="space-y-4">
      {/* Recovery readiness header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-teal-400" />
        <span className="text-sm font-medium text-zinc-200">Recovery Readiness</span>
      </div>

      {/* Per-source recovery points */}
      {sourcesWithSuccess.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="text-left py-1.5 font-medium">Data Source</th>
                <th className="text-left py-1.5 font-medium">Latest Recovery Point</th>
                <th className="text-left py-1.5 font-medium">Age</th>
                <th className="text-left py-1.5 font-medium">Status</th>
                <th className="text-right py-1.5 font-medium">Protected Size</th>
                <th className="text-right py-1.5 font-medium">Files</th>
              </tr>
            </thead>
            <tbody>
              {sourcesWithSuccess.map((ds) => {
                const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
                const sinceSuccess = daysSinceLastSuccess(ds.lastSuccessfulTimestamp);
                return (
                  <tr key={ds.type} className="border-b border-zinc-800/50">
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="text-zinc-300">{ds.label}</span>
                      </div>
                    </td>
                    <td className="py-1.5 text-zinc-400">
                      {formatSessionTimestamp(ds.lastSuccessfulTimestamp!)}
                    </td>
                    <td className="py-1.5">
                      <span className={cn("font-medium", sinceSuccess.color)}>
                        {sinceSuccess.text}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <span
                        className={cn(
                          ds.lastSessionStatus === "completed" && "text-green-400",
                          ds.lastSessionStatus === "failed" && "text-red-400",
                          ds.lastSessionStatus === "completed_with_errors" && "text-amber-400",
                          !ds.lastSessionStatus && "text-zinc-500"
                        )}
                      >
                        {STATUS_LABEL[ds.lastSessionStatus ?? ""] ?? "—"}
                      </span>
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right">
                      {ds.protectedSizeBytes
                        ? formatBytes(ds.protectedSizeBytes)
                        : "—"}
                    </td>
                    <td className="py-1.5 text-zinc-400 text-right tabular-nums">
                      {ds.selectedCount != null
                        ? ds.selectedCount.toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-zinc-500">
          No successful backup sessions found for this device.
        </div>
      )}

      {/* Sources that have never succeeded */}
      {sourcesNeverSucceeded.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-amber-400/80">
            No recovery point available
          </span>
          {sourcesNeverSucceeded.map((ds) => {
            const Icon = SOURCE_ICONS[ds.type] ?? HardDrive;
            return (
              <div
                key={ds.type}
                className="flex items-center gap-2 bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-2.5"
              >
                <Icon className="h-3.5 w-3.5 text-amber-400/60" />
                <span className="text-xs text-zinc-400">{ds.label}</span>
                <span className="text-xs text-amber-400/60 ml-auto">Never succeeded</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Storage & LSV info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-800/30 rounded-lg p-4">
        <div>
          <div className="text-[11px] text-zinc-500 mb-0.5">Total Protected</div>
          <div className="text-sm font-medium text-zinc-200">
            {formatBytes(device.protectedSizeBytes)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 mb-0.5">Used Storage</div>
          <div className="text-sm font-medium text-zinc-200">
            {formatBytes(device.usedStorageBytes)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 mb-0.5">LocalSpeedVault</div>
          <div className={cn("text-sm font-medium", device.lsvEnabled ? "text-green-400" : "text-zinc-500")}>
            {device.lsvEnabled ? "Enabled" : "Disabled"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500 mb-0.5">Storage Status</div>
          <div className={cn("text-sm font-medium", STORAGE_STATUS_COLORS[device.storageStatus ?? ""]?.color ?? "text-zinc-500")}>
            {STORAGE_STATUS_COLORS[device.storageStatus ?? ""]?.label ?? device.storageStatus ?? "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          To initiate a restore or run recovery testing,{" "}
          <a
            href={coveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300"
            onClick={(e) => e.stopPropagation()}
          >
            open in Cove
          </a>
          .
        </span>
      </div>
    </div>
  );
}

/* ─── Metadata Field Helper ──────────────────────────────── */

function MetaField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === "—") return null;
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

/* ─── Main Table ───────────────────────────────────────────── */

interface BackupDeviceTableProps {
  devices: BackupDevice[];
  isLoading: boolean;
}

export function BackupDeviceTable({
  devices,
  isLoading,
}: BackupDeviceTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <div className="animate-spin h-5 w-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full mr-3" />
        Loading backup devices...
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <HardDrive className="h-8 w-8 mb-2" />
        <p>No backup devices found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div className="grid grid-cols-[32px_80px_1.5fr_1fr_70px_42px_80px_80px_minmax(140px,1fr)_100px_32px] gap-1 items-center text-zinc-400 border-b border-zinc-800 text-xs py-2.5 px-1">
        <div />
        <div className="font-medium">Status</div>
        <div className="font-medium">Device</div>
        <div className="font-medium">Customer</div>
        <div className="font-medium">Sources</div>
        <div className="font-medium">Type</div>
        <div className="font-medium">Last Backup</div>
        <div className="font-medium">Since OK</div>
        <div className="font-medium">28-Day History</div>
        <div className="font-medium text-right pr-1">Selected / Used</div>
        <div />
      </div>

      {/* Rows */}
      {devices.map((device) => {
        const isExpanded = expandedId === device.sourceId;
        const TypeIcon = device.osType === "server" ? Server : Monitor;
        const sinceSuccess = daysSinceLastSuccess(device.lastSuccessfulTimestamp);

        return (
          <div
            key={device.sourceId}
            className={cn(
              "border-b border-zinc-800/50 transition-colors",
              isExpanded ? "bg-zinc-900/50" : "hover:bg-zinc-900/30"
            )}
          >
            <button
              className="w-full grid grid-cols-[32px_80px_1.5fr_1fr_70px_42px_80px_80px_minmax(140px,1fr)_100px_32px] gap-1 items-center text-left py-2.5 px-1"
              onClick={() => setExpandedId(isExpanded ? null : device.sourceId)}
            >
              {/* Expand arrow */}
              <div className="flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                )}
              </div>
              {/* Status */}
              <div className="flex items-center gap-1.5">
                <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_DOT[device.overallStatus])} />
                <span className="text-xs text-zinc-400 truncate">
                  {STATUS_LABEL[device.overallStatus] ?? device.overallStatus}
                </span>
              </div>
              {/* Device — computer name primary */}
              <div className="min-w-0 pr-2">
                <div className="text-zinc-200 font-medium text-sm truncate">
                  {device.computerName || device.deviceName}
                </div>
                {device.computerName && device.computerName !== device.deviceName && (
                  <div className="text-[11px] text-zinc-500 truncate">
                    ({device.deviceName})
                  </div>
                )}
              </div>
              {/* Customer */}
              <div className="text-zinc-400 text-xs truncate pr-2">
                {device.customerName}
              </div>
              {/* Sources — derived from dataSources */}
              <div>
                <ActiveSourceIcons dataSources={device.dataSources ?? []} />
              </div>
              {/* Type */}
              <div className="flex items-center justify-center">
                <TypeIcon className="h-3.5 w-3.5 text-zinc-500" />
              </div>
              {/* Last Backup */}
              <div className="text-xs text-zinc-400 truncate">
                {formatRelativeTime(device.lastSessionTimestamp)}
              </div>
              {/* Days Since Success */}
              <div>
                <span className={cn("text-xs font-medium", sinceSuccess.color)}>
                  {sinceSuccess.text}
                </span>
              </div>
              {/* Color Bar */}
              <div className="min-w-0">
                <ColorBar28Day days={device.colorBar28Days} />
              </div>
              {/* Storage — selected / used */}
              <div className="text-right pr-1">
                <div className="text-xs text-zinc-300">
                  {formatBytes(device.selectedSizeBytes)}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {formatBytes(device.usedStorageBytes)} used
                </div>
              </div>
              {/* Open in Cove */}
              <div className="flex items-center justify-center">
                <a
                  href={`https://backup.management/#/accounts/${device.sourceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 hover:text-teal-400 transition-colors"
                  title="Open in Cove"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </button>
            {/* Expanded detail — uses device data directly */}
            {isExpanded && <DeviceExpandedDetail device={device} />}
          </div>
        );
      })}
    </div>
  );
}
