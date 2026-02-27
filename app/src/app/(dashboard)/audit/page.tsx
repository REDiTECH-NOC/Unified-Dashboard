"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScrollText,
  Shield,
  LogIn,
  Users,
  Plug,
  Server,
  Globe,
  Database,
  ChevronDown,
  Download,
  Settings2,
  Trash2,
  HardDrive,
  Calendar,
  Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { useSession } from "next-auth/react";

type AuditCategory = "AUTH" | "USER" | "SECURITY" | "INTEGRATION" | "SYSTEM" | "API" | "DATA";

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; icon: typeof Shield; color: string }> = {
  AUTH:        { label: "Authentication", icon: LogIn,    color: "text-blue-400" },
  USER:        { label: "User Management", icon: Users,   color: "text-emerald-400" },
  SECURITY:    { label: "Security",       icon: Shield,   color: "text-red-400" },
  INTEGRATION: { label: "Integrations",   icon: Plug,     color: "text-amber-400" },
  SYSTEM:      { label: "System",         icon: Server,   color: "text-purple-400" },
  API:         { label: "API Activity",   icon: Globe,    color: "text-cyan-400" },
  DATA:        { label: "Data & Reports", icon: Database,  color: "text-orange-400" },
};

const OUTCOME_VARIANT: Record<string, string> = {
  success: "success",
  failure: "warning",
  denied: "destructive",
};

