/**
 * Chart color palette — dark-mode optimized for Recharts.
 * Used across analytics widgets and dashboard modules.
 */

export const CHART_COLORS = {
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  pink: "#ec4899",
  orange: "#f97316",
  teal: "#14b8a6",
  indigo: "#6366f1",
  lime: "#84cc16",
  rose: "#f43f5e",
} as const;

/** Ordered palette for multi-series charts */
export const CHART_PALETTE = [
  CHART_COLORS.blue,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
  CHART_COLORS.pink,
  CHART_COLORS.orange,
  CHART_COLORS.teal,
  CHART_COLORS.indigo,
  CHART_COLORS.lime,
  CHART_COLORS.rose,
  CHART_COLORS.red,
];

/** Severity-specific colors for alert/health charts */
export const SEVERITY_COLORS = {
  critical: CHART_COLORS.red,
  high: CHART_COLORS.orange,
  medium: CHART_COLORS.amber,
  low: CHART_COLORS.blue,
  informational: "#71717a", // zinc-500
} as const;

/** Device health status colors */
export const HEALTH_COLORS = {
  healthy: CHART_COLORS.green,
  warning: CHART_COLORS.amber,
  critical: CHART_COLORS.red,
  offline: "#71717a", // zinc-500
  unknown: "#3f3f46", // zinc-700
} as const;
