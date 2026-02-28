"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Star, Building2, Ticket, AlertTriangle, ArrowUpRight, Search, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ModuleConfigPanel, ConfigSection, ConfigSelect } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

function ClientCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { data: tickets } = trpc.psa.getTickets.useQuery(
    { companyId: clientId, pageSize: 1 },
    { staleTime: 60_000, retry: 1 }
  );

  const ticketCount = tickets?.totalCount ?? tickets?.data?.length ?? null;

  return (
    <Link
      href={`/clients/${clientId}`}
      className="rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors block"
    >
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground truncate">{clientName}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <Ticket className="h-3 w-3 text-muted-foreground mx-auto" />
          <p className="text-xs font-bold text-foreground mt-0.5">
            {ticketCount !== null ? ticketCount : "—"}
          </p>
          <p className="text-[9px] text-muted-foreground">Tickets</p>
        </div>
        <div className="text-center">
          <AlertTriangle className="h-3 w-3 text-muted-foreground mx-auto" />
          <p className="text-xs font-bold text-muted-foreground mt-0.5">—</p>
          <p className="text-[9px] text-muted-foreground">Alerts</p>
        </div>
      </div>
    </Link>
  );
}

export function ClientQuickAccessModule({ config, onConfigChange, isConfigOpen, onConfigClose }: ModuleComponentProps) {
  const pinnedClients = (config.pinnedClients as { id: string; name: string }[]) || [];
  const columns = (config.columns as number) || 2;

  const [searchTerm, setSearchTerm] = useState("");

  // Only fetch companies when config is open and user is searching
  const { data: searchResults, isLoading: searching } = trpc.company.list.useQuery(
    { searchTerm, pageSize: 20 },
    { staleTime: 30_000, enabled: isConfigOpen && searchTerm.length >= 2 }
  );

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
            Click the gear icon to search and pin your favorite clients. Each card shows ticket count at a glance.
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
        {pinnedClients.map((client) => (
          <ClientCard key={client.id} clientId={client.id} clientName={client.name} />
        ))}
      </div>
      {renderConfig()}
    </>
  );

  function renderConfig() {
    const pinnedIds = new Set(pinnedClients.map((c) => c.id));

    return (
      <ModuleConfigPanel title="Client Quick Access Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Search and pin clients">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clients..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {searching && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {searchResults?.data && searchResults.data.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto mb-3">
              {searchResults.data.map((company) => {
                const isPinned = pinnedIds.has(company.id);
                return (
                  <button
                    key={company.id}
                    onClick={() => {
                      if (isPinned) {
                        onConfigChange({
                          ...config,
                          pinnedClients: pinnedClients.filter((c) => c.id !== company.id),
                        });
                      } else {
                        onConfigChange({
                          ...config,
                          pinnedClients: [...pinnedClients, { id: company.id, name: company.name }],
                        });
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                      isPinned ? "bg-red-500/10 text-red-400" : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <span className="truncate">{company.name}</span>
                    {isPinned ? (
                      <Star className="h-3 w-3 fill-current shrink-0" />
                    ) : (
                      <Star className="h-3 w-3 shrink-0 opacity-30" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {searchTerm.length >= 2 && !searching && searchResults?.data?.length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-2">No clients found</p>
          )}
        </ConfigSection>

        {pinnedClients.length > 0 && (
          <ConfigSection label="Pinned clients">
            <div className="space-y-1">
              {pinnedClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between px-2 py-1 rounded-lg bg-muted/20">
                  <span className="text-xs text-foreground truncate">{client.name}</span>
                  <button
                    onClick={() => {
                      onConfigChange({
                        ...config,
                        pinnedClients: pinnedClients.filter((c) => c.id !== client.id),
                      });
                    }}
                    className="text-muted-foreground hover:text-red-400 transition-colors shrink-0 ml-2"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </ConfigSection>
        )}

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
