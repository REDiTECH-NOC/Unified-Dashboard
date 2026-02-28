"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Phone, PhoneIncoming, Users, Radio, HardDrive, ArrowUpRight, Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function PhoneQuickAccessModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const { data: instances, isLoading, isError, error } = trpc.threecx.listInstances.useQuery(undefined, {
    staleTime: 60_000,
    retry: 1,
  });

  const { data: overview } = trpc.threecx.getDashboardOverview.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
    enabled: !!instances && instances.length > 0,
  });

  const notConnected = isError && (error?.message?.includes("No active") || error?.message?.includes("not configured") || error?.message?.includes("No 3CX"));

  const selectedPbxId = (config.pbxInstanceId as string) || "";

  // Find the selected PBX from overview data, or auto-select first
  const selectedPbx = useMemo(() => {
    if (!overview || overview.length === 0) return null;
    if (selectedPbxId) {
      return overview.find((p) => p.id === selectedPbxId) ?? overview[0];
    }
    return overview[0];
  }, [overview, selectedPbxId]);

  if (notConnected) {
    return (
      <>
        <div className="p-4">
          <div className="flex flex-col items-center py-8 text-center">
            <Phone className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No Phone Systems</p>
            <p className="text-xs text-muted-foreground mt-1">Add a 3CX PBX instance to see phone system stats here.</p>
            <Link href="/3cx" className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
              Configure 3CX <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {renderConfig()}
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!instances || instances.length === 0) {
    return (
      <>
        <div className="p-4">
          <div className="flex flex-col items-center py-8 text-center">
            <Phone className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground">No PBX instances registered</p>
            <Link href="/3cx" className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-red-500 hover:text-red-400 transition-colors">
              Add PBX <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="p-4">
        {/* PBX selector */}
        {instances.length > 1 && (
          <select
            value={selectedPbx?.id || ""}
            onChange={(e) => onConfigChange({ ...config, pbxInstanceId: e.target.value })}
            className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-muted/30 text-foreground mb-3"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} {inst.companyName ? `(${inst.companyName})` : ""}
              </option>
            ))}
          </select>
        )}

        {selectedPbx ? (
          <>
            {/* Header with status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg",
                  selectedPbx.status === "online" ? "bg-green-500/10" : "bg-red-500/10"
                )}>
                  <Phone className={cn("h-4 w-4", selectedPbx.status === "online" ? "text-green-500" : "text-red-500")} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedPbx.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{selectedPbx.status}</p>
                </div>
              </div>
              {selectedPbx.updateAvailable && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Update
                </span>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: "Active Calls", value: selectedPbx.callsActive ?? 0, icon: PhoneIncoming, color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Extensions", value: `${selectedPbx.extensionsRegistered ?? 0}/${selectedPbx.extensionsTotal ?? 0}`, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Trunks", value: `${selectedPbx.trunksRegistered ?? 0}/${selectedPbx.trunksTotal ?? 0}`, icon: Radio, color: "text-purple-500", bg: "bg-purple-500/10" },
                { label: "Disk Usage", value: selectedPbx.diskUsagePercent != null ? `${selectedPbx.diskUsagePercent}%` : "—", icon: HardDrive, color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map((stat) => {
                const SIcon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-lg bg-muted/30 p-2.5 flex items-center gap-2.5">
                    <div className={cn("flex items-center justify-center w-7 h-7 rounded-md shrink-0", stat.bg)}>
                      <SIcon className={cn("h-3.5 w-3.5", stat.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{stat.value}</p>
                      <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Version + View link */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {selectedPbx.version && (
                <span className="text-[10px] text-muted-foreground">v{selectedPbx.version}</span>
              )}
              <Link
                href={`/3cx/${selectedPbx.id}`}
                className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1 ml-auto"
              >
                View Details <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Phone Quick Access Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="PBX Instance">
          {instances && instances.length > 0 ? (
            <ConfigSelect
              value={selectedPbxId || instances[0]?.id || ""}
              onChange={(v) => onConfigChange({ ...config, pbxInstanceId: v })}
              options={instances.map((inst) => ({
                value: inst.id,
                label: `${inst.name}${inst.companyName ? ` (${inst.companyName})` : ""}`,
              }))}
            />
          ) : (
            <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              No PBX instances configured
            </div>
          )}
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
