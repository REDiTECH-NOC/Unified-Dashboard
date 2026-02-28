/**
 * Keeper → normalized type mappers.
 *
 * Maps Keeper MSP API responses into the unified types
 * used by the dashboard.
 */

import type {
  ManagedCompany,
  CompanyUsage,
  MonthlyUsage,
  PasswordManagerProduct,
} from "../_interfaces/password-manager";
import type {
  KeeperAccount,
  KeeperCurrentUsageResponse,
  KeeperMonthlyUsageResponse,
  KeeperProduct,
} from "./types";

// ─── Status Mapping ──────────────────────────────────────────────

function mapAccountStatus(
  account: KeeperAccount
): ManagedCompany["status"] {
  if (account.is_expired) return "expired";
  if (account.is_trial) return "trial";
  return "active";
}

// ─── Account → ManagedCompany ────────────────────────────────────

export function mapAccount(account: KeeperAccount): ManagedCompany {
  return {
    sourceToolId: "keeper",
    sourceId: String(account.enterprise_id),
    name: account.enterprise_name,
    status: mapAccountStatus(account),
    plan: account.product_id,
    licensesUsed: 0, // Populated from usage data
    licensesTotal: account.seats,
    storageUsedBytes: 0, // Populated from usage data
    storageTotalBytes: account.storage,
    addOns: account.add_ons
      ?.filter((a) => a.enabled)
      .map((a) => a.name) ?? [],
    expiresAt: account.expiration_date
      ? new Date(account.expiration_date)
      : undefined,
    _raw: account,
  };
}

// ─── Current Usage → CompanyUsage ────────────────────────────────

export function mapCurrentUsage(
  usage: KeeperCurrentUsageResponse
): CompanyUsage {
  return {
    companyId: String(usage.enterprise_id),
    companyName: usage.enterprise_name,
    totalUsers: usage.total_users,
    activeUsers: usage.active_users,
    totalRecords: usage.total_records,
    totalSharedFolders: usage.total_shared_folders,
    totalTeams: usage.total_teams,
    securityAuditScore: usage.security_audit_score,
    breachWatchRecordsAtRisk: usage.breachwatch_at_risk,
    licensesUsed: usage.seats_used,
    licensesTotal: usage.seats_total,
    storageUsedBytes: usage.storage_used,
    storageTotalBytes: usage.storage_total,
    _raw: usage,
  };
}

// ─── Monthly Usage → MonthlyUsage ────────────────────────────────

export function mapMonthlyUsage(
  usage: KeeperMonthlyUsageResponse
): MonthlyUsage {
  return {
    month: usage.month,
    companyId: String(usage.enterprise_id),
    companyName: usage.enterprise_name,
    baseSeats: usage.base_seats,
    seatsUsed: usage.seats_used,
    storageUsedBytes: usage.storage_used,
    addOnCosts: usage.add_on_costs ?? {},
    totalCost: usage.total_cost,
    _raw: usage,
  };
}

// ─── Product → PasswordManagerProduct ────────────────────────────

export function mapProduct(product: KeeperProduct): PasswordManagerProduct {
  return {
    sourceToolId: "keeper",
    sourceId: product.product_id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    unitPrice: product.unit_price,
    _raw: product,
  };
}
