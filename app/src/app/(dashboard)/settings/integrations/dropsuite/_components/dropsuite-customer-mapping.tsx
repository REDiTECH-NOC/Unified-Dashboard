"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ToolCustomerMapping } from "../../_components/tool-customer-mapping";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DropsuiteCustomerMapping() {
  const {
    data: orgs,
    isLoading,
    isError,
  } = trpc.saasBackup.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const externalOrgs = useMemo(() => {
    if (!orgs) return undefined;
    return orgs.map((org) => ({
      id: org.sourceId,
      name: org.organizationName,
      deviceCount: org.activeSeats,
      status: org.isDeactivated
        ? "Deactivated"
        : org.isSuspended
          ? "Suspended"
          : `${org.activeSeats} seats · ${formatBytes(org.storageUsedBytes)}`,
    }));
  }, [orgs]);

  return (
    <ToolCustomerMapping
      toolId="dropsuite"
      displayName="DropSuite"
      entityLabel="Organizations"
      externalOrgs={externalOrgs}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
