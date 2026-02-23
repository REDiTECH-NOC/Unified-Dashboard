"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { HardDrive, CheckCircle2, AlertTriangle, RefreshCw, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function PatchComplianceModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const displayMode = (config.displayMode as string) || "summary";

  return (
    <>
      <div className="p-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Patched</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Need Patches</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <RefreshCw className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Need Reboot</p>
          </div>
        </div>

        {/* Compliance bar placeholder */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground">Compliance Rate</span>
            <span className="text-[10px] text-muted-foreground">—%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full rounded-full bg-muted/50" style={{ width: "0%" }} />
          </div>
        </div>

        {/* Device list placeholder */}
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

      <ModuleConfigPanel title="Patch Compliance Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Display mode">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "summary", label: "Summary" },
              { id: "devices", label: "Device List" },
              { id: "chart", label: "Compliance Chart" },
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
