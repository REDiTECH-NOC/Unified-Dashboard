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
} from "lucide-react";
import { ConfirmationDialog } from "./confirmation-dialog";

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
}

interface AlertExpandedProps {
  source: string;
  alerts: AlertItem[];
  onOpenDetail: (sourceId: string) => void;
  onClose: () => void;
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

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function AlertExpanded({ source, alerts, onOpenDetail, onClose }: AlertExpandedProps) {
  const { dateTime } = useTimezone();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isGroup = alerts.length > 1;
  const currentAlert = alerts[currentIndex];
  const allSourceIds = alerts.map((a) => a.sourceId);

  // Non-S1 sources: simple placeholder
  if (source !== "sentinelone") {
    return (
      <div className="px-6 py-4 bg-accent/30 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          Detailed view not yet available for this source.
        </p>
        <button onClick={onClose} className="text-xs text-red-500 hover:text-red-400 mt-2">
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
      </div>
    </div>
  );
}
