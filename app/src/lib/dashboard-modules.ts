import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bell,
  Ticket,
  Activity,
  Wifi,
  UserCheck,
  Shield,
  MonitorCheck,
  Phone,
  HardDrive,
  FileText,
  Star,
  Columns3,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  AreaChart as AreaChartIcon,
} from "lucide-react";

// ─── Module Definition ────────────────────────────────────────────

export type ModuleCategory = "overview" | "operations" | "monitoring" | "security" | "admin";

export interface DashboardModuleDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: ModuleCategory;
  requiredPermission: string | null;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  viewAllHref?: string;
  /** Whether this module has per-instance settings (gear icon) */
  configurable?: boolean;
  /** Whether users can add multiple instances of this module */
  allowDuplicates?: boolean;
  /** Default config for new instances */
  defaultConfig?: Record<string, unknown>;
}

// ─── Module Registry (48-column grid) ────────────────────────────

export const MODULE_REGISTRY: DashboardModuleDef[] = [
  // ── Overview ──
  {
    id: "stat-overview",
    name: "Key Metrics",
    description: "Configurable metric tiles — choose which stats to display and how many columns.",
    icon: LayoutDashboard,
    category: "overview",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 48, h: 4 },
    minSize: { w: 24, h: 3 },
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      columns: 4,
      metrics: ["open-tickets", "active-alerts", "monitors-down", "servers-offline"],
    },
  },

  // ── Operations ──
  {
    id: "recent-alerts",
    name: "Recent Alerts",
    description: "Live feed of the latest alerts. Filter by source and severity.",
    icon: Bell,
    category: "operations",
    requiredPermission: "alerts.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/alerts",
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      sources: [],
      severities: [],
      sortOrder: "newest",
    },
  },
  {
    id: "recent-tickets",
    name: "Recent Tickets",
    description: "Latest tickets from your PSA. Filter by board and status.",
    icon: Ticket,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/tickets",
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      boards: [],
      statuses: [],
      sortOrder: "newest",
    },
  },
  {
    id: "my-tickets",
    name: "My Tickets",
    description: "Tickets assigned to you — status, priority, age, and client at a glance.",
    icon: UserCheck,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/tickets",
    configurable: true,
    defaultConfig: {
      statuses: [],
      sortOrder: "priority",
    },
  },
  {
    id: "ticket-board",
    name: "Ticket Board",
    description: "Compact kanban-style view of a single PSA board with status columns.",
    icon: Columns3,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 48, h: 10 },
    minSize: { w: 28, h: 7 },
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      board: "",
      maxPerColumn: 5,
    },
  },
  {
    id: "ticket-distribution-chart",
    name: "Ticket Distribution",
    description: "Donut chart showing tickets by status, priority, or board.",
    icon: PieChartIcon,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 6 },
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      groupBy: "status",
      boardId: "",
    },
  },
  {
    id: "alert-trend-chart",
    name: "Alert Breakdown",
    description: "Bar chart showing alert counts by severity or source.",
    icon: BarChart3,
    category: "operations",
    requiredPermission: "alerts.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 6 },
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      groupBy: "severity",
      sources: [],
    },
  },
  {
    id: "ticket-volume-chart",
    name: "Ticket Volume",
    description: "Tickets created per day over time — spot trends and spikes.",
    icon: AreaChartIcon,
    category: "operations",
    requiredPermission: "tickets.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 6 },
    viewAllHref: "/tickets",
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      timeRange: 14,
      boardId: "",
    },
  },
  {
    id: "client-quick-access",
    name: "Client Quick Access",
    description: "Pinned client cards — favorite clients with ticket, alert, and device counts.",
    icon: Star,
    category: "operations",
    requiredPermission: "clients.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/clients",
    configurable: true,
    defaultConfig: {
      pinnedClients: [],
      columns: 2,
    },
  },

  // ── Monitoring ──
  {
    id: "system-health",
    name: "System Health",
    description: "Live status of all containers, database, and cache with update availability.",
    icon: Activity,
    category: "monitoring",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 24, h: 10 },
    minSize: { w: 16, h: 7 },
  },
  {
    id: "network-health",
    name: "Network Health",
    description: "UniFi device status, firmware updates, and network health across all sites.",
    icon: Wifi,
    category: "monitoring",
    requiredPermission: "network.view",
    defaultSize: { w: 24, h: 10 },
    minSize: { w: 16, h: 7 },
  },
  {
    id: "uptime-status",
    name: "Uptime Status Board",
    description: "Mini status page — monitors with colored dots for at-a-glance uptime.",
    icon: MonitorCheck,
    category: "monitoring",
    requiredPermission: "tools.uptime",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/monitoring",
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      filterStatus: "all",
      filterTags: [],
      filterCompany: "",
      showLatency: true,
    },
  },
  {
    id: "uptime-latency-chart",
    name: "Response Time",
    description: "Response time trend for a selected monitor over time.",
    icon: TrendingUp,
    category: "monitoring",
    requiredPermission: "tools.uptime",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 6 },
    viewAllHref: "/monitoring",
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      monitorId: "",
      timeRange: 24,
    },
  },
  {
    id: "patch-compliance",
    name: "Patch Compliance",
    description: "NinjaRMM patch status — devices needing patches, reboots, and compliance rate.",
    icon: HardDrive,
    category: "monitoring",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    configurable: true,
    defaultConfig: {
      displayMode: "summary",
    },
  },

  // ── Security ──
  {
    id: "security-posture",
    name: "Security Posture",
    description: "Combined EDR/MDR overview — SentinelOne, Blackpoint, and Huntress threat counts.",
    icon: Shield,
    category: "security",
    requiredPermission: "alerts.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    configurable: true,
    defaultConfig: {
      vendors: ["sentinelone", "blackpoint", "huntress"],
      displayMode: "cards",
    },
  },
  {
    id: "backup-status",
    name: "Backup Status",
    description: "Cross-vendor backup overview — Veeam, Datto, Acronis job results by client.",
    icon: HardDrive,
    category: "security",
    requiredPermission: "dashboard.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    configurable: true,
    defaultConfig: {
      vendors: ["veeam", "datto", "acronis"],
      displayMode: "summary",
    },
  },

  // ── Admin ──
  {
    id: "call-activity",
    name: "3CX Call Activity",
    description: "Live call stats — active calls, queue depth, missed today, recent call log.",
    icon: Phone,
    category: "admin",
    requiredPermission: "phone.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    configurable: true,
    allowDuplicates: true,
    defaultConfig: {
      pbxInstance: "",
      displayMode: "summary",
    },
  },
  {
    id: "recent-activity",
    name: "Recent Activity",
    description: "Audit log feed — latest actions by all users in the platform.",
    icon: FileText,
    category: "admin",
    requiredPermission: "audit.view",
    defaultSize: { w: 24, h: 8 },
    minSize: { w: 16, h: 5 },
    viewAllHref: "/audit",
    configurable: true,
    defaultConfig: {
      scope: "all",
      maxItems: 15,
    },
  },
];

// Quick lookup map
export const MODULE_MAP = new Map(MODULE_REGISTRY.map((m) => [m.id, m]));

// Category labels for the module picker
export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  overview: "Overview",
  operations: "Operations",
  monitoring: "Monitoring",
  security: "Security",
  admin: "Administration",
};

// ─── Instance ID helpers ──────────────────────────────────────────
// Instance IDs: "moduleType" for first/single, "moduleType__nanoid" for duplicates.

export function getModuleType(instanceId: string): string {
  const idx = instanceId.indexOf("__");
  return idx === -1 ? instanceId : instanceId.substring(0, idx);
}

let _counter = 0;
export function generateInstanceId(moduleType: string): string {
  _counter++;
  const suffix = Date.now().toString(36) + _counter.toString(36);
  return `${moduleType}__${suffix}`;
}
