"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Globe,
  Loader2,
  Settings,
  Calendar,
  Eye,
  AlertTriangle,
  List,
  Shield,
  Laptop,
  Search,
  MapPin,
  FileText,
  Users,
  Pencil,
} from "lucide-react";
import { OrgSelector } from "../../dns-filter/_components/org-selector";
import {
  OverviewSection,
  QueryLogsSection,
  DomainLookupSection,
} from "../../dns-filter/_components/dns-sections";
import { PoliciesSection } from "../../dns-filter/_components/policies-section";
import { AgentsByOrgSection } from "../../dns-filter/_components/agents-by-org-section";
import { DnsFilterAlerts } from "../../dns-filter/_components/dns-filter-alerts";
import { SitesSection } from "../../dns-filter/_components/sites-section";
import { PolicyEditorSection } from "../../dns-filter/_components/policy-editor";
import { BlockPagesSection } from "../../dns-filter/_components/block-pages-section";
import { UsersSection } from "../../dns-filter/_components/users-section";

/* ─── TIME RANGE ────────────────────────────────────────── */

type TimeRange = "24h" | "7d" | "30d";

const TIME_RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

/* ─── SUB TABS ──────────────────────────────────────────── */

type SubTab = "overview" | "threats" | "query-logs" | "sites" | "policies" | "policy-editor" | "block-pages" | "agents" | "users" | "lookup";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "threats", label: "Threats", icon: AlertTriangle },
  { id: "query-logs", label: "Query Logs", icon: List },
  { id: "sites", label: "Sites", icon: MapPin },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "policy-editor", label: "Policy Editor", icon: Pencil },
  { id: "block-pages", label: "Block Pages", icon: FileText },
  { id: "agents", label: "Roaming Clients", icon: Laptop },
  { id: "users", label: "Users", icon: Users },
  { id: "lookup", label: "Domain Lookup", icon: Search },
];

/* ─── DNS FILTER TAB (embedded in Network page) ─────────── */

export function DnsFilterTab() {
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const from = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);
  const organizationIds = useMemo(
    () => (selectedOrg === "all" ? undefined : [selectedOrg]),
    [selectedOrg]
  );

  // Check if configured
  const trafficCheck = trpc.dnsFilter.getTrafficSummary.useQuery(
    { from: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    { retry: false, staleTime: 5 * 60_000 }
  );

  const isNotConfigured =
    trafficCheck.isError &&
    (trafficCheck.error?.message?.includes("not configured") ||
      trafficCheck.error?.message?.includes("No active"));

  if (isNotConfigured) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Globe className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <h2 className="text-lg font-semibold text-foreground mb-1">DNS Filter Not Connected</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure your DNSFilter API key in Settings &gt; Integrations to see DNS security data.
        </p>
        <Link
          href="/settings/integrations"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-foreground text-sm font-medium hover:bg-accent/80 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Go to Integrations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls: Org Selector + Time Range */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <OrgSelector value={selectedOrg} onChange={setSelectedOrg} />

        <div className="flex items-center gap-1 bg-accent rounded-lg border border-border p-0.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-0.5" />
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimeRange(opt.id)}
              className={cn(
                "h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                timeRange === opt.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 rounded-lg bg-accent p-0.5 overflow-x-auto">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              subTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {subTab === "overview" && <OverviewSection key={selectedOrg} from={from} organizationIds={organizationIds} />}
      {subTab === "threats" && <DnsFilterAlerts key={selectedOrg} from={from} organizationIds={organizationIds} />}
      {subTab === "query-logs" && <QueryLogsSection key={selectedOrg} from={from} organizationIds={organizationIds} />}
      {subTab === "sites" && <SitesSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "policies" && <PoliciesSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "policy-editor" && <PolicyEditorSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "block-pages" && <BlockPagesSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "agents" && <AgentsByOrgSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "users" && <UsersSection key={selectedOrg} organizationIds={organizationIds} />}
      {subTab === "lookup" && <DomainLookupSection />}
    </div>
  );
}
