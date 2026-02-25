/**
 * IEmailSecurityConnector — interface for email security/threat protection tools.
 *
 * Current implementation: Avanan (Check Point Harmony Email & Collaboration)
 * Future: Proofpoint, Mimecast, etc.
 *
 * Supports MSP multi-tenant via scoping — one API key queries all client tenants.
 * Includes MSP management (tenants, licenses, users, partners, usage).
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type { NormalizedAlert } from "./common";

// ── Filters ──

export interface EmailSecurityEventFilter {
  /** Event types: phishing, malware, dlp, spam, suspicious malware, anomaly, shadow_it, malicious_url_click, malicious_url, alert */
  eventTypes?: string[];
  /** Event states: new, detected, pending, remediated, dismissed, exception, in_progress */
  eventStates?: string[];
  /** Severity levels: low, medium, high, critical */
  severities?: string[];
  /** SaaS platforms: office365_emails, google_mail, ms_teams, slack, etc. */
  saas?: string[];
  /** Specific event IDs */
  eventIds?: string[];
  /** Confidence indicator */
  confidenceIndicator?: string;
  /** Start date (ISO 8601) */
  startDate?: Date;
  /** End date (ISO 8601) */
  endDate?: Date;
  /** Text search in description */
  searchTerm?: string;
  /** MSP scope — "{farm}:{tenant}" format. Omit to query all tenants. */
  scope?: string;
}

export interface EmailEntityFilter {
  /** SaaS platform to search */
  saas?: string;
  /** Entity type within the SaaS */
  saasEntity?: string;
  /** Start date (ISO 8601) */
  startDate?: Date;
  /** End date (ISO 8601) */
  endDate?: Date;
  /** Extended filters (attribute-level) */
  extendedFilters?: Array<{
    attrName: string;
    op: "is" | "contains" | "startsWith" | "isEmpty" | "isNot" | "notContains" | "isNotEmpty" | "greaterThan" | "lessThan";
    value: string;
  }>;
  /** MSP scope */
  scope?: string;
}

// ── Entity types ──

export interface EmailEntity {
  entityId: string;
  customerId: string;
  saas: string;
  saasEntityType: string;
  subject?: string;
  fromEmail?: string;
  recipients?: string[];
  receivedAt?: Date;
  size?: number;
  attachmentCount?: number;
  isRead?: boolean;
  isIncoming?: boolean;
  securityResults?: {
    ap?: string;
    dlp?: string;
    av?: string;
    clickTimeProtection?: string;
    shadowIt?: string;
  };
  availableActions?: string[];
  _raw?: unknown;
}

export interface EmailSecurityException {
  id?: string;
  type: string;
  value: string;
  comment?: string;
  entityType?: string;
  entityId?: string;
  fileName?: string;
  createdByEmail?: string;
  isExclusive?: boolean;
}

export interface ActionResult {
  entityId?: string;
  eventId?: string;
  taskId?: number;
}

export interface TaskStatus {
  taskId: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
}

/** MSP tenant scope — "{farm}:{tenant}" */
export interface TenantScope {
  scope: string;
  farm: string;
  tenant: string;
}

// ── MSP Management Types ──

export interface MspTenant {
  tenantId: string;
  tenantName: string;
  scope: string;
  status: string;
  createdAt?: string;
  licenses?: Array<{
    licenseId: string;
    licenseName: string;
    quantity: number;
    status: string;
  }>;
  userCount?: number;
}

export interface MspTenantCreateInput {
  tenantName: string;
  adminEmail: string;
  licenses?: Array<{
    licenseId: string;
    quantity: number;
  }>;
}

export interface MspLicense {
  licenseId: string;
  licenseName: string;
  description?: string;
  type: string;
}

export interface MspAddOn {
  addOnId: string;
  addOnName: string;
  description?: string;
  compatibleLicenses?: string[];
}

export interface MspPartner {
  partnerId: string;
  partnerName: string;
  status: string;
  createdAt?: string;
  tenantCount?: number;
}

export interface MspUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  tenantId?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface MspUsageRecord {
  tenantId: string;
  tenantName: string;
  period: string;
  protectedUsers: number;
  scannedEmails: number;
  threats: number;
  quarantined: number;
}

