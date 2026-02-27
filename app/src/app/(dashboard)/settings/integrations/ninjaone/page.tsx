"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ToolConnectionCard } from "../_components/tool-connection-card";
import { ToolCustomerMapping } from "../_components/tool-customer-mapping";

export default function NinjaOneSettingsPage() {
  const {
    data: orgs,
    isLoading,
    isError,
  } = trpc.rmm.getOrganizations.useQuery(
    { searchTerm: undefined },
    { retry: false, staleTime: 5 * 60 * 1000 }
  );

  const externalOrgs = orgs?.map((o) => ({
    id: o.sourceId,
    name: o.name,
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
          <h2 className="text-2xl font-bold">NinjaOne RMM</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection and map NinjaOne organizations to clients
          </p>
        </div>
      </div>

      <ToolConnectionCard toolId="ninjaone" displayName="NinjaOne" />
      <ToolCustomerMapping
        toolId="ninjaone"
        displayName="NinjaOne"
        entityLabel="Organizations"
        externalOrgs={externalOrgs}
        isLoading={isLoading}
        isError={isError}
      />
    </div>
  );
}
