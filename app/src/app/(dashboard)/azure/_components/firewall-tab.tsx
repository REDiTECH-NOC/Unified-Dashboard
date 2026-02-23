"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Plus, Trash2, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateFirewallRuleDialog } from "./create-firewall-rule-dialog";

export function FirewallTab() {
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = trpc.infrastructure.listFirewallRules.useQuery(
    undefined,
    { staleTime: 30_000 }
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

  function handleDelete(ruleName: string) {
    setDeletingRule(ruleName);
    deleteMutation.mutate({ ruleName });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data?.source === "unavailable" || data?.source === "not_configured") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">
            {data.source === "unavailable" ? "Azure Not Detected" : "Not Configured"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.message || "Configure your PostgreSQL server in the Configuration tab first."}
          </p>
        </div>
      </div>
    );
  }

  const rules = data?.rules || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Refresh
          </button>
          <span className="text-xs text-muted-foreground">
            {rules.length} rule{rules.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Rule
        </Button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No firewall rules found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add rules to whitelist IP addresses for database access
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isSingleIp = rule.startIpAddress === rule.endIpAddress;
            const isDeleting = deletingRule === rule.name;
            const isConfirming = confirmDelete === rule.name;

            return (
              <div
                key={rule.name}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{rule.name}</span>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {isSingleIp ? rule.startIpAddress : `${rule.startIpAddress} — ${rule.endIpAddress}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isSingleIp && (
                    <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                      Single IP
                    </span>
                  )}
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(rule.name)}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(rule.name)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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

      <CreateFirewallRuleDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
