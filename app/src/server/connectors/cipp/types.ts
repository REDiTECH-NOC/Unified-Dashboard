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

// ─── Tenant Details ─────────────────────────────────────────────

export interface CIPPTenantDetail {
  displayName?: string;
  defaultDomainName?: string;
  id?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  state?: string;
  street?: string;
  technicalNotificationMails?: string[];
  onPremisesSyncEnabled?: boolean;
  directorySizeQuota?: {
    used?: number;
    total?: number;
  };
  verifiedDomains?: Array<{
    name: string;
    type: string;
    capabilities: string;
    isDefault: boolean;
    isInitial: boolean;
    isVerified: boolean;
  }>;
  assignedPlans?: Array<{
    assignedDateTime: string;
    capabilityStatus: string;
    service: string;
    servicePlanId: string;
  }>;
  [key: string]: unknown;
}

export interface CIPPDomain {
  id: string;
  authenticationType?: string;
  isDefault?: boolean;
  isInitial?: boolean;
  isVerified?: boolean;
  [key: string]: unknown;
}

export interface CIPPPartnerRelationship {
  id: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface CIPPTenantOnboarding {
  Relationship?: Record<string, unknown>;
  Tenant?: Record<string, unknown>;
  Steps?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

// ─── User Details ───────────────────────────────────────────────

export interface CIPPUserCount {
  Tenant?: string;
  TotalUsers?: number;
  Licensed?: number;
  Guests?: number;
  GlobalAdmins?: number;
  [key: string]: unknown;
}

export interface CIPPUserDevice {
  id?: string;
  displayName?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  trustType?: string;
  isCompliant?: boolean;
  isManaged?: boolean;
  approximateLastSignInDateTime?: string;
  [key: string]: unknown;
}

export interface CIPPMailboxDetail {
  ExchangeGuid?: string;
  RecipientType?: string;
  RecipientTypeDetails?: string;
  PrimarySmtpAddress?: string;
  Alias?: string;
  ProhibitSendQuota?: string;
  ProhibitSendReceiveQuota?: string;
  TotalItemSize?: string;
  ItemCount?: number;
  ArchiveStatus?: string;
  ForwardingAddress?: string;
  ForwardingSmtpAddress?: string;
  DeliverToMailboxAndForward?: boolean;
  [key: string]: unknown;
}

export interface CIPPMailboxRule {
  Name?: string;
  Description?: string;
  Enabled?: boolean;
  Priority?: number;
  ForwardTo?: string;
  RedirectTo?: string;
  DeleteMessage?: boolean;
  [key: string]: unknown;
}

export interface CIPPBECResult {
  Results?: string | string[];
  SuspectUser?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Conditional Access ─────────────────────────────────────────

export interface CIPPConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  conditions?: Record<string, unknown>;
  grantControls?: Record<string, unknown>;
  sessionControls?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CIPPCATemplate {
  id?: string;
  GUID?: string;
  displayName?: string;
  state?: string;
  [key: string]: unknown;
}

export interface CIPPNamedLocation {
  id: string;
  displayName: string;
  createdDateTime?: string;
  modifiedDateTime?: string;
  isTrusted?: boolean;
  ipRanges?: Array<{
    cidrAddress: string;
  }>;
  countriesAndRegions?: string[];
  [key: string]: unknown;
}

// ─── Standards & BPA ────────────────────────────────────────────

export interface CIPPStandard {
  displayName?: string;
  StandardName?: string;
  Settings?: Record<string, unknown>;
  AppliedBy?: string;
  [key: string]: unknown;
}

export interface CIPPBPAResult {
  Tenant?: string;
  GUID?: string;
  Data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CIPPTenantAlignment {
  Tenant?: string;
  Standards?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CIPPDomainHealth {
  Domain?: string;
  MX?: Record<string, unknown>;
  SPF?: Record<string, unknown>;
  DKIM?: Record<string, unknown>;
  DMARC?: Record<string, unknown>;
  DNSSEC?: Record<string, unknown>;
  Score?: number;
  [key: string]: unknown;
}

export interface CIPPStandardTemplate {
  GUID?: string;
  templateName?: string;
  standards?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CIPPBPATemplate {
  GUID?: string;
  Name?: string;
  Style?: string;
  Fields?: unknown[];
  [key: string]: unknown;
}

// ─── Email & Exchange ───────────────────────────────────────────

export interface CIPPMailbox {
  ExchangeGuid?: string;
  UserPrincipalName?: string;
  DisplayName?: string;
  PrimarySmtpAddress?: string;
  RecipientType?: string;
  RecipientTypeDetails?: string;
  [key: string]: unknown;
}

export interface CIPPMailboxStatistic {
  UserPrincipalName?: string;
  DisplayName?: string;
  TotalItemSize?: string;
  ItemCount?: number;
  DeletedItemCount?: number;
  [key: string]: unknown;
}

export interface CIPPMailboxCAS {
  PrimarySmtpAddress?: string;
  ActiveSyncEnabled?: boolean;
  OWAEnabled?: boolean;
  PopEnabled?: boolean;
  ImapEnabled?: boolean;
  MAPIEnabled?: boolean;
  EwsEnabled?: boolean;
  [key: string]: unknown;
}

export interface CIPPMailboxPermission {
  Identity?: string;
  User?: string;
  AccessRights?: string[];
  [key: string]: unknown;
}

export interface CIPPCalendarPermission {
  FolderName?: string;
  User?: string;
  AccessRights?: string[];
  [key: string]: unknown;
}

export interface CIPPOutOfOffice {
  UserPrincipalName?: string;
  AutoReplyState?: string;
  InternalMessage?: string;
  ExternalMessage?: string;
  StartTime?: string;
  EndTime?: string;
  [key: string]: unknown;
}

export interface CIPPRestrictedUser {
  UserPrincipalName?: string;
  BlockType?: string;
  WhenChanged?: string;
  [key: string]: unknown;
}

export interface CIPPMessageTrace {
  MessageId?: string;
  SenderAddress?: string;
  RecipientAddress?: string;
  Subject?: string;
  Status?: string;
  Received?: string;
  Size?: number;
  [key: string]: unknown;
}

export interface CIPPMailQuarantineItem {
  Identity?: string;
  SenderAddress?: string;
  RecipientAddress?: string[];
  Subject?: string;
  Type?: string;
  Expires?: string;
  QuarantineTypes?: string;
  Released?: boolean;
  [key: string]: unknown;
}

export interface CIPPContact {
  DisplayName?: string;
  EmailAddress?: string;
  ExternalEmailAddress?: string;
  [key: string]: unknown;
}

export interface CIPPSpamFilter {
  Identity?: string;
  Name?: string;
  IsDefault?: boolean;
  Priority?: number;
  BulkThreshold?: number;
  SpamAction?: string;
  HighConfidenceSpamAction?: string;
  PhishSpamAction?: string;
  [key: string]: unknown;
}

export interface CIPPSpamFilterTemplate {
  GUID?: string;
  name?: string;
  [key: string]: unknown;
}

export interface CIPPAntiPhishingFilter {
  Identity?: string;
  Name?: string;
  Enabled?: boolean;
  IsDefault?: boolean;
  [key: string]: unknown;
}

export interface CIPPConnectionFilter {
  Identity?: string;
  Name?: string;
  IPAllowList?: string[];
  IPBlockList?: string[];
  EnableSafeList?: boolean;
  [key: string]: unknown;
}

export interface CIPPTenantAllowBlockItem {
  ListSubType?: string;
  Value?: string;
  Action?: string;
  ExpirationDate?: string;
  [key: string]: unknown;
}

export interface CIPPQuarantinePolicy {
  QuarantinePolicyType?: string;
  EndUserQuarantinePermissionsValue?: number;
  [key: string]: unknown;
}

export interface CIPPTransportRule {
  Identity?: string;
  Name?: string;
  Priority?: number;
  State?: string;
  Mode?: string;
  [key: string]: unknown;
}

export interface CIPPTransportRuleTemplate {
  GUID?: string;
  name?: string;
  [key: string]: unknown;
}

export interface CIPPExchangeConnector {
  Identity?: string;
  Name?: string;
  ConnectorType?: string;
  ConnectorSource?: string;
  Enabled?: boolean;
  [key: string]: unknown;
}

export interface CIPPExConnectorTemplate {
  GUID?: string;
  name?: string;
  cippconnectortype?: string;
  [key: string]: unknown;
}

export interface CIPPMailboxMobileDevice {
  DeviceId?: string;
  DeviceType?: string;
  DeviceOS?: string;
  DeviceModel?: string;
  FirstSyncTime?: string;
  LastSyncAttemptTime?: string;
  [key: string]: unknown;
}

// ─── Additional Intune ──────────────────────────────────────────

export interface CIPPDeviceComplianceDetail {
  Tenant?: string;
  DeviceName?: string;
  ComplianceState?: string;
  UserPrincipalName?: string;
  [key: string]: unknown;
}

export interface CIPPIntuneIntent {
  id: string;
  displayName?: string;
  description?: string;
  templateId?: string;
  lastModifiedDateTime?: string;
  [key: string]: unknown;
}

export interface CIPPIntuneTemplate {
  GUID?: string;
  displayName?: string;
  Type?: string;
  [key: string]: unknown;
}

export interface CIPPAssignmentFilter {
  id?: string;
  displayName?: string;
  platform?: string;
  rule?: string;
  [key: string]: unknown;
}

export interface CIPPAssignmentFilterTemplate {
  GUID?: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface CIPPAppStatus {
  AppName?: string;
  InstalledCount?: number;
  FailedCount?: number;
  PendingCount?: number;
  [key: string]: unknown;
}

export interface CIPPIntuneScript {
  id?: string;
  displayName?: string;
  description?: string;
  runAsAccount?: string;
  [key: string]: unknown;
}

// ─── Teams & SharePoint Additional ──────────────────────────────

export interface CIPPTeamsLisLocation {
  CivicAddress?: string;
  Location?: string;
  [key: string]: unknown;
}

export interface CIPPSharePointQuota {
  StorageUsed?: number;
  StorageAllocated?: number;
  [key: string]: unknown;
}

export interface CIPPSharePointSettings {
  SharingCapability?: string;
  DefaultSharingLinkType?: string;
  [key: string]: unknown;
}

export interface CIPPOneDriveItem {
  UPN?: string;
  displayName?: string;
  CurrentUsage?: string;
  LastActive?: string;
  FileCount?: number;
  [key: string]: unknown;
}

// ─── Security & Compliance Additional ───────────────────────────

export interface CIPPBreachResult {
  Name?: string;
  Title?: string;
  Domain?: string;
  BreachDate?: string;
  DataClasses?: string[];
  [key: string]: unknown;
}

export interface CIPPPhishPolicy {
  Identity?: string;
  Name?: string;
  Enabled?: boolean;
  [key: string]: unknown;
}

export interface CIPPSafeLinkFilter {
  Identity?: string;
  Name?: string;
  IsEnabled?: boolean;
  ScanUrls?: boolean;
  [key: string]: unknown;
}

export interface CIPPSafeAttachmentFilter {
  Identity?: string;
  Name?: string;
  Enable?: boolean;
  Action?: string;
  [key: string]: unknown;
}

// ─── GDAP ───────────────────────────────────────────────────────

export interface CIPPGDAPInvite {
  InviteUrl?: string;
  Relationship?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CIPPGDAPAccessAssignment {
  id?: string;
  status?: string;
  accessContainer?: Record<string, unknown>;
  accessDetails?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Service Health ─────────────────────────────────────────────

export interface CIPPServiceHealth {
  service?: string;
  status?: string;
  isResolved?: boolean;
  startDateTime?: string;
  endDateTime?: string;
  lastModifiedDateTime?: string;
  title?: string;
  id?: string;
  impactDescription?: string;
  classification?: string;
  feature?: string;
  featureGroup?: string;
  [key: string]: unknown;
}

// ─── Platform & Administration ──────────────────────────────────

export interface CIPPVersion {
  version?: string;
  branch?: string;
  [key: string]: unknown;
}

export interface CIPPQueueItem {
  RowKey?: string;
  PartitionKey?: string;
  Name?: string;
  Status?: string;
  TaskState?: string;
  [key: string]: unknown;
}

export interface CIPPNotificationConfig {
  logsToInclude?: string[];
  severity?: string[];
  email?: string;
  webhook?: string;
  onePerTenant?: boolean;
  sendtoIntegration?: boolean;
  [key: string]: unknown;
}

export interface CIPPTrustedIP {
  RowKey?: string;
  IPAddress?: string;
  Description?: string;
  [key: string]: unknown;
}

export interface CIPPCustomVariable {
  RowKey?: string;
  Name?: string;
  Value?: string;
  [key: string]: unknown;
}

export interface CIPPPendingWebhook {
  RowKey?: string;
  Tenant?: string;
  Type?: string;
  URL?: string;
  [key: string]: unknown;
}

export interface CIPPExcludedTenant {
  Name?: string;
  Date?: string;
  User?: string;
  [key: string]: unknown;
}

export interface CIPPExcludedLicense {
  GUID?: string;
  SKUName?: string;
  [key: string]: unknown;
}

// ─── Extensions ─────────────────────────────────────────────────

export interface CIPPExtensionMapping {
  [key: string]: unknown;
}

export interface CIPPExtensionSync {
  SyncType?: string;
  Tenant?: string;
  LastSync?: string;
  [key: string]: unknown;
}

export interface CIPPHaloClient {
  id?: number;
  name?: string;
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

export interface CIPPExoRequest {
  tenantFilter: string;
  cmdlet: string;
  cmdParams?: Record<string, unknown>;
  [key: string]: unknown;
}
