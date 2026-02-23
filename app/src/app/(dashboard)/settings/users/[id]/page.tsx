"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Shield,
  ScrollText,
  ShieldCheck,
  RotateCcw,
  Check,
  X,
  Lock,
  LogIn,
  Users,
  Plug,
  Server,
  Globe,
  Database,
  Plus,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";

type TabKey = "permissions" | "roles" | "activity";

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  AUTH: LogIn,
  USER: Users,
  SECURITY: Shield,
  INTEGRATION: Plug,
  SYSTEM: Server,
  API: Globe,
  DATA: Database,
};

const CATEGORY_COLORS: Record<string, string> = {
  AUTH: "text-blue-400",
  USER: "text-emerald-400",
  SECURITY: "text-red-400",
  INTEGRATION: "text-amber-400",
  SYSTEM: "text-purple-400",
  API: "text-cyan-400",
  DATA: "text-orange-400",
};

const roleColors: Record<string, string> = {
  ADMIN: "destructive",
  MANAGER: "warning",
  USER: "default",
  CLIENT: "secondary",
};

const sourceLabels: Record<string, { label: string; color: string }> = {
  override: { label: "override", color: "text-amber-400" },
  "permission-role": { label: "from role", color: "text-blue-400" },
  role: { label: "default", color: "text-muted-foreground" },
};

