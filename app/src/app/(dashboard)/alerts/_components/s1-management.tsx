"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Shield,
  ShieldAlert,
  ShieldOff,
  Monitor,
  Wifi,
  WifiOff,
  ScanLine,
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  Plus,
  Trash2,
  AlertTriangle,
  Activity,
  Server,
  Laptop,
  HardDrive,
} from "lucide-react";
import { ConfirmationDialog } from "./confirmation-dialog";
import { EndpointDetailPanel } from "./endpoint-detail-panel";
import { CreateExclusionDialog } from "./create-exclusion-dialog";

/* ─── TAB TYPE ──────────────────────────────────────────── */

type S1Tab = "endpoints" | "exclusions" | "activity";

/* ─── HELPERS ──────────────────────────────────────────── */

const statusDot: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-zinc-500",
  warning: "bg-yellow-500",
  unknown: "bg-zinc-600",
};

const deviceIcon: Record<string, React.ElementType> = {
  server: Server,
  workstation: HardDrive,
  laptop: Laptop,
  other: Monitor,
};

/* ─── MAIN COMPONENT ──────────────────────────────────── */

export function S1ManagementView() {
  const { dateTime } = useTimezone();
  const [activeTab, setActiveTab] = useState<S1Tab>("endpoints");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showExclusionDialog, setShowExclusionDialog] = useState(false);
  const [deleteExclusionId, setDeleteExclusionId] = useState<string | null>(null);
  const [activityTimeRange, setActivityTimeRange] = useState("24h");

  const utils = trpc.useUtils();

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // ─── Data Queries ─────────────────────────────────────

  const agents = trpc.edr.getAgents.useQuery(
    {
      searchTerm: debouncedSearch || undefined,
      status: statusFilter || undefined,
      siteId: siteFilter || undefined,
      pageSize: 100,
    },
    { refetchInterval: 60000, retry: false }
  );

  const sites = trpc.edr.getSites.useQuery(undefined, {
    staleTime: 15 * 60_000,
    retry: false,
  });

  const exclusions = trpc.edr.getExclusions.useQuery(
    { siteId: siteFilter || undefined, pageSize: 100 },
    { refetchInterval: 300000, retry: false, enabled: activeTab === "exclusions" }
  );

  const activities = trpc.edr.getActivities.useQuery(
    {
      siteId: siteFilter || undefined,
      createdAfter: getTimeRangeDate(activityTimeRange),
      pageSize: 100,
    },
    { refetchInterval: 60000, retry: false, enabled: activeTab === "activity" }
  );

  // ─── Mutations ─────────────────────────────────────────

  const isolateDevice = trpc.edr.isolateDevice.useMutation({
    onSuccess: () => utils.edr.getAgents.invalidate(),
  });
  const unisolateDevice = trpc.edr.unisolateDevice.useMutation({
    onSuccess: () => utils.edr.getAgents.invalidate(),
  });
  const triggerScan = trpc.edr.triggerFullScan.useMutation({
    onSuccess: () => utils.edr.getAgents.invalidate(),
  });
  const deleteExclusion = trpc.edr.deleteExclusion.useMutation({
    onSuccess: () => utils.edr.getExclusions.invalidate(),
  });

  // ─── Agent Stats ───────────────────────────────────────

  const agentStats = useMemo(() => {
    if (!agents.data?.data) return null;
    const list = agents.data.data;
    let online = 0, offline = 0, warning = 0;
    for (const a of list) {
      if (a.status === "online") online++;
      else if (a.status === "warning") warning++;
      else offline++;
    }
    return {
      total: agents.data.totalCount ?? list.length,
      online,
      offline,
      warning,
    };
  }, [agents.data]);

  // ─── Isolate Confirmation State ───────────────────────

  const [confirmIsolate, setConfirmIsolate] = useState<{ agentId: string; hostname: string; isIsolated: boolean } | null>(null);

  // ─── Tabs ──────────────────────────────────────────────

  const TABS: { id: S1Tab; label: string; icon: React.ElementType }[] = [
    { id: "endpoints", label: "Endpoints", icon: Monitor },
    { id: "exclusions", label: "Exclusions", icon: ShieldOff },
    { id: "activity", label: "Activity Log", icon: Activity },
  ];

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-purple-500" />
              SentinelOne Management
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Endpoint security, exclusions, and activity monitoring
            </p>
          </div>
          <button
            onClick={() => {
              utils.edr.getAgents.invalidate();
              utils.edr.getExclusions.invalidate();
              utils.edr.getActivities.invalidate();
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent hover:bg-accent/80 text-xs font-medium text-foreground border border-border transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", agents.isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        {agentStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatMini label="Total Agents" value={agentStats.total} color="text-foreground" />
            <StatMini label="Online" value={agentStats.online} color="text-green-500" dot="bg-green-500" />
            <StatMini label="Offline" value={agentStats.offline} color="text-zinc-400" dot="bg-zinc-500" />
            <StatMini label="Warning" value={agentStats.warning} color="text-yellow-500" dot="bg-yellow-500" />
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-red-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Endpoints Tab ─── */}
        {activeTab === "endpoints" && (
          <div className="rounded-xl border border-border bg-card">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                  placeholder="Search endpoints..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
              >
                <option value="">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
              {sites.data && sites.data.length > 0 && (
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
                >
                  <option value="">All Sites</option>
                  {sites.data.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Agent List */}
            {agents.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : agents.isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">Failed to load endpoints</p>
                <p className="text-[10px] mt-1 text-red-400">{agents.error.message}</p>
              </div>
            ) : agents.data?.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Monitor className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">No endpoints found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {agents.data?.data?.map((agent) => {
                  const meta = agent.metadata as Record<string, unknown> | undefined;
                  const networkStatus = meta?.networkStatus as string | undefined;
                  const activeThreats = meta?.activeThreats as number | undefined;
                  const isDisconnected = networkStatus === "disconnected";
                  const DevIcon = deviceIcon[agent.deviceType ?? "other"] ?? Monitor;

                  return (
                    <div
                      key={agent.sourceId}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedAgentId(agent.sourceId)}
                    >
                      {/* Status dot */}
                      <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot[agent.status] ?? statusDot.unknown)} />

                      {/* Hostname + OS */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <DevIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{agent.hostname}</span>
                          {(activeThreats ?? 0) > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                              {activeThreats} threat{activeThreats !== 1 ? "s" : ""}
                            </span>
                          )}
                          {isDisconnected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              Isolated
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {agent.os && <span className="text-[10px] text-muted-foreground">{agent.os}</span>}
                          {agent.organizationName && <span className="text-[10px] text-muted-foreground">{agent.organizationName}</span>}
                          {agent.agentVersion && <span className="text-[10px] text-muted-foreground hidden lg:inline">v{agent.agentVersion}</span>}
                        </div>
                      </div>

                      {/* Last seen */}
                      {agent.lastSeen && (
                        <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0">
                          {dateTime(agent.lastSeen)}
                        </span>
                      )}

                      {/* Quick actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            setConfirmIsolate({
                              agentId: agent.sourceId,
                              hostname: agent.hostname,
                              isIsolated: isDisconnected,
                            })
                          }
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            isDisconnected
                              ? "hover:bg-green-500/10 text-green-400"
                              : "hover:bg-red-500/10 text-red-400"
                          )}
                          title={isDisconnected ? "Reconnect" : "Isolate"}
                        >
                          {isDisconnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => triggerScan.mutate({ agentId: agent.sourceId })}
                          disabled={triggerScan.isPending}
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                          title="Full Scan"
                        >
                          <ScanLine className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Exclusions Tab ─── */}
        {activeTab === "exclusions" && (
          <div className="rounded-xl border border-border bg-card">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Exclusions{exclusions.data?.data?.length ? ` (${exclusions.data.data.length})` : ""}
              </span>
              <button
                onClick={() => setShowExclusionDialog(true)}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-medium transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Exclusion
              </button>
            </div>

            {/* Exclusion List */}
            {exclusions.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : exclusions.data?.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShieldOff className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">No exclusions configured</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {exclusions.data?.data?.map((exc) => (
                  <div key={exc.id} className="flex items-center gap-3 px-4 py-3 group">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-foreground border border-border font-medium uppercase">
                      {exc.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-foreground truncate">{exc.value}</p>
                      {exc.description && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{exc.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setDeleteExclusionId(exc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Activity Tab ─── */}
        {activeTab === "activity" && (
          <div className="rounded-xl border border-border bg-card">
            {/* Time Range Filters */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Time range:</span>
              <div className="flex gap-1">
                {["1h", "6h", "24h", "3d", "7d"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setActivityTimeRange(range)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded-lg border transition-colors",
                      activityTimeRange === range
                        ? "border-red-500/50 bg-red-500/10 text-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
              {sites.data && sites.data.length > 0 && (
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="h-7 px-2 rounded-lg bg-accent border border-border text-[11px] text-foreground outline-none"
                >
                  <option value="">All Sites</option>
                  {sites.data.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Activity List */}
            {activities.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.data?.data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Activity className="h-8 w-8 opacity-30 mb-2" />
                <p className="text-xs">No activity in this time range</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {activities.data?.data?.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-36">
                      {dateTime(act.timestamp)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground border border-border shrink-0">
                      {act.type}
                    </span>
                    <p className="text-xs text-foreground/80 flex-1 min-w-0 truncate">
                      {act.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Endpoint Detail Panel */}
      {selectedAgentId && (
        <EndpointDetailPanel
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}

      {/* Create Exclusion Dialog */}
      {showExclusionDialog && (
        <CreateExclusionDialog
          open={showExclusionDialog}
          onClose={() => setShowExclusionDialog(false)}
        />
      )}

      {/* Delete Exclusion Confirmation */}
      {deleteExclusionId && (
        <ConfirmationDialog
          open={!!deleteExclusionId}
          onClose={() => setDeleteExclusionId(null)}
          onConfirm={async () => {
            await deleteExclusion.mutateAsync({ exclusionId: deleteExclusionId });
          }}
          title="Delete Exclusion"
          description="Are you sure you want to delete this exclusion? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
        />
      )}

      {/* Isolate/Reconnect Confirmation */}
      {confirmIsolate && (
        <ConfirmationDialog
          open={!!confirmIsolate}
          onClose={() => setConfirmIsolate(null)}
          onConfirm={async () => {
            if (confirmIsolate.isIsolated) {
              await unisolateDevice.mutateAsync({ agentId: confirmIsolate.agentId });
            } else {
              await isolateDevice.mutateAsync({ agentId: confirmIsolate.agentId });
            }
          }}
          title={confirmIsolate.isIsolated ? "Reconnect Device" : "Isolate Device"}
          description={
            confirmIsolate.isIsolated
              ? `Reconnect ${confirmIsolate.hostname} to the network. This will restore normal connectivity.`
              : `Disconnect ${confirmIsolate.hostname} from the network. The device will only maintain connectivity to the SentinelOne management console.`
          }
          confirmLabel={confirmIsolate.isIsolated ? "Reconnect" : "Isolate"}
          variant={confirmIsolate.isIsolated ? "warning" : "danger"}
        />
      )}
    </>
  );
}

/* ─── STAT MINI CARD ──────────────────────────────────── */

function StatMini({ label, value, color, dot }: { label: string; value: number; color: string; dot?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        {dot && <span className={cn("w-2 h-2 rounded-full", dot)} />}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
    </div>
  );
}

/* ─── TIME RANGE HELPER ───────────────────────────────── */

function getTimeRangeDate(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1h": return new Date(now.getTime() - 60 * 60 * 1000);
    case "6h": return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "3d": return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}
