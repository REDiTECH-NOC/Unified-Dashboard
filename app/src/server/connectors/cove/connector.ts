/**
 * Cove Data Protection backup connector.
 *
 * Implements IBackupConnector — thin wrapper around CoveClient that calls
 * Cove JSON-RPC methods and normalizes responses via mappers.
 *
 * Caching: Device and partner data cached in Redis to avoid hammering the API
 * on every page load. Cache TTLs are conservative since backup status changes
 * are measured in hours, not seconds.
 */

import { gunzipSync } from "node:zlib";
import { redis } from "@/lib/redis";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  IBackupConnector,
  NormalizedBackupCustomer,
  NormalizedBackupDevice,
  BackupDashboardSummary,
  BackupDeviceFilter,
  BackupOverallStatus,
  BackupSessionHistoryEntry,
  BackupErrorDetail,
  RecoveryVerification,
} from "../_interfaces/backup";
import type { NormalizedAlert } from "../_interfaces/common";
import { ConnectorError } from "../_base/errors";
import { CoveClient } from "./client";
import {
  DEVICE_LIST_COLUMNS,
  type CoveStatisticsResult,
  type CovePartner,
  type CoveStorageNodeError,
  type CoveQueryErrorsResult,
  type CoveDraasStatistic,
  type CoveDraasSessionFile,
  type CoveSystemLogInfo,
} from "./types";
import {
  mapStatisticsRow,
  aggregateByCustomer,
  generateBackupAlerts,
  isM365Tenant,
} from "./mappers";

/**
 * Stale-while-revalidate caching strategy:
 *
 * - FRESHNESS_* = how long data is considered "fresh" (skip API entirely)
 * - REDIS_TTL   = how long data lives in Redis (serves stale data during revalidation)
 * - Backup data changes ~once/day, so we keep generous windows.
 *
 * Flow: cache hit → fresh? return. stale? return + background refresh. miss? fetch sync.
 */
const FRESHNESS_DEVICES  = 30 * 60;   // 30 min — data considered fresh
const FRESHNESS_PARTNERS = 60 * 60;   // 1 hour
const FRESHNESS_SUMMARY  = 30 * 60;   // 30 min
const REDIS_TTL          = 24 * 60 * 60; // 24 hours — stale data lives this long
const PAGE_SIZE = 250;

/** In-flight refresh tracker — prevents duplicate concurrent refreshes */
const refreshInFlight = new Set<string>();

/** Envelope stored in Redis — data + timestamp for staleness checks */
interface CacheEnvelope<T> {
  data: T;
  cachedAt: number; // epoch ms
}

