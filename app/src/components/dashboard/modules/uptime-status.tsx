"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigToggle } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

export function UptimeStatusModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const filterStatus = (config.filterStatus as string) || "all";
  const showLatency = config.showLatency !== false;

  const { data: monitors, isLoading } = trpc.uptime.list.useQuery(
    filterStatus !== "all" ? { status: filterStatus } : undefined,
    { refetchInterval: 30000 }
  );

  const list = monitors || [];

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
        {renderConfig()}
      </>
    );
  }

  if (list.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No monitors</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filterStatus !== "all" ? "No monitors match this filter." : "Add monitors in the Uptime Monitor page."}
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="p-3 space-y-1 overflow-y-auto max-h-full">
        {list.map((m) => {
          const isUp = m.status === "UP";
          const isDown = m.status === "DOWN";
          const isPending = m.status === "PENDING";
          const hb = m.latestHeartbeat as { latencyMs?: number } | null;

          return (
            <div key={m.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isUp ? "bg-green-500" : isDown ? "bg-red-500" : isPending ? "bg-yellow-500" : "bg-zinc-500"
              )} />
              <span className="text-xs font-medium text-foreground truncate flex-1">{m.name}</span>
              {!m.active && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-500 shrink-0">PAUSED</span>
              )}
              {showLatency && hb?.latencyMs && (
                <span className="text-[10px] text-muted-foreground shrink-0">{hb.latencyMs}ms</span>
              )}
              <span className={cn(
                "text-[10px] font-medium shrink-0",
                isUp ? "text-green-500" : isDown ? "text-red-500" : isPending ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {isUp ? "UP" : isDown ? "DOWN" : isPending ? "PENDING" : "—"}
              </span>
            </div>
          );
        })}
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Uptime Status Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Filter by status">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "UP", label: "Up" },
              { id: "DOWN", label: "Down" },
              { id: "PAUSED", label: "Paused" },
            ].map((s) => (
              <ConfigChip
                key={s.id}
                label={s.label}
                active={filterStatus === s.id}
                onClick={() => onConfigChange({ ...config, filterStatus: s.id })}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigToggle
          label="Show latency"
          checked={showLatency}
          onChange={(v) => onConfigChange({ ...config, showLatency: v })}
        />
      </ModuleConfigPanel>
    );
  }
}
