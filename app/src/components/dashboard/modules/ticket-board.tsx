"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Columns3, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const PLACEHOLDER_COLUMNS = [
  { status: "New", color: "border-blue-500", count: 0 },
  { status: "In Progress", color: "border-yellow-500", count: 0 },
  { status: "Waiting", color: "border-orange-500", count: 0 },
  { status: "Escalated", color: "border-red-500", count: 0 },
  { status: "Resolved", color: "border-green-500", count: 0 },
];

export function TicketBoardModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const board = (config.board as string) || "";
  const maxPerColumn = (config.maxPerColumn as number) || 5;

  if (!board) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
            <Columns3 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No board selected</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Click the gear icon to select a PSA board. Tickets will appear as a kanban-style view with status columns.
          </p>
          <Link
            href="/settings/integrations"
            className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
          >
            Connect PSA
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="p-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {PLACEHOLDER_COLUMNS.map((col) => (
            <div key={col.status} className={cn("w-40 shrink-0 rounded-lg border-t-2 bg-muted/20 p-2", col.color)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-foreground uppercase tracking-wide">{col.status}</span>
                <span className="text-[10px] text-muted-foreground">{col.count}</span>
              </div>
              <div className="space-y-1.5 min-h-[80px]">
                <div className="rounded bg-muted/30 border border-border/50 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">No tickets</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Ticket Board Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Board">
          <p className="text-[10px] text-muted-foreground mb-2">
            Select which PSA board to display. Boards populate once PSA is connected.
          </p>
          <ConfigSelect
            value={board}
            onChange={(v) => onConfigChange({ ...config, board: v })}
            options={[
              { value: "", label: "Select a board..." },
              { value: "service", label: "Service Board" },
              { value: "project", label: "Project Board" },
              { value: "support", label: "Support Board" },
            ]}
          />
        </ConfigSection>

        <ConfigSection label="Max tickets per column">
          <ConfigSelect
            value={String(maxPerColumn)}
            onChange={(v) => onConfigChange({ ...config, maxPerColumn: parseInt(v, 10) })}
            options={[
              { value: "3", label: "3 tickets" },
              { value: "5", label: "5 tickets" },
              { value: "10", label: "10 tickets" },
              { value: "15", label: "15 tickets" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
