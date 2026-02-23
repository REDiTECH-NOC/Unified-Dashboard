/**
 * CIPP API response and input types.
 *
 * All types use the CIPP prefix and include index signatures for
 * extra fields — CIPP returns rich, loosely-typed JSON that varies
 * by tenant configuration.
 *
 * API docs: https://docs.cipp.app/api-documentation/endpoints
 */

// ─── OAuth ───────────────────────────────────────────────────────

export interface CIPPTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

// ─── Generic Action Result ───────────────────────────────────────

export interface CIPPActionResult {
  Results?: string | string[];
  Metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Tenant Administration ───────────────────────────────────────

export interface CIPPTenant {
  customerId: string;
  defaultDomainName: string;
  displayName: string;
  domains?: string[];
  [key: string]: unknown;
}

export interface CIPPAlert {
  AlertType?: string;
  AlertId?: string;
  Tenant?: string;
  TenantId?: string;
  Message?: string;
  Severity?: string;
  EventType?: string;
  [key: string]: unknown;
}

export interface CIPPLicense {
  License: string;
  CountUsed: number;
  CountAvailable: number;
  TotalLicenses: number;
  SkuId: string;
  SkuPartNumber: string;
  Tenant?: string;
  [key: string]: unknown;
}

export interface CIPPCSPLicense {
  License: string;
  Tenant: string;
  TenantId?: string;
  SubscriptionId?: string;
  Status?: string;
  Quantity?: number;
  BillingCycle?: string;
  RenewalDate?: string;
  [key: string]: unknown;
}

export interface CIPPCSPSku {
  SkuId: string;
  SkuPartNumber: string;
  DisplayName?: string;
  [key: string]: unknown;
}

export interface CIPPAuditLog {
  Timestamp: string;
  Tenant: string;
  Title?: string;
  User?: string;
  Action?: string;
  LogId?: string;
  Actions?: string;
  [key: string]: unknown;
}

export interface CIPPBackup {
  BackupName: string;
  Timestamp: string;
  BackupData?: unknown;
  [key: string]: unknown;
}

export interface CIPPGDAPRole {
  GroupId?: string;
  GroupName?: string;
  RoleName?: string;
  RoleDefinitionId?: string;
  [key: string]: unknown;
}

export interface CIPPGDAPRoleTemplate {
  TemplateId?: string;
  RoleMappings?: CIPPGDAPRole[];
  [key: string]: unknown;
}

// ─── Identity Management ─────────────────────────────────────────

export interface CIPPUser {
  id?: string;
  userPrincipalName: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  accountEnabled?: boolean;
  assignedLicenses?: Array<{ skuId: string; [key: string]: unknown }>;
  onPremisesSyncEnabled?: boolean;
  createdDateTime?: string;
  lastSignInDateTime?: string;
  jobTitle?: string;
  department?: string;
  usageLocation?: string;
  [key: string]: unknown;
}

export interface CIPPAddUserInput {
  tenantFilter: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mailNickname?: string;
  userPrincipalName?: string;
  primDomain?: string;
  usageLocation?: string;
  password?: string;
  autoPassword?: boolean;
  mustChangePass?: boolean;
  licenses?: string[];
  [key: string]: unknown;
}

export interface CIPPGroup {
  id: string;
  displayName: string;
  description?: string;
  groupTypes?: string[];
  mailEnabled?: boolean;
  securityEnabled?: boolean;
  mail?: string;
  membershipRule?: string;
  memberCount?: number;
  [key: string]: unknown;
}

export interface CIPPAddGroupInput {
  tenantFilter: string;
  displayName: string;
  description?: string;
  groupType: string;
  mailEnabled?: boolean;
  [key: string]: unknown;
}

export interface CIPPEditGroupInput {
  groupId: string;
  AddMember?: string;
  RemoveMember?: string;
  AddOwner?: string;
  RemoveOwner?: string;
  [key: string]: unknown;
}

export interface CIPPMFAUser {
  UPN: string;
  AccountEnabled: boolean;
  MFARegistration: boolean;
  CoveredByCA: boolean;
  CoveredBySD: boolean;
  PerUser: string;
  [key: string]: unknown;
}

export interface CIPPSignIn {
  createdDateTime: string;
  userPrincipalName: string;
  userDisplayName?: string;
  appDisplayName: string;
  clientAppUsed?: string;
  ipAddress: string;
  location?: {
    city?: string;
    state?: string;
    countryOrRegion?: string;
  };
  status?: {
    errorCode: number;
    failureReason?: string;
    additionalDetails?: string;
  };
  conditionalAccessStatus?: string;
  isInteractive?: boolean;
  riskDetail?: string;
  riskLevelAggregated?: string;
  [key: string]: unknown;
}

export interface CIPPRole {
  displayName: string;
  id: string;
  description?: string;
  Members?: CIPPUser[];
  [key: string]: unknown;
}

export interface CIPPInactiveAccount {
  UPN: string;
  displayName: string;
  LastSignIn?: string;
  DaysSinceLastSignIn?: number;
  accountEnabled?: boolean;
  [key: string]: unknown;
}

export interface CIPPOffboardOptions {
  convertToShared?: boolean;
  removeFromGroups?: boolean;
  hideFromGAL?: boolean;
  disableUser?: boolean;
  revokeAccess?: boolean;
  forwardTo?: string;
  oooMessage?: string;
  removelicenses?: boolean;
  removeMobileDevices?: boolean;
  removeRules?: boolean;
  keepCopy?: boolean;
  Scheduled?: {
    date?: string;
    time?: string;
  };
  [key: string]: unknown;
}

export interface CIPPDeletedItem {
  id: string;
  displayName: string;
  deletedDateTime?: string;
  [key: string]: unknown;
}

// ─── Security & Compliance ───────────────────────────────────────

export interface CIPPDefenderState {
  Tenant?: string;
  DeviceName?: string;
  MalwareProtectionEnabled?: boolean;
  RealTimeProtectionEnabled?: boolean;
  IsVirtualMachine?: boolean;
  ScanOverdue?: boolean;
  lastReportedDateTime?: string;
  [key: string]: unknown;
}

export interface CIPPDefenderTVM {
  affectedDeviceCount?: number;
  osPlatform?: string;
  softwareVendor?: string;
  softwareName?: string;
  severity?: string;
  cvssScore?: number;
  cveId?: string;
  [key: string]: unknown;
}

export interface CIPPSecurityAlert {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdDateTime: string;
  category?: string;
  description?: string;
  tenantId?: string;
  userStates?: Array<{
    userPrincipalName?: string;
    [key: string]: unknown;
  }>;
  vendorInformation?: {
    provider?: string;
    vendor?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CIPPSecurityIncident {
  id: string;
  displayName: string;
  severity: string;
  status: string;
  createdDateTime: string;
  lastUpdateDateTime?: string;
  incidentWebUrl?: string;
  assignedTo?: string;
  classification?: string;
  determination?: string;
  tags?: string[];
  [key: string]: unknown;
}

// ─── Intune ──────────────────────────────────────────────────────

export interface CIPPIntuneDevice {
  id: string;
  deviceName: string;
  managedDeviceOwnerType?: string;
  operatingSystem?: string;
  osVersion?: string;
  complianceState?: string;
  lastSyncDateTime?: string;
  userPrincipalName?: string;
  userDisplayName?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  enrolledDateTime?: string;
  isEncrypted?: boolean;
  managementAgent?: string;
  [key: string]: unknown;
}

export interface CIPPAutopilotDevice {
  id: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  groupTag?: string;
  enrollmentState?: string;
  displayName?: string;
  purchaseOrderIdentifier?: string;
  [key: string]: unknown;
}

export interface CIPPIntuneApp {
  id: string;
  displayName: string;
  publisher?: string;
  publishingState?: string;
  installCommandLine?: string;
  uninstallCommandLine?: string;
  [key: string]: unknown;
}

export interface CIPPIntunePolicy {
  id: string;
  displayName: string;
  description?: string;
  lastModifiedDateTime?: string;
  [key: string]: unknown;
}

export interface CIPPAutopilotConfig {
  id: string;
  displayName: string;
  description?: string;
  [key: string]: unknown;
}

// ─── Teams & SharePoint ──────────────────────────────────────────

export interface CIPPTeam {
  id: string;
  displayName: string;
  description?: string;
  visibility?: string;
  memberCount?: number;
  [key: string]: unknown;
}

export interface CIPPTeamsActivity {
  userPrincipalName?: string;
  lastActivityDate?: string;
  teamChatMessageCount?: number;
  privateChatMessageCount?: number;
  callCount?: number;
  meetingCount?: number;
  [key: string]: unknown;
}

export interface CIPPTeamsVoice {
  userPrincipalName?: string;
  lineUri?: string;
  assignedPlan?: string;
  [key: string]: unknown;
}

export interface CIPPSharePointSite {
  url: string;
  displayName: string;
  storageUsed?: number;
  storageAllocated?: number;
  ownerDisplayName?: string;
  lastActivityDate?: string;
  [key: string]: unknown;
}

// ─── CIPP Platform ───────────────────────────────────────────────

export interface CIPPScheduledItem {
  RowKey: string;
  Name: string;
  Command?: Record<string, unknown>;
  Parameters?: Record<string, unknown>;
  Recurrence?: string;
  ScheduledTime?: string;
  Timestamp?: string;
  [key: string]: unknown;
}

export interface CIPPLog {
  DateTime: string;
  Tenant: string;
  Message: string;
  API?: string;
  SeverityText?: string;
  Username?: string;
  [key: string]: unknown;
}

export interface CIPPExtensionConfig {
  [key: string]: unknown;
}

export interface CIPPPasswordConfig {
  passwordType?: "Classic" | "Correct-Battery-Horse";
  [key: string]: unknown;
}

// ─── Graph API ───────────────────────────────────────────────────

export interface CIPPGraphRequest {
  Endpoint: string;
  $select?: string;
  $filter?: string;
  $top?: number;
  $orderby?: string;
  $count?: boolean;
}
