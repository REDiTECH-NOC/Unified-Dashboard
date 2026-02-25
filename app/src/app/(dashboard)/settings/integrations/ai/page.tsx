"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProviderConfigCard } from "./_components/provider-config-card";
import { ModelAssignmentsCard } from "./_components/model-assignments-card";
import { BudgetConfigCard } from "./_components/budget-config-card";
import { UsageSummaryCard } from "./_components/usage-summary-card";

export default function AiSettingsPage() {
  const { data: providerConfig, refetch: refetchProvider } =
    trpc.ai.getProviderConfig.useQuery();

  const providerStatus = providerConfig
    ? "configured"
    : "not_configured";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/integrations">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold">AI Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Configure AI provider, model assignments, and usage limits
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            providerStatus === "configured"
              ? "border-green-500/50 text-green-400"
              : "border-yellow-500/50 text-yellow-400"
          }
        >
          {providerStatus === "configured"
            ? `${providerConfig?.providerType.replace("_", " ")}`
            : "Not Configured"}
        </Badge>
      </div>

      {/* Provider Configuration */}
      <ProviderConfigCard
        config={providerConfig}
        onSaved={refetchProvider}
      />

      {/* Model Assignments */}
      <ModelAssignmentsCard
        providerConfig={providerConfig}
      />

      {/* Budget & Rate Limits */}
      <BudgetConfigCard />

      {/* Usage Summary */}
      <UsageSummaryCard />
    </div>
  );
}
