"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mail,
  Building2,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { AlertTicketLink } from "./alert-ticket-link";

/* ─── Types ──────────────────────────────────────────── */

type SaasBackupHealth = "healthy" | "warning" | "overdue" | "failed" | "preparing" | "never_ran" | "unknown";

interface BackupAccount {
  id: number;
  email: string;
  displayName: string | null;
  lastBackup: string | null;
  currentBackupStatus: string | null;
  storageBytes: number;
  msgCount: number;
  isDeleted: boolean;
  health: SaasBackupHealth;
  errors: Record<string, string> | null;
  addedOn: string;
}

interface DropsuiteAlertDetailProps {
  alert: {
    sourceId: string;
    title: string;
    deviceHostname?: string;
    organizationName?: string;
    severity: string;
    detectedAt: Date;
  };
}

/* ─── Helpers ────────────────────────────────────────── */

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

const HEALTH_CONFIG: Record<SaasBackupHealth, { label: string; dot: string; color: string }> = {
  healthy:    { label: "Healthy",    dot: "bg-green-500",  color: "text-green-400" },
  warning:    { label: "Warning",    dot: "bg-amber-500",  color: "text-amber-400" },
  overdue:    { label: "Overdue",    dot: "bg-orange-500", color: "text-orange-400" },
  failed:     { label: "Failed",     dot: "bg-red-500",    color: "text-red-400" },
  preparing:  { label: "Preparing",  dot: "bg-blue-500",   color: "text-blue-400" },
  never_ran:  { label: "Never Ran",  dot: "bg-zinc-600",   color: "text-zinc-400" },
  unknown:    { label: "Unknown",    dot: "bg-zinc-600",   color: "text-zinc-500" },
};

