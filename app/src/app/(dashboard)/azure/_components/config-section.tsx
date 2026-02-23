"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, Save, TestTube } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function ConfigSection() {
  const utils = trpc.useUtils();
  const { data: config, isLoading } = trpc.infrastructure.getConfig.useQuery();

  const [pgServerName, setPgServerName] = useState("");
  const [pgAdminPassword, setPgAdminPassword] = useState("");
  const [keyVaultName, setKeyVaultName] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setPgServerName(config.pgServerName || "");
      setKeyVaultName(config.keyVaultName || "");
      // Don't populate password — it's masked
    }
  }, [config]);

  const saveMutation = trpc.infrastructure.saveConfig.useMutation({
    onSuccess: () => {
      utils.infrastructure.getConfig.invalidate();
      setPgAdminPassword("");
      setDirty(false);
    },
  });

  const testMutation = trpc.infrastructure.testConnection.useMutation();

  function handleSave() {
    const input: { pgServerName?: string; pgAdminPassword?: string; keyVaultName?: string } = {};
    if (pgServerName) input.pgServerName = pgServerName;
    if (pgAdminPassword) input.pgAdminPassword = pgAdminPassword;
    if (keyVaultName) input.keyVaultName = keyVaultName;
    saveMutation.mutate(input);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* PostgreSQL Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PostgreSQL Flexible Server</CardTitle>
          <CardDescription>
            Configure the Azure PostgreSQL Flexible Server for database management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Server Name
              </label>
              <Input
                placeholder="rcc-postgres"
                value={pgServerName}
                onChange={(e) => {
                  setPgServerName(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Just the server name, not the full FQDN
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Admin Password {config?.pgAdminPassword && "(currently set)"}
              </label>
              <Input
                type="password"
                placeholder={config?.pgAdminPassword ? "••••••••" : "Enter admin password"}
                value={pgAdminPassword}
                onChange={(e) => {
                  setPgAdminPassword(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Password for the rccadmin user
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Vault Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Azure Key Vault</CardTitle>
          <CardDescription>
            Used to securely store and retrieve database credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Vault Name
            </label>
            <Input
              placeholder="rcc-vault-prod"
              value={keyVaultName}
              onChange={(e) => {
                setKeyVaultName(e.target.value);
                setDirty(true);
              }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Just the vault name, not the full URL
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
        <Button
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TestTube className="h-4 w-4 mr-2" />
          )}
          Test Connection
        </Button>
      </div>

      {/* Save success */}
      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Configuration saved successfully
        </div>
      )}

      {/* Save error */}
      {saveMutation.error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {saveMutation.error.message}
        </div>
      )}

      {/* Test results */}
      {testMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connection Test Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(testMutation.data).map(([service, status]) => (
              <div
                key={service}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <span className="text-sm font-medium capitalize">
                  {service === "pg" ? "PostgreSQL" : "Key Vault"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                    status === "connected"
                      ? "text-green-500 bg-green-500/10"
                      : status === "not_configured"
                        ? "text-muted-foreground bg-muted/20"
                        : status === "requires_azure"
                          ? "text-amber-400 bg-amber-400/10"
                          : "text-red-400 bg-red-500/10"
                  )}
                >
                  {status === "connected" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {status === "connected"
                    ? "Connected"
                    : status === "not_configured"
                      ? "Not Configured"
                      : status === "requires_azure"
                        ? "Requires Azure"
                        : status.replace("error: ", "")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Azure RBAC Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Azure RBAC Requirements</CardTitle>
          <CardDescription>
            The Container App&apos;s managed identity needs these role assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p><span className="text-foreground font-medium">Reader</span> — Resource group (for resource health)</p>
            <p><span className="text-foreground font-medium">Contributor</span> — PostgreSQL Flexible Server (database + firewall CRUD)</p>
            <p><span className="text-foreground font-medium">Key Vault Secrets Officer</span> — Key Vault (read/write secrets)</p>
            <p><span className="text-foreground font-medium">Cost Management Reader</span> — Subscription (for cost data)</p>
            <p><span className="text-foreground font-medium">Monitoring Reader</span> — Subscription (for activity log + alerts)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
