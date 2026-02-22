import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bell,
  Ticket,
  Activity,
  Wifi,
} from "lucide-react";

// ─── Module Definition ────────────────────────────────────────────
// Each dashboard module must implement this interface.
// To add a new module: create the component, then add an entry here.

export type ModuleCategory = "overview" | "operations" | "monitoring" | "admin";

export interface DashboardModuleDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: ModuleCategory;
  /** Existing permission key from permissions.ts — null = always available */
  requiredPermission: string | null;
  /** Default grid size in grid units (12-col grid) */
  defaultSize: { w: number; h: number };
  /** Minimum resize dimensions */
  minSize: { w: number; h: number };
  /** Maximum resize dimensions */
  maxSize?: { w: number; h: number };
  /** Optional "View all" link shown in module header */
  viewAllHref?: string;
}

// ─── Module Registry ──────────────────────────────────────────────
// All available dashboard modules. Order here determines display order
// in the module picker.

export const MODULE_REGISTRY: DashboardModuleDef[] = [
  {
    id: "stat-overview",
    name: "Key Metrics",
    description: "Open tickets, active alerts, devices online, and SLA compliance at a glance.",
    icon: LayoutDashboard,
    category: "overview",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 12, h: 2 },
    minSize: { w: 6, h: 2 },
    maxSize: { w: 12, h: 2 },
  },
  {
    id: "recent-alerts",
    name: "Recent Alerts",
    description: "Live feed of the latest alerts from all monitoring integrations.",
    icon: Bell,
    category: "operations",
    requiredPermission: "alerts.view",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    viewAllHref: "/alerts",
  },
  {
    id: "recent-tickets",
    name: "Recent Tickets",
    description: "Latest tickets from your PSA with status and priority.",
    icon: Ticket,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    viewAllHref: "/tickets",
  },
  {
    id: "system-health",
    name: "System Health",
    description: "Live status of all containers, database, and cache with update availability.",
    icon: Activity,
    category: "monitoring",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 4 },
  },
  {
    id: "network-health",
    name: "Network Health",
    description: "UniFi device status, firmware updates, and network health across all sites.",
    icon: Wifi,
    category: "monitoring",
    requiredPermission: "network.view",
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 4 },
    maxSize: { w: 12, h: 8 },
  },
];

// Quick lookup map
export const MODULE_MAP = new Map(MODULE_REGISTRY.map((m) => [m.id, m]));

// Category labels for the module picker
export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  overview: "Overview",
  operations: "Operations",
  monitoring: "Monitoring",
  admin: "Administration",
};
