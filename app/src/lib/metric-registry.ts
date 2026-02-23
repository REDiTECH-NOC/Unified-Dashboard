import type { LucideIcon } from "lucide-react";
import {
  Ticket,
  AlertTriangle,
  MonitorX,
  Server,
  Monitor,
  Shield,
  ShieldAlert,
  ShieldCheck,
  HardDrive,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Wifi,
  Phone,
  PhoneMissed,
  Voicemail,
  Cloud,
  ArrowDownCircle,
  Timer,
  Lock,
  RefreshCw,
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
  { id: "open-tickets",       label: "Open Tickets",         description: "Total open ticket count",                   icon: Ticket,          group: "Tickets",  placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "unassigned-tickets", label: "Unassigned Tickets",   description: "Tickets with no tech assigned",             icon: Ticket,          group: "Tickets",  placeholderValue: "—", iconColor: "bg-orange-500/10 text-orange-500" },
  { id: "overdue-tickets",    label: "Overdue Tickets",      description: "Tickets past their due date",               icon: Clock,           group: "Tickets",  placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "tickets-today",      label: "Tickets Created Today",description: "New tickets opened today",                  icon: Ticket,          group: "Tickets",  placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },
  { id: "tickets-closed",     label: "Tickets Closed Today", description: "Tickets resolved today",                    icon: CheckCircle2,    group: "Tickets",  placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
  { id: "my-open-tickets",    label: "My Open Tickets",      description: "Open tickets assigned to you",              icon: UserCheck,       group: "Tickets",  placeholderValue: "—", iconColor: "bg-purple-500/10 text-purple-500" },
  { id: "avg-resolution",     label: "Avg Resolution Time",  description: "Average ticket close time",                 icon: Timer,           group: "Tickets",  placeholderValue: "—", iconColor: "bg-cyan-500/10 text-cyan-500" },
  { id: "waiting-on-client",  label: "Waiting on Client",    description: "Tickets in client-waiting status",          icon: Clock,           group: "Tickets",  placeholderValue: "—", iconColor: "bg-yellow-500/10 text-yellow-500" },

  // ── Security (EDR/MDR) ──
  { id: "active-alerts",      label: "Active Alerts",        description: "Combined alerts across all sources",        icon: AlertTriangle,   group: "Security", placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "s1-threats",         label: "S1 Active Threats",    description: "SentinelOne unresolved threats",             icon: ShieldAlert,     group: "Security", placeholderValue: "—", iconColor: "bg-purple-500/10 text-purple-500" },
  { id: "blackpoint-alerts",  label: "Blackpoint Alerts",    description: "Active Blackpoint alerts",                  icon: Shield,          group: "Security", placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },
  { id: "huntress-incidents", label: "Huntress Incidents",   description: "Active Huntress incidents",                 icon: ShieldCheck,     group: "Security", placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
  { id: "total-security",     label: "Total Security Alerts",description: "Combined across all EDR/MDR",               icon: Shield,          group: "Security", placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },

  // ── RMM (NinjaRMM) ──
  { id: "ninja-alerts",       label: "Ninja Alerts",         description: "Unresolved NinjaRMM alerts",                icon: AlertTriangle,   group: "RMM",      placeholderValue: "—", iconColor: "bg-orange-500/10 text-orange-500" },
  { id: "devices-need-patch", label: "Devices Needing Patch",description: "Patch compliance gap",                      icon: HardDrive,       group: "RMM",      placeholderValue: "—", iconColor: "bg-amber-500/10 text-amber-500" },
  { id: "servers-offline",    label: "Servers Offline",       description: "Server-class devices not responding",       icon: Server,          group: "RMM",      placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "workstations-off",   label: "Workstations Offline", description: "Workstation-class devices offline",          icon: Monitor,         group: "RMM",      placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "devices-reboot",     label: "Needs Reboot",         description: "Devices with pending reboot",               icon: RefreshCw,       group: "RMM",      placeholderValue: "—", iconColor: "bg-yellow-500/10 text-yellow-500" },

  // ── Monitoring (Built-in Uptime) ──
  { id: "monitors-down",      label: "Monitors Down",        description: "Currently failing uptime monitors",         icon: MonitorX,        group: "Monitoring", placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "monitors-up",        label: "Monitors Up",          description: "Healthy uptime monitor count",              icon: CheckCircle2,    group: "Monitoring", placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
  { id: "avg-response",       label: "Avg Response Time",    description: "Average latency across monitors",           icon: Timer,           group: "Monitoring", placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },
  { id: "ssl-expiring",       label: "SSL Certs Expiring",   description: "Certs expiring within 30 days",             icon: Lock,            group: "Monitoring", placeholderValue: "—", iconColor: "bg-orange-500/10 text-orange-500" },

  // ── Backup ──
  { id: "failed-backups",     label: "Failed Backups",       description: "Cross-vendor failed backup count",          icon: XCircle,         group: "Backup",   placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "backup-success",     label: "Backup Success Rate",  description: "% successful in last 24h",                  icon: CheckCircle2,    group: "Backup",   placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
  { id: "backups-overdue",    label: "Backups Overdue",      description: "Missed scheduled backups",                  icon: Clock,           group: "Backup",   placeholderValue: "—", iconColor: "bg-orange-500/10 text-orange-500" },

  // ── Network ──
  { id: "net-devices-off",    label: "Network Devices Off",  description: "Offline APs, switches, routers",            icon: Wifi,            group: "Network",  placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "clients-connected",  label: "Clients Connected",    description: "Total connected wireless/wired clients",    icon: Wifi,            group: "Network",  placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },
  { id: "firmware-updates",   label: "Firmware Updates",     description: "Devices needing firmware update",            icon: ArrowDownCircle, group: "Network",  placeholderValue: "—", iconColor: "bg-amber-500/10 text-amber-500" },

  // ── Phone (3CX) ──
  { id: "active-calls",       label: "Active Calls",         description: "Current live calls across PBXs",            icon: Phone,           group: "Phone",    placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
  { id: "missed-calls",       label: "Missed Calls Today",   description: "Missed call count for today",               icon: PhoneMissed,     group: "Phone",    placeholderValue: "—", iconColor: "bg-red-500/10 text-red-500" },
  { id: "voicemails-pending", label: "Voicemails Pending",   description: "Unprocessed voicemails in queue",            icon: Voicemail,       group: "Phone",    placeholderValue: "—", iconColor: "bg-purple-500/10 text-purple-500" },

  // ── Microsoft 365 ──
  { id: "m365-issues",        label: "M365 Service Issues",  description: "Active Microsoft 365 service incidents",    icon: Cloud,           group: "Microsoft", placeholderValue: "—", iconColor: "bg-blue-500/10 text-blue-500" },

  // ── System ──
  { id: "system-status",      label: "System Status",        description: "All services health at a glance",           icon: Server,          group: "System",    placeholderValue: "—", iconColor: "bg-green-500/10 text-green-500" },
];

export const METRIC_MAP = new Map(METRIC_REGISTRY.map((m) => [m.id, m]));

export const METRIC_GROUPS = Array.from(new Set(METRIC_REGISTRY.map((m) => m.group)));
