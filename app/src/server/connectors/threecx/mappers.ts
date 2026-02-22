/**
 * 3CX → IPhoneConnector type mappers.
 * Transforms raw 3CX XAPI responses into the phone connector interface types.
 */

import type {
  SystemStatus,
  SystemTelemetry,
  SystemHealthStatus,
  TrunkInfo,
  ExtensionInfo,
  ActiveCall,
  ServiceInfo,
} from "../_interfaces/phone";
import type {
  ThreecxSystemStatus,
  ThreecxTelemetryPoint,
  ThreecxHealthStatus,
  ThreecxTrunk,
  ThreecxUser,
  ThreecxActiveCall,
  ThreecxService,
} from "./types";

export function mapSystemStatus(raw: ThreecxSystemStatus): SystemStatus {
  const totalDisk = raw.TotalDiskSpace || 1;
  const freeDisk = raw.FreeDiskSpace || 0;
  const diskUsagePercent = Math.round(
    ((totalDisk - freeDisk) / totalDisk) * 100
  );

  return {
    fqdn: raw.FQDN,
    version: raw.Version,
    activated: raw.Activated,
    maxSimCalls: raw.MaxSimCalls,
    extensionsRegistered: raw.ExtensionsRegistered,
    extensionsTotal: raw.ExtensionsTotal,
    trunksRegistered: raw.TrunksRegistered,
    trunksTotal: raw.TrunksTotal,
    callsActive: raw.CallsActive,
    diskUsagePercent,
    freeDiskSpace: raw.FreeDiskSpace,
    totalDiskSpace: raw.TotalDiskSpace,
    hasNotRunningServices: raw.HasNotRunningServices,
    backupScheduled: raw.BackupScheduled,
    lastBackupDateTime: raw.LastBackupDateTime,
    licenseActive: raw.LicenseActive,
    expirationDate: raw.ExpirationDate,
    maintenanceExpiresAt: raw.MaintenanceExpiresAt,
    os: raw.OS,
    autoUpdateEnabled: raw.AutoUpdateEnabled,
  };
}

export function mapTelemetry(raw: ThreecxTelemetryPoint): SystemTelemetry {
  return {
    time: raw.Time,
    cpuUsage: raw.CpuUsage,
    totalPhysicalMemory: raw.TotalPhysicalMemory,
    freePhysicalMemory: raw.FreePhysicalMemory,
    totalDiskSpace: raw.TotalDiskSpace,
    freeDiskSpace: raw.FreeDiskSpace,
  };
}

export function mapHealthStatus(raw: ThreecxHealthStatus): SystemHealthStatus {
  return {
    firewall: raw.Firewall,
    trunks: raw.Trunks,
    phones: raw.Phones,
  };
}

export function mapTrunk(raw: ThreecxTrunk): TrunkInfo {
  return {
    id: raw.Id,
    number: raw.Number,
    isOnline: raw.IsOnline,
    externalNumber: raw.ExternalNumber,
    simultaneousCalls: raw.SimultaneousCalls,
    gatewayName: raw.Gateway?.Name,
    gatewayHost: raw.Gateway?.Host,
  };
}

export function mapExtension(raw: ThreecxUser): ExtensionInfo {
  return {
    number: raw.Number,
    firstName: raw.FirstName,
    lastName: raw.LastName,
    email: raw.EmailAddress,
    isRegistered: raw.IsRegistered,
    currentProfile: raw.CurrentProfileName,
    queueStatus: raw.QueueStatus,
    vmEnabled: raw.VMEnabled,
    enabled: raw.Enabled,
  };
}

export function mapActiveCall(raw: ThreecxActiveCall): ActiveCall {
  return {
    id: raw.Id,
    caller: raw.Caller,
    callee: raw.Callee,
    state: raw.State,
    startTime: raw.StartTime,
  };
}

export function mapService(raw: ThreecxService): ServiceInfo {
  return {
    name: raw.Name,
    displayName: raw.DisplayName,
    status: raw.Status,
    memoryUsed: raw.MemoryUsed,
    threadCount: raw.ThreadCount,
    startStopEnabled: raw.StartStopEnabled,
    restartEnabled: raw.RestartEnabled,
  };
}
