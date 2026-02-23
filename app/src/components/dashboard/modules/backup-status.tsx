"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { HardDrive, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const VENDORS = [
  { id: "veeam", label: "Veeam", color: "text-green-500" },
  { id: "datto", label: "Datto", color: "text-blue-500" },
  { id: "acronis", label: "Acronis", color: "text-red-500" },
];

export function BackupStatusModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const vendors = (config.vendors as string[]) || ["veeam", "datto", "acronis"];
  const displayMode = (config.displayMode as string) || "summary";

  const activeVendors = VENDORS.filter((v) => vendors.includes(v.id));

  return (
    <>
      <div className="p-4">
        {/* Summary stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Successful</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <HardDrive className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-muted-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">Overdue</p>
          </div>
        </div>

        {/* Vendor breakdown */}
        <div className="space-y-2">
          {activeVendors.map((vendor) => (
            <div key={vendor.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{vendor.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Awaiting connection</span>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <Link href="/settings/integrations" className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1">
            Connect backup integrations <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ModuleConfigPanel title="Backup Status Settings" open={isConfigOpen} onClose={onConfigClose}>
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
              { id: "summary", label: "Summary" },
              { id: "by-client", label: "By Client" },
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
