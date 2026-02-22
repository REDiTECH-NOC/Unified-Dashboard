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

export interface IPhoneConnector {
  getSystemStatus(): Promise<SystemStatus>;
  getSystemTelemetry(): Promise<SystemTelemetry[]>;
  getSystemHealth(): Promise<SystemHealthStatus>;
  getTrunks(): Promise<TrunkInfo[]>;
  getUsers(): Promise<ExtensionInfo[]>;
  getActiveCalls(): Promise<ActiveCall[]>;
  getServices(): Promise<ServiceInfo[]>;
  healthCheck(): Promise<HealthCheckResult>;
}
