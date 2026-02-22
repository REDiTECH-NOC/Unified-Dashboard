/**
 * 3CX XAPI v1 response types.
 * Based on 3CX v20 API documentation and testing against .my3cx.us instances.
 */

export interface ThreecxLoginResponse {
  Status: string; // "AuthSuccess", "AuthFailed", etc.
  Token?: {
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
  };
}

export interface ThreecxSystemStatus {
  FQDN: string;
  Version: string;
  Activated: boolean;
  MaxSimCalls: number;
  ExtensionsRegistered: number;
  ExtensionsTotal: number;
  TrunksRegistered: number;
  TrunksTotal: number;
  CallsActive: number;
  DiskUsage: number;
  FreeDiskSpace: number;
  TotalDiskSpace: number;
  HasNotRunningServices: boolean;
  BackupScheduled: boolean;
  LastBackupDateTime?: string;
  LicenseActive: boolean;
  ExpirationDate?: string;
  MaintenanceExpiresAt?: string;
  OS: string;
  AutoUpdateEnabled: boolean;
  IsAuditLogEnabled?: boolean;
  RecordingQuota?: number;
  RecordingUsedSpace?: number;
}

export interface ThreecxTelemetryPoint {
  Time: string;
  CpuUsage: number;
  TotalPhysicalMemory: number;
  FreePhysicalMemory: number;
  TotalVirtualMemory?: number;
  FreeVirtualMemory?: number;
  TotalDiskSpace: number;
  FreeDiskSpace: number;
}

export interface ThreecxHealthStatus {
  Firewall: boolean;
  Trunks: boolean;
  Phones: boolean;
}

export interface ThreecxTrunk {
  Number: string;
  Id: number;
  IsOnline: boolean;
  ExternalNumber?: string;
  SimultaneousCalls: number;
  DidNumbers?: string[];
  Gateway?: {
    Name: string;
    Host: string;
  };
  TrunkRegTimes?: string[];
}

export interface ThreecxUser {
  Number: string;
  Id?: number;
  FirstName: string;
  LastName: string;
  EmailAddress?: string;
  IsRegistered: boolean;
  CurrentProfileName?: string;
  QueueStatus?: string;
  VMEnabled: boolean;
  Enabled: boolean;
}

export interface ThreecxActiveCall {
  Id: number;
  Caller: string;
  Callee: string;
  State: string;
  StartTime?: string;
}

export interface ThreecxService {
  Name: string;
  DisplayName: string;
  Status: string; // "Running", "Stopped", etc.
  MemoryUsed: number;
  TotalProcessorTime?: number;
  ThreadCount: number;
  HandleCount?: number;
  StartStopEnabled: boolean;
  RestartEnabled: boolean;
}