export interface ExceptionEntry {
  excId: string;
  exceptionType: string;
  exceptionStr: string;
  comment?: string;
  createdByEmail?: string;
  createdAt?: string;
  isExclusive?: boolean;
}

// ── Interface ──

export interface IEmailSecurityConnector {
  // --- Security Events (Threats) ---
  getSecurityEvents(
    filter?: EmailSecurityEventFilter,
    scrollId?: string,
  ): Promise<PaginatedResponse<NormalizedAlert>>;

  getSecurityEventById(
    eventId: string,
    scope?: string,
  ): Promise<NormalizedAlert>;

  // --- Secured Entities (Emails/Files/Messages) ---
  searchEntities(
    filter?: EmailEntityFilter,
    scrollId?: string,
  ): Promise<PaginatedResponse<EmailEntity>>;

  getEntityById(
    entityId: string,
    scope?: string,
  ): Promise<EmailEntity>;

  // --- Actions ---
  quarantineEntity(
    entityIds: string[],
    scope?: string,
  ): Promise<ActionResult[]>;

  restoreEntity(
    entityIds: string[],
    scope?: string,
  ): Promise<ActionResult[]>;

  dismissEvent(
    eventIds: string[],
    scope?: string,
  ): Promise<ActionResult[]>;

  actionOnEvent(
    eventIds: string[],
    actionName: string,
    actionParam?: string,
    scope?: string,
  ): Promise<ActionResult[]>;

  actionOnEntity(
    entityIds: string[],
    actionName: string,
    actionParam?: string,
    scope?: string,
  ): Promise<ActionResult[]>;

  // --- Task Status (async action tracking) ---
  getTaskStatus(taskId: number): Promise<TaskStatus>;

  // --- Exceptions (Allowlist/Blocklist) ---
  getExceptions(
    type: string,
  ): Promise<ExceptionEntry[]>;

  createUrlException(
    exception: EmailSecurityException,
  ): Promise<void>;

  updateException(
    vendor: string,
    excId: string,
    update: { value?: string; comment?: string; isExclusive?: boolean },
  ): Promise<void>;

  deleteException(
    vendor: string,
    excId: string,
  ): Promise<void>;

  getWhitelist(vendor: string): Promise<ExceptionEntry[]>;
  getBlacklist(vendor: string): Promise<ExceptionEntry[]>;

  createWhitelistEntry(
    vendor: string,
    entry: EmailSecurityException,
  ): Promise<void>;

  createBlacklistEntry(
    vendor: string,
    entry: EmailSecurityException,
  ): Promise<void>;

  // --- MSP Multi-Tenant ---
  getScopes(): Promise<TenantScope[]>;

  // --- MSP Tenant Management ---
  listTenants(): Promise<MspTenant[]>;
  createTenant(input: MspTenantCreateInput): Promise<MspTenant>;
  describeTenant(tenantId: string): Promise<MspTenant>;
  deleteTenant(tenantId: string): Promise<void>;
  updateTenantLicenses(
    tenantId: string,
    licenses: Array<{ licenseId: string; quantity: number }>,
  ): Promise<void>;

  // --- MSP Licenses ---
  listLicenses(): Promise<MspLicense[]>;
  listAddOns(): Promise<MspAddOn[]>;

  // --- MSP Partners ---
  listPartners(): Promise<MspPartner[]>;
  createPartner(input: { partnerName: string; adminEmail: string }): Promise<MspPartner>;
  deletePartner(partnerId: string): Promise<void>;

  // --- MSP Users ---
  listUsers(tenantId?: string): Promise<MspUser[]>;
  createUser(input: { email: string; firstName?: string; lastName?: string; role: string; tenantId?: string }): Promise<MspUser>;
  updateUser(userId: string, input: { firstName?: string; lastName?: string; role?: string; status?: string }): Promise<MspUser>;
  deleteUser(userId: string): Promise<void>;

  // --- MSP Usage ---
  getUsage(period: "monthly" | "daily", startDate?: string, endDate?: string): Promise<MspUsageRecord[]>;

  // --- Download ---
  downloadEntity(
    entityId: string,
    original?: boolean,
    scope?: string,
  ): Promise<Buffer>;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
