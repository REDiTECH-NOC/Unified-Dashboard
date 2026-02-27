/**
 * Backup Connector Interface — normalized types and contract for backup monitoring.
 *
 * Designed for N-able Cove Data Protection but generic enough for DropSuite (NinjaOne SaaS Backup) or
 * any future backup tool. All routers and UI use these types exclusively.
 */

import type { HealthCheckResult } from "../_base/types";
import type { NormalizedAlert } from "./common";

// ─── Enums & Unions ──────────────────────────────────────────────

/** Maps Cove F00 session status codes to human-readable states */
export type BackupSessionStatus =
  | "in_process"
  | "failed"
  | "aborted"
  | "completed"
  | "interrupted"
  | "not_started"
  | "completed_with_errors"
  | "in_progress_with_faults"
  | "over_quota"
  | "no_selection"
  | "restarted";

/** Aggregated device-level backup health */
export type BackupOverallStatus =
  | "healthy"
  | "warning"
  | "failed"
  | "overdue"
  | "offline"
  | "never_ran"
  | "unknown";

/** Backup data source types */
export type BackupDataSourceType =
  | "files"
  | "system_state"
  | "mssql"
  | "vss_mssql"
  | "exchange"
  | "vss_exchange"
  | "sharepoint"
  | "vss_sharepoint"
  | "network_shares"
  | "vmware"
  | "hyperv"
  | "oracle"
  | "mysql"
  | "vdr"
  | "bmr"
  | "m365_exchange"
  | "m365_onedrive"
  | "m365_sharepoint"
  | "m365_teams"
  | "total";

// ─── Normalized Types ────────────────────────────────────────────

/** One day in the 28-day backup history color bar */
export interface ColorBarDay {
  date: string;
  status: "success" | "partial" | "failed" | "missed" | "running" | "none";
}

/** Per-data-source stats within a backup device */
export interface NormalizedBackupDataSource {
  type: BackupDataSourceType;
  label: string;
  lastSessionStatus: BackupSessionStatus | null;
  lastSessionTimestamp: Date | null;
  lastSuccessfulTimestamp: Date | null;
  selectedCount: number | null;
  processedCount: number | null;
  selectedSizeBytes: number | null;
  processedSizeBytes: number | null;
  errorsCount: number | null;
  protectedSizeBytes: number | null;
  sessionDurationSeconds: number | null;
  licenseItems: number | null;
  colorBar28Days: ColorBarDay[];
}

/** A backup device with overall status and per-source breakdown */
export interface NormalizedBackupDevice {
  sourceToolId: string;
  sourceId: string;
  deviceName: string;
  computerName: string;
  customerSourceId: string;
  customerName: string;
  os: string | null;
  osType: "workstation" | "server" | null;
  internalIps: string | null;
  agentVersion: string | null;
  activeDataSources: string[];
  overallStatus: BackupOverallStatus;
  usedStorageBytes: number;
  storageStatus: "offline" | "failed" | "undefined" | "running" | "synchronized" | null;
  lsvEnabled: boolean;
  lsvStatus: string | null;
  dataSources: NormalizedBackupDataSource[];
  lastSessionTimestamp: Date | null;
  lastSuccessfulTimestamp: Date | null;
  colorBar28Days: ColorBarDay[];
  selectedSizeBytes: number;
  protectedSizeBytes: number;
  externalIps: string | null;
  macAddress: string | null;
  email: string | null;
  creationDate: Date | null;
  storageLocation: string | null;
  accountType: string | null;
  productName: string | null;
  _raw?: unknown;
}

/** Client-level backup health aggregation */
export interface NormalizedBackupCustomer {
  sourceToolId: string;
  sourceId: string;
  name: string;
  totalDevices: number;
  healthyDevices: number;
  warningDevices: number;
  failedDevices: number;
  overdueDevices: number;
  offlineDevices: number;
  neverRanDevices: number;
  totalStorageBytes: number;
  overallStatus: BackupOverallStatus;
}

