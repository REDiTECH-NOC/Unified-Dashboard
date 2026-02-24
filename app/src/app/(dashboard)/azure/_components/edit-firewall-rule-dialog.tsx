"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ResourceType = "postgresql" | "redis" | "keyvault" | "containerapp";

interface EditFirewallRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: { name: string; startIpAddress: string; endIpAddress: string; cidr?: string; action?: string } | null;
  resourceType: ResourceType;
  resourceName: string;
}

export function EditFirewallRuleDialog({
  open,
  onOpenChange,
  rule,
  resourceType,
  resourceName,
}: EditFirewallRuleDialogProps) {
  const utils = trpc.useUtils();
  const [startIp, setStartIp] = useState("");
  const [endIp, setEndIp] = useState("");
  const [singleIp, setSingleIp] = useState(true);
  const [action, setAction] = useState<"Allow" | "Deny">("Allow");
  const isContainerApp = resourceType === "containerapp";

  useEffect(() => {
    if (rule) {
      setStartIp(rule.startIpAddress);
      setEndIp(rule.endIpAddress);
      setSingleIp(rule.startIpAddress === rule.endIpAddress);
      if (rule.action) setAction(rule.action as "Allow" | "Deny");
    }
  }, [rule]);

  const updateMutation = trpc.infrastructure.updateFirewallRule.useMutation({
    onSuccess: () => {
      utils.infrastructure.listFirewallRules.invalidate();
      handleClose();
    },
  });

  function handleClose() {
    updateMutation.reset();
    onOpenChange(false);
  }

  function handleSave() {
    if (!rule) return;
    updateMutation.mutate({
      resourceType,
      resourceName,
      ruleName: rule.name,
      startIpAddress: startIp.trim(),
      endIpAddress: singleIp ? startIp.trim() : endIp.trim(),
      ...(rule.cidr ? { oldCidr: rule.cidr } : {}),
      ...(isContainerApp ? { action } : {}),
    });
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isValidStartIp = ipRegex.test(startIp.trim());
  const isValidEndIp = singleIp || ipRegex.test(endIp.trim());
  const canSubmit = isValidStartIp && isValidEndIp;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Firewall Rule</DialogTitle>
          <DialogDescription>
            Update IP address for{" "}
            <span className="font-mono font-medium">{rule?.name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action selector — Container Apps only */}
          {isContainerApp && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Action
              </label>
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                {(["Allow", "Deny"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAction(a)}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors",
                      action === a
                        ? a === "Allow"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Range toggle — not for Container Apps */}
          {!isContainerApp && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-single-ip"
                checked={singleIp}
                onChange={(e) => {
                  setSingleIp(e.target.checked);
                  if (e.target.checked) setEndIp(startIp);
                }}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <label
                htmlFor="edit-single-ip"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Single IP address
              </label>
            </div>
          )}

          {singleIp ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                IP Address
              </label>
              <Input
                placeholder="203.0.113.50"
                value={startIp}
                onChange={(e) => setStartIp(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Start IP
                </label>
                <Input
                  placeholder="203.0.113.0"
                  value={startIp}
                  onChange={(e) => setStartIp(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  End IP
                </label>
                <Input
                  placeholder="203.0.113.255"
                  value={endIp}
                  onChange={(e) => setEndIp(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>
            </div>
          )}

          {updateMutation.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {updateMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSubmit || updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
