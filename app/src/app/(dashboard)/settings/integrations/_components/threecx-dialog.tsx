"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { ThreecxInstanceForm } from "./threecx-instance-form";
import {
  Plus, Pencil, Trash2, Zap, Loader2, Check, X, Phone,
} from "lucide-react";

interface ThreecxDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ThreecxDialog({ open, onClose }: ThreecxDialogProps) {
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string; latencyMs: number }>>({});

  const { data: instances, refetch } = trpc.threecx.listInstances.useQuery(undefined, {
    enabled: open,
  });

  const testConnection = trpc.threecx.testConnection.useMutation({
    onSuccess: (result, variables) => {
      setTestResult((prev) => ({
        ...prev,
        [variables.id]: {
          ok: result.ok,
          message: result.message ?? (result.ok ? "Connected" : "Failed"),
          latencyMs: result.latencyMs,
        },
      }));
      setTestingId(null);
      refetch();
    },
    onError: (error, variables) => {
      setTestResult((prev) => ({
        ...prev,
        [variables.id]: { ok: false, message: error.message, latencyMs: 0 },
      }));
      setTestingId(null);
    },
  });

  const deleteInstance = trpc.threecx.deleteInstance.useMutation({
    onSuccess: () => {
      setDeletingId(null);
      refetch();
    },
  });

  function handleTest(id: string) {
    setTestingId(id);
    setTestResult((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    testConnection.mutate({ id });
  }

  function handleEdit(id: string) {
    setEditingId(id);
    setView("edit");
  }

  function handleFormSaved() {
    setView("list");
    setEditingId(null);
    refetch();
  }

  function handleDialogClose() {
    setView("list");
    setEditingId(null);
    setDeletingId(null);
    setTestResult({});
    onClose();
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "online":
        return "success";
      case "offline":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDialogClose()}>
      <DialogContent onClose={handleDialogClose} className="max-w-2xl">
        {view === "list" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-400" />
                3CX PBX Instances
              </DialogTitle>
              <DialogDescription>
                Manage customer PBX connections. Each instance monitors one 3CX PBX.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {instances && instances.length > 0 ? (
                instances.map((inst: any) => (
                  <div
                    key={inst.id}
                    className="rounded-md border border-border p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "h-2 w-2 rounded-full " +
                            (inst.status === "online"
                              ? "bg-green-500"
                              : inst.status === "offline"
                              ? "bg-red-500"
                              : "bg-muted-foreground/30")
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {inst.fqdn}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusColor(inst.status) as "success" | "destructive" | "secondary"}>
                          {inst.status}
                        </Badge>
                        {inst.company && (
                          <Badge variant="outline" className="text-[10px]">
                            {inst.company.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Quick stats */}
                    {inst.status === "online" && (
                      <div className="flex gap-4 text-[10px] text-muted-foreground">
                        {inst.extensionsRegistered != null && (
                          <span>
                            {inst.extensionsRegistered}/{inst.extensionsTotal} ext
                          </span>
                        )}
                        {inst.callsActive != null && (
                          <span>{inst.callsActive} active calls</span>
                        )}
                        {inst.version && <span>v{inst.version}</span>}
                      </div>
                    )}

                    {/* Test result */}
                    {testResult[inst.id] && (
                      <div
                        className={
                          "rounded-md p-2 text-xs flex items-center gap-2 " +
                          (testResult[inst.id].ok
                            ? "bg-green-500/5 text-green-400"
                            : "bg-red-500/5 text-red-400")
                        }
                      >
                        {testResult[inst.id].ok ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        <span className="flex-1">{testResult[inst.id].message}</span>
                        {testResult[inst.id].latencyMs > 0 && (
                          <span className="text-muted-foreground">
                            {testResult[inst.id].latencyMs}ms
                          </span>
                        )}
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {deletingId === inst.id ? (
                      <div className="flex items-center justify-between rounded-md bg-red-500/5 border border-red-500/20 p-2">
                        <p className="text-xs text-red-400">
                          Delete <strong>{inst.name}</strong>?
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingId(null)}
                            disabled={deleteInstance.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteInstance.mutate({ id: inst.id })}
                            disabled={deleteInstance.isPending}
                          >
                            {deleteInstance.isPending ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(inst.id)}
                          disabled={testingId === inst.id}
                        >
                          {testingId === inst.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(inst.id)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingId(inst.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p>No PBX instances configured yet.</p>
                  <p className="text-xs mt-1">
                    Add your first 3CX PBX to start monitoring.
                  </p>
                </div>
              )}

              <Button
                onClick={() => setView("add")}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add PBX Instance
              </Button>
            </div>
          </>
        ) : (
          <ThreecxInstanceForm
            instanceId={view === "edit" ? editingId : null}
            onBack={() => {
              setView("list");
              setEditingId(null);
            }}
            onSaved={handleFormSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
