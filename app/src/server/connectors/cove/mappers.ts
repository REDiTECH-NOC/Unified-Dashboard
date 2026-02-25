/**
 * Cove Data Protection mappers — normalize column-based API responses.
 *
 * EnumerateAccountStatistics returns rows where values are in a `Settings` array
 * corresponding to the requested `Columns` array. These mappers extract values
 * by column index and map them to normalized backup types.
 */

import type {
  BackupSessionStatus,
  BackupSessionHistoryEntry,
  BackupOverallStatus,
  BackupDataSourceType,
  ColorBarDay,
  NormalizedBackupDataSource,
  NormalizedBackupDevice,
  NormalizedBackupCustomer,
} from "../_interfaces/backup";
import type { NormalizedAlert } from "../_interfaces/common";
import type { CoveStatisticsRow } from "./types";
import { SESSION_STATUS_CODES, STORAGE_STATUS_CODES } from "./types";

// ─── Column Value Extraction ─────────────────────────────────────

/**
 * Helper to extract a column value from a statistics row.
 * Cove returns Settings as an array of single-key objects: [{"I0":"val"}, {"I1":"val"}, ...]
 * We search for the entry matching the requested column code.
 */
function getColumnValue(
  row: CoveStatisticsRow,
  _columns: string[],
  columnCode: string
): string | number | null {
  for (const entry of row.Settings) {
    if (entry && typeof entry === "object" && columnCode in entry) {
      return entry[columnCode];
    }
  }
  return null;
}

function getNum(row: CoveStatisticsRow, columns: string[], code: string): number | null {
  const val = getColumnValue(row, columns, code);
  if (val === null || val === undefined || val === "") return null;
  return typeof val === "number" ? val : Number(val);
}

function getStr(row: CoveStatisticsRow, columns: string[], code: string): string | null {
  const val = getColumnValue(row, columns, code);
  if (val === null || val === undefined) return null;
  return String(val);
}

// ─── Session Status Mapping ──────────────────────────────────────

export function mapSessionStatus(code: number | null): BackupSessionStatus | null {
  if (code === null || code === undefined) return null;
  switch (code) {
    case SESSION_STATUS_CODES.IN_PROCESS: return "in_process";
    case SESSION_STATUS_CODES.FAILED: return "failed";
    case SESSION_STATUS_CODES.ABORTED: return "aborted";
    case SESSION_STATUS_CODES.COMPLETED: return "completed";
    case SESSION_STATUS_CODES.INTERRUPTED: return "interrupted";
    case SESSION_STATUS_CODES.NOT_STARTED: return "not_started";
    case SESSION_STATUS_CODES.COMPLETED_WITH_ERRORS: return "completed_with_errors";
    case SESSION_STATUS_CODES.IN_PROGRESS_WITH_FAULTS: return "in_progress_with_faults";
    case SESSION_STATUS_CODES.OVER_QUOTA: return "over_quota";
    case SESSION_STATUS_CODES.NO_SELECTION: return "no_selection";
    case SESSION_STATUS_CODES.RESTARTED: return "restarted";
    default: return null;
  }
}

// ─── Storage Status Mapping ──────────────────────────────────────

export function mapStorageStatus(
  code: number | null
): NormalizedBackupDevice["storageStatus"] {
  if (code === null || code === undefined) return null;
  switch (code) {
    case STORAGE_STATUS_CODES.OFFLINE: return "offline";
    case STORAGE_STATUS_CODES.FAILED: return "failed";
    case STORAGE_STATUS_CODES.UNDEFINED: return "undefined";
    case STORAGE_STATUS_CODES.RUNNING: return "running";
    case STORAGE_STATUS_CODES.SYNCHRONIZED: return "synchronized";
    default: return null;
  }
}

// ─── OS Type Mapping ─────────────────────────────────────────────

function mapOsType(code: number | null): "workstation" | "server" | null {
  if (code === 1) return "workstation";
  if (code === 2) return "server";
  return null;
}

// ─── Timestamp Mapping ───────────────────────────────────────────

function mapUnixTimestamp(value: number | null): Date | null {
  if (!value || value <= 0) return null;
  return new Date(value * 1000);
}

