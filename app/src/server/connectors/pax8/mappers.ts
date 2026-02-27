/**
 * Pax8 → Normalized type mappers.
 * Pure functions — no side effects, no API calls.
 */

import type {
  NormalizedLicensingCompany,
  NormalizedLicensingProduct,
  NormalizedSubscription,
  NormalizedOrder,
  NormalizedInvoice,
  NormalizedInvoiceItem,
  NormalizedUsageSummary,
} from "../_interfaces/licensing";
import type {
  Pax8Company,
  Pax8Product,
  Pax8Subscription,
  Pax8Order,
  Pax8Invoice,
  Pax8InvoiceItem,
  Pax8UsageSummary,
} from "./types";

const TOOL_ID = "pax8";

function safeDate(val?: string | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function mapCompany(raw: Pax8Company): NormalizedLicensingCompany {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    name: raw.name,
    status: raw.status,
    city: raw.city,
    country: raw.country,
  };
}

export function mapProduct(raw: Pax8Product): NormalizedLicensingProduct {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    name: raw.name,
    vendorName: raw.vendorName,
    sku: raw.sku,
    description: raw.description ?? raw.shortDescription,
    billingTerm: raw.billingTerm,
  };
}

export function mapSubscription(raw: Pax8Subscription): NormalizedSubscription {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    companyId: raw.companyId,
    companyName: undefined, // Enriched later if needed
    productId: raw.productId,
    productName: raw.product?.name ?? `Product ${raw.productId}`,
    vendorName: raw.product?.vendorName,
    quantity: raw.quantity,
    status: raw.status ?? "unknown",
    price: raw.price,
    billingTerm: raw.billingTerm,
    startDate: safeDate(raw.startDate),
    endDate: safeDate(raw.endDate),
    createdDate: safeDate(raw.createdDate),
  };
}

export function mapOrder(raw: Pax8Order): NormalizedOrder {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    companyId: raw.companyId,
    status: raw.status,
    createdDate: safeDate(raw.createdDate),
    lineItemCount: raw.lineItems?.length,
  };
}

export function mapInvoice(raw: Pax8Invoice): NormalizedInvoice {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    companyId: raw.companyId,
    invoiceDate: safeDate(raw.invoiceDate),
    dueDate: safeDate(raw.dueDate),
    status: raw.status,
    total: raw.total ?? raw.partnerTotal,
    balance: raw.balance,
  };
}

export function mapInvoiceItem(raw: Pax8InvoiceItem): NormalizedInvoiceItem {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    invoiceId: raw.invoiceId ?? "",
    productName: raw.productName,
    subscriptionId: raw.subscriptionId,
    quantity: raw.quantity,
    unitPrice: raw.unitPrice,
    subtotal: raw.subtotal,
  };
}

export function mapUsageSummary(
  raw: Pax8UsageSummary
): NormalizedUsageSummary {
  return {
    sourceToolId: TOOL_ID,
    sourceId: raw.id,
    companyId: raw.companyId,
    productId: raw.productId,
    subscriptionId: raw.subscriptionId,
    quantity: raw.quantity,
    currentCharges: raw.currentCharges,
    unitOfMeasurement: raw.unitOfMeasurement,
  };
}
