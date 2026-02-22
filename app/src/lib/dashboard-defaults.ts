import type { Role } from "@prisma/client";

// ─── Dashboard Layout Types ──────────────────────────────────────
// Stored in UserPreference as JSON (key: "dashboard.layout")

export interface DashboardLayoutItem {
  i: string; // module id
  x: number; // grid column (0-11)
  y: number; // grid row
  w: number; // width in grid units
  h: number; // height in grid units
}

export interface DashboardLayoutData {
  version: number; // schema version for future migrations
  items: DashboardLayoutItem[];
}

// ─── Default Layouts Per Role ────────────────────────────────────
// Used when a user has no saved layout preference.
// Admin/Manager: full set of modules
// User: minimal operational view
// Client: stats only (if they ever get dashboard access)

const ADMIN_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview",   x: 0, y: 0, w: 12, h: 2 },
  { i: "recent-alerts",   x: 0, y: 2, w: 6,  h: 4 },
  { i: "recent-tickets",  x: 6, y: 2, w: 6,  h: 4 },
  { i: "system-health",   x: 0, y: 6, w: 12, h: 5 },
];

const USER_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview",   x: 0, y: 0, w: 12, h: 2 },
  { i: "recent-alerts",   x: 0, y: 2, w: 6,  h: 4 },
  { i: "recent-tickets",  x: 6, y: 2, w: 6,  h: 4 },
];

const CLIENT_DEFAULT: DashboardLayoutItem[] = [
  { i: "stat-overview", x: 0, y: 0, w: 12, h: 2 },
];

const ROLE_DEFAULTS: Record<Role, DashboardLayoutItem[]> = {
  ADMIN: ADMIN_DEFAULT,
  MANAGER: ADMIN_DEFAULT,
  USER: USER_DEFAULT,
  CLIENT: CLIENT_DEFAULT,
};

export function getDefaultLayout(role: Role): DashboardLayoutData {
  return {
    version: 1,
    items: ROLE_DEFAULTS[role] ?? USER_DEFAULT,
  };
}

/** Current layout schema version */
export const LAYOUT_VERSION = 1;
