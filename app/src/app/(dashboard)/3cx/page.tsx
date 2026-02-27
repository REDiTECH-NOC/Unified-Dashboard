"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, RefreshCw, Loader2, Copy, Check, Radio, Download, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PbxOverviewStats } from "./_components/pbx-overview-stats";
import { PbxInstanceTable } from "./_components/pbx-instance-table";
import { PbxAddDialog } from "./_components/pbx-add-dialog";

export default function PhoneSystemsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editInstance, setEditInstance] = useState<{
    id: string;
    name: string;
    fqdn: string;
    extensionNumber: string;
    companyId: string | null;
    companyName: string | null;
    localIp: string | null;
    sshUsername: string | null;
  } | null>(null);

  // Agent registration
  const [showAgentKey, setShowAgentKey] = useState<string | null>(null);
  const [agentKeyCopied, setAgentKeyCopied] = useState(false);

  const utils = trpc.useUtils();

  // Data
  const { data: instances, isFetching } =
    trpc.threecx.getDashboardOverview.useQuery(undefined, {
      refetchInterval: 30_000,
    });

  const { data: permissions } = trpc.user.myPermissions.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const { data: agentStatus } = trpc.threecx.getAgentStatus.useQuery(
    undefined,
    { refetchInterval: 15_000 }
  );

  const canManage = permissions?.includes("phone.manage") ?? false;
  const agentOnline = agentStatus?.some((a: { isOnline: boolean }) => a.isOnline) ?? false;
  const hasAgent = (agentStatus?.length ?? 0) > 0;

  // Refresh all
  const refreshAll = trpc.threecx.refreshAllInstances.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
    },
  });

  const registerAgent = trpc.threecx.registerAgent.useMutation({
    onSuccess: (data) => {
      setShowAgentKey(data.apiKey);
      utils.threecx.getAgentStatus.invalidate();
    },
  });

  const regenerateKey = trpc.threecx.regenerateAgentKey.useMutation({
    onSuccess: (data) => {
      setShowAgentKey(data.apiKey);
    },
  });

  const handleEdit = (inst: {
    id: string;
    name: string;
    fqdn: string;
    extensionNumber: string;
    company: { id: string; name: string } | null;
    companyName: string | null;
    localIp: string | null;
    sshUsername: string | null;
  }) => {
    setEditInstance({
      id: inst.id,
      name: inst.name,
      fqdn: inst.fqdn,
      extensionNumber: inst.extensionNumber,
      companyId: inst.company?.id ?? null,
      companyName: inst.company?.name ?? inst.companyName ?? null,
      localIp: inst.localIp ?? null,
      sshUsername: inst.sshUsername ?? null,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditInstance(null);
    setDialogOpen(true);
  };

  const handleCopyAgentKey = () => {
    if (showAgentKey) {
      navigator.clipboard.writeText(showAgentKey);
      setAgentKeyCopied(true);
      setTimeout(() => setAgentKeyCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Phone Systems
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and monitor your 3CX PBX instances
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent Status */}
          {hasAgent && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[10px]">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  agentOnline ? "bg-green-500" : "bg-zinc-500"
                )}
              />
              <span className="text-muted-foreground">
                Relay Agent {agentOnline ? "Online" : "Offline"}
              </span>
            </div>
          )}

          {canManage && hasAgent && (
            <>
              <button
                onClick={() => {
                  const agent = agentStatus?.[0];
                  if (agent) regenerateKey.mutate({ id: agent.id });
                }}
                disabled={regenerateKey.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                {regenerateKey.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5" />
                )}
                Regenerate Key
              </button>
              <a
                href="/api/agent/download"
                download="reditech-relay-agent.tar.gz"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Agent Installer
              </a>
            </>
          )}

          <button
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {refreshAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh All
          </button>

          {canManage && !hasAgent && (
            <button
              onClick={() => registerAgent.mutate({ name: "HQ Relay Agent" })}
              disabled={registerAgent.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
            >
              {registerAgent.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Radio className="h-3.5 w-3.5" />
              )}
              Register Agent
            </button>
          )}

          {canManage && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add PBX
            </button>
          )}
        </div>
      </div>

      {/* Agent API Key Banner (shown once after registration) */}
      {showAgentKey && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Relay Agent API Key
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copy this key now. It will not be shown again.
              </p>
            </div>
            <button
              onClick={() => setShowAgentKey(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-accent border border-border text-xs font-mono text-foreground select-all break-all">
              {showAgentKey}
            </code>
            <button
              onClick={handleCopyAgentKey}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {agentKeyCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {agentKeyCopied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards + License Warnings */}
      <PbxOverviewStats instances={instances ?? []} />

      {/* PBX Table */}
      <PbxInstanceTable
        instances={instances ?? []}
        canManage={canManage}
        onEdit={handleEdit}
        isFetching={isFetching}
      />

      {/* Add/Edit Dialog */}
      <PbxAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editInstance={editInstance}
      />
    </div>
  );
}
