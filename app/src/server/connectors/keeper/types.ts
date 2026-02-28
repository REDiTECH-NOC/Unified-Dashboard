/**
 * Keeper Security MSP API response types.
 *
 * Based on the Keeper MSP Account Management REST API.
 * Auth: JWT HS512, 5-minute token expiration.
 * Base URL: https://keepersecurity.com/api/rest/enterprise/v1
 */

// ─── Account (Managed Company) ──────────────────────────────────

export interface KeeperAccount {
  enterprise_id: number;
  enterprise_name: string;
  node_id: number;
  product_id: string;
  seats: number;
  storage: number;
  /** ISO 8601 date string */
  expiration_date: string;
  is_trial: boolean;
  is_expired: boolean;
  add_ons?: KeeperAddOn[];
}

export interface KeeperAddOn {
  add_on_id: string;
  name: string;
  seats?: number;
  enabled: boolean;
}

// ─── Usage (Current) ────────────────────────────────────────────

export interface KeeperCurrentUsageRequest {
  enterprise_ids: number[];
}

export interface KeeperCurrentUsageResponse {
  enterprise_id: number;
  enterprise_name: string;
  total_users: number;
  active_users: number;
  total_records: number;
  total_shared_folders: number;
  total_teams: number;
  security_audit_score?: number;
  breachwatch_at_risk?: number;
  seats_total: number;
  seats_used: number;
  storage_total: number;
  storage_used: number;
}

// ─── Usage (Monthly) ────────────────────────────────────────────

export interface KeeperMonthlyUsageRequest {
  enterprise_ids: number[];
  month: string; // "YYYY-MM"
}

export interface KeeperMonthlyUsageResponse {
  enterprise_id: number;
  enterprise_name: string;
  month: string;
  base_seats: number;
  seats_used: number;
  storage_used: number;
  add_on_costs: Record<string, number>;
  total_cost: number;
}

// ─── Products ───────────────────────────────────────────────────

export interface KeeperProduct {
  product_id: string;
  name: string;
  sku: string;
  category: string;
  unit_price?: number;
}

// ─── API Response Wrappers ──────────────────────────────────────

export interface KeeperListResponse<T> {
  data: T[];
  total?: number;
}
