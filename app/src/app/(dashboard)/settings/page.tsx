"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Plug,
  UserCog,
  Palette,
  Bell,
  Info,
  Server,
  Database,
  HardDrive,
  Workflow,
  BarChart3,
  RefreshCw,
  ArrowUpCircle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";

const settingsSections = [
  {
    title: "Integrations",
    description: "Manage API connections for all 20 tools",
    icon: Plug,
    href: "/settings/integrations",
  },
  {
    title: "User Management",
    description: "Manage user roles, permissions, and feature flags",
    icon: UserCog,
    href: "/settings/users",
  },
  {
    title: "Notifications",
    description: "Configure notification channels, sender emails, and rules",
    icon: Bell,
    href: "/settings/notifications",
  },
  {
    title: "Branding",
    description: "Customize logo, company name, and platform appearance",
    icon: Palette,
    href: "/settings/branding",
  },
];

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "RCC App": Server,
  n8n: Workflow,
  Grafana: BarChart3,
  PostgreSQL: Database,
  Redis: HardDrive,
};

export default function SettingsPage() {
  const { dateTime } = useTimezone();
  const utils = trpc.useUtils();

  const containerQuery = trpc.system.containerInfo.useQuery(undefined, {
    staleTime: 30_000,
  });

  const healthQuery = trpc.system.health.useQuery(undefined, {
    staleTime: 30_000,
  });

  const applyUpdateMutation = trpc.system.applyUpdate.useMutation({
    onSuccess: () => {
      // Refetch after update completes
      utils.system.containerInfo.invalidate();
      utils.system.health.invalidate();
    },
  });

  const [updatingService, setUpdatingService] = useState<string | null>(null);

  const handleCheckUpdates = () => {
    utils.system.containerInfo.invalidate();
    utils.system.health.invalidate();
  };

  const handleApplyUpdate = async (service: "n8n" | "grafana") => {
    setUpdatingService(service);
    try {
      await applyUpdateMutation.mutateAsync({ service });
    } finally {
      setUpdatingService(null);
    }
  };

  // Merge health + container data for the info section
  const dbService = healthQuery.data?.services.find((s) => s.name === "PostgreSQL");
  const redisService = healthQuery.data?.services.find((s) => s.name === "Redis");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Platform configuration and management
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="cursor-pointer transition-colors hover:border-primary/50 h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">System Information</CardTitle>
            </div>
            <button
              onClick={handleCheckUpdates}
              disabled={containerQuery.isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", containerQuery.isFetching && "animate-spin")} />
              Check for Updates
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Info Row */}
          <div className="grid gap-3 sm:grid-cols-3 text-sm pb-4 border-b border-border">
            <div className="flex justify-between sm:flex-col sm:gap-1">
              <span className="text-muted-foreground">Platform Version</span>
              <span className="font-mono text-foreground">v0.2.0</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1">
              <span className="text-muted-foreground">Phase</span>
              <span className="text-foreground">Phase 2 — Core Integrations</span>
            </div>
            <div className="flex justify-between sm:flex-col sm:gap-1">
              <span className="text-muted-foreground">Environment</span>
              <span className={cn(
                "text-foreground",
                (containerQuery.data?.dockerAvailable || containerQuery.data?.azureAvailable) ? "text-green-500" : "text-muted-foreground"
              )}>
                {containerQuery.isLoading ? "Checking..."
                  : containerQuery.data?.dockerAvailable ? "Docker"
                  : containerQuery.data?.azureAvailable ? "Azure Container Apps"
                  : "Unknown"}
              </span>
            </div>
          </div>

          {/* Container Cards */}
          {containerQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Updatable containers */}
              {containerQuery.data?.containers.map((container) => {
                const Icon = SERVICE_ICONS[container.service] ?? Server;
                const isUpdating = updatingService === container.service.toLowerCase();

                return (
                  <div
                    key={container.containerName}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
                  >
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {container.service}
                        </span>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          container.status === "running" ? "bg-green-500" : "bg-yellow-500"
                        )} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">
                          {container.currentVersion ? `v${container.currentVersion}` : "version unknown"}
                        </span>
                        {container.uptime && (
                          <>
                            <span className="text-border">|</span>
                            <span>{container.uptime}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Update Status + Action */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {container.updateAvailable ? (
                        <>
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                            <ArrowUpCircle className="h-3 w-3" />
                            {container.latestVersion}
                          </span>
                          {container.canUpdate && (
                            <button
                              onClick={() => handleApplyUpdate(container.service.toLowerCase() as "n8n" | "grafana")}
                              disabled={isUpdating || !!updatingService}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" />
                                  Update
                                </>
                              )}
                            </button>
                          )}
                        </>
                      ) : container.currentVersion ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-500/80 bg-green-500/5 px-2 py-1 rounded">
                          <CheckCircle2 className="h-3 w-3" />
                          Up to date
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Infrastructure services (DB + Redis) */}
              {[dbService, redisService].filter(Boolean).map((service) => {
                if (!service) return null;
                const Icon = SERVICE_ICONS[service.name] ?? Database;

                return (
                  <div
                    key={service.name}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {service.name}
                        </span>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          service.status === "healthy" ? "bg-green-500"
                            : service.status === "degraded" ? "bg-yellow-500"
                            : "bg-red-500"
                        )} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">
                          {service.version ? `v${service.version}` : "version unknown"}
                        </span>
                        {service.latencyMs !== null && (
                          <>
                            <span className="text-border">|</span>
                            <span>{service.latencyMs}ms</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded",
                        service.status === "healthy"
                          ? "text-green-500/80 bg-green-500/5"
                          : service.status === "down"
                          ? "text-red-500 bg-red-500/10"
                          : "text-yellow-500 bg-yellow-500/10"
                      )}>
                        {service.status === "healthy" ? (
                          <><CheckCircle2 className="h-3 w-3" /> Healthy</>
                        ) : service.status === "down" ? (
                          <><XCircle className="h-3 w-3" /> Down</>
                        ) : (
                          "Degraded"
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error state */}
          {applyUpdateMutation.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              {applyUpdateMutation.error.message}
            </div>
          )}

          {/* Last checked */}
          {containerQuery.data?.checkedAt && (
            <p className="text-[10px] text-muted-foreground pt-2 border-t border-border">
              Last checked: {dateTime(containerQuery.data.checkedAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
