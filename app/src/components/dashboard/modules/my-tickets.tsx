"use client";

import Link from "next/link";
import { UserCheck, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const STATUSES = [
  { id: "new", label: "New" },
  { id: "open", label: "Open" },
  { id: "in-progress", label: "In Progress" },
  { id: "waiting", label: "Waiting" },
  { id: "escalated", label: "Escalated" },
];

export function MyTicketsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const statuses = (config.statuses as string[]) || [];
  const sortOrder = (config.sortOrder as string) || "priority";

  return (
    <>
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
          <UserCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No tickets assigned</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Once connected to your PSA, tickets assigned to you will appear here with status, priority, age, and client.
        </p>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
        >
          Connect PSA
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ModuleConfigPanel title="My Tickets Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Filter by status">
          <p className="text-[10px] text-muted-foreground mb-2">Only show tickets in these statuses. Leave empty for all.</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <ConfigChip
                key={s.id}
                label={s.label}
                active={statuses.includes(s.id)}
                onClick={() => {
                  const next = statuses.includes(s.id) ? statuses.filter((x) => x !== s.id) : [...statuses, s.id];
                  onConfigChange({ ...config, statuses: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Sort order">
          <ConfigSelect
            value={sortOrder}
            onChange={(v) => onConfigChange({ ...config, sortOrder: v })}
            options={[
              { value: "priority", label: "Priority (high to low)" },
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first (most stale)" },
              { value: "updated", label: "Recently updated" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
