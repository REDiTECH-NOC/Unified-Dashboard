"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Users,
  ShieldCheck,
  Plus,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ITGlueOrgPermissionTree } from "./itglue-org-permission-tree";

type AccessMode = "READ_WRITE" | "READ_ONLY" | "DENIED";

interface ITGlueGroupEditorProps {
  groupId: string;
  onBack: () => void;
}

export function ITGlueGroupEditor({ groupId, onBack }: ITGlueGroupEditorProps) {
  const utils = trpc.useUtils();

  // ── Form state ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  // ── Data queries ──
  const groupDetail = trpc.itGluePerm.getById.useQuery(
    { id: groupId },
    { staleTime: 0 }
  );

  const allUsers = trpc.user.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const allRoles = trpc.permissionRole.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // ── Mutations ──
  const updateGroup = trpc.itGluePerm.update.useMutation({
    onSuccess: () => {
      utils.itGluePerm.list.invalidate();
      utils.itGluePerm.getById.invalidate({ id: groupId });
    },
  });

  const assignUser = trpc.itGluePerm.assignToUser.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const removeUser = trpc.itGluePerm.removeFromUser.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const assignRole = trpc.itGluePerm.assignToRole.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const removeRole = trpc.itGluePerm.removeFromRole.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  // ── Sync form state ──
  useEffect(() => {
    if (groupDetail.data) {
      setName(groupDetail.data.name);
      setDescription(groupDetail.data.description ?? "");
    }
  }, [groupDetail.data]);

  function handleSaveDetails() {
    updateGroup.mutate({ id: groupId, name, description: description || null });
  }

  // Derived data
  const assignedUserIds = new Set(
    (groupDetail.data?.users ?? []).map((u: { userId: string }) => u.userId)
  );
  const assignedRoleIds = new Set(
    (groupDetail.data?.roles ?? []).map((r: { permissionRoleId: string }) => r.permissionRoleId)
  );

  const existingRules = (groupDetail.data?.rules ?? []).map(
    (r: {
      id: string;
      orgId: string;
      section: string | null;
      categoryId: string | null;
      assetId: string | null;
      accessMode: string;
    }) => ({
      id: r.id,
      orgId: r.orgId,
      section: r.section,
      categoryId: r.categoryId,
      assetId: r.assetId,
      accessMode: r.accessMode as AccessMode,
    })
  );

  if (groupDetail.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading group...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
      </div>

      {/* ── Details ── */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-zinc-400">Group Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-200"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-zinc-400">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="bg-zinc-800 border-zinc-700 text-zinc-200"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSaveDetails}
          disabled={!name.trim() || updateGroup.isPending}
          className="border-zinc-700 text-zinc-300"
        >
          {updateGroup.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save
        </Button>
      </div>

      {/* ── Assignments ── */}
      <div className="rounded-lg border border-zinc-800 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300">Assign Users & Roles</h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Users */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Users
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {groupDetail.data?.users?.length ?? 0}
                </Badge>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddUserOpen(!addUserOpen)}
                className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {addUserOpen && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignUser.mutate({ groupId, userId: e.target.value });
                    setAddUserOpen(false);
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Select user...</option>
                {(allUsers.data ?? [])
                  .filter((u: { id: string }) => !assignedUserIds.has(u.id))
                  .map((u: { id: string; name?: string | null; email: string }) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
              </select>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(groupDetail.data?.users ?? []).length === 0 ? (
                <span className="text-xs text-zinc-600">No users assigned</span>
              ) : (
                (groupDetail.data?.users ?? []).map(
                  (u: { userId: string; user: { id: string; name?: string | null; email: string } }) => (
                    <span
                      key={u.userId}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                    >
                      {u.user.name ?? u.user.email}
                      <button
                        onClick={() => removeUser.mutate({ groupId, userId: u.userId })}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                )
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Permission Roles
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {groupDetail.data?.roles?.length ?? 0}
                </Badge>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAddRoleOpen(!addRoleOpen)}
                className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {addRoleOpen && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignRole.mutate({ groupId, permissionRoleId: e.target.value });
                    setAddRoleOpen(false);
                  }
                }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Select role...</option>
                {(allRoles.data ?? [])
                  .filter((r: { id: string }) => !assignedRoleIds.has(r.id))
                  .map((r: { id: string; name: string }) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(groupDetail.data?.roles ?? []).length === 0 ? (
                <span className="text-xs text-zinc-600">No roles assigned</span>
              ) : (
                (groupDetail.data?.roles ?? []).map(
                  (r: { permissionRoleId: string; permissionRole: { id: string; name: string } }) => (
                    <span
                      key={r.permissionRoleId}
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                    >
                      {r.permissionRole.name}
                      <button
                        onClick={() =>
                          removeRole.mutate({ groupId, permissionRoleId: r.permissionRoleId })
                        }
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Organization Permissions ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">Organization Permissions</h3>
        <ITGlueOrgPermissionTree
          groupId={groupId}
          existingRules={existingRules}
        />
      </div>
    </div>
  );
}
