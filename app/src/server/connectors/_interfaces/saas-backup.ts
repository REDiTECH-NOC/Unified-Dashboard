/**
 * SaaS Backup Connector Interface — normalized types and contract for SaaS backup monitoring.
 *
 * Designed for Dropsuite (NinjaOne SaaS Backup) but generic enough for any future SaaS backup tool.
 * Models the SaaS-specific hierarchy: Organizations → Tenants → Mailboxes/Accounts.
 *
 * This is intentionally separate from IBackupConnector (device-level backup) because SaaS backup
 * has a fundamentally different data model (no OS types, no data sources, no color bars).
 */

import type { HealthCheckResult } from "../_base/types";
import type { NormalizedAlert } from "./common";

// ─── Enums & Unions ──────────────────────────────────────────────

/** Tenant platform type */
export type SaasBackupTenantType = "m365" | "gws";

/** Mailbox backup status */
export type SaasBackupMailboxStatus = "active" | "excluded" | "available";

/** Account backup health derived from last_backup age */
export type SaasBackupHealth =
  | "healthy"      // Last backup < 24h ago
  | "warning"      // Last backup 24-48h ago
  | "overdue"      // Last backup > 48h ago
  | "failed"       // Current status is failed/error
  | "preparing"    // First backup in progress
  | "never_ran"    // No backup ever completed
  | "unknown";

/** Tenant connection status codes (from Dropsuite API) */
export type SaasBackupTenantStatus = 0 | 1 | 5 | 7 | 13;

// ─── Normalized Types ────────────────────────────────────────────

/** Organization-level summary (maps to a Dropsuite "user" / subscription) */
export interface SaasBackupOrg {
  sourceToolId: string;
  sourceId: string;
  email: string;
  organizationId: number;
  organizationName: string;
  authenticationToken: string;
  planId: string | null;
  planName: string | null;
  planType: string | null;
  planPrice: string | null;
  activeSeats: number;
  seatsUsed: number;
  seatsAvailable: number;
  deactivatedSeats: number;
  requiredSeats: number;
  freeSharedMailboxes: number;
  paidSharedMailboxes: number;
  storageUsedBytes: number;
  storageAvailableBytes: number;
  archive: boolean;
  autoLicense: boolean;
  isBusiness: boolean;
  isDeactivated: boolean;
  isSuspended: boolean;
  externalId: string | null;
}

/** Journal mailbox configuration for an organization */
export interface SaasBackupJournal {
  id: number;
  email: string;
  organizationId: number;
}

/** Tenant within an organization (M365 or Google Workspace domain) */
export interface SaasBackupTenant {
  id: number;
  organizationId: number;
  domain: string;
  managedDomain: string | null;
  tenantId: string | null;
  type: SaasBackupTenantType;
  status: SaasBackupTenantStatus;
  totalUsers: number;
  createdAt: string;
  updatedAt: string;
}

/** Individual mailbox/user within a tenant */
export interface SaasBackupMailbox {
  name: string;
  email: string;
  upn: string;
  isMailbox: boolean;
  licensed: boolean | null;
  status: SaasBackupMailboxStatus | null;
  type: SaasBackupTenantType;
  tenantStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backup account with live backup status */
export interface SaasBackupAccount {
  id: number;
  email: string;
  displayName: string | null;
  lastBackup: string | null;
  currentBackupStatus: string | null;
  storageBytes: number;
  msgCount: number;
  isDeleted: boolean;
  health: SaasBackupHealth;
  errors: Record<string, string> | null;
  addedOn: string;
}

/** OneDrive backup per-user */
export interface SaasBackupOneDrive {
  id: number;
  email: string;
  fileCount: number;
  lastBackup: string | null;
  storageBytes: number;
  errors: string;
  deactivatedSince: string | null;
  lastActivity: string | null;
  currentBackupStatus: string | null;
  addedOn: string;
  health: SaasBackupHealth;
}

/** SharePoint domain backup */
export interface SaasBackupSharePoint {
  id: number;
  domainName: string;
  siteCount: number;
  fileCount: number;
  storageBytes: number;
  lastBackup: string | null;
  errors: string;
  deactivatedSince: string | null;
  addedOn: string;
  health: SaasBackupHealth;
}

/** Teams & Groups domain backup */
export interface SaasBackupTeams {
  id: number;
  domainName: string;
  groupCount: number;
  lastBackup: string | null;
  errors: string;
  deactivatedSince: string | null;
  addedOn: string;
  health: SaasBackupHealth;
}

/** Calendar backup per-user */
export interface SaasBackupCalendar {
  id: number;
  email: string;
  scheduleCount: number;
  lastBackup: string | null;
  errors: string;
  currentBackupStatus: string | null;
  health: SaasBackupHealth;
}

/** Contact backup per-user */
export interface SaasBackupContact {
  id: number;
  email: string;
  contactCount: number;
  lastBackup: string | null;
  errors: string;
  currentBackupStatus: string | null;
  health: SaasBackupHealth;
}

/** Task backup per-user */
export interface SaasBackupTask {
  id: number;
  email: string;
  taskCount: number;
  lastBackup: string | null;
  errors: string;
  currentBackupStatus: string | null;
  health: SaasBackupHealth;
}

/** Individual SharePoint site backup */
export interface SaasBackupSharePointSite {
  id: number;
  siteName: string;
  fileCount: number;
  storageBytes: number;
  lastBackup: string | null;
  errors: string;
  deactivatedSince: string | null;
  currentBackupStatus: string | null;
  addedOn: string;
  health: SaasBackupHealth;
}

/** Individual Teams/Groups group backup */
export interface SaasBackupTeamsGroup {
  id: number;
  groupName: string;
  groupType: string;
  lastBackup: string | null;
  errors: string;
  deactivatedSince: string | null;
  currentBackupStatus: string | null;
  addedOn: string;
  health: SaasBackupHealth;
}

/** NDR Journal mailbox */
export interface SaasBackupNdrJournal {
  id: number;
  email: string;
}

/** Retention Policy */
export interface SaasBackupRetentionPolicy {
  id: number;
  name: string;
  retentionType: string;
  periodNumber: number;
  periodUnit: string;
  organizationId: number;
}

/** Dashboard-level summary across all organizations */
export interface SaasBackupDashboardSummary {
  totalOrgs: number;
  totalActiveSeats: number;
  totalDeactivatedSeats: number;
  totalFreeSharedMailboxes: number;
  totalStorageBytes: number;
  archiveOrgs: number;
  orgHealthRollup: Record<SaasBackupHealth, number>;
  connectionFailures: number;
  /** Per-org seat breakdown for quick reference */
  orgSeatSummaries: Array<{
    orgName: string;
    orgId: string;
    activeSeats: number;
    deactivatedSeats: number;
    freeSharedMailboxes: number;
    archive: boolean;
    /** Computed storage from summing per-account storage (bytes) */
    storageBytes: number;
  }>;
}

// ─── Pagination ──────────────────────────────────────────────────

export interface SaasBackupPagination {
  currentPage: number;
  perPage: number;
  nextPage?: number;
  prevPage?: number;
}

export interface SaasBackupPaginatedResponse<T> {
  pagination: SaasBackupPagination;
  data: T[];
}

// ─── Interface ───────────────────────────────────────────────────

export interface ISaasBackupConnector {
  /** List all organizations (subscriptions) with seat counts */
  getOrganizations(): Promise<SaasBackupOrg[]>;