export default function UserDetailPage() {
  const { dateTime, date } = useTimezone();
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [activeTab, setActiveTab] = useState<TabKey>("permissions");

  const utils = trpc.useUtils();
  const { data: user, isLoading, refetch } = trpc.user.getById.useQuery({ userId });
  const { data: activity } = trpc.audit.userActivity.useQuery(
    { userId, limit: 50 },
    { enabled: activeTab === "activity" }
  );
  const { data: userRoles } = trpc.permissionRole.getUserRoles.useQuery(
    { userId },
    { enabled: activeTab === "roles" }
  );
  const { data: allRoles } = trpc.permissionRole.list.useQuery(
    undefined,
    { enabled: activeTab === "roles" }
  );

  const setPermission = trpc.user.setPermission.useMutation({ onSuccess: () => refetch() });
  const resetPermission = trpc.user.resetPermission.useMutation({ onSuccess: () => refetch() });
  const assignRole = trpc.permissionRole.assignToUser.useMutation({
    onSuccess: () => {
      utils.permissionRole.getUserRoles.invalidate({ userId });
      refetch();
    },
  });
  const removeRole = trpc.permissionRole.removeFromUser.useMutation({
    onSuccess: () => {
      utils.permissionRole.getUserRoles.invalidate({ userId });
      refetch();
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-8">Loading user...</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground p-8">User not found.</p>;
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  // Group permissions by module
  const permsByModule: Record<string, typeof user.effectivePermissions> = {};
  for (const ep of user.effectivePermissions) {
    const moduleName = ep.permission.split(".")[0].charAt(0).toUpperCase() + ep.permission.split(".")[0].slice(1);
    const module = moduleName === "Ai" ? "AI" : moduleName;
    if (!permsByModule[module]) permsByModule[module] = [];
    permsByModule[module].push(ep);
  }

  // Find which permission roles are already assigned
  const assignedRoleIds = new Set(userRoles?.map((ur) => ur.permissionRoleId) || []);
  const availableRoles = allRoles?.filter((r) => !assignedRoleIds.has(r.id)) || [];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* User info card */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="h-14 w-14">
            {user.avatar && <AvatarImage src={user.avatar} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold truncate">{user.name || user.email}</h2>
              <Badge variant={roleColors[user.role] as any}>{user.role}</Badge>
              <Badge variant="outline" className="text-[10px]">{user.authMethod}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Last login: {user.lastLoginAt ? dateTime(user.lastLoginAt) : "Never"}
              {" · "}Joined: {date(user.createdAt)}
            </p>
          </div>
          {user.totpEnabled && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Lock className="h-3.5 w-3.5" />
              MFA Enabled
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: "permissions" as TabKey, label: "Permissions", icon: Shield },
          { key: "roles" as TabKey, label: "Assigned Roles", icon: ShieldCheck },
          { key: "activity" as TabKey, label: "Activity Log", icon: ScrollText },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Permissions tab */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Effective permissions are resolved in order: per-user overrides &gt; permission roles (most permissive wins) &gt; base role defaults ({user.role}).
            The source is shown next to each permission.
          </p>

          {Object.entries(permsByModule).map(([module, perms]) => (
            <Card key={module}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">{module}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1">
                  {perms.map((ep) => {
                    const permKey = ep.permission;
                    const label = permKey.split(".").slice(1).join(" ");
                    const isOverride = ep.source === "override";
                    const sourceInfo = sourceLabels[ep.source] || sourceLabels.role;
                    const isMutating = setPermission.isPending || resetPermission.isPending;

                    return (
                      <div
                        key={permKey}
                        className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {ep.granted ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <X className="h-4 w-4 text-red-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium capitalize">
                              {label}
                              <span className={`ml-2 text-[10px] font-normal ${sourceInfo.color}`}>
                                {sourceInfo.label}
                                {ep.source === "permission-role" && (ep as any).roleName && (
                                  <> ({(ep as any).roleName})</>
                                )}
                              </span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{permKey}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isOverride && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                              disabled={isMutating}
                              onClick={() =>
                                resetPermission.mutate({ userId, permission: permKey })
                              }
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          )}
                          <Button
                            variant={ep.granted ? "outline" : "default"}
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            disabled={isMutating}
                            onClick={() =>
                              setPermission.mutate({
                                userId,
                                permission: permKey,
                                granted: !ep.granted,
                              })
                            }
                          >
                            {ep.granted ? "Revoke" : "Grant"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Roles tab */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Assign permission roles to this user. All permissions from all assigned roles are combined — the most permissive wins.
          </p>

          {/* Currently assigned roles */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Assigned Roles</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {userRoles && userRoles.length > 0 ? (
                <div className="space-y-2">
                  {userRoles.map((ur) => (
                    <div
                      key={ur.id}
                      className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{ur.permissionRole.name}</p>
                          {ur.permissionRole.description && (
                            <p className="text-[11px] text-muted-foreground">{ur.permissionRole.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ur.permissionRole.permissions.slice(0, 5).map((p) => (
                              <Badge key={p} variant="secondary" className="text-[9px]">
                                {p}
                              </Badge>
                            ))}
                            {ur.permissionRole.permissions.length > 5 && (
                              <Badge variant="outline" className="text-[9px]">
                                +{ur.permissionRole.permissions.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-muted-foreground">
                          {date(ur.assignedAt)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          disabled={removeRole.isPending}
                          onClick={() =>
                            removeRole.mutate({ userId, permissionRoleId: ur.permissionRoleId })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No permission roles assigned. All permissions use base role defaults.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Available roles to assign */}
          {availableRoles.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Available Roles</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {availableRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between rounded-md border border-border/50 border-dashed px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{role.name}</p>
                          {role.description && (
                            <p className="text-[11px] text-muted-foreground">{role.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                            {" · "}{role._count.users} user{role._count.users !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={assignRole.isPending}
                        onClick={() =>
                          assignRole.mutate({ userId, permissionRoleId: role.id })
                        }
                      >
                        <Plus className="h-3 w-3" />
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Activity tab */}
      {activeTab === "activity" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity?.items && activity.items.length > 0 ? (
              <div className="space-y-1">
                {activity.items.map((event) => {
                  const CatIcon = CATEGORY_ICONS[event.category] || ScrollText;
                  const catColor = CATEGORY_COLORS[event.category] || "text-muted-foreground";
                  return (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CatIcon className={`h-4 w-4 flex-shrink-0 ${catColor}`} />
                        <Badge
                          variant={
                            event.outcome === "success"
                              ? "success"
                              : event.outcome === "denied"
                              ? "destructive"
                              : ("warning" as any)
                          }
                          className="text-[10px] px-1.5"
                        >
                          {event.outcome}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{event.action}</p>
                          {event.resource && (
                            <p className="text-xs text-muted-foreground truncate">
                              {event.resource}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Badge variant="outline" className="text-[10px]">
                          {event.category}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {dateTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ScrollText className="mb-3 h-8 w-8 opacity-50" />
                <p className="text-sm">No activity recorded</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
