"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Star, Building2, Ticket, AlertTriangle, Monitor, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function ClientQuickAccessModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const pinnedClients = (config.pinnedClients as string[]) || [];
  const columns = (config.columns as number) || 2;

  const colsClass: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  if (pinnedClients.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
            <Star className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No pinned clients</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Click the gear icon to pin your favorite clients. Each card shows ticket count, alerts, and devices at a glance.
          </p>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
          >
            Browse Clients
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className={cn("grid gap-3 p-4", colsClass[columns] || colsClass[2])}>
        {pinnedClients.map((clientId) => (
          <div key={clientId} className="rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground truncate">{clientId}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <Ticket className="h-3 w-3 text-muted-foreground mx-auto" />
                <p className="text-xs font-bold text-muted-foreground mt-0.5">—</p>
                <p className="text-[9px] text-muted-foreground">Tickets</p>
              </div>
              <div className="text-center">
                <AlertTriangle className="h-3 w-3 text-muted-foreground mx-auto" />
                <p className="text-xs font-bold text-muted-foreground mt-0.5">—</p>
                <p className="text-[9px] text-muted-foreground">Alerts</p>
              </div>
              <div className="text-center">
                <Monitor className="h-3 w-3 text-muted-foreground mx-auto" />
                <p className="text-xs font-bold text-muted-foreground mt-0.5">—</p>
                <p className="text-[9px] text-muted-foreground">Devices</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Client Quick Access Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Pinned clients">
          <p className="text-[10px] text-muted-foreground mb-2">
            Client selection will be available once your PSA is connected. Clients will auto-populate from your PSA data.
          </p>
          <div className="rounded-lg bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            Connect PSA to pin clients
          </div>
        </ConfigSection>

        <ConfigSection label="Columns">
          <ConfigSelect
            value={String(columns)}
            onChange={(v) => onConfigChange({ ...config, columns: parseInt(v, 10) })}
            options={[
              { value: "1", label: "1 column" },
              { value: "2", label: "2 columns" },
              { value: "3", label: "3 columns" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
