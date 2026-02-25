import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

// ─── Permission Registry ───────────────────────────────────────────
// Add new permissions here as the app grows. Format: "module.action"
// Each permission has a label, description, and which roles get it by default.
//
// Resolution order (highest priority first):
//   1. Per-user override (UserPermission table) — explicit grant/revoke
//   2. Permission roles (PermissionRole via UserPermissionRole) — most permissive wins
//   3. Base role default (defaultRoles on PermissionDef)

export type PermissionSource = "override" | "permission-role" | "role";

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  module: string;
  defaultRoles: Role[]; // roles that have this permission by default
}

export const PERMISSIONS: PermissionDef[] = [
  // ── Dashboard ──
  { key: "dashboard.view",       label: "View Dashboard",           description: "Access the main dashboard",                    module: "Dashboard",     defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Tickets ──
  { key: "tickets.view",         label: "View Tickets",             description: "View ticket lists and details",                module: "Tickets",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "tickets.create",       label: "Create Tickets",           description: "Create new tickets via UI or AI",              module: "Tickets",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "tickets.edit",         label: "Edit Tickets",             description: "Update ticket status, notes, assignments",     module: "Tickets",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Alerts ──
  { key: "alerts.view",          label: "View Alerts",              description: "View alert feed and details",                  module: "Alerts",        defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "alerts.manage",        label: "Manage Alerts",            description: "Acknowledge, escalate, dismiss alerts",        module: "Alerts",        defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Clients ──
  { key: "clients.view",         label: "View Clients",             description: "View client list and details",                 module: "Clients",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Backups ──
  { key: "backups.view",         label: "View Backups",             description: "View backup status, devices, and alerts",       module: "Backups",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── AI Agents ──
  { key: "ai.chat",              label: "Use AI Chat",              description: "Access the AI operations assistant",           module: "AI",            defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "ai.kb.read",           label: "Read Knowledge Base",      description: "Query the knowledge base via AI",              module: "AI",            defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "ai.kb.write",          label: "Write to Knowledge Base",  description: "Add/update knowledge base articles via AI",    module: "AI",            defaultRoles: [] },
  { key: "ai.passwords",         label: "Access Passwords",         description: "Retrieve passwords and TOTP codes via AI",     module: "AI",            defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "ai.tickets",           label: "AI Ticket Operations",     description: "Create/update tickets via AI agent",           module: "AI",            defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Audit ──
  { key: "audit.view",           label: "View Audit Logs",          description: "Access the full audit log",                    module: "Audit",         defaultRoles: ["ADMIN"] },
  { key: "audit.export",         label: "Export Audit Logs",        description: "Export audit data to CSV/PDF",                 module: "Audit",         defaultRoles: ["ADMIN"] },

  // ── User Management ──
  { key: "users.view",           label: "View Users",               description: "View user list and profiles",                  module: "Users",         defaultRoles: ["ADMIN", "MANAGER"] },
  { key: "users.manage",         label: "Manage Users",             description: "Edit roles, permissions, feature flags",       module: "Users",         defaultRoles: ["ADMIN"] },
  { key: "users.create",         label: "Create Users",             description: "Create local user accounts and send invites",  module: "Users",         defaultRoles: ["ADMIN"] },

  // ── Settings ──
  { key: "settings.view",        label: "View Settings",            description: "Access the settings pages",                    module: "Settings",      defaultRoles: ["ADMIN"] },
  { key: "settings.integrations",label: "Manage Integrations",      description: "Configure API credentials and connections",    module: "Settings",      defaultRoles: ["ADMIN"] },
  { key: "settings.branding",    label: "Manage Branding",          description: "Change logo and company name",                 module: "Settings",      defaultRoles: ["ADMIN"] },
  { key: "settings.ai",             label: "Manage AI Settings",       description: "Configure models, budgets, rate limits",       module: "Settings",      defaultRoles: ["ADMIN"] },
  { key: "settings.notifications", label: "Notification Settings",    description: "Access notification preferences and admin config", module: "Settings",   defaultRoles: ["ADMIN", "MANAGER", "USER"] },

  // ── Notification Sources (admin assigns via permission roles) ──
  { key: "notifications.sentinelone", label: "SentinelOne Alerts",   description: "Receive alert notifications from SentinelOne",       module: "Notifications", defaultRoles: ["ADMIN"] },
  { key: "notifications.blackpoint",  label: "Blackpoint Alerts",    description: "Receive alert notifications from Blackpoint Cyber",  module: "Notifications", defaultRoles: ["ADMIN"] },
  { key: "notifications.ninjaone",    label: "NinjaRMM Alerts",      description: "Receive alert notifications from NinjaRMM",          module: "Notifications", defaultRoles: ["ADMIN"] },
  { key: "notifications.uptime",      label: "Uptime Alerts",        description: "Receive alert notifications from Uptime Monitor",    module: "Notifications", defaultRoles: ["ADMIN"] },
  { key: "notifications.cove",        label: "Cove Backup Alerts",   description: "Receive alert notifications from Cove Backup",       module: "Notifications", defaultRoles: ["ADMIN"] },

  // ── 3CX / Phone ──
  { key: "phone.view",           label: "View Phone Dashboard",     description: "View 3CX call logs and PBX status",           module: "Phone",         defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "phone.manage",         label: "Manage Phone Settings",    description: "Configure 3CX instances and webhooks",         module: "Phone",         defaultRoles: ["ADMIN"] },

  // ── Network ──
  { key: "network.view",          label: "View Network",             description: "View UniFi sites, devices, and network health",   module: "Network",       defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "network.manage",        label: "Manage Network",           description: "Configure network integration settings",          module: "Network",       defaultRoles: ["ADMIN"] },

  // ── Reports ──
  { key: "reports.view",         label: "View Reports",             description: "Access dashboards and QBR reports",            module: "Reports",       defaultRoles: ["ADMIN", "MANAGER"] },
  { key: "reports.export",       label: "Export Reports",           description: "Export reports to PDF/CSV",                    module: "Reports",       defaultRoles: ["ADMIN", "MANAGER"] },

  // ── Tools ──
  { key: "tools.grafana",        label: "Access Grafana",           description: "View embedded Grafana analytics dashboards",   module: "Tools",         defaultRoles: ["ADMIN"] },
  { key: "tools.grafana.edit",   label: "Edit Grafana Dashboards",  description: "Create and edit dashboards in Grafana",        module: "Tools",         defaultRoles: ["ADMIN"] },
  { key: "tools.grafana.admin",  label: "Grafana Admin",            description: "Full Grafana admin (users, data sources, etc)",module: "Tools",         defaultRoles: ["ADMIN"] },
  { key: "tools.uptime",         label: "Access Uptime Monitor",    description: "View and manage uptime monitors",              module: "Tools",         defaultRoles: ["ADMIN"] },
  { key: "tools.n8n",            label: "Access n8n",               description: "Access n8n workflow automation platform",       module: "Tools",         defaultRoles: [] },
  { key: "tools.azure",          label: "Azure Management",         description: "Access Azure resource health, databases, firewall, and monitoring", module: "Tools", defaultRoles: ["ADMIN"] },

  // ── CIPP (M365 Management) ──
  { key: "cipp.view",            label: "View CIPP",                description: "Access the CIPP dashboard — view tenants, users, licenses, security",        module: "CIPP",     defaultRoles: ["ADMIN", "MANAGER", "USER"] },
  { key: "cipp.manage",          label: "Manage via CIPP",          description: "Create/disable users, reset passwords, manage groups, offboard",              module: "CIPP",     defaultRoles: ["ADMIN", "MANAGER"] },
  { key: "cipp.security",        label: "CIPP Security Actions",    description: "Manage security alerts/incidents, device actions, LAPS, password resets",      module: "CIPP",     defaultRoles: ["ADMIN"] },

  // ── Quick Links ──
  { key: "quicklinks.manage",    label: "Manage Quick Links",       description: "Create, edit, and assign quick link groups and shortcuts", module: "Settings", defaultRoles: ["ADMIN"] },
];

// Build a quick lookup map
const PERMISSION_MAP = new Map(PERMISSIONS.map((p) => [p.key, p]));

// Get all unique modules for grouping in UI
export function getPermissionModules(): string[] {
  return Array.from(new Set(PERMISSIONS.map((p) => p.module)));
}

// Get permissions grouped by module
export function getPermissionsByModule(): Record<string, PermissionDef[]> {
  const grouped: Record<string, PermissionDef[]> = {};
  for (const p of PERMISSIONS) {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  }
  return grouped;
}

// ─── Permission Checking ───────────────────────────────────────────

// Collect all permission keys granted by a user's assigned permission roles
async function getPermissionRoleGrants(userId: string): Promise<Set<string>> {
  const assignments = await prisma.userPermissionRole.findMany({
    where: { userId },
    include: { permissionRole: { select: { permissions: true } } },
  });

  const granted = new Set<string>();
  for (const a of assignments) {
    for (const perm of a.permissionRole.permissions) {
      granted.add(perm);
    }
  }
  return granted;
}

// Check if a user has a specific permission
// Priority: per-user override > permission roles > base role default
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  // 1. Check for explicit per-user override
  const override = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId, permission } },
  });

  if (override) {
    return override.granted;
  }

  // 2. Check permission roles (most permissive wins — any role granting it = true)
  const roleGrants = await getPermissionRoleGrants(userId);
  if (roleGrants.has(permission)) {
    return true;
  }

  // 3. Fall back to base role default
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return false;

  const def = PERMISSION_MAP.get(permission);
  if (!def) return false;

  return def.defaultRoles.includes(user.role);
}

// Check multiple permissions at once (efficient batch query)
export async function hasPermissions(
  userId: string,
  permissions: string[]
): Promise<Record<string, boolean>> {
  const [overrides, user, roleGrants] = await Promise.all([
    prisma.userPermission.findMany({
      where: { userId, permission: { in: permissions } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    getPermissionRoleGrants(userId),
  ]);

  if (!user) {
    return Object.fromEntries(permissions.map((p) => [p, false]));
  }

  const overrideMap = new Map(overrides.map((o) => [o.permission, o.granted]));

  const result: Record<string, boolean> = {};
  for (const perm of permissions) {
    // 1. Per-user override
    const override = overrideMap.get(perm);
    if (override !== undefined) {
      result[perm] = override;
      continue;
    }
    // 2. Permission role grant (most permissive — if any role grants it, it's granted)
    if (roleGrants.has(perm)) {
      result[perm] = true;
      continue;
    }
    // 3. Base role default
    const def = PERMISSION_MAP.get(perm);
    result[perm] = def ? def.defaultRoles.includes(user.role) : false;
  }

  return result;
}

// Get all effective permissions for a user (for UI display)
export async function getUserEffectivePermissions(
  userId: string
): Promise<{ permission: string; granted: boolean; source: PermissionSource; roleName?: string }[]> {
  const [overrides, user, assignments] = await Promise.all([
    prisma.userPermission.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.userPermissionRole.findMany({
      where: { userId },
      include: { permissionRole: { select: { name: true, permissions: true } } },
    }),
  ]);

  if (!user) return [];

  const overrideMap = new Map(overrides.map((o) => [o.permission, o.granted]));

  // Build a map: permission key → first role name that grants it
  const roleGrantMap = new Map<string, string>();
  for (const a of assignments) {
    for (const perm of a.permissionRole.permissions) {
      if (!roleGrantMap.has(perm)) {
        roleGrantMap.set(perm, a.permissionRole.name);
      }
    }
  }

  return PERMISSIONS.map((def) => {
    // 1. Per-user override
    const override = overrideMap.get(def.key);
    if (override !== undefined) {
      return { permission: def.key, granted: override, source: "override" as const };
    }
    // 2. Permission role grant
    const grantingRole = roleGrantMap.get(def.key);
    if (grantingRole) {
      return { permission: def.key, granted: true, source: "permission-role" as const, roleName: grantingRole };
    }
    // 3. Base role default
    return {
      permission: def.key,
      granted: def.defaultRoles.includes(user.role),
      source: "role" as const,
    };
  });
}