/** Dashboard-level summary across all customers */
export interface BackupDashboardSummary {
  totalDevices: number;
  totalCustomers: number;
  byStatus: Record<BackupOverallStatus, number>;
  totalStorageBytes: number;
  totalProtectedBytes: number;
  totalSelectedBytes: number;
  byDeviceType: { servers: number; workstations: number; m365: number; unknown: number };
  failedDevices: NormalizedBackupDevice[];
  overdueDevices: NormalizedBackupDevice[];

  /** Session status distribution (Cove Widget 3) */
  bySessionStatus: {
    completed: number;
    completedWithErrors: number;
    inProcess: number;
    failed: number;
    noBackups: number;
  };

  /** Age-of-last-backup distribution (Cove Widget 4) */
  backedUpRecency: {
    lessThan1h: number;
    oneToFourHours: number;
    fourTo24Hours: number;
    twentyFourTo48Hours: number;
    moreThan48Hours: number;
    noBackups: number;
  };

  /** M365 tenant summary (Cove Widget 2) */
  m365Summary: {
    tenantCount: number;
    licenseCount: number;
    totalSelectedBytes: number;
    totalUsedBytes: number;
  };
}

/** A single session-level history entry (one per data source per session) */
export interface BackupSessionHistoryEntry {
  timestamp: string;
  dataSourceType: BackupDataSourceType;
  dataSourceLabel: string;
  status: BackupSessionStatus | null;
  durationSeconds: number | null;
  selectedCount: number | null;
  processedCount: number | null;
  selectedSizeBytes: number | null;
  processedSizeBytes: number | null;
  transferredSizeBytes: number | null;
  errorsCount: number | null;
}

/** Recovery verification / testing results for a backup device */
export interface RecoveryVerification {
  available: boolean;
  bootStatus: "success" | "failed" | null;
  recoveryStatus: string | null;
  backupSessionTimestamp: string | null;
  recoverySessionTimestamp: string | null;
  recoveryDurationSeconds: number | null;
  planName: string | null;
  restoreFormat: string | null;
  bootCheckFrequency: string | null;
  screenshotUrl: string | null;
  stoppedServices: string[];
  systemEvents: Array<{
    eventId: number;
    level: string;
    message: string;
    provider: string;
    timestamp: string;
  }>;
  colorbar: Array<{
    status: string;
    sessionId: string;
    backupTimestamp: string;
    recoveryTimestamp: string;
  }>;
}

/** A single per-file error detail from a backup session */
export interface BackupErrorDetail {
  filename: string;
  errorMessage: string;
  errorCode: number;
  occurrenceCount: number;
  timestamp: string;       // ISO 8601
  sessionId: string;
}

// ─── Filter Types ────────────────────────────────────────────────

export interface BackupDeviceFilter {
  customerId?: string;
  status?: BackupOverallStatus;
  deviceType?: "workstation" | "server";
  searchTerm?: string;
  dataSource?: BackupDataSourceType;
}

// ─── Interface ───────────────────────────────────────────────────

export interface IBackupConnector {
  /** List all customers with backup health rollup */
  getCustomers(): Promise<NormalizedBackupCustomer[]>;

  /** List backup devices with optional filtering */
  getDevices(filter?: BackupDeviceFilter): Promise<NormalizedBackupDevice[]>;

  /** Get single device with full per-data-source breakdown */
  getDeviceById(id: string): Promise<NormalizedBackupDevice>;

  /** Get dashboard summary (counts by status, top failures) */
  getDashboardSummary(): Promise<BackupDashboardSummary>;

  /** Get active alerts for failed/overdue backup devices */
  getActiveAlerts(): Promise<NormalizedAlert[]>;

  /** Get storage statistics */
  getStorageStatistics(customerId?: string): Promise<{
    totalBytes: number;
    usedBytes: number;
    devices: Array<{ deviceId: string; deviceName: string; usedBytes: number }>;
  }>;

  /** Get session history for a specific device */
  getDeviceSessionHistory(
    deviceId: string,
    days?: number
  ): Promise<BackupSessionHistoryEntry[]>;

  /** Validate credentials */
  healthCheck(): Promise<HealthCheckResult>;
}
