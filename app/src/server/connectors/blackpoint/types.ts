/**
 * Blackpoint CompassOne API types — raw vendor response interfaces.
 *
 * Derived from OpenAPI spec v1.4.0 (https://api.blackpointcyber.com)
 * Prefixes match Blackpoint's internal service boundaries:
 *   AM_ = Alert Management (detections)
 *   CR_ = CRAFT (assets, vulnerabilities, scans, collections)
 *   CC_ = Cloud Center (M365, Google, Cisco MDR)
 *   ES_ = Event Signal (notification channels)
 *   TE_ = Tenant Engine (accounts, tenants, users, contacts)
 */

// ---------------------------------------------------------------------------
// Common / Pagination
// ---------------------------------------------------------------------------

/** Standard skip/take paginated response from most Blackpoint endpoints */
export interface BPPaginatedResponse<T> {
  take?: number;
  skip?: number;
  items: T[];
  start: number;
  end: number;
  total: number;
}

/** Page-based pagination (used by TE_ user endpoints) */
export interface BPPageMeta {
  currentPage: number;
  totalItems: number;
  totalPages: number;
  pageSize: number;
}

export interface BPPagePaginatedResponse<T> {
  data: T[];
  meta: BPPageMeta;
}

/** Data-only response (used by ES_ notification endpoints) */
export interface BPDataResponse<T> {
  data: T[];
}

// ---------------------------------------------------------------------------
// Alert Management — Detections
// ---------------------------------------------------------------------------

export type BPAlertStatus = "OPEN" | "RESOLVED";
export type BPDetectionType = "CR" | "MDR";

export type BPTicketStatus =
  | "CLAIM"
  | "CLOSE"
  | "ESCALATE"
  | "INFORMATIONAL"
  | "INVESTIGATE"
  | "NEW"
  | "NO_AGENT"
  | "RESOLVE"
  | "SUGGEST_SUPPRESSION";

export interface BPTicketStatusHistory {
  status: BPTicketStatus;
  created: string;
}

export interface BPDetectionTicket {
  status: BPTicketStatus;
  notes?: BPTicketStatusHistory[];
  created: string;
}

export interface BPAlertGroup {
  id: string;
  customerId: string;
  groupKey: string;
  riskScore: number;
  alertCount: number;
  alertTypes: string[];
  status: BPAlertStatus;
  ticketId: string;
  ticket?: BPDetectionTicket;
  alert?: BPAlert | null;
  created: string;
  updated?: string | null;
}

export interface BPAlert {
  id: string;
  customerId: string;
  documentId: string;
  eventId: string | null;
  updatedBy: string | null;
  riskScore: number;
  alertGroupId: string;
  alertGroup?: BPAlertGroupFull;
  dataset: string | null;
  action: string | null;
  eventProvider: string | null;
  username: string | null;
  hostname: string | null;
  deviceId: string | null;
  ruleName: string | null;
  threatFramework: string | null;
  details?: Record<string, unknown> | null;
  anomalyBinary?: number | null;
  anomalyPercentile?: number | null;
  trafficLight?: Record<string, unknown> | null;
  reasons?: Array<Record<string, unknown>> | null;
  socReportingActions?: Array<Record<string, unknown>> | null;
  aiIngestionDate?: string | null;
  created: string;
  updated?: string | null;
}

export interface BPAlertGroupFull {
  id: string;
  customerId: string;
  groupKey: string;
  riskScore: number;
  alertCount: number;
  alerts?: BPAlert[];
  alertTypes: string[];
  status: BPAlertStatus;
  ticketId: string;
  ticket?: BPDetectionTicket;
  created: string;
  updated?: string | null;
}

export interface BPAlertGroupCount {
  count: number;
}

export interface BPAlertGroupsByWeek {
  date: string;
  count: number;
}

export interface BPTopDetectionsByEntity {
  count: number;
  name: string;
}

export interface BPTopDetectionsByThreat {
  count: number;
  name: string;
  percentage: number;
}

// ---------------------------------------------------------------------------
// CRAFT — Assets
// ---------------------------------------------------------------------------

export interface BPAssetTag {
  id: string;
  name: string;
}

export interface BPAssetSource {
  id: string;
  displayName?: string | null;
  name: string;
  type?: string | null;
  externalId?: string | null;
}

