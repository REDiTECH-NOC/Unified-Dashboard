"use client";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { FileText, Loader2, User, Shield, Settings, Ticket } from "lucide-react";
import { ModuleConfigPanel, ConfigSection, ConfigChip, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  AUTH: Shield,
  USER: User,
  ADMIN: Settings,
  TICKET: Ticket,
};

export function RecentActivityModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const { timeShort } = useTimezone();
  const scope = (config.scope as string) || "all";
  const maxItems = (config.maxItems as number) || 15;

  const { data, isLoading } = trpc.audit.list.useQuery(
    { limit: maxItems },
    { refetchInterval: 30000 }
  );

  const entries = data?.items ?? [];

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

  if (entries.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Actions will appear here as users interact with the platform.
          </p>
        </div>
        {renderConfig()}
      </>
    );
  }

  return (
    <>
      <div className="p-3 space-y-0.5 overflow-y-auto max-h-full">
        {entries.map((entry) => {
          const CatIcon = CATEGORY_ICONS[entry.category] || FileText;
          return (
            <div key={entry.id} className="flex items-start gap-2.5 py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted/40 shrink-0 mt-0.5">
                <CatIcon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{entry.action}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-accent text-muted-foreground shrink-0">{entry.category}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">
                    {(entry as unknown as { actor?: { name?: string } }).actor?.name || entry.actorId || "System"}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {timeShort(entry.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    return (
      <ModuleConfigPanel title="Activity Feed Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Scope">
          <div className="flex gap-2">
            {[
              { id: "all", label: "All Users" },
              { id: "mine", label: "My Actions Only" },
            ].map((s) => (
              <ConfigChip
                key={s.id}
                label={s.label}
                active={scope === s.id}
                onClick={() => onConfigChange({ ...config, scope: s.id })}
              />
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Max items shown">
          <ConfigSelect
            value={String(maxItems)}
            onChange={(v) => onConfigChange({ ...config, maxItems: parseInt(v, 10) })}
            options={[
              { value: "10", label: "10 entries" },
              { value: "15", label: "15 entries" },
              { value: "25", label: "25 entries" },
              { value: "50", label: "50 entries" },
            ]}
          />
        </ConfigSection>
      </ModuleConfigPanel>
    );
  }
}
