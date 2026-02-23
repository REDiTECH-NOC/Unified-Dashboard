"use client";

import { useState } from "react";
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
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CreateFirewallRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFirewallRuleDialog({
  open,
  onOpenChange,
}: CreateFirewallRuleDialogProps) {
  const utils = trpc.useUtils();
  const [ruleName, setRuleName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [singleIp, setSingleIp] = useState(true);
  const [endIp, setEndIp] = useState("");

  const createMutation = trpc.infrastructure.createFirewallRule.useMutation({
    onSuccess: () => {
      utils.infrastructure.listFirewallRules.invalidate();
      handleClose();
    },
  });

  function handleClose() {
    setRuleName("");
    setIpAddress("");
    setEndIp("");
    setSingleIp(true);
    createMutation.reset();
    onOpenChange(false);
  }

  function handleCreate() {
    createMutation.mutate({
      ruleName: ruleName.trim(),
      startIpAddress: ipAddress.trim(),
      endIpAddress: singleIp ? ipAddress.trim() : endIp.trim(),
    });
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isValidIp = ipRegex.test(ipAddress.trim());
  const isValidEndIp = singleIp || ipRegex.test(endIp.trim());
  const isValidName = /^[a-zA-Z0-9_-]+$/.test(ruleName.trim()) && ruleName.trim().length > 0;
  const canSubmit = isValidName && isValidIp && isValidEndIp;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Firewall Rule</DialogTitle>
          <DialogDescription>
            Whitelist an IP address to allow access to the PostgreSQL server
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Rule Name
            </label>
            <Input
              placeholder="ClientName-3CX"
              value={ruleName}
              onChange={(e) =>
                setRuleName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }
              disabled={createMutation.isPending}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Letters, numbers, hyphens, and underscores only
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="single-ip"
              checked={singleIp}
              onChange={(e) => setSingleIp(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            <label htmlFor="single-ip" className="text-xs text-muted-foreground cursor-pointer">
              Single IP address
            </label>
          </div>

          {singleIp ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                IP Address
              </label>
              <Input
                placeholder="203.0.113.50"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                disabled={createMutation.isPending}
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
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  disabled={createMutation.isPending}
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
                  disabled={createMutation.isPending}
                />
              </div>
            </div>
          )}

          {createMutation.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {createMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Add Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
