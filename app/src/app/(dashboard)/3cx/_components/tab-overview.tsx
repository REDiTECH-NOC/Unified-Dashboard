"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Cpu,
  Users,
  Radio,
  Phone,
  Shield,
  Server,
  Key,
  RotateCcw,
  Power,
  Settings,
  BarChart3,
  RefreshCw,
} from "lucide-react";

interface TabOverviewProps {
  instanceId: string;
}

function parseLicenseType(productCode: string | null | undefined): string | null {
  if (!productCode) return null;
  const code = productCode.toUpperCase();
  if (code.includes("ENT")) return "Enterprise";
  if (code.includes("PROF") || code.includes("PRO")) return "Professional";
  if (code.includes("STD") || code.includes("STARTUP")) return "Startup";
  return null;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

/* ─── Info Row ─── */
function InfoRow({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-medium", color || "text-foreground")}>{value}</span>
    </div>
  );
}

/* ─── Status Indicator ─── */
function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <span className="text-xs text-foreground">{label}</span>
      <span className={cn("text-xs ml-auto font-medium", ok ? "text-green-500" : "text-red-500")}>
        {ok ? "Healthy" : "Issue"}
      </span>
    </div>
  );
}

/* ─── Progress Bar ─── */
function UsageBar({ label, used, total, unit, inverted }: { label: string; used: number; total: number; unit?: string; inverted?: boolean }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  // inverted = true means high % is GOOD (e.g., trunks online 2/2 = green)
  const color = inverted
    ? (pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500")
    : (pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500");
  const textColor = inverted
    ? (pct >= 80 ? "text-green-500" : pct >= 50 ? "text-yellow-500" : "text-red-500")
    : (pct >= 90 ? "text-red-500" : pct >= 70 ? "text-yellow-500" : "text-green-500");

  return (
    <div className="space-y-1.5 py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-medium", textColor)}>
          {used}{unit ? "" : ""} / {total}{unit ? ` ${unit}` : ""} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-accent overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/* ─── Quick Stat Card ─── */
function QuickStat({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={cn("flex items-center justify-center w-10 h-10 rounded-lg", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}{sub ? ` · ${sub}` : ""}</p>
      </div>
    </div>
  );
}

/* ─── Lazy-loaded Recharts historical charts (deferred mount, 90s refetch) ─── */
const LazyTelemetryCharts = dynamic(
  () => import("./tab-telemetry").then((m) => ({ default: m.TelemetryCharts })),
  { ssr: false, loading: () => null }
);

/* ─── Telemetry Section: Deferred Recharts historical charts ─── */
function TelemetrySection({ instanceId }: { instanceId: string }) {
  const [showCharts, setShowCharts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  // Defer chart mount — let the page finish rendering first, then load Recharts
  useEffect(() => {
    const timer = setTimeout(() => setShowCharts(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await utils.threecx.getSystemTelemetry.invalidate({ instanceId });
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="lg:col-span-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-blue-500" />
        <h3 className="text-sm font-medium text-foreground">System Telemetry</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          title="Refresh telemetry"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      </div>
      {showCharts ? (
        <LazyTelemetryCharts instanceId={instanceId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 h-[220px] flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TabOverview({ instanceId }: TabOverviewProps) {
  const [restartConfirm, setRestartConfirm] = useState<"pbx" | "services" | null>(null);

  const { data: status, isLoading: statusLoading } = trpc.threecx.getSystemStatus.useQuery(
    { instanceId },
    { refetchInterval: 30000, staleTime: 25000 }
  );

  const { data: health, isLoading: healthLoading } = trpc.threecx.getSystemHealth.useQuery(
    { instanceId },
    { refetchInterval: 45000, staleTime: 40000 }
  );

  const { data: services } = trpc.threecx.getServices.useQuery(
    { instanceId },
    { refetchInterval: 60000, staleTime: 55000 }
  );

  const utils = trpc.useUtils();

  const restartPbx = trpc.threecx.restartServer.useMutation({
    onSuccess: () => {
      setRestartConfirm(null);
      utils.threecx.getSystemStatus.invalidate({ instanceId });
    },
  });

  const restartAllServices = trpc.threecx.restartAllServices.useMutation({
    onSuccess: () => {
      setRestartConfirm(null);
      utils.threecx.getServices.invalidate({ instanceId });
    },
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load system status. The PBX may be offline.
      </div>
    );
  }

  const licenseType = parseLicenseType(status.productCode);
  const expirationDays = daysUntil(status.expirationDate);
  const maintenanceDays = daysUntil(status.maintenanceExpiresAt);
  const usedDisk = status.totalDiskSpace - status.freeDiskSpace;
  const runningServices = services?.filter((s) => s.status.toLowerCase() === "running").length ?? 0;
  const totalServices = services?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* ─── Quick Stats (like 3CX partner view) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStat
          label="Active Calls"
          value={`${status.callsActive} / ${status.maxSimCalls}`}
          icon={Phone}
          color="bg-blue-500/10 text-blue-500"
        />
        <QuickStat
          label="SIP Trunks"
          value={`${status.trunksRegistered} / ${status.trunksTotal}`}
          sub={status.trunksRegistered === status.trunksTotal ? "All online" : "Some offline"}
          icon={Radio}
          color={status.trunksRegistered === status.trunksTotal ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}
        />
        <QuickStat
          label="Extensions"
          value={`${status.extensionsRegistered} / ${status.extensionsTotal}`}
          sub={`${status.maxUserExtensions} ext limit`}
          icon={Users}
          color={status.extensionsRegistered > 0 ? "bg-purple-500/10 text-purple-500" : "bg-red-500/10 text-red-500"}
        />
        <QuickStat
          label="Services"
          value={totalServices > 0 ? `${runningServices} / ${totalServices}` : "—"}
          sub={totalServices > 0 && runningServices === totalServices ? "All running" : undefined}
          icon={Settings}
          color={runningServices === totalServices ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ─── System Information ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-medium text-foreground">System Information</h3>
        </div>
        <div>
          <InfoRow label="Version" value={status.version} />
          <InfoRow label="Operating System" value={status.os} />
          <InfoRow label="FQDN" value={status.fqdn} />
          <InfoRow label="Activated" value={status.activated ? "Yes" : "No"} color={status.activated ? "text-green-500" : "text-red-500"} />
          <InfoRow label="Auto-Update" value={status.autoUpdateEnabled ? "Enabled" : "Disabled"} color={status.autoUpdateEnabled ? "text-green-500" : "text-muted-foreground"} />
          <InfoRow label="Backup Scheduled" value={status.backupScheduled ? "Yes" : "No"} color={status.backupScheduled ? "text-green-500" : "text-yellow-500"} />
          {status.lastBackupDateTime && (
            <InfoRow label="Last Backup" value={formatDate(status.lastBackupDateTime)} />
          )}
        </div>
      </div>

      {/* ─── License & Expiration ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-medium text-foreground">License</h3>
        </div>
        <div>
          <InfoRow
            label="License Type"
            value={
              <span>
                {status.maxSimCalls}SC{licenseType ? ` ${licenseType}` : ""}
              </span>
            }
          />
          <InfoRow
            label="Status"
            value={status.licenseActive ? "Active" : "Inactive"}
            color={status.licenseActive ? "text-green-500" : "text-red-500"}
          />
          <InfoRow
            label="Expires"
            value={
              <span className={cn(
                expirationDays !== null && expirationDays <= 30 ? "text-red-500" :
                expirationDays !== null && expirationDays <= 90 ? "text-yellow-500" : ""
              )}>
                {formatDate(status.expirationDate)}
                {expirationDays !== null && (
                  <span className="text-muted-foreground ml-1">
                    ({expirationDays <= 0 ? "expired" : `${expirationDays}d`})
                  </span>
                )}
              </span>
            }
          />
          <InfoRow
            label="Maintenance"
            value={
              <span className={cn(
                maintenanceDays !== null && maintenanceDays <= 30 ? "text-red-500" :
                maintenanceDays !== null && maintenanceDays <= 90 ? "text-yellow-500" : ""
              )}>
                {formatDate(status.maintenanceExpiresAt)}
                {maintenanceDays !== null && (
                  <span className="text-muted-foreground ml-1">
                    ({maintenanceDays <= 0 ? "expired" : `${maintenanceDays}d`})
                  </span>
                )}
              </span>
            }
          />
          <InfoRow
            label="Support"
            value={status.support ? "Active" : "No"}
            color={status.support ? "text-green-500" : "text-muted-foreground"}
          />
          {status.productCode && (
            <InfoRow label="Product Code" value={<span className="font-mono text-[11px]">{status.productCode}</span>} />
          )}
          {status.licenseKey && (
            <InfoRow label="License Key" value={<span className="font-mono text-[11px] truncate max-w-[180px] inline-block">{status.licenseKey}</span>} />
          )}
        </div>
      </div>

      {/* ─── Health Status ─── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-medium text-foreground">Health Check</h3>
        </div>
        <div>
          {healthLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            </div>
          ) : health ? (
            <>
              <StatusDot ok={health.firewall} label="Firewall" />
              <StatusDot ok={health.trunks} label="Trunks" />
              <StatusDot ok={health.phones} label="Phones" />
              <StatusDot ok={!status.hasNotRunningServices} label="All Services Running" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Health data unavailable</p>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Phone className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-medium text-foreground">Live Stats</h3>
          </div>
          <InfoRow
            label="Active Calls"
            value={status.callsActive}
            color={status.callsActive > 0 ? "text-blue-500" : "text-muted-foreground"}
          />
          <InfoRow label="Max Simultaneous Calls" value={status.maxSimCalls} />
        </div>
      </div>

      {/* ─── PBX Capacity (full width) ─── */}
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-medium text-foreground">PBX Capacity</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8">
          <UsageBar label="User Extensions" used={status.userExtensions} total={status.maxUserExtensions} />
          <UsageBar label="Registered Extensions" used={status.extensionsRegistered} total={status.extensionsTotal} />
          <UsageBar label="Trunks" used={status.trunksRegistered} total={status.trunksTotal} inverted />
          <div className="space-y-1.5 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Disk</span>
              <span className={cn("text-xs font-medium",
                status.diskUsagePercent >= 90 ? "text-red-500" :
                status.diskUsagePercent >= 70 ? "text-yellow-500" : "text-green-500"
              )}>
                {formatBytes(usedDisk)} / {formatBytes(status.totalDiskSpace)} ({status.diskUsagePercent}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-accent overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  status.diskUsagePercent >= 90 ? "bg-red-500" :
                  status.diskUsagePercent >= 70 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(status.diskUsagePercent, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── System Telemetry (deferred Recharts charts) ─── */}
      <TelemetrySection instanceId={instanceId} />

      {/* ─── Admin Actions ─── */}
      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Power className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-medium text-foreground">Admin Actions</h3>
        </div>

        {restartConfirm === null ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRestartConfirm("services")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restart All Services
            </button>
            <button
              onClick={() => setRestartConfirm("pbx")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Power className="h-3.5 w-3.5" />
              Restart PBX Server
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <p className="text-sm text-foreground mb-3">
              {restartConfirm === "pbx"
                ? "Are you sure you want to restart the entire PBX server? All active calls will be dropped."
                : "Are you sure you want to restart all services? Active calls may be interrupted."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (restartConfirm === "pbx") {
                    restartPbx.mutate({ instanceId });
                  } else {
                    restartAllServices.mutate({ instanceId });
                  }
                }}
                disabled={restartPbx.isPending || restartAllServices.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                {(restartPbx.isPending || restartAllServices.isPending) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
                Yes, Restart {restartConfirm === "pbx" ? "Server" : "Services"}
              </button>
              <button
                onClick={() => setRestartConfirm(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {(restartPbx.isSuccess || restartAllServices.isSuccess) && (
                <span className="text-xs text-green-500 ml-2">Restart command sent</span>
              )}
              {(restartPbx.isError || restartAllServices.isError) && (
                <span className="text-xs text-red-500 ml-2">
                  {restartPbx.error?.message || restartAllServices.error?.message}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
