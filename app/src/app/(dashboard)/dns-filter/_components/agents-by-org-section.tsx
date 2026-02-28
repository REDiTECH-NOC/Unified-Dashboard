"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Monitor,
  ShieldAlert,
  Ban,
  Activity,
  Loader2,
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Key,
  Copy,
  Check,
  Trash2,
  Shield,
  HelpCircle,
} from "lucide-react";
import { StatMini } from "./dns-sections";

interface AgentsByOrgProps {
  organizationIds?: string[];
}

/* ─── Copy Button (inline, same pattern as sites-section) ─ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-accent/50 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

/* ─── Cleanup Inactive Agents Button ───────────────────── */

function CleanupButton({ orgId }: { orgId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [cleanupId, setCleanupId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const dayOptions = [7, 30, 60, 90, 180, 365];

  const cleanupMutation = trpc.dnsFilter.cleanupInactiveAgents.useMutation({
    onSuccess: (data) => {
      setCleanupId(data.id);
      setIsOpen(false);
    },
  });

  const cleanupStatus = trpc.dnsFilter.getCleanupStatus.useQuery(
    { cleanupId: cleanupId! },
    {
      enabled: !!cleanupId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.completed) {
          return false;
        }
        return 2000;
      },
    }
  );

  // When cleanup completes, invalidate agent queries
  useEffect(() => {
    if (cleanupStatus.data?.completed) {
      utils.dnsFilter.getRoamingClients.invalidate();
      utils.dnsFilter.getAgentCounts.invalidate();
      // Clear cleanup tracking after a delay so the user sees the result
      const timer = setTimeout(() => setCleanupId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cleanupStatus.data?.completed, utils]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleCleanup(days: number) {
    cleanupMutation.mutate({
      organizationIds: [orgId],
      inactiveForDays: days,
    });
  }

  // Show progress if cleanup is active
  if (cleanupId && cleanupStatus.data) {
    const status = cleanupStatus.data;
    if (!status.completed) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            Cleaning up...
            {status.toDeleteCount > 0 &&
              ` (${status.toDeleteCount} agents to remove)`}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-green-400">
        <Check className="h-3 w-3" />
        <span>
          Cleanup complete
          {status.toDeleteCount > 0 &&
            ` — ${status.toDeleteCount} agents removed`}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={cleanupMutation.isPending}
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
      >
        {cleanupMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
        Clean Up Inactive Agents
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-lg border border-border bg-card shadow-lg py-1">
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
            Inactive for at least...
          </div>
          {dayOptions.map((days) => (
            <button
              key={days}
              onClick={(e) => {
                e.stopPropagation();
                handleCleanup(days);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-accent/50 transition-colors"
            >
              {days} days
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Policy Dropdown Selector (per agent) ─────────────── */

function PolicySelector({
  agentId,
  currentPolicyId,
  policies,
}: {
  agentId: string;
  currentPolicyId?: string;
  policies: Array<{ id: string; name: string }>;
}) {
  const utils = trpc.useUtils();

  const updateAgent = trpc.dnsFilter.updateUserAgent.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getRoamingClients.invalidate();
    },
  });

  const currentName =
    policies.find((p) => p.id === currentPolicyId)?.name ?? "—";

  return (
    <select
      value={currentPolicyId ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        const newPolicyId = val ? parseInt(val, 10) : null;
        updateAgent.mutate({ agentId, policyId: newPolicyId });
      }}
      disabled={updateAgent.isPending}
      className={cn(
        "h-6 px-1.5 rounded border border-border bg-accent text-[10px] text-foreground outline-none cursor-pointer",
        "focus:ring-1 focus:ring-violet-500/50 transition-colors",
        "max-w-[140px] truncate",
        updateAgent.isPending && "opacity-50"
      )}
      title={currentName}
    >
      <option value="">None</option>
      {policies.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/* ─── Agent Table (shared by site groups and unassigned) ── */

function AgentTable({
  agents,
  policies,
  isLoading,
  dateTime,
}: {
  agents: Array<{
    id: string;
    hostname: string;
    friendlyName?: string;
    agentType: string;
    agentVersion?: string;
    status: string;
    agentState: string;
    policyId?: string;
    scheduledPolicyId?: string;
    lastSync?: Date;
  }>;
  policies: Array<{ id: string; name: string }>;
  isLoading: boolean;
  dateTime: (d: string | Date) => string;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="px-4 py-4 text-center text-xs text-muted-foreground">
        No agents
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-t border-border bg-accent/50">
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Hostname
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Type
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Version
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              State
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Policy
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
              Last Sync
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {agents.map((agent) => (
            <tr
              key={agent.id}
              className="hover:bg-accent/30 transition-colors"
            >
              <td className="px-4 py-2">
                <p className="text-foreground text-xs">{agent.hostname}</p>
                {agent.friendlyName &&
                  agent.friendlyName !== agent.hostname && (
                    <p className="text-[10px] text-muted-foreground">
                      {agent.friendlyName}
                    </p>
                  )}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground capitalize">
                {agent.agentType}
              </td>
              <td className="px-4 py-2 text-xs text-muted-foreground">
                {agent.agentVersion ?? "\u2014"}
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border capitalize",
                    agent.status === "active"
                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                      : agent.status === "disabled"
                        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
                        : "text-red-400 bg-red-500/10 border-red-500/20"
                  )}
                >
                  {agent.status}
                </span>
              </td>
              <td className="px-4 py-2">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded border capitalize",
                    agent.agentState === "protected"
                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                      : agent.agentState === "unprotected"
                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                  )}
                >
                  {agent.agentState}
                </span>
              </td>
              <td className="px-4 py-2">
                <PolicySelector
                  agentId={agent.id}
                  currentPolicyId={agent.policyId}
                  policies={policies}
                />
              </td>
              <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                {agent.lastSync ? dateTime(agent.lastSync) : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Site (Network) Group within an Org ──────────────── */

function SiteAgentGroup({
  siteName,
  siteKey,
  agents,
  policies,
  isLoading,
  dateTime,
  defaultExpanded,
}: {
  siteName: string;
  siteKey?: string;
  agents: Array<{
    id: string;
    hostname: string;
    friendlyName?: string;
    agentType: string;
    agentVersion?: string;
    status: string;
    agentState: string;
    policyId?: string;
    scheduledPolicyId?: string;
    lastSync?: Date;
  }>;
  policies: Array<{ id: string; name: string }>;
  isLoading: boolean;
  dateTime: (d: string | Date) => string;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  return (
    <div className="ml-4 rounded-lg border border-border/60 bg-card/30 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/20 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <MapPin className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-medium text-foreground">
          Site: {siteName}
        </span>

        {/* Site Key */}
        {siteKey && (
          <span className="flex items-center gap-1 ml-2">
            <Key className="h-3 w-3 text-amber-400" />
            <code className="text-[10px] font-mono text-muted-foreground bg-accent/60 px-1.5 py-0.5 rounded border border-border/50">
              {siteKey.length > 12
                ? siteKey.substring(0, 12) + "..."
                : siteKey}
            </code>
            <CopyButton text={siteKey} />
          </span>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground">
          ({agents.length} {agents.length === 1 ? "agent" : "agents"})
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-border/50">
          <AgentTable
            agents={agents}
            policies={policies}
            isLoading={isLoading}
            dateTime={dateTime}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Per-Org Agents Expandable (with site grouping) ──── */

function OrgAgentsGroup({
  orgId,
  orgName,
  networks,
  policies,
  defaultExpanded,
}: {
  orgId: string;
  orgName: string;
  networks: Array<{
    id: string;
    name: string;
    secretKey?: string;
    organizationId?: string;
    policyId?: string;
    scheduledPolicyId?: string;
    blockPageId?: string;
  }>;
  policies: Array<{ id: string; name: string }>;
  defaultExpanded?: boolean;
}) {
  const { dateTime } = useTimezone();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const [page, setPage] = useState(1);

  const orgIds = useMemo(() => [orgId], [orgId]);

  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(
    { organizationIds: orgIds },
    { retry: false, staleTime: 5 * 60_000, enabled: isExpanded }
  );

  const agents = trpc.dnsFilter.getRoamingClients.useQuery(
    { organizationIds: orgIds, page, pageSize: 200 },
    { retry: false, staleTime: 5 * 60_000, enabled: isExpanded }
  );

  // Build a network lookup for this org
  const networkLookup = useMemo(() => {
    const map = new Map<
      string,
      { name: string; secretKey?: string }
    >();
    for (const net of networks) {
      map.set(net.id, { name: net.name, secretKey: net.secretKey });
    }
    return map;
  }, [networks]);

  // Group agents by networkId (site)
  const { siteGroups, unassigned } = useMemo(() => {
    const allAgents = agents.data?.data ?? [];
    const grouped = new Map<
      string,
      Array<(typeof allAgents)[number]>
    >();
    const noSite: Array<(typeof allAgents)[number]> = [];

    for (const agent of allAgents) {
      const netId = agent.networkId;
      if (netId && networkLookup.has(netId)) {
        if (!grouped.has(netId)) grouped.set(netId, []);
        grouped.get(netId)!.push(agent);
      } else {
        noSite.push(agent);
      }
    }

    // Sort sites by name
    const sorted = Array.from(grouped.entries()).sort((a, b) => {
      const nameA = networkLookup.get(a[0])?.name ?? "";
      const nameB = networkLookup.get(b[0])?.name ?? "";
      return nameA.localeCompare(nameB);
    });

    return { siteGroups: sorted, unassigned: noSite };
  }, [agents.data, networkLookup]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Building2 className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-foreground flex-1">
          {orgName}
        </span>
        {agentCounts.data && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-foreground font-medium">
              {agentCounts.data.all} agents
            </span>
            <span className="text-green-400">
              {agentCounts.data.protected} protected
            </span>
            <span className="text-red-400">
              {agentCounts.data.unprotected} unprotected
            </span>
            <span className="text-yellow-400">
              {agentCounts.data.offline} offline
            </span>
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Agent stats + cleanup */}
          <div className="p-4 space-y-3">
            {agentCounts.isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              agentCounts.data && (
                <div className="grid gap-3 sm:grid-cols-4">
                  <StatMini
                    label="Total"
                    value={agentCounts.data.all}
                    icon={Monitor}
                    iconColor="text-blue-500"
                  />
                  <StatMini
                    label="Protected"
                    value={agentCounts.data.protected}
                    icon={ShieldAlert}
                    iconColor="text-green-500"
                  />
                  <StatMini
                    label="Unprotected"
                    value={agentCounts.data.unprotected}
                    icon={Ban}
                    iconColor="text-red-500"
                  />
                  <StatMini
                    label="Offline"
                    value={agentCounts.data.offline}
                    icon={Activity}
                    iconColor="text-yellow-500"
                  />
                </div>
              )
            )}

            {/* Cleanup Button */}
            <div className="flex items-center justify-between">
              <CleanupButton orgId={orgId} />
              {networks.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {networks.length}{" "}
                  {networks.length === 1 ? "site" : "sites"}
                </span>
              )}
            </div>
          </div>

          {/* Site Groups */}
          {agents.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="px-4 pb-4 space-y-2">
              {siteGroups.map(([networkId, siteAgents]) => {
                const netInfo = networkLookup.get(networkId);
                return (
                  <SiteAgentGroup
                    key={networkId}
                    siteName={netInfo?.name ?? "Unknown Site"}
                    siteKey={netInfo?.secretKey}
                    agents={siteAgents}
                    policies={policies}
                    isLoading={false}
                    dateTime={dateTime}
                    defaultExpanded={siteGroups.length <= 3}
                  />
                );
              })}

              {/* Unassigned agents (no network match) */}
              {unassigned.length > 0 && (
                <SiteAgentGroup
                  siteName="Unassigned"
                  agents={unassigned}
                  policies={policies}
                  isLoading={false}
                  dateTime={dateTime}
                  defaultExpanded={siteGroups.length === 0}
                />
              )}

              {siteGroups.length === 0 && unassigned.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No agents found for this organization
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {(agents.data?.hasMore || page > 1) && (
            <div className="px-4 py-2 border-t border-border flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!agents.data?.hasMore}
                className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN AGENTS BY ORG SECTION ────────────────────────── */

export function AgentsByOrgSection({ organizationIds }: AgentsByOrgProps) {
  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const networks = trpc.dnsFilter.getNetworks.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(
    organizationIds ? { organizationIds } : undefined,
    { retry: false, staleTime: 5 * 60_000 }
  );

  // Build policy list for dropdowns
  const policyList = useMemo(
    () => (policies.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    [policies.data]
  );

  // Group networks by org
  const networksByOrg = useMemo(() => {
    const map = new Map<
      string,
      Array<NonNullable<typeof networks.data>[number]>
    >();
    for (const net of networks.data ?? []) {
      const orgId = net.organizationId ?? "unknown";
      if (!map.has(orgId)) map.set(orgId, []);
      map.get(orgId)!.push(net);
    }
    return map;
  }, [networks.data]);

  // Filter orgs if org selector is active
  const visibleOrgs = useMemo(() => {
    if (!organizations.data) return [];
    if (!organizationIds?.length)
      return [...organizations.data].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    return organizations.data
      .filter((o) => organizationIds.includes(o.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations.data, organizationIds]);

  if (organizations.isLoading || networks.isLoading || policies.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aggregate Stats */}
      {agentCounts.data && (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatMini
            label="Total Agents"
            value={agentCounts.data.all}
            icon={Monitor}
            iconColor="text-blue-500"
          />
          <StatMini
            label="Protected"
            value={agentCounts.data.protected}
            icon={ShieldAlert}
            iconColor="text-green-500"
          />
          <StatMini
            label="Unprotected"
            value={agentCounts.data.unprotected}
            icon={Ban}
            iconColor="text-red-500"
          />
          <StatMini
            label="Offline"
            value={agentCounts.data.offline}
            icon={Activity}
            iconColor="text-yellow-500"
          />
        </div>
      )}

      {/* Org Groups */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
          Organizations
        </h3>
        {visibleOrgs.map((org) => (
          <OrgAgentsGroup
            key={org.id}
            orgId={org.id}
            orgName={org.name}
            networks={networksByOrg.get(org.id) ?? []}
            policies={policyList}
            defaultExpanded={organizationIds?.includes(org.id)}
          />
        ))}
      </div>

      {visibleOrgs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No organizations found
        </div>
      )}
    </div>
  );
}
