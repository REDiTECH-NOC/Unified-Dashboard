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

import { redis } from "@/lib/redis";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  IBackupConnector,
  NormalizedBackupCustomer,
  NormalizedBackupDevice,
  BackupDashboardSummary,
  BackupDeviceFilter,
  BackupOverallStatus,
} from "../_interfaces/backup";
import type { NormalizedAlert } from "../_interfaces/common";
import { CoveClient } from "./client";
import type { BackupSessionHistoryEntry } from "../_interfaces/backup";
import {
  DEVICE_LIST_COLUMNS,
  HISTORY_COLUMNS,
  type CoveStatisticsResult,
  type CovePartner,
} from "./types";
import {
  mapStatisticsRow,
  mapHistoryRows,
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
      // 15 min freshness for session history
      return cached.data;
    }

    // Fetch from API
    const rootPartnerId = await this.getRootPartnerId();
    const numericId = parseInt(deviceId, 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rawResult = await this.client.call<CoveStatisticsResult>(
      "EnumerateAccountHistoryStatistics",
      {
        query: {
          PartnerId: rootPartnerId,
          Filter: `AccountId EQ ${numericId}`,
          StartRecordNumber: 0,
          RecordsCount: 100,
          Columns: HISTORY_COLUMNS,
        },
      }
    );

    const entries = mapHistoryRows(rawResult);

    // Cache with shorter TTL for history (6 hours)
    const envelope = { data: entries, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", 6 * 60 * 60);

    return entries;
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
