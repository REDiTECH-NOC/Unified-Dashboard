/**
 * Normalized types — the unified schema all connectors map into.
 *
 * tRPC routers and the UI only work with these types, never with vendor-specific
 * API responses. This is what makes connectors swappable: replace NinjaOne with
 * Datto RMM and the rest of the app doesn't change because it only speaks these types.
 *
 * Every normalized type has:
 * - sourceToolId: which tool this data came from (e.g., "connectwise", "ninjaone")
 * - sourceId: the record's ID in the source system
 * - _raw: optional full vendor response for debugging / AI analysis (never sent to frontend)
 */

/** Unified company/organization across all tools */
export interface NormalizedOrganization {
  sourceToolId: string;
  sourceId: string;
  name: string;
  phone?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  status?: string;
  _raw?: unknown;
}

/** Unified device/endpoint/agent/configuration */
export interface NormalizedDevice {
  sourceToolId: string;
  sourceId: string;
  hostname: string;
  organizationSourceId?: string;
  organizationName?: string;
  os?: string;
  osVersion?: string;
  publicIp?: string;
  privateIp?: string;
  macAddress?: string;
  lastSeen?: Date;
  status: "online" | "offline" | "warning" | "unknown";
  agentVersion?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  deviceType?: "workstation" | "server" | "laptop" | "mobile" | "network" | "other";
  /** Tool-specific metadata (custom fields, group info, etc.) */
  metadata?: Record<string, unknown>;
  _raw?: unknown;
}

/** Unified service ticket */
export interface NormalizedTicket {
  sourceToolId: string;
  sourceId: string;
  summary: string;
  description?: string;
  status: string;
  priority: "critical" | "high" | "medium" | "low" | "none";
  /** Mapped severity score 1-10 for cross-tool comparison */
  severityScore?: number;
  type?: string;
  board?: string;
  companySourceId?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt?: Date;
  closedAt?: Date;
  /** URL to view this ticket in the source system */
  sourceUrl?: string;
  _raw?: unknown;
}

/** Unified security threat/incident */
export interface NormalizedThreat {
  sourceToolId: string;
  sourceId: string;
  title: string;
  description?: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  severityScore: number;
  status: "active" | "mitigated" | "resolved" | "in_progress";
  classification?: string;
  /** The device this threat was found on */
  deviceHostname?: string;
  deviceSourceId?: string;
  organizationName?: string;
  organizationSourceId?: string;
  /** File hash, process, path, etc. */
  indicators?: {
    filePath?: string;
    fileHash?: string;
    processName?: string;
    networkTarget?: string;
  };
  detectedAt: Date;
  resolvedAt?: Date;
  /** Available actions for this threat */
  availableActions?: string[];
  sourceUrl?: string;
  _raw?: unknown;
}

/** Unified alert from any tool */
export interface NormalizedAlert {
  sourceToolId: string;
  sourceId: string;
  title: string;
  message?: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  severityScore: number;
  category: "security" | "performance" | "availability" | "compliance" | "other";
  status: "new" | "acknowledged" | "resolved" | "escalated";
  deviceHostname?: string;
  deviceSourceId?: string;
  organizationName?: string;
  organizationSourceId?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  sourceUrl?: string;
  _raw?: unknown;
}

/** Unified contact/person */
export interface NormalizedContact {
  sourceToolId: string;
  sourceId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  organizationSourceId?: string;
  organizationName?: string;
  _raw?: unknown;
}

/** Unified credential (password + optional TOTP) */
export interface NormalizedCredential {
  sourceToolId: string;
  sourceId: string;
  name: string;
  username?: string;
  /** Password value — handle with extreme care, auto-clear after 60s */
  password?: string;
  /** OTP/TOTP seed for code generation */
  otpSecret?: string;
  /** Current TOTP code (generated at retrieval time, not stored) */
  currentOtpCode?: string;
  url?: string;
  notes?: string;
  organizationSourceId?: string;
  organizationName?: string;
  resourceType?: string;
  resourceSourceId?: string;
  updatedAt?: Date;
  _raw?: unknown;
}

/** Unified document/KB article */
export interface NormalizedDocument {
  sourceToolId: string;
  sourceId: string;
  title: string;
  content?: string;
  /** Document type (e.g., "flexible_asset", "configuration", "password") */
  documentType: string;
  organizationSourceId?: string;
  organizationName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  sourceUrl?: string;
  _raw?: unknown;
}
