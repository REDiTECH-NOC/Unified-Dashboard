"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";

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

export default function AuditPage() {
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory | undefined>(undefined);
  const [selectedOutcome, setSelectedOutcome] = useState<"success" | "failure" | "denied" | undefined>(undefined);

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

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-sm text-muted-foreground">
          Immutable record of all platform activity — filter by category or outcome
        </p>
      </div>

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
                        {new Date(event.createdAt).toLocaleString()}
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
