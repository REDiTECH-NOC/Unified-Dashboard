/**
 * Avanan (Check Point Harmony Email & Collaboration) connector.
 *
 * Implements IEmailSecurityConnector. Supports two API modes:
 *
 * **MSP SmartAPI** — tenant management, licenses, users, usage.
 *   Endpoints: /v1.0/msp/tenants, /v1.0/msp/licenses, /v1.0/msp/users, /v1.0/msp/usage
 *   Security events are NOT available on SmartAPI.
 *
 * **Harmony Email API** — security events, entities, actions, exceptions, download.
 *   Endpoints: /v1.0/event/query, /v1.0/search/query, /v1.0/action/*, /v1.0/sectool-exceptions/*
 *   MSP management is NOT available on Harmony Email API.
 *
 * Mode is auto-detected by whether credentials include mspName.
 */

import type { ConnectorConfig, PaginatedResponse, HealthCheckResult } from "../_base/types";
import type { NormalizedAlert } from "../_interfaces/common";
import type {
  IEmailSecurityConnector,
  EmailSecurityEventFilter,
  EmailEntityFilter,
  EmailEntity,
  EmailSecurityException,
  ActionResult,
  TaskStatus,
  TenantScope,
  MspTenant,
  MspLicense,
  MspAddOn,
  MspUser,
  MspUserCreateInput,
  MspUserUpdateInput,
  MspUsageRecord,
  ExceptionEntry,
} from "../_interfaces/email-security";
import { AvananClient } from "./client";
import type {
  AvananSecurityEvent,
  AvananEntity,
  AvananResponse,
  AvananEventActionResult,
  AvananEntityActionResult,
  AvananMspTenant,
  AvananMspLicense,
  AvananMspAddOn,
  AvananMspUser,
  AvananMspUsageRecord,
  AvananExceptionEntry,
} from "./types";
import { mapSecurityEvent, mapEntity } from "./mappers";

export class AvananEmailSecurityConnector implements IEmailSecurityConnector {
  private client: AvananClient;

  constructor(config: ConnectorConfig) {
    this.client = new AvananClient(config);
  }

  // ══════════════════════════════════════════════════════════════
  // Security Events (Harmony Email API only)
  // ══════════════════════════════════════════════════════════════

  async getSecurityEvents(
    filter?: EmailSecurityEventFilter,
    scrollId?: string,
  ): Promise<PaginatedResponse<NormalizedAlert>> {
    const requestData: Record<string, unknown> = {};

    if (filter?.eventTypes?.length) requestData.eventTypes = filter.eventTypes;
    if (filter?.eventStates?.length) requestData.eventStates = filter.eventStates;
    if (filter?.severities?.length) requestData.severities = filter.severities;
    if (filter?.saas?.length) requestData.saas = filter.saas;
    if (filter?.eventIds?.length) requestData.eventIds = filter.eventIds;
    if (filter?.confidenceIndicator) requestData.confidenceIndicator = filter.confidenceIndicator;
    if (filter?.startDate) requestData.startDate = filter.startDate.toISOString();
    if (filter?.endDate) requestData.endDate = filter.endDate.toISOString();
    if (filter?.searchTerm) requestData.description = filter.searchTerm;
    if (filter?.scope) requestData.scopes = [filter.scope];
    if (scrollId) requestData.scrollId = scrollId;

    const response = await this.client.requestAvanan<AvananSecurityEvent>({
      method: "POST",
      path: "/v1.0/event/query",
      body: { requestData },
      headers: filter?.scope ? { scopes: filter.scope } : undefined,
    });

    return {
      data: response.data.map(mapSecurityEvent),
      hasMore: !!response.scrollId && response.data.length > 0,
      nextCursor: response.scrollId,
      totalCount: response.totalRecords,
    };
  }

  async getSecurityEventById(
    eventId: string,
    scope?: string,
  ): Promise<NormalizedAlert> {
    const response = await this.client.requestAvanan<AvananSecurityEvent>({
      path: `/v1.0/event/${eventId}`,
      headers: scope ? { scopes: scope } : undefined,
    });

    if (!response.data.length) {
      throw new Error(`[avanan] Security event ${eventId} not found`);
    }

    return mapSecurityEvent(response.data[0]);
  }

  // ══════════════════════════════════════════════════════════════
  // Secured Entities (Harmony Email API only)
  // ══════════════════════════════════════════════════════════════

