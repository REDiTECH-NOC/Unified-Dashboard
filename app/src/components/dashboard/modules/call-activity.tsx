"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Phone, PhoneMissed, PhoneIncoming, Voicemail, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function CallActivityModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const displayMode = (config.displayMode as string) || "summary";

  return (
    <>
      <div className="p-4">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: "Active", value: "—", icon: PhoneIncoming, color: "text-green-500", bg: "bg-green-500/10" },
            { label: "Missed", value: "—", icon: PhoneMissed, color: "text-red-500", bg: "bg-red-500/10" },
            { label: "Today", value: "—", icon: Phone, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Voicemail", value: "—", icon: Voicemail, color: "text-purple-500", bg: "bg-purple-500/10" },
          ].map((stat) => {
            const SIcon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg bg-muted/30 p-2.5 text-center">
                <div className={cn("inline-flex items-center justify-center w-6 h-6 rounded-md mb-1", stat.bg)}>
                  <SIcon className={cn("h-3 w-3", stat.color)} />
                </div>
                <p className="text-sm font-bold text-muted-foreground">{stat.value}</p>
                <p className="text-[9px] text-muted-foreground uppercase">{stat.label}</p>
              </div>
            );
          })}
        </div>

        {/* Recent calls placeholder */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Calls</p>
          <div className="flex flex-col items-center py-6 text-center">
            <Phone className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">Connect 3CX to see live call data</p>
          </div>
        </div>

        <div className="mt-2 pt-3 border-t border-border">
          <Link href="/settings/integrations" className="text-[10px] text-red-500 hover:text-red-400 inline-flex items-center gap-1">
            Configure 3CX <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <ModuleConfigPanel title="Call Activity Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="PBX Instance">
          <p className="text-[10px] text-muted-foreground mb-2">Select which 3CX PBX to display. Available after connecting 3CX.</p>
          <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            No PBX instances configured
          </div>
        </ConfigSection>

        <ConfigSection label="Display mode">
          <div className="flex gap-2">
            {[
              { id: "summary", label: "Summary + Recent" },
              { id: "stats-only", label: "Stats Only" },
              { id: "call-log", label: "Call Log" },
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