function RetentionPanel() {
  const utils = trpc.useUtils();
  const { data: config, isLoading: configLoading } = trpc.audit.getRetentionConfig.useQuery();
  const { data: stats, isLoading: statsLoading } = trpc.audit.getStats.useQuery();
  const { dateTime } = useTimezone();

  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [autoCleanup, setAutoCleanup] = useState<boolean | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Export state
  const [exportStart, setExportStart] = useState("");
  const [exportEnd, setExportEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  const updateConfig = trpc.audit.updateRetentionConfig.useMutation({
    onSuccess: () => {
      utils.audit.getRetentionConfig.invalidate();
      utils.audit.getStats.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const exportCsv = trpc.audit.exportCsv.useMutation();

  const effectiveRetention = retentionDays ?? config?.retentionDays ?? 2555;
  const effectiveAutoCleanup = autoCleanup ?? config?.autoCleanupEnabled ?? false;
  const effectiveFrequency = frequency ?? config?.cleanupFrequency ?? "monthly";

  function handleSave() {
    updateConfig.mutate({
      retentionDays: effectiveRetention,
      autoCleanupEnabled: effectiveAutoCleanup,
      cleanupFrequency: effectiveFrequency as "daily" | "weekly" | "monthly",
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await exportCsv.mutateAsync({
        startDate: exportStart || undefined,
        endDate: exportEnd || undefined,
      });
      // Trigger CSV download
      const blob = new Blob([result.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (configLoading || statsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading retention settings...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="h-3.5 w-3.5" />
              <span className="text-xs">Total Events</span>
            </div>
            <p className="text-xl font-semibold">{stats?.totalEvents?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <HardDrive className="h-3.5 w-3.5" />
              <span className="text-xs">Est. Size</span>
            </div>
            <p className="text-xl font-semibold">{stats?.estimatedSizeMb ?? 0} MB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs">Oldest Entry</span>
            </div>
            <p className="text-sm font-semibold">
              {stats?.oldestEventDate ? dateTime(stats.oldestEventDate) : "None"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-xs">Expired Events</span>
            </div>
            <p className="text-xl font-semibold">{stats?.expiredCount?.toLocaleString() ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Retention Config + Export */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Retention Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Retention Period (days)</label>
              <Input
                type="number"
                min={30}
                max={3650}
                value={effectiveRetention}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                {Math.round(effectiveRetention / 365 * 10) / 10} years — Industry standard: 7 years (HIPAA/SOC 2)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoCleanup(!effectiveAutoCleanup)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  effectiveAutoCleanup ? "bg-emerald-500" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    effectiveAutoCleanup ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
              <span className="text-sm">Auto-cleanup expired events</span>
            </div>

            {effectiveAutoCleanup && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cleanup Frequency</label>
                <div className="flex gap-2">
                  {(["daily", "weekly", "monthly"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        effectiveFrequency === f
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stats?.lastCleanupAt && (
              <p className="text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                Last cleanup: {dateTime(stats.lastCleanupAt)} ({stats.lastCleanupCount.toLocaleString()} events removed)
              </p>
            )}

            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {saved ? "Saved" : updateConfig.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Download className="h-4 w-4" /> Export Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Download audit events as CSV for compliance reporting or archival.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={exportStart}
                  onChange={(e) => setExportStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End Date</label>
                <Input
                  type="date"
                  value={exportEnd}
                  onChange={(e) => setExportEnd(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Max 10,000 events per export. Leave dates blank for most recent.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | undefined>(undefined);
  const [selectedOutcome, setSelectedOutcome] = useState<"success" | "failure" | "denied" | undefined>(undefined);
  const [showRetention, setShowRetention] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.audit.list.useInfiniteQuery(
      {
        limit: 50,
        category: selectedCategory,
        outcome: selectedOutcome,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const { data: categoryCounts } = trpc.audit.categoryCounts.useQuery();
  const { dateTime } = useTimezone();

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Audit Log</h2>
          <p className="text-sm text-muted-foreground">
            Immutable record of all platform activity — filter by category or outcome
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetention(!showRetention)}
            className="gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showRetention ? "Hide Settings" : "Retention & Export"}
          </Button>
        )}
      </div>

      {/* Retention & Export Panel (admin only) */}
      {isAdmin && showRetention && <RetentionPanel />}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(undefined)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          All{categoryCounts ? ` (${Object.values(categoryCounts).reduce((a, b) => a + b, 0)})` : ""}
        </button>
        {(Object.keys(CATEGORY_CONFIG) as AuditCategory[]).map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const count = categoryCounts?.[cat] || 0;
          const Icon = config.icon;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-3 w-3 ${selectedCategory === cat ? "" : config.color}`} />
              {config.label}
              {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Outcome filter */}
      <div className="flex gap-2">
        {(["success", "failure", "denied"] as const).map((outcome) => (
          <button
            key={outcome}
            onClick={() => setSelectedOutcome(selectedOutcome === outcome ? undefined : outcome)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedOutcome === outcome
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {outcome}
          </button>
        ))}
      </div>

      {/* Events list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedCategory ? CATEGORY_CONFIG[selectedCategory].label : "All"} Events
            {selectedOutcome && ` — ${selectedOutcome}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading audit events...</p>
          ) : allItems.length > 0 ? (
            <div className="space-y-1">
              {allItems.map((event) => {
                const catConfig = CATEGORY_CONFIG[event.category as AuditCategory];
                const CatIcon = catConfig?.icon || ScrollText;
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CatIcon className={`h-4 w-4 flex-shrink-0 ${catConfig?.color || "text-muted-foreground"}`} />
                      <Badge
                        variant={OUTCOME_VARIANT[event.outcome] as any}
                        className="text-[10px] px-1.5"
                      >
                        {event.outcome}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{event.action}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {event.actor?.name || event.actor?.email || "System"}
                          {event.resource ? ` → ${event.resource}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <Badge variant="outline" className="text-[10px]">
                        {event.category}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {dateTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Load more */}
              {hasNextPage && (
                <div className="pt-3 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="gap-1.5"
                  >
                    <ChevronDown className="h-3 w-3" />
                    {isFetchingNextPage ? "Loading..." : "Load More"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScrollText className="mb-3 h-8 w-8 opacity-50" />
              <p className="text-sm">No audit events found</p>
              <p className="text-xs">
                {selectedCategory || selectedOutcome
                  ? "Try removing filters to see more events"
                  : "Events will appear here as users interact with the platform"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