// ─── Color Bar Mapping ───────────────────────────────────────────

/**
 * Parse Cove's 28-day color bar field (F08/column suffix B).
 *
 * The color bar is a string of characters, each representing one day's backup status.
 * Characters encode session results; common mappings:
 * - 'F' / '2' = Failed
 * - 'x' / '5' = Completed (success)
 * - 'w' / '8' = Completed with errors (warning/partial)
 * - '-' = No backup / no data
 * - 'r' / '1' = Running / in process
 * - 'i' / '6' = Interrupted
 *
 * The encoding can vary — this mapper handles both alpha and numeric formats.
 * Day 0 = oldest (28 days ago), Day 27 = today.
 */
export function mapColorBar(encoded: string | null): ColorBarDay[] {
  if (!encoded || typeof encoded !== "string") return [];

  const today = new Date();
  const chars = encoded.split("");

  return chars.map((char, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (chars.length - 1 - index));

    let status: ColorBarDay["status"];
    switch (char.toLowerCase()) {
      case "x":
      case "5":
        status = "success";
        break;
      case "w":
      case "8":
        status = "partial";
        break;
      case "f":
      case "2":
      case "3":
        status = "failed";
        break;
      case "-":
      case "0":
      case "7":
        status = "missed";
        break;
      case "r":
      case "1":
      case "9":
        status = "running";
        break;
      default:
        status = "none";
    }

    return {
      date: date.toISOString().split("T")[0],
      status,
    };
  });
}

// ─── Overall Status Computation ──────────────────────────────────

/**
 * Determine overall device health from backup session data.
 * Priority: offline > failed > overdue > warning > healthy > never_ran > unknown
 */
export function computeOverallStatus(
  sessionStatus: BackupSessionStatus | null,
  lastSessionTimestamp: Date | null,
  storageStatusCode: number | null
): BackupOverallStatus {
  // Offline check
  if (storageStatusCode === STORAGE_STATUS_CODES.OFFLINE) return "offline";

  // No session ever ran
  if (!sessionStatus && !lastSessionTimestamp) return "never_ran";

  // Failed states
  if (sessionStatus === "failed" || sessionStatus === "aborted") return "failed";

  // Overdue check — no backup in 48 hours
  if (lastSessionTimestamp) {
    const hoursSince = (Date.now() - lastSessionTimestamp.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 48) return "overdue";
  }

  // Warning states
  if (
    sessionStatus === "completed_with_errors" ||
    sessionStatus === "in_progress_with_faults" ||
    sessionStatus === "over_quota" ||
    sessionStatus === "interrupted"
  ) {
    return "warning";
  }

  // Healthy
  if (sessionStatus === "completed") return "healthy";

  // In-progress states
  if (sessionStatus === "in_process" || sessionStatus === "restarted") return "healthy";

  return "unknown";
}

// ─── Data Source Label Mapping ────────────────────────────────────

const DATA_SOURCE_LABELS: Record<string, { type: BackupDataSourceType; label: string }> = {
  F: { type: "files", label: "Files & Folders" },
  S: { type: "system_state", label: "System State" },
  Q: { type: "mssql", label: "MS SQL" },
  X: { type: "vss_exchange", label: "Exchange (VSS)" },
  N: { type: "network_shares", label: "Network Shares" },
  W: { type: "vmware", label: "VMware" },
  T: { type: "total", label: "Total" },
  Z: { type: "vss_mssql", label: "MS SQL (VSS)" },
  P: { type: "vss_sharepoint", label: "SharePoint (VSS)" },
  Y: { type: "oracle", label: "Oracle" },
  H: { type: "hyperv", label: "Hyper-V" },
  L: { type: "mysql", label: "MySQL" },
  V: { type: "vdr", label: "Virtual Disaster Recovery" },
  B: { type: "bmr", label: "Bare Metal Restore" },
  G: { type: "m365_exchange", label: "M365 Exchange" },
  J: { type: "m365_onedrive", label: "M365 OneDrive" },
};

// ─── Per-Source Stats Extraction ─────────────────────────────────

