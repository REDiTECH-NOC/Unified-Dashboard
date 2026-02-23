"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const ALERT_SOURCES = [
  { id: "sentinelone", label: "SentinelOne" },
  { id: "blackpoint", label: "Blackpoint" },
  { id: "huntress", label: "Huntress" },
  { id: "ninjarmm", label: "NinjaRMM" },
  { id: "uptime", label: "Uptime Monitor" },
  { id: "veeam", label: "Veeam" },
  { id: "datto", label: "Datto" },
];

const SEVERITIES = [
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
  { id: "info", label: "Info" },
];

export function RecentAlertsModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const sources = (config.sources as string[]) || [];
  const severities = (config.severities as string[]) || [];
  const sortOrder = (config.sortOrder as string) || "newest";

  const hasFilters = sources.length > 0 || severities.length > 0;

  return (
    <>
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-4">
          <AlertTriangle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No alerts</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {hasFilters
            ? `Filtered to: ${[...sources, ...severities].join(", ")}. Connect integrations to see alerts.`
            : "Connect your monitoring integrations to start receiving alerts."
          }
        </p>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
        >
          Configure Integrations
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ModuleConfigPanel title="Alert Feed Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Filter by source">
          <p className="text-[10px] text-muted-foreground mb-2">Leave empty to show all sources.</p>
          <div className="flex flex-wrap gap-1.5">
            {ALERT_SOURCES.map((src) => (
              <ConfigChip
                key={src.id}
                label={src.label}
                active={sources.includes(src.id)}
                onClick={() => {
                  const next = sources.includes(src.id)
                    ? sources.filter((s) => s !== src.id)
                    : [...sources, src.id];
                  onConfigChange({ ...config, sources: next });
                }}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Filter by severity">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((sev) => (
              <ConfigChip
                key={sev.id}
                label={sev.label}
                active={severities.includes(sev.id)}
                onClick={() => {
                  const next = severities.includes(sev.id)
                    ? severities.filter((s) => s !== sev.id)
                    : [...severities, sev.id];
                  onConfigChange({ ...config, severities: next });
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
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "severity", label: "Severity (high to low)" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
