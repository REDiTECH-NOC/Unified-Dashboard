/**
 * Blackpoint CompassOne connector — full API coverage across all 16 categories.
 *
 * Implements IMdrConnector for unified detection/asset/tenant queries.
 * Also exposes the full CompassOne API: vulnerability management, cloud MDR,
 * notification channels, users, contact groups, collections, and scans.
 *
 * API v1.4.0 — https://api.blackpointcyber.com
 */

import type { ConnectorConfig, PaginatedResponse, HealthCheckResult } from "../_base/types";
import type { IMdrConnector, DetectionFilter, AssetFilter } from "../_interfaces/mdr";
import type { NormalizedThreat, NormalizedAlert, NormalizedDevice, NormalizedOrganization } from "../_interfaces/common";
import { BlackpointClient } from "./client";
import type {
  BPPaginatedResponse, BPPagePaginatedResponse, BPDataResponse,
  BPAlertGroup, BPAlert, BPAlertGroupCount, BPAlertGroupsByWeek,
  BPTopDetectionsByEntity, BPTopDetectionsByThreat,
  BPAsset, BPAssetRelationship,
  BPCollection, BPCollectionCreateInput, BPCollectionUpdateInput,
  BPVulnerability, BPScan, BPScanSchedule, BPScanAndSchedule,
  BPScanCreateInput, BPScanScheduleCreateInput, BPSeverityCount, BPTenantVulnCount,
  BPCveReference,
  BPMs365Connection, BPMs365User, BPMs365UserIsoCountry,
  BPConnectionApprovedCountry, BPConnectionUser, BPConnectionUserApprovedCountry,
  BPIsoCountry,
  BPGoogleOnboarding,
  BPCiscoDuoOnboarding, BPCiscoDuoOnboardingCreateInput,
  BPChannel, BPEmailChannel, BPEmailChannelCreateInput, BPEmailChannelUpdateInput,
  BPWebhookChannel, BPWebhookChannelCreateInput, BPWebhookChannelUpdateInput,
  BPAccount, BPTenant, BPUser, BPTenantUser,
  BPUserInviteInput, BPUserUpdateInput,
  BPContactGroup, BPContactGroupCreateInput, BPContactGroupMember, BPContactGroupMemberCreateInput,
} from "./types";
import {
  mapAlertGroupToThreat, mapAlertToNormalized,
  mapAssetToDevice, mapTenantToOrganization,
} from "./mappers";

// Helper to convert our PaginatedResponse from BP's envelope
function toPaginated<TRaw, TMapped>(
  response: BPPaginatedResponse<TRaw>,
  mapper: (item: TRaw) => TMapped
): PaginatedResponse<TMapped> {
  return {
    data: response.items.map(mapper),
    hasMore: response.end < response.total - 1,
    nextCursor: response.end < response.total - 1 ? response.end + 1 : undefined,
    totalCount: response.total,
  };
}

export class BlackpointConnector implements IMdrConnector {
  private client: BlackpointClient;

  constructor(config: ConnectorConfig) {
    this.client = new BlackpointClient(config);
  }

  // =========================================================================
  // IMdrConnector — Detections (Alert Groups)
  // =========================================================================

  async getDetections(
    filter?: DetectionFilter,
    skip = 0,
    take = 100
  ): Promise<PaginatedResponse<NormalizedThreat>> {
    const params: Record<string, string | number | boolean | undefined> = {
      skip,
      take,
      sortByColumn: filter?.sortByColumn ?? "created",
      sortDirection: filter?.sortDirection ?? "DESC",
    };
    if (filter?.detectionType) params.detectionType = filter.detectionType;
    if (filter?.search) params.search = filter.search;
    if (filter?.since) params.since = filter.since.toISOString();

    const response = await this.client.requestBP<BPPaginatedResponse<BPAlertGroup>>({
      path: "/v1/alert-groups",
      params,
    });

    return toPaginated(response, mapAlertGroupToThreat);
  }

  async getDetectionById(id: string): Promise<NormalizedThreat> {
    const alertGroup = await this.client.requestBP<BPAlertGroup>({
      path: `/v1/alert-groups/${id}`,
    });
    return mapAlertGroupToThreat(alertGroup);
  }

  async getDetectionAlerts(
    alertGroupId: string,
    skip = 0,
    take = 100
  ): Promise<PaginatedResponse<NormalizedAlert>> {
    const response = await this.client.requestBP<BPPaginatedResponse<BPAlert>>({
      path: `/v1/alert-groups/${alertGroupId}/alerts`,
      params: { skip, take },
    });
    return toPaginated(response, mapAlertToNormalized);
  }

