"use client";

import { useState, Component, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Radio,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Globe,
  Server,
  Phone,
  AlertTriangle,
} from "lucide-react";

interface TabTrunksProps {
  instanceId: string;
}

/* ─── Error Boundary — catches render errors in expanded trunk details ─── */
class TrunkErrorBoundary extends Component<
  { children: ReactNode; trunkNumber: string },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: { children: ReactNode; trunkNumber: string }) {
    super(props);
    this.state = { hasError: false, errorMsg: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || "Unknown error" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <tr className="bg-accent/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="flex items-center gap-2 text-yellow-500 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Failed to render details for trunk {this.props.trunkNumber}:{" "}
                {this.state.errorMsg}
              </span>
            </div>
          </td>
        </tr>
      );
    }
    return this.props.children;
  }
}

/* ─── Safely convert any value to a renderable string ─── */
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val || "—";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  // Objects/arrays — stringify them so React doesn't crash
  try {
    return JSON.stringify(val);
  } catch {
    return "—";
  }
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export function TabTrunks({ instanceId }: TabTrunksProps) {
  const [expandedTrunk, setExpandedTrunk] = useState<number | null>(null);

  const { data: trunks, isLoading, error } = trpc.threecx.getTrunkDetails.useQuery(
    { instanceId },
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        <p>Failed to load trunks: {error.message}</p>
        <p className="text-xs mt-1 opacity-60">The PBX may be offline or the API returned an error.</p>
      </div>
    );
  }

  if (!trunks || !Array.isArray(trunks)) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load trunks. The PBX may be offline.
      </div>
    );
  }

  if (trunks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Radio className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No trunks configured</p>
        </div>
      </div>
    );
  }

  const online = trunks.filter((t: any) => t?.isOnline).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Radio className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {online} / {trunks.length} online
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Click a trunk to expand details
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-8 px-2 py-2.5"></th>
              <th className="text-left px-4 py-2.5 font-medium">Number</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">External Number</th>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Sim. Calls</th>
              <th className="text-left px-4 py-2.5 font-medium">Gateway</th>
              <th className="text-left px-4 py-2.5 font-medium">Host</th>
            </tr>
          </thead>
          <tbody>
            {trunks.map((trunk: any, idx: number) => {
              if (!trunk) return null;
              const trunkId = typeof trunk.id === "number" ? trunk.id : idx;
              const isExpanded = expandedTrunk === trunkId;
              return (
                <TrunkRow
                  key={trunkId}
                  trunk={trunk}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedTrunk(isExpanded ? null : trunkId)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Trunk Row ─── */
function TrunkRow({
  trunk,
  isExpanded,
  onToggle,
}: {
  trunk: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Defensive — treat every field as potentially missing or wrong type
  const number = safeStr(trunk?.number);
  const isOnline = trunk?.isOnline === true;
  const externalNumber = safeStr(trunk?.externalNumber);
  const type = safeStr(trunk?.type);
  const simCalls = typeof trunk?.simultaneousCalls === "number" ? trunk.simultaneousCalls : 0;
  const gatewayName = safeStr(trunk?.gatewayName);
  const gatewayHost = safeStr(trunk?.gatewayHost);

  // Arrays — ensure every item is a string (3CX API may return objects)
  const rawDidNumbers = Array.isArray(trunk?.didNumbers) ? trunk.didNumbers : [];
  const didNumbers: string[] = rawDidNumbers.map((d: unknown) => safeStr(d)).filter((s: string) => s !== "—");

  const rawRegTimes = Array.isArray(trunk?.registrationTimes) ? trunk.registrationTimes : [];
  const regTimes: string[] = rawRegTimes.map((t: unknown) => safeStr(t)).filter((s: string) => s !== "—");

  const authId = trunk?.authId ? safeStr(trunk.authId) : null;
  const registrarHost = trunk?.registrarHost ? safeStr(trunk.registrarHost) : null;
  const registrarPort = typeof trunk?.registrarPort === "number" ? trunk.registrarPort : null;

  return (
    <TrunkErrorBoundary trunkNumber={number}>
      <tr
        className={cn(
          "border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
          isExpanded && "bg-accent/30"
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform mx-auto",
              isExpanded && "rotate-90"
            )}
          />
        </td>
        <td className="px-4 py-3 font-mono font-medium text-foreground">{number}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={isOnline ? "text-green-500" : "text-red-500"}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground font-mono">{externalNumber}</td>
        <td className="px-4 py-3 text-muted-foreground">{type}</td>
        <td className="px-4 py-3 text-foreground">{simCalls}</td>
        <td className="px-4 py-3 text-muted-foreground">{gatewayName}</td>
        <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">{gatewayHost}</td>
      </tr>

      {isExpanded && (
        <tr className="bg-accent/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Connection Details */}
              <div className="rounded-lg bg-card border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Server className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-foreground">Connection</span>
                </div>
                <div className="divide-y divide-border/30">
                  <InfoRow label="Gateway" value={gatewayName} />
                  <InfoRow label="Host" value={<span className="font-mono text-[10px]">{gatewayHost}</span>} />
                  {registrarHost && (
                    <InfoRow label="Registrar" value={<span className="font-mono text-[10px]">{registrarHost}{registrarPort !== null ? `:${registrarPort}` : ""}</span>} />
                  )}
                  {authId && (
                    <InfoRow label="Auth ID" value={<span className="font-mono text-[10px]">{authId}</span>} />
                  )}
                  <InfoRow label="Sim. Calls" value={String(simCalls)} />
                  <InfoRow label="Type" value={type} />
                </div>
              </div>

              {/* DID Numbers */}
              <div className="rounded-lg bg-card border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Phone className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-foreground">
                    DID Numbers ({didNumbers.length})
                  </span>
                </div>
                {didNumbers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {didNumbers.map((did: string, i: number) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-1 rounded bg-accent border border-border font-mono text-[11px] text-foreground"
                      >
                        {did}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No DID numbers configured</p>
                )}
              </div>

              {/* Registration Times */}
              <div className="rounded-lg bg-card border border-border p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs font-medium text-foreground">Registration History</span>
                </div>
                {regTimes.length > 0 ? (
                  <div className="space-y-1">
                    {regTimes.slice(0, 5).map((time: string, i: number) => {
                      let display = time;
                      try {
                        const d = new Date(time);
                        if (!isNaN(d.getTime())) {
                          display = d.toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        }
                      } catch {
                        // Keep raw string
                      }
                      return (
                        <div key={i} className="flex items-center gap-2 text-[11px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                          <span className="text-muted-foreground">{display}</span>
                        </div>
                      );
                    })}
                    {regTimes.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{regTimes.length - 5} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No registration history</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </TrunkErrorBoundary>
  );
}
