"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Phone, PhoneIncoming, Users, ArrowUpRight, Loader2, Radio, HardDrive } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ModuleConfigPanel, ConfigSection, ConfigSelect, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function CallActivityModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const displayMode = (config.displayMode as string) || "summary";

  const { data: instances, isLoading: loadingInstances } = trpc.threecx.listInstances.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });

  const { data: overview, isLoading: loadingOverview, isError, error } = trpc.threecx.getDashboardOverview.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });

  const notConnected = isError && (error?.message?.includes("No active") || error?.message?.includes("not configured") || error?.message?.includes("No 3CX"));

  // Auto-select first PBX if none configured
  const selectedPbxId = (config.pbxInstance as string) || instances?.[0]?.id || "";

  const selectedPbx = useMemo(() => {
    if (!overview) return null;
    return overview.find((p) => p.id === selectedPbxId) ?? overview[0] ?? null;
  }, [overview, selectedPbxId]);

  if (notConnected) {
    return (
      <>
        <div className="p-4">
          <div className="flex flex-col items-center py-6 text-center">
            <Phone className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Connect 3CX to see live call data</p>
          </div>
          <div className="mt-2 pt-3 border-t border-border">
            <Link href="/settings/integrations" className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1">
              Configure 3CX <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (loadingInstances || loadingOverview) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        {/* PBX selector (if multiple instances) */}
        {instances && instances.length > 1 && (
          <div className="mb-3">
            <select
              value={selectedPbxId}
              onChange={(e) => onConfigChange({ ...config, pbxInstance: e.target.value })}
              className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-muted/30 text-foreground"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedPbx ? (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Active", value: selectedPbx.callsActive ?? 0, icon: PhoneIncoming, color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Extensions", value: `${selectedPbx.extensionsRegistered ?? 0}/${selectedPbx.extensionsTotal ?? 0}`, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Trunks", value: `${selectedPbx.trunksRegistered ?? 0}/${selectedPbx.trunksTotal ?? 0}`, icon: Radio, color: "text-purple-500", bg: "bg-purple-500/10" },
                { label: "Disk", value: selectedPbx.diskUsagePercent != null ? `${selectedPbx.diskUsagePercent}%` : "—", icon: HardDrive, color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map((stat) => {
                const SIcon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-lg bg-muted/30 p-2.5 text-center">
                    <div className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md mb-1", stat.bg)}>
                      <SIcon className={cn("h-3 w-3", stat.color)} />
                    </div>
                    <p className="text-sm font-bold text-foreground">{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Status + version row */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", selectedPbx.status === "online" ? "bg-green-500" : "bg-red-500")} />
                <span className="text-[10px] text-muted-foreground capitalize">{selectedPbx.status}</span>
              </div>
              {selectedPbx.version && (
                <span className="text-[10px] text-muted-foreground">v{selectedPbx.version}</span>
              )}
              {selectedPbx.updateAvailable && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Update</span>
              )}
            </div>

            {/* View Details link */}
            <div className="pt-3 border-t border-border">
              <Link
                href={`/3cx/${selectedPbx.id}`}
                className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1"
              >
                View Details <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <Phone className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No PBX instances found</p>
          </div>
        )}
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Call Activity Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="PBX Instance">
          {instances && instances.length > 0 ? (
            <ConfigSelect
              value={selectedPbxId}
              onChange={(v) => onConfigChange({ ...config, pbxInstance: v })}
              options={instances.map((inst) => ({ value: inst.id, label: inst.name }))}
            />
          ) : (
            <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              No PBX instances configured
            </div>
          )}
        </ConfigSection>

        <ConfigSection label="Display mode">
          <div className="flex gap-2">
            {[
              { id: "summary", label: "Summary" },
              { id: "stats-only", label: "Stats Only" },
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
    );
  }
}
