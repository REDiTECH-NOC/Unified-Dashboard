/**
 * Password Manager Connector Interface — normalized types for MSP password management.
 *
 * Designed for Keeper Security MSP but generic enough for any MSP password vault.
 * All routers and UI use these types exclusively.
 */

import type { HealthCheckResult } from "../_base/types";

// ─── Normalized Types ────────────────────────────────────────────

/** A managed company/account under the MSP */
export interface ManagedCompany {
  sourceToolId: string;
  sourceId: string;
  name: string;
  status: "active" | "trial" | "expired" | "cancelled" | "suspended" | "unknown";
  plan: string;
  licensesUsed: number;
  licensesTotal: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  addOns: string[];
  createdAt?: Date;
  expiresAt?: Date;
  _raw?: unknown;
}

/** Real-time usage metrics for a managed company */
export interface CompanyUsage {
  companyId: string;
  companyName: string;
  totalUsers: number;
  activeUsers: number;
  totalRecords: number;
  totalSharedFolders: number;
  totalTeams: number;
  securityAuditScore?: number;
  breachWatchRecordsAtRisk?: number;
  licensesUsed: number;
  licensesTotal: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  _raw?: unknown;
}

/** Historical monthly billing/usage data */
export interface MonthlyUsage {
  month: string;
  companyId: string;
  companyName: string;
  baseSeats: number;
  seatsUsed: number;
  storageUsedBytes: number;
  addOnCosts: Record<string, number>;
  totalCost: number;
  _raw?: unknown;
}

/** Product in the MSP catalog */
export interface PasswordManagerProduct {
  sourceToolId: string;
  sourceId: string;
  name: string;
  sku: string;
  category: string;
  unitPrice?: number;
  _raw?: unknown;
}

// ─── Interface ───────────────────────────────────────────────────

export interface IPasswordManagerConnector {
  /** List all managed companies under the MSP */
  listManagedCompanies(): Promise<ManagedCompany[]>;

  /** Get current usage for one or more companies */
  getCompanyUsage(companyIds: string[]): Promise<CompanyUsage[]>;

  /** Get monthly usage/billing data */
  getMonthlyUsage(companyIds: string[], month: string): Promise<MonthlyUsage[]>;

  /** Get product catalog */
  getProducts(): Promise<PasswordManagerProduct[]>;

  /** Validate credentials */
  healthCheck(): Promise<HealthCheckResult>;
}
