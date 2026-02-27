"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ToolConnectionCard } from "../_components/tool-connection-card";
import { ToolCustomerMapping } from "../_components/tool-customer-mapping";

export default function Pax8SettingsPage() {
  const {
    data: companies,
    isLoading,
    isError,
  } = trpc.licensing.getCompanies.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const externalOrgs = companies?.map((c) => ({
    id: c.sourceId,
    name: c.name,
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
          <h2 className="text-2xl font-bold">Pax8</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map Pax8 companies to clients
          </p>
        </div>
      </div>

      <ToolConnectionCard toolId="pax8" displayName="Pax8" />
      <ToolCustomerMapping
        toolId="pax8"
        displayName="Pax8"
        entityLabel="Companies"
        externalOrgs={externalOrgs}
        isLoading={isLoading}
        isError={isError}
      />
    </div>
  );
}
