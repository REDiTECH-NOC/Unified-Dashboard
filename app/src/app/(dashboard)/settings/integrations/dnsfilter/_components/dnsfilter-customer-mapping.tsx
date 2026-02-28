"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ToolCustomerMapping } from "../../_components/tool-customer-mapping";

export function DnsFilterCustomerMapping() {
  const {
    data: orgs,
    isLoading,
    isError,
  } = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const externalOrgs = useMemo(() => {
    if (!orgs) return undefined;
    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      status: org.networkCount
        ? `${org.networkCount} network${org.networkCount !== 1 ? "s" : ""}`
        : undefined,
    }));
  }, [orgs]);

  return (
    <ToolCustomerMapping
      toolId="dnsfilter"
      displayName="DNS Filter"
      entityLabel="Organizations"
      externalOrgs={externalOrgs}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
