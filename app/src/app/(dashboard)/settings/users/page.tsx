"use client";

import { useState } from "react";
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
  Users as UsersIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const roleColors: Record<string, string> = {
  ADMIN: "destructive",
  MANAGER: "warning",
  USER: "default",
  CLIENT: "secondary",
};

// Permission modules for the Roles tab
const PERMISSION_MODULES: Record<string, { key: string; label: string; description: string }[]> = {
  Dashboard: [
    { key: "dashboard.view", label: "View Dashboard", description: "Access the main dashboard" },
  ],
  Tickets: [
    { key: "tickets.view", label: "View Tickets", description: "View ticket lists and details" },
    { key: "tickets.create", label: "Create Tickets", description: "Create new tickets via UI or AI" },
    { key: "tickets.edit", label: "Edit Tickets", description: "Update ticket status, notes, assignments" },
  ],
  Alerts: [
    { key: "alerts.view", label: "View Alerts", description: "View alert feed and details" },
    { key: "alerts.manage", label: "Manage Alerts", description: "Acknowledge, escalate, dismiss alerts" },
  ],
  Clients: [
    { key: "clients.view", label: "View Clients", description: "View client list and details" },
  ],
  AI: [
    { key: "ai.chat", label: "Use AI Chat", description: "Access the AI operations assistant" },
    { key: "ai.kb.read", label: "Read Knowledge Base", description: "Query the knowledge base via AI" },
    { key: "ai.kb.write", label: "Write to Knowledge Base", description: "Add/update knowledge base articles via AI" },
    { key: "ai.passwords", label: "Access Passwords", description: "Retrieve passwords and TOTP codes via AI" },
    { key: "ai.tickets", label: "AI Ticket Operations", description: "Create/update tickets via AI agent" },
  ],
  Audit: [
    { key: "audit.view", label: "View Audit Logs", description: "Access the full audit log" },
    { key: "audit.export", label: "Export Audit Logs", description: "Export audit data to CSV/PDF" },
  ],
  Users: [
    { key: "users.view", label: "View Users", description: "View user list and profiles" },
    { key: "users.manage", label: "Manage Users", description: "Edit roles, permissions, feature flags" },
    { key: "users.create", label: "Create Users", description: "Create local user accounts and send invites" },
  ],
  Settings: [
    { key: "settings.view", label: "View Settings", description: "Access the settings pages" },
    { key: "settings.integrations", label: "Manage Integrations", description: "Configure API credentials and connections" },
    { key: "settings.branding", label: "Manage Branding", description: "Change logo and company name" },
    { key: "settings.ai", label: "Manage AI Settings", description: "Configure models, budgets, rate limits" },
  ],
  Phone: [
    { key: "phone.view", label: "View Phone Dashboard", description: "View 3CX call logs and PBX status" },
    { key: "phone.manage", label: "Manage Phone Settings", description: "Configure 3CX instances and webhooks" },
  ],
  Reports: [
    { key: "reports.view", label: "View Reports", description: "Access dashboards and QBR reports" },
    { key: "reports.export", label: "Export Reports", description: "Export reports to PDF/CSV" },
  ],
};

export default function UsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "roles" ? "roles" : "users";
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
  }

  function togglePerm(key: string) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleModule(modulePerms: { key: string }[]) {
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.key));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      for (const p of modulePerms) {
        allSelected ? next.delete(p.key) : next.add(p.key);
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

  function setTab(tab: "users" | "roles") {
    router.push(`/settings/users${tab === "roles" ? "?tab=roles" : ""}`);
  }

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
        {activeTab === "users" ? (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        ) : (
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
                      {role.permissions.slice(0, 6).map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-[10px]">{perm}</Badge>
                      ))}
                      {role.permissions.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">+{role.permissions.length - 6} more</Badge>
                      )}
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
        <DialogContent onClose={closeRoleDialog} className="max-w-2xl">
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
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Permissions ({selectedPerms.size} selected)
              </p>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {Object.entries(PERMISSION_MODULES).map(([module, perms]) => {
                  const allSelected = perms.every((p) => selectedPerms.has(p.key));
                  const someSelected = perms.some((p) => selectedPerms.has(p.key));
                  return (
                    <div key={module} className="rounded-md border border-border/50 p-3">
                      <button
                        type="button"
                        onClick={() => toggleModule(perms)}
                        className="flex items-center gap-2 text-sm font-medium mb-2 hover:text-foreground transition-colors"
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                            allSelected
                              ? "bg-primary border-primary"
                              : someSelected
                              ? "bg-primary/30 border-primary"
                              : "border-muted-foreground/50"
                          }`}
                        >
                          {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                          {someSelected && !allSelected && (
                            <div className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />
                          )}
                        </div>
                        {module}
                      </button>
                      <div className="grid gap-1 ml-6">
                        {perms.map((perm) => (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() => togglePerm(perm.key)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/30 transition-colors"
                          >
                            <div
                              className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors ${
                                selectedPerms.has(perm.key)
                                  ? "bg-primary border-primary"
                                  : "border-muted-foreground/50"
                              }`}
                            >
                              {selectedPerms.has(perm.key) && (
                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium">{perm.label}</p>
                              <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
