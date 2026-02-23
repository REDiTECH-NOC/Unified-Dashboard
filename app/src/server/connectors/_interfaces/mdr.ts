/**
 * IMdrConnector — interface for Managed Detection & Response tools.
 *
 * Current implementation: Blackpoint CompassOne
 * Future: Arctic Wolf, Huntress MDR, etc.
 *
 * MDR tools differ from EDR (SentinelOne) in key ways:
 * - Detections are grouped (alert groups), not individual threats
 * - A 24/7 SOC triages detections — the tool reports what the SOC found
 * - Actions are SOC-driven, not self-service (no isolate/scan from API)
 * - Includes tenant/customer management (MSP multi-tenancy)
 * - May include vulnerability management, cloud security, etc.
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type { NormalizedThreat, NormalizedAlert, NormalizedDevice, NormalizedOrganization } from "./common";

export interface DetectionFilter {
  status?: string[];
  detectionType?: string;
  search?: string;
  since?: Date;
  sortByColumn?: string;
  sortDirection?: "ASC" | "DESC";
}

export interface AssetFilter {
  tenantId?: string;
  assetClass?: string;
  search?: string;
  sortByColumn?: string;
  sortDirection?: "ASC" | "DESC";
}

export interface IMdrConnector {
  // --- Detections (Alert Groups) ---
  getDetections(
    filter?: DetectionFilter,
    skip?: number,
    take?: number
  ): Promise<PaginatedResponse<NormalizedThreat>>;

  getDetectionById(id: string): Promise<NormalizedThreat>;

  getDetectionAlerts(
    alertGroupId: string,
    skip?: number,
    take?: number
  ): Promise<PaginatedResponse<NormalizedAlert>>;

  getDetectionCount(filter?: DetectionFilter): Promise<number>;

  getDetectionsByWeek(
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ date: Date; count: number }>>;

  getTopDetectionsByEntity(
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<Array<{ name: string; count: number }>>;

  getTopDetectionsByThreat(
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<Array<{ name: string; count: number; percentage: number }>>;

  // --- Assets ---
  getAssets(
    filter?: AssetFilter,
    skip?: number,
    take?: number
  ): Promise<PaginatedResponse<NormalizedDevice>>;

  getAssetById(id: string): Promise<NormalizedDevice>;

  // --- Tenants (Organizations) ---
  getTenants(
    skip?: number,
    take?: number
  ): Promise<PaginatedResponse<NormalizedOrganization>>;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
