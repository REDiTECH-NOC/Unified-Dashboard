"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgSelectorProps {
  value: string; // "all" or org id
  onChange: (value: string) => void;
  className?: string;
}

export function OrgSelector({ value, onChange, className }: OrgSelectorProps) {
  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const sorted = useMemo(() => {
    if (!organizations.data) return [];
    return [...organizations.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations.data]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-lg bg-accent px-3 pr-8 text-xs font-medium text-foreground border border-border outline-none cursor-pointer appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
      >
        <option value="all">All Organizations</option>
        {sorted.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </div>
  );
}
