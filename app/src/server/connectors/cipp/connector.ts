/**
 * CIPP connector — full API coverage for Microsoft 365 multi-tenant management.
 *
 * Covers: Identity Management, Tenant Administration, Security & Compliance,
 * Intune, Teams & SharePoint, and CIPP Platform operations.
 *
 * Accessed via ConnectorFactory.getByToolId("cipp", prisma).
 * Not tied to a category interface — CIPP spans all M365 domains.
 *
 * API docs: https://docs.cipp.app/api-documentation/endpoints
 */

import type { ConnectorConfig, HealthCheckResult } from "../_base/types";
import { CIPPClient } from "./client";
import type {
  CIPPTenant,
  CIPPAlert,
  CIPPLicense,
  CIPPCSPLicense,
  CIPPCSPSku,
  CIPPAuditLog,
  CIPPBackup,
  CIPPGDAPRole,
  CIPPGDAPRoleTemplate,
  CIPPUser,
  CIPPAddUserInput,
  CIPPGroup,
  CIPPAddGroupInput,
  CIPPEditGroupInput,
  CIPPMFAUser,
  CIPPSignIn,
  CIPPRole,
  CIPPInactiveAccount,
  CIPPOffboardOptions,
  CIPPDeletedItem,
  CIPPDefenderState,
  CIPPDefenderTVM,
  CIPPSecurityAlert,
  CIPPSecurityIncident,
  CIPPIntuneDevice,
  CIPPAutopilotDevice,
  CIPPIntuneApp,
  CIPPIntunePolicy,
  CIPPTeam,
  CIPPTeamsActivity,
  CIPPTeamsVoice,
  CIPPSharePointSite,
  CIPPScheduledItem,
  CIPPLog,
  CIPPActionResult,
} from "./types";

export class CIPPConnector {
  private client: CIPPClient;

  constructor(config: ConnectorConfig) {
    this.client = new CIPPClient(config);
  }

  // =========================================================================
  // Tenant Administration
  // =========================================================================

  async listTenants(): Promise<CIPPTenant[]> {
    return this.client.requestCIPP<CIPPTenant[]>({
      path: "/api/ListTenants",
    });
  }

  async listAlerts(tenantFilter?: string): Promise<CIPPAlert[]> {
    return this.client.requestCIPP<CIPPAlert[]>({
      path: "/api/ListAlertsQueue",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listLicenses(tenantFilter: string): Promise<CIPPLicense[]> {
    return this.client.requestCIPP<CIPPLicense[]>({
      path: "/api/ListLicenses",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listCSPLicenses(): Promise<CIPPCSPLicense[]> {
    return this.client.requestCIPP<CIPPCSPLicense[]>({
      path: "/api/ListCSPLicenses",
    });
  }

  async listCSPSkus(): Promise<CIPPCSPSku[]> {
    return this.client.requestCIPP<CIPPCSPSku[]>({
      path: "/api/ListCSPsku",
    });
  }

  async listAuditLogs(
    tenantFilter: string,
    startDate?: string,
    endDate?: string
  ): Promise<CIPPAuditLog[]> {
    const params: Record<string, string> = { TenantFilter: tenantFilter };
    if (startDate) params.StartDate = startDate;
    if (endDate) params.EndDate = endDate;

    return this.client.requestCIPP<CIPPAuditLog[]>({
      path: "/api/ListAuditLogs",
      params,
    });
  }

  async listBackups(tenantFilter?: string): Promise<CIPPBackup[]> {
    return this.client.requestCIPP<CIPPBackup[]>({
      path: "/api/ExecListBackup",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listGDAPRoles(): Promise<CIPPGDAPRole[]> {
    return this.client.requestCIPP<CIPPGDAPRole[]>({
      path: "/api/ListGDAPRoles",
    });
  }

  async listGDAPRoleTemplates(): Promise<CIPPGDAPRoleTemplate[]> {
    return this.client.requestCIPP<CIPPGDAPRoleTemplate[]>({
      path: "/api/ExecGDAPRoleTemplate",
    });
  }

  // =========================================================================
  // Identity Management — Users
  // =========================================================================

  async listUsers(tenantFilter: string, select?: string): Promise<CIPPUser[]> {
    const params: Record<string, string> = { TenantFilter: tenantFilter };
    if (select) params.$select = select;

    return this.client.requestCIPP<CIPPUser[]>({
      path: "/api/ListUsers",
      params,
    });
  }

  async addUser(input: CIPPAddUserInput): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddUser",
      body: input,
    });
  }

  async removeUser(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveUser",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  async disableUser(tenantFilter: string, userId: string, enable = false): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecDisableUser",
      body: { TenantFilter: tenantFilter, ID: userId, Enable: enable },
    });
  }

  async resetPassword(
    tenantFilter: string,
    userId: string,
    mustChange = true,
    displayName?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecResetPass",
      body: {
        TenantFilter: tenantFilter,
        ID: userId,
        MustChange: mustChange,
        displayName,
      },
    });
  }

  async revokeSessions(
    tenantFilter: string,
    userId: string,
    username?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecRevokeSessions",
      body: { TenantFilter: tenantFilter, ID: userId, Username: username },
    });
  }

