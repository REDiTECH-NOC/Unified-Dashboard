"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Search, Building2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TenantSelectorProps {
  value: string | null;
  onChange: (tenant: string | null, displayName?: string) => void;
  className?: string;
}

export function TenantSelector({ value, onChange, className }: TenantSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: tenants, isLoading } = trpc.cipp.listTenants.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!tenants) return [];
    if (!search) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(
      (t) =>
        t.displayName?.toLowerCase().includes(q) ||
        t.defaultDomainName?.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const selectedTenant = useMemo(
    () => tenants?.find((t) => t.defaultDomainName === value),
    [tenants, value]
  );

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card",
          "text-sm transition-colors hover:bg-accent min-w-[240px] max-w-[360px]",
          !value && "text-muted-foreground"
        )}
      >
        <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">
          {isLoading
            ? "Loading tenants..."
            : selectedTenant
              ? selectedTenant.displayName
              : "Select a tenant..."}
        </span>
        {value && (
          <X
            className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          />
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-[360px] rounded-lg border border-border bg-card shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          {/* Tenant list */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                {isLoading ? "Loading..." : "No tenants found"}
              </p>
            ) : (
              filtered.map((tenant) => (
                <button
                  key={tenant.customerId || tenant.defaultDomainName}
                  onClick={() => {
                    onChange(tenant.defaultDomainName, tenant.displayName);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex flex-col w-full px-3 py-2 text-left transition-colors",
                    "hover:bg-accent",
                    value === tenant.defaultDomainName && "bg-accent"
                  )}
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {tenant.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {tenant.defaultDomainName}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Count */}
          {tenants && (
            <div className="border-t border-border px-3 py-1.5">
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {tenants.length} tenants
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