  async searchEntities(
    filter?: EmailEntityFilter,
    scrollId?: string,
  ): Promise<PaginatedResponse<EmailEntity>> {
    const requestData: Record<string, unknown> = {};

    if (filter) {
      const entityFilter: Record<string, unknown> = {};
      if (filter.saas) entityFilter.saas = filter.saas;
      if (filter.saasEntity) entityFilter.saasEntity = filter.saasEntity;
      if (filter.startDate) entityFilter.startDate = filter.startDate.toISOString();
      if (filter.endDate) entityFilter.endDate = filter.endDate.toISOString();

      if (Object.keys(entityFilter).length > 0) {
        requestData.entityFilter = entityFilter;
      }

      if (filter.extendedFilters?.length) {
        requestData.entityExtendedFilter = filter.extendedFilters.map((f) => ({
          saasAttrName: f.attrName,
          saasAttrOp: f.op,
          saasAttrValue: f.value,
        }));
      }

      if (filter.scope) requestData.scopes = [filter.scope];
    }

    if (scrollId) requestData.scrollId = scrollId;

    const response = await this.client.requestAvanan<AvananEntity>({
      method: "POST",
      path: "/v1.0/search/query",
      body: { requestData },
      headers: filter?.scope ? { scopes: filter.scope } : undefined,
    });

    return {
      data: response.data.map(mapEntity),
      hasMore: !!response.scrollId && response.data.length > 0,
      nextCursor: response.scrollId,
      totalCount: response.totalRecords,
    };
  }

  async getEntityById(
    entityId: string,
    scope?: string,
  ): Promise<EmailEntity> {
    const response = await this.client.requestAvanan<AvananEntity>({
      path: `/v1.0/search/entity/${entityId}`,
      headers: scope ? { scopes: scope } : undefined,
    });

    if (!response.data.length) {
      throw new Error(`[avanan] Entity ${entityId} not found`);
    }

    return mapEntity(response.data[0]);
  }

  // ══════════════════════════════════════════════════════════════
  // Actions (Harmony Email API only)
  // ══════════════════════════════════════════════════════════════

  async quarantineEntity(
    entityIds: string[],
    scope?: string,
  ): Promise<ActionResult[]> {
    return this.actionOnEntity(entityIds, "quarantine", "", scope);
  }

  async restoreEntity(
    entityIds: string[],
    scope?: string,
  ): Promise<ActionResult[]> {
    return this.actionOnEntity(entityIds, "restore", "", scope);
  }

  async dismissEvent(
    eventIds: string[],
    scope?: string,
  ): Promise<ActionResult[]> {
    return this.actionOnEvent(eventIds, "dismiss", "", scope);
  }

  async actionOnEvent(
    eventIds: string[],
    actionName: string,
    actionParam?: string,
    scope?: string,
  ): Promise<ActionResult[]> {
    const requestData: Record<string, unknown> = {
      eventIds,
      eventActionName: [actionName],
      eventActionParam: [actionParam ?? ""],
    };
    if (scope) requestData.scope = scope;

    const response = await this.client.requestRaw<AvananResponse<AvananEventActionResult>>({
      method: "POST",
      path: "/v1.0/action/event",
      body: { requestData },
      headers: scope ? { scopes: scope } : undefined,
    });

    return (response.responseData ?? []).map((r) => ({
      eventId: r.eventId,
      entityId: r.entityId,
      taskId: r.taskId,
    }));
  }

