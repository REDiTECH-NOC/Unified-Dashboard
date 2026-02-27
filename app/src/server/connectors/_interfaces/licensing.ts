/**
 * Licensing connector interface — tool-agnostic contract for distributor integrations.
 *
 * Implemented by: Pax8LicensingConnector
 * Future: Could be implemented by Ingram Micro Cloud, AppDirect, etc.
 */

import type { HealthCheckResult } from "../_base/types";

// ─── Normalized Types ────────────────────────────────────────

export interface NormalizedLicensingCompany {
  sourceToolId: string;
  sourceId: string;
  name: string;
  status?: string;
  city?: string;
  country?: string;
}

export interface NormalizedLicensingProduct {
  sourceToolId: string;
  sourceId: string;
  name: string;
  vendorName?: string;
  sku?: string;
  description?: string;
  billingTerm?: string;
}

export interface NormalizedSubscription {
  sourceToolId: string;
  sourceId: string;
  companyId: string;
  companyName?: string;
  productId: string;
  productName: string;
  vendorName?: string;
  quantity: number;
  status: string;
  price?: number;
  billingTerm?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  createdDate?: Date | null;
}

export interface NormalizedOrder {
  sourceToolId: string;
  sourceId: string;
  companyId?: string;
  status?: string;
  createdDate?: Date | null;
  lineItemCount?: number;
}

export interface NormalizedInvoice {
  sourceToolId: string;
  sourceId: string;
  companyId?: string;
  invoiceDate?: Date | null;
  dueDate?: Date | null;
  status?: string;
  total?: number;
  balance?: number;
}

export interface NormalizedInvoiceItem {
  sourceToolId: string;
  sourceId: string;
  invoiceId: string;
  productName?: string;
  subscriptionId?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
}

export interface NormalizedUsageSummary {
  sourceToolId: string;
  sourceId: string;
  companyId?: string;
  productId?: string;
  subscriptionId?: string;
  quantity?: number;
  currentCharges?: number;
  unitOfMeasurement?: string;
}

// ─── Filters ─────────────────────────────────────────────────

export interface SubscriptionFilter {
  companyId?: string;
  productId?: string;
  status?: string;
}

// ─── Interface ───────────────────────────────────────────────

export interface ILicensingConnector {
  /** List all companies/customers from the distributor */
  getCompanies(): Promise<NormalizedLicensingCompany[]>;

  /** Get a single company by external ID */
  getCompanyById(id: string): Promise<NormalizedLicensingCompany>;

  /** List product catalog */
  getProducts(vendorName?: string): Promise<NormalizedLicensingProduct[]>;

  /** Get single product details */
  getProductById(id: string): Promise<NormalizedLicensingProduct>;

  /** List subscriptions with optional filtering */
  getSubscriptions(
    filter?: SubscriptionFilter
  ): Promise<NormalizedSubscription[]>;

  /** Get single subscription */
  getSubscriptionById(id: string): Promise<NormalizedSubscription>;

  /** List orders */
  getOrders(companyId?: string): Promise<NormalizedOrder[]>;

  /** List invoices */
  getInvoices(companyId?: string): Promise<NormalizedInvoice[]>;

  /** Get invoice line items */
  getInvoiceItems(invoiceId: string): Promise<NormalizedInvoiceItem[]>;

  /** Get current month usage summaries */
  getUsageSummaries(companyId?: string): Promise<NormalizedUsageSummary[]>;

  /** Health check */
  healthCheck(): Promise<HealthCheckResult>;
}
