/**
 * Raw Cove Data Protection API types.
 *
 * Cove uses JSON-RPC 2.0 — all calls POST to https://api.backup.management/jsonapi
 * with the method name in the body. Responses include a visa token for auth chaining.
 */

// ─── JSON-RPC Protocol ──────────────────────────────────────────

export interface CoveJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  visa?: string;
  params?: Record<string, unknown>;
}

export interface CoveJsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string;
  visa?: string;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  result?: T;
}

// ─── Auth ────────────────────────────────────────────────────────

export interface CoveLoginResult {
  EmailAddress: string;
  FirstName: string;
  FullName: string;
  Id: number;
  PartnerId: number;
  RoleId?: number;
}

// ─── Partner (Customer) ─────────────────────────────────────────

export interface CovePartner {
  Id: number;
  Name: string;
  Level: number;
  State: number;
  ExternalCode?: string;
  TotalUsedStorageGb?: number;
  AccountCount?: number;
}

// ─── Account Statistics ─────────────────────────────────────────

export interface CoveAccountStatisticsQuery {
  PartnerId: number;
  Filter?: string;
  ExcludedPartners?: number[];
  SelectionMode?: "Undefined" | "Merged" | "PerInstallation" | "Count";
  Labels?: number;
  StartRecordNumber: number;
  RecordsCount: number;
  OrderBy?: string;
  Columns: string[];
  Totals?: string[];
}

/** A row from EnumerateAccountStatistics — dynamic column-based */
export interface CoveStatisticsRow {
  AccountId: number;
  PartnerId: number;
  Flags?: string[];
  /** Array of single-key objects: [{"I0":"val"}, {"I1":"val"}, ...] */
  Settings: Record<string, string | number | null>[];
}

export interface CoveStatisticsResult {
  result: CoveStatisticsRow[];
  totalStatistics?: Record<string, number>;
  totalRecordsCount?: number;
}

export interface CoveEnumeratePartnersResult {
  result: CovePartner[];
}

// ─── Column Code Constants ──────────────────────────────────────

/** Device info columns (I-prefix) */
export const DEVICE_COLUMNS = {
  ID: "I0",
  NAME: "I1",
  ALIAS: "I2",
  CREATION_DATE: "I4",
  CUSTOMER: "I8",
  PRODUCT_ID: "I9",
  PRODUCT: "I10",
  STORAGE_LOCATION: "I11",
  USED_STORAGE: "I14",
  EMAIL: "I15",
  OS_VERSION: "I16",
  CLIENT_VERSION: "I17",
  COMPUTER_NAME: "I18",
  INTERNAL_IPS: "I19",
  EXTERNAL_IPS: "I20",
  MAC_ADDRESS: "I21",
  OS_TYPE: "I32",
  LSV_ENABLED: "I35",
  STORAGE_STATUS: "I36",
  LSV_STATUS: "I37",
  ACTIVE_DATA_SOURCES: "I78",
  ACCOUNT_TYPE: "I59",
} as const;

/**
 * Data source prefixes (legacy notation).
 * Column codes are formed as: {prefix}{field} — e.g., "T0" = Total last session status
 */
export const DATA_SOURCE_PREFIX = {
  FILES: "F",
  SYSTEM_STATE: "S",
  MSSQL: "Q",
  VSS_EXCHANGE: "X",
  NETWORK_SHARES: "N",
  VMWARE: "W",
  TOTAL: "T",
  VSS_MSSQL: "Z",
  VSS_SHAREPOINT: "P",
  ORACLE: "Y",
  HYPERV: "H",
  MYSQL: "L",
  VDR: "V",
  BMR: "B",
  M365_EXCHANGE: "G",
  M365_ONEDRIVE: "J",
} as const;

/**
 * Per-data-source field suffixes (legacy notation).
 * Combine with DATA_SOURCE_PREFIX to form column codes.
 */
