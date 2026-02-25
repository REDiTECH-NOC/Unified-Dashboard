/**
 * Check Point Harmony Email & Collaboration (Avanan) API response types.
 *
 * Covers both the standard Harmony Email API and the MSP SmartAPI.
 * Regional base URLs differ; the API shape is identical.
 */

// ── Response Envelope (wraps all responses) ──

export interface AvananResponseEnvelope {
  requestId: string;
  responseCode: number;
  responseText: string;
  additionalText?: string;
  recordsNumber: number;
  totalRecordsNumber: number;
  scrollId?: string;
}

export interface AvananResponse<T> {
  responseEnvelope: AvananResponseEnvelope;
  responseData: T[];
}

// ── Security Events ──

export interface AvananEventAction {
  actionType: string;
  createTime: string;
  relatedEntityId?: string;
}

export interface AvananAvailableAction {
  actionName: string;
  actionParameter?: string;
}

export interface AvananSecurityEvent {
  eventId: string;
  customerId: string;
  saas: string;
  entityId: string;
  state: string;
  type: string;
  confidenceIndicator: string;
  eventCreated: string;
  severity: string;
  description: string;
  data?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
  availableEventActions?: AvananAvailableAction[];
  actions?: AvananEventAction[];
}

// ── Secured Entities ──

export interface AvananEntityInfo {
  entityId: string;
  customerId: string;
  saas: string;
  saasEntityType: string;
  entityCreated?: string;
  entityModified?: string;
}

export interface AvananEmailPayload {
  subject?: string;
  received?: string;
  size?: number;
  emailLinks?: number;
  attachmentCount?: number;
  fromEmail?: string;
  recipients?: string[];
  toRecipients?: string[];
  ccRecipients?: string[];
  isRead?: boolean;
  isDeleted?: boolean;
  isIncoming?: boolean;
  internetMessageId?: string;
  spfResult?: string;
  dkimResult?: string;
  dmarcResult?: string;
  senderIp?: string;
  returnPath?: string;
}

export interface AvananSecurityResults {
  ap?: string;
  dlp?: string;
  clicktimeProtection?: string;
  shadowIt?: string;
  av?: string;
}

export interface AvananEntityActionRecord {
  actionType: string;
  createTime: string;
  actionBy?: string;
}

export interface AvananEntity {
  entityInfo: AvananEntityInfo;
  entityPayload: AvananEmailPayload;
  entitySecurityResults?: AvananSecurityResults;
  entityActions?: AvananEntityActionRecord[];
  entityAvailableActions?: AvananAvailableAction[];
}

// ── Action Requests ──

export interface AvananEventActionRequest {
  requestData: {
    eventIds: string[];
    eventActionName: string[];
    eventActionParam: string[];
  };
}

export interface AvananEntityActionRequest {
  requestData: {
    entityIds: string[];
    entityActionName: string[];
    entityActionParam: string[];
    scope?: string;
  };
}

// ── Action Responses ──

export interface AvananEventActionResult {
  eventId: string;
  entityId?: string;
  taskId: number;
}

export interface AvananEntityActionResult {
  entityId: string;
  taskId: number;
}

// ── Query Requests ──

export interface AvananEventQueryRequest {
  requestData: {
    eventTypes?: string[];
    eventStates?: string[];
    severities?: string[];
    saas?: string[];
    eventIds?: string[];
    confidenceIndicator?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
    scrollId?: string;
    scopes?: string[];
  };
}

export interface AvananEntityQueryRequest {
  requestData: {
    entityFilter?: {
      saas?: string;
      saasEntity?: string;
      startDate?: string;
      endDate?: string;
    };
    entityExtendedFilter?: Array<{
      saasAttrName: string;
      saasAttrOp: string;
      saasAttrValue: string;
    }>;
    scrollId?: string;
    scopes?: string[];
  };
}

// ── Exception Types ──

export interface AvananUrlExceptionRequest {
  requestData: {
    exception_type: string;
    exception_str: string;
    comment?: string;
    entity_type?: string;
    entity_id?: string;
    file_name?: string;
    created_by_email?: string;
    is_exclusive?: boolean;
  };
}

export type AvananExceptionType =
  | "hash"
  | "micro_hash"
  | "file_type"
  | "ppat_sender_name"
  | "allow_file_type"
  | "sender_email"
  | "whitelist"
  | "blacklist";

