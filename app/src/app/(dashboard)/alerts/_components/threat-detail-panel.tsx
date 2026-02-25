"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldAlert,
  Monitor,
  FileText,
  Hash,
  MessageSquare,
  Clock,
  Cpu,
  Send,
  Skull,
  Ban,
  RotateCcw,
  Undo2,
  WifiOff,
  Wifi,
  ScanLine,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
} from "lucide-react";
import { ConfirmationDialog } from "./confirmation-dialog";

/* ─── TYPES ────────────────────────────────────────────── */

interface ThreatDetailPanelProps {
  threatId: string;
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
    analystVerdictDescription?: string;
    engines?: string[];
    detectionEngines?: Array<{ key: string; title: string }>;
    rebootRequired?: boolean;
    isFileless?: boolean;
    maliciousProcessArguments?: string;
    externalTicketExists?: boolean;
    externalTicketId?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  agentDetectionInfo?: {
    agentDomain?: string;
    agentIpV4?: string;
    agentVersion?: string;
    externalIp?: string;
    groupName?: string;
    groupId?: string;
    siteName?: string;
    siteId?: string;
    agentOsName?: string;
    agentMitigationMode?: string;
  };
  agentRealtimeInfo?: {
    agentComputerName?: string;
    agentOsName?: string;
    agentOsRevision?: string;
    agentOsType?: string;
    agentNetworkStatus?: string;
    agentVersion?: string;
    scanStatus?: string;
    operationalState?: string;
    agentId?: string;
  };
  containerInfo?: {
    id?: string;
    image?: string;
    name?: string;
  };
  whiteningOptions?: string[];
}

type MitigationAction = "kill" | "quarantine" | "remediate" | "rollback";

/* ─── HELPERS ──────────────────────────────────────────── */

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

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1">{title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function DetailRow({ label, value, mono, children }: { label: string; value?: string | null; mono?: boolean; children?: React.ReactNode }) {
  if (!value && !children) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] text-muted-foreground shrink-0 w-28">{label}</span>
      {children || (
        <span className={cn("text-xs text-foreground text-right", mono && "font-mono text-[11px] break-all")}>
          {value}
        </span>
      )}
    </div>
  );
}