/** Base fields shared by all asset classes */
export interface BPAssetBase {
  id: string;
  assetClass: string;
  classification?: string | null;
  description?: string | null;
  displayName?: string | null;
  name: string;
  notes?: string | null;
  production?: boolean | null;
  type?: string | null;
  accountId?: string | null;
  createdBy?: string | null;
  createdOn: string;
  criticality?: number | null;
  tenantId: string;
  deletedBy?: string | null;
  deletedOn?: string | null;
  foundBy?: string | null;
  foundOn: string;
  lastSeenBy?: string | null;
  lastSeenOn: string;
  updatedBy?: string | null;
  model: string;
  summary?: string | null;
  status?: string | null;
  updatedOn?: string | null;
  tags: BPAssetTag[];
  sources?: BPAssetSource[];
}

export interface BPDevice extends BPAssetBase {
  assetClass: "DEVICE";
  byod?: boolean | null;
  encrypted?: boolean | null;
  fqdns?: string[] | null;
  hardwareModel?: string | null;
  hardwareVendor?: string | null;
  hardwareVersion?: string | null;
  hostname?: string | null;
  platform?: string | null;
  osIsEol?: boolean | null;
  osName?: string | null;
  osDetails?: string | null;
  osVersion?: string | null;
  ips?: string[] | null;
  macs?: string[] | null;
  osUpdatesEnabled?: boolean | null;
  windowsDefenderEnabled?: boolean | null;
  malwareProtected?: boolean | null;
  publicIps?: string[] | null;
  hardwareSerial?: string | null;
  location?: string | null;
  firewallEnabled?: boolean | null;
  remoteAccessEnabled?: boolean | null;
  screenLockEnabled?: boolean | null;
  screenLockTimeout?: number | null;
  agentLastSeenOn?: string | null;
  agentDeactivatedOn?: string | null;
  agentDeactivated?: boolean | null;
  severity?: string | null;
  agentVersion?: string | null;
}

export interface BPContainer extends BPAssetBase {
  assetClass: "CONTAINER";
  command?: string | null;
  containerId?: string | null;
  ports?: string[] | null;
  imageTag?: string | null;
  image?: string | null;
  startedOn?: string | null;
}

export interface BPFramework extends BPAssetBase {
  assetClass: "FRAMEWORK";
  compliance?: boolean | null;
  security?: boolean | null;
}

/** Union of all asset types — the API returns a polymorphic list */
export type BPAsset = BPDevice | BPContainer | BPFramework | BPAssetBase;

