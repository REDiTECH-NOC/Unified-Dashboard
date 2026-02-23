"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cloud, Database, Shield, Activity, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { OverviewTab } from "./_components/overview-tab";
import { DatabaseTab } from "./_components/database-tab";
import { FirewallTab } from "./_components/firewall-tab";
import { ActivityTab } from "./_components/activity-tab";
import { ConfigSection } from "./_components/config-section";

type TabId = "overview" | "databases" | "firewall" | "activity" | "config";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Cloud },
  { id: "databases", label: "Databases", icon: Database },
  { id: "firewall", label: "Firewall", icon: Shield },
  { id: "activity", label: "Activity & Alerts", icon: Activity },
  { id: "config", label: "Configuration", icon: Settings2 },
];

export default function AzurePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Azure</h2>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <AzureContent />
    </Suspense>
  );
}

function AzureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabId) || "overview";
  const { data: availability } = trpc.infrastructure.isAvailable.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  function setTab(tab: TabId) {
    router.push(`/azure${tab === "overview" ? "" : `?tab=${tab}`}`);
  }

  if (availability && !availability.available) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Azure Management</h2>
          <p className="text-sm text-muted-foreground">
            Azure resource monitoring, database management, and firewall configuration
          </p>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Cloud className="h-5 w-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">Azure Not Detected</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Infrastructure management requires Azure Container Apps with managed identity.
              This feature is automatically enabled when running on Azure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Azure Management</h2>
        <p className="text-sm text-muted-foreground">
          Azure resource monitoring, database management, and firewall configuration
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "databases" && <DatabaseTab />}
      {activeTab === "firewall" && <FirewallTab />}
      {activeTab === "activity" && <ActivityTab />}
      {activeTab === "config" && <ConfigSection />}
    </div>
  );
}
