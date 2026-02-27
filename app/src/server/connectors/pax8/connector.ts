/**
 * Pax8 Licensing Connector
 *
 * Implements ILicensingConnector for the Pax8 cloud distributor API.
 * Read-only: pulls companies, products, subscriptions, orders, invoices, usage.
 * Includes Redis stale-while-revalidate caching for companies and subscriptions.
 *
 * Docs: https://devx.pax8.com/docs
 */

import { redis } from "@/lib/redis";
import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import type {
  ILicensingConnector,
  NormalizedLicensingCompany,
  NormalizedLicensingProduct,
  NormalizedSubscription,
  NormalizedOrder,
  NormalizedInvoice,
  NormalizedInvoiceItem,
  NormalizedUsageSummary,
  SubscriptionFilter,
} from "../_interfaces/licensing";
import { Pax8Client } from "./client";
import type {
  Pax8Company,
  Pax8Product,
  Pax8Subscription,
  Pax8Order,
  Pax8Invoice,
  Pax8InvoiceItem,
  Pax8UsageSummary,
} from "./types";
import {
  mapCompany,
  mapProduct,
  mapSubscription,
  mapOrder,
  mapInvoice,
  mapInvoiceItem,
  mapUsageSummary,
} from "./mappers";

// Cache freshness windows
const FRESHNESS_COMPANIES = 60 * 60; // 1 hour
const FRESHNESS_SUBSCRIPTIONS = 30 * 60; // 30 min
const REDIS_TTL = 24 * 60 * 60; // 24 hours

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

const refreshInFlight = new Set<string>();

export class Pax8LicensingConnector implements ILicensingConnector {
  private client: Pax8Client;

  constructor(config: ConnectorConfig) {
    this.client = new Pax8Client(config);
  }

  // ─── Cache Helpers (mirrors Cove pattern) ───────────────────

