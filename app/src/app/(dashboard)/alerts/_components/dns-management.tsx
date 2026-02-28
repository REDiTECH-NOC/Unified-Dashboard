"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Globe,
  Calendar,
  AlertTriangle,
  List,
  Shield,
  Search,
} from "lucide-react";
import { OrgSelector } from "../../dns-filter/_components/org-selector";
import { DnsFilterAlerts } from "../../dns-filter/_components/dns-filter-alerts";
import { QueryLogsSection } from "../../dns-filter/_components/dns-sections";
import { PoliciesSection } from "../../dns-filter/_components/policies-section";

/* ─── TIME RANGE ────────────────────────────────────────── */

type TimeRange = "24h" | "3d" | "7d";

const TIME_RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: "24h", label: "24h" },
  { id: "3d", label: "3d" },
  { id: "7d", label: "7d" },
];

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "3d": return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

/* ─── SUB TABS ──────────────────────────────────────────── */

type SubTab = "threats" | "query-logs" | "policies";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "threats", label: "Threats", icon: AlertTriangle },
  { id: "query-logs", label: "Query Logs", icon: List },
  { id: "policies", label: "Policies", icon: Shield },
];

/* ─── DNS MANAGEMENT VIEW ──────────────────────────────── */

export function DnsManagementView() {
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("3d");
  const [subTab, setSubTab] = useState<SubTab>("threats");

  const from = useMemo(() => getTimeRangeDate(timeRange), [timeRange]);
  const organizationIds = useMemo(
    () => (selectedOrg === "all" ? undefined : [selectedOrg]),
    [selectedOrg]
  );

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
      {subTab === "threats" && <DnsFilterAlerts key={selectedOrg} from={from} organizationIds={organizationIds} />}
      {subTab === "query-logs" && <QueryLogsSection key={selectedOrg} from={from} organizationIds={organizationIds} />}
      {subTab === "policies" && <PoliciesSection key={selectedOrg} organizationIds={organizationIds} />}
    </div>
  );
}
