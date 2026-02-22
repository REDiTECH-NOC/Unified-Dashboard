"use client";

import { useState, useEffect } from "react";
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
import { AlertTriangle } from "lucide-react";

interface SsoConfig {
  status: string;
  clientId: string;
  tenantId: string;
  adminGroupId: string;
  userGroupId: string;
  hasSecret: boolean;
  source: string;
}

interface SsoDialogProps {
  open: boolean;
  onClose: () => void;
  ssoConfig: SsoConfig | undefined;
  onSaved: () => void;
}

export function SsoDialog({ open, onClose, ssoConfig, onSaved }: SsoDialogProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [adminGroupId, setAdminGroupId] = useState("");
  const [userGroupId, setUserGroupId] = useState("");

  const saveSso = trpc.integration.saveSsoConfig.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  useEffect(() => {
    if (open && ssoConfig) {
      setClientId(ssoConfig.clientId);
      setClientSecret("");
      setTenantId(ssoConfig.tenantId);
      setAdminGroupId(ssoConfig.adminGroupId);
      setUserGroupId(ssoConfig.userGroupId);
    }
  }, [open, ssoConfig]);

  function handleSave() {
    saveSso.mutate({
      clientId,
      clientSecret,
      tenantId,
      adminGroupId,
      userGroupId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClose={onClose} className="max-w-lg">
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
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Client ID (Application ID)
            </label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
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
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={ssoConfig?.hasSecret ? "Leave blank to keep existing" : "Enter client secret"}
              className="font-mono text-sm"
            />
            {ssoConfig?.hasSecret && !clientSecret && (
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
                value={adminGroupId}
                onChange={(e) => setAdminGroupId(e.target.value)}
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
                value={userGroupId}
                onChange={(e) => setUserGroupId(e.target.value)}
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
          <Button variant="outline" onClick={onClose} disabled={saveSso.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!clientId || !tenantId || (!clientSecret && !ssoConfig?.hasSecret) || !adminGroupId || !userGroupId || saveSso.isPending}
          >
            {saveSso.isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
