/**
 * Dropsuite mappers — normalize raw API responses to ISaasBackupConnector types.
 */

import type {
  SaasBackupOrg,
  SaasBackupTenant,
  SaasBackupMailbox,
  SaasBackupAccount,
  SaasBackupHealth,
  SaasBackupTenantStatus,
  SaasBackupOneDrive,
  SaasBackupSharePoint,
  SaasBackupSharePointSite,
  SaasBackupTeams,
  SaasBackupTeamsGroup,
  SaasBackupCalendar,
  SaasBackupContact,
  SaasBackupTask,
  SaasBackupRetentionPolicy,
} from "../_interfaces/saas-backup";
import type {
  DropsuiteUser,
  DropsuiteTenant,
  DropsuiteMailbox,
  DropsuiteBackupAccount,
  DropsuiteOneDrive,
  DropsuiteSharePointDomain,
  DropsuiteSharePointSite,
  DropsuiteTeamsDomain,
  DropsuiteTeamsGroup,
  DropsuiteCalendarAccount,
  DropsuiteContactAccount,
  DropsuiteTaskAccount,
  DropsuiteRetentionPolicy,
} from "./types";

// ─── Health Derivation ──────────────────────────────────────────

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;

/** Derive backup health from last_backup timestamp and current status */
export function deriveBackupHealth(
  lastBackup: string | null,
  currentStatus: string | null
): SaasBackupHealth {
  if (!lastBackup) {
    if (currentStatus === "Preparing Backup") return "preparing";
    return "never_ran";
  }

  const statusLower = (currentStatus ?? "").toLowerCase();
  if (statusLower.includes("fail") || statusLower.includes("error")) {
    return "failed";
  }

  const age = Date.now() - new Date(lastBackup).getTime();
  if (age < MS_24H) return "healthy";
  if (age < MS_48H) return "warning";
  return "overdue";
}

// ─── User / Organization Mapper ─────────────────────────────────

/** Strip NinjaOne external ID suffixes like "[e9fd]" from org names */
function cleanOrgName(name: string): string {
  return name.replace(/\s*\[[a-f0-9]{4,}\]\s*$/i, "").trim();
}

export function mapUser(raw: DropsuiteUser): SaasBackupOrg {
  return {
    sourceToolId: "dropsuite",
    sourceId: raw.id,
    email: raw.email,
    organizationId: raw.organization_id,
    organizationName: cleanOrgName(raw.organization_name),
    authenticationToken: raw.authentication_token,
    planId: raw.plan_id ?? null,
    planName: null,  // Enriched by connector from /plans endpoint
    planType: null,
    planPrice: null,
    activeSeats: raw.active_seats,
    seatsUsed: raw.seats_used,
    seatsAvailable: raw.seats_available,
    deactivatedSeats: raw.deactivated_seats,
    requiredSeats: raw.required_seats,
    freeSharedMailboxes: raw.free_shared_mailboxes,
    paidSharedMailboxes: raw.paid_shared_mailboxes,
    // Dropsuite returns storage_used in GB — convert to bytes for consistent formatting
    storageUsedBytes: raw.storage_used * 1024 * 1024 * 1024,
    storageAvailableBytes: raw.storage_available * 1024 * 1024 * 1024,
    archive: raw.archive,
    autoLicense: raw.auto_license,
    isBusiness: raw.is_business,
    isDeactivated: raw.customer_deactivated,
    isSuspended: raw.flg_suspended,
    externalId: raw.external_id,
  };
}

// ─── Tenant Mapper ──────────────────────────────────────────────

