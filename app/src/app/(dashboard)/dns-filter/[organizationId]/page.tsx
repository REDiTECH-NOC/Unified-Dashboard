"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Globe,
  ArrowLeft,
  Loader2,
  Calendar,
  Eye,
  AlertTriangle,
  List,
  Shield,
  Laptop,
  Search,
} from "lucide-react";
import {
  OverviewSection,
  QueryLogsSection,
  DomainLookupSection,
} from "../_components/dns-sections";
import { PoliciesSection } from "../_components/policies-section";
import { AgentsByOrgSection } from "../_components/agents-by-org-section";
import { DnsFilterAlerts } from "../_components/dns-filter-alerts";

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

type SubTab = "overview" | "threats" | "query-logs" | "policies" | "agents" | "lookup";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "threats", label: "Threats", icon: AlertTriangle },
  { id: "query-logs", label: "Query Logs", icon: List },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "agents", label: "Roaming Clients", icon: Laptop },
  { id: "lookup", label: "Domain Lookup", icon: Search },
];

/* ─── MAIN PAGE ─────────────────────────────────────────── */

export default function OrganizationDetailPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const organizationIds = useMemo(() => [organizationId], [organizationId]);

  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const from = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);

  // Fetch org name from organizations list
  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });

  const orgName = useMemo(() => {
    return organizations.data?.find((o) => o.id === organizationId)?.name ?? "Organization";
  }, [organizations.data, organizationId]);

  // Fetch org network count
  const networks = trpc.dnsFilter.getNetworks.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });

  const orgNetworkCount = useMemo(() => {
    return (networks.data ?? []).filter((n) => n.organizationId === organizationId).length;
  }, [networks.data, organizationId]);

  // Fetch agent counts for this org
  const agentCounts = trpc.dnsFilter.getAgentCounts.useQuery(
    { organizationIds },
    { retry: false, staleTime: 5 * 60_000 }
  );

  if (organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Link
            href="/dns-filter"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Organizations
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
              <Globe className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{orgName}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {orgNetworkCount > 0 && (
                  <span>{orgNetworkCount} network{orgNetworkCount !== 1 ? "s" : ""}</span>
                )}
                {agentCounts.data && (
                  <span>{agentCounts.data.all} agent{agentCounts.data.all !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
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
      {subTab === "overview" && <OverviewSection from={from} organizationIds={organizationIds} />}
      {subTab === "threats" && <DnsFilterAlerts from={from} organizationIds={organizationIds} />}
      {subTab === "query-logs" && <QueryLogsSection from={from} organizationIds={organizationIds} />}
      {subTab === "policies" && <PoliciesSection organizationIds={organizationIds} />}
      {subTab === "agents" && <AgentsByOrgSection organizationIds={organizationIds} />}
      {subTab === "lookup" && <DomainLookupSection />}
    </div>
  );
}
