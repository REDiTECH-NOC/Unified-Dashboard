"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HardDrive, CheckCircle2, AlertTriangle, RefreshCw, ArrowUpRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

interface DevicePatchSummary {
  deviceId: number;
  systemName: string;
  orgName: string;
  totalPatches: number;
  installed: number;
  pending: number;
}

export function PatchComplianceModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const displayMode = (config.displayMode as string) || "summary";

  const { data: patchData, isLoading, isError, error } = trpc.rmm.getFleetPatchCompliance.useQuery(undefined, {
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
  });

  const notConnected = isError && (error?.message?.includes("No active") || error?.message?.includes("not configured"));

  // Aggregate per-device patch status
  const stats = useMemo(() => {
    const patches = patchData?.data;
    if (!patches || !Array.isArray(patches)) return null;

    const deviceMap = new Map<number, DevicePatchSummary>();
    for (const p of patches as { deviceId?: number; systemName?: string; status?: string; installedAt?: string; references?: { organization?: { name?: string } } }[]) {
      const deviceId = p.deviceId ?? 0;
      if (!deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, {
          deviceId,
          systemName: p.systemName ?? `Device ${deviceId}`,
          orgName: p.references?.organization?.name ?? "",
          totalPatches: 0,
          installed: 0,
          pending: 0,
        });
      }
      const d = deviceMap.get(deviceId)!;
      d.totalPatches++;
      if (p.installedAt) {
        d.installed++;
      } else {
        d.pending++;
      }
    }

    const devices = Array.from(deviceMap.values());
    const patched = devices.filter((d) => d.pending === 0).length;
    const needPatches = devices.filter((d) => d.pending > 0).length;
    const totalPending = devices.reduce((sum, d) => sum + d.pending, 0);
    const complianceRate = devices.length > 0 ? Math.round((patched / devices.length) * 100) : 0;

    return { patched, needPatches, totalPending, complianceRate, devices };
  }, [patchData]);

  if (notConnected) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center py-4 text-center">
          <HardDrive className="h-6 w-6 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Connect NinjaRMM for patch data</p>
        </div>
        <div className="pt-3 border-t border-border">
          <Link href="/settings/integrations" className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1">
            Connect NinjaRMM <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{stats?.patched ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Patched</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{stats?.needPatches ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Need Patches</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <RefreshCw className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{stats?.totalPending ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Compliance bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground">Compliance Rate</span>
            <span className="text-[10px] text-foreground font-semibold">{stats?.complianceRate ?? 0}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", (stats?.complianceRate ?? 0) >= 90 ? "bg-green-500" : (stats?.complianceRate ?? 0) >= 70 ? "bg-amber-500" : "bg-red-500")}
              style={{ width: `${stats?.complianceRate ?? 0}%` }}
            />
          </div>
        </div>

        {/* Device list */}
        {displayMode !== "summary" && stats?.devices && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {stats.devices
              .sort((a, b) => b.pending - a.pending)
              .slice(0, 20)
              .map((d) => (
                <div key={d.deviceId} className="flex items-center justify-between py-1 px-2 rounded bg-muted/20 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", d.pending > 0 ? "bg-amber-500" : "bg-green-500")} />
                    <span className="truncate text-foreground">{d.systemName}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {d.pending > 0 ? `${d.pending} pending` : "Up to date"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      <ModuleConfigPanel title="Patch Compliance Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Display mode">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "summary", label: "Summary" },
              { id: "devices", label: "Device List" },
            ].map((m) => (
              <ConfigChip
                key={m.id}
                label={m.label}
                active={displayMode === m.id}
                onClick={() => onConfigChange({ ...config, displayMode: m.id })}
              />
            ))}
          </div>
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
