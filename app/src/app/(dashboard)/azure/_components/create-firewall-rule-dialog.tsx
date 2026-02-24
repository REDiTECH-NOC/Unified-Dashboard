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
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ResourceType = "postgresql" | "redis" | "keyvault" | "containerapp";

interface CreateFirewallRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ResourceType;
  resourceName: string;
  resourceLabel: string;
}

type Mode = "single" | "range" | "multi";

export function CreateFirewallRuleDialog({
  open,
  onOpenChange,
  resourceType,
  resourceName,
  resourceLabel,
}: CreateFirewallRuleDialogProps) {
  const utils = trpc.useUtils();
  const [ruleName, setRuleName] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [ipAddress, setIpAddress] = useState("");
  const [endIp, setEndIp] = useState("");
  const [multiIps, setMultiIps] = useState("");
  const [batchResults, setBatchResults] = useState<
    Array<{ ruleName: string; ip: string; success: boolean; error?: string }> | null
  >(null);
  const [action, setAction] = useState<"Allow" | "Deny">("Allow");

  const isKeyvault = resourceType === "keyvault";
  const isContainerApp = resourceType === "containerapp";

  const createMutation = trpc.infrastructure.createFirewallRule.useMutation({
    onSuccess: () => {
      utils.infrastructure.listFirewallRules.invalidate();
      handleClose();
    },
  });

  const batchMutation = trpc.infrastructure.createFirewallRuleBatch.useMutation({
    onSuccess: (data) => {
      utils.infrastructure.listFirewallRules.invalidate();
      setBatchResults(data.results);
    },
  });

  const isPending = createMutation.isPending || batchMutation.isPending;

  function handleClose() {
    setRuleName("");
    setIpAddress("");
    setEndIp("");
    setMultiIps("");
    setMode("single");
    setAction("Allow");
    setBatchResults(null);
    createMutation.reset();
    batchMutation.reset();
    onOpenChange(false);
  }

  function handleCreate() {
    if (mode === "multi" && !isKeyvault && !isContainerApp) {
      const ips = parseMultiIps();
      if (ips.length === 0) return;
      batchMutation.mutate({
        resourceType: resourceType as "postgresql" | "redis",
        resourceName,
        rulePrefix: ruleName.trim(),
        ipAddresses: ips,
      });
    } else {
      const ip = ipAddress.trim() === "0.0.0.0" ? "0.0.0.0" : ipAddress.trim();
      createMutation.mutate({
        resourceType,
        resourceName,
        ruleName: isKeyvault ? `kv-rule` : ruleName.trim(),
        startIpAddress: ip,
        endIpAddress: mode === "single" ? ip : endIp.trim(),
        ...(isContainerApp ? { action } : {}),
      });
    }
  }

  function parseMultiIps(): string[] {
    return multiIps
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => ipRegex.test(s));
  }

  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const isValidName = isKeyvault || (/^[a-zA-Z0-9_-]+$/.test(ruleName.trim()) && ruleName.trim().length > 0);

  let canSubmit = false;
  if (mode === "single") {
    canSubmit = isValidName && ipRegex.test(ipAddress.trim());
  } else if (mode === "range") {
    canSubmit =
      isValidName && ipRegex.test(ipAddress.trim()) && ipRegex.test(endIp.trim());
  } else {
    const validIps = parseMultiIps();
    canSubmit = isValidName && validIps.length > 0;
  }

  const mutationError = createMutation.error || batchMutation.error;

  // Key Vault and Container Apps use single IP (CIDR) — no ranges/batch
  const availableModes: Array<{ key: Mode; label: string }> = (isKeyvault || isContainerApp)
    ? [{ key: "single", label: "Single IP" }]
    : [
        { key: "single", label: "Single IP" },
        { key: "range", label: "IP Range" },
        { key: "multi", label: "Multiple IPs" },
      ];

  // Batch results view
  if (batchResults) {
    const succeeded = batchResults.filter((r) => r.success);
    const failed = batchResults.filter((r) => !r.success);
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Results</DialogTitle>
            <DialogDescription>
              {succeeded.length} of {batchResults.length} rules created
              successfully
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {batchResults.map((r) => (
              <div
                key={r.ruleName}
                className={cn(
                  "flex items-center justify-between p-2 rounded text-xs border",
                  r.success
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-red-500/20 bg-red-500/5"
                )}
              >
                <div>
                  <span className="font-mono text-foreground">{r.ruleName}</span>
                  <span className="text-muted-foreground ml-2">{r.ip}</span>
                </div>
                {r.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <span className="text-red-400 text-[10px]">{r.error}</span>
                )}
              </div>
            ))}
          </div>
          {failed.length > 0 && (
            <p className="text-xs text-red-400">
              {failed.length} rule{failed.length > 1 ? "s" : ""} failed to
              create
            </p>
          )}
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Firewall Rule</DialogTitle>
          <DialogDescription>
            {isKeyvault
              ? `Add an IP rule to restrict access to ${resourceLabel}`
              : isContainerApp
                ? `Add an IP restriction to ${resourceLabel}. Use 0.0.0.0 to allow all traffic.`
                : `Whitelist IP addresses for ${resourceLabel}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rule name — not needed for Key Vault */}
          {!isKeyvault && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Rule Name
              </label>
              <Input
                placeholder={isContainerApp ? "allow-office" : "ClientName-3CX"}
                value={ruleName}
                onChange={(e) =>
                  setRuleName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
                }
                disabled={isPending}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Letters, numbers, hyphens, and underscores only
                {mode === "multi" && " (used as prefix)"}
              </p>
            </div>
          )}

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
              <p className="text-[10px] text-muted-foreground mt-1">
                Adding any Allow rule restricts traffic to only allowed IPs. Use 0.0.0.0 to allow all.
              </p>
            </div>
          )}

          {/* Mode selector — only show if multiple modes available */}
          {availableModes.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {availableModes.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className={cn(
                    "flex-1 px-2 py-1.5 text-xs font-medium rounded transition-colors",
                    mode === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {mode === "single" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                IP Address
              </label>
              <Input
                placeholder={isContainerApp ? "0.0.0.0 (all) or 203.0.113.50" : "203.0.113.50"}
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                disabled={isPending}
              />
              {isKeyvault && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Will be stored as CIDR notation (x.x.x.x/32)
                </p>
              )}
              {isContainerApp && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Stored as CIDR — 0.0.0.0 becomes 0.0.0.0/0 (allow all), specific IPs become x.x.x.x/32
                </p>
              )}
            </div>
          )}

          {mode === "range" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Start IP
                </label>
                <Input
                  placeholder="203.0.113.0"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  disabled={isPending}
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
                  disabled={isPending}
                />
              </div>
            </div>
          )}

          {mode === "multi" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                IP Addresses (one per line or comma-separated)
              </label>
              <textarea
                className="w-full h-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder={"203.0.113.50\n203.0.113.51\n10.0.1.100"}
                value={multiIps}
                onChange={(e) => setMultiIps(e.target.value)}
                disabled={isPending}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {parseMultiIps().length} valid IP
                {parseMultiIps().length !== 1 ? "s" : ""} detected — each gets a
                rule named {ruleName || "prefix"}-1, {ruleName || "prefix"}-2, etc.
              </p>
            </div>
          )}

          {mutationError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {mutationError.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "multi"
              ? `Add ${parseMultiIps().length} Rule${parseMultiIps().length !== 1 ? "s" : ""}`
              : "Add Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