  /** Get tenants (M365/GWS domains) for a specific organization */
  getOrganizationTenants(
    orgSourceId: string,
    orgAuthToken: string,
    type?: SaasBackupTenantType
  ): Promise<SaasBackupTenant[]>;

  /** Get mailboxes within a tenant */
  getTenantMailboxes(
    orgSourceId: string,
    orgAuthToken: string,
    tenantId: number,
    type: SaasBackupTenantType,
    status?: SaasBackupMailboxStatus
  ): Promise<SaasBackupMailbox[]>;

  /** Get backup accounts with live status for an organization */
  getBackupAccounts(orgAuthToken: string): Promise<SaasBackupAccount[]>;

  /** Get deactivated backup accounts */
  getDeactivatedAccounts(orgAuthToken: string): Promise<SaasBackupAccount[]>;

  /** Get accounts with connection failures */
  getConnectionFailures(orgAuthToken: string): Promise<SaasBackupAccount[]>;

  /** Get journal mailbox configuration for an organization */
  getJournals(orgAuthToken: string): Promise<SaasBackupJournal[]>;

  /** Get NDR journal mailbox for an organization */
  getNdrJournal(orgAuthToken: string): Promise<SaasBackupNdrJournal | null>;

  /** Get OneDrive backups for an organization */
  getOneDrives(orgAuthToken: string): Promise<SaasBackupOneDrive[]>;

  /** Get SharePoint domain backups for an organization */
  getSharePoints(orgAuthToken: string): Promise<SaasBackupSharePoint[]>;

  /** Get individual SharePoint sites for a domain */
  getSharePointSites(domainId: number, orgAuthToken: string): Promise<SaasBackupSharePointSite[]>;

  /** Get Teams & Groups domain backups for an organization */
  getTeamsAndGroups(orgAuthToken: string): Promise<SaasBackupTeams[]>;

  /** Get individual Teams groups for a domain */
  getTeamsGroups(domainId: number, orgAuthToken: string): Promise<SaasBackupTeamsGroup[]>;

  /** Get calendar backups for an organization */
  getCalendars(orgAuthToken: string): Promise<SaasBackupCalendar[]>;

  /** Get contact backups for an organization */
  getContacts(orgAuthToken: string): Promise<SaasBackupContact[]>;

  /** Get task backups for an organization */
  getTasks(orgAuthToken: string): Promise<SaasBackupTask[]>;

  /** Get retention policies for an organization */
  getRetentionPolicies(orgSourceId: string, orgAuthToken: string): Promise<SaasBackupRetentionPolicy[]>;

  /** Aggregated dashboard summary across all orgs */
  getDashboardSummary(): Promise<SaasBackupDashboardSummary>;

  /** Generate alerts from failed/overdue/warning backup accounts */
  getActiveAlerts(): Promise<NormalizedAlert[]>;

  /** Validate credentials */
  healthCheck(): Promise<HealthCheckResult>;
}
