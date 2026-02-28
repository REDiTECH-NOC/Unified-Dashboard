"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  Users,
  Building2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Shield,
  FileText,
  Search,
} from "lucide-react";

interface UsersSectionProps {
  organizationIds?: string[];
}

/* ─── Per-Org Users ──────────────────────────────────── */

function OrgUsersGroup({
  orgId,
  orgName,
  policies,
  scheduledPolicies,
  blockPages,
  defaultExpanded,
}: {
  orgId: string;
  orgName: string;
  policies: Array<{ id: string; name: string }>;
  scheduledPolicies: Array<{ id: string; name: string }>;
  blockPages: Array<{ id: string; name: string }>;
  defaultExpanded?: boolean;
}) {
  const { dateTime } = useTimezone();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  const orgIds = useMemo(() => [orgId], [orgId]);

  const agents = trpc.dnsFilter.getRoamingClients.useQuery(
    { organizationIds: orgIds, page, pageSize: 50 },
    { retry: false, staleTime: 5 * 60_000, enabled: isExpanded }
  );

  const updateAgent = trpc.dnsFilter.updateUserAgent.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getRoamingClients.invalidate();
    },
  });

  const filteredAgents = useMemo(() => {
    if (!agents.data?.data) return [];
    if (!search) return agents.data.data;
    const q = search.toLowerCase();
    return agents.data.data.filter(
      (a) =>
        a.hostname.toLowerCase().includes(q) ||
        a.friendlyName?.toLowerCase().includes(q)
    );
  }, [agents.data?.data, search]);

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
        {agents.data && (
          <span className="text-[10px] text-muted-foreground">
            {agents.data.data.length} users
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Search */}
          <div className="px-4 py-2 border-b border-border">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="h-7 w-full pl-8 pr-3 rounded-md bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-accent/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Policy/Schedule
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Block Page
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Last Sync
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-xs text-muted-foreground"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const policyName =
                      policies.find((p) => p.id === agent.policyId)?.name ??
                      "Inherit";
                    const scheduleName = scheduledPolicies.find(
                      (s) => s.id === agent.scheduledPolicyId
                    )?.name;

                    return (
                      <tr
                        key={agent.id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-4 py-2">
                          <p className="text-foreground text-xs">
                            {agent.hostname}
                          </p>
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
                          <select
                            value={agent.policyId ?? "inherit"}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateAgent.mutate({
                                agentId: agent.id,
                                policyId:
                                  val === "inherit"
                                    ? null
                                    : parseInt(val, 10),
                              });
                            }}
                            className="h-6 px-1.5 rounded bg-accent border border-border text-[10px] text-foreground outline-none cursor-pointer"
                          >
                            <option value="inherit">
                              Inherit from Roaming Client
                            </option>
                            {policies.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          {scheduleName && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {scheduleName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={agent.blockPageId ?? "inherit"}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateAgent.mutate({
                                agentId: agent.id,
                                blockPageId:
                                  val === "inherit"
                                    ? null
                                    : parseInt(val, 10),
                              });
                            }}
                            className="h-6 px-1.5 rounded bg-accent border border-border text-[10px] text-foreground outline-none cursor-pointer"
                          >
                            <option value="inherit">
                              Inherit from Roaming Client
                            </option>
                            {blockPages.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                          {agent.lastSync ? dateTime(agent.lastSync) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
              <span className="text-xs text-muted-foreground">Page {page}</span>
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

/* ─── MAIN USERS SECTION ─────────────────────────────── */

export function UsersSection({ organizationIds }: UsersSectionProps) {
  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });
  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });
  const scheduledPolicies = trpc.dnsFilter.getScheduledPolicies.useQuery(
    undefined,
    { retry: false, staleTime: 60 * 60_000 }
  );
  const blockPages = trpc.dnsFilter.getBlockPages.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const policyList = useMemo(
    () => (policies.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    [policies.data]
  );
  const scheduleList = useMemo(
    () =>
      (scheduledPolicies.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    [scheduledPolicies.data]
  );
  const blockPageList = useMemo(
    () => (blockPages.data ?? []).map((b) => ({ id: b.id, name: b.name })),
    [blockPages.data]
  );

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

  if (organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Users by Organization
        </h3>
      </div>

      <div className="space-y-2">
        {visibleOrgs.map((org) => (
          <OrgUsersGroup
            key={org.id}
            orgId={org.id}
            orgName={org.name}
            policies={policyList}
            scheduledPolicies={scheduleList}
            blockPages={blockPageList}
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
