"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TenantSelector } from "./_components/tenant-selector";
import {
  Building2,
  Users,
  Key,
  Shield,
  Laptop,
  UserMinus,
  RefreshCw,
  Search,
  Globe,
  User,
  HardDrive,
  AlertTriangle,
  Monitor,
} from "lucide-react";
import { CIPPEmbed } from "./_components/cipp-embed";

// ─── Tab Config ─────────────────────────────────────────────────────
const TABS = [
  { id: "tenants", label: "Tenants", icon: Building2 },
  { id: "users", label: "Users & Groups", icon: Users },
  { id: "licenses", label: "Licenses", icon: Key },
  { id: "security", label: "Security", icon: Shield },
  { id: "intune", label: "Intune", icon: Laptop },
  { id: "offboarding", label: "Offboarding", icon: UserMinus },
  { id: "fullui", label: "Full CIPP UI", icon: Monitor },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Stat Card ──────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-foreground",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className={cn("rounded-md bg-accent p-2", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Skeleton Row ───────────────────────────────────────────────────
function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse"
        >
          <div className="h-4 w-48 rounded bg-accent" />
          <div className="h-4 w-64 rounded bg-accent" />
          <div className="h-4 w-20 rounded bg-accent ml-auto" />
        </div>
      ))}
    </>
  );
}

// ─── Tenants Tab ────────────────────────────────────────────────────
function TenantsTab({
  onSelectTenant,
}: {
  onSelectTenant: (domain: string, name?: string) => void;
}) {
  const [search, setSearch] = useState("");
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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Tenants"
          value={tenants?.length ?? "—"}
          icon={Building2}
          color="text-blue-400"
        />
        <StatCard
          label="With Domains"
          value={
            tenants?.filter((t) => t.domains && t.domains.length > 1).length ??
            "—"
          }
          icon={Globe}
          color="text-green-400"
        />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-accent max-w-md">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Tenant Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-accent/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span className="w-[300px]">Display Name</span>
          <span className="flex-1">Default Domain</span>
          <span className="w-[100px] text-right">Domains</span>
        </div>

        {/* Body */}
        {isLoading ? (
          <SkeletonRows count={8} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">
              {search ? "No tenants match your search" : "No tenants found"}
            </p>
          </div>
        ) : (
          filtered.map((tenant) => (
            <button
              key={tenant.customerId || tenant.defaultDomainName}
              onClick={() =>
                onSelectTenant(tenant.defaultDomainName, tenant.displayName)
              }
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 w-full text-left transition-colors hover:bg-accent/50"
            >
              <span className="w-[300px] text-sm font-medium text-foreground truncate">
                {tenant.displayName}
              </span>
              <span className="flex-1 text-sm text-muted-foreground truncate">
                {tenant.defaultDomainName}
              </span>
              <span className="w-[100px] text-sm text-muted-foreground text-right">
                {tenant.domains?.length ?? 0}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Count footer */}
      {tenants && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {tenants.length} tenants
        </p>
      )}
    </div>
  );
}

// ─── Placeholder Tab ────────────────────────────────────────────────
function PlaceholderTab({
  tab,
  selectedTenant,
}: {
  tab: TabId;
  selectedTenant: string | null;
}) {
  if (!selectedTenant) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm font-medium">Select a tenant to view {tab} data</p>
        <p className="text-xs mt-1">Use the tenant selector above or click a tenant in the Tenants tab</p>
      </div>
    );
  }

  const tabInfo: Record<string, { icon: React.ElementType; description: string }> = {
    users: { icon: User, description: "Users, groups, MFA status, sign-ins, and inactive accounts" },
    licenses: { icon: Key, description: "Per-tenant license utilization and CSP license overview" },
    security: { icon: AlertTriangle, description: "Defender state, security alerts, and incidents" },
    intune: { icon: HardDrive, description: "Managed devices, Autopilot, apps, and policies" },
    offboarding: { icon: UserMinus, description: "Guided user offboarding wizard" },
  };

  const info = tabInfo[tab];
  if (!info) return null;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <info.icon className="h-12 w-12 mb-4 opacity-30" />
      <p className="text-sm font-medium">{info.description}</p>
      <p className="text-xs mt-1 opacity-60">Coming soon — backend API routes are ready</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function CIPPPage() {
  return (
    <Suspense>
      <CIPPPageInner />
    </Suspense>
  );
}

function CIPPPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "tenants";

  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [selectedTenantName, setSelectedTenantName] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const setTab = useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "tenants") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      router.push(`/cipp${params.toString() ? `?${params.toString()}` : ""}`);
    },
    [router, searchParams]
  );

  const handleSelectTenant = useCallback(
    (domain: string | null, displayName?: string) => {
      setSelectedTenant(domain);
      setSelectedTenantName(displayName ?? null);

      // Prefetch common data for the selected tenant
      if (domain) {
        utils.cipp.listUsers.prefetch({ tenantFilter: domain });
        utils.cipp.listLicenses.prefetch({ tenantFilter: domain });
        utils.cipp.listSecurityAlerts.prefetch({ tenantFilter: domain });
        utils.cipp.listGroups.prefetch({ tenantFilter: domain });
      }
    },
    [utils]
  );

  const handleTenantRowClick = useCallback(
    (domain: string, name?: string) => {
      handleSelectTenant(domain, name);
      setTab("users");
    },
    [handleSelectTenant, setTab]
  );

  const handleRefresh = useCallback(() => {
    // Invalidate all CIPP queries to force refetch
    utils.cipp.invalidate();
  }, [utils]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">CIPP</h1>
          <p className="text-sm text-muted-foreground">
            Microsoft 365 multi-tenant management
            {selectedTenantName && (
              <span className="text-foreground font-medium"> — {selectedTenantName}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== "tenants" && (
            <TenantSelector
              value={selectedTenant}
              onChange={handleSelectTenant}
            />
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                "border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-red-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "tenants" && (
        <TenantsTab onSelectTenant={handleTenantRowClick} />
      )}
      {activeTab !== "tenants" && activeTab !== "fullui" && (
        <PlaceholderTab tab={activeTab} selectedTenant={selectedTenant} />
      )}
      {/* Always mounted so the iframe stays alive across tab switches */}
      <div className={activeTab === "fullui" ? "" : "hidden"}>
        <CIPPEmbed />
      </div>
    </div>
  );
}