// ── Task Status (async action tracking) ──

export interface AvananTaskStatus {
  taskId: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: string;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
}

// ── MSP Tenant Management ──

export interface AvananMspTenant {
  tenantId: string;
  tenantName: string;
  scope: string;
  status: string;
  createdAt?: string;
  licenses?: AvananMspTenantLicense[];
  userCount?: number;
}

export interface AvananMspTenantLicense {
  licenseId: string;
  licenseName: string;
  quantity: number;
  status: string;
}

export interface AvananMspTenantCreateRequest {
  tenantName: string;
  adminEmail: string;
  licenses?: Array<{
    licenseId: string;
    quantity: number;
  }>;
}

export interface AvananMspTenantLicenseUpdate {
  licenses: Array<{
    licenseId: string;
    quantity: number;
  }>;
}

// ── MSP Licenses ──

export interface AvananMspLicense {
  licenseId: string;
  licenseName: string;
  description?: string;
  type: string;
}

export interface AvananMspAddOn {
  addOnId: string;
  addOnName: string;
  description?: string;
  compatibleLicenses?: string[];
}

// ── MSP Partners ──

export interface AvananMspPartner {
  partnerId: string;
  partnerName: string;
  status: string;
  createdAt?: string;
  tenantCount?: number;
}

export interface AvananMspPartnerCreateRequest {
  partnerName: string;
  adminEmail: string;
}

// ── MSP Users ──

export interface AvananMspUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  tenantId?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface AvananMspUserCreateRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
}

export interface AvananMspUserUpdateRequest {
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
}

// ── MSP Usage ──

export interface AvananMspUsageRecord {
  tenantId: string;
  tenantName: string;
  period: string;
  protectedUsers: number;
  scannedEmails: number;
  threats: number;
  quarantined: number;
}

// ── Exception Management (extended CRUD) ──

export interface AvananExceptionEntry {
  exc_id: string;
  exception_type: string;
  exception_str: string;
  comment?: string;
  created_by_email?: string;
  created_at?: string;
  is_exclusive?: boolean;
}

export interface AvananExceptionUpdateRequest {
  exception_str?: string;
  comment?: string;
  is_exclusive?: boolean;
}

// ── Auth ──

export interface AvananAuthRequest {
  clientId: string;
  accessKey: string;
}

export interface AvananAuthResponse {
  data: {
    token: string;
    expiresIn?: number;
  };
}

// ── MSP Scopes ──

export interface AvananScope {
  scope: string;
}

// ── Regional Base URLs ──

export const AVANAN_REGIONS: Record<string, { label: string; apiBase: string; authBase: string }> = {
  us: {
    label: "United States",
    apiBase: "https://cloudinfra-gw-us.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw-us.portal.checkpoint.com",
  },
  eu: {
    label: "Europe",
    apiBase: "https://cloudinfra-gw.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.portal.checkpoint.com",
  },
  ca: {
    label: "Canada",
    apiBase: "https://cloudinfra-gw.ca.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.ca.portal.checkpoint.com",
  },
  au: {
    label: "Australia",
    apiBase: "https://cloudinfra-gw.ap.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.ap.portal.checkpoint.com",
  },
  uk: {
    label: "United Kingdom",
    apiBase: "https://cloudinfra-gw.uk.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.uk.portal.checkpoint.com",
  },
  uae: {
    label: "UAE",
    apiBase: "https://cloudinfra-gw.me.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.me.portal.checkpoint.com",
  },
  in: {
    label: "India",
    apiBase: "https://cloudinfra-gw.in.portal.checkpoint.com/app/hec-api",
    authBase: "https://cloudinfra-gw.in.portal.checkpoint.com",
  },
};

/** MSP SmartAPI regional endpoints (for tenant-level operations via MSP key) */
export const AVANAN_MSP_REGIONS: Record<string, string> = {
  us: "https://smart-api-production-1-us.avanan.net",
  eu: "https://smart-api-production-1-eu.avanan.net",
  au: "https://smart-api-production-5-ap.avanan.net",
  ca: "https://smart-api-production-1-ca.avanan.net",
  uk: "https://smart-api-production-1-euw2.avanan.net",
  in: "https://smart-api-production-1-aps1.avanan.net",
};