export const STAT_FIELDS = {
  LAST_SESSION_STATUS: "0",
  SELECTED_COUNT: "1",
  PROCESSED_COUNT: "2",
  SELECTED_SIZE: "3",
  PROCESSED_SIZE: "4",
  SENT_SIZE: "5",
  PROTECTED_SIZE: "6",
  ERRORS_COUNT: "7",
  COLOR_BAR_28: "B",
  LAST_SUCCESSFUL_SESSION: "L",
  SESSION_DURATION: "A",
  LICENSE_ITEMS: "I",
  RETENTION: "R",
  LAST_SESSION_TIMESTAMP: "G",
  LAST_SUCCESSFUL_STATUS: "Q",
  LAST_COMPLETED_STATUS: "J",
  LAST_COMPLETED_TIMESTAMP: "O",
} as const;

/** Session status codes from Cove's F00 field */
export const SESSION_STATUS_CODES = {
  IN_PROCESS: 1,
  FAILED: 2,
  ABORTED: 3,
  COMPLETED: 5,
  INTERRUPTED: 6,
  NOT_STARTED: 7,
  COMPLETED_WITH_ERRORS: 8,
  IN_PROGRESS_WITH_FAULTS: 9,
  OVER_QUOTA: 10,
  NO_SELECTION: 11,
  RESTARTED: 12,
} as const;

/** Storage status codes from I36 */
export const STORAGE_STATUS_CODES = {
  OFFLINE: -2,
  FAILED: -1,
  UNDEFINED: 0,
  RUNNING: 50,
  SYNCHRONIZED: 100,
} as const;

// ─── Pre-built Column Sets ──────────────────────────────────────

/**
 * Per-source column prefixes and stat field suffixes.
 * Combined as {prefix}{field} → e.g., "F0" = Files last session status.
 */
export const SOURCE_PREFIXES = ["F", "S", "Q", "X", "N", "W", "Z", "P", "Y", "H", "L", "V", "B", "G", "J"];
export const SOURCE_STAT_FIELDS = ["0", "B", "L", "G", "6", "1", "2", "3", "4", "7", "A", "I"];

// ─── Session History Column Sets ─────────────────────────────────

/** Per-source stat fields requested for session history */
export const HISTORY_STAT_FIELDS = ["0", "1", "2", "3", "4", "5", "7", "A"];

/**
 * Source prefixes valid for EnumerateAccountHistoryStatistics.
 * The history API rejects some newer/specialized prefixes (V=VDR, Z=VSS MSSQL,
 * P=VSS SharePoint, Y=Oracle, L=MySQL, B=BMR) that work in EnumerateAccountStatistics.
 */
export const HISTORY_SOURCE_PREFIXES = ["F", "S", "Q", "X", "N", "W", "H", "G", "J"];

/**
 * Columns for session history queries (EnumerateAccountHistoryStatistics).
 * Each row = one session snapshot. Per-source fields identify which sources
 * ran and their stats for that session.
 */
export const HISTORY_COLUMNS = [
  "I1",   // Device name (reference)
  // Total (rolled-up) session stats
  "T0", "T1", "T2", "T3", "T4", "T5", "T7", "TA", "TG",
  // Per-source stats: status(0), selected count(1), processed count(2),
  // selected size(3), processed size(4), sent/transferred(5), errors(7), duration(A)
  ...HISTORY_SOURCE_PREFIXES.flatMap((prefix) =>
    HISTORY_STAT_FIELDS.map((field) => `${prefix}${field}`)
  ),
];

// ─── Pre-built Column Sets (Device List) ─────────────────────────

/**
 * Columns for the device list — includes BOTH device info AND per-source stats.
 * This means the initial query returns everything needed for both table and expand view.
 * No separate detail fetch required.
 */
// ─── Storage Node (Reporting API) ───────────────────────────────
// The Cove portal uses a separate reporting API on storage nodes to get
// per-file error details. These types model the undocumented storage node
// JSON-RPC protocol discovered via HAR analysis.

/** Response item from EnumerateAccountRemoteAccessEndpoints on the main API */
export interface CoveRemoteAccessEndpoint {
  /** Storage node base URL, e.g., "https://us-ch-0202-12.cloudbackup.management" */
  Url: string;
  /** Auth token for storage node calls (NOT a visa — simple bearer token) */
  Token: string;
  /** Account/device name string used in storage node queries */
  AccountName: string;
}

/** JSON-RPC request for storage node (no visa field — uses token in params) */
export interface StorageNodeJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC response from storage node */
export interface StorageNodeJsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string;
  visa?: string;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  result?: T;
}