  private async cacheGet<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CacheEnvelope<T>;
    } catch {
      return null;
    }
  }

  private async cacheSet<T>(key: string, data: T): Promise<void> {
    const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(envelope), "EX", REDIS_TTL);
  }

  private isFresh(cachedAt: number, freshnessSeconds: number): boolean {
    return Date.now() - cachedAt < freshnessSeconds * 1000;
  }

  private backgroundRefresh(
    key: string,
    refreshFn: () => Promise<void>
  ): void {
    if (refreshInFlight.has(key)) return;
    refreshInFlight.add(key);
    refreshFn()
      .catch((err) =>
        console.error(`[pax8] Background refresh failed for ${key}:`, err)
      )
      .finally(() => refreshInFlight.delete(key));
  }

  // ─── Companies ──────────────────────────────────────────────

  async getCompanies(): Promise<NormalizedLicensingCompany[]> {
    const key = "pax8:companies";
    const cached = await this.cacheGet<NormalizedLicensingCompany[]>(key);
    if (cached) {
      if (!this.isFresh(cached.cachedAt, FRESHNESS_COMPANIES)) {
        this.backgroundRefresh(key, async () => {
          const fresh = await this.fetchCompaniesFromApi();
          await this.cacheSet(key, fresh);
        });
      }
      return cached.data;
    }
    const companies = await this.fetchCompaniesFromApi();
    await this.cacheSet(key, companies);
    return companies;
  }

  private async fetchCompaniesFromApi(): Promise<NormalizedLicensingCompany[]> {
    const raw = await this.client.fetchAllPages<Pax8Company>("/companies");
    return raw.map(mapCompany);
  }

  async getCompanyById(id: string): Promise<NormalizedLicensingCompany> {
    const raw = await this.client.fetchOne<Pax8Company>(`/companies/${id}`);
    return mapCompany(raw);
  }

  // ─── Products ───────────────────────────────────────────────

  async getProducts(
    vendorName?: string
  ): Promise<NormalizedLicensingProduct[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (vendorName) params.vendorName = vendorName;
    const raw = await this.client.fetchAllPages<Pax8Product>(
      "/products",
      params
    );
    return raw.map(mapProduct);
  }

  async getProductById(id: string): Promise<NormalizedLicensingProduct> {
    const raw = await this.client.fetchOne<Pax8Product>(`/products/${id}`);
    return mapProduct(raw);
  }

  // ─── Subscriptions ──────────────────────────────────────────

  async getSubscriptions(
    filter?: SubscriptionFilter
  ): Promise<NormalizedSubscription[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (filter?.companyId) params.companyId = filter.companyId;
    if (filter?.productId) params.productId = filter.productId;
    if (filter?.status) params.status = filter.status;
    const raw = await this.client.fetchAllPages<Pax8Subscription>(
      "/subscriptions",
      params
    );
    const mapped = raw.map(mapSubscription);
    return this.enrichProductNames(mapped);
  }

  /**
   * Enrich subscriptions with real product names.
   * The /subscriptions list endpoint may not include the nested product.name,
   * falling back to "Product {uuid}". This method looks up the real names
   * from /products/{id} and caches them in Redis.
   */
  private async enrichProductNames(
    subs: NormalizedSubscription[]
  ): Promise<NormalizedSubscription[]> {
    // Find subs with fallback names (pattern: "Product {uuid}")
    const fallbackPattern = /^Product [0-9a-f-]{8,}/;
    const needsLookup = new Set<string>();
    for (const sub of subs) {
      if (fallbackPattern.test(sub.productName)) {
        needsLookup.add(sub.productId);
      }
    }
    if (needsLookup.size === 0) return subs;

    // Load product name cache from Redis
    const cacheKey = "pax8:product_name_map";
    const cached = await this.cacheGet<
      Record<string, { name: string; vendorName?: string }>
    >(cacheKey);
    const nameMap: Record<string, { name: string; vendorName?: string }> =
      cached?.data ?? {};

    // Remove IDs we already know
    for (const id of Array.from(needsLookup)) {
      if (nameMap[id]) needsLookup.delete(id);
    }

    // Fetch uncached products by ID (parallel batches of 10)
    if (needsLookup.size > 0) {
      const ids = Array.from(needsLookup);
      const batchSize = 10;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((id) =>
            this.client.fetchOne<Pax8Product>(`/products/${id}`)
          )
        );
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          if (result.status === "fulfilled") {
            nameMap[batch[j]] = {
              name: result.value.name,
              vendorName: result.value.vendorName,
            };
          }
        }
      }

      // Update Redis cache (long TTL — product names rarely change)
      await this.cacheSet(cacheKey, nameMap);
    }

    // Enrich subscriptions
    return subs.map((sub) => {
      const info = nameMap[sub.productId];
      if (fallbackPattern.test(sub.productName) && info) {
        return {
          ...sub,
          productName: info.name,
          vendorName: info.vendorName ?? sub.vendorName,
        };
      }
      return sub;
    });
  }

  async getSubscriptionById(id: string): Promise<NormalizedSubscription> {
    const raw = await this.client.fetchOne<Pax8Subscription>(
      `/subscriptions/${id}`
    );
    return mapSubscription(raw);
  }

  /**
   * Get all active subscriptions grouped by companyId.
   * Cached for billing reconciliation efficiency.
   */
  async getAllActiveSubscriptions(): Promise<
    Map<string, NormalizedSubscription[]>
  > {
    const key = "pax8:subscriptions:all";
    const cached =
      await this.cacheGet<[string, NormalizedSubscription[]][]>(key);
    if (cached) {
      if (!this.isFresh(cached.cachedAt, FRESHNESS_SUBSCRIPTIONS)) {
        this.backgroundRefresh(key, async () => {
          const fresh = await this.fetchAllActiveSubscriptionsGrouped();
          await this.cacheSet(key, Array.from(fresh.entries()));
        });
      }
      return new Map(cached.data);
    }
    const grouped = await this.fetchAllActiveSubscriptionsGrouped();
    await this.cacheSet(key, Array.from(grouped.entries()));
    return grouped;
  }

  private async fetchAllActiveSubscriptionsGrouped(): Promise<
    Map<string, NormalizedSubscription[]>
  > {
    const subs = await this.getSubscriptions({ status: "Active" });
    const grouped = new Map<string, NormalizedSubscription[]>();
    for (const sub of subs) {
      const list = grouped.get(sub.companyId) ?? [];
      list.push(sub);
      grouped.set(sub.companyId, list);
    }
    return grouped;
  }

  // ─── Orders ─────────────────────────────────────────────────

  async getOrders(companyId?: string): Promise<NormalizedOrder[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (companyId) params.companyId = companyId;
    const raw = await this.client.fetchAllPages<Pax8Order>("/orders", params);
    return raw.map(mapOrder);
  }

  // ─── Invoices ───────────────────────────────────────────────

  async getInvoices(companyId?: string): Promise<NormalizedInvoice[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (companyId) params.companyId = companyId;
    const raw = await this.client.fetchAllPages<Pax8Invoice>(
      "/invoices",
      params
    );
    return raw.map(mapInvoice);
  }

  async getInvoiceItems(invoiceId: string): Promise<NormalizedInvoiceItem[]> {
    const raw = await this.client.fetchAllPages<Pax8InvoiceItem>(
      `/invoices/${invoiceId}/items`
    );
    return raw.map(mapInvoiceItem);
  }

  // ─── Usage Summaries ────────────────────────────────────────

  async getUsageSummaries(
    companyId?: string
  ): Promise<NormalizedUsageSummary[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (companyId) params.companyId = companyId;
    const raw = await this.client.fetchAllPages<Pax8UsageSummary>(
      "/usage-summaries",
      params
    );
    return raw.map(mapUsageSummary);
  }

  // ─── Health Check ───────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
