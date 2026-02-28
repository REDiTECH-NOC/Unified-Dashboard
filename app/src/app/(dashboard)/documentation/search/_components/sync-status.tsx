"use client";

import { RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function SyncStatus() {
  const syncStatus = trpc.itGluePerm.getSyncStatus.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 10_000, // Poll every 10s while viewing
  });

  const utils = trpc.useUtils();

  const triggerSync = trpc.itGluePerm.triggerSync.useMutation({
    onSuccess: () => {
      utils.itGluePerm.getSyncStatus.invalidate();
      utils.itGluePerm.getCachedOrgs.invalidate();
      utils.itGluePerm.getCachedAssetTypes.invalidate();
      utils.itGluePerm.getCachedPasswordCategories.invalidate();
    },
  });

  const isRunning = syncStatus.data?.progress?.status === "running";
  const lastSync = syncStatus.data?.states?.find((s: { entityType: string }) => s.entityType === "assets");

  return (
    <div className="flex items-center gap-3">
      <div className="text-right text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          <span>
            {syncStatus.data?.totalOrgs ?? 0} orgs, {syncStatus.data?.totalAssets ?? 0} assets
          </span>
        </div>
        {lastSync?.lastSyncedAt && (
          <div>
            Last sync: {new Date(lastSync.lastSyncedAt).toLocaleString()}
          </div>
        )}
        {isRunning && syncStatus.data?.progress && (
          <div className="text-blue-400">
            Syncing: {syncStatus.data.progress.phase}
            {syncStatus.data.progress.currentOrg && ` — ${syncStatus.data.progress.currentOrg}`}
            {syncStatus.data.progress.orgsCompleted != null && syncStatus.data.progress.orgsTotal && (
              <> ({syncStatus.data.progress.orgsCompleted}/{syncStatus.data.progress.orgsTotal})</>
            )}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => triggerSync.mutate({ mode: "full" })}
        disabled={isRunning || triggerSync.isPending}
        className="border-zinc-700 text-zinc-400 hover:text-white"
      >
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRunning || triggerSync.isPending ? "animate-spin" : ""}`} />
        {isRunning ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