/** A single per-file error from QueryErrors on the storage node */
export interface CoveStorageNodeError {
  Code: number;
  Count: number;
  Filename: string;
  Text: string;
  Time: number;       // Unix timestamp (seconds)
  SessionId: number;
  Id: number;
}

/** Result wrapper from QueryErrors */
export interface CoveQueryErrorsResult {
  result: CoveStorageNodeError[];
  totalRecordsCount?: number;
}

// ─── DRaaS REST API (Recovery Verification) ────────────────────
// Separate REST API at /draas/actual-statistics/v1/ for recovery testing data.
// Discovered via HAR analysis of the Cove portal's Recovery Verification tab.

export interface CoveDraasColorbarEntry {
  status: string;
  session_id: string;
  backup_session_timestamp: string;
  recovery_session_timestamp: string;
}

/** Top-level attributes from /draas/actual-statistics/v1/dashboard/ */
export interface CoveDraasStatistic {
  plan_device_id: number;
  backup_cloud_device_id: number;
  backup_cloud_device_name: string;
  backup_cloud_device_machine_name: string;
  backup_cloud_partner_name: string;
  current_recovery_status: string;
  type: string;
  recovery_target_type: string;
  plan_name: string;
  last_boot_test_status: string | null;
  last_boot_test_backup_session_timestamp: number | null;
  last_boot_test_recovery_session_timestamp: number | null;
  last_recovery_duration_sec: number | null;
  last_recovery_status: string | null;
  last_recovery_session_id: string | null;
  last_recovery_screenshot_presented: boolean;
  last_recovery_errors_count: number;
  device_boot_frequency: number;
  colorbar: CoveDraasColorbarEntry[];
  data_sources: string[];
}

/** File reference from /sessions/{id}/files/ */
export interface CoveDraasSessionFile {
  type: string;
  id: string;
  attributes: { file_type: string };
}

/** Decoded system log (.info) from S3 */
export interface CoveSystemLogInfo {
  BackupSessionTime: number;
  VmBooted: boolean;
  VmSystemInfo: {
    MachineName: string;
    StoppedServicesWithAutostart: string[];
    SystemLogRecords: Array<{
      EventID: number;
      Level: string;
      Message: string;
      ProviderName: string;
      TimeCreated: string;
    }>;
  };
}

// ─── Pre-built Column Sets (Device List) ─────────────────────────

export const DEVICE_LIST_COLUMNS = [
  DEVICE_COLUMNS.ID,
  DEVICE_COLUMNS.NAME,
  DEVICE_COLUMNS.CUSTOMER,
  DEVICE_COLUMNS.OS_VERSION,
  DEVICE_COLUMNS.CLIENT_VERSION,
  DEVICE_COLUMNS.COMPUTER_NAME,
  DEVICE_COLUMNS.INTERNAL_IPS,
  DEVICE_COLUMNS.EXTERNAL_IPS,
  DEVICE_COLUMNS.MAC_ADDRESS,
  DEVICE_COLUMNS.OS_TYPE,
  DEVICE_COLUMNS.ACTIVE_DATA_SOURCES,
  DEVICE_COLUMNS.USED_STORAGE,
  DEVICE_COLUMNS.STORAGE_STATUS,
  DEVICE_COLUMNS.LSV_ENABLED,
  DEVICE_COLUMNS.LSV_STATUS,
  DEVICE_COLUMNS.CREATION_DATE,
  DEVICE_COLUMNS.PRODUCT,
  DEVICE_COLUMNS.STORAGE_LOCATION,
  DEVICE_COLUMNS.EMAIL,
  DEVICE_COLUMNS.ACCOUNT_TYPE,
  // Total data source stats
  "T0",  // Total last session status
  "TB",  // Total 28-day color bar
  "TL",  // Total last successful session timestamp
  "TG",  // Total last session timestamp
  "T3",  // Total selected size
  "T6",  // Total protected size
  "T7",  // Total errors count
  // Per-source stats (Files, System State, MSSQL, Exchange, Network Shares, VMware, etc.)
  ...SOURCE_PREFIXES.flatMap((prefix) =>
    SOURCE_STAT_FIELDS.map((field) => `${prefix}${field}`)
  ),
];
