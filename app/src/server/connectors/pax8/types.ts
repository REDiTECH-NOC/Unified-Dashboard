/**
 * Raw Pax8 API response types.
 *
 * These match the Pax8 REST API v1 response shapes exactly.
 * Fields are optional where the API may omit them in list vs detail views.
 *
 * Docs: https://devx.pax8.com/reference
 */

// ─── OAuth Token ─────────────────────────────────────────────

export interface Pax8OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number; // 86400 (24 hours)
  scope: string;
  expires_at: string; // ISO timestamp
}

// ─── Pagination Wrapper ─────────────────────────────────────

export interface Pax8PagedResponse<T> {
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number; // Current page (0-based)
  };
  content: T[];
}

// ─── Company ─────────────────────────────────────────────────

export interface Pax8Company {
  id: string;
  name: string;
  street?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  website?: string;
  externalId?: string;
  status?: string; // "Active", "Inactive", etc.
  billOnBehalfOfEnabled?: boolean;
  selfServiceAllowed?: boolean;
  orderApprovalRequired?: boolean;
}

// ─── Product ─────────────────────────────────────────────────

export interface Pax8Product {
  id: string;
  vendorName?: string;
  name: string;
  sku?: string;
  description?: string;
  shortDescription?: string;
  vendorSku?: string;
  vendorId?: string;
  unitOfMeasurement?: string;
  billingTerm?: string;
}

// ─── Subscription ────────────────────────────────────────────

export interface Pax8Subscription {
  id: string;
  companyId: string;
  productId: string;
  quantity: number;
  startDate?: string;
  endDate?: string;
  createdDate?: string;
  billingStart?: string;
  status?: string; // "Active", "Cancelled", "PendingManual", etc.
  price?: number;
  billingTerm?: string; // "Monthly", "Annual"
  provisioningStatus?: string;
  commitmentTermId?: string;
  product?: {
    id: string;
    name: string;
    vendorName?: string;
  };
}

// ─── Subscription History ────────────────────────────────────

export interface Pax8SubscriptionHistoryEntry {
  id?: string;
  subscriptionId: string;
  action?: string;
  date?: string;
  details?: Record<string, unknown>;
}

// ─── Order ───────────────────────────────────────────────────

export interface Pax8Order {
  id: string;
  companyId?: string;
  orderedBy?: string;
  createdDate?: string;
  lineItems?: Pax8OrderLineItem[];
  status?: string;
}

export interface Pax8OrderLineItem {
  id?: string;
  productId?: string;
  lineItemNumber?: number;
  quantity?: number;
  provisioningDetails?: Record<string, unknown>;
}

// ─── Invoice ─────────────────────────────────────────────────

export interface Pax8Invoice {
  id: string;
  companyId?: string;
  invoiceDate?: string;
  dueDate?: string;
  status?: string; // "Unpaid", "Paid", "Void"
  total?: number;
  balance?: number;
  carriedBalance?: number;
  partnerTotal?: number;
  currencyCode?: string;
}

export interface Pax8InvoiceItem {
  id: string;
  invoiceId?: string;
  companyId?: string;
  productId?: string;
  productName?: string;
  subscriptionId?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  transactionDate?: string;
  vendorName?: string;
}

// ─── Usage Summary ───────────────────────────────────────────

export interface Pax8UsageSummary {
  id: string;
  companyId?: string;
  productId?: string;
  subscriptionId?: string;
  quantity?: number;
  unitOfMeasurement?: string;
  currentCharges?: number;
  date?: string;
  resourceGroup?: string;
}

// ─── Contact ─────────────────────────────────────────────────

export interface Pax8Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyId?: string;
  types?: string[];
}
