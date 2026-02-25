"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  X,
  Loader2,
  Monitor,
  Shield,
  Wifi,
  WifiOff,
  ScanLine,
  Globe,
  Server,
  Laptop,
  HardDrive,
  ChevronDown,
  ChevronRight,
  Package,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { ConfirmationDialog } from "./confirmation-dialog";

/* ─── TYPES ────────────────────────────────────────────── */

interface EndpointDetailPanelProps {
  agentId: string;
  onClose: () => void;
}

/* ─── HELPERS ──────────────────────────────────────────── */

const statusDot: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-zinc-500",
  warning: "bg-yellow-500",
  unknown: "bg-zinc-600",
};

const statusLabel: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  unknown: "Unknown",
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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[10px] text-muted-foreground shrink-0 w-28">{label}</span>
      <span className="text-xs text-foreground text-right">{value}</span>
    </div>
  );
}

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function EndpointDetailPanel({ agentId, onClose }: EndpointDetailPanelProps) {
  const { dateTime } = useTimezone();
  const [showApps, setShowApps] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "isolate" | "unisolate"; hostname: string } | null>(null);

  const utils = trpc.useUtils();

  // Queries
  const agent = trpc.edr.getAgentById.useQuery({ id: agentId }, { refetchInterval: 15000 });
  const apps = trpc.edr.getAgentApplications.useQuery(
    { agentId, pageSize: 100 },
    { enabled: showApps }
  );
  const deviceThreats = trpc.edr.getThreats.useQuery(
    { searchTerm: agent.data?.hostname, pageSize: 50 },
    { enabled: !!agent.data?.hostname, refetchInterval: 30000 }
  );

  // Mutations
  const isolateDevice = trpc.edr.isolateDevice.useMutation({
    onSuccess: () => { utils.edr.getAgentById.invalidate({ id: agentId }); utils.edr.getAgents.invalidate(); },
  });
  const unisolateDevice = trpc.edr.unisolateDevice.useMutation({
    onSuccess: () => { utils.edr.getAgentById.invalidate({ id: agentId }); utils.edr.getAgents.invalidate(); },
  });
  const triggerScan = trpc.edr.triggerFullScan.useMutation({
    onSuccess: () => utils.edr.getAgentById.invalidate({ id: agentId }),
  });

  if (agent.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-xl h-full bg-card border-l border-border flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!agent.data) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-xl h-full bg-card border-l border-border flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Failed to load endpoint</p>
          <button onClick={onClose} className="text-xs text-red-500">Close</button>
        </div>
      </div>
    );
  }

  const a = agent.data;
  const meta = a.metadata as Record<string, unknown> | undefined;
  const networkStatus = meta?.networkStatus as string | undefined;
  const isIsolated = networkStatus === "disconnected";
  const activeThreats = meta?.activeThreats as number | undefined;
  const scanStatus = meta?.scanStatus as string | undefined;
  const operationalState = meta?.operationalState as string | undefined;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        <div className="relative w-full max-w-xl h-full bg-card border-l border-border overflow-y-auto">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusDot[a.status] ?? statusDot.unknown)} />
                  <h2 className="text-sm font-semibold text-foreground truncate">{a.hostname}</h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground border border-border">
                    {a.deviceType ?? "endpoint"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{a.os} {a.osVersion}</span>
                  {isIsolated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      Isolated
                    </span>
                  )}
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {isIsolated ? (
                  <button
                    onClick={() => setConfirmAction({ type: "unisolate", hostname: a.hostname })}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    <Wifi className="h-3 w-3" />
                    Reconnect
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmAction({ type: "isolate", hostname: a.hostname })}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    <WifiOff className="h-3 w-3" />
                    Isolate
                  </button>
                )}
                <button
                  onClick={() => triggerScan.mutate({ agentId })}
                  disabled={triggerScan.isPending}
                  className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium bg-accent hover:bg-accent/80 text-foreground border border-border transition-colors disabled:opacity-50"
                >
                  {triggerScan.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ScanLine className="h-3 w-3" />}
                  Scan
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>
            {/* Agent Summary */}
            <Section title="Agent Summary" icon={Monitor}>
              <div className="space-y-0">
                <DetailRow label="Status" value={statusLabel[a.status] ?? a.status} />
                <DetailRow label="Network" value={networkStatus} />
                <DetailRow label="Operational" value={operationalState} />
                <DetailRow label="Scan Status" value={scanStatus} />
                <DetailRow label="Agent Version" value={a.agentVersion} />
                <DetailRow label="Active Threats" value={String(activeThreats ?? 0)} />
                {a.lastSeen && <DetailRow label="Last Seen" value={dateTime(a.lastSeen)} />}
              </div>
            </Section>

            {/* System Info */}
            <Section title="System Info" icon={Server}>
              <div className="space-y-0">
                <DetailRow label="OS" value={`${a.os ?? ""} ${a.osVersion ?? ""}`.trim()} />
                <DetailRow label="Device Type" value={a.deviceType} />
                <DetailRow label="Model" value={a.model} />
                <DetailRow label="Manufacturer" value={a.manufacturer} />
                <DetailRow label="Serial Number" value={a.serialNumber} />
              </div>
            </Section>

            {/* Network Info */}
            <Section title="Network" icon={Globe}>
              <div className="space-y-0">
                <DetailRow label="Public IP" value={a.publicIp} />
                <DetailRow label="Private IP" value={a.privateIp} />
                <DetailRow label="Site" value={a.organizationName} />
                {typeof meta?.groupName === "string" && <DetailRow label="Group" value={meta.groupName} />}
                {typeof meta?.accountName === "string" && <DetailRow label="Account" value={meta.accountName} />}
              </div>
            </Section>

            {/* Alert History */}
            <Section
              title={`Alert History${deviceThreats.data?.data ? ` (${deviceThreats.data.data.length})` : ""}`}
              icon={ShieldAlert}
            >
              {deviceThreats.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : !deviceThreats.data?.data || deviceThreats.data.data.length === 0 ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <ShieldCheck className="h-4 w-4 text-green-500/50" />
                  <p className="text-xs text-muted-foreground">No alert history for this device</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {deviceThreats.data.data.map((threat) => {
                    const raw = threat._raw as Record<string, unknown> | undefined;
                    const threatInfo = raw?.threatInfo as Record<string, unknown> | undefined;
                    const classification = threatInfo?.classification as string | undefined;
                    const confidence = threatInfo?.confidenceLevel as string | undefined;
                    return (
                      <div key={threat.sourceId} className="py-2 px-2.5 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            threat.severity === "critical" ? "bg-red-500" :
                              threat.severity === "high" ? "bg-orange-500" :
                                threat.severity === "medium" ? "bg-yellow-500" : "bg-blue-400"
                          )} />
                          <span className="text-xs text-foreground truncate flex-1">{threat.title}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            threat.status === "resolved" || threat.status === "mitigated"
                              ? "text-green-400 bg-green-500/10"
                              : "text-red-400 bg-red-500/10"
                          )}>
                            {threat.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-3.5">
                          <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                          <span className="text-[10px] text-muted-foreground">{dateTime(threat.detectedAt)}</span>
                          {classification && (
                            <span className="text-[10px] text-muted-foreground">&middot; {classification}</span>
                          )}
                          {confidence && (
                            <span className={cn(
                              "text-[10px]",
                              confidence === "malicious" ? "text-red-400" :
                                confidence === "suspicious" ? "text-orange-400" : "text-muted-foreground"
                            )}>
                              {confidence}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {deviceThreats.data.totalCount && deviceThreats.data.totalCount > deviceThreats.data.data.length && (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      Showing {deviceThreats.data.data.length} of {deviceThreats.data.totalCount} alerts
                    </p>
                  )}
                </div>
              )}
            </Section>

            {/* Installed Applications */}
            <div className="border-b border-border/50 last:border-0">
              <button
                onClick={() => setShowApps(!showApps)}
                className="w-full flex items-center gap-2 px-5 py-3 hover:bg-accent/30 transition-colors text-left"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium text-foreground flex-1">
                  Installed Applications
                  {apps.data?.data?.length ? ` (${apps.data.data.length})` : ""}
                </span>
                {showApps ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {showApps && (
                <div className="px-5 pb-4">
                  {apps.isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : apps.data?.data?.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">No applications found</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto space-y-0">
                      {apps.data?.data?.map((app, i) => (
                        <div key={`${app.name}-${i}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-foreground truncate block">{app.name}</span>
                            {app.publisher && <span className="text-[10px] text-muted-foreground">{app.publisher}</span>}
                          </div>
                          {app.version && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{app.version}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mutation Feedback */}
            {(isolateDevice.isSuccess || unisolateDevice.isSuccess || triggerScan.isSuccess) && (
              <div className="mx-5 my-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-green-400">
                  {isolateDevice.isSuccess && "Device isolated successfully"}
                  {unisolateDevice.isSuccess && "Device reconnected successfully"}
                  {triggerScan.isSuccess && "Full scan initiated"}
                </p>
              </div>
            )}
            {(isolateDevice.error || unisolateDevice.error || triggerScan.error) && (
              <div className="mx-5 my-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">
                  {isolateDevice.error?.message ?? unisolateDevice.error?.message ?? triggerScan.error?.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmationDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            if (confirmAction.type === "isolate") {
              await isolateDevice.mutateAsync({ agentId });
            } else {
              await unisolateDevice.mutateAsync({ agentId });
            }
          }}
          title={confirmAction.type === "isolate" ? "Isolate Device" : "Reconnect Device"}
          description={
            confirmAction.type === "isolate"
              ? `Disconnect ${confirmAction.hostname} from the network. It will only maintain connectivity to the SentinelOne console.`
              : `Reconnect ${confirmAction.hostname} to the network. Normal connectivity will be restored.`
          }
          confirmLabel={confirmAction.type === "isolate" ? "Isolate" : "Reconnect"}
          variant={confirmAction.type === "isolate" ? "danger" : "warning"}
        />
      )}
    </>
  );
}