  async actionOnEntity(
    entityIds: string[],
    actionName: string,
    actionParam?: string,
    scope?: string,
  ): Promise<ActionResult[]> {
    const requestData: Record<string, unknown> = {
      entityIds,
      entityActionName: [actionName],
      entityActionParam: [actionParam ?? ""],
    };
    if (scope) requestData.scope = scope;

    const response = await this.client.requestRaw<AvananResponse<AvananEntityActionResult>>({
      method: "POST",
      path: "/v1.0/action/entity",
      body: { requestData },
      headers: scope ? { scopes: scope } : undefined,
    });

    return (response.responseData ?? []).map((r) => ({
      entityId: r.entityId,
      taskId: r.taskId,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // Task Status
  // ══════════════════════════════════════════════════════════════

  async getTaskStatus(taskId: number): Promise<TaskStatus> {
    const raw = await this.client.getTaskStatus(taskId);
    return {
      taskId: raw.taskId,
      status: raw.status,
      result: raw.result,
      errorMessage: raw.errorMessage,
      createdAt: raw.createdAt,
      completedAt: raw.completedAt,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Exceptions (Harmony Email API only)
  // ══════════════════════════════════════════════════════════════

  async getExceptions(type: string): Promise<ExceptionEntry[]> {
    const response = await this.client.requestAvanan<AvananExceptionEntry>({
      path: `/v1.0/sectool-exceptions/checkpoint2/exceptions/${type}`,
    });
    return response.data.map(mapException);
  }

  async createUrlException(exception: EmailSecurityException): Promise<void> {
    await this.client.requestRaw({
      method: "POST",
      path: "/v1.0/sectool-exceptions/avanan_url",
      body: {
        requestData: {
          exception_type: exception.type,
          exception_str: exception.value,
          comment: exception.comment,
          entity_type: exception.entityType,
          entity_id: exception.entityId,
          file_name: exception.fileName,
          created_by_email: exception.createdByEmail,
          is_exclusive: exception.isExclusive ?? false,
        },
      },
    });
  }

  async updateException(
    vendor: string,
    excId: string,
    update: { value?: string; comment?: string; isExclusive?: boolean },
  ): Promise<void> {
    const requestData: Record<string, unknown> = {};
    if (update.value !== undefined) requestData.exception_str = update.value;
    if (update.comment !== undefined) requestData.comment = update.comment;
    if (update.isExclusive !== undefined) requestData.is_exclusive = update.isExclusive;

    await this.client.requestRaw({
      method: "PUT",
      path: `/v1.0/sectool-exceptions/${vendor}/${excId}`,
      body: { requestData },
    });
  }

  async deleteException(vendor: string, excId: string): Promise<void> {
    await this.client.requestRaw({
      method: "DELETE",
      path: `/v1.0/sectool-exceptions/${vendor}/${excId}`,
    });
  }

  async getWhitelist(vendor: string): Promise<ExceptionEntry[]> {
    const response = await this.client.requestAvanan<AvananExceptionEntry>({
      path: `/v1.0/sectool-exceptions/${vendor}/whitelist`,
    });
    return response.data.map(mapException);
  }

  async getBlacklist(vendor: string): Promise<ExceptionEntry[]> {
    const response = await this.client.requestAvanan<AvananExceptionEntry>({
      path: `/v1.0/sectool-exceptions/${vendor}/blacklist`,
    });
    return response.data.map(mapException);
  }

  async createWhitelistEntry(vendor: string, entry: EmailSecurityException): Promise<void> {
    await this.client.requestRaw({
      method: "POST",
      path: `/v1.0/sectool-exceptions/${vendor}/whitelist`,
      body: {
        requestData: {
          exception_type: entry.type,
          exception_str: entry.value,
          comment: entry.comment,
          created_by_email: entry.createdByEmail,
          is_exclusive: entry.isExclusive ?? false,
        },
      },
    });
  }

  async createBlacklistEntry(vendor: string, entry: EmailSecurityException): Promise<void> {
    await this.client.requestRaw({
      method: "POST",
      path: `/v1.0/sectool-exceptions/${vendor}/blacklist`,
      body: {
        requestData: {
          exception_type: entry.type,
          exception_str: entry.value,
          comment: entry.comment,
          created_by_email: entry.createdByEmail,
          is_exclusive: entry.isExclusive ?? false,
        },
      },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Multi-Tenant Scopes
  // ══════════════════════════════════════════════════════════════

  async getScopes(): Promise<TenantScope[]> {
    const scopes = await this.client.getScopes();

    return scopes.map((s) => {
      const parts = s.scope.split(":");
      return {
        scope: s.scope,
        farm: parts[0] ?? "",
        tenant: parts[1] ?? "",
      };
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Tenant Management (SmartAPI only)
  // ══════════════════════════════════════════════════════════════

  async listTenants(): Promise<MspTenant[]> {
    const response = await this.client.requestAvanan<AvananMspTenant>({
      path: "/v1.0/msp/tenants",
    });

    return response.data.map(mapMspTenant);
  }

  async describeTenant(tenantId: string): Promise<MspTenant> {
    const response = await this.client.requestAvanan<AvananMspTenant>({
      path: `/v1.0/msp/tenants/${tenantId}`,
    });

    if (!response.data.length) {
      throw new Error(`[avanan] Tenant ${tenantId} not found`);
    }

    return mapMspTenant(response.data[0]);
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Licenses (SmartAPI only)
  // ══════════════════════════════════════════════════════════════

  async listLicenses(): Promise<MspLicense[]> {
    const response = await this.client.requestAvanan<AvananMspLicense>({
      path: "/v1.0/msp/licenses",
    });

    return response.data.map((l) => ({
      id: l.id,
      codeName: l.codeName,
      displayName: l.displayName,
    }));
  }

  async listAddOns(): Promise<MspAddOn[]> {
    const response = await this.client.requestAvanan<AvananMspAddOn>({
      path: "/v1.0/msp/addons",
    });

    return response.data.map((a) => ({
      id: a.id,
      name: a.name,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Users (SmartAPI only)
  // ══════════════════════════════════════════════════════════════

  async listUsers(): Promise<MspUser[]> {
    const response = await this.client.requestAvanan<AvananMspUser>({
      path: "/v1.0/msp/users",
    });

    return response.data.map(mapMspUser);
  }

  async createUser(input: MspUserCreateInput): Promise<MspUser> {
    const requestData: Record<string, unknown> = {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      directLogin: input.directLogin ?? true,
      samlLogin: input.samlLogin ?? false,
      viewPrivateData: input.viewPrivateData ?? false,
      sendAlerts: input.sendAlerts ?? false,
      receiveWeeklyReports: input.receiveWeeklyReports ?? false,
    };

    const response = await this.client.requestAvanan<AvananMspUser>({
      method: "POST",
      path: "/v1.0/msp/users",
      body: { requestData },
    });

    if (!response.data.length) {
      throw new Error("[avanan] Failed to create user — no data returned");
    }
    return mapMspUser(response.data[0]);
  }

  async updateUser(userId: number, input: MspUserUpdateInput): Promise<MspUser> {
    const requestData: Record<string, unknown> = {};
    if (input.firstName !== undefined) requestData.firstName = input.firstName;
    if (input.lastName !== undefined) requestData.lastName = input.lastName;
    if (input.role !== undefined) requestData.role = input.role;
    if (input.directLogin !== undefined) requestData.directLogin = input.directLogin;
    if (input.samlLogin !== undefined) requestData.samlLogin = input.samlLogin;
    if (input.viewPrivateData !== undefined) requestData.viewPrivateData = input.viewPrivateData;
    if (input.sendAlerts !== undefined) requestData.sendAlerts = input.sendAlerts;
    if (input.receiveWeeklyReports !== undefined) requestData.receiveWeeklyReports = input.receiveWeeklyReports;
    // MSP-level fields (write-only — accepted by UPDATE, not returned by LIST)
    if (input.mspRole !== undefined) requestData.MSPRole = input.mspRole;
    if (input.mspTenantAccess !== undefined) requestData.MSPTenantAccess = input.mspTenantAccess;
    if (input.mspTenants !== undefined) requestData.MSPTenants = input.mspTenants;

    const response = await this.client.requestAvanan<AvananMspUser>({
      method: "PUT",
      path: `/v1.0/msp/users/${userId}`,
      body: { requestData },
    });

    if (!response.data.length) {
      throw new Error(`[avanan] Failed to update user ${userId} — no data returned`);
    }
    return mapMspUser(response.data[0]);
  }

  async deleteUser(userId: number): Promise<void> {
    await this.client.requestRaw({
      method: "DELETE",
      path: `/v1.0/msp/users/${userId}`,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Usage (SmartAPI only)
  // ══════════════════════════════════════════════════════════════

  async getUsage(year: number, month: number): Promise<MspUsageRecord[]> {
    const response = await this.client.requestAvanan<AvananMspUsageRecord>({
      path: "/v1.0/msp/usage",
      params: { year: String(year), month: String(month) },
    });

    return response.data.map((u) => ({
      day: u.day,
      tenantDomain: u.tenantDomain,
      licenseCodeName: u.licenseCodeName,
      users: u.users,
      dailyPrice: u.dailyPrice,
      cost: u.cost,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // Download (Harmony Email API only)
  // ══════════════════════════════════════════════════════════════

  async downloadEntity(
    entityId: string,
    original = false,
    scope?: string,
  ): Promise<Buffer> {
    return this.client.downloadEntityFile(entityId, original, scope);
  }

  // ══════════════════════════════════════════════════════════════
  // Health Check
  // ══════════════════════════════════════════════════════════════

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}

// ── Helper Mappers ──

function mapException(raw: AvananExceptionEntry): ExceptionEntry {
  return {
    excId: raw.exc_id,
    exceptionType: raw.exception_type,
    exceptionStr: raw.exception_str,
    comment: raw.comment,
    createdByEmail: raw.created_by_email,
    createdAt: raw.created_at,
    isExclusive: raw.is_exclusive,
  };
}

function mapMspTenant(raw: AvananMspTenant): MspTenant {
  return {
    id: raw.id,
    domain: raw.domain,
    companyName: raw.companyName,
    deploymentMode: raw.deploymentMode,
    users: raw.users,
    maxLicensedUsers: raw.maxLicensedUsers,
    status: raw.status?.statusCode ?? "unknown",
    statusDescription: raw.status?.description ?? "",
    packageName: raw.package?.displayName ?? "",
    packageCodeName: raw.package?.codeName ?? "",
    addons: raw.addons ?? [],
    isDeleted: raw.isDeleted,
    tenantRegion: raw.tenantRegion,
    pocDateStart: raw.pocDateStart,
    pocDateExpiration: raw.pocDateExpiration,
  };
}

function mapMspUser(raw: AvananMspUser): MspUser {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    directLogin: raw.directLogin,
    samlLogin: raw.samlLogin,
    viewPrivateData: raw.viewPrivateData,
    sendAlerts: raw.sendAlerts,
    receiveWeeklyReports: raw.receiveWeeklyReports,
  };
}