export function mapTenant(raw: DropsuiteTenant): SaasBackupTenant {
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    domain: raw.domain,
    managedDomain: raw.managed_domain ?? null,
    tenantId: raw.tenant_id ?? null,
    type: raw.type,
    status: raw.status as SaasBackupTenantStatus,
    totalUsers: raw.total_users,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ─── Mailbox Mapper ─────────────────────────────────────────────

export function mapMailbox(raw: DropsuiteMailbox): SaasBackupMailbox {
  return {
    name: raw.name,
    email: raw.email,
    upn: raw.upn,
    isMailbox: raw.mailbox,
    licensed: raw.licensed,
    status: raw.status,
    type: raw.type,
    tenantStatus: raw.tenant_status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ─── Backup Account Mapper ──────────────────────────────────────

export function mapBackupAccount(raw: DropsuiteBackupAccount): SaasBackupAccount {
  return {
    id: raw.id,
    email: raw.email,
    displayName: raw.display_name,
    lastBackup: raw.last_backup,
    currentBackupStatus: raw.current_backup_status,
    // Dropsuite API returns account storage in KB — convert to bytes
    storageBytes: (raw.storage ?? 0) * 1024,
    msgCount: raw.msg_count ?? 0,
    isDeleted: raw.flg_deleted ?? false,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
    errors: raw.errors,
    addedOn: raw.added_on,
  };
}

// ─── OneDrive Mapper ───────────────────────────────────────────

export function mapOneDrive(raw: DropsuiteOneDrive): SaasBackupOneDrive {
  return {
    id: raw.id,
    email: raw.email,
    fileCount: raw.file_count,
    lastBackup: raw.last_backup,
    storageBytes: raw.storage ?? 0,
    errors: raw.errors ?? "",
    deactivatedSince: raw.deactivated_since,
    lastActivity: raw.last_activity,
    currentBackupStatus: raw.current_backup_status,
    addedOn: raw.added_on,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── SharePoint Mapper ─────────────────────────────────────────

export function mapSharePoint(raw: DropsuiteSharePointDomain): SaasBackupSharePoint {
  return {
    id: raw.id,
    domainName: raw.domain_name,
    siteCount: raw.site_count,
    fileCount: raw.file_count,
    storageBytes: raw.storage ?? 0,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    deactivatedSince: raw.deactivated_since,
    addedOn: raw.added_on,
    health: deriveBackupHealth(raw.last_backup, null),
  };
}

// ─── SharePoint Site Mapper ────────────────────────────────────

export function mapSharePointSite(raw: DropsuiteSharePointSite): SaasBackupSharePointSite {
  return {
    id: raw.id,
    siteName: raw.sp_site,
    fileCount: raw.file_count,
    storageBytes: raw.storage ?? 0,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    deactivatedSince: raw.deactivated_since,
    currentBackupStatus: raw.current_backup_status,
    addedOn: raw.added_on,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── Teams & Groups Mapper ─────────────────────────────────────

export function mapTeams(raw: DropsuiteTeamsDomain): SaasBackupTeams {
  return {
    id: raw.id,
    domainName: raw.domain_name,
    groupCount: raw.group_count,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    deactivatedSince: raw.deactivated_since,
    addedOn: raw.added_on,
    health: deriveBackupHealth(raw.last_backup, null),
  };
}

// ─── Teams Group Mapper ────────────────────────────────────────

export function mapTeamsGroup(raw: DropsuiteTeamsGroup): SaasBackupTeamsGroup {
  return {
    id: raw.id,
    groupName: raw.group_name,
    groupType: raw.group_type,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    deactivatedSince: raw.deactivated_since,
    currentBackupStatus: raw.current_backup_status,
    addedOn: raw.added_on,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── Calendar Mapper ───────────────────────────────────────────

export function mapCalendar(raw: DropsuiteCalendarAccount): SaasBackupCalendar {
  return {
    id: raw.id,
    email: raw.email,
    scheduleCount: raw.calendar_schedule_count,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    currentBackupStatus: raw.current_backup_status,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── Contact Mapper ────────────────────────────────────────────

export function mapContact(raw: DropsuiteContactAccount): SaasBackupContact {
  return {
    id: raw.id,
    email: raw.email,
    contactCount: raw.contact_count,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    currentBackupStatus: raw.current_backup_status,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── Task Mapper ───────────────────────────────────────────────

export function mapTask(raw: DropsuiteTaskAccount): SaasBackupTask {
  return {
    id: raw.id,
    email: raw.email,
    taskCount: raw.task_count,
    lastBackup: raw.last_backup,
    errors: raw.errors ?? "",
    currentBackupStatus: raw.current_backup_status,
    health: deriveBackupHealth(raw.last_backup, raw.current_backup_status),
  };
}

// ─── Retention Policy Mapper ───────────────────────────────────

export function mapRetentionPolicy(raw: DropsuiteRetentionPolicy): SaasBackupRetentionPolicy {
  return {
    id: raw.id,
    name: raw.name,
    retentionType: raw.retention_type,
    periodNumber: raw.period_number,
    periodUnit: raw.period_unit,
    organizationId: raw.organization_id,
  };
}
