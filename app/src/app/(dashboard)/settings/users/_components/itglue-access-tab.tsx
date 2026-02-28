"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, BookOpen, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ITGlueGroupDialog } from "./itglue-group-dialog";
import { ITGlueGroupEditor } from "./itglue-group-editor";

export function ITGlueAccessTab() {
  const utils = trpc.useUtils();

  const { data: groups, isLoading } = trpc.itGluePerm.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const deleteGroup = trpc.itGluePerm.delete.useMutation({
    onSuccess: () => {
      utils.itGluePerm.list.invalidate();
      setDeleteConfirmId(null);
    },
  });

  // State
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const groupToDelete = groups?.find(
    (g: { id: string }) => g.id === deleteConfirmId
  );

  // ── Editor view ──
  if (editingGroupId) {
    return (
      <ITGlueGroupEditor
        groupId={editingGroupId}
        onBack={() => setEditingGroupId(null)}
      />
    );
  }

  // ── List view ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading IT Glue permission groups...
      </div>
    );
  }

  return (
    <>
      {/* Header with always-visible Create button */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      {!groups || groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-10 w-10 text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-400">
              No IT Glue permission groups yet
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Create a group to control which IT Glue organizations and assets users can access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(
            (group: {
              id: string;
              name: string;
              description: string | null;
              _count: { rules: number; users: number; roles: number };
            }) => (
              <Card
                key={group.id}
                className="hover:border-zinc-600 transition-colors cursor-pointer"
                onClick={() => setEditingGroupId(group.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-zinc-100 truncate">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroupId(group.id);
                        }}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(group.id);
                        }}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {group._count.rules} rule{group._count.rules !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {group._count.users} user{group._count.users !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                      {group._count.roles} role{group._count.roles !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}

      {/* Create Dialog */}
      <ITGlueGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(groupId) => {
          setCreateOpen(false);
          setEditingGroupId(groupId);
        }}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete Permission Group</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete &quot;{groupToDelete?.name}&quot;? This will remove all
              rules and assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteGroup.mutate({ id: deleteConfirmId })}
              disabled={deleteGroup.isPending}
            >
              {deleteGroup.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
