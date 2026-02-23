"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Clock, Server, GripVertical } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { METRIC_MAP, METRIC_REGISTRY, METRIC_GROUPS } from "@/lib/metric-registry";
import { ModuleConfigPanel, ConfigSection, ConfigChip } from "../module-config-panel";
import type { ModuleComponentProps } from "../dashboard-grid";

// Metric IDs that come from the uptime monitor integration
const UPTIME_METRICS = new Set(["monitors-down", "monitors-up", "avg-response"]);

function StatCard({
  metricId,
  liveValue,
  editing,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
}: {
  metricId: string;
  liveValue?: string;
  editing?: boolean;
  index: number;
  onDragStart?: (index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDrop?: (index: number) => void;
  isDragTarget?: boolean;
}) {
  const metric = METRIC_MAP.get(metricId);
  if (!metric) return null;

  const Icon = metric.icon;
  const displayValue = liveValue ?? metric.placeholderValue;
  const isLive = liveValue !== undefined;

  return (
    <div
      className={cn(
        "rounded-lg p-4 bg-muted/30 border border-border/50 transition-all",
        editing && "cursor-grab active:cursor-grabbing",
        isDragTarget && "ring-2 ring-red-500/50 border-red-500/30"
      )}
      draggable={editing}
      onDragStart={(e) => {
        if (!editing) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart?.(index);
      }}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e, index);
      }}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        onDrop?.(index);
      }}
      onDragEnd={(e) => {
        e.preventDefault();
        // Clear any drag target highlights
        onDrop?.(-1);
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {editing && (
            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 opacity-50" />
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className={cn("mt-1.5 text-2xl font-bold tracking-tight", isLive ? "text-foreground" : "text-muted-foreground")}>
              {displayValue}
            </p>
          </div>
        </div>
        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", metric.iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{isLive ? "Live" : "Awaiting integration"}</span>
      </div>
    </div>
  );
}

function SystemStatusCard() {
  const { data: health } = trpc.system.health.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const services = health?.services ?? [];
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const total = services.length;
  const allHealthy = healthyCount === total && total > 0;

  return (
    <div className="rounded-lg p-4 bg-muted/30 border border-border/50">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">System Status</p>
        <div className={cn(
          "flex items-center justify-center w-9 h-9 rounded-lg",
          allHealthy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
        )}>
          <Server className="h-4 w-4" />
        </div>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-1">
          {services.map((svc) => (
            <div key={svc.name} className="flex items-center gap-2">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                svc.status === "healthy" ? "bg-green-500" : svc.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              )} />
              <span className="text-[11px] text-foreground truncate flex-1">{svc.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {svc.latencyMs !== null ? `${svc.latencyMs}ms` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatOverviewModule({ config, onConfigChange, isConfigOpen, onConfigClose, editing }: ModuleComponentProps) {
  const columns = (config.columns as number) || 4;
  const selectedMetrics = (config.metrics as string[]) || ["open-tickets", "active-alerts", "monitors-down", "servers-offline"];

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((targetIndex: number) => {
    if (targetIndex === -1 || dragIndex === null) {
      // Drag ended / cancelled
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    if (dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...selectedMetrics];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onConfigChange({ ...config, metrics: reordered });
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, selectedMetrics, config, onConfigChange]);

  // Only fetch uptime data if any monitoring metrics are selected
  const needsUptime = selectedMetrics.some((id) => UPTIME_METRICS.has(id));

  const { data: uptimeMonitors } = trpc.uptime.list.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: needsUptime,
  });

  // Compute live values from fetched data
  const liveValues = useMemo(() => {
    const values = new Map<string, string>();

    if (uptimeMonitors) {
      const active = uptimeMonitors.filter((m) => m.active);
      const upCount = active.filter((m) => m.status === "UP").length;
      const downCount = active.filter((m) => m.status === "DOWN").length;

      values.set("monitors-up", String(upCount));
      values.set("monitors-down", String(downCount));

      const upMonitors = active.filter((m) => m.status === "UP");
      const latencies = upMonitors
        .map((m) => (m.latestHeartbeat as { latencyMs?: number } | null)?.latencyMs)
        .filter((l): l is number => typeof l === "number" && l > 0);
      if (latencies.length > 0) {
        const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
        values.set("avg-response", `${avg}ms`);
      }
    }

    return values;
  }, [uptimeMonitors]);

  const colsClass: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 xl:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
  };

  return (
    <>
      <div className={cn("grid gap-3 p-4", colsClass[columns] || colsClass[4])}>
        {selectedMetrics.map((id, index) =>
          id === "system-status" ? (
            <SystemStatusCard key={id} />
          ) : (
            <StatCard
              key={id}
              metricId={id}
              liveValue={liveValues.get(id)}
              editing={editing}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragTarget={dragOverIndex === index && dragIndex !== index}
            />
          )
        )}
      </div>

      <ModuleConfigPanel title="Key Metrics Settings" open={isConfigOpen} onClose={onConfigClose}>
        <ConfigSection label="Columns per row">
          <div className="flex gap-2">
            {[2, 3, 4, 6].map((n) => (
              <button
                key={n}
                onClick={() => onConfigChange({ ...config, columns: n })}
                className={cn(
                  "w-10 h-8 rounded-lg border text-xs font-medium transition-colors",
                  columns === n ? "border-red-500 bg-red-500/10 text-red-400" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </ConfigSection>

        <ConfigSection label="Selected metrics">
          <p className="text-[10px] text-muted-foreground mb-2">
            Click to toggle. Metrics appear in the order shown.
          </p>
          {METRIC_GROUPS.map((group) => (
            <div key={group} className="mb-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {METRIC_REGISTRY.filter((m) => m.group === group).map((metric) => {
                  const isActive = selectedMetrics.includes(metric.id);
                  return (
                    <ConfigChip
                      key={metric.id}
                      label={metric.label}
                      active={isActive}
                      onClick={() => {
                        const next = isActive
                          ? selectedMetrics.filter((id) => id !== metric.id)
                          : [...selectedMetrics, metric.id];
                        onConfigChange({ ...config, metrics: next });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </ConfigSection>
      </ModuleConfigPanel>
    </>
  );
}
