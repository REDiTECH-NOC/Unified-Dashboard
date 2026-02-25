"use client";

import { trpc } from "@/lib/trpc";
import { BarChart3, Zap, Clock, Database } from "lucide-react";

export function UsageSummaryCard() {
  const { data: usage } = trpc.ai.getUsageSummary.useQuery({ days: 30 });

  function formatTokens(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Usage Overview</h3>
        <p className="text-sm text-muted-foreground">
          Last 30 days of AI usage across all users
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="h-4 w-4 text-blue-400" />}
          label="Total Requests"
          value={usage?.totalRequests?.toString() ?? "0"}
        />
        <StatCard
          icon={<Database className="h-4 w-4 text-purple-400" />}
          label="Tokens Used"
          value={formatTokens(usage?.totalTokens ?? 0)}
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4 text-green-400" />}
          label="Cache Hits"
          value={usage?.cachedRequests?.toString() ?? "0"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-yellow-400" />}
          label="Avg Latency"
          value={usage?.avgLatency ? `${usage.avgLatency}ms` : "—"}
        />
      </div>

      {/* 7-Day Chart (simple bar representation) */}
      {usage?.dailyUsage && usage.dailyUsage.some((d) => d.requests > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Last 7 Days</h4>
          <div className="flex items-end gap-1 h-20">
            {usage.dailyUsage.map((day) => {
              const maxReqs = Math.max(
                ...usage.dailyUsage.map((d) => d.requests),
                1
              );
              const height = (day.requests / maxReqs) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-blue-500/30 rounded-t transition-all"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.date}: ${day.requests} requests, ${formatTokens(day.tokens)} tokens`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By Function breakdown */}
      {usage?.byFunction && Object.keys(usage.byFunction).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">By Function</h4>
          <div className="space-y-1">
            {Object.entries(usage.byFunction)
              .sort(([, a], [, b]) => b.tokens - a.tokens)
              .map(([fn, stats]) => (
                <div
                  key={fn}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <code className="text-xs bg-accent px-1.5 py-0.5 rounded">
                    {fn}
                  </code>
                  <span className="text-muted-foreground">
                    {stats.requests} req · {formatTokens(stats.tokens)} tokens
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {(!usage || usage.totalRequests === 0) && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No AI usage recorded yet. Stats will appear once the AI agents start processing requests.
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-accent/30 p-3 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