  async getDetectionCount(filter?: DetectionFilter): Promise<number> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (filter?.detectionType) params.detectionType = filter.detectionType;
    if (filter?.since) params.since = filter.since.toISOString();

    const response = await this.client.requestBP<BPAlertGroupCount>({
      path: "/v1/alert-groups/count",
      params,
    });
    return response.count;
  }

  async getDetectionsByWeek(
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ date: Date; count: number }>> {
    const params: Record<string, string | undefined> = {};
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    const response = await this.client.requestBP<BPAlertGroupsByWeek[]>({
      path: "/v1/alert-groups/alert-groups-by-week",
      params,
    });
    return response.map(item => ({
      date: new Date(item.date),
      count: item.count,
    }));
  }

  async getTopDetectionsByEntity(
    startDate?: Date,
    endDate?: Date,
    limit = 10
  ): Promise<Array<{ name: string; count: number }>> {
    const params: Record<string, string | number | undefined> = { limit };
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    return this.client.requestBP<BPTopDetectionsByEntity[]>({
      path: "/v1/alert-groups/top-detections-by-entity",
      params,
    });
  }

  async getTopDetectionsByThreat(
    startDate?: Date,
    endDate?: Date,
    limit = 10
  ): Promise<Array<{ name: string; count: number; percentage: number }>> {
    const params: Record<string, string | number | undefined> = { limit };
    if (startDate) params.startDate = startDate.toISOString();
    if (endDate) params.endDate = endDate.toISOString();

    return this.client.requestBP<BPTopDetectionsByThreat[]>({
      path: "/v1/alert-groups/top-detections-by-threat",
      params,
    });
  }

  // =========================================================================
  // IMdrConnector — Assets
  // =========================================================================

  async getAssets(
    filter?: AssetFilter,
    skip = 0,
    take = 100
  ): Promise<PaginatedResponse<NormalizedDevice>> {
    const params: Record<string, string | number | boolean | undefined> = { skip, take };
    if (filter?.assetClass) params.assetClass = filter.assetClass;
    if (filter?.search) params.search = filter.search;
    if (filter?.sortByColumn) params.sortByColumn = filter.sortByColumn;
    if (filter?.sortDirection) params.sortDirection = filter.sortDirection;

    const response = await this.client.requestBP<BPPaginatedResponse<BPAsset>>({
      path: "/v1/assets",
      params,
      tenantId: filter?.tenantId,
    });
    return toPaginated(response, mapAssetToDevice);
  }

  async getAssetById(id: string): Promise<NormalizedDevice> {
    const asset = await this.client.requestBP<BPAsset>({
      path: `/v1/assets/${id}`,
    });
    return mapAssetToDevice(asset);
  }

  async getAssetRelationships(
    assetId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPAssetRelationship>> {
    return this.client.requestBP<BPPaginatedResponse<BPAssetRelationship>>({
      path: `/v1/assets/${assetId}/relationships`,
      params: { skip, take },
    });
  }

  // =========================================================================
  // IMdrConnector — Tenants
  // =========================================================================

  async getTenants(
    skip = 0,
    take = 100
  ): Promise<PaginatedResponse<NormalizedOrganization>> {
    const response = await this.client.requestBP<BPPaginatedResponse<BPTenant>>({
      path: "/v1/tenants",
      params: { skip, take },
    });
    return toPaginated(response, mapTenantToOrganization);
  }

  async getTenantById(accountId: string, tenantId: string): Promise<BPTenant> {
    return this.client.requestBP<BPTenant>({
      path: `/v1/accounts/${accountId}/tenants/${tenantId}`,
    });
  }

  // =========================================================================
  // Accounts
  // =========================================================================

  async getAccounts(skip = 0, take = 100): Promise<BPPaginatedResponse<BPAccount>> {
    return this.client.requestBP<BPPaginatedResponse<BPAccount>>({
      path: "/v1/accounts",
      params: { skip, take },
    });
  }

  async getAccountById(accountId: string): Promise<BPAccount> {
    return this.client.requestBP<BPAccount>({
      path: `/v1/accounts/${accountId}`,
    });
  }

  // =========================================================================
  // Collections (Saved Searches/Filters)
  // =========================================================================

  async getCollections(skip = 0, take = 100): Promise<BPPaginatedResponse<BPCollection>> {
    return this.client.requestBP<BPPaginatedResponse<BPCollection>>({
      path: "/v1/collections",
      params: { skip, take },
    });
  }

  async getCollectionById(id: string): Promise<BPCollection> {
    return this.client.requestBP<BPCollection>({
      path: `/v1/collections/${id}`,
    });
  }

  async createCollection(input: BPCollectionCreateInput): Promise<BPCollection> {
    return this.client.requestBP<BPCollection>({
      method: "POST",
      path: "/v1/collections",
      body: input,
    });
  }

  async updateCollection(id: string, input: BPCollectionUpdateInput): Promise<BPCollection> {
    return this.client.requestBP<BPCollection>({
      method: "PATCH",
      path: `/v1/collections/${id}`,
      body: input,
    });
  }

  async deleteCollection(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/collections/${id}`,
    });
  }

  // =========================================================================
  // Cloud MDR — M365
  // =========================================================================

  async getMs365Connections(tenantId?: string): Promise<BPMs365Connection[]> {
    return this.client.requestBP<BPMs365Connection[]>({
      path: "/v1/cloud/ms365/customer",
      tenantId,
    });
  }

  async getMs365ConnectionById(connectionId: string): Promise<BPMs365Connection> {
    return this.client.requestBP<BPMs365Connection>({
      path: `/v1/cloud/ms365/connections/${connectionId}`,
    });
  }

  async getMs365ApprovedCountries(connectionId: string): Promise<BPIsoCountry[]> {
    return this.client.requestBP<BPIsoCountry[]>({
      path: `/v1/cloud/ms365/connections/${connectionId}/iso-country`,
    });
  }

  async approveMs365Country(connectionId: string, isoCountryCode: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/cloud/ms365/connections/${connectionId}/iso-country`,
      body: { code: isoCountryCode },
    });
  }

  async removeMs365ApprovedCountry(connectionId: string, isoCountryCode: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/cloud/ms365/connections/${connectionId}/iso-country`,
      body: { code: isoCountryCode },
    });
  }

  async getMs365Users(
    connectionId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPMs365User>> {
    return this.client.requestBP<BPPaginatedResponse<BPMs365User>>({
      path: `/v1/cloud/ms365/connections/${connectionId}/users`,
      params: { skip, take },
    });
  }

  async approveMs365UserCountry(
    connectionId: string,
    userId: string,
    isoCountryCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/cloud/ms365/connections/${connectionId}/users/${userId}/isoCountry`,
      body: { isoCountryCode, startDate, endDate },
    });
  }

  async removeMs365UserCountry(
    connectionId: string,
    userId: string,
    isoCountryId: string
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/cloud/ms365/connections/${connectionId}/users/${userId}/isoCountry/${isoCountryId}`,
    });
  }

  async getMs365UserActiveCountries(
    connectionId: string,
    userId: string
  ): Promise<BPMs365UserIsoCountry[]> {
    return this.client.requestBP<BPMs365UserIsoCountry[]>({
      path: `/v1/cloud/ms365/connections/${connectionId}/users/${userId}/active-countries`,
    });
  }

  // =========================================================================
  // Cloud MDR — Generic Connections (M365/Cisco/Google unified)
  // =========================================================================

  async getConnectionApprovedCountries(
    connectionId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPConnectionApprovedCountry>> {
    return this.client.requestBP<BPPaginatedResponse<BPConnectionApprovedCountry>>({
      path: `/v1/cloud/connections/${connectionId}/approved-countries`,
      params: { skip, take },
    });
  }

  async approveConnectionCountry(connectionId: string, isoCountryCode: string): Promise<BPConnectionApprovedCountry> {
    return this.client.requestBP<BPConnectionApprovedCountry>({
      method: "PUT",
      path: `/v1/cloud/connections/${connectionId}/approved-countries`,
      body: { isoCountryCode },
    });
  }

  async removeConnectionApprovedCountry(connectionId: string, countryId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/cloud/connections/${connectionId}/approved-countries/${countryId}`,
    });
  }

  async getConnectionUsers(
    connectionId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPConnectionUser>> {
    return this.client.requestBP<BPPaginatedResponse<BPConnectionUser>>({
      path: `/v1/cloud/connections/${connectionId}/users`,
      params: { skip, take },
    });
  }

  async getConnectionUserApprovedCountries(
    connectionId: string,
    connectionUserId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPConnectionUserApprovedCountry>> {
    return this.client.requestBP<BPPaginatedResponse<BPConnectionUserApprovedCountry>>({
      path: `/v1/cloud/connections/${connectionId}/users/${connectionUserId}/approved-countries`,
      params: { skip, take },
    });
  }

  async approveConnectionUserCountry(
    connectionId: string,
    connectionUserId: string,
    isoCountryCode: string,
    startDate?: string,
    endDate?: string
  ): Promise<BPConnectionUserApprovedCountry> {
    return this.client.requestBP<BPConnectionUserApprovedCountry>({
      method: "POST",
      path: `/v1/cloud/connections/${connectionId}/users/${connectionUserId}/approved-countries`,
      body: { isoCountryCode, startDate, endDate },
    });
  }

  async removeConnectionUserApprovedCountry(
    connectionId: string,
    connectionUserId: string,
    countryId: string
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/cloud/connections/${connectionId}/users/${connectionUserId}/approved-countries/${countryId}`,
    });
  }

  async getIsoCountries(): Promise<BPIsoCountry[]> {
    return this.client.requestBP<BPIsoCountry[]>({
      path: "/v1/cloud/iso-countries",
    });
  }

  async getIsoCountryByCode(code: string): Promise<BPIsoCountry> {
    return this.client.requestBP<BPIsoCountry>({
      path: `/v1/cloud/iso-countries/${code}`,
    });
  }

  // =========================================================================
  // Cloud MDR — Google Workspace
  // =========================================================================

  async getGoogleOnboardings(): Promise<BPGoogleOnboarding[]> {
    return this.client.requestBP<BPGoogleOnboarding[]>({
      path: "/v1/cloud/google/onboardings",
    });
  }

  async getGoogleOnboardingById(onboardingId: string): Promise<BPGoogleOnboarding> {
    return this.client.requestBP<BPGoogleOnboarding>({
      path: `/v1/cloud/google/onboardings/${onboardingId}`,
    });
  }

  // =========================================================================
  // Cloud MDR — Cisco Duo
  // =========================================================================

  async getCiscoDuoOnboardings(): Promise<BPCiscoDuoOnboarding[]> {
    return this.client.requestBP<BPCiscoDuoOnboarding[]>({
      path: "/v1/cloud/cisco/onboardings",
    });
  }

  async createCiscoDuoOnboarding(input: BPCiscoDuoOnboardingCreateInput): Promise<BPCiscoDuoOnboarding> {
    return this.client.requestBP<BPCiscoDuoOnboarding>({
      method: "POST",
      path: "/v1/cloud/cisco/onboardings",
      body: input,
    });
  }

  async getCiscoDuoOnboardingById(onboardingId: string): Promise<BPCiscoDuoOnboarding> {
    return this.client.requestBP<BPCiscoDuoOnboarding>({
      path: `/v1/cloud/cisco/onboardings/${onboardingId}`,
    });
  }

  async deleteCiscoDuoOnboarding(onboardingId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/cloud/cisco/onboardings/${onboardingId}`,
    });
  }

  async syncCiscoDuoUsers(onboardingId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/cloud/cisco/onboardings/${onboardingId}/post-provision`,
    });
  }

  async completeCiscoDuoOnboarding(onboardingId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/cloud/cisco/onboardings/${onboardingId}/complete`,
    });
  }

  // =========================================================================
  // Vulnerability Management — Vulnerabilities
  // =========================================================================

  async getVulnerabilities(
    skip = 0,
    take = 100,
    tenantId?: string
  ): Promise<BPPaginatedResponse<BPVulnerability>> {
    return this.client.requestBP<BPPaginatedResponse<BPVulnerability>>({
      path: "/v1/vulnerability-management/vulnerabilities",
      params: { skip, take },
      tenantId,
    });
  }

  async getVulnerabilityById(id: string): Promise<BPVulnerability> {
    return this.client.requestBP<BPVulnerability>({
      path: `/v1/vulnerability-management/vulnerabilities/${id}`,
    });
  }

  async getVulnerabilityAssets(
    vulnId: string,
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPAsset>> {
    return this.client.requestBP<BPPaginatedResponse<BPAsset>>({
      path: `/v1/vulnerability-management/vulnerabilities/${vulnId}/assets`,
      params: { skip, take },
    });
  }

  async updateVulnerabilityStatusForDevices(
    vulnId: string,
    body: Record<string, unknown>
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "PATCH",
      path: `/v1/vulnerability-management/vulnerabilities/${vulnId}/update-status-for-devices`,
      body,
    });
  }

  async deleteVulnerabilityForDevices(
    vulnId: string,
    body: Record<string, unknown>
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/vulnerability-management/vulnerabilities/${vulnId}/delete-for-devices`,
      body,
    });
  }

  async getVulnerabilitySeverityStats(): Promise<BPSeverityCount[]> {
    return this.client.requestBP<BPSeverityCount[]>({
      path: "/v1/vulnerability-management/vulnerabilities/stats/count-by-severity",
    });
  }

  async getVulnerabilityTenantStats(): Promise<BPTenantVulnCount[]> {
    return this.client.requestBP<BPTenantVulnCount[]>({
      path: "/v1/vulnerability-management/vulnerabilities/stats/count-by-tenant",
    });
  }

  async bulkDeleteVulnerabilities(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: "/v1/vulnerability-management/vulnerabilities/bulk-actions/delete",
      body,
    });
  }

  async bulkUpdateVulnerabilities(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "PATCH",
      path: "/v1/vulnerability-management/vulnerabilities/bulk-actions/update",
      body,
    });
  }

  async bulkDeleteVulnerabilitiesForDevices(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: "/v1/vulnerability-management/vulnerabilities/bulk-actions/delete-for-device",
      body,
    });
  }

  async bulkUpdateVulnerabilitiesForDevices(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "PATCH",
      path: "/v1/vulnerability-management/vulnerabilities/bulk-actions/update-for-device",
      body,
    });
  }

  async exportVulnerabilities(body: Record<string, unknown>): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "POST",
      path: "/v1/vulnerability-management/vulnerabilities/export",
      body,
    });
  }

  async exportVulnerabilityAssets(vulnId: string, body: Record<string, unknown>): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "POST",
      path: `/v1/vulnerability-management/vulnerabilities/${vulnId}/assets/export`,
      body,
    });
  }

  // =========================================================================
  // Vulnerability Management — CVEs
  // =========================================================================

  async getCveById(id: string): Promise<BPVulnerability> {
    return this.client.requestBP<BPVulnerability>({
      path: `/v1/vulnerability-management/cves/${id}`,
    });
  }

  async getCveReferences(id: string): Promise<BPCveReference[]> {
    return this.client.requestBP<BPCveReference[]>({
      path: `/v1/vulnerability-management/cves/${id}/references`,
    });
  }

  // =========================================================================
  // Vulnerability Management — Scans
  // =========================================================================

  async getScans(skip = 0, take = 100): Promise<BPPaginatedResponse<BPScan>> {
    return this.client.requestBP<BPPaginatedResponse<BPScan>>({
      path: "/v1/vulnerability-management/scans",
      params: { skip, take },
    });
  }

  async createScan(input: BPScanCreateInput): Promise<BPScan> {
    return this.client.requestBP<BPScan>({
      method: "POST",
      path: "/v1/vulnerability-management/scans",
      body: input,
    });
  }

  async getScanById(id: string): Promise<BPScan> {
    return this.client.requestBP<BPScan>({
      path: `/v1/vulnerability-management/scans/${id}`,
    });
  }

  async updateScan(id: string, body: Record<string, unknown>): Promise<BPScan> {
    return this.client.requestBP<BPScan>({
      method: "PATCH",
      path: `/v1/vulnerability-management/scans/${id}`,
      body,
    });
  }

  async deleteScan(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/vulnerability-management/scans/${id}`,
    });
  }

  async getScanCves(id: string, skip = 0, take = 100): Promise<BPPaginatedResponse<BPVulnerability>> {
    return this.client.requestBP<BPPaginatedResponse<BPVulnerability>>({
      path: `/v1/vulnerability-management/scans/${id}/cves`,
      params: { skip, take },
    });
  }

  async exportScanCves(id: string, body: Record<string, unknown>): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "POST",
      path: `/v1/vulnerability-management/scans/${id}/cves/export`,
      body,
    });
  }

  async cancelScan(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "PATCH",
      path: `/v1/vulnerability-management/scans/${id}/cancel`,
    });
  }

  // =========================================================================
  // Vulnerability Management — Scan Schedules
  // =========================================================================

  async getScanSchedules(skip = 0, take = 100): Promise<BPPaginatedResponse<BPScanSchedule>> {
    return this.client.requestBP<BPPaginatedResponse<BPScanSchedule>>({
      path: "/v1/vulnerability-management/scan-schedules",
      params: { skip, take },
    });
  }

  async createScanSchedule(input: BPScanScheduleCreateInput): Promise<BPScanSchedule> {
    return this.client.requestBP<BPScanSchedule>({
      method: "POST",
      path: "/v1/vulnerability-management/scan-schedules",
      body: input,
    });
  }

  async getScanScheduleById(id: string): Promise<BPScanSchedule> {
    return this.client.requestBP<BPScanSchedule>({
      path: `/v1/vulnerability-management/scan-schedules/${id}`,
    });
  }

  async updateScanSchedule(id: string, body: Record<string, unknown>): Promise<BPScanSchedule> {
    return this.client.requestBP<BPScanSchedule>({
      method: "PATCH",
      path: `/v1/vulnerability-management/scan-schedules/${id}`,
      body,
    });
  }

  async deleteScanSchedule(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/vulnerability-management/scan-schedules/${id}`,
    });
  }

  async runScanSchedule(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/vulnerability-management/scan-schedules/${id}/run`,
    });
  }

  // =========================================================================
  // Vulnerability Management — Scans & Schedules (combined view)
  // =========================================================================

  async getScansAndSchedules(
    skip = 0,
    take = 100
  ): Promise<BPPaginatedResponse<BPScanAndSchedule>> {
    return this.client.requestBP<BPPaginatedResponse<BPScanAndSchedule>>({
      path: "/v1/vulnerability-management/scans-and-schedules",
      params: { skip, take },
    });
  }

  async getScansAndSchedulesStats(): Promise<Record<string, unknown>> {
    return this.client.requestBP<Record<string, unknown>>({
      path: "/v1/vulnerability-management/scans-and-schedules/stats",
    });
  }

  async bulkDeleteScansAndSchedules(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: "/v1/vulnerability-management/scans-and-schedules/bulk-actions/delete",
      body,
    });
  }

  async bulkUpdateSchedules(body: Record<string, unknown>): Promise<void> {
    await this.client.requestBP<void>({
      method: "PATCH",
      path: "/v1/vulnerability-management/scans-and-schedules/bulk-actions/update",
      body,
    });
  }

  async exportScans(body: Record<string, unknown>): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "POST",
      path: "/v1/vulnerability-management/scans-and-schedules/export",
      body,
    });
  }

  // =========================================================================
  // Vulnerability Management — External Scans
  // =========================================================================

  async getExternalScanExposures(id: string): Promise<unknown> {
    return this.client.requestBP<unknown>({
      path: `/v1/vulnerability-management/external/scan/exposures/${id}`,
    });
  }

  async getExternalScanReport(id: string): Promise<unknown> {
    return this.client.requestBP<unknown>({
      path: `/v1/vulnerability-management/external/scan/report/${id}`,
    });
  }

  // =========================================================================
  // Vulnerability Management — Dark Web Scans
  // =========================================================================

  async getDarkwebScanExposures(tenantId?: string): Promise<unknown> {
    return this.client.requestBP<unknown>({
      path: "/v1/vulnerability-management/darkweb/scan/exposures",
      tenantId,
    });
  }

  async getDarkwebScanReport(tenantId?: string): Promise<unknown> {
    return this.client.requestBP<unknown>({
      path: "/v1/vulnerability-management/darkweb/scan/report",
      tenantId,
    });
  }

  // =========================================================================
  // Notification Channels — Email
  // =========================================================================

  async getEmailChannels(accountId: string, tenantId?: string): Promise<BPDataResponse<BPEmailChannel>> {
    return this.client.requestBP<BPDataResponse<BPEmailChannel>>({
      method: "POST",
      path: "/v1/event-signal/email-channels/list",
      body: { accountId, tenantId },
    });
  }

  async createEmailChannel(input: BPEmailChannelCreateInput): Promise<BPEmailChannel> {
    return this.client.requestBP<BPEmailChannel>({
      method: "POST",
      path: "/v1/event-signal/email-channels",
      body: input,
    });
  }

  async getEmailChannelById(id: string): Promise<BPEmailChannel> {
    return this.client.requestBP<BPEmailChannel>({
      path: `/v1/event-signal/email-channels/${id}`,
    });
  }

  async updateEmailChannel(id: string, input: BPEmailChannelUpdateInput): Promise<BPEmailChannel> {
    return this.client.requestBP<BPEmailChannel>({
      method: "PATCH",
      path: `/v1/event-signal/email-channels/${id}`,
      body: input,
    });
  }

  async deleteEmailChannel(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/event-signal/email-channels/${id}`,
    });
  }

  async duplicateEmailChannel(id: string, name: string): Promise<BPEmailChannel> {
    return this.client.requestBP<BPEmailChannel>({
      method: "POST",
      path: `/v1/event-signal/email-channels/${id}/duplicate`,
      body: { name },
    });
  }

  async testEmailChannel(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/event-signal/email-channels/${id}/test`,
    });
  }

  // =========================================================================
  // Notification Channels — Webhooks
  // =========================================================================

  async getWebhookChannels(accountId: string, tenantId?: string): Promise<BPDataResponse<BPWebhookChannel>> {
    return this.client.requestBP<BPDataResponse<BPWebhookChannel>>({
      method: "POST",
      path: "/v1/event-signal/webhook-channels/list",
      body: { accountId, tenantId },
    });
  }

  async createWebhookChannel(input: BPWebhookChannelCreateInput): Promise<BPWebhookChannel> {
    return this.client.requestBP<BPWebhookChannel>({
      method: "POST",
      path: "/v1/event-signal/webhook-channels",
      body: input,
    });
  }

  async getWebhookChannelById(id: string): Promise<BPWebhookChannel> {
    return this.client.requestBP<BPWebhookChannel>({
      path: `/v1/event-signal/webhook-channels/${id}`,
    });
  }

  async updateWebhookChannel(id: string, input: BPWebhookChannelUpdateInput): Promise<BPWebhookChannel> {
    return this.client.requestBP<BPWebhookChannel>({
      method: "PATCH",
      path: `/v1/event-signal/webhook-channels/${id}`,
      body: input,
    });
  }

  async deleteWebhookChannel(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/event-signal/webhook-channels/${id}`,
    });
  }

  async duplicateWebhookChannel(id: string, name: string): Promise<BPWebhookChannel> {
    return this.client.requestBP<BPWebhookChannel>({
      method: "POST",
      path: `/v1/event-signal/webhook-channels/${id}/duplicate`,
      body: { name },
    });
  }

  async testWebhookChannel(id: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/event-signal/webhook-channels/${id}/test`,
    });
  }

  // =========================================================================
  // Notification Channels — Generic & Blocklist
  // =========================================================================

  async getChannels(accountId: string, tenantId?: string): Promise<BPDataResponse<BPChannel>> {
    return this.client.requestBP<BPDataResponse<BPChannel>>({
      method: "POST",
      path: "/v1/event-signal/channels/list",
      body: { accountId, tenantId },
    });
  }

  async blockTenantNotifications(tenantId: string, emailType: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: "/v1/event-signal/blocklist",
      body: { tenantId, emailType },
    });
  }

  async unblockTenantNotifications(tenantId: string, emailType: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: "/v1/event-signal/blocklist",
      body: { tenantId, emailType },
    });
  }

  async checkTenantBlocked(tenantId: string): Promise<unknown> {
    return this.client.requestBP<unknown>({
      path: "/v1/event-signal/blocklist/check",
      params: { tenantId },
    });
  }

  // =========================================================================
  // Users
  // =========================================================================

  async getUsers(skip = 0, take = 100): Promise<BPPagePaginatedResponse<BPUser>> {
    return this.client.requestBP<BPPagePaginatedResponse<BPUser>>({
      path: "/v1/users",
      params: { page: Math.floor(skip / take) + 1, pageSize: take },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/users/${userId}`,
    });
  }

  async resetUserPassword(userId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/users/${userId}/reset-password`,
    });
  }

  async getAccountUsers(
    accountId: string,
    skip = 0,
    take = 100
  ): Promise<BPPagePaginatedResponse<BPUser>> {
    return this.client.requestBP<BPPagePaginatedResponse<BPUser>>({
      path: `/v1/accounts/${accountId}/users`,
      params: { page: Math.floor(skip / take) + 1, pageSize: take },
    });
  }

  async inviteAccountUser(accountId: string, input: BPUserInviteInput): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "POST",
      path: `/v1/accounts/${accountId}/users`,
      body: input,
    });
  }

  async updateAccountUser(
    accountId: string,
    userId: string,
    input: BPUserUpdateInput
  ): Promise<unknown> {
    return this.client.requestBP<unknown>({
      method: "PUT",
      path: `/v1/accounts/${accountId}/users/${userId}`,
      body: input,
    });
  }

  async deleteAccountUser(accountId: string, userId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}/users/${userId}`,
    });
  }

  async getTenantUsers(
    accountId: string,
    tenantId: string,
    skip = 0,
    take = 100
  ): Promise<BPPagePaginatedResponse<BPTenantUser>> {
    return this.client.requestBP<BPPagePaginatedResponse<BPTenantUser>>({
      path: `/v1/accounts/${accountId}/tenants/${tenantId}/users`,
      params: { page: Math.floor(skip / take) + 1, pageSize: take },
    });
  }

  async assignUsersToTenant(
    accountId: string,
    tenantId: string,
    userIds: string[]
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/accounts/${accountId}/tenants/${tenantId}/users`,
      body: { userIds },
    });
  }

  async unassignUserFromTenant(
    accountId: string,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}/tenants/${tenantId}/users`,
      body: { userId },
    });
  }

  async getUnassignedTenantUsers(
    accountId: string,
    tenantId: string,
    skip = 0,
    take = 100
  ): Promise<BPPagePaginatedResponse<BPUser>> {
    return this.client.requestBP<BPPagePaginatedResponse<BPUser>>({
      path: `/v1/accounts/${accountId}/tenants/${tenantId}/unassigned-users`,
      params: { page: Math.floor(skip / take) + 1, pageSize: take },
    });
  }

  // =========================================================================
  // Contact Groups
  // =========================================================================

  async getContactGroups(accountId: string): Promise<BPContactGroup[]> {
    return this.client.requestBP<BPContactGroup[]>({
      path: `/v1/accounts/${accountId}/contact-groups`,
    });
  }

  async createContactGroup(accountId: string, input: BPContactGroupCreateInput): Promise<BPContactGroup> {
    return this.client.requestBP<BPContactGroup>({
      method: "POST",
      path: `/v1/accounts/${accountId}/contact-groups`,
      body: input,
    });
  }

  async getContactGroupById(accountId: string, contactGroupId: string): Promise<BPContactGroup> {
    return this.client.requestBP<BPContactGroup>({
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}`,
    });
  }

  async updateContactGroup(
    accountId: string,
    contactGroupId: string,
    input: BPContactGroupCreateInput
  ): Promise<BPContactGroup> {
    return this.client.requestBP<BPContactGroup>({
      method: "PUT",
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}`,
      body: input,
    });
  }

  async deleteContactGroup(accountId: string, contactGroupId: string): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}`,
    });
  }

  async bulkDeleteContactGroups(accountId: string, ids: string[]): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}/contact-groups`,
      body: { ids },
    });
  }

  async getContactGroupTenants(accountId: string, contactGroupId: string): Promise<BPTenant[]> {
    return this.client.requestBP<BPTenant[]>({
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/tenants`,
    });
  }

  async addTenantsToContactGroup(
    accountId: string,
    contactGroupId: string,
    tenantIds: string[]
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "POST",
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/tenants`,
      body: { tenantIds },
    });
  }

  async getUnassignedContactGroupTenants(accountId: string, contactGroupId: string): Promise<BPTenant[]> {
    return this.client.requestBP<BPTenant[]>({
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/unassigned-tenants`,
    });
  }

  async getContactGroupMembers(accountId: string, contactGroupId: string): Promise<BPContactGroupMember[]> {
    return this.client.requestBP<BPContactGroupMember[]>({
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/members`,
    });
  }

  async addContactGroupMember(
    accountId: string,
    contactGroupId: string,
    input: BPContactGroupMemberCreateInput
  ): Promise<BPContactGroupMember> {
    return this.client.requestBP<BPContactGroupMember>({
      method: "POST",
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/members`,
      body: input,
    });
  }

  async getContactGroupMember(
    accountId: string,
    contactGroupId: string,
    memberId: string
  ): Promise<BPContactGroupMember> {
    return this.client.requestBP<BPContactGroupMember>({
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/members/${memberId}`,
    });
  }

  async deleteContactGroupMember(
    accountId: string,
    contactGroupId: string,
    memberId: string
  ): Promise<void> {
    await this.client.requestBP<void>({
      method: "DELETE",
      path: `/v1/accounts/${accountId}/contact-groups/${contactGroupId}/members/${memberId}`,
    });
  }

  // =========================================================================
  // Health Check (delegates to client)
  // =========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
