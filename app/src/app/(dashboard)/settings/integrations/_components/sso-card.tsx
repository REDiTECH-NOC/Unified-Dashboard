"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, Settings, AlertTriangle, Check, Info } from "lucide-react";

interface SsoConfig {
  status: string;
  clientId: string;
  tenantId: string;
  adminGroupId: string;
  userGroupId: string;
  hasSecret: boolean;
  source: string;
}

interface SsoCardProps {
  ssoConfig: SsoConfig | undefined;
  onConfigure: () => void;
}

export function SsoCard({ ssoConfig, onConfigure }: SsoCardProps) {
  return (
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
            <Button variant="outline" size="sm" onClick={onConfigure}>
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
  );
}
