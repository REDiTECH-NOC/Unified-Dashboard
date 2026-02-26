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
  id: number;
  domain: string;
  companyName: string;
  deploymentMode: string;
  users: number | null;
  maxLicensedUsers: number | null;
  status: string;
  statusDescription: string;
  packageName: string;
  packageCodeName: string;
  addons: Array<{ id: number; name: string }>;
  isDeleted: boolean;
  tenantRegion: string;
  pocDateStart?: string;
  pocDateExpiration?: string;
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
  id: number;
  codeName: string;
  displayName: string;
}

export interface MspAddOn {
  id: number;
  name: string;
}

/**
 * MSP User — fields exposed by the SmartAPI.
 * Note: MSP-level settings (tenant access, MSP role, permissions, drill-down)
 * are managed in the Avanan portal only and not exposed via SmartAPI.
 */
export interface MspUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  /** Portal role: "admin" | "operations" | "user" | "read-only" */
  role: string;
  sendAlerts?: boolean;
  receiveWeeklyReports?: boolean;
  /** Password login enabled */
  directLogin?: boolean;
  /** SAML/SSO login enabled */
  samlLogin?: boolean;
  /** Can view private user data on customer portal */
  viewPrivateData?: boolean;
}

export interface MspUserCreateInput {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  directLogin?: boolean;
  samlLogin?: boolean;
  viewPrivateData?: boolean;
  sendAlerts?: boolean;
  receiveWeeklyReports?: boolean;
}

export interface MspUserUpdateInput {
  firstName?: string;
  lastName?: string;
  role?: string;
  directLogin?: boolean;
  samlLogin?: boolean;
  viewPrivateData?: boolean;
  sendAlerts?: boolean;
  receiveWeeklyReports?: boolean;
  /** MSP role — write-only (not returned by LIST). Values: "Admin" | "Help Desk" */
  mspRole?: string;
  /** Tenant access mode — write-only. Values: "All" | "Except" | "Only" */
  mspTenantAccess?: string;
  /** Tenant IDs for Except/Only mode — write-only */
  mspTenants?: number[];
}

export interface MspUsageRecord {
  day: string;
  tenantDomain: string;
  licenseCodeName: string;
  users: number;
  dailyPrice: number;
  cost: number;
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
  describeTenant(tenantId: string): Promise<MspTenant>;

  // --- MSP Licenses ---
  listLicenses(): Promise<MspLicense[]>;
  listAddOns(): Promise<MspAddOn[]>;

  // --- MSP Users ---
  listUsers(): Promise<MspUser[]>;
  createUser(input: MspUserCreateInput): Promise<MspUser>;
  updateUser(userId: number, input: MspUserUpdateInput): Promise<MspUser>;
  deleteUser(userId: number): Promise<void>;

  // --- MSP Usage ---
  getUsage(year: number, month: number): Promise<MspUsageRecord[]>;

  // --- Download ---
  downloadEntity(
    entityId: string,
    original?: boolean,
    scope?: string,
  ): Promise<Buffer>;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
