"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const VENDORS = [
  { id: "sentinelone", label: "SentinelOne", icon: ShieldAlert, color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "blackpoint", label: "Blackpoint", icon: Shield, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "huntress", label: "Huntress", icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10" },
];

export function SecurityPostureModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const vendors = (config.vendors as string[]) || ["sentinelone", "blackpoint", "huntress"];
  const displayMode = (config.displayMode as string) || "cards";

  const activeVendors = VENDORS.filter((v) => vendors.includes(v.id));

  return (
    <>
      <div className="p-4">
        {activeVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground">No vendors selected. Click the gear to configure.</p>
          </div>
        ) : (
          <div className={cn("grid gap-3", activeVendors.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
            {activeVendors.map((vendor) => {
              const VIcon = vendor.icon;
              return (
                <div key={vendor.id} className="rounded-lg border border-border p-3 text-center">
                  <div className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2", vendor.bg)}>
                    <VIcon className={cn("h-4 w-4", vendor.color)} />
                  </div>
                  <p className="text-lg font-bold text-muted-foreground">—</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{vendor.label}</p>
                  <p className="text-[10px] text-muted-foreground">Active Threats</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Connect EDR/MDR integrations for live data</span>
          <Link href="/settings/integrations" className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1">
            Configure <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ModuleConfigPanel title="Security Posture Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Vendors to display">
          <div className="flex flex-wrap gap-1.5">
            {VENDORS.map((v) => (
              <ConfigChip
                key={v.id}
                label={v.label}
                active={vendors.includes(v.id)}
                onClick={() => {
                  const next = vendors.includes(v.id) ? vendors.filter((x) => x !== v.id) : [...vendors, v.id];
                  onConfigChange({ ...config, vendors: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Display mode">
          <div className="flex gap-2">
            {[
              { id: "cards", label: "Cards" },
              { id: "list", label: "Compact List" },
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
