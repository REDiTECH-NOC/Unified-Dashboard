/**
 * NinjaOne (NinjaRMM) API response types.
 * Based on NinjaOne REST API v2 documentation.
 */

export interface NinjaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface NinjaDevice {
  id: number;
  organizationId?: number;
  locationId?: number;
  nodeClass?: string; // WINDOWS_WORKSTATION, WINDOWS_SERVER, MAC, LINUX, etc.
  nodeRoleId?: number;
  rolePolicyId?: number;
  policyId?: number;
  approvalStatus?: string;
  offline?: boolean;
  displayName?: string;
  systemName?: string;
  dnsName?: string;
  netbiosName?: string;
  created?: string;
  lastContact?: string;
  lastUpdate?: string;
  ipAddresses?: string[];
  publicIP?: string;
  macAddresses?: string[];
  os?: {
    name?: string;
    manufacturer?: string;
    architecture?: string;
    buildNumber?: string;
    servicePack?: string;
    releaseId?: string;
    lastBoot?: string;
    locale?: string;
    needsReboot?: boolean;
  };
  system?: {
    name?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    biosSerialNumber?: string;
    domain?: string;
    chassisType?: string;
  };
  memory?: {
    physical?: number;
    virtual?: number;
  };
  processors?: Array<{
    name?: string;
    architecture?: string;
    maxClockSpeed?: number;
    cores?: number;
    logicalProcessors?: number;
  }>;
  volumes?: Array<{
    name?: string;
    label?: string;
    capacity?: number;
    freeSpace?: number;
    fileSystem?: string;
  }>;
  references?: {
    organization?: { id: number; name: string };
    location?: { id: number; name: string };
    rolePolicy?: { id: number; name: string };
  };
}

export interface NinjaDevicesResponse {
  results?: NinjaDevice[];
  cursor?: string;
  totalCount?: number;
}

export interface NinjaOrganization {
  id: number;
  name: string;
  description?: string;
  nodeApprovalMode?: string;
  tags?: string[];
  fields?: Record<string, unknown>;
  locations?: Array<{
    id: number;
    name: string;
    address?: string;
    description?: string;
  }>;
}

export interface NinjaAlert {
  id: number;
  uid?: string;
  deviceId?: number;
  sourceType?: string;
  severity?: string; // NONE, MINOR, MODERATE, MAJOR, CRITICAL
  priority?: string;
  message?: string;
  subject?: string;
  data?: Record<string, unknown>;
  device?: {
    id: number;
    displayName?: string;
    systemName?: string;
    organizationId?: number;
  };
  createTime?: number; // epoch ms
  updateTime?: number;
}

export interface NinjaAlertsResponse {
  results?: NinjaAlert[];
  cursor?: string;
  totalCount?: number;
}

export interface NinjaSoftware {
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
  size?: number;
  location?: string;
}

export interface NinjaPatch {
  id?: string;
  name: string;
  kbNumber?: string;
  status?: string; // APPROVED, REJECTED, MANUAL
  severity?: string;
  type?: string;
  installedAt?: string;
}

export interface NinjaWindowsService {
  serviceName: string;
  displayName: string;
  state: string; // RUNNING, STOPPED, etc.
  startType: string; // AUTO_START, DEMAND_START, DISABLED, etc.
}

export interface NinjaActivity {
  id: number;
  activityTime?: number; // epoch ms
  deviceId?: number;
  seriesUid?: string;
  activityType?: string;
  statusCode?: string;
  status?: string;
  message?: string;
  subject?: string;
  data?: Record<string, unknown>;
}

export interface NinjaActivitiesResponse {
  activities?: NinjaActivity[];
  lastActivityId?: number;
}

// ─── Fleet Query Response Types (GET /queries/*) ──────────────────

export interface NinjaQueryResponse<T> {
  results?: T[];
  cursor?: string;
}

export interface NinjaDeviceHealth {
  deviceId: number;
  systemName?: string;
  displayName?: string;
  organizationId?: number;
  organizationName?: string;
  locationId?: number;
  nodeClass?: string;
  offline?: boolean;
  approvalStatus?: string;
  healthStatus?: string;
  lastContact?: string;
  references?: {
    organization?: { id: number; name: string };
    location?: { id: number; name: string };
  };
}

export interface NinjaProcessor {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name?: string;
  architecture?: string;
  maxClockSpeed?: number;
  cores?: number;
  logicalProcessors?: number;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaVolume {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name?: string;
  label?: string;
  capacity?: number;
  freeSpace?: number;
  fileSystem?: string;
  bitLockerStatus?: string;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaOperatingSystem {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name?: string;
  manufacturer?: string;
  architecture?: string;
  buildNumber?: string;
  servicePackMajorVersion?: number;
  releaseId?: string;
  lastBootTime?: string;
  needsReboot?: boolean;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaComputerSystem {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  biosSerialNumber?: string;
  domain?: string;
  chassisType?: string;
  totalPhysicalMemory?: number;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaSoftwareQuery {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
  size?: number;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaAntivirusStatus {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  productName?: string;
  productState?: string;
  definitionsUpToDate?: boolean;
  realTimeProtectionEnabled?: boolean;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaAntivirusThreat {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  threatName?: string;
  severity?: string;
  status?: string;
  detectedAt?: string;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaPatchInstall {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  name?: string;
  kbNumber?: string;
  status?: string;
  type?: string;
  severity?: string;
  installedAt?: string;
  references?: {
    organization?: { id: number; name: string };
  };
}

export interface NinjaBackupJob {
  deviceId: number;
  systemName?: string;
  organizationId?: number;
  backupProductName?: string;
  jobName?: string;
  jobStatus?: string;
  lastRunTime?: string;
  nextRunTime?: string;
  references?: {
    organization?: { id: number; name: string };
  };
}