function DetailRow({ label, value, valueClass }: { label: string; value: string | null | undefined; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
      <span className={cn("text-[10px] text-right font-medium truncate max-w-[200px]", valueClass ?? "text-foreground")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────── */

export function DropsuiteAlertDetail({ alert }: DropsuiteAlertDetailProps) {
  const router = useRouter();

  // Extract org name from alert
  const orgName = alert.organizationName ?? "Unknown Org";
  const email = alert.deviceHostname; // Dropsuite uses email as "hostname"

  // Fetch all orgs + their alerts to find this specific account
  const orgs = trpc.saasBackup.getOrganizations.useQuery(undefined, {
    retry: 1,
    staleTime: 5 * 60_000,
  });

  // Find the matching org
  const matchedOrg = useMemo(() => {
    if (!orgs.data) return null;
    return (orgs.data as Array<{ organizationName: string; authenticationToken: string; sourceId: string }>)
      .find((o) => o.organizationName === orgName);
  }, [orgs.data, orgName]);

  // Fetch backup accounts for the matched org
  const accounts = trpc.saasBackup.getBackupAccounts.useQuery(
    { orgAuthToken: matchedOrg?.authenticationToken ?? "" },
    {
      enabled: !!matchedOrg,
      retry: 1,
      staleTime: 5 * 60_000,
    }
  );

  // Find the specific account matching this alert
  const account = useMemo(() => {
    if (!accounts.data || !email) return null;
    return (accounts.data as BackupAccount[]).find(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
  }, [accounts.data, email]);

  // Also get a summary of other accounts in this org for context
  const orgStats = useMemo(() => {
    if (!accounts.data) return null;
    const all = accounts.data as BackupAccount[];
    let healthy = 0, warning = 0, overdue = 0, failed = 0, other = 0;
    let totalStorage = 0;
    for (const a of all) {
      totalStorage += a.storageBytes;
      switch (a.health) {
        case "healthy": healthy++; break;
        case "warning": warning++; break;
        case "overdue": overdue++; break;
        case "failed": failed++; break;
        default: other++; break;
      }
    }
    return { total: all.length, healthy, warning, overdue, failed, other, totalStorage };
  }, [accounts.data]);

  if (orgs.isLoading || (matchedOrg && accounts.isLoading)) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading SaaS backup details...</span>
      </div>
    );
  }

  if (!matchedOrg) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className="text-xs text-muted-foreground">
            Organization &quot;{orgName}&quot; not found in Dropsuite
          </span>
        </div>
        <AlertTicketLink
          hostname={email}
          organizationName={orgName}
          alertContext={{
            title: alert.title,
            severity: alert.severity,
            source: "dropsuite",
            deviceHostname: email,
            detectedAt: alert.detectedAt,
          }}
        />
      </div>
    );
  }

  const healthCfg = account ? HEALTH_CONFIG[account.health] : null;

  return (
    <div className="space-y-4">
      {/* ── Alert Banner ──────────────────────────────── */}
      {account && (account.health === "failed" || account.health === "overdue" || account.health === "warning") && (
        <div className={cn(
          "rounded-lg border p-3 space-y-2",
          account.health === "failed" ? "border-red-500/30 bg-red-500/5" :
          account.health === "overdue" ? "border-orange-500/30 bg-orange-500/5" :
          "border-amber-500/30 bg-amber-500/5"
        )}>
          <div className="flex items-center gap-2">
            <ShieldAlert className={cn("h-4 w-4 flex-shrink-0",
              account.health === "failed" ? "text-red-400" :
              account.health === "overdue" ? "text-orange-400" :
              "text-amber-400"
            )} />
            <span className={cn("text-[11px] font-medium",
              account.health === "failed" ? "text-red-400" :
              account.health === "overdue" ? "text-orange-400" :
              "text-amber-400"
            )}>
              {account.health === "failed" ? "Backup Failed" :
               account.health === "overdue" ? "Backup Overdue" :
               "Backup Warning"}
            </span>
          </div>
          <div className="pl-6 space-y-1">
            <p className="text-[10px] text-muted-foreground">
              Last backup: <span className="text-foreground font-medium">{formatRelativeTime(account.lastBackup)}</span>
            </p>
            {account.currentBackupStatus && (
              <p className="text-[10px] text-muted-foreground">
                Status: <span className="text-foreground font-medium">{account.currentBackupStatus}</span>
              </p>
            )}
            {account.errors && Object.keys(account.errors).length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                <span className="text-[10px] text-red-400 font-medium">Errors:</span>
                {Object.entries(account.errors).map(([key, msg]) => (
                  <p key={key} className="text-[10px] text-red-400/80 pl-2">
                    {key}: {msg}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2-Column Info Grid ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Column 1: Account Info */}
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4 text-cyan-400" />
            <span className="text-[11px] font-medium text-foreground">Account Info</span>
          </div>
          <DetailRow label="Email" value={email} />
          {account?.displayName && <DetailRow label="Name" value={account.displayName} />}
          <DetailRow label="Organization" value={orgName} />
          {account && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Health</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className={cn("w-2 h-2 rounded-full", healthCfg?.dot ?? "bg-zinc-600")} />
                <span className={cn("text-[10px] font-medium", healthCfg?.color ?? "text-zinc-500")}>
                  {healthCfg?.label ?? "Unknown"}
                </span>
              </div>
            </div>
          )}
          {account && <DetailRow label="Added" value={new Date(account.addedOn).toLocaleDateString()} />}
          {account?.isDeleted && (
            <DetailRow label="Status" value="Deleted" valueClass="text-red-400" />
          )}
        </div>

        {/* Column 2: Backup Status */}
        <div className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-4 w-4 text-cyan-400" />
            <span className="text-[11px] font-medium text-foreground">Backup Status</span>
          </div>
          {account ? (
            <>
              <DetailRow label="Last Backup" value={formatRelativeTime(account.lastBackup)} />
              {account.lastBackup && (
                <DetailRow
                  label="Last Backup Date"
                  value={new Date(account.lastBackup).toLocaleString()}
                />
              )}
              <DetailRow label="Storage Used" value={formatBytes(account.storageBytes)} />
              <DetailRow label="Messages" value={account.msgCount.toLocaleString()} />
              {account.currentBackupStatus && (
                <DetailRow label="Current Status" value={account.currentBackupStatus} />
              )}
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">Account details not available</p>
          )}
        </div>
      </div>

      {/* ── Org Health Overview ──────────────────────────── */}
      {orgStats && (
        <div className="p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <span className="text-[11px] font-medium text-foreground">{orgName} — Org Overview</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <StatBadge label="Total" count={orgStats.total} />
            <StatBadge label="Healthy" count={orgStats.healthy} color="text-green-400" />
            <StatBadge label="Warning" count={orgStats.warning} color="text-amber-400" />
            <StatBadge label="Overdue" count={orgStats.overdue} color="text-orange-400" />
            <StatBadge label="Failed" count={orgStats.failed} color="text-red-400" />
            <StatBadge label="Storage" count={formatBytes(orgStats.totalStorage)} />
          </div>
          {/* Health bar */}
          {orgStats.total > 0 && (
            <div className="mt-2 flex h-1.5 rounded-full overflow-hidden bg-accent">
              {orgStats.healthy > 0 && (
                <div className="h-full bg-green-500" style={{ width: `${(orgStats.healthy / orgStats.total) * 100}%` }} />
              )}
              {orgStats.warning > 0 && (
                <div className="h-full bg-amber-500" style={{ width: `${(orgStats.warning / orgStats.total) * 100}%` }} />
              )}
              {orgStats.overdue > 0 && (
                <div className="h-full bg-orange-500" style={{ width: `${(orgStats.overdue / orgStats.total) * 100}%` }} />
              )}
              {orgStats.failed > 0 && (
                <div className="h-full bg-red-500" style={{ width: `${(orgStats.failed / orgStats.total) * 100}%` }} />
              )}
              {orgStats.other > 0 && (
                <div className="h-full bg-zinc-600" style={{ width: `${(orgStats.other / orgStats.total) * 100}%` }} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Related Tickets ────────────────────────────── */}
      <AlertTicketLink
        hostname={email}
        organizationName={orgName}
        toolId="dropsuite"
        alertContext={{
          title: alert.title,
          severity: alert.severity,
          source: "dropsuite",
          deviceHostname: email,
          detectedAt: alert.detectedAt,
        }}
      />

      {/* ── Actions ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/backups?tab=dropsuite${orgName ? `&org=${encodeURIComponent(orgName)}` : ""}`)}
          className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
        >
          <ArrowRight className="h-3 w-3" />
          Open in Backups
        </button>
      </div>
    </div>
  );
}

/* ─── Stat Badge ──────────────────────────────────────── */

function StatBadge({ label, count, color }: { label: string; count: number | string; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-sm font-bold tabular-nums", color ?? "text-foreground")}>{count}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
