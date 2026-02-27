"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ToolConnectionCard } from "../_components/tool-connection-card";
import { ToolCustomerMapping } from "../_components/tool-customer-mapping";

export default function SentinelOneSettingsPage() {
  const {
    data: sites,
    isLoading,
    isError,
  } = trpc.edr.getSites.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const externalOrgs = sites?.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">SentinelOne</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map SentinelOne sites to clients
          </p>
        </div>
      </div>

      <ToolConnectionCard toolId="sentinelone" displayName="SentinelOne" />
      <ToolCustomerMapping
        toolId="sentinelone"
        displayName="SentinelOne"
        entityLabel="Sites"
        externalOrgs={externalOrgs}
        isLoading={isLoading}
        isError={isError}
      />
    </div>
  );
}
