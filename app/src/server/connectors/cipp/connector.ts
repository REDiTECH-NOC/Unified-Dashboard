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
  CIPPTenantDetail,
  CIPPDomain,
  CIPPPartnerRelationship,
  CIPPTenantOnboarding,
  CIPPAlert,
  CIPPLicense,
  CIPPCSPLicense,
  CIPPCSPSku,
  CIPPAuditLog,
  CIPPBackup,
  CIPPGDAPRole,
  CIPPGDAPRoleTemplate,
  CIPPGDAPInvite,
  CIPPGDAPAccessAssignment,
  CIPPUser,
  CIPPAddUserInput,
  CIPPUserCount,
  CIPPUserDevice,
  CIPPMailboxDetail,
  CIPPMailboxRule,
  CIPPBECResult,
  CIPPGroup,
  CIPPAddGroupInput,
  CIPPEditGroupInput,
  CIPPMFAUser,
  CIPPSignIn,
  CIPPRole,
  CIPPInactiveAccount,
  CIPPOffboardOptions,
  CIPPDeletedItem,
  CIPPConditionalAccessPolicy,
  CIPPCATemplate,
  CIPPNamedLocation,
  CIPPStandard,
  CIPPBPAResult,
  CIPPTenantAlignment,
  CIPPDomainHealth,
  CIPPStandardTemplate,
  CIPPBPATemplate,
  CIPPMailbox,
  CIPPMailboxStatistic,
  CIPPMailboxCAS,
  CIPPMailboxPermission,
  CIPPCalendarPermission,
  CIPPOutOfOffice,
  CIPPRestrictedUser,
  CIPPMessageTrace,
  CIPPMailQuarantineItem,
  CIPPContact,
  CIPPSpamFilter,
  CIPPSpamFilterTemplate,
  CIPPAntiPhishingFilter,
  CIPPConnectionFilter,
  CIPPTenantAllowBlockItem,
  CIPPQuarantinePolicy,
  CIPPTransportRule,
  CIPPTransportRuleTemplate,
  CIPPExchangeConnector,
  CIPPExConnectorTemplate,
  CIPPMailboxMobileDevice,
  CIPPDefenderState,
  CIPPDefenderTVM,
  CIPPSecurityAlert,
  CIPPSecurityIncident,
  CIPPBreachResult,
  CIPPPhishPolicy,
  CIPPSafeLinkFilter,
  CIPPSafeAttachmentFilter,
  CIPPIntuneDevice,
  CIPPDeviceComplianceDetail,
  CIPPIntuneIntent,
  CIPPIntuneTemplate,
  CIPPAssignmentFilter,
  CIPPAssignmentFilterTemplate,
  CIPPAutopilotDevice,
  CIPPAutopilotConfig,
  CIPPAppStatus,
  CIPPIntuneApp,
  CIPPIntunePolicy,
  CIPPIntuneScript,
  CIPPTeam,
  CIPPTeamsActivity,
  CIPPTeamsVoice,
  CIPPTeamsLisLocation,
  CIPPSharePointSite,
  CIPPSharePointQuota,
  CIPPSharePointSettings,
  CIPPOneDriveItem,
  CIPPServiceHealth,
  CIPPScheduledItem,
  CIPPLog,
  CIPPVersion,
  CIPPQueueItem,
  CIPPNotificationConfig,
  CIPPTrustedIP,
  CIPPCustomVariable,
  CIPPPendingWebhook,
  CIPPExcludedTenant,
  CIPPExcludedLicense,
  CIPPExtensionMapping,
  CIPPExtensionSync,
  CIPPHaloClient,
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

  async listTenantDetails(tenantFilter: string): Promise<CIPPTenantDetail> {
    return this.client.requestCIPP<CIPPTenantDetail>({
      path: "/api/ListOrg",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listDomains(tenantFilter: string): Promise<CIPPDomain[]> {
    return this.client.requestCIPP<CIPPDomain[]>({
      path: "/api/ListDomains",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listPartnerRelationships(tenantFilter: string): Promise<CIPPPartnerRelationship[]> {
    return this.client.requestCIPP<CIPPPartnerRelationship[]>({
      path: "/api/ListGraphRequest",
      params: {
        TenantFilter: tenantFilter,
        Endpoint: "policies/crossTenantAccessPolicy/partners",
      },
    });
  }

  async listTenantOnboarding(): Promise<CIPPTenantOnboarding[]> {
    return this.client.requestCIPP<CIPPTenantOnboarding[]>({
      path: "/api/ListTenantOnboarding",
    });
  }

  async listExternalTenantInfo(tenantId: string): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      path: "/api/ListExternalTenantInfo",
      params: { TenantFilter: tenantId },
    });
  }

  async editTenant(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/EditTenant",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async listBackups(tenantFilter?: string): Promise<CIPPBackup[]> {
    return this.client.requestCIPP<CIPPBackup[]>({
      path: "/api/ExecListBackup",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async execRunBackup(tenantFilter: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecRunBackup",
      body: { TenantFilter: tenantFilter },
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

  async editUser(tenantFilter: string, userId: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/EditUser",
      body: { TenantFilter: tenantFilter, ID: userId, ...data },
    });
  }

  async listUserCounts(tenantFilter?: string): Promise<CIPPUserCount[]> {
    return this.client.requestCIPP<CIPPUserCount[]>({
      path: "/api/ListUserCounts",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listUserSigninLogs(tenantFilter: string, userId: string): Promise<CIPPSignIn[]> {
    return this.client.requestCIPP<CIPPSignIn[]>({
      path: "/api/ListSignIns",
      params: { TenantFilter: tenantFilter, filter: `userPrincipalName eq '${userId}'` },
    });
  }

  async listUserDevices(tenantFilter: string, userId: string): Promise<CIPPUserDevice[]> {
    return this.client.requestCIPP<CIPPUserDevice[]>({
      path: "/api/ListUserDevices",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async listUserGroups(tenantFilter: string, userId: string): Promise<CIPPGroup[]> {
    return this.client.requestCIPP<CIPPGroup[]>({
      path: "/api/ListUserGroups",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async listUserMailboxDetails(tenantFilter: string, userId: string): Promise<CIPPMailboxDetail> {
    return this.client.requestCIPP<CIPPMailboxDetail>({
      path: "/api/ListUserMailboxDetails",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async listUserMailboxRules(tenantFilter: string, userId: string): Promise<CIPPMailboxRule[]> {
    return this.client.requestCIPP<CIPPMailboxRule[]>({
      path: "/api/ListUserMailboxRules",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async listUserConditionalAccessPolicies(tenantFilter: string, userId: string): Promise<CIPPConditionalAccessPolicy[]> {
    return this.client.requestCIPP<CIPPConditionalAccessPolicy[]>({
      path: "/api/ListUserConditionalAccessPolicies",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async listUserPhoto(tenantFilter: string, userId: string): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      path: "/api/ListUserPhoto",
      params: { TenantFilter: tenantFilter, userId },
    });
  }

  async execUniversalSearch(searchString: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ExecUniversalSearch",
      params: { SearchString: searchString },
    });
  }

  async execBECCheck(tenantFilter: string, userId: string): Promise<CIPPBECResult> {
    return this.client.requestCIPP<CIPPBECResult>({
      path: "/api/ExecBECCheck",
      params: { TenantFilter: tenantFilter, UserID: userId },
    });
  }

  async execBECRemediate(tenantFilter: string, userId: string, options: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecBECRemediate",
      body: { TenantFilter: tenantFilter, UserID: userId, ...options },
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

  async listMFAUsersAllTenants(): Promise<CIPPMFAUser[]> {
    return this.client.requestCIPP<CIPPMFAUser[]>({
      path: "/api/ListMFAUsersAllTenants",
    });
  }

  async listPerUserMFA(tenantFilter: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListPerUserMFA",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listBasicAuth(tenantFilter: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListBasicAuth",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSharedMailboxAccountEnabled(tenantFilter: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListSharedMailboxAccountEnabled",
      params: { TenantFilter: tenantFilter },
    });
  }

  async execExcludeLicenses(licenses: Array<{ GUID: string; SKUName: string }>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecExcludeLicenses",
      body: { Licenses: licenses },
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

  async listGroupTemplates(): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListGroupTemplates",
    });
  }

  async addGroupTemplate(template: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddGroupTemplate",
      body: template,
    });
  }

  async removeGroupTemplate(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveGroupTemplate",
      body: { ID: id },
    });
  }

  async execGroupsDeliveryManagement(
    tenantFilter: string,
    groupId: string,
    options: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGroupsDeliveryManagement",
      body: { TenantFilter: tenantFilter, ID: groupId, ...options },
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

  async addDefenderDeployment(tenantFilter: string, options: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddDefenderDeployment",
      body: { TenantFilter: tenantFilter, ...options },
    });
  }

  async getCippAlerts(): Promise<CIPPAlert[]> {
    return this.client.requestCIPP<CIPPAlert[]>({
      path: "/api/GetCippAlerts",
    });
  }

  async removeQueuedAlert(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveQueuedAlert",
      body: { ID: id },
    });
  }

  async addAlert(alert: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddAlert",
      body: alert,
    });
  }

  async execBreachSearch(domain: string): Promise<CIPPBreachResult[]> {
    return this.client.requestCIPP<CIPPBreachResult[]>({
      path: "/api/ExecBreachSearch",
      params: { Domain: domain },
    });
  }

  async listBreachesTenant(tenantFilter: string): Promise<CIPPBreachResult[]> {
    return this.client.requestCIPP<CIPPBreachResult[]>({
      path: "/api/ListBreachesTenant",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listBreachesAccount(tenantFilter: string, account: string): Promise<CIPPBreachResult[]> {
    return this.client.requestCIPP<CIPPBreachResult[]>({
      path: "/api/ListBreachesAccount",
      params: { TenantFilter: tenantFilter, Account: account },
    });
  }

  async listPhishPolicies(tenantFilter: string): Promise<CIPPPhishPolicy[]> {
    return this.client.requestCIPP<CIPPPhishPolicy[]>({
      path: "/api/ListPhishPolicies",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSafeLinkFilter(tenantFilter: string): Promise<CIPPSafeLinkFilter[]> {
    return this.client.requestCIPP<CIPPSafeLinkFilter[]>({
      path: "/api/ListSafeLinksFilters",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSafeAttachmentFilter(tenantFilter: string): Promise<CIPPSafeAttachmentFilter[]> {
    return this.client.requestCIPP<CIPPSafeAttachmentFilter[]>({
      path: "/api/ListSafeAttachmentsFilters",
      params: { TenantFilter: tenantFilter },
    });
  }

  // =========================================================================
  // Conditional Access
  // =========================================================================

  async listConditionalAccessPolicies(tenantFilter: string): Promise<CIPPConditionalAccessPolicy[]> {
    return this.client.requestCIPP<CIPPConditionalAccessPolicy[]>({
      path: "/api/ListConditionalAccessPolicies",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listCATemplates(): Promise<CIPPCATemplate[]> {
    return this.client.requestCIPP<CIPPCATemplate[]>({
      path: "/api/ListCAtemplates",
    });
  }

  async listNamedLocations(tenantFilter: string): Promise<CIPPNamedLocation[]> {
    return this.client.requestCIPP<CIPPNamedLocation[]>({
      path: "/api/ListNamedLocations",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addCAPolicy(tenantFilter: string, policy: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddCAPolicy",
      body: { TenantFilter: tenantFilter, ...policy },
    });
  }

  async addCATemplate(template: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddCATemplate",
      body: template,
    });
  }

  async editCAPolicy(tenantFilter: string, policyId: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/EditCAPolicy",
      body: { TenantFilter: tenantFilter, GUID: policyId, ...data },
    });
  }

  async removeCAPolicy(tenantFilter: string, policyId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveCAPolicy",
      body: { TenantFilter: tenantFilter, GUID: policyId },
    });
  }

  async removeCATemplate(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveCATemplate",
      body: { ID: id },
    });
  }

  async addNamedLocation(tenantFilter: string, location: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddNamedLocation",
      body: { TenantFilter: tenantFilter, ...location },
    });
  }

  // =========================================================================
  // Standards & BPA
  // =========================================================================

  async listStandards(): Promise<CIPPStandard[]> {
    return this.client.requestCIPP<CIPPStandard[]>({
      path: "/api/ListStandards",
    });
  }

  async bestPracticeAnalyserList(tenantFilter?: string): Promise<CIPPBPAResult[]> {
    return this.client.requestCIPP<CIPPBPAResult[]>({
      path: "/api/BestPracticeAnalyser_List",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listTenantAlignment(tenantFilter?: string): Promise<CIPPTenantAlignment[]> {
    return this.client.requestCIPP<CIPPTenantAlignment[]>({
      path: "/api/ListTenantAlignment",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listTenantDrift(tenantFilter?: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListTenantDrift",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async listDomainHealth(domain: string): Promise<CIPPDomainHealth> {
    return this.client.requestCIPP<CIPPDomainHealth>({
      path: "/api/ListDomainHealth",
      params: { Domain: domain },
    });
  }

  async domainAnalyserList(tenantFilter?: string): Promise<CIPPDomainHealth[]> {
    return this.client.requestCIPP<CIPPDomainHealth[]>({
      path: "/api/DomainAnalyser_List",
      params: tenantFilter ? { TenantFilter: tenantFilter } : undefined,
    });
  }

  async execSetStandardsRun(tenantFilter: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSetStandardsRun",
      body: { TenantFilter: tenantFilter },
    });
  }

  async removeStandard(policyName: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveStandard",
      body: { PolicyName: policyName },
    });
  }

  async listStandardTemplates(): Promise<CIPPStandardTemplate[]> {
    return this.client.requestCIPP<CIPPStandardTemplate[]>({
      path: "/api/ListStandardTemplates",
    });
  }

  async removeStandardTemplate(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveStandardTemplate",
      body: { ID: id },
    });
  }

  async listBPATemplates(): Promise<CIPPBPATemplate[]> {
    return this.client.requestCIPP<CIPPBPATemplate[]>({
      path: "/api/ListBPATemplates",
    });
  }

  async removeBPATemplate(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveBPATemplate",
      body: { ID: id },
    });
  }

  // =========================================================================
  // Email & Exchange
  // =========================================================================

  async listMailboxes(tenantFilter: string): Promise<CIPPMailbox[]> {
    return this.client.requestCIPP<CIPPMailbox[]>({
      path: "/api/ListMailboxes",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listMailboxStatistics(tenantFilter: string): Promise<CIPPMailboxStatistic[]> {
    return this.client.requestCIPP<CIPPMailboxStatistic[]>({
      path: "/api/ListMailboxStatistics",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSharedMailboxStatistics(tenantFilter: string): Promise<CIPPMailboxStatistic[]> {
    return this.client.requestCIPP<CIPPMailboxStatistic[]>({
      path: "/api/ListSharedMailboxStatistics",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listMailboxCAS(tenantFilter: string): Promise<CIPPMailboxCAS[]> {
    return this.client.requestCIPP<CIPPMailboxCAS[]>({
      path: "/api/ListMailboxCAS",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listMailboxPermissions(tenantFilter: string, userId: string): Promise<CIPPMailboxPermission[]> {
    return this.client.requestCIPP<CIPPMailboxPermission[]>({
      path: "/api/ListMailboxPermissions",
      params: { TenantFilter: tenantFilter, UserID: userId },
    });
  }

  async listMailboxRules(tenantFilter: string, userId?: string): Promise<CIPPMailboxRule[]> {
    const params: Record<string, string> = { TenantFilter: tenantFilter };
    if (userId) params.UserID = userId;
    return this.client.requestCIPP<CIPPMailboxRule[]>({
      path: "/api/ListMailboxRules",
      params,
    });
  }

  async listCalendarPermissions(tenantFilter: string, userId: string): Promise<CIPPCalendarPermission[]> {
    return this.client.requestCIPP<CIPPCalendarPermission[]>({
      path: "/api/ListCalendarPermissions",
      params: { TenantFilter: tenantFilter, UserID: userId },
    });
  }

  async listOutOfOffice(tenantFilter: string, userId?: string): Promise<CIPPOutOfOffice[]> {
    const params: Record<string, string> = { TenantFilter: tenantFilter };
    if (userId) params.UserID = userId;
    return this.client.requestCIPP<CIPPOutOfOffice[]>({
      path: "/api/ListOoO",
      params,
    });
  }

  async addSharedMailbox(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddSharedMailbox",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async execHideFromGAL(tenantFilter: string, userId: string, hide: boolean): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecHideFromGAL",
      body: { TenantFilter: tenantFilter, ID: userId, HidefromGAL: hide },
    });
  }

  async execCopyForSent(tenantFilter: string, userId: string, messageAction: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecCopyForSent",
      body: { TenantFilter: tenantFilter, ID: userId, MessageCopyForSentAsEnabled: messageAction },
    });
  }

  async execEditMailboxPermissions(
    tenantFilter: string,
    userId: string,
    permissions: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecEditMailboxPermissions",
      body: { TenantFilter: tenantFilter, UserID: userId, ...permissions },
    });
  }

  async execSetMailboxQuota(
    tenantFilter: string,
    userId: string,
    quota: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSetMailboxQuota",
      body: { TenantFilter: tenantFilter, UserID: userId, ...quota },
    });
  }

  async execEditCalendarPermissions(
    tenantFilter: string,
    userId: string,
    permissions: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecEditCalendarPermissions",
      body: { TenantFilter: tenantFilter, UserID: userId, ...permissions },
    });
  }

  async listRestrictedUsers(tenantFilter: string): Promise<CIPPRestrictedUser[]> {
    return this.client.requestCIPP<CIPPRestrictedUser[]>({
      path: "/api/ListRestrictedUsers",
      params: { TenantFilter: tenantFilter },
    });
  }

  async removeRestrictedUser(tenantFilter: string, userId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveRestrictedUser",
      body: { TenantFilter: tenantFilter, ID: userId },
    });
  }

  async listMailboxRestores(tenantFilter: string): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListMailboxRestores",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listMailboxMobileDevices(tenantFilter: string, userId: string): Promise<CIPPMailboxMobileDevice[]> {
    return this.client.requestCIPP<CIPPMailboxMobileDevice[]>({
      path: "/api/ListMailboxMobileDevices",
      params: { TenantFilter: tenantFilter, Mailbox: userId },
    });
  }

  async execMailboxMobileDevices(
    tenantFilter: string,
    userId: string,
    deviceId: string,
    action: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecMailboxMobileDevices",
      body: { TenantFilter: tenantFilter, Mailbox: userId, DeviceID: deviceId, Action: action },
    });
  }

  async listMessageTrace(
    tenantFilter: string,
    options?: { sender?: string; recipient?: string; days?: number }
  ): Promise<CIPPMessageTrace[]> {
    const params: Record<string, string | number> = { TenantFilter: tenantFilter };
    if (options?.sender) params.Sender = options.sender;
    if (options?.recipient) params.Recipient = options.recipient;
    if (options?.days) params.Days = options.days;
    return this.client.requestCIPP<CIPPMessageTrace[]>({
      path: "/api/ListMessageTrace",
      params,
    });
  }

  async listMailQuarantine(tenantFilter: string): Promise<CIPPMailQuarantineItem[]> {
    return this.client.requestCIPP<CIPPMailQuarantineItem[]>({
      path: "/api/ListMailQuarantine",
      params: { TenantFilter: tenantFilter },
    });
  }

  async execQuarantineManagement(
    tenantFilter: string,
    identity: string,
    action: string
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecQuarantineManagement",
      body: { TenantFilter: tenantFilter, Identity: identity, Type: action },
    });
  }

  async listContacts(tenantFilter: string): Promise<CIPPContact[]> {
    return this.client.requestCIPP<CIPPContact[]>({
      path: "/api/ListContacts",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addContact(tenantFilter: string, contact: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddContact",
      body: { TenantFilter: tenantFilter, ...contact },
    });
  }

  async listSpamFilter(tenantFilter: string): Promise<CIPPSpamFilter[]> {
    return this.client.requestCIPP<CIPPSpamFilter[]>({
      path: "/api/ListSpamfilter",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSpamFilterTemplates(): Promise<CIPPSpamFilterTemplate[]> {
    return this.client.requestCIPP<CIPPSpamFilterTemplate[]>({
      path: "/api/ListSpamFilterTemplates",
    });
  }

  async addSpamFilter(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddSpamFilter",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async removeSpamFilter(tenantFilter: string, name: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveSpamfilter",
      body: { TenantFilter: tenantFilter, name },
    });
  }

  async listAntiPhishingFilter(tenantFilter: string): Promise<CIPPAntiPhishingFilter[]> {
    return this.client.requestCIPP<CIPPAntiPhishingFilter[]>({
      path: "/api/ListAntiPhishingFilter",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listConnectionFilter(tenantFilter: string): Promise<CIPPConnectionFilter[]> {
    return this.client.requestCIPP<CIPPConnectionFilter[]>({
      path: "/api/ListConnectionFilter",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listTenantAllowBlockList(tenantFilter: string): Promise<CIPPTenantAllowBlockItem[]> {
    return this.client.requestCIPP<CIPPTenantAllowBlockItem[]>({
      path: "/api/ListTenantAllowBlockList",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listQuarantinePolicy(tenantFilter: string): Promise<CIPPQuarantinePolicy[]> {
    return this.client.requestCIPP<CIPPQuarantinePolicy[]>({
      path: "/api/ListQuarantinePolicy",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addQuarantinePolicy(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddQuarantinePolicy",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async listTransportRules(tenantFilter: string): Promise<CIPPTransportRule[]> {
    return this.client.requestCIPP<CIPPTransportRule[]>({
      path: "/api/ListTransportRules",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listTransportRulesTemplates(): Promise<CIPPTransportRuleTemplate[]> {
    return this.client.requestCIPP<CIPPTransportRuleTemplate[]>({
      path: "/api/ListTransportRulesTemplates",
    });
  }

  async addTransportRule(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddTransportRule",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async removeTransportRule(tenantFilter: string, guid: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveTransportRule",
      body: { TenantFilter: tenantFilter, GUID: guid },
    });
  }

  async listExchangeConnectors(tenantFilter: string): Promise<CIPPExchangeConnector[]> {
    return this.client.requestCIPP<CIPPExchangeConnector[]>({
      path: "/api/ListExchangeConnectors",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listExConnectorTemplates(): Promise<CIPPExConnectorTemplate[]> {
    return this.client.requestCIPP<CIPPExConnectorTemplate[]>({
      path: "/api/ListExConnectorTemplates",
    });
  }

  async addExConnector(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddExConnector",
      body: { TenantFilter: tenantFilter, ...data },
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

  async listDeviceDetails(tenantFilter: string, deviceId: string): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      path: "/api/ListDevices",
      params: { TenantFilter: tenantFilter, DeviceID: deviceId },
    });
  }

  async listAllTenantDeviceCompliance(): Promise<CIPPDeviceComplianceDetail[]> {
    return this.client.requestCIPP<CIPPDeviceComplianceDetail[]>({
      path: "/api/ListAllTenantDeviceCompliance",
    });
  }

  async listIntuneIntents(tenantFilter: string): Promise<CIPPIntuneIntent[]> {
    return this.client.requestCIPP<CIPPIntuneIntent[]>({
      path: "/api/ListIntuneIntents",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listIntuneTemplates(): Promise<CIPPIntuneTemplate[]> {
    return this.client.requestCIPP<CIPPIntuneTemplate[]>({
      path: "/api/ListIntuneTemplates",
    });
  }

  async addPolicy(tenantFilter: string, policy: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddPolicy",
      body: { TenantFilter: tenantFilter, ...policy },
    });
  }

  async removePolicy(tenantFilter: string, policyId: string, policyType: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemovePolicy",
      body: { TenantFilter: tenantFilter, ID: policyId, URLName: policyType },
    });
  }

  async editPolicy(tenantFilter: string, policyId: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/EditPolicy",
      body: { TenantFilter: tenantFilter, ID: policyId, ...data },
    });
  }

  async listAssignmentFilters(tenantFilter: string): Promise<CIPPAssignmentFilter[]> {
    return this.client.requestCIPP<CIPPAssignmentFilter[]>({
      path: "/api/ListAssignmentFilters",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listAssignmentFilterTemplates(): Promise<CIPPAssignmentFilterTemplate[]> {
    return this.client.requestCIPP<CIPPAssignmentFilterTemplate[]>({
      path: "/api/ListAssignmentFilterTemplates",
    });
  }

  async listAutopilotConfig(tenantFilter: string): Promise<CIPPAutopilotConfig[]> {
    return this.client.requestCIPP<CIPPAutopilotConfig[]>({
      path: "/api/ListAutopilotconfig",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addAutopilotConfig(tenantFilter: string, config: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddAutopilotConfig",
      body: { TenantFilter: tenantFilter, ...config },
    });
  }

  async removeAPDevice(tenantFilter: string, deviceId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveAPDevice",
      body: { TenantFilter: tenantFilter, ID: deviceId },
    });
  }

  async execAutoPilotSync(tenantFilter: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecAutoPilotSync",
      body: { TenantFilter: tenantFilter },
    });
  }

  async listAppStatus(tenantFilter: string): Promise<CIPPAppStatus[]> {
    return this.client.requestCIPP<CIPPAppStatus[]>({
      path: "/api/ListAppStatus",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addChocoApp(tenantFilter: string, appData: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddChocoApp",
      body: { TenantFilter: tenantFilter, ...appData },
    });
  }

  async addWinGetApp(tenantFilter: string, appData: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddWinGetApp",
      body: { TenantFilter: tenantFilter, ...appData },
    });
  }

  async addOfficeApp(tenantFilter: string, appData: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddOfficeApp",
      body: { TenantFilter: tenantFilter, ...appData },
    });
  }

  async removeApp(tenantFilter: string, appId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveApp",
      body: { TenantFilter: tenantFilter, ID: appId },
    });
  }

  async listScripts(tenantFilter: string): Promise<CIPPIntuneScript[]> {
    return this.client.requestCIPP<CIPPIntuneScript[]>({
      path: "/api/ListScripts",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addIntuneTemplate(template: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddIntuneTemplate",
      body: template,
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

  async listTeamsLisLocation(tenantFilter: string): Promise<CIPPTeamsLisLocation[]> {
    return this.client.requestCIPP<CIPPTeamsLisLocation[]>({
      path: "/api/ListTeamsLisLocation",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addTeam(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddTeam",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async listSharePointQuota(tenantFilter: string): Promise<CIPPSharePointQuota> {
    return this.client.requestCIPP<CIPPSharePointQuota>({
      path: "/api/ListSharepointQuota",
      params: { TenantFilter: tenantFilter },
    });
  }

  async listSharePointSettings(tenantFilter: string): Promise<CIPPSharePointSettings> {
    return this.client.requestCIPP<CIPPSharePointSettings>({
      path: "/api/ListSharepointSettings",
      params: { TenantFilter: tenantFilter },
    });
  }

  async addSharePointSite(tenantFilter: string, data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/AddSharePointSite",
      body: { TenantFilter: tenantFilter, ...data },
    });
  }

  async removeSharePointSite(tenantFilter: string, siteUrl: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveSharePointSite",
      body: { TenantFilter: tenantFilter, URL: siteUrl },
    });
  }

  async listOneDriveList(tenantFilter: string): Promise<CIPPOneDriveItem[]> {
    return this.client.requestCIPP<CIPPOneDriveItem[]>({
      path: "/api/ListSites",
      params: { TenantFilter: tenantFilter, type: "OneDriveUsageAccount" },
    });
  }

  async execSharePointSiteAdmin(
    tenantFilter: string,
    siteUrl: string,
    data: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSharePointSiteAdmin",
      body: { TenantFilter: tenantFilter, URL: siteUrl, ...data },
    });
  }

  async execSharePointSiteMembers(
    tenantFilter: string,
    siteUrl: string,
    data: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecSharePointSiteMembers",
      body: { TenantFilter: tenantFilter, URL: siteUrl, ...data },
    });
  }

  async execOneDrivePerms(
    tenantFilter: string,
    upn: string,
    data: Record<string, unknown>
  ): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecOneDrivePerms",
      body: { TenantFilter: tenantFilter, UPN: upn, ...data },
    });
  }

  // =========================================================================
  // GDAP
  // =========================================================================

  async listGDAPInvite(): Promise<CIPPGDAPInvite[]> {
    return this.client.requestCIPP<CIPPGDAPInvite[]>({
      path: "/api/ListGDAPInvite",
    });
  }

  async listGDAPAccessAssignments(relationshipId: string): Promise<CIPPGDAPAccessAssignment[]> {
    return this.client.requestCIPP<CIPPGDAPAccessAssignment[]>({
      path: "/api/ListGDAPAccessAssignments",
      params: { RelationshipId: relationshipId },
    });
  }

  async execGDAPInvite(data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGDAPInvite",
      body: data,
    });
  }

  async execAddGDAPRole(data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecAddGDAPRole",
      body: data,
    });
  }

  async execDeleteGDAPRelationship(relationshipId: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecDeleteGDAPRelationship",
      body: { GDAPID: relationshipId },
    });
  }

  async execGDAPMigration(data: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecGDAPMigration",
      body: data,
    });
  }

  async execCPVPermissions(tenantFilter: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecCPVPermissions",
      body: { TenantFilter: tenantFilter },
    });
  }

  async execAccessChecks(tenantFilter: string): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      path: "/api/ExecAccessChecks",
      params: { TenantFilter: tenantFilter },
    });
  }

  // =========================================================================
  // Service Health
  // =========================================================================

  async listServiceHealth(tenantFilter: string): Promise<CIPPServiceHealth[]> {
    return this.client.requestCIPP<CIPPServiceHealth[]>({
      path: "/api/ListServiceHealth",
      params: { TenantFilter: tenantFilter },
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

  async getVersion(): Promise<CIPPVersion> {
    return this.client.requestCIPP<CIPPVersion>({
      path: "/api/GetVersion",
    });
  }

  async listQueue(): Promise<CIPPQueueItem[]> {
    return this.client.requestCIPP<CIPPQueueItem[]>({
      path: "/api/ListQueue",
    });
  }

  async removeQueue(id: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/RemoveQueuedApp",
      body: { ID: id },
    });
  }

  async execNotificationConfig(config: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecNotificationConfig",
      body: config,
    });
  }

  async execPasswordConfig(config: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecPasswordConfig",
      body: config,
    });
  }

  async listExcludedLicenses(): Promise<CIPPExcludedLicense[]> {
    return this.client.requestCIPP<CIPPExcludedLicense[]>({
      path: "/api/ExecExcludeLicenses",
      params: { List: "true" },
    });
  }

  async listExcludedTenants(): Promise<CIPPExcludedTenant[]> {
    return this.client.requestCIPP<CIPPExcludedTenant[]>({
      path: "/api/ExecExcludeTenant",
      params: { List: "true" },
    });
  }

  async execExcludeTenant(tenantFilter: string, exclude: boolean): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecExcludeTenant",
      body: { TenantFilter: tenantFilter, AddExclusion: exclude },
    });
  }

  async listTrustedIP(): Promise<CIPPTrustedIP[]> {
    return this.client.requestCIPP<CIPPTrustedIP[]>({
      path: "/api/ListTrustedIP",
    });
  }

  async listCustomVariables(): Promise<CIPPCustomVariable[]> {
    return this.client.requestCIPP<CIPPCustomVariable[]>({
      path: "/api/ListCustomVariables",
    });
  }

  async listNotificationConfig(): Promise<CIPPNotificationConfig> {
    return this.client.requestCIPP<CIPPNotificationConfig>({
      path: "/api/ListNotificationConfig",
    });
  }

  async listPendingWebhooks(): Promise<CIPPPendingWebhook[]> {
    return this.client.requestCIPP<CIPPPendingWebhook[]>({
      path: "/api/ListPendingWebhooks",
    });
  }

  async listScheduledTasks(showHidden = false): Promise<CIPPScheduledItem[]> {
    return this.client.requestCIPP<CIPPScheduledItem[]>({
      path: "/api/ListScheduledItems",
      params: { ShowHidden: showHidden, type: "ScheduledTask" },
    });
  }

  // =========================================================================
  // Extensions
  // =========================================================================

  async execExtensionMapping(data: Record<string, unknown>): Promise<CIPPExtensionMapping> {
    return this.client.requestCIPP<CIPPExtensionMapping>({
      method: "POST",
      path: "/api/ExecExtensionMapping",
      body: data,
    });
  }

  async listExtensionSync(): Promise<CIPPExtensionSync[]> {
    return this.client.requestCIPP<CIPPExtensionSync[]>({
      path: "/api/ListExtensionSync",
    });
  }

  async execExtensionsConfig(config: Record<string, unknown>): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecExtensionsConfig",
      body: config,
    });
  }

  async execExtensionTest(extension: string): Promise<CIPPActionResult> {
    return this.client.requestCIPP<CIPPActionResult>({
      method: "POST",
      path: "/api/ExecExtensionTest",
      body: { extensionName: extension },
    });
  }

  async listHaloClients(): Promise<CIPPHaloClient[]> {
    return this.client.requestCIPP<CIPPHaloClient[]>({
      path: "/api/ListHaloClients",
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

  async listGraphBulkRequest(
    tenantFilter: string,
    endpoint: string,
    options?: Record<string, unknown>
  ): Promise<unknown[]> {
    return this.client.requestCIPP<unknown[]>({
      path: "/api/ListGraphRequest",
      params: {
        TenantFilter: tenantFilter,
        Endpoint: endpoint,
        ...(options as Record<string, string | number | boolean> | undefined),
      },
    });
  }

  async execExoRequest(
    tenantFilter: string,
    cmdlet: string,
    cmdParams?: Record<string, unknown>
  ): Promise<unknown> {
    return this.client.requestCIPP<unknown>({
      method: "POST",
      path: "/api/ExecExoRequest",
      body: { TenantFilter: tenantFilter, cmdlet, cmdParams },
    });
  }

  // =========================================================================
  // Health Check
  // =========================================================================

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
