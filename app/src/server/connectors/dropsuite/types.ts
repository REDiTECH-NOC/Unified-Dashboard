/**
 * Raw Dropsuite REST API response types.
 *
 * These match the Dropsuite "REST API for Sub-reseller v1.00" specification.
 * All types are raw API shapes — normalized via mappers before use.
 */

// ─── Users / Organizations ──────────────────────────────────────

export interface DropsuiteUser {
  id: string;
  email: string;
  organization_id: number;
  plan_id: string;
  reseller_token: string;
  authentication_token: string;
  notification_email: string[];
  external_id: string | null;
  is_business: boolean;
  admin: boolean;
  customer_deactivated: boolean;
  seats_used: number;
  seats_available: number;
  storage_used: number;
  storage_available: number;
  archive: boolean;
  backup_summary: unknown | null;
  login_disabled: boolean;
  flg_suspended: boolean;
  organization_name: string;
  auto_license: boolean;
  deactivated_seats: number;
  active_seats: number;
  required_seats: number;
  paid_shared_mailboxes: number;
  free_shared_mailboxes: number;
}

// ─── Tenants ────────────────────────────────────────────────────

export interface DropsuiteTenant {
  id: number;
  organization_id: number;
  created_at: string;
  updated_at: string;
  domain: string;
  managed_domain?: string;
  tenant_id?: string;
  status: number;
  total_users: number;
  type: "m365" | "gws";
}

// ─── Tenant Mailboxes ───────────────────────────────────────────

export interface DropsuiteMailbox {
  name: string;
  email: string;
  upn: string;
  mailbox: boolean;
  licensed: boolean | null;
  status: "active" | "excluded" | "available" | null;
  type: "m365" | "gws";
  tenant_status: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Backup Accounts ────────────────────────────────────────────

export interface DropsuiteBackupAccount {
  id: number;
  last_backup: string | null;
  deactivated_since?: string | null;
  email: string;
  display_name: string | null;
  username: string | null;
  storage: number;
  msg_count: number;
  flg_deleted: boolean;
  errors: Record<string, string> | null;
  current_backup_status: string | null;
  added_on: string;
  user?: {
    id: number;
    email: string;
    authentication_token: string;
    reseller_token: string;
    external_id: string | null;
    is_business: boolean;
    admin: boolean;
    customer_deactivated: boolean;
    seats_used: number;
    seats_available: number;
    storage_used: number;
    storage_available: number;
    archive: boolean;
    organization_id: number;
    backup_summary: unknown[];
    login_disabled: boolean;
    flg_suspended: boolean;
  };
}

// ─── Paginated Responses ────────────────────────────────────────

export interface DropsuitePagination {
  current_page: number;
  per_page: number;
  next_page?: number;
  next_url?: string;
  prev_page?: number;
  prev_url?: string;
}

export interface DropsuitePaginatedResponse<T> {
  pagination: DropsuitePagination;
  data: T[];
}

// ─── Delegated Users ────────────────────────────────────────────

export interface DropsuiteDelegatedUser {
  id: string;
  email: string;
  role: string;
  login_enabled: boolean;
  activated: boolean;
  authentication_token: string;
  created_at: string;
  updated_at: string;
}

// ─── Plans ──────────────────────────────────────────────────────

export interface DropsuitePlan {
  id: string;
  name: string;
  currency: string;
  data_storage: string;
  periodicity: string;
  amount: string;
  product_type: string;
}

// ─── Retention Policies ─────────────────────────────────────────

export interface DropsuiteRetentionPolicy {
  id: number;
  name: string;
  retention_type: string;
  item_ids: string[] | null;
  account_id: number;
  organization_id: number;
  created_at: string;
  updated_at: string;
  period_number: number;
  period_unit: "days" | "months" | "years";
}

// ─── Backup Data Endpoints ──────────────────────────────────────

/** Journal email data (individual journal entry) */
export interface DropsuiteJournalEntry {
  id: number;
  email: string;
  subject: string;
  date: string;
  from: string;
  to: string[];
}

/** Journal mailbox / account configuration (from GET /journals) */
export interface DropsuiteJournalAccount {
  id: number;
  email: string;
  organization_id: number;
  display_name: string | null;
  storage: number;
  msg_count: number;
  added_on: string;
  last_backup: string | null;
  current_backup_status: string | null;
}

export interface DropsuiteCalendar {
  id: number;
  email: string;
  subject: string;
  start_time: string;
  end_time: string;
}

export interface DropsuiteContact {
  id: number;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

// ─── OneDrive Backup ────────────────────────────────────────────

export interface DropsuiteOneDrive {
  id: number;
  email: string;
  file_count: number;
  last_backup: string | null;
  storage: number; // bytes
  errors: string;
  deactivated_since: string | null;
  last_activity: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── SharePoint Backup ─────────────────────────────────────────

export interface DropsuiteSharePointDomain {
  id: number;
  domain_name: string;
  site_count: number;
  file_count: number;
  storage: number; // bytes
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  added_on: string;
}

// ─── Teams & Groups Backup ─────────────────────────────────────

export interface DropsuiteTeamsDomain {
  id: number;
  domain_name: string;
  group_count: number;
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  added_on: string;
}

// ─── Calendar Backup ───────────────────────────────────────────

export interface DropsuiteCalendarAccount {
  id: number;
  email: string;
  calendar_schedule_count: number;
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── Contact Backup ────────────────────────────────────────────

export interface DropsuiteContactAccount {
  id: number;
  email: string;
  contact_count: number;
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── Task Backup ───────────────────────────────────────────────

export interface DropsuiteTaskAccount {
  id: number;
  email: string;
  task_count: number;
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── NDR Journal ───────────────────────────────────────────────

export interface DropsuiteNdrJournal {
  id: number;
  email: string;
}

// ─── SharePoint Site (per-site within a domain) ─────────────────

export interface DropsuiteSharePointSite {
  id: number;
  sp_site: string;
  file_count: number;
  storage: number; // bytes
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── Teams Group (per-group within a domain) ────────────────────

export interface DropsuiteTeamsGroup {
  id: number;
  group_name: string;
  group_type: string; // "Private" | "Public"
  last_backup: string | null;
  errors: string;
  deactivated_since: string | null;
  current_backup_status: string | null;
  added_on: string;
}

// ─── Tenant Status Codes ────────────────────────────────────────

export const TENANT_STATUS_LABELS: Record<number, string> = {
  0: "Queued",
  1: "Recreate Application",
  5: "Processing",
  7: "Completed",
  13: "Recreate Application",
};
