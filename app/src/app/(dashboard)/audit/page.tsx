"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScrollText,
  Shield,
  LogIn,
  Users,
  Plug,
  Server,
  Globe,
  Database,
  ChevronDown,
  ChevronRight,
  Download,
  Settings2,
  Trash2,
  HardDrive,
  Calendar,
  Clock,
  Bell,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { useSession } from "next-auth/react";

type AuditCategory = "AUTH" | "USER" | "SECURITY" | "INTEGRATION" | "NOTIFICATION" | "SYSTEM" | "API" | "DATA";

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; icon: typeof Shield; color: string }> = {
  AUTH:         { label: "Authentication",  icon: LogIn,    color: "text-blue-400" },
  USER:         { label: "User Management", icon: Users,    color: "text-emerald-400" },
  SECURITY:     { label: "Security",        icon: Shield,   color: "text-red-400" },
  INTEGRATION:  { label: "Integrations",    icon: Plug,     color: "text-amber-400" },
  NOTIFICATION: { label: "Notifications",   icon: Bell,     color: "text-pink-400" },
  SYSTEM:       { label: "System",          icon: Server,   color: "text-purple-400" },
  API:          { label: "API Activity",    icon: Globe,    color: "text-cyan-400" },
  DATA:         { label: "Data & Reports",  icon: Database,  color: "text-orange-400" },
};

