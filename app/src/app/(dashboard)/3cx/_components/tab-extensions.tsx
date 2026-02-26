"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  Voicemail,
  Users,
  ChevronRight,
  Headphones,
  CircleDot,
  FolderOpen,
  LogIn,
  LogOut,
  Crown,
} from "lucide-react";

interface TabExtensionsProps {
  instanceId: string;
}

export function TabExtensions({ instanceId }: TabExtensionsProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "registered" | "unregistered">("all");
  const [expandedExt, setExpandedExt] = useState<string | null>(null);

  const { data: extensions, isLoading } = trpc.threecx.getUsersWithMembership.useQuery(
    { instanceId },
    { refetchInterval: 30000 }
  );

  const filtered = useMemo(() => {
    if (!extensions) return [];
    let list = extensions;

    if (filter === "registered") list = list.filter((e) => e.isRegistered);
    if (filter === "unregistered") list = list.filter((e) => !e.isRegistered);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.number.includes(q) ||
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.queues.some((qq) => qq.name.toLowerCase().includes(q)) ||
          e.ringGroups.some((rg) => rg.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [extensions, filter, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!extensions) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load extensions. The PBX may be offline.
      </div>
    );
  }

  const registered = extensions.filter((e) => e.isRegistered).length;
  const withQueues = extensions.filter((e) => e.queues.length > 0).length;
  const withRingGroups = extensions.filter((e) => e.ringGroups.length > 0).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header / Filters */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            placeholder="Search name, number, email, queue, ring group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5 border border-border">
          {(["all", "registered", "unregistered"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                filter === s
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {registered}/{extensions.length} registered
          </span>
          {withQueues > 0 && (
            <span className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" />
              {withQueues} in queues
            </span>
          )}
          {withRingGroups > 0 && (
            <span className="flex items-center gap-1.5">
              <CircleDot className="h-3.5 w-3.5" />
              {withRingGroups} in ring groups
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-8 w-8 mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {extensions.length === 0 ? "No extensions configured" : "No matching extensions"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="w-8 px-2 py-2.5"></th>
                <th className="text-left px-4 py-2.5 font-medium">Ext</th>
                <th className="text-left px-4 py-2.5 font-medium">Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Email</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Profile</th>
                <th className="text-left px-4 py-2.5 font-medium">Membership</th>
                <th className="text-center px-4 py-2.5 font-medium">VM</th>
                <th className="text-center px-4 py-2.5 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ext) => {
                const isExpanded = expandedExt === ext.number;
                const hasMembership = ext.queues.length > 0 || ext.ringGroups.length > 0 || ext.groups.length > 0;

                return (
                  <ExtensionRow
                    key={ext.number}
                    ext={ext}
                    isExpanded={isExpanded}
                    hasMembership={hasMembership}
                    onToggle={() => setExpandedExt(isExpanded ? null : ext.number)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Extension Row ─── */
type ExtensionWithMembership = {
  number: string;
  firstName: string;
  lastName: string;
  email?: string;
  isRegistered: boolean;
  currentProfile?: string;
  queueStatus?: string;
  vmEnabled: boolean;
  enabled: boolean;
  queues: { id: number; name: string; number: string; isManager: boolean; queueStatus?: string }[];
  ringGroups: { id: number; name: string; number: string }[];
  groups: { id: number; name: string }[];
};

function ExtensionRow({
  ext,
  isExpanded,
  hasMembership,
  onToggle,
}: {
  ext: ExtensionWithMembership;
  isExpanded: boolean;
  hasMembership: boolean;
  onToggle: () => void;
}) {
  const membershipCount = ext.queues.length + ext.ringGroups.length + ext.groups.length;

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/50 transition-colors",
          hasMembership ? "cursor-pointer hover:bg-accent/50" : "hover:bg-accent/30",
          isExpanded && "bg-accent/30"
        )}
        onClick={hasMembership ? onToggle : undefined}
      >
        <td className="px-2 py-3 text-center">
          {hasMembership && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform mx-auto",
                isExpanded && "rotate-90"
              )}
            />
          )}
        </td>
        <td className="px-4 py-3 font-mono font-medium text-foreground">{ext.number}</td>
        <td className="px-4 py-3 text-foreground">
          {ext.firstName} {ext.lastName}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{ext.email || "—"}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", ext.isRegistered ? "bg-green-500" : "bg-zinc-500")} />
            <span className={ext.isRegistered ? "text-green-500" : "text-muted-foreground"}>
              {ext.isRegistered ? "Registered" : "Offline"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{ext.currentProfile || "—"}</td>
        <td className="px-4 py-3">
          {membershipCount > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {ext.queues.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px]">
                  <Headphones className="h-2.5 w-2.5" />
                  {ext.queues.length} queue{ext.queues.length !== 1 ? "s" : ""}
                </span>
              )}
              {ext.ringGroups.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px]">
                  <CircleDot className="h-2.5 w-2.5" />
                  {ext.ringGroups.length} RG{ext.ringGroups.length !== 1 ? "s" : ""}
                </span>
              )}
              {ext.groups.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 text-[10px]">
                  <FolderOpen className="h-2.5 w-2.5" />
                  {ext.groups.length} dept{ext.groups.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {ext.vmEnabled ? (
            <Voicemail className="h-3.5 w-3.5 text-blue-500 mx-auto" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {ext.enabled ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />
          )}
        </td>
      </tr>

      {/* Expanded membership details */}
      {isExpanded && hasMembership && (
        <tr className="bg-accent/20">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Queues */}
              {ext.queues.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Headphones className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-foreground">Queues</span>
                  </div>
                  <div className="space-y-1.5">
                    {ext.queues.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{q.number}</span>
                          <span className="text-xs text-foreground">{q.name}</span>
                          {q.isManager && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 text-[10px]">
                              <Crown className="h-2.5 w-2.5" />
                              Manager
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {q.queueStatus === "LoggedIn" ? (
                            <span className="flex items-center gap-1 text-green-500 text-[10px]">
                              <LogIn className="h-2.5 w-2.5" />
                              Logged In
                            </span>
                          ) : q.queueStatus === "LoggedOut" ? (
                            <span className="flex items-center gap-1 text-zinc-500 text-[10px]">
                              <LogOut className="h-2.5 w-2.5" />
                              Logged Out
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">{q.queueStatus || "—"}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ring Groups */}
              {ext.ringGroups.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CircleDot className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-xs font-medium text-foreground">Ring Groups</span>
                  </div>
                  <div className="space-y-1.5">
                    {ext.ringGroups.map((rg) => (
                      <div
                        key={rg.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
                      >
                        <span className="font-mono text-[11px] text-muted-foreground">{rg.number}</span>
                        <span className="text-xs text-foreground">{rg.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departments */}
              {ext.groups.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FolderOpen className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-xs font-medium text-foreground">Departments</span>
                  </div>
                  <div className="space-y-1.5">
                    {ext.groups.map((g) => (
                      <div
                        key={g.id}
                        className="px-3 py-2 rounded-lg bg-card border border-border"
                      >
                        <span className="text-xs text-foreground">{g.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