export class CoveBackupConnector implements IBackupConnector {
  private client: CoveClient;
  private config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.client = new CoveClient(config);
  }

  // ─── Stale-While-Revalidate Helpers ──────────────────────────

  /**
   * Get data from Redis cache. Returns the envelope if present, null if miss.
   * Does NOT check freshness — caller decides whether to revalidate.
   */
  private async cacheGet<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CacheEnvelope<T>;
    } catch {
      return null;
    }
  }

  /** Store data in Redis with a 24-hour TTL. */
  private async cacheSet<T>(key: string, data: T): Promise<void> {
    const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", REDIS_TTL);
  }

  /** Check if cached data is still within its freshness window. */
  private isFresh(cachedAt: number, freshnessSeconds: number): boolean {
    return Date.now() - cachedAt < freshnessSeconds * 1000;
  }

  /**
   * Trigger a background refresh for a cache key. Fire-and-forget.
   * Deduplicates: if a refresh for this key is already in-flight, skips.
   */
  private backgroundRefresh(key: string, refreshFn: () => Promise<void>): void {
    if (refreshInFlight.has(key)) return;
    refreshInFlight.add(key);
    refreshFn()
      .catch((err) => console.error(`[Cove] Background refresh failed for ${key}:`, err))
      .finally(() => refreshInFlight.delete(key));
  }

  // ─── Customers ─────────────────────────────────────────────────

  async getCustomers(): Promise<NormalizedBackupCustomer[]> {
    const devices = await this.getAllDevices();
    return aggregateByCustomer(devices);
  }

  // ─── Devices ───────────────────────────────────────────────────

  async getDevices(filter?: BackupDeviceFilter): Promise<NormalizedBackupDevice[]> {
    let devices = await this.getAllDevices();

    if (filter) {
      if (filter.customerId) {
        devices = devices.filter((d) => d.customerSourceId === filter.customerId);
      }
      if (filter.status) {
        devices = devices.filter((d) => d.overallStatus === filter.status);
      }
      if (filter.deviceType) {
        devices = devices.filter((d) => d.osType === filter.deviceType);
      }
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        devices = devices.filter(
          (d) =>
            d.deviceName.toLowerCase().includes(term) ||
            d.computerName.toLowerCase().includes(term) ||
            d.customerName.toLowerCase().includes(term)
        );
      }
    }

    return devices;
  }

  async getDeviceById(id: string): Promise<NormalizedBackupDevice> {
    // Device list now includes per-source columns — just look up from cache
    const devices = await this.getAllDevices();
    const device = devices.find((d) => d.sourceId === id);
    if (!device) throw new Error(`Device ${id} not found`);
    return device;
  }

  // ─── Dashboard Summary ─────────────────────────────────────────

  async getDashboardSummary(): Promise<BackupDashboardSummary> {
    const key = `cove:summary:${this.config.toolId}`;
    const cached = await this.cacheGet<BackupDashboardSummary>(key);

    if (cached) {
      if (!this.isFresh(cached.cachedAt, FRESHNESS_SUMMARY)) {
        // Stale — serve immediately, refresh in background
        this.backgroundRefresh(key, async () => {
          const fresh = await this.buildDashboardSummary();
          await this.cacheSet(key, fresh);
        });
      }
      return cached.data;
    }

    // Cache miss — fetch synchronously
    const summary = await this.buildDashboardSummary();
    await this.cacheSet(key, summary);
    return summary;
  }

  private async buildDashboardSummary(): Promise<BackupDashboardSummary> {
    const devices = await this.fetchAllDevicesFromApi();
    const customers = aggregateByCustomer(devices);

    // Also update the devices cache since we just fetched them
    const devicesKey = `cove:devices:${this.config.toolId}`;
    await this.cacheSet(devicesKey, devices);

    const byStatus: Record<BackupOverallStatus, number> = {
      healthy: 0,
      warning: 0,
      failed: 0,
      overdue: 0,
      offline: 0,
      never_ran: 0,
      unknown: 0,
    };

    let totalStorage = 0;
    let totalProtected = 0;
    let totalSelected = 0;
    const byDeviceType = { servers: 0, workstations: 0, m365: 0, unknown: 0 };
    const bySessionStatus = { completed: 0, completedWithErrors: 0, inProcess: 0, failed: 0, noBackups: 0 };
    const backedUpRecency = { lessThan1h: 0, oneToFourHours: 0, fourTo24Hours: 0, twentyFourTo48Hours: 0, moreThan48Hours: 0, noBackups: 0 };
    const m365Summary = { tenantCount: 0, licenseCount: 0, totalSelectedBytes: 0, totalUsedBytes: 0 };
    const now = Date.now();

    for (const d of devices) {
      byStatus[d.overallStatus] = (byStatus[d.overallStatus] ?? 0) + 1;
      totalStorage += d.usedStorageBytes;
      totalProtected += d.protectedSizeBytes;
      totalSelected += d.selectedSizeBytes;

      // Device type classification
      if (isM365Tenant(d)) {
        byDeviceType.m365++;
        m365Summary.tenantCount++;
        m365Summary.totalSelectedBytes += d.selectedSizeBytes;
        m365Summary.totalUsedBytes += d.usedStorageBytes;
        // Sum license items from M365 sources
        const exchangeLicenses = d.dataSources.find((ds) => ds.type === "m365_exchange")?.licenseItems ?? 0;
        const onedriveLicenses = d.dataSources.find((ds) => ds.type === "m365_onedrive")?.licenseItems ?? 0;
        m365Summary.licenseCount += Math.max(exchangeLicenses, onedriveLicenses);
      } else if (d.osType === "server") {
        byDeviceType.servers++;
      } else if (d.osType === "workstation") {
        byDeviceType.workstations++;
      } else {
        byDeviceType.unknown++;
      }

      // Session status classification
      if (d.overallStatus === "healthy") bySessionStatus.completed++;
      else if (d.overallStatus === "warning") bySessionStatus.completedWithErrors++;
      else if (d.overallStatus === "failed") bySessionStatus.failed++;
      else if (d.dataSources.some((ds) => ds.lastSessionStatus === "in_process")) bySessionStatus.inProcess++;
      else bySessionStatus.noBackups++;

      // Backup recency
      const lastSuccess = d.lastSuccessfulTimestamp
        ? new Date(d.lastSuccessfulTimestamp as unknown as string).getTime()
        : null;
      if (!lastSuccess || isNaN(lastSuccess)) {
        backedUpRecency.noBackups++;
      } else {
        const ageHours = (now - lastSuccess) / 3_600_000;
        if (ageHours < 1) backedUpRecency.lessThan1h++;
        else if (ageHours < 4) backedUpRecency.oneToFourHours++;
        else if (ageHours < 24) backedUpRecency.fourTo24Hours++;
        else if (ageHours < 48) backedUpRecency.twentyFourTo48Hours++;
        else backedUpRecency.moreThan48Hours++;
      }
    }

    return {
      totalDevices: devices.length,
      totalCustomers: customers.length,
      byStatus,
      totalStorageBytes: totalStorage,
      totalProtectedBytes: totalProtected,
      totalSelectedBytes: totalSelected,
      byDeviceType,
      bySessionStatus,
      backedUpRecency,
      m365Summary,
      failedDevices: devices
        .filter((d) => d.overallStatus === "failed")
        .slice(0, 20),
      overdueDevices: devices
        .filter((d) => d.overallStatus === "overdue")
        .slice(0, 20),
    };
  }

  // ─── Alerts ────────────────────────────────────────────────────

  async getActiveAlerts(): Promise<NormalizedAlert[]> {
    const devices = await this.getAllDevices();
    return generateBackupAlerts(devices);
  }

  // ─── Storage ───────────────────────────────────────────────────

  async getStorageStatistics(customerId?: string): Promise<{
    totalBytes: number;
    usedBytes: number;
    devices: Array<{ deviceId: string; deviceName: string; usedBytes: number }>;
  }> {
    let devices = await this.getAllDevices();
    if (customerId) {
      devices = devices.filter((d) => d.customerSourceId === customerId);
    }

    const storageDevices = devices.map((d) => ({
      deviceId: d.sourceId,
      deviceName: d.deviceName,
      usedBytes: d.usedStorageBytes,
    }));

    const usedBytes = storageDevices.reduce((sum, d) => sum + d.usedBytes, 0);

    return {
      totalBytes: 0, // Cove doesn't expose total allocated easily
      usedBytes,
      devices: storageDevices.sort((a, b) => b.usedBytes - a.usedBytes),
    };
  }

  // ─── Session History ───────────────────────────────────────────

  async getDeviceSessionHistory(
    deviceId: string,
    days: number = 30
  ): Promise<BackupSessionHistoryEntry[]> {
    const key = `cove:history:${this.config.toolId}:${deviceId}`;
    const cached = await this.cacheGet<BackupSessionHistoryEntry[]>(key);

    if (cached && this.isFresh(cached.cachedAt, 15 * 60)) {
      return cached.data;
    }

    // EnumerateAccountHistoryStatistics returns device stats AS OF a given
    // timeslice (one snapshot per call). To build session history, we query
    // one timeslice per day and diff the per-source timestamps to detect
    // which sessions ran each day.
    const rootPartnerId = await this.getRootPartnerId();
    const numericId = parseInt(deviceId, 10);

    // Columns for history: per-source status, counts, sizes, duration, timestamp
    const historyStatFields = ["0", "1", "2", "3", "4", "5", "7", "A", "G"];
    const historyPrefixes = ["F", "S", "Q", "X", "N", "W", "H", "G", "J"];
    const columns = [
      "I1",  // device name
      // Total stats
      "T0", "T1", "T2", "T3", "T4", "T5", "T7", "TA", "TG",
      // Per-source stats
      ...historyPrefixes.flatMap((p) => historyStatFields.map((f) => `${p}${f}`)),
    ];

    // Smart sampling: daily for last 7 days, every 2 days for 8-30.
    // Cuts API calls from 30 → ~19 while preserving recent detail.
    const now = new Date();
    const timeslices: number[] = [];
    for (let d = 0; d < days; d += d < 7 ? 1 : 2) {
      const ts = new Date(now);
      ts.setDate(ts.getDate() - d);
      ts.setHours(23, 59, 59, 0);
      timeslices.push(Math.floor(ts.getTime() / 1000));
    }

    // Build batch calls — single lock acquisition for all timeslices
    const batchCalls = timeslices.map((ts) => ({
      method: "EnumerateAccountHistoryStatistics",
      params: {
        timeslice: ts,
        query: {
          PartnerId: rootPartnerId,
          Filter: `(AU == ${numericId})`,
          Columns: columns,
          StartRecordNumber: 0,
          RecordsCount: 1,
        },
      },
    }));

    const batchResults = await this.client.callBatch<CoveStatisticsResult>(batchCalls);

    // Parse snapshots from batch results
    const snapshots: Array<{
      timeslice: number;
      settings: Record<string, string | number | null>;
    }> = [];

    for (let i = 0; i < batchResults.length; i++) {
      const rawResult = batchResults[i];
      if (!rawResult) continue;

      const rows = Array.isArray(rawResult)
        ? rawResult
        : Array.isArray(rawResult?.result)
          ? rawResult.result
          : [];

      if (rows.length > 0 && Array.isArray(rows[0].Settings)) {
        const flat: Record<string, string | number | null> = {};
        for (const s of rows[0].Settings) {
          if (s && typeof s === "object") {
            for (const [k, v] of Object.entries(s)) {
              flat[k] = v as string | number | null;
            }
          }
        }
        snapshots.push({ timeslice: timeslices[i], settings: flat });
      }
    }

    // Build session entries by detecting per-source timestamp changes between days.
    // If a source's "last session timestamp" ({prefix}G) changes between day N and
    // day N+1, a session ran on day N. Use the stats from day N's snapshot.
    const DATA_SOURCE_LABELS: Record<string, { type: string; label: string }> = {
      F: { type: "files", label: "Files & Folders" },
      S: { type: "system_state", label: "System State" },
      Q: { type: "mssql", label: "MS SQL" },
      X: { type: "vss_exchange", label: "Exchange (VSS)" },
      N: { type: "network_shares", label: "Network Shares" },
      W: { type: "vmware", label: "VMware" },
      H: { type: "hyperv", label: "Hyper-V" },
      G: { type: "m365_exchange", label: "M365 Exchange" },
      J: { type: "m365_onedrive", label: "M365 OneDrive" },
    };

    const statusMap: Record<number, string> = {
      1: "in_process", 2: "failed", 3: "aborted", 5: "completed",
      6: "interrupted", 7: "not_started", 8: "completed_with_errors",
      9: "in_progress_with_faults", 10: "over_quota", 11: "no_selection", 12: "restarted",
    };

    const safeNum = (v: string | number | null | undefined): number | null => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return isNaN(n) ? null : n;
    };

    const entries: BackupSessionHistoryEntry[] = [];

    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const prevSnap = i + 1 < snapshots.length ? snapshots[i + 1] : null;

      for (const prefix of historyPrefixes) {
        const sessionTs = safeNum(snap.settings[`${prefix}G`]);
        if (sessionTs == null || sessionTs === 0) continue;

        // Check if this session is "new" compared to the previous day's snapshot
        const prevSessionTs = prevSnap ? safeNum(prevSnap.settings[`${prefix}G`]) : null;
        if (prevSnap && prevSessionTs === sessionTs) continue; // Same session, skip

        const statusCode = safeNum(snap.settings[`${prefix}0`]);
        const meta = DATA_SOURCE_LABELS[prefix];
        if (!meta) continue;

        entries.push({
          timestamp: new Date(sessionTs * 1000).toISOString(),
          dataSourceType: meta.type as BackupSessionHistoryEntry["dataSourceType"],
          dataSourceLabel: meta.label,
          status: (statusMap[statusCode ?? 0] ?? "unknown") as BackupSessionHistoryEntry["status"],
          durationSeconds: safeNum(snap.settings[`${prefix}A`]),
          selectedCount: safeNum(snap.settings[`${prefix}1`]),
          processedCount: safeNum(snap.settings[`${prefix}2`]),
          selectedSizeBytes: safeNum(snap.settings[`${prefix}3`]),
          processedSizeBytes: safeNum(snap.settings[`${prefix}4`]),
          transferredSizeBytes: safeNum(snap.settings[`${prefix}5`]),
          errorsCount: safeNum(snap.settings[`${prefix}7`]),
        });
      }
    }

    // Sort by timestamp descending
    entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Cache with 6 hour TTL
    const envelope = { data: entries, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", 6 * 60 * 60);

    return entries;
  }

  // ─── Per-File Error Details (Storage Node API) ─────────────────

  /**
   * Get the storage node URL + auth token for a device.
   *
   * Two API calls needed:
   * 1. EnumerateAccountRemoteAccessEndpoints → storage node URL (parsed from WebRcgUrl)
   * 2. GetAccountInfoById → auth token + account name
   */
  private async getStorageNodeEndpoint(accountId: number): Promise<{
    url: string;
    token: string;
    accountName: string;
  }> {
    const key = `cove:storagenode:${this.config.toolId}:${accountId}`;
    const cached = await this.cacheGet<{ url: string; token: string; accountName: string }>(key);

    if (cached && this.isFresh(cached.cachedAt, 10 * 60)) {
      return cached.data;
    }

    // Step 1: Get storage node URL from remote access endpoints
    const endpointResp = await this.client.call<{ result: Array<{ WebRcgUrl?: string; InternalInfoPageUrl?: string }> }>(
      "EnumerateAccountRemoteAccessEndpoints",
      { accountId },
    );

    const endpoints = endpointResp?.result ?? [];
    if (endpoints.length === 0) {
      throw new ConnectorError("cove", `No storage node endpoint for account ${accountId}`);
    }

    // Parse base URL from WebRcgUrl: "https://us-ch-0202-12.cloudbackup.management:443/rcg/..."
    const rawUrl = endpoints[0].WebRcgUrl ?? endpoints[0].InternalInfoPageUrl ?? "";
    let storageNodeUrl: string;
    try {
      const parsed = new URL(rawUrl);
      storageNodeUrl = `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      throw new ConnectorError("cove", `Could not parse storage node URL from: ${rawUrl.slice(0, 100)}`);
    }

    // Step 2: Get auth token + account name from GetAccountInfoById
    const accountInfo = await this.client.call<{ result: { Token: string; Name: string } }>(
      "GetAccountInfoById",
      { accountId },
    );

    const token = accountInfo?.result?.Token;
    const accountName = accountInfo?.result?.Name;

    if (!token || !accountName) {
      throw new ConnectorError("cove", `GetAccountInfoById missing Token or Name for account ${accountId}`);
    }

    const result = { url: storageNodeUrl, token, accountName };

    const envelope = { data: result, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", 30 * 60);

    return result;
  }

  /**
   * Fetch per-file error details for a backup device from the Cove storage node.
   *
   * Flow:
   * 1. EnumerateAccountRemoteAccessEndpoints → storage node URL + token
   * 2. QueryErrors on storage node → per-file error details
   */
  async getDeviceErrorDetails(deviceId: string): Promise<BackupErrorDetail[]> {
    const key = `cove:errors:${this.config.toolId}:${deviceId}`;
    const cached = await this.cacheGet<BackupErrorDetail[]>(key);

    if (cached && this.isFresh(cached.cachedAt, 5 * 60)) {
      return cached.data;
    }

    const numericId = parseInt(deviceId, 10);

    // Step 1: Get storage node endpoint
    const endpoint = await this.getStorageNodeEndpoint(numericId);

    // Step 2: Query errors on the storage node
    // sessionId: 0 = all sessions, query: "0 != 1" = always true (all errors)
    const queryParams = {
      accountId: numericId,
      sessionId: 0,
      query: "0 != 1",
      orderBy: "Time DESC",
      groupId: 0,
      account: endpoint.accountName,
      token: endpoint.token,
      range: { Offset: 0, Size: 500 },
    };

    let rawErrors: CoveStorageNodeError[];
    try {
      const result = await this.client.callStorageNode<CoveQueryErrorsResult>(
        endpoint.url,
        "QueryErrors",
        queryParams,
      );
      rawErrors = Array.isArray(result) ? result : result?.result ?? [];
    } catch (err) {
      // Token may have expired — clear endpoint cache, re-fetch, retry once
      if (err instanceof ConnectorError) {
        const endpointKey = `cove:storagenode:${this.config.toolId}:${numericId}`;
        await redis.del(endpointKey);

        const freshEndpoint = await this.getStorageNodeEndpoint(numericId);
        const retryResult = await this.client.callStorageNode<CoveQueryErrorsResult>(
          freshEndpoint.url,
          "QueryErrors",
          {
            ...queryParams,
            account: freshEndpoint.accountName,
            token: freshEndpoint.token,
          },
        );
        rawErrors = Array.isArray(retryResult) ? retryResult : retryResult?.result ?? [];
      } else {
        throw err;
      }
    }

    // Step 3: Normalize to BackupErrorDetail[]
    const errors: BackupErrorDetail[] = rawErrors.map((e) => ({
      filename: e.Filename,
      errorMessage: e.Text,
      errorCode: e.Code,
      occurrenceCount: e.Count,
      timestamp: new Date(e.Time * 1000).toISOString(),
      sessionId: String(e.SessionId),
    }));

    // Cache 5 min freshness, 1 hour Redis TTL
    const envelope = { data: errors, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", 60 * 60);

    return errors;
  }

  // ─── Recovery Verification (DRaaS REST API) ────────────────────

  /**
   * Fetch recovery verification data for a device via the DRaaS REST API.
   * Includes boot screenshot URL, boot/recovery details, and system events.
   * Returns { available: false } if recovery testing is not configured.
   */
  async getRecoveryVerification(deviceId: string): Promise<RecoveryVerification> {
    const key = `cove:recovery:${this.config.toolId}:${deviceId}`;
    const cached = await this.cacheGet<RecoveryVerification>(key);

    if (cached && this.isFresh(cached.cachedAt, 15 * 60)) {
      return cached.data;
    }

    const numericId = parseInt(deviceId, 10);

    // Step 1: Check if recovery testing exists for this device
    let stats: CoveDraasStatistic;
    try {
      const dashResp = await this.client.draasGet<{
        data: Array<{ type: string; id: string; attributes: CoveDraasStatistic }>;
      }>("/dashboard/", {
        "filter[backup_cloud_device_id.eq]": String(numericId),
        "filter[type.in]": "RECOVERY_TESTING,SELF_HOSTED,AZURE_SELF_HOSTED,ESXI_SELF_HOSTED",
      });

      if (!dashResp.data || dashResp.data.length === 0) {
        const notAvailable: RecoveryVerification = {
          available: false, bootStatus: null, recoveryStatus: null,
          backupSessionTimestamp: null, recoverySessionTimestamp: null,
          recoveryDurationSeconds: null, planName: null, restoreFormat: null,
          bootCheckFrequency: null, screenshotUrl: null,
          stoppedServices: [], systemEvents: [], colorbar: [],
        };
        const envelope = { data: notAvailable, cachedAt: Date.now() };
        await redis.set(key, JSON.stringify(envelope), "EX", 2 * 60 * 60);
        return notAvailable;
      }

      stats = dashResp.data[0].attributes;
    } catch (err) {
      console.error("[Cove] DRaaS dashboard error:", err);
      throw err;
    }

    // Step 2: Get session files (screenshot + system log) for the latest session
    let screenshotUrl: string | null = null;
    let stoppedServices: string[] = [];
    let systemEvents: RecoveryVerification["systemEvents"] = [];

    const sessionId = stats.last_recovery_session_id;
    if (sessionId && stats.last_recovery_screenshot_presented) {
      try {
        const filesResp = await this.client.draasGet<{
          data: CoveDraasSessionFile[];
        }>(`/sessions/${sessionId}/files/`, {
          "filter[file_type.in]": "screenshot,system_log",
        });

        for (const file of filesResp.data || []) {
          // Get temporary S3 URL for each file
          const tempUrlResp = await this.client.draasPost<{
            data: { attributes: { url: string } };
          }>(`/sessions/${sessionId}/files/${file.id}/get-temporary-url/`, {
            data: { type: "FileTemporaryUrl", attributes: { map: null, encoder: {}, updates: null, cloneFrom: null } },
          });

          const fileUrl = tempUrlResp.data?.attributes?.url;
          if (!fileUrl) continue;

          if (file.attributes.file_type === "screenshot") {
            // Fetch image server-side and return as base64 data URL to avoid CSP/SW issues
            try {
              const imgResp = await fetch(fileUrl, { signal: AbortSignal.timeout(15_000) });
              if (imgResp.ok) {
                const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                const contentType = imgResp.headers.get("content-type") || "image/png";
                screenshotUrl = `data:${contentType};base64,${imgBuf.toString("base64")}`;
              }
            } catch (imgErr) {
              console.error("[Cove] Failed to fetch recovery screenshot:", imgErr);
            }
          } else if (file.attributes.file_type === "system_log") {
            // Download and decode the system log (.info file — gzip-compressed JSON)
            try {
              const logResp = await fetch(fileUrl, {
                signal: AbortSignal.timeout(15_000),
              });
              if (logResp.ok) {
                const rawBuf = Buffer.from(await logResp.arrayBuffer());
                let jsonStr: string;

                // Try gzip decompress first (Cove stores .info as gzipped JSON)
                try {
                  jsonStr = gunzipSync(rawBuf).toString("utf-8");
                } catch {
                  // Fallback: try as plain text or base64
                  const text = rawBuf.toString("utf-8");
                  try {
                    JSON.parse(text);
                    jsonStr = text;
                  } catch {
                    jsonStr = Buffer.from(text, "base64").toString("utf-8");
                  }
                }

                const logData = JSON.parse(jsonStr) as CoveSystemLogInfo;

                stoppedServices = logData.VmSystemInfo?.StoppedServicesWithAutostart ?? [];
                systemEvents = (logData.VmSystemInfo?.SystemLogRecords ?? []).map((r) => ({
                  eventId: r.EventID,
                  level: r.Level,
                  message: r.Message,
                  provider: r.ProviderName,
                  timestamp: r.TimeCreated,
                }));
              }
            } catch (logErr) {
              console.error("[Cove] Failed to decode system log:", logErr);
            }
          }
        }
      } catch (fileErr) {
        console.error("[Cove] DRaaS session files error:", fileErr);
        // Continue without screenshot/log — still show what we have from dashboard
      }
    }

    // Step 3: Build normalized result
    // device_boot_frequency: 0-2 are session-based enums, larger values are seconds-based intervals
    const formatBootFrequency = (val: number): string => {
      if (val === 0) return "Each recovery session";
      if (val === 1) return "Every other session";
      if (val === 2) return "Every 3rd session";
      // Large values are seconds (86400 = 24h = daily)
      if (val >= 86400) {
        const days = Math.round(val / 86400);
        if (days === 1) return "Daily";
        if (days === 7) return "Weekly";
        if (days >= 28 && days <= 31) return "Monthly";
        return `Every ${days} days`;
      }
      if (val >= 3600) {
        const hours = Math.round(val / 3600);
        return `Every ${hours} hour${hours > 1 ? "s" : ""}`;
      }
      return `Every ${val + 1} sessions`;
    };

    const result: RecoveryVerification = {
      available: true,
      bootStatus: stats.last_boot_test_status?.toLowerCase() === "success" ? "success" : stats.last_boot_test_status ? "failed" : null,
      recoveryStatus: stats.current_recovery_status,
      backupSessionTimestamp: stats.last_boot_test_backup_session_timestamp
        ? new Date(stats.last_boot_test_backup_session_timestamp * 1000).toISOString()
        : null,
      recoverySessionTimestamp: stats.last_boot_test_recovery_session_timestamp
        ? new Date(stats.last_boot_test_recovery_session_timestamp * 1000).toISOString()
        : null,
      recoveryDurationSeconds: stats.last_recovery_duration_sec,
      planName: stats.plan_name,
      restoreFormat: stats.recovery_target_type,
      bootCheckFrequency: formatBootFrequency(stats.device_boot_frequency),
      screenshotUrl,
      stoppedServices,
      systemEvents,
      colorbar: (stats.colorbar ?? []).map((c) => ({
        status: c.status,
        sessionId: c.session_id,
        backupTimestamp: new Date(Number(c.backup_session_timestamp) * 1000).toISOString(),
        recoveryTimestamp: new Date(Number(c.recovery_session_timestamp) * 1000).toISOString(),
      })),
    };

    // Cache: 15 min freshness, 2 hour Redis TTL
    const envelope = { data: result, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", 2 * 60 * 60);

    return result;
  }

  // ─── Bulk Recovery-Enabled Devices (DRaaS) ────────────────────

  /**
   * Fetch all devices that have DRaaS recovery testing or standby configured.
   * Single bulk query — no per-device filter. Returns device ID → type/status map.
   */
  async getRecoveryEnabledDevices(): Promise<
    Array<{ deviceId: string; type: string; status: string; planName: string; targetType: string }>
  > {
    const key = `cove:draas-devices:${this.config.toolId}`;
    const cached = await this.cacheGet<Array<{ deviceId: string; type: string; status: string; planName: string; targetType: string }>>(key);

    if (cached && this.isFresh(cached.cachedAt, 30 * 60)) {
      return cached.data;
    }

    try {
      const resp = await this.client.draasGet<{
        data: Array<{ type: string; id: string; attributes: CoveDraasStatistic }>;
      }>("/dashboard/", {
        "filter[type.in]": "RECOVERY_TESTING,SELF_HOSTED,AZURE_SELF_HOSTED,ESXI_SELF_HOSTED",
      });

      const result = (resp.data ?? []).map((d) => ({
        deviceId: String(d.attributes.backup_cloud_device_id),
        type: d.attributes.type,
        status: d.attributes.current_recovery_status ?? "unknown",
        planName: d.attributes.plan_name ?? "",
        targetType: d.attributes.recovery_target_type ?? "",
      }));

      const envelope = { data: result, cachedAt: Date.now() };
      await redis.set(key, JSON.stringify(envelope), "EX", 2 * 60 * 60);
      return result;
    } catch (err) {
      console.error("[Cove] DRaaS bulk device query error:", err);
      return [];
    }
  }

  // ─── Health Check ──────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }

  // ─── Internal: Fetch All Devices (cached) ──────────────────────

  private async getAllDevices(): Promise<NormalizedBackupDevice[]> {
    const key = `cove:devices:${this.config.toolId}`;
    const cached = await this.cacheGet<NormalizedBackupDevice[]>(key);

    if (cached) {
      if (!this.isFresh(cached.cachedAt, FRESHNESS_DEVICES)) {
        // Stale — serve immediately, refresh in background
        this.backgroundRefresh(key, async () => {
          const fresh = await this.fetchAllDevicesFromApi();
          await this.cacheSet(key, fresh);
        });
      }
      return cached.data;
    }

    // Cache miss — fetch synchronously
    const devices = await this.fetchAllDevicesFromApi();
    await this.cacheSet(key, devices);
    return devices;
  }

  /** Fetch all devices from the Cove API (bypasses cache). */
  private async fetchAllDevicesFromApi(): Promise<NormalizedBackupDevice[]> {
    // Partner names are non-critical — fall back to empty map if fetch fails
    let partnerNames = new Map<number, string>();
    try {
      partnerNames = await this.getPartnerNameMap();
    } catch (err) {
      console.error("[Cove] Failed to fetch partner names (non-fatal):", err);
    }

    const rootPartnerId = await this.getRootPartnerId();
    const devices: NormalizedBackupDevice[] = [];

    // Paginate through all devices
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const rawResult = await this.client.call<CoveStatisticsResult>(
        "EnumerateAccountStatistics",
        {
          query: {
            PartnerId: rootPartnerId,
            StartRecordNumber: offset,
            RecordsCount: PAGE_SIZE,
            Columns: DEVICE_LIST_COLUMNS,
          },
        }
      );

      // Cove may or may not double-nest — handle both shapes
      const rows = Array.isArray(rawResult)
        ? rawResult
        : Array.isArray(rawResult?.result)
          ? rawResult.result
          : null;

      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        try {
          devices.push(mapStatisticsRow(row, DEVICE_LIST_COLUMNS, partnerNames));
        } catch (mapErr) {
          console.error("[Cove] Failed to map row", row.AccountId, ":", mapErr);
        }
      }

      offset += rows.length;
      hasMore = rows.length === PAGE_SIZE;
    }

    return devices;
  }

  // ─── Internal: Partner Management ──────────────────────────────

  private async getPartnerNameMap(): Promise<Map<number, string>> {
    const key = `cove:partners:${this.config.toolId}`;
    const cached = await this.cacheGet<[number, string][]>(key);

    if (cached) {
      if (!this.isFresh(cached.cachedAt, FRESHNESS_PARTNERS)) {
        // Stale — serve immediately, refresh in background
        this.backgroundRefresh(key, async () => {
          const fresh = await this.fetchPartnerNamesFromApi();
          await this.cacheSet(key, Array.from(fresh.entries()));
        });
      }
      return new Map(cached.data);
    }

    // Cache miss — fetch synchronously
    const map = await this.fetchPartnerNamesFromApi();
    await this.cacheSet(key, Array.from(map.entries()));
    return map;
  }

  private async fetchPartnerNamesFromApi(): Promise<Map<number, string>> {
    const rootPartnerId = await this.getRootPartnerId();
    const response = await this.client.call<{ result: CovePartner[] }>(
      "EnumeratePartners",
      { parentPartnerId: rootPartnerId, fields: ["Id", "Name"], fetchRecursively: true }
    );

    const map = new Map<number, string>();
    const partners = Array.isArray(response) ? response : response?.result;
    if (Array.isArray(partners)) {
      for (const p of partners) {
        map.set(p.Id, p.Name);
      }
    }
    return map;
  }

  private async getRootPartnerId(): Promise<number> {
    const key = `cove:rootpartner:${this.config.toolId}`;
    const cached = await redis.get(key);
    if (cached) return Number(cached);

    const partnerId = await this.client.getPartnerId();
    await redis.set(key, String(partnerId), "EX", REDIS_TTL);
    return partnerId;
  }

}
