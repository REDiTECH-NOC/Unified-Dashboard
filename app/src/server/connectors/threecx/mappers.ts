/**
 * 3CX → IPhoneConnector type mappers.
 * Transforms raw 3CX XAPI responses into the phone connector interface types.
 */

import type {
  SystemStatus,
  SystemTelemetry,
  SystemHealthStatus,
  TrunkInfo,
  TrunkDetail,
  ExtensionInfo,
  ActiveCall,
  ServiceInfo,
  CallHistoryRecord,
  QueueInfo,
  QueueAgent,
  RingGroupInfo,
  GroupInfo,
} from "../_interfaces/phone";
import type {
  ThreecxSystemStatus,
  ThreecxTelemetryPoint,
  ThreecxHealthStatus,
  ThreecxTrunk,
  ThreecxTrunkDetail,
  ThreecxUser,
  ThreecxActiveCall,
  ThreecxService,
  ThreecxCallHistoryRecord,
  ThreecxQueue,
  ThreecxQueueAgent,
  ThreecxRingGroup,
  ThreecxGroup,
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
    userExtensions: raw.UserExtensions,
    maxUserExtensions: raw.MaxUserExtensions,
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
    support: raw.Support,
    productCode: raw.ProductCode,
    licenseKey: raw.LicenseKey,
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
    tickCount: raw.TickCount,
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

export function mapTrunkDetail(raw: ThreecxTrunkDetail): TrunkDetail {
  return {
    id: raw.Id,
    number: raw.Number,
    isOnline: raw.IsOnline,
    externalNumber: raw.ExternalNumber,
    simultaneousCalls: raw.SimultaneousCalls,
    gatewayName: raw.Gateway?.Name,
    gatewayHost: raw.Gateway?.Host,
    didNumbers: raw.DidNumbers ?? [],
    registrationTimes: raw.TrunkRegTimes ?? [],
    type: raw.Type,
    authId: raw.AuthId,
    registrarHost: raw.RegistrarHost,
    registrarPort: raw.RegistrarPort,
  };
}

export function mapQueue(
  raw: ThreecxQueue,
  agents: ThreecxQueueAgent[],
  managers: string[]
): QueueInfo {
  return {
    id: raw.Id,
    name: raw.Name,
    number: raw.Number,
    pollingStrategy: raw.PollingStrategy,
    ringTimeout: raw.RingTimeout,
    maxCallersInQueue: raw.MaxCallersInQueue,
    maxCallerWaitTime: raw.MaxCallerWaitTime,
    agents: agents.map((a) => ({
      number: a.Number,
      queueStatus: a.QueueStatus,
    })),
    managers,
  };
}

export function mapRingGroup(raw: ThreecxRingGroup, members: string[]): RingGroupInfo {
  return {
    id: raw.Id,
    name: raw.Name,
    number: raw.Number,
    ringStrategy: raw.RingStrategy,
    ringTimeout: raw.RingTimeout,
    members,
  };
}

export function mapGroup(raw: ThreecxGroup, members: string[]): GroupInfo {
  return {
    id: raw.Id,
    name: raw.Name,
    members,
  };
}

/** Parse ISO 8601 duration (PT2.926S) to seconds */
function parseDuration(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || "0") * 3600) + (parseInt(m[2] || "0") * 60) + parseFloat(m[3] || "0");
}

function mapDstType(dnType: number): string {
  switch (dnType) {
    case 0: return "extension";
    case 1: return "trunk";
    case 5: return "voicemail";
    case 6: return "ivr";
    case 7: return "queue";
    default: return "other";
  }
}

/** Format SrcParticipantId as hex Call ID matching 3CX admin UI (e.g., 210 → "000-d2") */
function formatCallId(participantId: number): string {
  return `000-${participantId.toString(16)}`;
}

export function mapCallHistoryRecord(raw: ThreecxCallHistoryRecord): CallHistoryRecord {
  let direction: "inbound" | "outbound" | "internal" = "internal";
  if (raw.SrcExternal) direction = "inbound";
  else if (raw.DstExternal || raw.DstDnType === 1) direction = "outbound";

  return {
    segmentId: raw.SegmentId,
    callId: formatCallId(raw.SrcParticipantId),
    callIdNumeric: raw.SrcParticipantId,
    startTime: raw.SegmentStartTime,
    endTime: raw.SegmentEndTime,
    direction,
    srcName: raw.SrcDisplayName || raw.SrcCallerNumber,
    srcNumber: raw.SrcCallerNumber,
    srcExtension: raw.SrcDn,
    dstName: raw.DstDisplayName || raw.DstCallerNumber,
    dstNumber: raw.DstCallerNumber,
    dstExtension: raw.DstDn,
    dstType: mapDstType(raw.DstDnType),
    durationSeconds: parseDuration(raw.CallTime),
    answered: raw.CallAnswered,
    actionId: raw.SegmentActionId,
  };
}