/** Convert raw action strings to human-readable descriptions, pulling from detail JSON */
function describeAction(action: string, detail: Record<string, any> | null, resource?: string | null): string {
  const d = detail || {};

  switch (action) {
    // Billing
    case "BILLING_RECONCILE":
      return d.companyName
        ? `Reconciled billing for ${d.companyName} — ${d.totalItems ?? 0} items, ${d.discrepancies ?? 0} discrepancies`
        : "Reconciled company billing";
    case "BILLING_RECONCILE_ALL":
      return `Reconciled all companies — ${d.companiesProcessed ?? 0} companies, ${d.totalDiscrepancies ?? 0} discrepancies`;
    case "BILLING_RESOLVE_ITEM":
      return `Resolved billing item: ${d.productName ?? "unknown"} (${d.resolution ?? d.action ?? "resolved"})${d.companyName ? ` for ${d.companyName}` : ""}${d.note ? ` — "${d.note}"` : ""}`;
    case "BILLING_BULK_RESOLVE":
      return `Bulk resolved ${d.count ?? d.itemIds?.length ?? 0} billing items (${d.action ?? "resolved"})${d.companyNames?.length ? ` — ${d.companyNames.join(", ")}` : ""}`;
    case "BILLING_ITEM_NOTE_UPDATED":
      return `Updated billing note for "${d.productName ?? "item"}"${d.companyName ? ` (${d.companyName})` : ""}`;
    case "BILLING_RECONCILE_TO_PSA":
      return `Pushed to PSA: ${d.product ?? "product"} (${d.vendor ?? "vendor"})${d.quantityDelta ? `, qty delta: ${d.quantityDelta}` : ""}`;
    case "billing.bulk_reconcile_to_psa":
      return `Bulk pushed ${d.itemCount ?? 0} items to PSA — ${d.successCount ?? 0} succeeded, ${d.errorCount ?? 0} failed`;
    case "BILLING_QUICK_MAP":
      return `Quick-mapped vendor product "${d.vendorProductName ?? ""}" → PSA "${d.psaProductName ?? ""}" (${d.vendorToolId ?? ""})`;
    case "BILLING_MAPPING_UPDATE":
      return `Updated product mapping ${d.mappingId ?? ""}`;
    case "BILLING_MAPPING_DELETE":
      return `Deleted product mapping: ${d.vendorProductName ?? ""} (${d.vendorToolId ?? ""})`;
    case "BILLING_SYNC_VENDOR_PRODUCTS":
      return `Synced vendor products — ${d.created ?? 0} created, ${d.updated ?? 0} updated`;
    case "BILLING_SETTINGS_UPDATE":
      return "Updated billing settings";
    case "billing.vendor_counts.synced":
      return `Synced vendor counts for company ${d.companyId ?? resource ?? ""}`;
    case "billing.vendor_counts.sync_all":
      return `Synced vendor counts for all companies — ${d.processed ?? 0}/${d.total ?? 0} processed`;
    case "billing.sync_schedule.updated":
      return `Updated billing sync schedule: ${d.enabled ? "enabled" : "disabled"}, ${d.frequency ?? ""}`;
    case "billing.product_mapping.created":
      return `Created product mapping: ${d.vendorProductName ?? d.vendorProductKey ?? ""} (${d.vendorToolId ?? ""})`;
    case "billing.vendor_product.created":
      return `Created vendor product: ${d.productName ?? ""} (${d.vendorToolId ?? ""})`;
    case "billing.vendor_product.deleted":
      return `Deleted vendor product: ${d.productName ?? ""} (${d.vendorToolId ?? ""})`;
    case "billing.vendor_product.toggled":
      return `${d.isActive ? "Enabled" : "Disabled"} vendor product: ${d.productName ?? ""}`;
    case "billing.product_assignment.created":
      return `Assigned product "${d.productName ?? ""}" to company ${d.companyId ?? ""}`;
    case "billing.product_assignment.removed":
      return `Removed product "${d.productName ?? ""}" from company ${d.companyId ?? ""}`;

    // Company / integration mapping
    case "company.mapping.set":
      return `Mapped company to ${d.toolId ?? "tool"}: "${d.externalName ?? d.externalId ?? ""}"`;
    case "company.mapping.removed":
      return `Removed ${d.toolId ?? "tool"} mapping from company`;
    case "company.sync.auto_started":
      return "Started auto-sync of company data";
    case "company.sync.completed":
      return `Completed company sync — ${d.created ?? 0} created, ${d.updated ?? 0} updated`;

    // Auth
    case "auth.login":
    case "auth.sso_login":
      return `Signed in${d.provider ? ` via ${d.provider}` : ""}${d.email ? ` (${d.email})` : ""}`;
    case "auth.local.login":
      return `Local sign-in${d.email ? ` — ${d.email}` : ""}${d.role ? ` [${d.role}]` : ""}`;
    case "auth.local.failed":
      return `Local login failed${d.email ? ` for ${d.email}` : ""}${d.reason ? ` — ${d.reason}` : ""}`;
    case "auth.local.ratelimited":
      return `Login rate-limited${d.email ? ` for ${d.email}` : ""}${d.retryAfter ? ` — retry after ${d.retryAfter}s` : ""}`;
    case "auth.local.totp.ratelimited":
      return `TOTP rate-limited${d.email ? ` for ${d.email}` : ""}`;
    case "auth.local.totp.failed":
      return `TOTP verification failed${d.email ? ` for ${d.email}` : ""}`;
    case "auth.login.denied":
      return `Login denied${d.email ? ` for ${d.email}` : ""}${d.reason ? ` — ${d.reason}` : ""}`;
    case "auth.logout":
      return "Signed out";
    case "auth.login_failed":
      return `Login failed${d.reason ? `: ${d.reason}` : ""}`;
    case "auth.totp.setup_initiated":
      return "Initiated TOTP/MFA setup";
    case "auth.totp.verification_failed":
      return "TOTP verification failed — invalid code";
    case "auth.totp.enabled":
      return "Enabled TOTP/MFA on account";
    case "user.provisioned":
      return `Auto-provisioned user${d.email ? ` ${d.email}` : ""}${d.role ? ` as ${d.role}` : ""}`;
    case "user.role.synced":
      return `Role synced from Entra — ${d.previousRole ?? "?"} → ${d.newRole ?? "?"}`;
    case "member.matching.auto_login":
      return `Auto-matched to ConnectWise member${d.externalName ? ` "${d.externalName}"` : ""}${d.externalId ? ` (ID: ${d.externalId})` : ""}`;

    // User management
    case "user.role.updated":
      return `Changed role${d.targetEmail ? ` for ${d.targetEmail}` : ""}: ${d.previousRole ?? "?"} → ${d.newRole ?? "unknown"}`;
    case "user.created":
      return `Created user${d.email ? `: ${d.email}` : ""}`;
    case "user.deleted":
      return `Deleted user${d.email ? `: ${d.email}` : ""}`;
    case "user.profile.updated":
      return "Updated profile settings";
    case "user.permission.set":
      return `Set permission "${d.permission ?? "?"}" to ${d.granted ? "granted" : "denied"}${d.targetEmail ? ` for ${d.targetEmail}` : ""}${d.previousGranted !== undefined ? ` (was ${d.previousGranted ? "granted" : "denied"})` : ""}`;
    case "user.permission.reset":
      return `Reset permission "${d.permission ?? "?"}" to default${d.targetEmail ? ` for ${d.targetEmail}` : ""}`;
    case "user.feature_flag.set":
      return `Set feature flag "${d.flag ?? "?"}" to ${d.enabled ? "enabled" : "disabled"}${d.targetEmail ? ` for ${d.targetEmail}` : ""}${d.value !== undefined ? ` (value: ${d.value})` : ""}`;

    // Notifications
    case "notification.dismissed":
      return "Dismissed a notification";
    case "psa.callback.registered":
      return `Registered CW webhook callback${d.callbackId ? ` (ID: ${d.callbackId})` : ""}`;
    case "psa.callback.deleted":
      return `Deleted CW webhook callback ${d.callbackId ?? ""}`;

    // EDR / SentinelOne security actions
    case "security.threat.kill":
      return `Killed threat${resource ? ` (${resource})` : ""}`;
    case "security.threat.quarantine":
      return `Quarantined threat${resource ? ` (${resource})` : ""}`;
    case "security.threat.remediate":
      return `Remediated threat${resource ? ` (${resource})` : ""}`;
    case "security.threat.rollback":
      return `Rolled back threat${resource ? ` (${resource})` : ""}`;
    case "security.threat.incident.resolved":
      return `Marked ${d.count ?? d.threatIds?.length ?? 1} threat(s) as resolved`;
    case "security.threat.incident.in_progress":
      return `Marked ${d.count ?? 1} threat(s) as in progress`;
    case "security.threat.incident.unresolved":
      return `Marked ${d.count ?? 1} threat(s) as unresolved`;
    case "security.threat.verdict.true_positive":
      return `Classified ${d.count ?? 1} threat(s) as true positive`;
    case "security.threat.verdict.false_positive":
      return `Classified ${d.count ?? 1} threat(s) as false positive`;
    case "security.threat.verdict.suspicious":
      return `Classified ${d.count ?? 1} threat(s) as suspicious`;
    case "security.threat.verdict.undefined":
      return `Reset verdict on ${d.count ?? 1} threat(s)`;
    case "security.threat.marked_benign":
      return `Marked ${d.count ?? 1} threat(s) as benign${d.whiteningOption ? ` (${d.whiteningOption})` : ""}`;
    case "security.threat.marked_threat":
      return `Marked ${d.count ?? 1} item(s) as threat${d.whiteningOption ? ` (${d.whiteningOption})` : ""}`;
    case "security.threat.note.added":
      return `Added note to threat${resource ? ` ${resource}` : ""}`;
    case "security.action.isolate":
      return `Isolated device${d.hostname ? ` "${d.hostname}"` : ""}${d.organization ? ` (${d.organization})` : d.organizationName ? ` (${d.organizationName})` : ""}${d.os ? ` [${d.os}]` : ""}`;
    case "security.action.unisolate":
      return `Unisolated device${d.hostname ? ` "${d.hostname}"` : ""}${d.organizationName ? ` (${d.organizationName})` : ""}`;
    case "security.action.scan":
      return `Triggered full scan on${d.hostname ? ` "${d.hostname}"` : " device"}${d.organizationName ? ` (${d.organizationName})` : ""}`;
    case "security.exclusion.created":
      return `Created exclusion: ${d.type ?? "?"} — "${d.value ?? ""}"`;
    case "security.exclusion.deleted":
      return `Deleted exclusion${resource ? ` ${resource}` : ""}`;
    case "security.dv.query.started":
      return `Started Deep Visibility query${d.queryId ? ` (ID: ${d.queryId})` : ""}`;

    // Blackpoint
    case "blackpoint.email_channel.tested":
      return "Tested Blackpoint email notification channel";
    case "blackpoint.webhook_channel.tested":
      return "Tested Blackpoint webhook notification channel";

    // CIPP / M365
    case "cipp.user.clearImmutableId":
      return `Cleared immutable ID${d.userId ? ` for user ${d.userId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;
    case "cipp.user.sendPush":
      return `Sent push notification${d.userId ? ` to ${d.userId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;
    case "cipp.user.hideFromGAL":
      return `Hidden user from GAL${d.userId ? `: ${d.userId}` : ""}`;
    case "cipp.user.showInGAL":
      return `Shown user in GAL${d.userId ? `: ${d.userId}` : ""}`;
    case "cipp.user.getRecoveryKey":
      return `Retrieved BitLocker recovery key${d.userId ? ` for ${d.userId}` : ""}`;
    case "cipp.deletedItem.restore":
      return `Restored deleted item${d.itemId ? `: ${d.itemId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;
    case "cipp.user.getLAPS":
      return `Retrieved LAPS password${d.deviceId ? ` for device ${d.deviceId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;
    case "cipp.intune.getRecoveryKey":
      return `Retrieved Intune recovery key${d.deviceId ? ` for device ${d.deviceId}` : ""}`;
    case "cipp.intune.syncAPDevices":
      return `Synced Autopilot devices${d.tenantFilter ? ` for ${d.tenantFilter}` : ""}`;
    case "cipp.scheduledItem.remove":
      return `Removed scheduled item${d.itemId ? ` ${d.itemId}` : ""}`;
    case "cipp.mailbox.enableArchive":
      return `Enabled mailbox archive${d.userId ? ` for ${d.userId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;
    case "cipp.onedrive.provision":
      return `Provisioned OneDrive${d.userId ? ` for ${d.userId}` : ""}${d.tenantFilter ? ` (${d.tenantFilter})` : ""}`;

    // RMM
    case "rmm.webhook.deleted":
      return `Deleted NinjaOne webhook${d.webhookId ? ` (ID: ${d.webhookId})` : ""}`;

    // Backup
    case "backup.customer_note.updated":
      return `Updated backup customer note${d.covePartnerId ? ` for partner ${d.covePartnerId}` : ""}`;

    // 3CX
    case "threecx.instances.refresh_all":
      return `Refreshed all 3CX instances — ${d.online ?? 0}/${d.total ?? 0} online`;
    case "threecx.services.restarted":
      return `Restarted all services on 3CX instance${d.instanceName ? ` "${d.instanceName}"` : ""}${d.fqdn ? ` (${d.fqdn})` : ""}`;
    case "threecx.server.restarted":
      return `Restarted 3CX server${d.instanceName ? ` "${d.instanceName}"` : ""}${d.fqdn ? ` (${d.fqdn})` : ""}`;
    case "threecx.instance.linked":
      return `Linked 3CX instance${d.instanceName ? ` "${d.instanceName}"` : ""} to company`;
    case "threecx.instance.unlinked":
      return `Unlinked 3CX instance from company`;

    // Permission roles
    case "permission_role.created":
      return `Created permission role "${d.name ?? ""}"${d.permissions?.length ? ` with ${d.permissions.length} permissions` : ""}`;
    case "permission_role.updated":
      return `Updated permission role "${d.name ?? ""}"${d.previousName && d.previousName !== d.name ? ` (was "${d.previousName}")` : ""}`;
    case "permission_role.deleted":
      return `Deleted permission role "${d.name ?? ""}"${d.usersAffected ? ` — ${d.usersAffected} user(s) affected` : ""}`;
    case "permission_role.assigned":
      return `Assigned role "${d.roleName ?? ""}" to${d.targetEmail ? ` ${d.targetEmail}` : " user"}`;
    case "permission_role.removed":
      return `Removed role "${d.roleName ?? ""}" from${d.targetEmail ? ` ${d.targetEmail}` : " user"}`;

    // Integration / connector config
    case "integration.credential.saved":
      return `Saved ${d.toolId ?? "integration"} credentials`;
    case "integration.credential.deleted":
      return `Deleted ${d.toolId ?? "integration"} credentials`;
    case "integration.connection.tested":
      return `Tested connection to ${d.toolId ?? "integration"} — ${d.success ? "success" : "failed"}`;
    case "integration.sso.saved":
      return "Updated SSO/Entra ID configuration";
    case "integration.sso.deleted":
      return "Deleted SSO/Entra ID configuration";
    case "integration.sync_config.saved":
      return `Saved ${d.toolId ?? "integration"} sync configuration`;
    case "integration.credential.verified":
      return `Verified ${d.toolId ?? "integration"} credentials`;

    // Company management
    case "company.custom_fields.updated":
      return `Updated custom fields${d.companyName ? ` for ${d.companyName}` : ""}`;
    case "company.threecx.linked":
      return `Linked company to 3CX instance${d.instanceName ? ` "${d.instanceName}"` : ""}`;
    case "company.threecx.unlinked":
      return `Unlinked company from 3CX instance${d.previousInstanceId ? ` (was ${d.previousInstanceId})` : ""}`;

    // Cron jobs
    case "cron.alert_check.executed":
      return `Alert check completed — ${d.alertsFound ?? d.newAlerts ?? 0} alerts found`;
    case "cron.alert_check.failed":
      return `Alert check failed: ${d.error ?? "unknown error"}`;
    case "cron.threecx_poll.executed":
      return `3CX poll — ${d.online ?? 0}/${d.polled ?? 0} online, ${d.offline ?? 0} offline`;
    case "cron.fleet_refresh.executed":
      return `Fleet data refresh completed`;
    case "cron.audit_cleanup.executed":
      return `Audit cleanup — deleted ${d.deleted ?? 0} events older than ${d.retentionDays ?? "?"} days`;

    // Audit config
    case "audit.retention_config.updated":
      return `Updated retention: ${d.retentionDays ?? "?"} days, auto-cleanup ${d.autoCleanupEnabled ? "enabled" : "disabled"}, ${d.cleanupFrequency ?? ""} frequency`;
    case "audit.exported":
      return `Exported ${d.rowCount ?? 0} audit events to CSV`;

    default:
      // Fallback: humanize the action string
      return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

const OUTCOME_VARIANT: Record<string, string> = {
  success: "success",
  failure: "warning",
  denied: "destructive",
};

function RetentionPanel() {
  const utils = trpc.useUtils();
  const { data: config, isLoading: configLoading } = trpc.audit.getRetentionConfig.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.audit.getStats.useQuery();
  const { dateTime } = useTimezone();

  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [autoCleanup, setAutoCleanup] = useState<boolean | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Export state
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const updateConfig = trpc.audit.updateRetentionConfig.useMutation({
    onSuccess: () => {
      utils.audit.getRetentionConfig.invalidate();
      utils.audit.getStats.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const exportCsv = trpc.audit.exportCsv.useMutation();

  const effectiveRetention = retentionDays ?? config?.retentionDays ?? 2555;
  const effectiveAutoCleanup = autoCleanup ?? config?.autoCleanupEnabled ?? false;
  const effectiveFrequency = frequency ?? config?.cleanupFrequency ?? "monthly";

  function handleSave() {
    updateConfig.mutate({
      retentionDays: effectiveRetention,
      autoCleanupEnabled: effectiveAutoCleanup,
      cleanupFrequency: effectiveFrequency as "daily" | "weekly" | "monthly",
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportCsv.mutateAsync({
        startDate: exportStart || undefined,
        endDate: exportEnd || undefined,
      });
      // Trigger CSV download
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (configLoading || statsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading retention settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-3.5 w-3.5" />
              <span className="text-xs">Total Events</span>
            </div>
            <p className="text-xl font-semibold">{stats?.totalEvents?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span className="text-xs">Est. Size</span>
            </div>
            <p className="text-xl font-semibold">{stats?.estimatedSizeMb ?? 0} MB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Oldest Entry</span>
            </div>
            <p className="text-sm font-semibold">
              {stats?.oldestEventDate ? dateTime(stats.oldestEventDate) : "None"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-xs">Expired Events</span>
            </div>
            <p className="text-xl font-semibold">{stats?.expiredCount?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Retention Config + Export */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Retention Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Retention Period (days)</label>
              <Input
                type="number"
                min={30}
                max={3650}
                value={effectiveRetention}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {Math.round(effectiveRetention / 365 * 10) / 10} years — Industry standard: 7 years (HIPAA/SOC 2)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoCleanup(!effectiveAutoCleanup)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  effectiveAutoCleanup ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    effectiveAutoCleanup ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
              <span className="text-sm">Auto-cleanup expired events</span>
            </div>

            {effectiveAutoCleanup && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cleanup Frequency</label>
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        effectiveFrequency === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stats?.lastCleanupAt && (
              <p className="text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                Last cleanup: {dateTime(stats.lastCleanupAt)} ({stats.lastCleanupCount.toLocaleString()} events removed)
              </p>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {saved ? "Saved" : updateConfig.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4" /> Export Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Download audit events as CSV for compliance reporting or archival.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End Date</label>
                <Input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Max 10,000 events per export. Leave dates blank for most recent.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Render key-value detail fields in a readable way */
function DetailGrid({ detail }: { detail: Record<string, any> }) {
  const entries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mt-2 pl-11 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <span className="text-muted-foreground font-medium">
            {key.replace(/([A-Z])/g, " $1").replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()).trim()}
          </span>
          <span className="text-foreground/80 break-all">
            {typeof value === "object" ? JSON.stringify(value, null, 0) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | undefined>(undefined);
  const [selectedOutcome, setSelectedOutcome] = useState<"success" | "failure" | "denied" | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showRetention, setShowRetention] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.audit.list.useInfiniteQuery(
      {
        limit: 50,
        category: selectedCategory,
        outcome: selectedOutcome,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const { data: categoryCounts } = trpc.audit.categoryCounts.useQuery();
  const { dateTime } = useTimezone();

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Immutable record of all platform activity — filter by category or outcome
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetention(!showRetention)}
            className="gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showRetention ? "Hide Settings" : "Retention & Export"}
          </Button>
        )}
      </div>

      {/* Retention & Export Panel (admin only) */}
      {isAdmin && showRetention && <RetentionPanel />}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(undefined)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All{categoryCounts ? ` (${Object.values(categoryCounts).reduce((a, b) => a + b, 0)})` : ""}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as AuditCategory[]).map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const count = categoryCounts?.[cat] || 0;
          const Icon = config.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-3 w-3 ${selectedCategory === cat ? "" : config.color}`} />
              {config.label}
              {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Outcome filter */}
      <div className="flex gap-2">
        {(["success", "failure", "denied"] as const).map((outcome) => (
          <button
            key={outcome}
            onClick={() => setSelectedOutcome(selectedOutcome === outcome ? undefined : outcome)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedOutcome === outcome
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {outcome}
          </button>
        ))}
      </div>

      {/* Events list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedCategory ? CATEGORY_CONFIG[selectedCategory].label : "All"} Events
            {selectedOutcome && ` — ${selectedOutcome}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading audit events...</p>
          ) : allItems.length > 0 ? (
            <div className="space-y-1">
              {allItems.map((event) => {
                const catConfig = CATEGORY_CONFIG[event.category as AuditCategory];
                const CatIcon = catConfig?.icon || ScrollText;
                const detail = event.detail as Record<string, any> | null;
                const hasDetail = detail && Object.keys(detail).length > 0;
                const isExpanded = expandedIds.has(event.id);
                const description = describeAction(event.action, detail, event.resource);
                return (
                  <div
                    key={event.id}
                    className={`rounded-md border border-border/50 transition-colors ${
                      hasDetail ? "cursor-pointer hover:bg-muted/30" : "hover:bg-muted/30"
                    }`}
                    onClick={() => hasDetail && toggleExpand(event.id)}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {hasDetail ? (
                          isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          <div className="w-3.5" />
                        )}
                        <CatIcon className={`h-4 w-4 flex-shrink-0 ${catConfig?.color || "text-muted-foreground"}`} />
                        <Badge
                          variant={OUTCOME_VARIANT[event.outcome] as any}
                          className="text-[10px] px-1.5"
                        >
                          {event.outcome}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{description}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {event.actor?.name || event.actor?.email || "System"}
                            <span className="text-muted-foreground/50 mx-1.5">|</span>
                            <span className="font-mono text-[10px] text-muted-foreground/60">{event.action}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Badge variant="outline" className="text-[10px]">
                          {catConfig?.label || event.category}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {dateTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                    {/* Expandable detail panel */}
                    {isExpanded && hasDetail && (
                      <div className="border-t border-border/30 px-3 py-2.5 bg-muted/20">
                        <DetailGrid detail={detail!} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more */}
              {hasNextPage && (
                <div className="pt-3 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-1.5"
                  >
                    <ChevronDown className="h-3 w-3" />
                    {isFetchingNextPage ? "Loading..." : "Load More"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm">No audit events found</p>
              <p className="text-xs">
                {selectedCategory || selectedOutcome
                  ? "Try removing filters to see more events"
                  : "Events will appear here as users interact with the platform"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
