"use client";

import { Suspense, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Lock, Plus, Copy, Check, UserCog, ShieldCheck, Pencil, Trash2,
  Users as UsersIcon, Search, ChevronDown, ChevronRight, Link2, Loader2,
  Info, X, BookOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ITGlueAccessTab } from "./_components/itglue-access-tab";

const roleColors: Record<string, string> = {
  ADMIN: "destructive",
  MANAGER: "warning",
  USER: "default",
  CLIENT: "secondary",
};

// Permission tree is now fetched from the server via permissionRole.getPermissionTree
// This eliminates the stale PERMISSION_MODULES duplicate and ensures the admin UI
// is always in sync with the server-side PERMISSIONS registry.

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground p-6">Loading...</p>}>
      <UsersContent />
    </Suspense>
  );
}

function UsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "roles" ? "roles" : tabParam === "group-sync" ? "group-sync" : tabParam === "itglue" ? "itglue" : "users";
  const utils = trpc.useUtils();

  // ── Users tab state ──
  const { data: users, isLoading: usersLoading } = trpc.user.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<"ADMIN" | "MANAGER" | "USER" | "CLIENT">("USER");
  const [createdResult, setCreatedResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createUser = trpc.user.create.useMutation({
    onSuccess: (result) => {
      setCreatedResult({ email: result.user.email, tempPassword: result.tempPassword });
      utils.user.list.invalidate();
    },
  });

  function openCreate() {
    setUserName("");
    setUserEmail("");
    setUserRole("USER");
    setCreatedResult(null);
    setCopied(false);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
    setCreatedResult(null);
    setCopied(false);
  }

  function handleCreate() {
    createUser.mutate({ name: userName, email: userEmail, role: userRole });
  }

  async function copyCredentials() {
    if (!createdResult) return;
    await navigator.clipboard.writeText(
      `Email: ${createdResult.email}\nTemporary Password: ${createdResult.tempPassword}\n\nPlease sign in and set up MFA immediately.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Roles tab state ──
  const { data: permRoles, isLoading: rolesLoading } = trpc.permissionRole.list.useQuery();
  const { data: permTree } = trpc.permissionRole.getPermissionTree.useQuery(undefined, {
    staleTime: 10 * 60_000,
  });
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{
    id: string;
    name: string;
    description: string;
    permissions: string[];
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [permSearch, setPermSearch] = useState("");
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());

  // Filter permission tree by search
  const filteredTree = useMemo(() => {
    if (!permTree) return [];
    if (!permSearch.trim()) return permTree;
    const q = permSearch.toLowerCase();
    return permTree
      .map((node) => ({
        ...node,
        subModules: node.subModules.map((sm) => ({
          ...sm,
          permissions: sm.permissions.filter(
            (p) =>
              p.key.toLowerCase().includes(q) ||
              p.label.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              (p.subModule && p.subModule.toLowerCase().includes(q)) ||
              node.module.toLowerCase().includes(q)
          ),
        })).filter((sm) => sm.permissions.length > 0),
      }))
      .filter((node) => node.subModules.length > 0);
  }, [permTree, permSearch]);

  function toggleModuleCollapse(module: string) {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      next.has(module) ? next.delete(module) : next.add(module);
      return next;
    });
  }

  const createRole = trpc.permissionRole.create.useMutation({
    onSuccess: () => { utils.permissionRole.list.invalidate(); closeRoleDialog(); },
  });
  const updateRole = trpc.permissionRole.update.useMutation({
    onSuccess: () => { utils.permissionRole.list.invalidate(); closeRoleDialog(); },
  });
  const deleteRole = trpc.permissionRole.delete.useMutation({
    onSuccess: () => { utils.permissionRole.list.invalidate(); setDeleteConfirm(null); },
  });

  function openCreateRole() {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms(new Set());
    setRoleDialogOpen(true);
  }

  function openEditRole(role: { id: string; name: string; description: string | null; permissions: string[] }) {
    setEditingRole({ id: role.id, name: role.name, description: role.description || "", permissions: role.permissions });
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    setSelectedPerms(new Set(role.permissions));
    setRoleDialogOpen(true);
  }

  function closeRoleDialog() {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setSelectedPerms(new Set());
    setPermSearch("");
    setCollapsedModules(new Set());
  }

  function togglePerm(key: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleModule(keys: string[]) {
    const allSelected = keys.every((k) => selectedPerms.has(k));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        allSelected ? next.delete(k) : next.add(k);
      }
      return next;
    });
  }

  function handleSaveRole() {
    const permissions = Array.from(selectedPerms);
    if (editingRole) {
      updateRole.mutate({ id: editingRole.id, name: roleName, description: roleDesc, permissions });
    } else {
      createRole.mutate({ name: roleName, description: roleDesc, permissions });
    }
  }

  const isRoleSaving = createRole.isPending || updateRole.isPending;

  function setTab(tab: "users" | "roles" | "group-sync" | "itglue") {
    router.push(`/settings/users${tab !== "users" ? `?tab=${tab}` : ""}`);
  }

  // ── Group Sync tab state ──
  const { data: groupMappings, isLoading: mappingsLoading } = trpc.permissionRole.listGroupMappings.useQuery();
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSearchDebounced, setGroupSearchDebounced] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<{ id: string; displayName: string } | null>(null);
  const [selectedMappingRole, setSelectedMappingRole] = useState("");
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  // Debounce search input
  const handleGroupSearchChange = (val: string) => {
    setGroupSearch(val);
    // Simple debounce using setTimeout
    clearTimeout((window as any).__groupSearchTimer);
    (window as any).__groupSearchTimer = setTimeout(() => setGroupSearchDebounced(val), 300);
  };

  const { data: entraGroups, isLoading: groupsSearching, error: groupsError } = trpc.permissionRole.searchEntraGroups.useQuery(
    { search: groupSearchDebounced || undefined },
    { enabled: groupDropdownOpen, staleTime: 30_000, retry: false }
  );

  const createMapping = trpc.permissionRole.createGroupMapping.useMutation({
    onSuccess: () => {
      utils.permissionRole.listGroupMappings.invalidate();
      setSelectedGroup(null);
      setSelectedMappingRole("");
      setGroupSearch("");
    },
  });
  const deleteMapping = trpc.permissionRole.deleteGroupMapping.useMutation({
    onSuccess: () => utils.permissionRole.listGroupMappings.invalidate(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, permissions, and feature flags.
          </p>
        </div>
        {activeTab === "users" && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        )}
        {activeTab === "roles" && (
          <Button onClick={openCreateRole} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Role
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("users")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "users"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <UserCog className="h-4 w-4" />
          Users
          {users && (
            <Badge variant="secondary" className="text-[10px] ml-1">{users.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setTab("roles")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "roles"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          Permission Roles
          {permRoles && (
            <Badge variant="secondary" className="text-[10px] ml-1">{permRoles.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setTab("group-sync")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "group-sync"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Link2 className="h-4 w-4" />
          Group Sync
          {groupMappings && groupMappings.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">{groupMappings.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setTab("itglue")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "itglue"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-4 w-4" />
          IT Glue Access
        </button>
      </div>

      {/* ═══ Users Tab Content ═══ */}
      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Users</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : users && users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => {
                  const initials = user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() || "?";
                  const permOverrides = user.permissions?.length || 0;
                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-md border border-border p-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/settings/users/${user.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {user.avatar && <AvatarImage src={user.avatar} />}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{user.name || user.email}</p>
                            {user.totpEnabled && (
                              <Lock className="h-3 w-3 text-emerald-400" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={roleColors[user.role] as any}>{user.role}</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {user.authMethod}
                        </Badge>
                        {permOverrides > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {permOverrides} override{permOverrides !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/settings/users/${user.id}`);
                          }}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No users yet. Users are created automatically when they sign in for the first time.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Roles Tab Content ═══ */}
      {activeTab === "roles" && (
        <>
          {rolesLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading roles...</p>
          ) : permRoles && permRoles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {permRoles.map((role) => (
                <Card key={role.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">{role.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditRole(role)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteConfirm(role.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                      </div>
                      <div className="flex items-center gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {role._count.users} user{role._count.users !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(() => {
                        // Group permissions by module prefix for a cleaner display
                        const moduleMap = new Map<string, number>();
                        for (const p of role.permissions) {
                          const mod = p.split(".")[0];
                          const label = mod.charAt(0).toUpperCase() + mod.slice(1);
                          moduleMap.set(label, (moduleMap.get(label) || 0) + 1);
                        }
                        const entries = Array.from(moduleMap.entries()).slice(0, 6);
                        const remaining = moduleMap.size - entries.length;
                        return (
                          <>
                            {entries.map(([mod, count]) => (
                              <Badge key={mod} variant="secondary" className="text-[10px]">
                                {mod}: {count}
                              </Badge>
                            ))}
                            {remaining > 0 && (
                              <Badge variant="outline" className="text-[10px]">+{remaining} more</Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ShieldCheck className="mb-3 h-8 w-8 opacity-50" />
                <p className="text-sm">No permission roles created yet</p>
                <p className="text-xs">Create a role to bundle permissions together for easy assignment</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══ Group Sync Tab Content ═══ */}
      {activeTab === "group-sync" && (
        <div className="space-y-6">
          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-blue-300">How Group Sync works</p>
              <p className="text-muted-foreground">
                Map Entra ID (Microsoft 365) groups to permission roles. On every login,
                a user&apos;s permission roles are <strong>fully synced</strong> to match
                their group memberships &mdash; roles are added and removed automatically.
              </p>
              <p className="text-muted-foreground">
                Per-user permission overrides (set on individual user pages) are
                <strong> never changed</strong> by group sync &mdash; those are sacred manual decisions.
              </p>
            </div>
          </div>

          {/* Add Mapping form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link Group to Role</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Entra Group selector */}
                <div className="flex-1 relative">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Entra ID Group
                  </label>
                  {selectedGroup ? (
                    <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/30">
                      <span className="text-sm flex-1 truncate">{selectedGroup.displayName}</span>
                      <button
                        onClick={() => { setSelectedGroup(null); setGroupSearch(""); }}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background">
                        <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <input
                          type="text"
                          placeholder="Search 365 groups..."
                          value={groupSearch}
                          onChange={(e) => handleGroupSearchChange(e.target.value)}
                          onFocus={() => setGroupDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 200)}
                          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        {groupsSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      </div>

                      {/* Dropdown results */}
                      {groupDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                          {groupsError ? (
                            <div className="px-3 py-4 text-xs text-red-400 space-y-1">
                              <p className="font-medium">Failed to load groups</p>
                              <p className="text-red-400/70">{groupsError.message}</p>
                            </div>
                          ) : !entraGroups && groupsSearching ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading groups...
                            </div>
                          ) : entraGroups && entraGroups.length > 0 ? (
                            entraGroups.map((g: { id: string; displayName: string; description: string | null; isSecurityGroup: boolean }) => (
                              <button
                                key={g.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSelectedGroup({ id: g.id, displayName: g.displayName });
                                  setGroupDropdownOpen(false);
                                  setGroupSearch("");
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                              >
                                <p className="text-sm font-medium truncate">{g.displayName}</p>
                                {g.description && (
                                  <p className="text-[10px] text-muted-foreground truncate">{g.description}</p>
                                )}
                                {g.isSecurityGroup && (
                                  <Badge variant="secondary" className="text-[9px] mt-1">Security Group</Badge>
                                )}
                              </button>
                            ))
                          ) : entraGroups && entraGroups.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">
                              {groupSearchDebounced ? "No groups match your search" : "No groups found"}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Permission Role selector */}
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Permission Role
                  </label>
                  <select
                    value={selectedMappingRole}
                    onChange={(e) => setSelectedMappingRole(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                  >
                    <option value="">Select a role...</option>
                    {permRoles?.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Link button */}
                <div className="flex items-end">
                  <Button
                    onClick={() => {
                      if (selectedGroup && selectedMappingRole) {
                        createMapping.mutate({
                          entraGroupId: selectedGroup.id,
                          entraGroupName: selectedGroup.displayName,
                          permissionRoleId: selectedMappingRole,
                        });
                      }
                    }}
                    disabled={!selectedGroup || !selectedMappingRole || createMapping.isPending}
                    className="gap-1.5"
                  >
                    {createMapping.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Link
                  </Button>
                </div>
              </div>
              {createMapping.error && (
                <p className="text-sm text-red-400 mt-2">{createMapping.error.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Current Mappings table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading mappings...
                </div>
              ) : groupMappings && groupMappings.length > 0 ? (
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Entra Group</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Permission Role</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Created</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMappings.map((m) => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium">{m.entraGroupName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{m.entraGroupId}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{m.permissionRole.name}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                              onClick={() => deleteMapping.mutate({ id: m.id })}
                              disabled={deleteMapping.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Link2 className="mb-3 h-8 w-8 opacity-50" />
                  <p className="text-sm">No group mappings configured</p>
                  <p className="text-xs">Roles are assigned manually until you link a group above.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ IT Glue Access Tab Content ═══ */}
      {activeTab === "itglue" && <ITGlueAccessTab />}

      {/* ═══ Create User Dialog ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={closeCreate} className="max-w-md">
          {!createdResult ? (
            <>
              <DialogHeader>
                <DialogTitle>Create Local User</DialogTitle>
                <DialogDescription>
                  Create a new local user account. A temporary password will be generated.
                  The user will be required to set up MFA on first login.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
                  <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Address</label>
                  <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="john@company.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                  <div className="flex gap-2">
                    {(["ADMIN", "MANAGER", "USER", "CLIENT"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setUserRole(r)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          userRole === r
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {createUser.error && (
                <p className="text-sm text-red-400">{createUser.error.message}</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={closeCreate} disabled={createUser.isPending}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!userName.trim() || !userEmail.trim() || createUser.isPending}>
                  {createUser.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>User Created Successfully</DialogTitle>
                <DialogDescription>
                  Share these credentials securely with the user. The temporary password is shown only once.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-md border border-border bg-muted/50 p-4 space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Email</p>
                  <p className="text-sm font-mono">{createdResult.email}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">Temporary Password</p>
                  <p className="text-sm font-mono text-amber-400">{createdResult.tempPassword}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  The user will be required to set up MFA (authenticator app) on first login.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={copyCredentials} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy Credentials"}
                </Button>
                <Button onClick={closeCreate}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Create / Edit Role Dialog ═══ */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent onClose={closeRoleDialog} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Permission Role" : "Create Permission Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update this role's name, description, or permissions."
                : "Define a named role with a set of permissions. You can assign this role to multiple users."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Role Name</label>
                <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Senior Tech" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="e.g. Full access to KB and audit logs" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Permissions ({selectedPerms.size} selected)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCollapsedModules(new Set())}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Expand All
                  </button>
                  <span className="text-[10px] text-muted-foreground/40">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (filteredTree) setCollapsedModules(new Set(filteredTree.map((n) => n.module)));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent mb-3">
                <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search permissions..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
                {permSearch && (
                  <button onClick={() => setPermSearch("")} className="text-muted-foreground hover:text-foreground text-xs">
                    Clear
                  </button>
                )}
              </div>

              {/* Permission tree */}
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {filteredTree?.map((node) => {
                  const allKeys = node.subModules.flatMap((sm) => sm.permissions.map((p) => p.key));
                  const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedPerms.has(k));
                  const someSelected = allKeys.some((k) => selectedPerms.has(k));
                  const isCollapsed = collapsedModules.has(node.module) && !permSearch.trim();

                  return (
                    <div key={node.module} className="rounded-md border border-border/50">
                      {/* Module header */}
                      <div className="flex items-center gap-2 p-2.5">
                        <button
                          type="button"
                          onClick={() => toggleModuleCollapse(node.module)}
                          className="flex-shrink-0"
                        >
                          {isCollapsed
                            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleModule(allKeys)}
                          className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                              allSelected
                                ? "bg-primary border-primary"
                                : someSelected
                                ? "bg-primary/30 border-primary"
                                : "border-muted-foreground/50"
                            )}
                          >
                            {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            {someSelected && !allSelected && (
                              <div className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />
                            )}
                          </div>
                          {node.module}
                        </button>
                        <Badge variant="secondary" className="text-[9px] ml-auto">
                          {allKeys.filter((k) => selectedPerms.has(k)).length}/{allKeys.length}
                        </Badge>
                      </div>

                      {/* Expanded content */}
                      {!isCollapsed && (
                        <div className="px-2.5 pb-2.5">
                          {node.subModules.map((sm) => (
                            <div key={sm.name ?? "_root"}>
                              {/* Sub-module header (if named) */}
                              {sm.name && (
                                <div className="flex items-center gap-2 ml-6 mt-2 mb-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleModule(sm.permissions.map((p) => p.key))}
                                    className="flex items-center gap-2"
                                  >
                                    {(() => {
                                      const smKeys = sm.permissions.map((p) => p.key);
                                      const smAll = smKeys.every((k) => selectedPerms.has(k));
                                      const smSome = smKeys.some((k) => selectedPerms.has(k));
                                      return (
                                        <div
                                          className={cn(
                                            "h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors",
                                            smAll
                                              ? "bg-primary border-primary"
                                              : smSome
                                              ? "bg-primary/30 border-primary"
                                              : "border-muted-foreground/50"
                                          )}
                                        >
                                          {smAll && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                          {smSome && !smAll && (
                                            <div className="h-1 w-1 rounded-sm bg-primary-foreground" />
                                          )}
                                        </div>
                                      );
                                    })()}
                                    <span className="text-xs font-medium text-muted-foreground">{sm.name}</span>
                                  </button>
                                </div>
                              )}

                              {/* Permission rows */}
                              <div className={cn("grid gap-0.5", sm.name ? "ml-10" : "ml-6")}>
                                {sm.permissions.map((perm) => (
                                  <button
                                    key={perm.key}
                                    type="button"
                                    onClick={() => togglePerm(perm.key)}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/30 transition-colors"
                                  >
                                    <div
                                      className={cn(
                                        "h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                                        selectedPerms.has(perm.key)
                                          ? "bg-primary border-primary"
                                          : "border-muted-foreground/50"
                                      )}
                                    >
                                      {selectedPerms.has(perm.key) && (
                                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium">{perm.label}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{perm.description}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredTree?.length === 0 && permSearch && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No permissions match &ldquo;{permSearch}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRoleDialog} disabled={isRoleSaving}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={!roleName.trim() || selectedPerms.size === 0 || isRoleSaving}>
              {isRoleSaving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Role Confirmation ═══ */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Permission Role</DialogTitle>
            <DialogDescription>
              This will permanently remove this role and unassign it from all users.
              Their permissions will revert to base role defaults (unless they have other
              permission roles or per-user overrides).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteRole.mutate({ id: deleteConfirm })}
              disabled={deleteRole.isPending}
            >
              {deleteRole.isPending ? "Deleting..." : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