  async clearImmutableId(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecClrImmId",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  // =========================================================================
  // Identity Management — MFA
  // =========================================================================

  async listMFAUsers(tenantFilter: string): Promise<CIPPMFAUser[]> {
    return this.client.requestCIPP<CIPPMFAUser[]>({
      path: "/api/ListMFAUsers",
      params: { TenantFilter: tenantFilter },
    });
  }

  async resetMFA(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecResetMFA",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  async createTAP(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecCreateTAP",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  async setPerUserMFA(
    tenantFilter: string,
    userId: string,
    state: "Enforced" | "Enabled" | "Disabled"
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecPerUserMFA",
      body: { TenantFilter: tenantFilter, userId, State: state },
    });
  }

  async sendPushNotification(tenantFilter: string, userEmail: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSendPush",
      body: { TenantFilter: tenantFilter, UserEmail: userEmail },
    });
  }

  // =========================================================================
  // Identity Management — Groups
  // =========================================================================

  async listGroups(
    tenantFilter: string,
    options?: { groupId?: string; members?: boolean; owners?: boolean }
  ): Promise<CIPPGroup[]> {
    const params: Record<string, string | boolean> = { TenantFilter: tenantFilter };
    if (options?.groupId) params.groupID = options.groupId;
    if (options?.members) params.members = true;
    if (options?.owners) params.owners = true;

    return this.client.requestCIPP<CIPPGroup[]>({
      path: "/api/ListGroups",
      params,
    });
  }

  async addGroup(input: CIPPAddGroupInput): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddGroup",
      body: input,
    });
  }

  async editGroup(tenantFilter: string, input: CIPPEditGroupInput): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/EditGroup",
      body: { TenantFilter: tenantFilter, ...input },
    });
  }

  async deleteGroup(
    tenantFilter: string,
    groupId: string,
    groupType: string,
    displayName: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGroupsDelete",
      body: { TenantFilter: tenantFilter, ID: groupId, GroupType: groupType, DisplayName: displayName },
    });
  }

  async hideGroupFromGAL(
    tenantFilter: string,
    groupId: string,
    groupType: string,
    hide: boolean
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGroupsHideFromGAL",
      body: { TenantFilter: tenantFilter, ID: groupId, GroupType: groupType, HidefromGAL: hide },
    });
  }

  // =========================================================================
  // Identity Management — Sign-ins & Audit
  // =========================================================================

  async listSignIns(
    tenantFilter: string,
    options?: { filter?: string; failedOnly?: boolean; failureThreshold?: number; days?: number }
  ): Promise<CIPPSignIn[]> {
    const params: Record<string, string | number | boolean> = { TenantFilter: tenantFilter };
    if (options?.filter) params.filter = options.filter;
    if (options?.failedOnly) params.failedLogonsOnly = true;
    if (options?.failureThreshold) params.FailureThreshold = options.failureThreshold;
    if (options?.days) params.Days = options.days;

    return this.client.requestCIPP<CIPPSignIn[]>({
      path: "/api/ListSignIns",
      params,
    });
  }

  async listInactiveAccounts(tenantFilter: string): Promise<CIPPInactiveAccount[]> {
    return this.client.requestCIPP<CIPPInactiveAccount[]>({
      path: "/api/ListInactiveAccounts",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listRoles(tenantFilter: string): Promise<CIPPRole[]> {
    return this.client.requestCIPP<CIPPRole[]>({
      path: "/api/ListRoles",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listAzureADConnectStatus(tenantFilter: string): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      path: "/api/ListAzureADConnectStatus",
      params: { TenantFilter: tenantFilter },
    });
  }

  // =========================================================================
  // Identity Management — Offboarding & Mailbox
  // =========================================================================

  async execOffboardUser(
    tenantFilter: string,
    userId: string,
    options: CIPPOffboardOptions
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecOffboardUser",
      body: {
        TenantFilter: tenantFilter,
        user: [{ value: userId }],
        ...options,
      },
    });
  }

  async convertMailbox(
    tenantFilter: string,
    userId: string,
    mailboxType: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecConvertMailbox",
      body: { TenantFilter: tenantFilter, ID: userId, MailboxType: mailboxType },
    });
  }

  async enableArchive(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecEnableArchive",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  async setOutOfOffice(
    tenantFilter: string,
    userId: string,
    state: string,
    message?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSetOoO",
      body: { TenantFilter: tenantFilter, userId, AutoReplyState: state, input: message },
    });
  }

  async setEmailForward(
    tenantFilter: string,
    userId: string,
    forwardOption: string,
    forwardTo?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecEmailForward",
      body: {
        TenantFilter: tenantFilter,
        username: userId,
        userid: userId,
        ForwardOption: forwardOption,
        ForwardTo: forwardTo,
      },
    });
  }

  async provisionOneDrive(tenantFilter: string, upn: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecOneDriveProvision",
      body: { TenantFilter: tenantFilter, UserPrincipalName: upn },
    });
  }

  // =========================================================================
  // Identity Management — Devices & Security
  // =========================================================================

  async execDeviceAction(
    tenantFilter: string,
    deviceId: string,
    action: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecDeviceDelete",
      body: { TenantFilter: tenantFilter, ID: deviceId, action },
    });
  }

  async getRecoveryKey(tenantFilter: string, guid: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGetRecoveryKey",
      body: { TenantFilter: tenantFilter, GUID: guid },
    });
  }

  async dismissRiskyUser(
    tenantFilter: string,
    userId: string,
    displayName?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecDismissRiskyUser",
      body: { TenantFilter: tenantFilter, userId, userDisplayName: displayName },
    });
  }

  async listDeletedItems(tenantFilter: string): Promise<CIPPDeletedItem[]> {
    return this.client.requestCIPP<CIPPDeletedItem[]>({
      path: "/api/ListDeletedItems",
      params: { TenantFilter: tenantFilter },
    });
  }

  async restoreDeleted(tenantFilter: string, itemId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecRestoreDeleted",
      body: { TenantFilter: tenantFilter, ID: itemId },
    });
  }

  // =========================================================================
  // Security & Compliance
  // =========================================================================

  async listDefenderState(tenantFilter: string): Promise<CIPPDefenderState[]> {
    return this.client.requestCIPP<CIPPDefenderState[]>({
      path: "/api/ListDefenderState",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listDefenderTVM(tenantFilter: string): Promise<CIPPDefenderTVM[]> {
    return this.client.requestCIPP<CIPPDefenderTVM[]>({
      path: "/api/ListDefenderTVM",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSecurityAlerts(tenantFilter: string): Promise<CIPPSecurityAlert[]> {
    return this.client.requestCIPP<CIPPSecurityAlert[]>({
      path: "/api/ExecAlertsList",
      params: { TenantFilter: tenantFilter },
    });
  }

  async setSecurityAlert(
    tenantFilter: string,
    alertId: string,
    status: string,
    vendor?: string,
    provider?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSetSecurityAlert",
      body: {
        TenantFilter: tenantFilter,
        GUID: alertId,
        Status: status,
        Vendor: vendor,
        Provider: provider,
      },
    });
  }

  async listSecurityIncidents(tenantFilter: string): Promise<CIPPSecurityIncident[]> {
    return this.client.requestCIPP<CIPPSecurityIncident[]>({
      path: "/api/ExecIncidentsList",
      params: { TenantFilter: tenantFilter },
    });
  }

  async setSecurityIncident(
    tenantFilter: string,
    incidentId: string,
    status: string,
    assignedTo?: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSetSecurityIncident",
      body: {
        TenantFilter: tenantFilter,
        GUID: incidentId,
        Status: status,
        Assigned: assignedTo,
      },
    });
  }

  // =========================================================================
  // Intune
  // =========================================================================

  async listIntuneDevices(tenantFilter: string): Promise<CIPPIntuneDevice[]> {
    return this.client.requestCIPP<CIPPIntuneDevice[]>({
      path: "/api/ListDevices",
      params: { TenantFilter: tenantFilter },
    });
  }

  async intuneDeviceAction(
    tenantFilter: string,
    deviceId: string,
    action: string,
    newDeviceName?: string
  ): Promise<CIPPActionResult> {
    const body: Record<string, string> = {
      TenantFilter: tenantFilter,
      DeviceID: deviceId,
      Action: action,
    };
    if (newDeviceName) body.NewDeviceName = newDeviceName;

    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecDeviceAction",
      body,
    });
  }

  async getLocalAdminPassword(
    tenantFilter: string,
    deviceId: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGetLocalAdminPassword",
      body: { TenantFilter: tenantFilter, DeviceID: deviceId },
    });
  }

  async getDeviceRecoveryKey(
    tenantFilter: string,
    deviceId: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGetRecoveryKey",
      body: { TenantFilter: tenantFilter, DeviceID: deviceId },
    });
  }

  async listAPDevices(tenantFilter: string): Promise<CIPPAutopilotDevice[]> {
    return this.client.requestCIPP<CIPPAutopilotDevice[]>({
      path: "/api/ListAPDevices",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listIntuneApps(tenantFilter: string): Promise<CIPPIntuneApp[]> {
    return this.client.requestCIPP<CIPPIntuneApp[]>({
      path: "/api/ListApps",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listIntunePolicy(tenantFilter: string): Promise<CIPPIntunePolicy[]> {
    return this.client.requestCIPP<CIPPIntunePolicy[]>({
      path: "/api/ListIntunePolicy",
      params: { TenantFilter: tenantFilter },
    });
  }

  async syncAPDevices(tenantFilter: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSyncAPDevices",
      body: { TenantFilter: tenantFilter },
    });
  }

  // =========================================================================
  // Teams & SharePoint
  // =========================================================================

  async listTeams(tenantFilter: string): Promise<CIPPTeam[]> {
    return this.client.requestCIPP<CIPPTeam[]>({
      path: "/api/ListTeams",
      params: { TenantFilter: tenantFilter, type: "list" },
    });
  }

  async listTeamsActivity(tenantFilter: string): Promise<CIPPTeamsActivity[]> {
    return this.client.requestCIPP<CIPPTeamsActivity[]>({
      path: "/api/ListTeamsActivity",
      params: { TenantFilter: tenantFilter, type: "TeamsUserActivityUser" },
    });
  }

  async listTeamsVoice(tenantFilter: string): Promise<CIPPTeamsVoice[]> {
    return this.client.requestCIPP<CIPPTeamsVoice[]>({
      path: "/api/ListTeamsVoice",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSites(
    tenantFilter: string,
    type: "SharePointSiteUsage" | "OneDriveUsageAccount" = "SharePointSiteUsage"
  ): Promise<CIPPSharePointSite[]> {
    return this.client.requestCIPP<CIPPSharePointSite[]>({
      path: "/api/ListSites",
      params: { TenantFilter: tenantFilter, type },
    });
  }

  // =========================================================================
  // CIPP Platform
  // =========================================================================

  async listScheduledItems(showHidden = false): Promise<CIPPScheduledItem[]> {
    return this.client.requestCIPP<CIPPScheduledItem[]>({
      path: "/api/ListScheduledItems",
      params: { ShowHidden: showHidden },
    });
  }

  async removeScheduledItem(rowKey: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveScheduledItem",
      body: { id: rowKey },
    });
  }

  async listLogs(dateFilter?: string, severity?: string): Promise<CIPPLog[]> {
    const params: Record<string, string | boolean> = {};
    if (dateFilter) params.DateFilter = dateFilter;
    if (severity) params.Filter = severity;

    return this.client.requestCIPP<CIPPLog[]>({
      path: "/api/ListLogs",
      params,
    });
  }

  async listExtensionsConfig(): Promise<Record<string, unknown>> {
    return this.client.requestCIPP<Record<string, unknown>>({
      path: "/api/ListExtensionsConfig",
    });
  }

  // =========================================================================
  // Graph API (pass-through)
  // =========================================================================

  async graphRequest(
    tenantFilter: string,
    endpoint: string,
    options?: { $select?: string; $filter?: string; $top?: number; $orderby?: string; $count?: boolean }
  ): Promise<unknown> {
    const params: Record<string, string | number | boolean> = {
      TenantFilter: tenantFilter,
      Endpoint: endpoint,
    };
    if (options?.$select) params.$select = options.$select;
    if (options?.$filter) params.$filter = options.$filter;
    if (options?.$top) params.$top = options.$top;
    if (options?.$orderby) params.$orderby = options.$orderby;
    if (options?.$count) params.$count = options.$count;

    return this.client.requestCIPP<unknown>({
      path: "/api/ListGraphRequest",
      params,
    });
  }

  // =========================================================================
  // Health Check
  // =========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
