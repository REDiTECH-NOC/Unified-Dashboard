"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Headphones,
  CircleDot,
  ChevronRight,
  Users,
  Crown,
  LogIn,
  LogOut,
  Clock,
  Hash,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface TabQueuesProps {
  instanceId: string;
}

type UserLookup = Record<string, { firstName: string; lastName: string }>;

export function TabQueues({ instanceId }: TabQueuesProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: queues, isLoading: queuesLoading } = trpc.threecx.getQueues.useQuery(
    { instanceId },
    { refetchInterval: 15000 }
  );

  const { data: ringGroups, isLoading: rgLoading } = trpc.threecx.getRingGroups.useQuery(
    { instanceId },
    { refetchInterval: 30000 }
  );

  // Fetch users to resolve extension numbers to names
  const { data: users } = trpc.threecx.getUsers.useQuery(
    { instanceId },
    { refetchInterval: 60000 }
  );

  // Build name lookup map: extension number → { firstName, lastName }
  const userLookup = useMemo<UserLookup>(() => {
    if (!users) return {};
    const map: UserLookup = {};
    for (const u of users) {
      map[u.number] = { firstName: u.firstName, lastName: u.lastName };
    }
    return map;
  }, [users]);

  const isLoading = queuesLoading || rgLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const hasQueues = queues && queues.length > 0;
  const hasRingGroups = ringGroups && ringGroups.length > 0;

  if (!hasQueues && !hasRingGroups) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Headphones className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No queues or ring groups configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Call Queues ─── */}
      {hasQueues && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <Headphones className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-foreground">Call Queues</span>
            <span className="text-xs text-muted-foreground">({queues!.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 font-medium">Number</th>
                  <th className="text-left px-4 py-2.5 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Strategy</th>
                  <th className="text-left px-4 py-2.5 font-medium">Agents</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ring Timeout</th>
                  <th className="text-left px-4 py-2.5 font-medium">Max Callers</th>
                  <th className="text-left px-4 py-2.5 font-medium">Max Wait</th>
                </tr>
              </thead>
              <tbody>
                {queues!.map((q) => {
                  const isExpanded = expandedId === q.id;
                  const loggedIn = q.agents.filter((a) => a.queueStatus === "LoggedIn").length;
                  return (
                    <QueueRow
                      key={q.id}
                      queue={q}
                      instanceId={instanceId}
                      loggedIn={loggedIn}
                      isExpanded={isExpanded}
                      userLookup={userLookup}
                      onToggle={() => setExpandedId(isExpanded ? null : q.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Ring Groups ─── */}
      {hasRingGroups && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <CircleDot className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-foreground">Ring Groups</span>
            <span className="text-xs text-muted-foreground">({ringGroups!.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 font-medium">Number</th>
                  <th className="text-left px-4 py-2.5 font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Strategy</th>
                  <th className="text-left px-4 py-2.5 font-medium">Members</th>
                  <th className="text-left px-4 py-2.5 font-medium">Ring Timeout</th>
                </tr>
              </thead>
              <tbody>
                {ringGroups!.map((rg) => {
                  const isExpanded = expandedId === -rg.id;
                  return (
                    <RingGroupRow
                      key={rg.id}
                      ringGroup={rg}
                      isExpanded={isExpanded}
                      userLookup={userLookup}
                      onToggle={() => setExpandedId(isExpanded ? null : -rg.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Name helper ─── */
function getName(number: string, lookup: UserLookup): string {
  const u = lookup[number];
  if (!u) return number;
  return `${u.firstName} ${u.lastName}`;
}

/* ─── Queue Row ─── */
type QueueData = {
  id: number;
  name: string;
  number: string;
  pollingStrategy: string;
  ringTimeout: number;
  maxCallersInQueue: number;
  maxCallerWaitTime: number;
  agents: { number: string; queueStatus?: string }[];
  managers: string[];
};

function QueueRow({
  queue,
  instanceId,
  loggedIn,
  isExpanded,
  userLookup,
  onToggle,
}: {
  queue: QueueData;
  instanceId: string;
  loggedIn: number;
  isExpanded: boolean;
  userLookup: UserLookup;
  onToggle: () => void;
}) {
  const utils = trpc.useUtils();

  const loginMutation = trpc.threecx.queueAgentLogin.useMutation({
    onSuccess: () => {
      utils.threecx.getQueues.invalidate({ instanceId });
    },
  });

  const logoutMutation = trpc.threecx.queueAgentLogout.useMutation({
    onSuccess: () => {
      utils.threecx.getQueues.invalidate({ instanceId });
    },
  });

  const handleToggleAgent = (agentNumber: string, currentStatus: string | undefined) => {
    const isLoggedIn = currentStatus === "LoggedIn";
    if (isLoggedIn) {
      logoutMutation.mutate({ instanceId, queueId: queue.id, extensionNumber: agentNumber });
    } else {
      loginMutation.mutate({ instanceId, queueId: queue.id, extensionNumber: agentNumber });
    }
  };

  const pendingExt = loginMutation.isPending
    ? (loginMutation.variables?.extensionNumber ?? null)
    : logoutMutation.isPending
      ? (logoutMutation.variables?.extensionNumber ?? null)
      : null;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
          isExpanded && "bg-accent/30"
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform mx-auto",
              isExpanded && "rotate-90"
            )}
          />
        </td>
        <td className="px-4 py-3 font-mono font-medium text-foreground">{queue.number}</td>
        <td className="px-4 py-3 text-foreground">{queue.name}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-medium">
            {formatStrategy(queue.pollingStrategy)}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("font-medium", loggedIn > 0 ? "text-green-500" : "text-red-400")}>{loggedIn}</span>
          <span className="text-muted-foreground">/{queue.agents.length}</span>
          <span className="text-muted-foreground ml-1 text-[10px]">logged in</span>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{queue.ringTimeout}s</td>
        <td className="px-4 py-3 text-muted-foreground">{queue.maxCallersInQueue}</td>
        <td className="px-4 py-3 text-muted-foreground">{queue.maxCallerWaitTime}s</td>
      </tr>

      {isExpanded && (
        <tr className="bg-accent/20">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Agents */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-foreground">
                    Agents ({queue.agents.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {queue.agents.map((agent) => {
                    const isLoggedIn = agent.queueStatus === "LoggedIn";
                    const isManager = queue.managers.includes(agent.number);
                    const isPending = pendingExt === agent.number;
                    const agentName = getName(agent.number, userLookup);

                    return (
                      <div
                        key={agent.number}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
                          isLoggedIn
                            ? "bg-green-500/5 border-green-500/20"
                            : "bg-card border-border"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            isLoggedIn ? "bg-green-500" : "bg-zinc-600"
                          )} />
                          <span className="text-xs text-foreground font-medium truncate">
                            {agentName}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0">{agent.number}</span>
                          {isManager && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px] shrink-0">
                              <Crown className="h-2.5 w-2.5" />
                              Manager
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            "text-[10px] font-medium",
                            isLoggedIn ? "text-green-500" : "text-zinc-500"
                          )}>
                            {isLoggedIn ? "Logged In" : "Logged Out"}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAgent(agent.number, agent.queueStatus);
                            }}
                            disabled={isPending}
                            className={cn(
                              "p-0.5 rounded transition-colors",
                              isLoggedIn
                                ? "text-green-500 hover:text-green-400 hover:bg-green-500/10"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-500/10",
                              isPending && "opacity-50"
                            )}
                            title={isLoggedIn ? "Log out of queue" : "Log in to queue"}
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isLoggedIn ? (
                              <ToggleRight className="h-5 w-5" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {queue.agents.length === 0 && (
                    <p className="text-[11px] text-muted-foreground px-3 py-2">No agents assigned</p>
                  )}
                </div>
              </div>

              {/* Queue Settings */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-foreground">Settings</span>
                </div>
                <div className="rounded-lg bg-card border border-border p-3 space-y-2">
                  <SettingRow label="Strategy" value={formatStrategy(queue.pollingStrategy)} />
                  <SettingRow label="Ring Timeout" value={`${queue.ringTimeout}s`} />
                  <SettingRow label="Max Callers" value={String(queue.maxCallersInQueue)} />
                  <SettingRow label="Max Wait Time" value={`${queue.maxCallerWaitTime}s`} />
                  {queue.managers.length > 0 && (
                    <SettingRow
                      label="Managers"
                      value={queue.managers.map((m) => getName(m, userLookup)).join(", ")}
                    />
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

/* ─── Ring Group Row ─── */
type RingGroupData = {
  id: number;
  name: string;
  number: string;
  ringStrategy: string;
  ringTimeout: number;
  members: string[];
};

function RingGroupRow({
  ringGroup,
  isExpanded,
  userLookup,
  onToggle,
}: {
  ringGroup: RingGroupData;
  isExpanded: boolean;
  userLookup: UserLookup;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50",
          isExpanded && "bg-accent/30"
        )}
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center">
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform mx-auto",
              isExpanded && "rotate-90"
            )}
          />
        </td>
        <td className="px-4 py-3 font-mono font-medium text-foreground">{ringGroup.number}</td>
        <td className="px-4 py-3 text-foreground">{ringGroup.name}</td>
        <td className="px-4 py-3">
          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-medium">
            {formatStrategy(ringGroup.ringStrategy)}
          </span>
        </td>
        <td className="px-4 py-3 text-foreground">{ringGroup.members.length}</td>
        <td className="px-4 py-3 text-muted-foreground">{ringGroup.ringTimeout}s</td>
      </tr>

      {isExpanded && (
        <tr className="bg-accent/20">
          <td colSpan={6} className="px-6 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-xs font-medium text-foreground">
                Members ({ringGroup.members.length})
              </span>
            </div>
            {ringGroup.members.length > 0 ? (
              <div className="space-y-1.5">
                {ringGroup.members.map((m) => {
                  const memberName = getName(m, userLookup);
                  return (
                    <div
                      key={m}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
                    >
                      <span className="text-xs text-foreground font-medium">{memberName}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{m}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No members assigned</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Helpers ─── */
function formatStrategy(raw: string): string {
  switch (raw) {
    case "RingAll": return "Ring All";
    case "LongestWaiting": return "Longest Waiting";
    case "LeastTalkTime": return "Least Talk Time";
    case "RoundRobin": return "Round Robin";
    case "FewestAnswered": return "Fewest Answered";
    case "Random": return "Random";
    case "Paging": return "Paging";
    case "Hunt": return "Hunt";
    default: return raw.replace(/([A-Z])/g, " $1").trim();
  }
}
