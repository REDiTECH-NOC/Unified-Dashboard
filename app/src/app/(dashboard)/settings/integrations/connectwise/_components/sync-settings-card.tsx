"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Save,
  RefreshCw,
  Check,
  Power,
  PowerOff,
  AlertCircle,
} from "lucide-react";

interface SyncSettingsCardProps {
  syncMode: "auto" | "manual";
  syncEnabled: boolean;
  onSyncModeChange: (mode: "auto" | "manual") => void;
  onSyncEnabledChange: (enabled: boolean) => void;
}

const SCHEDULE_OPTIONS = [
  { value: "on_demand", label: "On Demand" },
  { value: "every12h", label: "Every 12h" },
  { value: "daily", label: "Daily (overnight)" },
] as const;

export function SyncSettingsCard({
  syncMode,
  syncEnabled,
  onSyncModeChange,
  onSyncEnabledChange,
}: SyncSettingsCardProps) {
  // ── Data queries ──
  const { data: cwStatuses, isLoading: loadingStatuses } =
    trpc.psa.getCompanyStatuses.useQuery();
  const { data: cwTypes, isLoading: loadingTypes } =
    trpc.psa.getCompanyTypes.useQuery();
  const { data: savedConfig, isLoading: loadingConfig } =
    trpc.integration.getSyncConfig.useQuery({ toolId: "connectwise" });

  // ── Mutations ──
  const utils = trpc.useUtils();
  const updateConfig = trpc.integration.updateSyncConfig.useMutation({
    onSuccess: () => {
      // Invalidate so the explorer picks up updated default filters
      utils.integration.getSyncConfig.invalidate({ toolId: "connectwise" });
    },
  });
  const runAutoSync = trpc.company.runAutoSync.useMutation({
    onSuccess: () => {
      utils.company.getSyncedSourceIds.invalidate();
    },
  });
  const syncAll = trpc.company.syncAll.useMutation({
    onSuccess: () => {
      utils.company.getSyncedSourceIds.invalidate();
    },
  });

  // ── Local form state ──
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [schedule, setSchedule] = useState("on_demand");
  const [removalPolicy, setRemovalPolicy] = useState("keep");
  const [removalDays, setRemovalDays] = useState(30);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ── Load saved config on mount ──
  useEffect(() => {
    if (savedConfig && !configLoaded) {
      onSyncEnabledChange(savedConfig.syncEnabled);
      onSyncModeChange(savedConfig.syncMode as "auto" | "manual");
      setStatusFilters(savedConfig.syncStatuses);
      setTypeFilters(savedConfig.syncTypes);
      setSchedule(savedConfig.autoSyncSchedule);
      setRemovalPolicy(savedConfig.removalPolicy);
      setRemovalDays(savedConfig.removalDays);
      setConfigLoaded(true);
    }
  }, [savedConfig, configLoaded, onSyncEnabledChange, onSyncModeChange]);

  function toggleStatus(name: string) {
    setStatusFilters((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
  }

  function toggleType(name: string) {
    setTypeFilters((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  }

  function handleSave() {
    updateConfig.mutate({
      toolId: "connectwise",
      syncEnabled,
      syncMode,
      syncStatuses: statusFilters,
      syncTypes: typeFilters,
      autoSyncSchedule: schedule as "on_demand" | "every12h" | "daily",
      removalPolicy: removalPolicy as "keep" | "remove_after_days",
      removalDays,
    });
  }

  function handleSyncNow() {
    if (syncMode === "auto") {
      runAutoSync.mutate();
    } else {
      syncAll.mutate();
    }
  }

  const isLoading = loadingStatuses || loadingTypes || loadingConfig;
  const isSyncing = runAutoSync.isPending || syncAll.isPending;

  // ── Sync result summaries ──
  const syncResult = runAutoSync.data;
  const refreshResult = syncAll.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Company Sync</CardTitle>
          <Button
            variant={syncEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => onSyncEnabledChange(!syncEnabled)}
            className="h-7"
          >
            {syncEnabled ? (
              <Power className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <PowerOff className="h-3.5 w-3.5 mr-1.5" />
            )}
            {syncEnabled ? "Enabled" : "Disabled"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {syncEnabled
            ? "Configure how companies and their data are synced from ConnectWise"
            : "Enable sync to import companies, contacts, sites, and more from ConnectWise"}
        </p>
      </CardHeader>

      {syncEnabled && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Sync Mode */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Sync Mode
                </label>
                <div className="flex gap-1.5">
                  <Button
                    variant={syncMode === "auto" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSyncModeChange("auto")}
                  >
                    Auto Sync
                  </Button>
                  <Button
                    variant={syncMode === "manual" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSyncModeChange("manual")}
                  >
                    Manual Sync
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {syncMode === "auto"
                    ? "Automatically discover and sync all companies matching your filters"
                    : "Select companies from the explorer — filters apply to removal policy and default explorer view"}
                </p>
              </div>

              {/* Manual mode info */}
              {syncMode === "manual" && (
                <div className="rounded-md border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    Use the Company Explorer below to browse and select individual
                    companies to sync. Check the companies you want, then click{" "}
                    <span className="font-medium text-foreground">
                      Sync Selected
                    </span>
                    . The filters below set the default explorer view and determine
                    when synced companies should be removed.
                  </p>
                </div>
              )}

              {/* Status filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Status Filter
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cwStatuses?.map((s) => (
                    <Button
                      key={s.id}
                      variant={
                        statusFilters.includes(s.name)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleStatus(s.name)}
                    >
                      {s.name}
                    </Button>
                  ))}
                </div>
                {statusFilters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    No status filter — all statuses will be included
                  </p>
                )}
              </div>

              {/* Type filter */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Type Filter
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cwTypes?.map((t) => (
                    <Button
                      key={t.id}
                      variant={
                        typeFilters.includes(t.name)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleType(t.name)}
                    >
                      {t.name}
                    </Button>
                  ))}
                </div>
                {typeFilters.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    No type filter — all types will be included
                  </p>
                )}
              </div>

              {/* Sync Schedule */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Sync Schedule
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={
                        schedule === opt.value ? "default" : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSchedule(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {syncMode === "auto"
                    ? "How often to discover new companies and refresh synced data"
                    : "How often to refresh data for manually synced companies"}
                </p>
              </div>

              {/* Removal Policy */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  When a synced company no longer matches filters
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={
                      removalPolicy === "keep" ? "default" : "outline"
                    }
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setRemovalPolicy("keep")}
                  >
                    Keep (disable sync)
                  </Button>
                  <Button
                    variant={
                      removalPolicy === "remove_after_days"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setRemovalPolicy("remove_after_days")}
                  >
                    Remove after
                  </Button>
                </div>
                {removalPolicy === "remove_after_days" && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={removalDays}
                      onChange={(e) =>
                        setRemovalDays(
                          Math.max(1, parseInt(e.target.value) || 30)
                        )
                      }
                      className="w-20 h-7 text-xs"
                      min={1}
                      max={365}
                    />
                    <span className="text-xs text-muted-foreground">
                      days
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateConfig.isPending}
                >
                  {updateConfig.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save Settings
                </Button>
                {syncMode === "auto" && (
                  <Button
                    size="sm"
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                  >
                    {runAutoSync.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Run Sync Now
                  </Button>
                )}
                {syncMode === "manual" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                  >
                    {syncAll.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Refresh Synced Companies
                  </Button>
                )}
              </div>

              {/* Save confirmation */}
              {updateConfig.isSuccess && (
                <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2.5 text-xs text-green-400 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  Settings saved
                </div>
              )}

              {/* Auto-sync results */}
              {syncResult && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-400 space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="h-3.5 w-3.5 flex-shrink-0" />
                    Sync complete
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-blue-400/80 pl-5">
                    <span>
                      Companies: {syncResult.companies.created} new,{" "}
                      {syncResult.companies.synced} updated
                    </span>
                    <span>
                      Contacts: {syncResult.contacts.created} new,{" "}
                      {syncResult.contacts.synced} updated
                    </span>
                    <span>
                      Sites: {syncResult.sites.created} new,{" "}
                      {syncResult.sites.synced} updated
                    </span>
                    {syncResult.companies.unmatched > 0 && (
                      <span>
                        Unmatched: {syncResult.companies.unmatched}
                      </span>
                    )}
                    {syncResult.companies.removed > 0 && (
                      <span className="text-yellow-400">
                        Removed: {syncResult.companies.removed}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const skipped = [
                      syncResult.contacts.skipped && `Contacts (${(syncResult.contacts as any).error || "unknown error"})`,
                      syncResult.sites.skipped && `Sites (${(syncResult.sites as any).error || "unknown error"})`,
                      syncResult.configurations.skipped && `Configurations (${(syncResult.configurations as any).error || "unknown error"})`,
                      syncResult.agreements.skipped && `Agreements (${(syncResult.agreements as any).error || "unknown error"})`,
                    ].filter(Boolean);
                    if (skipped.length === 0) return null;
                    return (
                      <div className="flex items-start gap-1.5 text-yellow-400/80 pl-5 mt-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>Skipped: {skipped.join(" · ")}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Manual refresh results */}
              {refreshResult && (
                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-xs text-blue-400 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Refreshed {refreshResult.synced} of {refreshResult.total} synced companies
                    {refreshResult.failed > 0 && ` (${refreshResult.failed} failed)`}
                    {refreshResult.total === 0 && " — select companies from the explorer below first"}
                  </span>
                </div>
              )}

              {(runAutoSync.error || syncAll.error) && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 text-xs text-red-400">
                  {runAutoSync.error?.message || syncAll.error?.message}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
