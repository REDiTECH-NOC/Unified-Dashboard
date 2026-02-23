import type { Role } from "@prisma/client";

// ─── Dashboard Layout Types ──────────────────────────────────────

export interface DashboardLayoutItem {
  i: string;          // instance id (moduleType or moduleType__suffix)
  x: number;          // grid column (0-11)
  y: number;          // grid row
  w: number;          // width in grid units
  h: number;          // height in grid units
  config?: Record<string, unknown>; // per-instance settings
}

export interface DashboardLayoutData {
  version: number;
  items: DashboardLayoutItem[];
}

// ─── Default Layouts Per Role ────────────────────────────────────

const ADMIN_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview",   x: 0, y: 0,  w: 12, h: 4,  config: { columns: 4, metrics: ["open-tickets", "active-alerts", "monitors-down", "servers-offline"] } },
  { i: "recent-alerts",   x: 0, y: 4,  w: 6,  h: 8 },
  { i: "recent-tickets",  x: 6, y: 4,  w: 6,  h: 8 },
  { i: "system-health",   x: 0, y: 12, w: 6,  h: 10 },
  { i: "uptime-status",   x: 6, y: 12, w: 6,  h: 10 },
];

const USER_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview",   x: 0, y: 0, w: 12, h: 4,  config: { columns: 4, metrics: ["my-open-tickets", "active-alerts", "monitors-down", "waiting-on-client"] } },
  { i: "my-tickets",      x: 0, y: 4, w: 6,  h: 8 },
  { i: "recent-alerts",   x: 6, y: 4, w: 6,  h: 8 },
];

const CLIENT_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview", x: 0, y: 0, w: 12, h: 4, config: { columns: 4, metrics: ["open-tickets", "active-alerts", "monitors-up", "backup-success"] } },
];

const ROLE_DEFAULTS: Record<Role, DashboardLayoutItem[]> = {
  ADMIN: ADMIN_DEFAULT,
  MANAGER: ADMIN_DEFAULT,
  USER: USER_DEFAULT,
  CLIENT: CLIENT_DEFAULT,
};

export function getDefaultLayout(role: Role): DashboardLayoutData {
  return {
    version: 2,
    items: ROLE_DEFAULTS[role] ?? USER_DEFAULT,
  };
}

export const LAYOUT_VERSION = 3;
