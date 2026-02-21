"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Shield, Monitor, Mail, Key, HardDrive, Wifi, Phone, Package, FileText,
  Settings, AlertTriangle, Check, Info,
} from "lucide-react";

const categoryIcons: Record<string, typeof Shield> = {
  security: Shield,
  rmm: Monitor,
  psa: FileText,
  identity: Key,
  documentation: FileText,
  backup: HardDrive,
  network: Wifi,
  phone: Phone,
  licensing: Package,
};

const categoryLabels: Record<string, string> = {
  rmm: "Remote Monitoring",
  psa: "Ticketing / PSA",
  security: "Security",
  identity: "Identity & Access",
  documentation: "Documentation",
  backup: "Backup",
  network: "Network",
  phone: "Phone",
  licensing: "Licensing",
};

export default function IntegrationsPage() {
  const { data: integrations, isLoading } = trpc.integration.list.useQuery();
  const { data: ssoConfig, refetch: refetchSso } = trpc.integration.getSsoConfig.useQuery();

  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [ssoClientId, setSsoClientId] = useState("");
  const [ssoClientSecret, setSsoClientSecret] = useState("");
  const [ssoTenantId, setSsoTenantId] = useState("");
  const [ssoAdminGroupId, setSsoAdminGroupId] = useState("");
  const [ssoUserGroupId, setSsoUserGroupId] = useState("");

  const saveSso = trpc.integration.saveSsoConfig.useMutation({
    onSuccess: () => {
      refetchSso();
      setSsoDialogOpen(false);
    },
  });

  function openSsoConfig() {
    if (ssoConfig) {
      setSsoClientId(ssoConfig.clientId);
      setSsoClientSecret("");  // Never pre-fill secrets
      setSsoTenantId(ssoConfig.tenantId);
      setSsoAdminGroupId(ssoConfig.adminGroupId);
      setSsoUserGroupId(ssoConfig.userGroupId);
    }
    setSsoDialogOpen(true);
  }

  function handleSaveSso() {
    saveSso.mutate({
      clientId: ssoClientId,
      clientSecret: ssoClientSecret,
      tenantId: ssoTenantId,
      adminGroupId: ssoAdminGroupId,
      userGroupId: ssoUserGroupId,
    });
  }

  // Group integrations by category, but exclude entra-id (handled separately)
  const grouped = integrations
    ?.filter((t) => t.toolId !== "entra-id")
    .reduce(
      (acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
      },
      {} as Record<string, typeof integrations>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Integrations</h2>
          <p className="text-sm text-muted-foreground">
            Manage API connections for all tools
          </p>
        </div>
        {integrations && (
          <Badge variant="outline" className="text-sm">
            {integrations.filter((t) => t.status === "connected").length} / {integrations.length} connected
          </Badge>
        )}
      </div>

      {/* Microsoft Entra ID SSO — dedicated card */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Key className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Microsoft Entra ID (SSO)</CardTitle>
                <CardDescription>
                  Single sign-on for your team via Microsoft 365
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ssoConfig?.status === "connected" ? (
                <Badge variant="success" className="gap-1">
                  <Check className="h-3 w-3" />
                  Configured
                </Badge>
              ) : ssoConfig?.source === "environment" ? (
                <Badge variant="secondary" className="gap-1">
                  <Info className="h-3 w-3" />
                  From Environment
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Not Configured
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={openSsoConfig}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Configure
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ssoConfig && (ssoConfig.clientId || ssoConfig.source === "environment") ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Tenant ID</p>
                <p className="font-mono mt-0.5 truncate">{ssoConfig.tenantId || "—"}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Client ID</p>
                <p className="font-mono mt-0.5 truncate">{ssoConfig.clientId || "—"}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Client Secret</p>
                <p className="font-mono mt-0.5">{ssoConfig.hasSecret ? "••••••••" : "Not set"}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Admin Group ID</p>
                <p className="font-mono mt-0.5 truncate">{ssoConfig.adminGroupId || "—"}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">User Group ID</p>
                <p className="font-mono mt-0.5 truncate">{ssoConfig.userGroupId || "—"}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground">Config Source</p>
                <p className="font-mono mt-0.5 capitalize">{ssoConfig.source}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              <p>SSO is not configured. Click Configure to set up Microsoft Entra ID.</p>
              <p className="text-xs mt-1">Users will only be able to sign in with local accounts until SSO is configured.</p>
            </div>
          )}
          {ssoConfig?.source === "database" && (
            <p className="text-[10px] text-amber-400 mt-3 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Changes to SSO configuration require a container restart to take effect.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Other integrations */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading integrations...</p>
      ) : (
        Object.entries(grouped || {}).map(([category, tools]) => {
          const Icon = categoryIcons[category] || Shield;
          return (
            <div key={category} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Icon className="h-4 w-4" />
                {categoryLabels[category] || category}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools!.map((tool) => (
                  <Card key={tool.toolId} className="relative">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            "h-2 w-2 rounded-full " +
                            (tool.status === "connected"
                              ? "bg-success"
                              : tool.status === "error"
                              ? "bg-destructive"
                              : tool.status === "degraded"
                              ? "bg-warning"
                              : "bg-muted-foreground/30")
                          }
                        />
                        <div>
                          <p className="text-sm font-medium">{tool.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {tool.status === "unconfigured"
                              ? "Not configured"
                              : tool.status.charAt(0).toUpperCase() + tool.status.slice(1)}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* SSO Configuration Dialog */}
      <Dialog open={ssoDialogOpen} onOpenChange={setSsoDialogOpen}>
        <DialogContent onClose={() => setSsoDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Microsoft Entra ID SSO</DialogTitle>
            <DialogDescription>
              Enter your Azure AD / Entra ID application credentials. These are used for single sign-on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Setup instructions */}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-2.5">
              <p className="font-medium text-foreground">Setup Instructions:</p>

              <div>
                <p className="font-medium text-foreground/80 mb-1">1. App Registration</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Go to <span className="font-mono text-[11px]">portal.azure.com</span> → Entra ID → App registrations</li>
                  <li>Create a new registration (or use existing)</li>
                  <li>Set redirect URI (Web): <span className="font-mono text-[11px]">https://your-domain/api/auth/callback/microsoft-entra-id</span></li>
                  <li>Copy the Application (client) ID and Directory (tenant) ID</li>
                  <li>Under Certificates & secrets → New client secret (copy the value)</li>
                </ol>
              </div>

              <div>
                <p className="font-medium text-foreground/80 mb-1">2. API Permissions (Microsoft Graph)</p>
                <p className="ml-2 mb-0.5">Add these permissions and grant admin consent:</p>
                <div className="ml-2 space-y-0.5">
                  <p><span className="font-mono text-[11px] text-foreground/70">User.Read</span> — Delegated — Sign-in and read user profile</p>
                  <p><span className="font-mono text-[11px] text-foreground/70">GroupMember.Read.All</span> — Application — Read group memberships (for role assignment)</p>
                  <p><span className="font-mono text-[11px] text-foreground/70">Mail.Send</span> — Application — Send email notifications and reports via 365</p>
                </div>
                <p className="ml-2 mt-1 text-amber-400/80">Grant admin consent for all permissions after adding them.</p>
              </div>

              <div>
                <p className="font-medium text-foreground/80 mb-1">3. Security Groups</p>
                <ol className="list-decimal list-inside space-y-0.5 ml-2">
                  <li>Go to Entra ID → Groups → New group (Security type)</li>
                  <li>Create <span className="font-mono text-[11px]">RCC-Admins</span> — add admin users as members</li>
                  <li>Create <span className="font-mono text-[11px]">RCC-Users</span> — add all technician users as members</li>
                  <li>Copy the Object ID of each group into the fields below</li>
                </ol>
                <p className="ml-2 mt-1">Users in RCC-Admins get the Admin role. Users in RCC-Users get the User role. Users are auto-provisioned on first SSO login.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Tenant ID (Directory ID)
              </label>
              <Input
                value={ssoTenantId}
                onChange={(e) => setSsoTenantId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Client ID (Application ID)
              </label>
              <Input
                value={ssoClientId}
                onChange={(e) => setSsoClientId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Client Secret
              </label>
              <Input
                type="password"
                value={ssoClientSecret}
                onChange={(e) => setSsoClientSecret(e.target.value)}
                placeholder={ssoConfig?.hasSecret ? "Leave blank to keep existing" : "Enter client secret"}
                className="font-mono text-sm"
              />
              {ssoConfig?.hasSecret && !ssoClientSecret && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  A secret is already stored. Leave blank to keep the existing secret.
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Admin Group ID (Object ID)
                </label>
                <Input
                  value={ssoAdminGroupId}
                  onChange={(e) => setSsoAdminGroupId(e.target.value)}
                  placeholder="Group Object ID"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">RCC-Admins security group</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  User Group ID (Object ID)
                </label>
                <Input
                  value={ssoUserGroupId}
                  onChange={(e) => setSsoUserGroupId(e.target.value)}
                  placeholder="Group Object ID"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">RCC-Users security group</p>
              </div>
            </div>
          </div>

          {saveSso.error && (
            <p className="text-sm text-red-400">{saveSso.error.message}</p>
          )}

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>SSO configuration changes take effect after a container restart. Existing sessions are not affected.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSsoDialogOpen(false)} disabled={saveSso.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSso}
              disabled={!ssoClientId || !ssoTenantId || (!ssoClientSecret && !ssoConfig?.hasSecret) || !ssoAdminGroupId || !ssoUserGroupId || saveSso.isPending}
            >
              {saveSso.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