const MITIGATION_ACTIONS: { action: MitigationAction; label: string; icon: React.ElementType; variant: "danger" | "warning"; description: string }[] = [
  { action: "kill", label: "Kill Process", icon: Skull, variant: "danger", description: "Terminate the malicious process immediately." },
  { action: "quarantine", label: "Quarantine", icon: Ban, variant: "danger", description: "Move the threat file to a secure quarantine location." },
  { action: "remediate", label: "Remediate", icon: RotateCcw, variant: "warning", description: "Clean and restore affected files." },
  { action: "rollback", label: "Rollback", icon: Undo2, variant: "danger", description: "Revert all system changes made by this threat." },
];

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function ThreatDetailPanel({ threatId, onClose }: ThreatDetailPanelProps) {
  const { dateTime } = useTimezone();
  const [confirmAction, setConfirmAction] = useState<{ type: "mitigate" | "isolate" | "unisolate"; action?: MitigationAction; label: string; description: string; variant: "danger" | "warning" } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showRawJson, setShowRawJson] = useState(false);

  const utils = trpc.useUtils();

  // Queries
  const threat = trpc.edr.getThreatById.useQuery({ id: threatId }, { refetchInterval: 15000 });
  const timeline = trpc.edr.getThreatTimeline.useQuery({ threatId }, { refetchInterval: 30000 });
  const notes = trpc.edr.getThreatNotes.useQuery({ threatId }, { refetchInterval: 30000 });

  // Mutations
  const mitigateThreat = trpc.edr.mitigateThreat.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const updateStatus = trpc.edr.updateIncidentStatus.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const updateVerdict = trpc.edr.updateAnalystVerdict.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const markBenign = trpc.edr.markAsBenign.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const markThreat = trpc.edr.markAsThreat.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const isolateDevice = trpc.edr.isolateDevice.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const unisolateDevice = trpc.edr.unisolateDevice.useMutation({
    onSuccess: () => { utils.edr.getThreats.invalidate(); utils.edr.getThreatById.invalidate({ id: threatId }); },
  });
  const triggerScan = trpc.edr.triggerFullScan.useMutation();
  const addNote = trpc.edr.addThreatNote.useMutation({
    onSuccess: () => { utils.edr.getThreatNotes.invalidate({ threatId }); setNoteText(""); },
  });

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  if (threat.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-2xl h-full bg-card border-l border-border flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!threat.data) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-2xl h-full bg-card border-l border-border flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Failed to load threat</p>
          <button onClick={onClose} className="text-xs text-red-500">Close</button>
        </div>
      </div>
    );
  }

  const t = threat.data;
  const raw = t._raw as S1ThreatRaw | undefined;
  const info = raw?.threatInfo;
  const detection = raw?.agentDetectionInfo;
  const realtime = raw?.agentRealtimeInfo;

  const fileHash = info?.sha256 ?? info?.sha1 ?? info?.md5;
  const sevKey = (t.severity ?? "medium") as keyof typeof severityConfig;
  const sev = severityConfig[sevKey] ?? severityConfig.medium;
  const status = statusConfig[t.status] ?? statusConfig.active;
  const incidentStatus = info?.incidentStatus ?? t.status;
  const analystVerdict = info?.analystVerdict ?? "undefined";
  const isIsolated = realtime?.agentNetworkStatus === "disconnected";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Panel */}
        <div className="relative w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", sev.color === "text-red-500" ? "bg-red-500" : sev.color === "text-orange-500" ? "bg-orange-500" : sev.color === "text-yellow-500" ? "bg-yellow-500" : "bg-blue-400")} />
                  <h2 className="text-sm font-semibold text-foreground truncate">{t.title}</h2>
                </div>
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
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors shrink-0">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div>
            {/* ─── Section 1: Threat Summary ─── */}
            <Section title="Threat Summary" icon={ShieldAlert}>
              <div className="space-y-0">
                <DetailRow label="Threat Name" value={t.title} />
                <DetailRow label="Classification" value={info?.classification} />
                <DetailRow label="Confidence" value={info?.confidenceLevel} />
                <DetailRow label="Detection Type" value={info?.detectionType} />
                <DetailRow label="Initiated By" value={info?.initiatedByDescription ?? info?.initiatedBy} />
                <DetailRow label="Detected At" value={dateTime(t.detectedAt)} />
                {info?.updatedAt && <DetailRow label="Updated At" value={dateTime(new Date(info.updatedAt))} />}
                <DetailRow label="Mitigation Status" value={info?.mitigationStatusDescription ?? info?.mitigationStatus} />
                <DetailRow label="Analyst Verdict" value={info?.analystVerdictDescription ?? analystVerdict} />
                {info?.rebootRequired && <DetailRow label="Reboot Required" value="Yes" />}
                {info?.isFileless && <DetailRow label="Fileless" value="Yes" />}
              </div>
            </Section>

            {/* ─── Section 2: Device Info ─── */}
            <Section title="Device Info" icon={Monitor}>
              <div className="space-y-0">
                <DetailRow label="Hostname" value={realtime?.agentComputerName ?? t.deviceHostname} />
                <DetailRow label="OS" value={`${realtime?.agentOsName ?? detection?.agentOsName ?? ""} ${realtime?.agentOsRevision ?? ""}`.trim()} />
                <DetailRow label="Internal IP" value={detection?.agentIpV4} />
                <DetailRow label="External IP" value={detection?.externalIp} />
                <DetailRow label="Domain" value={detection?.agentDomain} />
                <DetailRow label="Site" value={detection?.siteName ?? t.organizationName} />
                <DetailRow label="Group" value={detection?.groupName} />
                <DetailRow label="Agent Version" value={realtime?.agentVersion ?? detection?.agentVersion} />
                <DetailRow label="Network Status" value={realtime?.agentNetworkStatus} />
                <DetailRow label="Scan Status" value={realtime?.scanStatus} />
                <DetailRow label="Operational State" value={realtime?.operationalState} />
                <DetailRow label="Mitigation Mode" value={detection?.agentMitigationMode} />
              </div>
            </Section>

            {/* ─── Section 3: File / Process Info ─── */}
            <Section title="File & Process" icon={FileText}>
              <div className="space-y-0">
                <DetailRow label="File Path" value={info?.filePath} mono />
                <DetailRow label="Process" value={info?.originatorProcess} mono />
                {info?.maliciousProcessArguments && <DetailRow label="Process Args" value={info.maliciousProcessArguments} mono />}
                <DetailRow label="Process User" value={info?.processUser} />
                <DetailRow label="Publisher" value={info?.publisherName} />
                {info?.fileSize && <DetailRow label="File Size" value={`${(info.fileSize / 1024).toFixed(1)} KB`} />}
                <DetailRow label="Storyline" value={info?.storyline} mono />

                {/* Hashes */}
                {info?.sha256 && (
                  <DetailRow label="SHA256">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-foreground break-all">{info.sha256}</span>
                      <button onClick={() => copyHash(info.sha256!)} className="p-0.5 shrink-0"><Copy className="h-3 w-3 text-muted-foreground" /></button>
                      <a href={`https://www.virustotal.com/gui/file/${info.sha256}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <ExternalLink className="h-3 w-3 text-blue-400" />
                      </a>
                    </div>
                  </DetailRow>
                )}
                {info?.sha1 && <DetailRow label="SHA1" value={info.sha1} mono />}
                {info?.md5 && <DetailRow label="MD5" value={info.md5} mono />}
              </div>
            </Section>

            {/* ─── Section 4: Mitigation Actions ─── */}
            <Section title="Mitigation Actions" icon={Shield}>
              <div className="space-y-3">
                {/* Threat mitigation buttons */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2">Threat Response</p>
                  <div className="flex flex-wrap gap-2">
                    {MITIGATION_ACTIONS.map(({ action, label, icon: Icon, variant, description }) => (
                      <button
                        key={action}
                        onClick={() => setConfirmAction({ type: "mitigate", action, label, description, variant })}
                        className={cn(
                          "flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                          variant === "danger"
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-orange-600 hover:bg-orange-700 text-white"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Device actions */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2">Device Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {isIsolated ? (
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: "unisolate",
                            label: "Reconnect Device",
                            description: `Reconnect ${realtime?.agentComputerName ?? "this device"} to the network. This will restore normal network connectivity.`,
                            variant: "warning",
                          })
                        }
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                      >
                        <Wifi className="h-3.5 w-3.5" />
                        Reconnect
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: "isolate",
                            label: "Isolate Device",
                            description: `Disconnect ${realtime?.agentComputerName ?? "this device"} from the network. It will only maintain connectivity to the SentinelOne management console.`,
                            variant: "danger",
                          })
                        }
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                      >
                        <WifiOff className="h-3.5 w-3.5" />
                        Isolate Device
                      </button>
                    )}
                    <button
                      onClick={() => { if (t.deviceSourceId) triggerScan.mutate({ agentId: t.deviceSourceId }); }}
                      disabled={triggerScan.isPending || !t.deviceSourceId}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-accent hover:bg-accent/80 text-foreground border border-border transition-colors disabled:opacity-50"
                    >
                      {triggerScan.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                      Full Scan
                    </button>
                  </div>
                </div>

                {/* Verdict & Status dropdowns */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2">Incident Classification</p>
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Incident Status</label>
                      <select
                        value={incidentStatus}
                        onChange={(e) => updateStatus.mutate({ threatIds: [threatId], status: e.target.value as "resolved" | "in_progress" | "unresolved" })}
                        disabled={updateStatus.isPending}
                        className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                      >
                        <option value="unresolved">Unresolved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-1">Analyst Verdict</label>
                      <select
                        value={analystVerdict}
                        onChange={(e) => updateVerdict.mutate({ threatIds: [threatId], verdict: e.target.value as "true_positive" | "false_positive" | "suspicious" | "undefined" })}
                        disabled={updateVerdict.isPending}
                        className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                      >
                        <option value="undefined">No Verdict</option>
                        <option value="true_positive">True Positive</option>
                        <option value="false_positive">False Positive</option>
                        <option value="suspicious">Suspicious</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => markBenign.mutate({ threatIds: [threatId] })}
                      disabled={markBenign.isPending}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors disabled:opacity-50"
                    >
                      {markBenign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                      Mark Benign
                    </button>
                    <button
                      onClick={() => markThreat.mutate({ threatIds: [threatId] })}
                      disabled={markThreat.isPending}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {markThreat.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
                      Mark Threat
                    </button>
                  </div>
                </div>

                {/* Mutation feedback */}
                {(mitigateThreat.error || updateStatus.error || updateVerdict.error || markBenign.error || markThreat.error || isolateDevice.error || unisolateDevice.error) && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-400">
                      {mitigateThreat.error?.message ?? updateStatus.error?.message ?? updateVerdict.error?.message ?? markBenign.error?.message ?? markThreat.error?.message ?? isolateDevice.error?.message ?? unisolateDevice.error?.message}
                    </p>
                  </div>
                )}
                {(mitigateThreat.isSuccess || triggerScan.isSuccess) && (
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-400">
                      {mitigateThreat.isSuccess && "Mitigation action executed"}
                      {triggerScan.isSuccess && "Full scan initiated"}
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* ─── Section 5: Analyst Notes ─── */}
            <Section title={`Analyst Notes${notes.data?.data?.length ? ` (${notes.data.data.length})` : ""}`} icon={MessageSquare}>
              <div className="space-y-3">
                {/* Add note form */}
                <div className="flex gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                  />
                  <button
                    onClick={() => { if (noteText.trim()) addNote.mutate({ threatId, text: noteText.trim() }); }}
                    disabled={addNote.isPending || !noteText.trim()}
                    className="self-end h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {addNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Add
                  </button>
                </div>

                {/* Notes list */}
                {notes.isLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : notes.data?.data?.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-2">No notes yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notes.data?.data?.map((note) => (
                      <div key={note.id} className="p-2.5 rounded-lg bg-accent/50 border border-border/50">
                        <div className="flex items-center gap-2 mb-1">
                          {note.creatorName && <span className="text-[10px] font-medium text-foreground">{note.creatorName}</span>}
                          <span className="text-[10px] text-muted-foreground">{dateTime(note.createdAt)}</span>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap">{note.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>

            {/* ─── Section 6: Timeline ─── */}
            <Section title={`Timeline${timeline.data?.data?.length ? ` (${timeline.data.data.length})` : ""}`} icon={Clock}>
              {timeline.isLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              ) : timeline.data?.data?.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-2">No timeline events</p>
              ) : (
                <div className="relative pl-4 space-y-0 max-h-80 overflow-y-auto">
                  {/* Vertical line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />

                  {timeline.data?.data?.map((event, i) => (
                    <div key={event.id} className="relative flex gap-3 py-2">
                      {/* Dot */}
                      <div className="absolute left-[-12px] top-3 w-2 h-2 rounded-full bg-muted-foreground/50 border border-card" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {dateTime(event.timestamp)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                            {event.activityType}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 mt-0.5">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ─── Section 7: Detection Engines ─── */}
            {info?.detectionEngines && info.detectionEngines.length > 0 && (
              <Section title={`Detection Engines (${info.detectionEngines.length})`} icon={Cpu} defaultOpen={false}>
                <div className="flex flex-wrap gap-1.5">
                  {info.detectionEngines.map((engine) => (
                    <span key={engine.key} className="text-[10px] px-2 py-1 rounded-lg bg-accent border border-border text-foreground">
                      {engine.title}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* ─── Section 8: Container Info ─── */}
            {raw?.containerInfo?.name && (
              <Section title="Container Info" icon={Cpu} defaultOpen={false}>
                <DetailRow label="Container" value={raw.containerInfo.name} />
                <DetailRow label="Image" value={raw.containerInfo.image} mono />
                <DetailRow label="Container ID" value={raw.containerInfo.id} mono />
              </Section>
            )}

            {/* ─── Section 9: Raw JSON ─── */}
            <div className="border-b border-border/50 last:border-0">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="w-full flex items-center gap-2 px-5 py-3 hover:bg-accent/30 transition-colors text-left"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-muted-foreground flex-1">Raw JSON</span>
                {showRawJson ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {showRawJson && (
                <div className="px-5 pb-4">
                  <pre className="text-[10px] font-mono text-foreground/70 bg-accent/50 rounded-lg p-3 max-h-96 overflow-auto whitespace-pre-wrap break-all border border-border/50">
                    {JSON.stringify(raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmationDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction.type === "isolate" && t.deviceSourceId) {
              await isolateDevice.mutateAsync({ agentId: t.deviceSourceId });
            } else if (confirmAction.type === "unisolate" && t.deviceSourceId) {
              await unisolateDevice.mutateAsync({ agentId: t.deviceSourceId });
            } else if (confirmAction.type === "mitigate" && confirmAction.action) {
              await mitigateThreat.mutateAsync({ threatId, action: confirmAction.action });
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
