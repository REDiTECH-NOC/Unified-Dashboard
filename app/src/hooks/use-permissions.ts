"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Hook for checking user permissions client-side.
 * Fetches the user's effective permission keys and provides
 * helper functions for checking access.
 *
 * Usage:
 *   const { has, hasAny, hasAll, isLoading } = usePermissions();
 *   if (has("alerts.sentinelone.view")) { ... }
 *   if (hasAny("billing.view", "billing.manage")) { ... }
 */
export function usePermissions() {
  const { data: permissions, isLoading } = trpc.user.myPermissions.useQuery(
    undefined,
    { staleTime: 5 * 60_000 }
  );

  const permSet = useMemo(() => new Set(permissions || []), [permissions]);

  return {
    /** The raw set of granted permission keys */
    permissions: permSet,
    /** True while the initial permissions fetch is in-flight */
    isLoading,
    /** Check if a single permission is granted */
    has: (perm: string) => permSet.has(perm),
    /** Check if ANY of the listed permissions are granted */
    hasAny: (...perms: string[]) => perms.some((p) => permSet.has(p)),
    /** Check if ALL of the listed permissions are granted */
    hasAll: (...perms: string[]) => perms.every((p) => permSet.has(p)),
  };
}