function extractDataSource(
  row: CoveStatisticsRow,
  columns: string[],
  prefix: string
): NormalizedBackupDataSource | null {
  const meta = DATA_SOURCE_LABELS[prefix];
  if (!meta) return null;

  const statusCode = getNum(row, columns, `${prefix}0`);
  // If there's no status and no timestamp, this source isn't active
  const timestamp = getNum(row, columns, `${prefix}G`);
  if (statusCode === null && timestamp === null) return null;

  return {
    type: meta.type,
    label: meta.label,
    lastSessionStatus: mapSessionStatus(statusCode),
    lastSessionTimestamp: mapUnixTimestamp(timestamp),
    lastSuccessfulTimestamp: mapUnixTimestamp(getNum(row, columns, `${prefix}L`)),
    selectedCount: getNum(row, columns, `${prefix}1`),
    processedCount: getNum(row, columns, `${prefix}2`),
    selectedSizeBytes: getNum(row, columns, `${prefix}3`),
    processedSizeBytes: getNum(row, columns, `${prefix}4`),
    errorsCount: getNum(row, columns, `${prefix}7`),
    protectedSizeBytes: getNum(row, columns, `${prefix}6`),
    sessionDurationSeconds: getNum(row, columns, `${prefix}A`),
    licenseItems: getNum(row, columns, `${prefix}I`),
    colorBar28Days: mapColorBar(getStr(row, columns, `${prefix}B`)),
  };
}

// ─── M365 Tenant Detection ─────────────────────────────────────

/**
 * Determine if a device is an M365 tenant.
 *
 * M365 tenants have M365-specific data sources (G = Exchange, J = OneDrive)
 * and NO physical OS type (osType is null). Physical servers/workstations
 * always have an OS type set. I59 (accountType) "1" is NOT M365-specific —
 * it appears on all active accounts.
 */
export function isM365Tenant(device: NormalizedBackupDevice): boolean {
  const hasM365Source = device.dataSources.some(
    (ds) => ds.type === "m365_exchange" || ds.type === "m365_onedrive"
  );
  // M365 tenants have M365 data sources and no physical OS
  return hasM365Source && !device.osType;
}

// ─── Main Row Mapper ─────────────────────────────────────────────

/**
 * Map a Cove EnumerateAccountStatistics row to a NormalizedBackupDevice.
 * `columns` must match the column codes used in the original query.
 * `partnerNames` is an optional map of partnerId → name for customer name resolution.
 */
export function mapStatisticsRow(
  row: CoveStatisticsRow,
  columns: string[],
  partnerNames?: Map<number, string>
): NormalizedBackupDevice {
  const sessionStatusCode = getNum(row, columns, "T0");
  const lastSessionTs = mapUnixTimestamp(getNum(row, columns, "TG"));
  const storageStatusCode = getNum(row, columns, "I36");

  // Extract per-source stats (skip Total — it's the rollup)
  const sourcePrefixes = ["F", "S", "Q", "X", "N", "W", "Z", "P", "Y", "H", "L", "V", "B", "G", "J"];
  const dataSources: NormalizedBackupDataSource[] = [];
  for (const prefix of sourcePrefixes) {
    const ds = extractDataSource(row, columns, prefix);
    if (ds) dataSources.push(ds);
  }

  // Derive active data sources from actual per-source data (sources with status or timestamp)
  // More reliable than I78 which may only return display names
  const activeDataSources = dataSources
    .filter((ds) => ds.type !== "total")
    .map((ds) => ds.label);

  return {
    sourceToolId: "cove",
    sourceId: String(row.AccountId),
    deviceName: getStr(row, columns, "I1") ?? `Device-${row.AccountId}`,
    computerName: getStr(row, columns, "I18") ?? "",
    customerSourceId: String(row.PartnerId),
    customerName: partnerNames?.get(row.PartnerId) ?? getStr(row, columns, "I8") ?? "",
    os: getStr(row, columns, "I16"),
    osType: mapOsType(getNum(row, columns, "I32")),
    internalIps: getStr(row, columns, "I19"),
    agentVersion: getStr(row, columns, "I17"),
    activeDataSources,
    overallStatus: computeOverallStatus(
      mapSessionStatus(sessionStatusCode),
      lastSessionTs,
      storageStatusCode
    ),
    usedStorageBytes: getNum(row, columns, "I14") ?? 0,
    storageStatus: mapStorageStatus(storageStatusCode),
    lsvEnabled: getNum(row, columns, "I35") === 1,
    lsvStatus: getStr(row, columns, "I37"),
    dataSources,
    lastSessionTimestamp: lastSessionTs,
    lastSuccessfulTimestamp: mapUnixTimestamp(getNum(row, columns, "TL")),
    colorBar28Days: mapColorBar(getStr(row, columns, "TB")),
    selectedSizeBytes: getNum(row, columns, "T3") ?? 0,
    protectedSizeBytes: getNum(row, columns, "T6") ?? 0,
    externalIps: getStr(row, columns, "I20"),
    macAddress: getStr(row, columns, "I21"),
    email: getStr(row, columns, "I15"),
    creationDate: mapUnixTimestamp(getNum(row, columns, "I4")),
    storageLocation: getStr(row, columns, "I11"),
    accountType: getStr(row, columns, "I59"),
    productName: getStr(row, columns, "I10"),
    _raw: row,
  };
}

