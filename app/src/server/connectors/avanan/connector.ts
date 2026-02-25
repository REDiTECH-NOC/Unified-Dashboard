/**
 * Avanan (Check Point Harmony Email & Collaboration) connector.
 *
 * Implements IEmailSecurityConnector using the Harmony Email API
 * with MSP SmartAPI multi-tenant scoping.
 *
 * One MSP API key manages all client tenants. Use GET /scopes to
 * discover tenants, then scope queries/actions to specific clients.
 *
 * MSP management endpoints (tenants, users, partners, licenses, usage)
 * use the msp_name header for authentication context.
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
  MspTenantCreateInput,
  MspLicense,
  MspAddOn,
  MspPartner,
  MspUser,
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
  AvananMspPartner,
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
  // Security Events
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
  // Secured Entities
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
  // Actions
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
  // Task Status (async action tracking)
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
  // Exceptions (Allowlist/Blocklist)
  // ══════════════════════════════════════════════════════════════

  async getExceptions(
    type: string,
  ): Promise<ExceptionEntry[]> {
    const response = await this.client.requestAvanan<AvananExceptionEntry>({
      path: `/v1.0/sectool-exceptions/checkpoint2/exceptions/${type}`,
    });

    return response.data.map(mapException);
  }

  async createUrlException(
    exception: EmailSecurityException,
  ): Promise<void> {
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

  async deleteException(
    vendor: string,
    excId: string,
  ): Promise<void> {
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

  async createWhitelistEntry(
    vendor: string,
    entry: EmailSecurityException,
  ): Promise<void> {
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

  async createBlacklistEntry(
    vendor: string,
    entry: EmailSecurityException,
  ): Promise<void> {
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
  // MSP Tenant Management
  // ══════════════════════════════════════════════════════════════

  async listTenants(): Promise<MspTenant[]> {
    const response = await this.client.mspRequestAvanan<AvananMspTenant>({
      path: "/v1.0/msp/tenants",
    });

    return response.data.map(mapMspTenant);
  }

  async createTenant(input: MspTenantCreateInput): Promise<MspTenant> {
    const response = await this.client.mspRequest<{ responseData: AvananMspTenant }>({
      method: "POST",
      path: "/v1.0/msp/tenants",
      body: {
        requestData: {
          tenant_name: input.tenantName,
          admin_email: input.adminEmail,
          licenses: input.licenses,
        },
      },
    });

    return mapMspTenant(response.responseData);
  }

  async describeTenant(tenantId: string): Promise<MspTenant> {
    const response = await this.client.mspRequest<{ responseData: AvananMspTenant }>({
      path: `/v1.0/msp/tenants/${tenantId}`,
    });

    return mapMspTenant(response.responseData);
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.client.mspRequest({
      method: "DELETE",
      path: `/v1.0/msp/tenants/${tenantId}`,
    });
  }

  async updateTenantLicenses(
    tenantId: string,
    licenses: Array<{ licenseId: string; quantity: number }>,
  ): Promise<void> {
    await this.client.mspRequest({
      method: "PUT",
      path: `/v1.0/msp/tenants/${tenantId}/licenses`,
      body: { requestData: { licenses } },
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Licenses
  // ══════════════════════════════════════════════════════════════

  async listLicenses(): Promise<MspLicense[]> {
    const response = await this.client.mspRequestAvanan<AvananMspLicense>({
      path: "/v1.0/msp/licenses",
    });

    return response.data.map((l) => ({
      licenseId: l.licenseId,
      licenseName: l.licenseName,
      description: l.description,
      type: l.type,
    }));
  }

  async listAddOns(): Promise<MspAddOn[]> {
    const response = await this.client.mspRequestAvanan<AvananMspAddOn>({
      path: "/v1.0/msp/add-ons",
    });

    return response.data.map((a) => ({
      addOnId: a.addOnId,
      addOnName: a.addOnName,
      description: a.description,
      compatibleLicenses: a.compatibleLicenses,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Partners
  // ══════════════════════════════════════════════════════════════

  async listPartners(): Promise<MspPartner[]> {
    const response = await this.client.mspRequestAvanan<AvananMspPartner>({
      path: "/v1.0/msp/msp-partners",
    });

    return response.data.map((p) => ({
      partnerId: p.partnerId,
      partnerName: p.partnerName,
      status: p.status,
      createdAt: p.createdAt,
      tenantCount: p.tenantCount,
    }));
  }

  async createPartner(input: { partnerName: string; adminEmail: string }): Promise<MspPartner> {
    const response = await this.client.mspRequest<{ responseData: AvananMspPartner }>({
      method: "POST",
      path: "/v1.0/msp/msp-partners",
      body: {
        requestData: {
          partner_name: input.partnerName,
          admin_email: input.adminEmail,
        },
      },
    });

    return {
      partnerId: response.responseData.partnerId,
      partnerName: response.responseData.partnerName,
      status: response.responseData.status,
      createdAt: response.responseData.createdAt,
      tenantCount: response.responseData.tenantCount,
    };
  }

  async deletePartner(partnerId: string): Promise<void> {
    await this.client.mspRequest({
      method: "DELETE",
      path: `/v1.0/msp/msp-partners/${partnerId}`,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Users
  // ══════════════════════════════════════════════════════════════

  async listUsers(tenantId?: string): Promise<MspUser[]> {
    const params = tenantId ? { tenant_id: tenantId } : undefined;
    const response = await this.client.mspRequestAvanan<AvananMspUser>({
      path: "/v1.0/msp/users",
      params,
    });

    return response.data.map(mapMspUser);
  }

  async createUser(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    tenantId?: string;
  }): Promise<MspUser> {
    const response = await this.client.mspRequest<{ responseData: AvananMspUser }>({
      method: "POST",
      path: "/v1.0/msp/users",
      body: {
        requestData: {
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          role: input.role,
          tenant_id: input.tenantId,
        },
      },
    });

    return mapMspUser(response.responseData);
  }

  async updateUser(
    userId: string,
    input: { firstName?: string; lastName?: string; role?: string; status?: string },
  ): Promise<MspUser> {
    const requestData: Record<string, unknown> = {};
    if (input.firstName !== undefined) requestData.first_name = input.firstName;
    if (input.lastName !== undefined) requestData.last_name = input.lastName;
    if (input.role !== undefined) requestData.role = input.role;
    if (input.status !== undefined) requestData.status = input.status;

    const response = await this.client.mspRequest<{ responseData: AvananMspUser }>({
      method: "PUT",
      path: `/v1.0/msp/users/${userId}`,
      body: { requestData },
    });

    return mapMspUser(response.responseData);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.mspRequest({
      method: "DELETE",
      path: `/v1.0/msp/users/${userId}`,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // MSP Usage
  // ══════════════════════════════════════════════════════════════

  async getUsage(
    period: "monthly" | "daily",
    startDate?: string,
    endDate?: string,
  ): Promise<MspUsageRecord[]> {
    const params: Record<string, string> = { period };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await this.client.mspRequestAvanan<AvananMspUsageRecord>({
      path: "/v1.0/msp/usage",
      params,
    });

    return response.data.map((u) => ({
      tenantId: u.tenantId,
      tenantName: u.tenantName,
      period: u.period,
      protectedUsers: u.protectedUsers,
      scannedEmails: u.scannedEmails,
      threats: u.threats,
      quarantined: u.quarantined,
    }));
  }

  // ══════════════════════════════════════════════════════════════
  // Download
  // ══════════════════════════════════════════════════════════════

  async downloadEntity(
    entityId: string,
    original = false,
    _scope?: string,
  ): Promise<Buffer> {
    return this.client.downloadEntityFile(entityId, original);
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
    tenantId: raw.tenantId,
    tenantName: raw.tenantName,
    scope: raw.scope,
    status: raw.status,
    createdAt: raw.createdAt,
    licenses: raw.licenses?.map((l) => ({
      licenseId: l.licenseId,
      licenseName: l.licenseName,
      quantity: l.quantity,
      status: l.status,
    })),
    userCount: raw.userCount,
  };
}

function mapMspUser(raw: AvananMspUser): MspUser {
  return {
    userId: raw.userId,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    role: raw.role,
    status: raw.status,
    tenantId: raw.tenantId,
    createdAt: raw.createdAt,
    lastLogin: raw.lastLogin,
  };
}
