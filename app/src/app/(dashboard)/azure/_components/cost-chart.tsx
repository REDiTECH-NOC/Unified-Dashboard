"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CostItem {
  service: string;
  cost: number;
  costUSD: number;
  currency: string;
}

const COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export function CostChart({ costs, total }: { costs: CostItem[]; total: number }) {
  // Take top 8 services, group rest as "Other"
  const topCosts = costs.slice(0, 8);
  if (costs.length > 8) {
    const otherCost = costs.slice(8).reduce((sum, c) => sum + c.cost, 0);
    topCosts.push({
      service: "Other",
      cost: Math.round(otherCost * 100) / 100,
      costUSD: Math.round(otherCost * 100) / 100,
      currency: costs[0]?.currency || "USD",
    });
  }

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topCosts} layout="vertical" margin={{ left: 10, right: 30 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="service"
              width={140}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
              contentStyle={{
                backgroundColor: "#1c1c1e",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#e4e4e7" }}
            />
            <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
              {topCosts.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Table */}
      <div className="space-y-1">
        {topCosts.map((item, i) => (
          <div
            key={item.service}
            className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{item.service}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-foreground font-mono">${item.cost.toFixed(2)}</span>
              {total > 0 && (
                <span className="text-muted-foreground w-10 text-right">
                  {((item.cost / total) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs py-1.5 px-2 border-t border-border mt-1 pt-2">
          <span className="font-medium text-foreground">Total</span>
          <span className="font-mono font-medium text-foreground">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