// ─── Customer Aggregation ────────────────────────────────────────

/**
 * Aggregate a list of devices into customer-level summaries.
 */
export function aggregateByCustomer(
  devices: NormalizedBackupDevice[]
): NormalizedBackupCustomer[] {
  const byCustomer = new Map<string, NormalizedBackupDevice[]>();

  for (const device of devices) {
    const key = device.customerSourceId;
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(device);
  }

  return Array.from(byCustomer.entries()).map(([customerId, customerDevices]) => {
    const counts = { healthy: 0, warning: 0, failed: 0, overdue: 0, offline: 0, never_ran: 0, unknown: 0 };
    let totalStorage = 0;

    for (const d of customerDevices) {
      counts[d.overallStatus] = (counts[d.overallStatus] ?? 0) + 1;
      totalStorage += d.usedStorageBytes;
    }

    // Worst status determines customer status
    let overallStatus: BackupOverallStatus = "healthy";
    if (counts.failed > 0) overallStatus = "failed";
    else if (counts.overdue > 0) overallStatus = "overdue";
    else if (counts.offline > 0) overallStatus = "offline";
    else if (counts.warning > 0) overallStatus = "warning";
    else if (counts.never_ran > 0 && counts.healthy === 0) overallStatus = "never_ran";

    return {
      sourceToolId: "cove",
      sourceId: customerId,
      name: customerDevices[0]?.customerName ?? `Customer-${customerId}`,
      totalDevices: customerDevices.length,
      healthyDevices: counts.healthy,
      warningDevices: counts.warning,
      failedDevices: counts.failed,
      overdueDevices: counts.overdue,
      offlineDevices: counts.offline,
      neverRanDevices: counts.never_ran,
      totalStorageBytes: totalStorage,
      overallStatus,
    };
  });
}

// ─── Session History Mapping ─────────────────────────────────────

/**
 * Map EnumerateAccountHistoryStatistics rows to session history entries.
 *
 * Each API row represents one session snapshot. We expand per-source data
 * into individual entries so the UI shows one row per source per session
 * (matching the Cove console's History tab).
 */
