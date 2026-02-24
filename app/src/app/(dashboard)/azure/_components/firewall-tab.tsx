"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Database,
  HardDrive,
  Cloud,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateFirewallRuleDialog } from "./create-firewall-rule-dialog";
import { EditFirewallRuleDialog } from "./edit-firewall-rule-dialog";

type ResourceType = "postgresql" | "redis" | "keyvault" | "containerapp";

interface FirewallRule {
  name: string;
  startIpAddress: string;
  endIpAddress: string;
  cidr?: string;
  action?: string;
}

const RESOURCE_ICONS: Record<ResourceType, React.ElementType> = {
  postgresql: Database,
  redis: HardDrive,
  keyvault: Shield,
  containerapp: Cloud,
};

export function FirewallTab() {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule] = useState<FirewallRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<{
    type: ResourceType;
    name: string;
    label: string;
  } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch available resources
  const resourcesQuery = trpc.infrastructure.listFirewallResources.useQuery(undefined, {
    staleTime: 60_000,
  });

  // Auto-select first resource when loaded
  const resources = resourcesQuery.data?.resources || [];
  if (resources.length > 0 && !selectedResource) {
    // Use a default — will be set on first render cycle
  }
  const activeResource = selectedResource || resources[0] || null;

  // Fetch rules for selected resource
  const rulesQuery = trpc.infrastructure.listFirewallRules.useQuery(
    activeResource
      ? { resourceType: activeResource.type, resourceName: activeResource.name }
      : undefined,
    {
      staleTime: 30_000,
      enabled: !!activeResource,
    }
  );

  const deleteMutation = trpc.infrastructure.deleteFirewallRule.useMutation({
    onSuccess: () => {
      utils.infrastructure.listFirewallRules.invalidate();
      setConfirmDelete(null);
      setDeletingRule(null);
    },
    onError: () => {
      setDeletingRule(null);
    },
  });

  function handleDelete(rule: FirewallRule) {
    if (!activeResource) return;
    setDeletingRule(rule.name);
    deleteMutation.mutate({
      resourceType: activeResource.type,
      resourceName: activeResource.name,
      ruleName: rule.name,
      ...(activeResource.type === "keyvault" && rule.cidr ? { cidr: rule.cidr } : {}),
    });
  }

  const isLoading = resourcesQuery.isLoading;
  const isFetching = rulesQuery.isFetching;
  const isKeyvault = activeResource?.type === "keyvault";
  const isContainerApp = activeResource?.type === "containerapp";

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (resourcesQuery.data?.source === "unavailable") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">Azure Not Detected</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Firewall management requires Azure deployment with managed identity.
          </p>
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">No Resources Found</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure your PostgreSQL server, Redis, or Key Vault in the Configuration tab first.
          </p>
        </div>
      </div>
    );
  }

  const rules: FirewallRule[] = rulesQuery.data?.rules || [];
  const ResourceIcon = activeResource ? RESOURCE_ICONS[activeResource.type] : Shield;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => rulesQuery.refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3 w-3", isFetching && "animate-spin")}
            />
            Refresh
          </button>
          <span className="text-xs text-muted-foreground">
            {rules.length} rule{rules.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!activeResource}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Rule
        </Button>
      </div>

      {/* Resource selector */}
      {resources.length > 1 ? (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md border border-border bg-card hover:bg-muted/30 transition-colors"
          >
            <ResourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground font-medium flex-1 text-left">
              {activeResource?.label}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
          </button>
          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
              {resources.map((r) => {
                const Icon = RESOURCE_ICONS[r.type];
                const isSelected = activeResource?.type === r.type && activeResource?.name === r.name;
                return (
                  <button
                    key={`${r.type}-${r.name}`}
                    onClick={() => {
                      setSelectedResource(r);
                      setDropdownOpen(false);
                      setConfirmDelete(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/30 transition-colors first:rounded-t-md last:rounded-b-md",
                      isSelected && "bg-muted/20 text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={isSelected ? "font-medium" : ""}>{r.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ResourceIcon className="h-3.5 w-3.5" />
          <span>{activeResource?.label}</span>
        </div>
      )}

      {/* Loading state for rules */}
      {rulesQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : rulesQuery.data?.source === "not_configured" ? (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">Not Configured</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rulesQuery.data.message || "Configure this resource in the Configuration tab first."}
            </p>
          </div>
        </div>
      ) : rules.length === 0 ? (
        isContainerApp ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/15 flex-shrink-0">
              <Cloud className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-green-400">Open to All Traffic</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-400">
                  0.0.0.0/0
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                No IP restrictions configured — accessible from any IP address. Add rules to lock down access.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No firewall rules found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isKeyvault
                  ? "Add IP rules to restrict access to this Key Vault"
                  : "Add rules to whitelist IP addresses for access"}
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isSingleIp = rule.startIpAddress === rule.endIpAddress;
            const isDeleting = deletingRule === rule.name;
            const isConfirming = confirmDelete === rule.name;

            return (
              <div
                key={`${rule.name}-${rule.startIpAddress}`}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {isKeyvault ? rule.cidr || rule.startIpAddress : rule.name}
                  </span>
                  {isContainerApp ? (
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {rule.cidr || rule.startIpAddress}
                    </div>
                  ) : !isKeyvault ? (
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {isSingleIp
                        ? rule.startIpAddress
                        : `${rule.startIpAddress} — ${rule.endIpAddress}`}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isContainerApp && rule.action && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      rule.action === "Allow"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    )}>
                      {rule.action}
                    </span>
                  )}
                  {!isKeyvault && !isContainerApp && isSingleIp && (
                    <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                      Single IP
                    </span>
                  )}
                  {isKeyvault && rule.cidr?.endsWith("/32") && (
                    <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                      /32
                    </span>
                  )}
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(rule)}
                        disabled={isDeleting}
                        className="h-7 text-xs"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Confirm"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDelete(null)}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      {(!isKeyvault) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditRule(rule)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(rule.name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete error */}
      {deleteMutation.error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {deleteMutation.error.message}
        </div>
      )}

      {activeResource && (
        <>
          <CreateFirewallRuleDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            resourceType={activeResource.type}
            resourceName={activeResource.name}
            resourceLabel={activeResource.label}
          />
          <EditFirewallRuleDialog
            open={!!editRule}
            onOpenChange={(open) => !open && setEditRule(null)}
            rule={editRule}
            resourceType={activeResource.type}
            resourceName={activeResource.name}
          />
        </>
      )}
    </div>
  );
}
