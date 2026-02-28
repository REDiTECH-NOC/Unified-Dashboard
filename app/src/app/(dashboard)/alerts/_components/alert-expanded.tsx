"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Monitor,
  FileText,
  Hash,
  Loader2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Skull,
  Ban,
  RotateCcw,
  Undo2,
  WifiOff,
  ScanLine,
  Copy,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  AlertTriangle,
  UserCheck,
  UserMinus,
  XCircle,
  RotateCw,
  Ticket,
} from "lucide-react";
import { ConfirmationDialog } from "./confirmation-dialog";
import { CoveAlertDetail } from "./cove-alert-detail";
import { DropsuiteAlertDetail } from "./dropsuite-alert-detail";
import { UptimeAlertDetail } from "./uptime-alert-detail";
import { AlertTicketLink } from "./alert-ticket-link";
import { useTicketBubbles } from "@/contexts/ticket-bubble-context";

/* ─── TYPES ────────────────────────────────────────────── */

interface AlertItem {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  deviceHostname?: string;
  organizationName?: string;
  severity: string;
  fileHash?: string;
  detectedAt: Date;
  mergedSources?: Array<{ source: string; sourceId: string; sourceLabel: string }>;
  bpRaw?: Record<string, unknown>;
  bpSourceId?: string;
  bpRiskScore?: number;
  bpTicketStatus?: string;
  bpOrganizationSourceId?: string;
}

interface AlertStateEntry {
  closed?: boolean;
  closedAt?: Date | string | null;
  closeNote?: string | null;
  owner?: { id: string; name: string | null; avatar: string | null } | null;
  closedBy?: { id: string; name: string | null } | null;
  linkedTicketId?: string | null;
  linkedTicketSummary?: string | null;
  matchedCompanyId?: string | null;
  matchedCompanyName?: string | null;
  source?: string;
}

interface AlertExpandedProps {
  source: string;
  alerts: AlertItem[];
  alertStates: Record<string, AlertStateEntry>;
  onOpenDetail: (sourceId: string) => void;
  onClose: () => void;
  onOpenCreateTicket: (alerts: AlertItem[]) => void;
}

interface S1ThreatRaw {
  threatInfo?: {
    confidenceLevel?: string;
    classification?: string;
    classificationSource?: string;
    detectionType?: string;
    initiatedBy?: string;
    initiatedByDescription?: string;
    filePath?: string;
    sha256?: string;
    sha1?: string;
    md5?: string;
    originatorProcess?: string;
    processUser?: string;
    fileSize?: number;
    publisherName?: string;
    storyline?: string;
    mitigationStatus?: string;
    mitigationStatusDescription?: string;
    incidentStatus?: string;
    analystVerdict?: string;
    engines?: string[];
    detectionEngines?: Array<{ key: string; title: string }>;
    rebootRequired?: boolean;
    isFileless?: boolean;
  };
  agentDetectionInfo?: {
    agentDomain?: string;
    agentIpV4?: string;
    agentVersion?: string;
    externalIp?: string;
    groupName?: string;
    siteName?: string;
    siteId?: string;
  };
  agentRealtimeInfo?: {
    agentComputerName?: string;
    agentOsName?: string;
    agentOsRevision?: string;
    agentNetworkStatus?: string;
    scanStatus?: string;
  };
}

type MitigationAction = "kill" | "quarantine" | "remediate" | "rollback";

/* ─── SEVERITY / STATUS HELPERS ────────────────────────── */

