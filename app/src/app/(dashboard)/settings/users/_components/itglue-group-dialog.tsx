"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ITGlueGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

export function ITGlueGroupDialog({ open, onClose, onCreated }: ITGlueGroupDialogProps) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createGroup = trpc.itGluePerm.create.useMutation({
    onSuccess: (group) => {
      utils.itGluePerm.list.invalidate();
      setName("");
      setDescription("");
      onCreated(group.id);
    },
  });

  function handleCreate() {
    createGroup.mutate({ name, description: description || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setName(""); setDescription(""); } }}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Create Permission Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Group Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tier 1 Support"
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleCreate();
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="bg-zinc-800 border-zinc-700 text-zinc-200"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createGroup.isPending}>
            {createGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