export function mapHistoryRows(
  rawResult: unknown
): BackupSessionHistoryEntry[] {
  // Handle both direct array and nested { result: [...] } shapes
  let rows: CoveStatisticsRow[];
  if (Array.isArray(rawResult)) {
    rows = rawResult;
  } else if (rawResult && typeof rawResult === "object" && "result" in rawResult) {
    const nested = (rawResult as { result: unknown }).result;
    rows = Array.isArray(nested) ? nested : [];
  } else {
    rows = [];
  }

  const entries: BackupSessionHistoryEntry[] = [];
  const sourcePrefixes = Object.keys(DATA_SOURCE_LABELS).filter((p) => p !== "T");

  for (const row of rows) {
    // Build flat settings lookup
    const settings: Record<string, string | number | null> = {};
    if (Array.isArray(row.Settings)) {
      for (const s of row.Settings) {
        if (s && typeof s === "object") {
          for (const [k, v] of Object.entries(s)) {
            settings[k] = v;
          }
        }
      }
    }

    // Get session timestamp — prefer row-level Timestamp, fall back to TG column
    const rowAny = row as unknown as Record<string, unknown>;
    const rawTs =
      rowAny.TimeStamp ??
      rowAny.Timestamp ??
      settings["TG"] ??
      null;
    if (rawTs == null) continue;

    const timestampStr =
      typeof rawTs === "number"
        ? new Date(rawTs * 1000).toISOString()
        : String(rawTs);

    // Extract per-source entries (sources that have a non-null status in this session)
    for (const prefix of sourcePrefixes) {
      const statusCode = settings[`${prefix}0`];
      if (statusCode == null || statusCode === "") continue;

      const safeNum = (v: string | number | null | undefined): number | null => {
        if (v == null || v === "") return null;
        const n = typeof v === "number" ? v : Number(v);
        return isNaN(n) ? null : n;
      };

      const meta = DATA_SOURCE_LABELS[prefix];
      if (!meta) continue;

      entries.push({
        timestamp: timestampStr,
        dataSourceType: meta.type,
        dataSourceLabel: meta.label,
        status: mapSessionStatus(safeNum(statusCode)),
        durationSeconds: safeNum(settings[`${prefix}A`]),
        selectedCount: safeNum(settings[`${prefix}1`]),
        processedCount: safeNum(settings[`${prefix}2`]),
        selectedSizeBytes: safeNum(settings[`${prefix}3`]),
        processedSizeBytes: safeNum(settings[`${prefix}4`]),
        transferredSizeBytes: safeNum(settings[`${prefix}5`]),
        errorsCount: safeNum(settings[`${prefix}7`]),
      });
    }
  }

  // Sort by timestamp descending (newest first)
  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return entries;
}

// ─── Alert Generation ────────────────────────────────────────────

/**
 * Generate NormalizedAlerts from devices with failed or overdue backups.
 */
export function generateBackupAlerts(
  devices: NormalizedBackupDevice[]
): NormalizedAlert[] {
  const alerts: NormalizedAlert[] = [];

  for (const device of devices) {
    // Dates come back as strings after Redis deserialization — coerce
    const lastTs = device.lastSessionTimestamp
      ? new Date(device.lastSessionTimestamp)
      : null;

    if (device.overallStatus === "failed") {
      alerts.push({
        sourceToolId: "cove",
        sourceId: `backup-failed-${device.sourceId}`,
        title: `Backup failed: ${device.deviceName}`,
        message: `Last backup session failed for ${device.deviceName} (${device.customerName})`,
        severity: "critical",
        severityScore: 9,
        category: "availability",
        status: "new",
        deviceHostname: device.computerName || device.deviceName,
        organizationName: device.customerName,
        createdAt: lastTs ?? new Date(),
      });
    } else if (device.overallStatus === "overdue") {
      const hoursSince = lastTs
        ? Math.round((Date.now() - lastTs.getTime()) / (1000 * 60 * 60))
        : null;
      alerts.push({
        sourceToolId: "cove",
        sourceId: `backup-overdue-${device.sourceId}`,
        title: `Backup overdue: ${device.deviceName}`,
        message: `No backup in ${hoursSince ?? "unknown"} hours for ${device.deviceName} (${device.customerName})`,
        severity: "high",
        severityScore: 7,
        category: "availability",
        status: "new",
        deviceHostname: device.computerName || device.deviceName,
        organizationName: device.customerName,
        createdAt: lastTs ?? new Date(),
      });
    } else if (device.overallStatus === "warning") {
      alerts.push({
        sourceToolId: "cove",
        sourceId: `backup-warning-${device.sourceId}`,
        title: `Backup completed with errors: ${device.deviceName}`,
        message: `Last backup for ${device.deviceName} (${device.customerName}) completed with errors`,
        severity: "medium",
        severityScore: 5,
        category: "availability",
        status: "new",
        deviceHostname: device.computerName || device.deviceName,
        organizationName: device.customerName,
        createdAt: lastTs ?? new Date(),
      });
    }
  }

  return alerts.sort((a, b) => b.severityScore - a.severityScore);
}