export interface BPAssetRelationship {
  id: string;
  status: string;
  type: string;
  verb: string;
  asset: BPAssetBase;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// CRAFT — Collections
// ---------------------------------------------------------------------------

export type BPCollectionContext =
  | "ASSET" | "FINDING" | "CONTAINER" | "DEVICE" | "FRAMEWORK"
  | "NETSTAT" | "PERSON" | "PROCESS" | "SERVICE" | "SOFTWARE"
  | "SOURCE" | "SURVEY" | "USER" | "ALERT" | "ALERTGROUP"
  | "EVENT" | "INCIDENT" | "VULNERABILITY";

export interface BPCollection {
  id: string;
  context: BPCollectionContext;
  createdBy?: string | null;
  createdOn: string;
  name: string;
  search: string;
  updatedBy?: string | null;
  updatedOn?: string | null;
  userId: string;
}

export interface BPCollectionCreateInput {
  context: BPCollectionContext;
  name: string;
  search: string;
}

export interface BPCollectionUpdateInput {
  name?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// CRAFT — Vulnerability Management
// ---------------------------------------------------------------------------

export type BPScanType = "darkweb" | "external" | "local" | "network";
export type BPScanStatus = "canceled" | "completed" | "failed" | "in-progress" | "new";
export type BPScanScheduleStatus = "active" | "completed" | "disabled";
export type BPScanFrequency = "daily" | "monthly" | "once" | "weekly";
export type BPScanAndScheduleStatus = "active" | "completed" | "disabled" | "canceled" | "failed" | "in-progress" | "new";

export interface BPVulnerability {
  id: string;
  findingClass: "VULNERABILITY";
  exploitability?: "Attacked" | "Unreported" | null;
  accountId: string;
  active?: boolean | null;
  assetEnvironmentalScore?: number | null;
  assetsAmount?: number | null;
  baseScore?: number | null;
  classification?: string | null;
  criticality?: number | null;
  cveId?: string | null;
  cvssInfo?: string[] | null;
  description?: string | null;
  displayName?: string | null;
  foundBy?: string | null;
  foundOn: string;
  lastSeenBy?: string | null;
  lastSeenOn: string;
  model: string;
  name: string;
  notes?: string | null;
  prioritized?: boolean | null;
  priorityAssetsAmount?: number | null;
  production?: boolean | null;
  references?: Array<Record<string, unknown>> | null;
  severity?: string | null;
  solution?: string | null;
  solutionApprovalStatus?: string | null;
  solutionSource?: string | null;
  solutionUrl?: string | null;
  status?: string | null;
  summary?: string | null;
  tenantId: string;
  type?: string | null;
  vectorString?: string | null;
  applicationFamily?: string | null;
  applicationName?: string | null;
  applicationVendor?: string | null;
  [key: string]: unknown;
}

export interface BPCveReference {
  name?: string | null;
  tags?: string | null;
  url?: string | null;
}

export interface BPScan {
  id: string;
  accountId: string;
  createdBy?: string | null;
  createdOn: string;
  tenantId: string;
  deletedBy?: string | null;
  deletedOn?: string | null;
  updatedBy?: string | null;
  updatedOn?: string | null;
  type: BPScanType;
  config?: Record<string, unknown>;
  result?: Record<string, unknown>;
  assetId?: string | null;
  triggeredByType: "schedule" | "system" | "user";
  triggeredBy?: string | null;
  status: BPScanStatus;
  triggeredByName?: string | null;
}

export interface BPScanSchedule {
  id: string;
  accountId: string;
  createdBy?: string | null;
  createdOn: string;
  tenantId: string;
  deletedBy?: string | null;
  deletedOn?: string | null;
  updatedBy?: string | null;
  updatedOn?: string | null;
  type: BPScanType;
  config?: Record<string, unknown>;
  assetId?: string | null;
  status: BPScanScheduleStatus;
  time: string;
  frequency: BPScanFrequency;
  frequencyConfig?: Record<string, unknown>;
  name: string;
  jobKey?: string | null;
}

export interface BPScanAndSchedule {
  status: BPScanAndScheduleStatus;
  sourceTable: "scan" | "scanschedule";
  id: string;
  accountId: string;
  createdBy?: string | null;
  createdOn: string;
  tenantId: string;
  updatedOn?: string | null;
  time: string;
  frequency: string;
  frequencyConfig?: Record<string, unknown>;
  name: string;
  type: BPScanType;
  scansCount?: number;
}

export interface BPScanCreateInput {
  type: BPScanType;
  config?: Record<string, unknown>;
  assetId?: string;
  tenantId: string;
}

export interface BPScanScheduleCreateInput {
  type: BPScanType;
  config?: Record<string, unknown>;
  assetId?: string;
  tenantId: string;
  time: string;
  frequency: BPScanFrequency;
  frequencyConfig?: Record<string, unknown>;
  name: string;
}

export interface BPSeverityCount {
  severity: string;
  count: number;
}

export interface BPTenantVulnCount {
  tenantId: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Cloud MDR — M365
// ---------------------------------------------------------------------------

export interface BPIsoCountry {
  code: string;
  name?: string;
}

export interface BPMs365Connection {
  id: string;
  [key: string]: unknown;
}

export interface BPMs365User {
  id: string;
  email: string;
  customerId: string;
  enabled: boolean;
  licensed: boolean;
  billable?: boolean;
  name: string;
  ms365DefensePackageId: string;
  authorizedCountries?: BPMs365UserIsoCountry[];
  created: string;
  updated?: string | null;
  deleted?: string | null;
}

export interface BPMs365UserIsoCountry {
  id: string;
  isoCountryCode: string;
  ms365DefenseUserId: string;
  isoCountry: BPIsoCountry;
  startDate?: string | null;
  endDate?: string | null;
  created: string;
  updated?: string | null;
  deleted?: string | null;
}

export interface BPConnectionApprovedCountry {
  id: string;
  isoCountry: BPIsoCountry;
  created: string;
}

export interface BPConnectionUser {
  id: string;
  name?: string;
  email?: string;
  activeApprovedCountries: BPConnectionUserApprovedCountry[];
  upcomingApprovedCountries: BPConnectionUserApprovedCountry[];
}

export interface BPConnectionUserApprovedCountry {
  id: string;
  connectionUserId: string;
  isoCountry: BPIsoCountry;
  created: string;
  endDate?: string;
  startDate?: string;
}

// ---------------------------------------------------------------------------
// Cloud MDR — Google
// ---------------------------------------------------------------------------

export interface BPGoogleOnboarding {
  id: string;
  created: string;
  connectionId?: string;
  error?: string;
  state: string;
  config: {
    redirectPath: string;
    domain: string;
  };
  consentUrl?: string;
  domainWideDelegation?: {
    link: string;
    scopes: string;
    clientId: string;
  };
}

// ---------------------------------------------------------------------------
// Cloud MDR — Cisco Duo
// ---------------------------------------------------------------------------

export interface BPCiscoDuoOnboarding {
  id: string;
  created: string;
  connectionId?: string;
  onboardingId?: string;
  error?: string;
  state: string;
  config: {
    domain: string;
  };
}

export interface BPCiscoDuoOnboardingCreateInput {
  host?: string;
  ikey?: string;
  skey?: string;
}

// ---------------------------------------------------------------------------
// Event Signal — Notification Channels
// ---------------------------------------------------------------------------

export interface BPChannel {
  id: string;
  name: string;
  enabled: boolean;
  accountId: string;
  tenantId?: string | null;
  created: string;
  updated?: string | null;
}

export interface BPEmailChannel extends BPChannel {
  emails: string[];
}

export interface BPEmailChannelCreateInput {
  emails: string[];
  name: string;
  enabled: boolean;
  accountId: string;
  tenantId?: string;
}

export interface BPEmailChannelUpdateInput {
  emails?: string[];
  name?: string;
  enabled?: boolean;
}

export interface BPWebhookChannel extends BPChannel {
  url: string;
  apiSecretNameHeader: string;
  headers: Record<string, unknown>;
}

export interface BPWebhookChannelCreateInput {
  name: string;
  enabled: boolean;
  accountId: string;
  tenantId?: string;
  url: string;
  apiSecretNameHeader: string;
  headers: Record<string, unknown>;
}

export interface BPWebhookChannelUpdateInput {
  name?: string;
  enabled?: boolean;
  url?: string;
  apiSecretNameHeader?: string;
  headers?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tenant Engine — Accounts & Tenants
// ---------------------------------------------------------------------------

export interface BPAccount {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface BPTenant {
  id: string;
  name: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tenant Engine — Users
// ---------------------------------------------------------------------------

export type BPRbacRole =
  | "AccountAdmin" | "AccountBillingAbility" | "AccountUser"
  | "BlackpointAdmin" | "BlackpointSuperAdmin" | "BlackpointUser"
  | "CustomerAdmin" | "CustomerUser";

export interface BPUser {
  id: string;
  email: string;
  name: string;
  billingAccess: boolean;
  roles: BPRbacRole[];
  assignedAccounts?: Array<{ id: string; name: string }>;
  assignedTenants?: Array<{ id: string; name: string }>;
}

export interface BPTenantUser extends BPUser {
  accessType: "Direct" | "Inherited";
}

export interface BPUserInviteInput {
  name: string;
  email: string;
  roles?: BPRbacRole[];
  tenantIdsToAssign?: string[];
}

export interface BPUserUpdateInput {
  name: string;
  roles: BPRbacRole[];
  tenantIdsToAssign: string[];
}

// ---------------------------------------------------------------------------
// Tenant Engine — Contact Groups
// ---------------------------------------------------------------------------

export type BPContactGroupType = "Informational" | "Urgent" | "Urgent & Informational";
export type BPContactGroupMemberAvailability = "After Hours" | "All Hours" | "Business Hours";

export interface BPContactGroup {
  id: string;
  name: string;
  type: BPContactGroupType;
  accountId: string;
  [key: string]: unknown;
}

export interface BPContactGroupCreateInput {
  name: string;
  type: BPContactGroupType;
}

export interface BPContactGroupMember {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  availability?: BPContactGroupMemberAvailability;
  [key: string]: unknown;
}

export interface BPContactGroupMemberCreateInput {
  name: string;
  email?: string;
  phone?: string;
  availability?: BPContactGroupMemberAvailability;
}
