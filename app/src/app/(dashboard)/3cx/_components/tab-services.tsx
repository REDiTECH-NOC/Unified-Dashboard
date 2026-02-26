"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Loader2, Settings, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";

interface TabServicesProps {
  instanceId: string;
}

function formatMemory(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function statusIcon(status: string) {
  const s = status.toLowerCase();
  if (s === "running") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (s === "stopped") return <XCircle className="h-3.5 w-3.5 text-red-500" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "running") return "text-green-500";
  if (s === "stopped") return "text-red-500";
  return "text-yellow-500";
}

export function TabServices({ instanceId }: TabServicesProps) {
  const [restartingService, setRestartingService] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: services, isLoading } = trpc.threecx.getServices.useQuery(
    { instanceId },
    { refetchInterval: 30000 }
  );

  const restartMutation = trpc.threecx.restartService.useMutation({
    onSuccess: () => {
      setRestartingService(null);
      utils.threecx.getServices.invalidate({ instanceId });
    },
    onError: () => {
      setRestartingService(null);
    },
  });

  const restartAllMutation = trpc.threecx.restartAllServices.useMutation({
    onSuccess: () => {
      utils.threecx.getServices.invalidate({ instanceId });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!services) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Failed to load services. The PBX may be offline.
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Settings className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No services found</p>
        </div>
      </div>
    );
  }

  const running = services.filter((s) => s.status.toLowerCase() === "running").length;
  const stopped = services.filter((s) => s.status.toLowerCase() === "stopped").length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {running} running
          {stopped > 0 && <span className="text-red-500 ml-1">· {stopped} stopped</span>}
        </span>
        <button
          onClick={() => restartAllMutation.mutate({ instanceId })}
          disabled={restartAllMutation.isPending}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {restartAllMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          Restart All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-medium">Service</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Memory</th>
              <th className="text-left px-4 py-2.5 font-medium">Threads</th>
              <th className="text-right px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => {
              const isRestarting = restartingService === svc.name && restartMutation.isPending;
              return (
                <tr key={svc.name} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-foreground font-medium">{svc.displayName}</span>
                      <span className="text-muted-foreground ml-2 text-[10px] font-mono">{svc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(svc.status)}
                      <span className={statusColor(svc.status)}>{svc.status}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{formatMemory(svc.memoryUsed)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{svc.threadCount ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {svc.restartEnabled ? (
                      <button
                        onClick={() => {
                          setRestartingService(svc.name);
                          restartMutation.mutate({ instanceId, serviceName: svc.name });
                        }}
                        disabled={isRestarting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        {isRestarting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restart
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
