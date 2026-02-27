/**
 * SentinelOne API response types.
 * Based on SentinelOne REST API v2.1 documentation.
 */

/** Standard S1 paginated response wrapper */
export interface S1Response<T> {
  data: T;
  pagination?: {
    totalItems?: number;
    nextCursor?: string;
  };
  errors?: Array<{
    code: number;
    detail: string | null;
    title: string;
  }>;
}

export interface S1Threat {
  id: string;
  agentId?: string;
  agentDetectionInfo?: {
    agentDomain?: string;
    agentIpV4?: string;
    agentLastLoggedInUserName?: string;
    agentMitigationMode?: string;
    agentOsName?: string;
    agentOsRevision?: string;
    agentRegisteredAt?: string;
    agentUuid?: string;
    agentVersion?: string;
    externalIp?: string;
    groupId?: string;
    groupName?: string;
    siteId?: string;
    siteName?: string;
  };
  agentRealtimeInfo?: {
    agentComputerName?: string;
    agentDomain?: string;
    agentId?: string;
    agentInfected?: boolean;
    agentIsActive?: boolean;
    agentIsDecommissioned?: boolean;
    agentNetworkStatus?: string;
    agentOsName?: string;
    agentOsRevision?: string;
    agentOsType?: string;
    agentVersion?: string;
    operationalState?: string;
    scanStatus?: string;
    siteId?: string;
    siteName?: string;
    groupId?: string;
    groupName?: string;
  };
  threatInfo?: {
    analystVerdict?: string;
    analystVerdictDescription?: string;
    automaticallyResolved?: boolean;
    classification?: string;
    classificationSource?: string;
    cloudVerdict?: string;
    confidenceLevel?: string;
    createdAt?: string;
    detectionEngines?: Array<{ key: string; title: string }>;
    detectionType?: string;
    engines?: string[];
    externalTicketExists?: boolean;
    externalTicketId?: string;
    failedActions?: boolean;
    fileExtension?: string;
    fileExtensionType?: string;
    filePath?: string;
    fileSize?: number;
    fileVerificationType?: string;
    identifiedAt?: string;
    incidentStatus?: string;
    incidentStatusDescription?: string;
    initiatedBy?: string;
    initiatedByDescription?: string;
    isFileless?: boolean;
    isValidCertificate?: boolean;
    maliciousProcessArguments?: string;
    md5?: string;
    mitigatedPreemptively?: boolean;
    mitigationStatus?: string;
    mitigationStatusDescription?: string;
    originatorProcess?: string;
    processUser?: string;
    publisherName?: string;
    rebootRequired?: boolean;
    sha1?: string;
    sha256?: string;
    storyline?: string;
    threatId?: string;
    threatName?: string;
    updatedAt?: string;
  };
  containerInfo?: {
    id?: string;
    image?: string;
    labels?: string;
    name?: string;
  };
  kubernetesInfo?: Record<string, unknown>;
  mitigationStatus?: Array<{
    action: string;
    actionsCounters?: Record<string, number>;
    agentSupportsReport?: boolean;
    groupNotFound?: boolean;
    lastUpdate?: string;
    latestReport?: string;
    mitigationEndedAt?: string;
    mitigationStartedAt?: string;
    status: string;
  }>;
  whiteningOptions?: string[];
}

export interface S1Agent {
  id: string;
  uuid?: string;
  computerName?: string;
  domain?: string;
  siteName?: string;
  siteId?: string;
  groupName?: string;
  groupId?: string;
  accountName?: string;
  accountId?: string;
  machineType?: string;
  osName?: string;
  osType?: string;
  osRevision?: string;
  osArch?: string;
  agentVersion?: string;
  coreCount?: number;
  cpuId?: string;
  cpuCount?: number;
  totalMemory?: number;
  isActive?: boolean;
  isDecommissioned?: boolean;
  isPendingUninstall?: boolean;
  isUninstalled?: boolean;
  isUpToDate?: boolean;
  infected?: boolean;
  lastActiveDate?: string;
  lastLoggedInUserName?: string;
  lastIpToMgmt?: string;
  externalIp?: string;
  networkStatus?: string; // connected, disconnected, connecting, disconnecting
  scanStatus?: string;
  scanStartedAt?: string;
  scanFinishedAt?: string;
  modelName?: string;
  serialNumber?: string;
  manufacturerName?: string;
  networkInterfaces?: Array<{
    id: string;
    inet?: string[];
    inet6?: string[];
    name: string;
    physical: string;
  }>;
  activeThreats?: number;
  createdAt?: string;
  updatedAt?: string;
  registeredAt?: string;
  threatRebootRequired?: boolean;
  operationalState?: string;
  operationalStateExpiration?: string;
}

export interface S1Site {
  id: string;
  name: string;
  state?: string;
  accountName?: string;
  accountId?: string;
  activeLicenses?: number;
  totalLicenses?: number;
  sku?: string;   // License tier: "Complete", "Control", etc.
  suite?: string;  // Alternative license field
  createdAt?: string;
  updatedAt?: string;
}

export interface S1Group {
  id: string;
  name: string;
  siteId?: string;
  siteName?: string;
  type?: string;
  rank?: number;
  createdAt?: string;
  updatedAt?: string;
  totalAgents?: number;
}

export interface S1Activity {
  id: string;
  activityType?: number;
  agentId?: string;
  agentUpdatedVersion?: string;
  comments?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
  description?: string;
  groupId?: string;
  hash?: string;
  osFamily?: string;
  primaryDescription?: string;
  secondaryDescription?: string;
  siteId?: string;
  siteName?: string;
  threatId?: string;
  updatedAt?: string;
  userId?: string;
}

export interface S1Exclusion {
  id: string;
  type?: string;
  value?: string;
  source?: string;
  osType?: string;
  description?: string;
  mode?: string;
  createdAt?: string;
  updatedAt?: string;
  scopeName?: string;
  scopePath?: string;
  userName?: string;
}

export interface S1DeepVisibilityQuery {
  queryId: string;
  status: string;
  progressStatus?: number;
}

export interface S1DeepVisibilityEvent {
  [key: string]: unknown;
}

/** Affected count response from action endpoints */
export interface S1AffectedResponse {
  affected: number;
}

/** Threat note from /threats/{id}/notes */
export interface S1ThreatNote {
  id: string;
  text?: string;
  createdAt?: string;
  updatedAt?: string;
  creator?: string;
  creatorId?: string;
}

/** Timeline event from /threats/{id}/timeline */
export interface S1ThreatTimelineEvent {
  id: string;
  activityType?: number;
  primaryDescription?: string;
  description?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
}

/** Application installed on an agent */
export interface S1Application {
  name?: string;
  version?: string;
  publisher?: string;
  size?: number;
  installedDate?: string;
}
