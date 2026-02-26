/**
 * IPhoneConnector — interface for phone/PBX system monitoring.
 *
 * Unlike other connectors, phone connectors operate per-instance (one PBX
 * per customer). The ConnectorFactory doesn't manage these; instead,
 * ThreecxInstanceManager handles multi-instance resolution.
 *
 * Current implementation: 3CX v20
 * Future: Could support FreePBX, Asterisk, etc.
 */

import type { HealthCheckResult } from "../_base/types";

export interface SystemStatus {
  fqdn: string;
  version: string;
  activated: boolean;
  maxSimCalls: number;
  extensionsRegistered: number;
  extensionsTotal: number;
  userExtensions: number;
  maxUserExtensions: number;
  trunksRegistered: number;
  trunksTotal: number;
  callsActive: number;
  diskUsagePercent: number;
  freeDiskSpace: number;
  totalDiskSpace: number;
  hasNotRunningServices: boolean;
  backupScheduled: boolean;
  lastBackupDateTime?: string;
  licenseActive: boolean;
  expirationDate?: string;
  maintenanceExpiresAt?: string;
  support: boolean;
  productCode?: string;
  licenseKey?: string;
  os: string;
  autoUpdateEnabled: boolean;
}

export interface SystemTelemetry {
  time: string;
  cpuUsage: number;
  totalPhysicalMemory: number;
  freePhysicalMemory: number;
  totalDiskSpace: number;
  freeDiskSpace: number;
  tickCount?: number; // OS uptime in milliseconds (since last boot)
}

export interface SystemHealthStatus {
  firewall: boolean;
  trunks: boolean;
  phones: boolean;
}

export interface TrunkInfo {
  id: number;
  number: string;
  isOnline: boolean;
  externalNumber?: string;
  simultaneousCalls: number;
  gatewayName?: string;
  gatewayHost?: string;
}

export interface ExtensionInfo {
  number: string;
  firstName: string;
  lastName: string;
  email?: string;
  isRegistered: boolean;
  currentProfile?: string;
  queueStatus?: string;
  vmEnabled: boolean;
  enabled: boolean;
}

export interface ActiveCall {
  id: number;
  caller: string;
  callee: string;
  state: string;
  startTime?: string;
}

export interface ServiceInfo {
  name: string;
  displayName: string;
  status: string;
  memoryUsed: number;
  threadCount?: number;
  startStopEnabled: boolean;
  restartEnabled: boolean;
}

export interface CallHistoryRecord {
  segmentId: number;
  callId: string; // Hex-formatted SrcParticipantId (e.g., "000-d2") — groups segments into call chains
  callIdNumeric: number; // Raw SrcParticipantId for sorting/grouping
  startTime: string;
  endTime: string;
  direction: "inbound" | "outbound" | "internal";
  srcName: string;
  srcNumber: string;
  srcExtension: string;
  dstName: string;
  dstNumber: string;
  dstExtension: string;
  dstType: string; // "extension", "voicemail", "ivr", "queue", "trunk", "other"
  durationSeconds: number;
  answered: boolean;
  actionId: number; // SegmentActionId — helps identify segment purpose
}

export interface CallHistoryFilter {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  fromNumber?: string; // contains search on SrcCallerNumber/SrcDisplayName
  toNumber?: string;   // contains search on DstCallerNumber/DstDisplayName
  answered?: boolean;
}

// ─── Queue / Ring Group / Group Types ─────────────────────

export interface QueueInfo {
  id: number;
  name: string;
  number: string;
  pollingStrategy: string;
  ringTimeout: number;
  maxCallersInQueue: number;
  maxCallerWaitTime: number;
  agents: QueueAgent[];
  managers: string[]; // extension numbers
}

export interface QueueAgent {
  number: string;
  queueStatus?: string; // "LoggedIn", "LoggedOut"
}

export interface RingGroupInfo {
  id: number;
  name: string;
  number: string;
  ringStrategy: string;
  ringTimeout: number;
  members: string[]; // extension numbers
}

export interface GroupInfo {
  id: number;
  name: string;
  members: string[]; // extension numbers
}

export interface TrunkDetail extends TrunkInfo {
  didNumbers: string[];
  registrationTimes: string[];
  type?: string;
  authId?: string;
  registrarHost?: string;
  registrarPort?: number;
}

export interface IPhoneConnector {
  getSystemStatus(): Promise<SystemStatus>;
  getSystemTelemetry(): Promise<SystemTelemetry[]>;
  getSystemHealth(): Promise<SystemHealthStatus>;
  getTrunks(): Promise<TrunkInfo[]>;
  getTrunkDetails(): Promise<TrunkDetail[]>;
  getUsers(): Promise<ExtensionInfo[]>;
  getActiveCalls(): Promise<ActiveCall[]>;
  getServices(): Promise<ServiceInfo[]>;
  getCallHistory(top?: number, filter?: CallHistoryFilter): Promise<CallHistoryRecord[]>;
  getQueues(): Promise<QueueInfo[]>;
  getRingGroups(): Promise<RingGroupInfo[]>;
  getGroups(): Promise<GroupInfo[]>;
  healthCheck(): Promise<HealthCheckResult>;
}
