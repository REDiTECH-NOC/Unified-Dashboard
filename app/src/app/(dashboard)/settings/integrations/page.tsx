"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SsoCard } from "./_components/sso-card";
import { SsoDialog } from "./_components/sso-dialog";
import { IntegrationCategory } from "./_components/integration-category";
import { ConfigureDialog } from "./_components/configure-dialog";
import { SSO_TOOL_ID, THREECX_TOOL_ID, AI_TOOL_ID } from "./_components/tool-schemas";

export default function IntegrationsPage() {
  const { data: integrations, isLoading, refetch } = trpc.integration.list.useQuery();
  const { data: ssoConfig, refetch: refetchSso } = trpc.integration.getSsoConfig.useQuery();

  const router = useRouter();
  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [configToolId, setConfigToolId] = useState<string | null>(null);

  function handleConfigure(toolId: string) {
    if (toolId === "connectwise") {
      router.push("/settings/integrations/connectwise");
      return;
    }
    if (toolId === "cove") {
      router.push("/settings/integrations/cove");
      return;
    }
    if (toolId === "ninjaone") {
      router.push("/settings/integrations/ninjaone");
      return;
    }
    if (toolId === "sentinelone") {
      router.push("/settings/integrations/sentinelone");
      return;
    }
    if (toolId === "pax8") {
      router.push("/settings/integrations/pax8");
      return;
    }
    if (toolId === "dropsuite") {
      router.push("/settings/integrations/dropsuite");
      return;
    }
    if (toolId === "dnsfilter") {
      router.push("/settings/integrations/dnsfilter");
      return;
    }
    if (toolId === AI_TOOL_ID) {
      router.push("/settings/integrations/ai");
      return;
    }
    if (toolId === THREECX_TOOL_ID) {
      // TODO: Re-enable ThreecxDialog when threecx router is available
      return;
    }
    setConfigToolId(toolId);
  }

  // Group integrations by category, excluding entra-id (handled separately)
  const grouped = integrations
    ?.filter((t) => t.toolId !== SSO_TOOL_ID)
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

      <SsoCard ssoConfig={ssoConfig} onConfigure={() => setSsoDialogOpen(true)} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading integrations...</p>
      ) : (
        Object.entries(grouped || {}).map(([category, tools]) => (
          <IntegrationCategory
            key={category}
            category={category}
            tools={tools!}
            onConfigure={handleConfigure}
          />
        ))
      )}

      <SsoDialog
        open={ssoDialogOpen}
        onClose={() => setSsoDialogOpen(false)}
        ssoConfig={ssoConfig}
        onSaved={() => refetchSso()}
      />

      <ConfigureDialog
        toolId={configToolId}
        onClose={() => setConfigToolId(null)}
        onSaved={() => {
          setConfigToolId(null);
          refetch();
        }}
      />
    </div>
  );
}