const severityConfig = {
  critical: { label: "Critical", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30" },
  high: { label: "High", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  medium: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/30" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30" },
  informational: { label: "Info", color: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/30" },
} as const;

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Active", color: "text-red-400", bg: "bg-red-500/10" },
  in_progress: { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  mitigated: { label: "Mitigated", color: "text-green-400", bg: "bg-green-500/10" },
  resolved: { label: "Resolved", color: "text-blue-400", bg: "bg-blue-500/10" },
};

function InfoRow({ label, value, mono, children }: { label: string; value?: string | null; mono?: boolean; children?: React.ReactNode }) {
  if (!value && !children) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-[10px] text-muted-foreground shrink-0 w-24">{label}</span>
      {children || (
        <span className={cn("text-xs text-foreground text-right truncate", mono && "font-mono text-[11px]")}>
          {value}
        </span>
      )}
    </div>
  );
}

/* ─── QUICK ACTION BUTTONS ─────────────────────────────── */

const MITIGATION_ACTIONS: { action: MitigationAction; label: string; icon: React.ElementType; variant: "danger" | "warning"; description: string }[] = [
  { action: "kill", label: "Kill", icon: Skull, variant: "danger", description: "Kill the malicious process. This will terminate the process immediately." },
  { action: "quarantine", label: "Quarantine", icon: Ban, variant: "danger", description: "Quarantine the threat file. The file will be moved to a secure location and cannot execute." },
  { action: "remediate", label: "Remediate", icon: RotateCcw, variant: "warning", description: "Remediate the threat. SentinelOne will attempt to clean and restore affected files." },
  { action: "rollback", label: "Rollback", icon: Undo2, variant: "danger", description: "Roll back changes made by the threat. This will revert system modifications." },
];

/* ─── INDIVIDUAL THREAT DETAIL (inner component) ──────── */

function ThreatDetail({
  sourceId,
  onOpenDetail,
  allSourceIds,
  isBulk,
}: {
  sourceId: string;
  onOpenDetail: (sourceId: string) => void;
  allSourceIds: string[];
  isBulk: boolean;
}) {
  const { dateTime } = useTimezone();
  const [confirmAction, setConfirmAction] = useState<{
    action: MitigationAction;
    label: string;
    description: string;
    variant: "danger" | "warning";
    bulk?: boolean;
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const utils = trpc.useUtils();

  const threat = trpc.edr.getThreatById.useQuery(
    { id: sourceId },
    { refetchInterval: 15000 }
  );

  // Mutations
  const mitigateThreat = trpc.edr.mitigateThreat.useMutation({
    onSuccess: () => {
      utils.edr.getThreats.invalidate();
      utils.edr.getThreatById.invalidate({ id: sourceId });
    },
  });

  const updateStatus = trpc.edr.updateIncidentStatus.useMutation({
    onSuccess: () => {
      utils.edr.getThreats.invalidate();
      utils.edr.getThreatById.invalidate({ id: sourceId });
    },
  });

  const updateVerdict = trpc.edr.updateAnalystVerdict.useMutation({
    onSuccess: () => {
      utils.edr.getThreats.invalidate();
      utils.edr.getThreatById.invalidate({ id: sourceId });
    },
  });

  const isolateDevice = trpc.edr.isolateDevice.useMutation({
    onSuccess: () => {
      utils.edr.getThreats.invalidate();
      utils.edr.getThreatById.invalidate({ id: sourceId });
    },
  });

  const triggerScan = trpc.edr.triggerFullScan.useMutation({
    onSuccess: () => utils.edr.getThreatById.invalidate({ id: sourceId }),
  });

  if (threat.isLoading) {
    return (
      <div className="py-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (threat.error || !threat.data) {
    return (
      <div className="py-4">
        <p className="text-xs text-red-400">Failed to load threat details</p>
      </div>
    );
  }

  const t = threat.data;
  const raw = t._raw as S1ThreatRaw | undefined;
  const info = raw?.threatInfo;
  const detection = raw?.agentDetectionInfo;
  const realtime = raw?.agentRealtimeInfo;

  const fileHash = info?.sha256 ?? info?.sha1 ?? info?.md5;
  const hashType = info?.sha256 ? "SHA256" : info?.sha1 ? "SHA1" : info?.md5 ? "MD5" : null;
  const sevKey = (t.severity ?? "medium") as keyof typeof severityConfig;
  const sev = severityConfig[sevKey] ?? severityConfig.medium;
  const status = statusConfig[t.status] ?? statusConfig.active;
  const incidentStatus = info?.incidentStatus ?? t.status;
  const analystVerdict = info?.analystVerdict ?? "undefined";

  function copyHash() {
    if (fileHash) {
      navigator.clipboard.writeText(fileHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* ─── Top row: Status + Severity + Classification ─── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", status.bg, status.color)}>
            {status.label}
          </span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", sev.bg, sev.color, sev.border)}>
            {sev.label}
          </span>
          {info?.classification && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {info.classification}
            </span>
          )}
          {info?.confidenceLevel && (
            <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
              Confidence: {info.confidenceLevel}
            </span>
          )}
          {info?.rebootRequired && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              Reboot Required
            </span>
          )}
        </div>

        {/* ─── Two-column info grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0">
          {/* Device Info */}
          <div className="space-y-0">
            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border/50">
              <Monitor className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Device</span>
            </div>
            <InfoRow label="Hostname" value={realtime?.agentComputerName ?? t.deviceHostname} />
            <InfoRow label="OS" value={realtime?.agentOsName} />
            <InfoRow label="IP" value={detection?.agentIpV4 ?? detection?.externalIp} />
            <InfoRow label="Site" value={detection?.siteName ?? t.organizationName} />
            <InfoRow label="Group" value={detection?.groupName} />
            <InfoRow label="Network" value={realtime?.agentNetworkStatus} />
          </div>

          {/* File / Process Info */}
          <div className="space-y-0">
            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border/50">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">File / Process</span>
            </div>
            <InfoRow label="File Path" value={info?.filePath} mono />
            <InfoRow label="Process" value={info?.originatorProcess} mono />
            <InfoRow label="User" value={info?.processUser} />
            <InfoRow label="Publisher" value={info?.publisherName} />
            <InfoRow label="Detection" value={info?.detectionType} />
            {info?.isFileless && <InfoRow label="Type" value="Fileless" />}
          </div>

          {/* Hash Info */}
          <div className="space-y-0">
            <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-border/50">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Indicators</span>
            </div>
            {fileHash && (
              <InfoRow label={hashType ?? "Hash"}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-foreground truncate max-w-[180px]" title={fileHash}>
                    {fileHash}
                  </span>
                  <button onClick={copyHash} className="p-0.5 rounded hover:bg-accent transition-colors shrink-0" title="Copy hash">
                    {copiedHash ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <a
                    href={`https://www.virustotal.com/gui/file/${fileHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 shrink-0"
                    title="View on VirusTotal"
                  >
                    <ExternalLink className="h-3 w-3" />
                    VT
                  </a>
                </div>
              </InfoRow>
            )}
            <InfoRow label="Storyline" value={info?.storyline} mono />
            {info?.fileSize && (
              <InfoRow label="File Size" value={`${(info.fileSize / 1024).toFixed(1)} KB`} />
            )}
            <InfoRow label="Initiated By" value={info?.initiatedByDescription ?? info?.initiatedBy} />
          </div>
        </div>

        {/* ─── Action Controls ─── */}
        <div className="flex items-center gap-6 pt-2 border-t border-border/50 flex-wrap">
          {/* Mitigation Actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">Mitigate:</span>
            {MITIGATION_ACTIONS.map(({ action, label, icon: Icon, variant, description }) => (
              <button
                key={action}
                onClick={() => setConfirmAction({ action, label, description, variant })}
                className={cn(
                  "flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
                  variant === "danger"
                    ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                    : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20"
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Device Actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">Device:</span>
            <button
              onClick={() =>
                setConfirmAction({
                  action: "kill" as MitigationAction,
                  label: "Isolate Device",
                  description: `Isolate ${realtime?.agentComputerName ?? "this device"} from the network. The device will lose all network connectivity except to the SentinelOne management console.`,
                  variant: "danger",
                })
              }
              disabled={isolateDevice.isPending}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
            >
              {isolateDevice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3" />}
              Isolate
            </button>
            <button
              onClick={() => {
                if (t.deviceSourceId) triggerScan.mutate({ agentId: t.deviceSourceId });
              }}
              disabled={triggerScan.isPending || !t.deviceSourceId}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-accent text-foreground hover:bg-accent/80 border border-border transition-colors disabled:opacity-50"
            >
              {triggerScan.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
              Scan
            </button>
          </div>

          {/* Verdict & Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">Status:</span>
            <select
              value={incidentStatus}
              onChange={(e) =>
                updateStatus.mutate({
                  threatIds: isBulk ? allSourceIds : [sourceId],
                  status: e.target.value as "resolved" | "in_progress" | "unresolved",
                })
              }
              disabled={updateStatus.isPending}
              className="h-7 px-2 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            >
              <option value="unresolved">Unresolved</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={analystVerdict}
              onChange={(e) =>
                updateVerdict.mutate({
                  threatIds: isBulk ? allSourceIds : [sourceId],
                  verdict: e.target.value as "true_positive" | "false_positive" | "suspicious" | "undefined",
                })
              }
              disabled={updateVerdict.isPending}
              className="h-7 px-2 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            >
              <option value="undefined">No Verdict</option>
              <option value="true_positive">True Positive</option>
              <option value="false_positive">False Positive</option>
              <option value="suspicious">Suspicious</option>
            </select>
            {isBulk && (
              <span className="text-[10px] text-muted-foreground ml-1">
                (applies to all {allSourceIds.length})
              </span>
            )}
          </div>

          {/* View Full Details */}
          <button
            onClick={() => onOpenDetail(sourceId)}
            className="ml-auto flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium transition-colors"
          >
            Full Details
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Mutation feedback */}
        {(updateStatus.error || updateVerdict.error || mitigateThreat.error || isolateDevice.error || triggerScan.error) && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">
              {updateStatus.error?.message ?? updateVerdict.error?.message ?? mitigateThreat.error?.message ?? isolateDevice.error?.message ?? triggerScan.error?.message}
            </p>
          </div>
        )}

        {(updateStatus.isSuccess || updateVerdict.isSuccess || triggerScan.isSuccess) && (
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs text-green-400">
              {updateStatus.isSuccess && `Incident status updated${isBulk ? ` for ${allSourceIds.length} threats` : ""}`}
              {updateVerdict.isSuccess && `Analyst verdict updated${isBulk ? ` for ${allSourceIds.length} threats` : ""}`}
              {triggerScan.isSuccess && "Full scan initiated"}
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmationDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction.label === "Isolate Device" && t.deviceSourceId) {
              await isolateDevice.mutateAsync({ agentId: t.deviceSourceId });
            } else {
              await mitigateThreat.mutateAsync({ threatId: sourceId, action: confirmAction.action });
            }
          }}
          title={`Confirm: ${confirmAction.label}`}
          description={confirmAction.description}
          confirmLabel={confirmAction.label}
          variant={confirmAction.variant}
        />
      )}
    </>
  );
}

/* ─── BLACKPOINT DETAIL (for standalone BP alerts) ────── */

function BlackpointAlertDetail({ alert, onClose }: { alert: AlertItem; onClose: () => void }) {
  const { dateTime } = useTimezone();
  const raw = alert.bpRaw;
  if (!raw) {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50 space-y-3">
        <p className="text-xs text-muted-foreground">No detail data available.</p>
        <AlertTicketLink
          hostname={alert.deviceHostname}
          organizationName={alert.organizationName}
          organizationSourceId={alert.bpOrganizationSourceId}
          toolId="blackpoint"
          alertContext={{ title: alert.title, severity: alert.severity, source: "blackpoint", deviceHostname: alert.deviceHostname, detectedAt: alert.detectedAt }}
        />
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">Close</button>
      </div>
    );
  }

  const riskScore = alert.bpRiskScore ?? (raw.riskScore as number) ?? 0;
  const alertCount = (raw.alertCount as number) ?? 1;
  const alertTypes = (raw.alertTypes as string[]) ?? [];
  const groupKey = raw.groupKey as string | undefined;
  const status = (raw.status as string) ?? "OPEN";
  const ticket = raw.ticket as { status?: string; notes?: Array<{ status: string; created: string }> } | null | undefined;
  const created = raw.created as string | undefined;
  const updated = raw.updated as string | null | undefined;

  const bpAlert = raw.alert as Record<string, unknown> | null | undefined;
  const action = bpAlert?.action as string | undefined;
  const hostname = (bpAlert?.hostname as string) ?? alert.deviceHostname;
  const username = bpAlert?.username as string | undefined;
  const provider = bpAlert?.eventProvider as string | undefined;
  const ruleName = bpAlert?.ruleName as string | undefined;
  const threatFramework = bpAlert?.threatFramework as string | undefined;
  const anomalyPct = bpAlert?.anomalyPercentile as number | undefined;
  const reasons = (bpAlert?.reasons as Array<Record<string, unknown>>) ?? [];
  const socActions = (bpAlert?.socReportingActions as Array<Record<string, unknown>>) ?? [];
  const details = bpAlert?.details as Record<string, unknown> | null | undefined;

  const fmtReason = (r: Record<string, unknown>) => {
    if (typeof r.name === "string") return r.name + (r.value !== undefined && r.value !== 0 ? `: ${r.value}` : "");
    if (typeof r.reason === "string") return r.reason;
    if (typeof r.description === "string") return r.description;
    return JSON.stringify(r);
  };

  const riskColor = (score: number): string => {
    if (score >= 80) return "bg-red-500/10 text-red-400 border-red-500/20";
    if (score >= 60) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    if (score >= 40) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    if (score >= 20) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  };

  return (
    <div className="bg-accent/20 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
      <div className="px-6 py-4 space-y-4">
        {/* ─── Header badges ─── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-bold tabular-nums", riskColor(riskScore))}>
            Risk: {riskScore}
          </span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border",
            status === "RESOLVED" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
          )}>
            {status}
          </span>
          {ticket?.status && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-400">
              SOC: {ticket.status}
            </span>
          )}
          {alertCount > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-accent text-muted-foreground">
              {alertCount} alert{alertCount !== 1 ? "s" : ""} in group
            </span>
          )}
          {alertTypes.map((t, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-600 bg-zinc-500/10 text-zinc-300">
              {t}
            </span>
          ))}
        </div>

        {/* ─── Alert detail grid ─── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" /> Detection
            </h4>
            <div className="space-y-1 text-xs">
              {action && <div><span className="text-muted-foreground">Action </span><span className="text-foreground font-medium">{action}</span></div>}
              {hostname && <div><span className="text-muted-foreground">Host </span><span className="text-foreground font-medium">{hostname}</span></div>}
              {username && <div><span className="text-muted-foreground">User </span><span className="text-foreground font-medium">{username}</span></div>}
              {provider && <div><span className="text-muted-foreground">Provider </span><span className="text-foreground font-medium">{provider}</span></div>}
              {groupKey && <div><span className="text-muted-foreground">Group Key </span><span className="text-foreground font-mono text-[10px]">{groupKey}</span></div>}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Threat Intel
            </h4>
            <div className="space-y-1 text-xs">
              {ruleName && <div><span className="text-muted-foreground">Rule </span><span className="text-foreground font-medium">{ruleName}</span></div>}
              {threatFramework && <div><span className="text-muted-foreground">Framework </span><span className="text-foreground font-medium truncate block max-w-[250px]">{threatFramework}</span></div>}
              {anomalyPct != null && <div><span className="text-muted-foreground">Anomaly </span><span className="text-foreground font-medium">{anomalyPct}th percentile</span></div>}
              {created && <div><span className="text-muted-foreground">Created </span><span className="text-foreground">{dateTime(created)}</span></div>}
              {updated && <div><span className="text-muted-foreground">Updated </span><span className="text-foreground">{dateTime(updated)}</span></div>}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> SOC Status
            </h4>
            <div className="space-y-1 text-xs">
              {ticket?.status && <div><span className="text-muted-foreground">Ticket Status </span><span className="text-foreground font-medium">{ticket.status}</span></div>}
              {ticket?.notes && ticket.notes.length > 0 && ticket.notes.map((n, i) => (
                <div key={i} className="text-[10px]">
                  <span className="text-blue-400/70">{n.status}</span>
                  <span className="text-muted-foreground ml-1.5">{dateTime(n.created)}</span>
                </div>
              ))}
              {!ticket?.status && <div className="text-muted-foreground text-[10px]">No SOC ticket data</div>}
            </div>
          </div>
        </div>

        {/* ─── SOC Analysis (actions taken by Blackpoint SOC) ─── */}
        {socActions.length > 0 && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-blue-400 uppercase">SOC Analysis</span>
            {socActions.map((sa, i) => {
              const label = typeof sa.action === "string" ? sa.action : null;
              const desc = typeof sa.description === "string" ? sa.description : null;
              const saStatus = typeof sa.status === "string" ? sa.status : null;
              return (
                <div key={i}>
                  {label && <p className="text-xs text-foreground font-medium">{label}{saStatus && <span className="text-[10px] text-muted-foreground ml-2">({saStatus})</span>}</p>}
                  {desc && <p className="text-[10px] text-foreground/70">{desc}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Detection Reasons ─── */}
        {reasons.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase">Detection Reasons</span>
            <div className="flex flex-wrap gap-1">
              {reasons.map((r, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {fmtReason(r)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Detection Details (flattened from nested BP data) ─── */}
        {details && Object.keys(details).length > 0 && (() => {
          // Extract useful fields from nested objects
          const d = details as Record<string, unknown>;
          const items: Array<{ label: string; value: string; mono?: boolean }> = [];

          // Process info
          const proc = d.process as Record<string, unknown> | undefined;
          if (proc) {
            if (proc.name) items.push({ label: "Process", value: String(proc.name) });
            if (proc.pid) items.push({ label: "PID", value: String(proc.pid), mono: true });
            if (proc.executable) items.push({ label: "Executable", value: String(proc.executable), mono: true });
          }

          // Source / destination IPs
          const src = d.source as Record<string, unknown> | undefined;
          const dst = d.destination as Record<string, unknown> | undefined;
          if (src?.ip) items.push({ label: "Source IP", value: String(src.ip), mono: true });
          if (dst?.ip) items.push({ label: "Destination IP", value: String(dst.ip), mono: true });

          // Server info
          const srv = d.server as Record<string, unknown> | undefined;
          if (srv?.address && srv.address !== src?.ip) items.push({ label: "Server", value: `${srv.address}${srv.port ? `:${srv.port}` : ""}`, mono: true });

          // Threat / MITRE
          const threat = d.threat as Record<string, unknown> | undefined;
          const tactic = threat?.tactic as Record<string, unknown> | undefined;
          const technique = threat?.technique as Record<string, unknown> | undefined;
          if (tactic?.name) items.push({ label: "MITRE Tactic", value: `${tactic.name}${tactic.id ? ` (${tactic.id})` : ""}` });
          if (technique?.name && technique.name !== tactic?.name) items.push({ label: "MITRE Technique", value: `${technique.name}${technique.id ? ` (${technique.id})` : ""}` });

          // Rule info (if not already shown above)
          const rule = d.rule as Record<string, unknown> | undefined;
          if (rule?.description && rule.description !== ruleName) items.push({ label: "Rule Description", value: String(rule.description) });
          if (rule?.category) items.push({ label: "Rule Category", value: String(rule.category) });

          // Tags
          const tags = d.tags as string[] | undefined;
          if (tags && tags.length > 0) items.push({ label: "Tags", value: tags.join(", ") });

          // Timestamp
          const ts = d["@timestamp"] as string | undefined;
          if (ts) items.push({ label: "Event Time", value: new Date(ts).toLocaleString() });

          // Any remaining scalar values not already covered
          const skip = new Set(["host", "rule", "event", "threat", "process", "source", "destination", "server", "agent", "labels", "bcs_actions", "bcs_host", "account", "organization", "tags", "@timestamp"]);
          for (const [k, v] of Object.entries(d)) {
            if (skip.has(k)) continue;
            if (v == null || v === "") continue;
            if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
              items.push({ label: k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), value: String(v) });
            }
          }

          if (items.length === 0) return null;
          return (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">Detection Details</span>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground whitespace-nowrap">{item.label}</span>
                    <span className={cn("text-foreground truncate", item.mono && "font-mono text-[10px]")} title={item.value}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ─── Fallback when no enrichment data ─── */}
        {!socActions.length && !reasons.length && !ruleName && !details && (
          <p className="text-[10px] text-muted-foreground">
            No additional enrichment data available from the API &mdash; the detection summary shown in CompassOne is generated by Blackpoint&apos;s BROC AI and not exposed via their API.
          </p>
        )}

        {/* ─── Related Tickets ─── */}
        <AlertTicketLink
          hostname={alert.deviceHostname}
          organizationName={alert.organizationName}
          organizationSourceId={alert.bpOrganizationSourceId}
          toolId="blackpoint"
          alertContext={{ title: alert.title, severity: alert.severity, source: "blackpoint", deviceHostname: alert.deviceHostname, detectedAt: alert.detectedAt }}
        />
      </div>
    </div>
  );
}

/* ─── BLACKPOINT CONTEXT (for merged S1+BP alerts) ────── */

const bpRiskColor = (score: number): string => {
  if (score >= 80) return "bg-red-500/10 text-red-400 border-red-500/20";
  if (score >= 60) return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (score >= 40) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (score >= 20) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
};

function BpContextSection({ bpRaw, bpRiskScore, bpTicketStatus }: {
  bpRaw: Record<string, unknown>;
  bpRiskScore?: number;
  bpTicketStatus?: string;
}) {
  const alertTypes = (bpRaw.alertTypes as string[]) ?? [];
  const alertCount = (bpRaw.alertCount as number) ?? 1;
  const bpAlert = bpRaw.alert as Record<string, unknown> | null | undefined;
  const reasons = (bpAlert?.reasons as Array<Record<string, unknown>>) ?? [];
  const socActions = (bpAlert?.socReportingActions as Array<Record<string, unknown>>) ?? [];
  const anomalyPct = bpAlert?.anomalyPercentile as number | undefined;
  const ruleName = bpAlert?.ruleName as string | undefined;
  const threatFramework = bpAlert?.threatFramework as string | undefined;
  const action = bpAlert?.action as string | undefined;
  const username = bpAlert?.username as string | undefined;
  const provider = bpAlert?.eventProvider as string | undefined;
  const ticket = bpRaw.ticket as { status?: string; notes?: Array<{ status: string; created: string }> } | null | undefined;
  const riskScore = bpRiskScore ?? (bpRaw.riskScore as number) ?? 0;

  const fmtReason = (r: Record<string, unknown>) => {
    if (typeof r.name === "string") return r.name + (r.value !== undefined && r.value !== 0 ? `: ${r.value}` : "");
    if (typeof r.reason === "string") return r.reason;
    return JSON.stringify(r);
  };

  return (
    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-medium text-blue-400">Blackpoint MDR Context</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", bpRiskColor(riskScore))}>
          Risk: {riskScore}
        </span>
        {(bpTicketStatus || ticket?.status) && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-400">
            SOC: {bpTicketStatus || ticket?.status}
          </span>
        )}
        {alertCount > 1 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-accent text-muted-foreground">
            {alertCount} alerts in group
          </span>
        )}
      </div>

      {/* Detection detail grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {alertTypes.length > 0 && (
          <div><span className="text-muted-foreground">Detection Types: </span><span className="text-foreground">{alertTypes.join(", ")}</span></div>
        )}
        {action && (
          <div><span className="text-muted-foreground">Action: </span><span className="text-foreground font-medium">{action}</span></div>
        )}
        {username && (
          <div><span className="text-muted-foreground">User: </span><span className="text-foreground">{username}</span></div>
        )}
        {provider && (
          <div><span className="text-muted-foreground">Provider: </span><span className="text-foreground">{provider}</span></div>
        )}
        {ruleName && (
          <div><span className="text-muted-foreground">Rule: </span><span className="text-foreground">{ruleName}</span></div>
        )}
        {threatFramework && (
          <div><span className="text-muted-foreground">Framework: </span><span className="text-foreground truncate">{threatFramework}</span></div>
        )}
        {anomalyPct != null && (
          <div><span className="text-muted-foreground">Anomaly: </span><span className="text-foreground">{anomalyPct}th percentile</span></div>
        )}
      </div>

      {/* SOC Analysis (rich action descriptions from Blackpoint SOC) */}
      {socActions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-blue-400 uppercase">SOC Analysis</span>
          {socActions.map((sa, i) => {
            const label = typeof sa.action === "string" ? sa.action : null;
            const desc = typeof sa.description === "string" ? sa.description : null;
            const saStatus = typeof sa.status === "string" ? sa.status : null;
            return (
              <div key={i}>
                {label && <p className="text-[11px] text-foreground font-medium">{label}{saStatus && <span className="text-[10px] text-muted-foreground ml-2">({saStatus})</span>}</p>}
                {desc && <p className="text-[10px] text-foreground/70">{desc}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Detection reasons */}
      {reasons.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">Detection Reasons:</span>
          <div className="flex flex-wrap gap-1">
            {reasons.map((r, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {fmtReason(r)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SOC ticket notes timeline */}
      {ticket?.notes && ticket.notes.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground font-medium">SOC Ticket Timeline:</span>
          <div className="flex flex-wrap gap-1">
            {ticket.notes.map((n, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/20">
                {n.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ALERT ACTIONS BAR (per-alert ownership, close, ticket) ── */

function AlertActions({
  alert,
  alertState,
  source,
  onOpenCreateTicket,
}: {
  alert: AlertItem;
  alertState?: AlertStateEntry;
  source: string;
  onOpenCreateTicket: (alerts: AlertItem[]) => void;
}) {
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const utils = trpc.useUtils();
  const { openTicket } = useTicketBubbles();

  const takeOwnership = trpc.alertAction.takeOwnership.useMutation({
    onSuccess: () => utils.alertAction.getStates.invalidate(),
  });
  const releaseOwnership = trpc.alertAction.releaseOwnership.useMutation({
    onSuccess: () => utils.alertAction.getStates.invalidate(),
  });
  const closeAlert = trpc.alertAction.close.useMutation({
    onSuccess: () => {
      utils.alertAction.getStates.invalidate();
      setShowCloseForm(false);
      setCloseNote("");
    },
  });
  const reopenAlert = trpc.alertAction.reopen.useMutation({
    onSuccess: () => utils.alertAction.getStates.invalidate(),
  });

  const isClosed = alertState?.closed;
  const isOwned = !!alertState?.owner;
  const isPending =
    takeOwnership.isPending ||
    releaseOwnership.isPending ||
    closeAlert.isPending ||
    reopenAlert.isPending;

  return (
    <div className="space-y-2 pt-2 border-t border-border/30">
      {/* State info: owner, linked ticket, closed */}
      <div className="flex items-center gap-3 flex-wrap">
        {alertState?.owner && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-blue-400">
            <UserCheck className="h-3.5 w-3.5" />
            Owned by {alertState.owner.name || "Unknown"}
          </span>
        )}
        {alertState?.linkedTicketId && (
          <button
            onClick={() => openTicket(alertState.linkedTicketId!)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary/20 bg-primary/5 text-[11px] text-primary font-mono hover:bg-primary/10 transition-colors"
          >
            <Ticket className="h-3 w-3" />
            #{alertState.linkedTicketId}
            {alertState.linkedTicketSummary && (
              <span className="text-muted-foreground font-sans ml-1 truncate max-w-[200px]">
                {alertState.linkedTicketSummary}
              </span>
            )}
          </button>
        )}
        {isClosed && alertState?.closeNote && (
          <span className="text-[11px] text-zinc-400">
            Closed: {alertState.closeNote}
            {alertState.closedBy?.name && ` — ${alertState.closedBy.name}`}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Take / Release Ownership */}
        {isOwned ? (
          <button
            onClick={() => releaseOwnership.mutate({ alertIds: [alert.id] })}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {releaseOwnership.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
            Release
          </button>
        ) : (
          <button
            onClick={() => takeOwnership.mutate({ alertIds: [alert.id], source })}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {takeOwnership.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
            Assign to Me
          </button>
        )}

        {/* Close / Reopen */}
        {isClosed ? (
          <button
            onClick={() => reopenAlert.mutate({ alertId: alert.id })}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 hover:bg-zinc-500/20 transition-colors disabled:opacity-50"
          >
            {reopenAlert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
            Reopen
          </button>
        ) : (
          <button
            onClick={() => setShowCloseForm(!showCloseForm)}
            disabled={isPending}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            Close
          </button>
        )}

        {/* Create Ticket (only if no linked ticket) */}
        {!alertState?.linkedTicketId && (
          <button
            onClick={() => onOpenCreateTicket([alert])}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <Ticket className="h-3 w-3" />
            Create Ticket
          </button>
        )}
      </div>

      {/* Close note form */}
      {showCloseForm && (
        <div className="flex items-start gap-2">
          <textarea
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
            placeholder="Resolution note..."
            rows={2}
            className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            autoFocus
          />
          <button
            onClick={() => {
              if (!closeNote.trim()) return;
              closeAlert.mutate({
                alertIds: [alert.id],
                source,
                note: closeNote.trim(),
              });
            }}
            disabled={!closeNote.trim() || closeAlert.isPending}
            className="h-8 px-3 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 shrink-0"
          >
            {closeAlert.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close Alert"}
          </button>
        </div>
      )}

      {/* Error messages */}
      {(takeOwnership.error || closeAlert.error || reopenAlert.error) && (
        <div className="text-[10px] text-red-400">
          {(takeOwnership.error || closeAlert.error || reopenAlert.error)?.message?.substring(0, 100)}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function AlertExpanded({ source, alerts, alertStates, onOpenDetail, onClose, onOpenCreateTicket }: AlertExpandedProps) {
  const { dateTime } = useTimezone();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isGroup = alerts.length > 1;
  const currentAlert = alerts[currentIndex];
  const allSourceIds = alerts.map((a) => a.sourceId);

  // Cove Backup alerts: rich detail view
  if (source === "cove") {
    return (
      <div className="bg-accent/20 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
        <div className="px-6 py-4 space-y-4">
          {/* Group Navigation Bar (same as S1) */}
          {isGroup && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="First">
                  <ChevronsLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}
                  className="flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium bg-accent border border-border text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/80">
                  <ChevronLeft className="h-3 w-3" /> Prev
                </button>
                <span className="text-xs font-medium text-foreground px-2">
                  {currentIndex + 1} <span className="text-muted-foreground">/ {alerts.length}</span>
                </span>
                <button onClick={() => setCurrentIndex((i) => Math.min(alerts.length - 1, i + 1))} disabled={currentIndex === alerts.length - 1}
                  className="flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium bg-accent border border-border text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/80">
                  Next <ChevronRight className="h-3 w-3" />
                </button>
                <button onClick={() => setCurrentIndex(alerts.length - 1)} disabled={currentIndex === alerts.length - 1}
                  className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Last">
                  <ChevronsRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {currentAlert.deviceHostname && (
                  <span className="font-medium text-foreground">{currentAlert.deviceHostname}</span>
                )}
                <span>{dateTime(currentAlert.detectedAt)}</span>
              </div>
            </div>
          )}

          <CoveAlertDetail
            key={currentAlert.sourceId}
            alert={currentAlert}
          />

          <AlertActions
            alert={currentAlert}
            alertState={alertStates[currentAlert.id]}
            source={source}
            onOpenCreateTicket={onOpenCreateTicket}
          />

          <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">
            Close
          </button>
        </div>
      </div>
    );
  }

  // Blackpoint standalone alerts: rich detail view
  if (source === "blackpoint") {
    return (
      <div className="space-y-0">
        <BlackpointAlertDetail alert={currentAlert} onClose={onClose} />
        <div className="px-6 pb-4">
          <AlertActions
            alert={currentAlert}
            alertState={alertStates[currentAlert.id]}
            source={source}
            onOpenCreateTicket={onOpenCreateTicket}
          />
        </div>
      </div>
    );
  }

  // Dropsuite SaaS backup alerts: account-level detail view
  if (source === "dropsuite") {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50 space-y-3">
        <DropsuiteAlertDetail
          key={currentAlert.sourceId}
          alert={currentAlert}
        />
        <AlertActions
          alert={currentAlert}
          alertState={alertStates[currentAlert.id]}
          source={source}
          onOpenCreateTicket={onOpenCreateTicket}
        />
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">
          Close
        </button>
      </div>
    );
  }

  // Uptime monitor alerts: incident detail view
  if (source === "uptime") {
    return (
      <div className="space-y-0">
        <UptimeAlertDetail alert={currentAlert} onClose={onClose} />
        <div className="px-6 pb-4">
          <AlertActions
            alert={currentAlert}
            alertState={alertStates[currentAlert.id]}
            source={source}
            onOpenCreateTicket={onOpenCreateTicket}
          />
        </div>
      </div>
    );
  }

  // Other non-S1 sources: placeholder with ticket link
  if (source !== "sentinelone") {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50 space-y-3">
        <p className="text-xs text-muted-foreground">
          Detailed view not yet available for this source.
        </p>
        <AlertTicketLink
          hostname={currentAlert.deviceHostname}
          organizationName={currentAlert.organizationName}
          toolId={source === "ninjaone" ? "ninjaone" : undefined}
          alertContext={{
            title: currentAlert.title,
            severity: currentAlert.severity,
            source,
            deviceHostname: currentAlert.deviceHostname,
            detectedAt: currentAlert.detectedAt,
          }}
        />
        <AlertActions
          alert={currentAlert}
          alertState={alertStates[currentAlert.id]}
          source={source}
          onOpenCreateTicket={onOpenCreateTicket}
        />
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="bg-accent/20 border-t border-border/50 animate-in slide-in-from-top-2 duration-200">
      <div className="px-6 py-4 space-y-4">
        {/* ─── Group Navigation Bar ─── */}
        {isGroup && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* First */}
              <button
                onClick={() => setCurrentIndex(0)}
                disabled={currentIndex === 0}
                className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="First"
              >
                <ChevronsLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {/* Prev */}
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium bg-accent border border-border text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/80"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </button>

              {/* Counter */}
              <span className="text-xs font-medium text-foreground px-2">
                {currentIndex + 1} <span className="text-muted-foreground">/ {alerts.length}</span>
              </span>

              {/* Next */}
              <button
                onClick={() => setCurrentIndex((i) => Math.min(alerts.length - 1, i + 1))}
                disabled={currentIndex === alerts.length - 1}
                className="flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-medium bg-accent border border-border text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/80"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
              {/* Last */}
              <button
                onClick={() => setCurrentIndex(alerts.length - 1)}
                disabled={currentIndex === alerts.length - 1}
                className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Last"
              >
                <ChevronsRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Current instance info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {currentAlert.deviceHostname && (
                <span className="font-medium text-foreground">{currentAlert.deviceHostname}</span>
              )}
              <span>{dateTime(currentAlert.detectedAt)}</span>
            </div>
          </div>
        )}

        {/* ─── Threat Detail (for current alert) ─── */}
        <ThreatDetail
          key={currentAlert.sourceId}
          sourceId={currentAlert.sourceId}
          onOpenDetail={onOpenDetail}
          allSourceIds={allSourceIds}
          isBulk={isGroup}
        />

        {/* ─── Blackpoint MDR Context (for merged alerts) ─── */}
        {currentAlert.mergedSources && currentAlert.bpRaw && (
          <BpContextSection
            bpRaw={currentAlert.bpRaw}
            bpRiskScore={currentAlert.bpRiskScore}
            bpTicketStatus={currentAlert.bpTicketStatus}
          />
        )}

        {/* ─── Related Tickets ─── */}
        {currentAlert.mergedSources ? (
          <div className="space-y-2">
            <AlertTicketLink
              hostname={currentAlert.deviceHostname}
              organizationName={currentAlert.organizationName}
              toolId="sentinelone"
              label="SentinelOne Tickets"
              alertContext={{
                title: currentAlert.title,
                severity: currentAlert.severity,
                source: "sentinelone",
                deviceHostname: currentAlert.deviceHostname,
                detectedAt: currentAlert.detectedAt,
              }}
            />
            <AlertTicketLink
              hostname={currentAlert.deviceHostname}
              organizationName={currentAlert.organizationName}
              organizationSourceId={currentAlert.bpOrganizationSourceId}
              toolId="blackpoint"
              label="Blackpoint Tickets"
              alertContext={{
                title: currentAlert.title,
                severity: currentAlert.severity,
                source: "blackpoint",
                deviceHostname: currentAlert.deviceHostname,
                detectedAt: currentAlert.detectedAt,
              }}
            />
          </div>
        ) : (
          <AlertTicketLink
            hostname={currentAlert.deviceHostname}
            organizationName={currentAlert.organizationName}
            toolId="sentinelone"
            alertContext={{
              title: currentAlert.title,
              severity: currentAlert.severity,
              source: "sentinelone",
              deviceHostname: currentAlert.deviceHostname,
              detectedAt: currentAlert.detectedAt,
            }}
          />
        )}

        {/* ─── Alert Actions (ownership, close, ticket) ─── */}
        <AlertActions
          alert={currentAlert}
          alertState={alertStates[currentAlert.id]}
          source={source}
          onOpenCreateTicket={onOpenCreateTicket}
        />
      </div>
    </div>
  );
}
