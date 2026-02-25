"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectionStatusCard } from "./_components/connection-status-card";
import { SyncSettingsCard } from "./_components/sync-settings-card";
import { CompanyExplorer } from "./_components/company-explorer";
import { TechMappingCard } from "./_components/tech-mapping-card";
import { WebhookCallbacksCard } from "./_components/webhook-callbacks-card";

type Tab = "companies" | "techs" | "notifications";

export default function ConnectWiseSettingsPage() {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncMode, setSyncMode] = useState<"auto" | "manual">("auto");
  const [activeTab, setActiveTab] = useState<Tab>("companies");

  const handleSyncToggle = useCallback((v: boolean) => setSyncEnabled(v), []);
  const handleSyncModeChange = useCallback(
    (m: "auto" | "manual") => setSyncMode(m),
    []
  );

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
          <h2 className="text-2xl font-bold">ConnectWise PSA</h2>
          <p className="text-sm text-muted-foreground">
            Manage connection, company sync, and tech mapping
          </p>
        </div>
      </div>

      <ConnectionStatusCard />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50">
        <button
          onClick={() => setActiveTab("companies")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "companies"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="h-3.5 w-3.5" />
          Company Sync
        </button>
        <button
          onClick={() => setActiveTab("techs")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "techs"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Tech Mapping
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "notifications"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          Notifications
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "companies" && (
        <>
          <SyncSettingsCard
            syncMode={syncMode}
            syncEnabled={syncEnabled}
            onSyncModeChange={handleSyncModeChange}
            onSyncEnabledChange={handleSyncToggle}
          />
          {syncEnabled && <CompanyExplorer syncMode={syncMode} />}
        </>
      )}

      {activeTab === "techs" && <TechMappingCard />}

      {activeTab === "notifications" && <WebhookCallbacksCard />}
    </div>
  );
}
