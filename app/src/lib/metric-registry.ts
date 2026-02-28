import type { LucideIcon } from "lucide-react";
import {
  UserCheck,
  Phone,
  Server,
  ShieldAlert,
  Shield,
  Monitor,
  HardDrive,
  Activity,
  Mail,
  Globe,
  Laptop,
} from "lucide-react";

// ─── Metric Tile Definition ───────────────────────────────────────
// Each metric tile available in the Key Metrics module config.

export interface MetricDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: string;
  /** Static placeholder value shown before integration data flows */
  placeholderValue: string;
  /** Color class for the icon background */
  iconColor: string;
}

export const METRIC_REGISTRY: MetricDef[] = [
  // ── Tickets (PSA) ──
  { id: "my-open-tickets",    label: "My Tickets",           description: "Your assigned open tickets with status breakdown", icon: UserCheck,  group: "Tickets",   placeholderValue: "—", iconColor: "bg-purple-500/10 text-purple-500" },

  // ── Security ──
  { id: "s1-threats",         label: "S1 Threats",           description: "SentinelOne active threat count",            icon: ShieldAlert, group: "Security", placeholderValue: "—", iconColor: "bg-purple-500/10 text-purple-500" },
  { id: "bp-alerts",          label: "BP Detections",        description: "Blackpoint detection count",                 icon: Shield,     group: "Security",  placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },
  { id: "ninja-alerts",       label: "RMM Alerts",           description: "NinjaRMM active alert count",               icon: Monitor,    group: "Security",  placeholderValue: "—", iconColor: "bg-emerald-500/10 text-emerald-500" },

  // ── Backup ──
  { id: "failed-backups",     label: "Failed Backups",       description: "Cove + Dropsuite failed backup count",       icon: HardDrive,  group: "Backup",    placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "backups-overdue",    label: "Overdue Backups",      description: "Backups not completed in 24h",               icon: HardDrive,  group: "Backup",    placeholderValue: "—", iconColor: "bg-orange-500/10 text-orange-500" },

  // ── Uptime ──
  { id: "monitors-down",      label: "Monitors Down",        description: "Monitors currently in DOWN state",           icon: Activity,   group: "Uptime",    placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },

  // ── RMM ──
  { id: "endpoints-online",   label: "Endpoints Online",     description: "Devices online from NinjaRMM fleet",         icon: Laptop,     group: "RMM",       placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },

  // ── Email ──
  { id: "email-threats",      label: "Email Threats",        description: "Phishing + malware events (30 days)",        icon: Mail,       group: "Email",     placeholderValue: "—", iconColor: "bg-amber-500/10 text-amber-500" },

  // ── DNS ──
  { id: "dns-blocked",        label: "DNS Blocked",          description: "Blocked DNS threats",                        icon: Globe,      group: "DNS",       placeholderValue: "—", iconColor: "bg-violet-500/10 text-violet-500" },

  // ── Phone (3CX) ──
  { id: "active-calls",       label: "Active Calls",         description: "Current live calls across PBXs",             icon: Phone,      group: "Phone",     placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },

  // ── System ──
  { id: "system-status",      label: "System Status",        description: "All services health at a glance",            icon: Server,     group: "System",    placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
];

export const METRIC_MAP = new Map(METRIC_REGISTRY.map((m) => [m.id, m]));

export const METRIC_GROUPS = Array.from(new Set(METRIC_REGISTRY.map((m) => m.group)));
