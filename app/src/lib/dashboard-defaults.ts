import type { Role } from "@prisma/client";

// ─── Dashboard Layout Types ──────────────────────────────────────

export interface DashboardLayoutItem {
  i: string;          // instance id (moduleType or moduleType__suffix)
  x: number;          // grid column (0-47)
  y: number;          // grid row
  w: number;          // width in grid units (48 cols total)
  h: number;          // height in grid units
  config?: Record<string, unknown>; // per-instance settings
}

export interface DashboardLayoutData {
  version: number;
  items: DashboardLayoutItem[];
}

// ─── Default Layouts Per Role ────────────────────────────────────

// ADMIN (NOC-focused): Alert overview, broad metrics, live feeds, system monitoring
const ADMIN_DEFAULT: DashboardLayoutItem[] = [
  { i: "alert-cards",     x: 0,  y: 0,  w: 48, h: 6,  config: { sources: ["sentinelone", "blackpoint", "ninjaone", "uptime", "backups", "avanan", "dnsfilter"] } },
  { i: "stat-overview",   x: 0,  y: 6,  w: 48, h: 4,  config: { columns: 6, metrics: ["my-open-tickets", "monitors-down", "failed-backups", "endpoints-online", "active-calls", "system-status"] } },
  { i: "recent-alerts",   x: 0,  y: 10, w: 24, h: 8 },
  { i: "recent-tickets",  x: 24, y: 10, w: 24, h: 8 },
  { i: "system-health",   x: 0,  y: 18, w: 24, h: 10 },
  { i: "uptime-status",   x: 24, y: 18, w: 24, h: 10 },
];

// MANAGER (AM-focused): Alert overview, client-centric metrics, ticket analytics, client access
const MANAGER_DEFAULT: DashboardLayoutItem[] = [
  { i: "alert-cards",              x: 0,  y: 0,  w: 48, h: 6,  config: { sources: ["sentinelone", "blackpoint", "ninjaone", "uptime", "backups", "avanan", "dnsfilter"] } },
  { i: "stat-overview",            x: 0,  y: 6,  w: 48, h: 4,  config: { columns: 4, metrics: ["my-open-tickets", "failed-backups", "monitors-down", "email-threats"] } },
  { i: "ticket-distribution-chart", x: 0,  y: 10, w: 24, h: 8,  config: { groupBy: "status", boardId: "" } },
  { i: "ticket-volume-chart",      x: 24, y: 10, w: 24, h: 8,  config: { timeRange: 14, boardId: "" } },
  { i: "client-quick-access",      x: 0,  y: 18, w: 24, h: 8,  config: { pinnedClients: [], columns: 2 } },
  { i: "recent-activity",          x: 24, y: 18, w: 24, h: 8,  config: { scope: "all", maxItems: 15 } },
];

// USER (Tech-focused): Personal tickets front and center, alerts, ticket board
const USER_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview",  x: 0,  y: 0,  w: 48, h: 4,  config: { columns: 4, metrics: ["my-open-tickets", "s1-threats", "monitors-down", "active-calls"] } },
  { i: "my-tickets",     x: 0,  y: 4,  w: 24, h: 8 },
  { i: "recent-alerts",  x: 24, y: 4,  w: 24, h: 8 },
  { i: "ticket-board",   x: 0,  y: 12, w: 48, h: 10, config: { board: "", maxPerColumn: 5 } },
];

// CLIENT (minimal): Just the basics
const CLIENT_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview", x: 0, y: 0, w: 48, h: 4, config: { columns: 2, metrics: ["my-open-tickets", "monitors-down"] } },
];

const ROLE_DEFAULTS: Record<Role, DashboardLayoutItem[]> = {
  ADMIN: ADMIN_DEFAULT,
  MANAGER: MANAGER_DEFAULT,
  USER: USER_DEFAULT,
  CLIENT: CLIENT_DEFAULT,
};

export function getDefaultLayout(role: Role): DashboardLayoutData {
  return {
    version: LAYOUT_VERSION,
    items: ROLE_DEFAULTS[role] ?? USER_DEFAULT,
  };
}

export const LAYOUT_VERSION = 6;
