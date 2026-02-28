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
  MaxUserExtensions: number;
  UserExtensions: number;
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
  Support: boolean;
  ProductCode?: string;
  LicenseKey?: string;
  ResellerName?: string;
  Ip?: string;
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
  TickCount?: number; // OS uptime in milliseconds (since last boot)
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
  Status: string;
  LastChangeStatus?: string;
  EstablishedAt?: string;
  ServerNow?: string;
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

/** ReportCallLogData response — the admin-level call report endpoint */
export interface ThreecxReportCallRecord {
  MainCallHistoryId: string; // UUID — groups segments of the same call
  CallHistoryId: string;
  CdrId: string;
  CallId: number;
  Indent: number;
  StartTime: string;          // ISO 8601 with timezone
  SourceType: number;
  SourceDn: string;
  SourceCallerId: string;
  SourceDisplayName: string;
  DestinationType: number;
  DestinationDn: string;
  DestinationCallerId: string;
  DestinationDisplayName: string;
  ActionType: number;
  ActionDnType: number;
  RingingDuration: string;    // ISO 8601 duration e.g. "PT4.244614S"
  TalkingDuration: string;    // ISO 8601 duration
  CallCost: number;
  Answered: boolean;
  Direction: string;          // "Inbound", "Outbound", "Inbound Queue"
  CallType: string;           // "External", "Queue", "Extension", "Digital Receptionist", "System"
  Status: string;             // "Answered", "Unanswered", "Redirected", "Waiting"
  SubrowDescNumber: number;
  Reason: string;             // Human-readable call activity description
  SegmentId: number;
  QualityReport: boolean;
}

/** Legacy CallHistoryView response — per-user call history (non-admin) */
export interface ThreecxCallHistoryRecord {
  SegmentId: number;
  SegmentStartTime: string;
  SegmentEndTime: string;
  SegmentActionId: number;
  SegmentType: number; // 1 = outbound, 2 = inbound
  SrcId: number;
  SrcDisplayName: string;
  SrcCallerNumber: string;
  SrcInternal: boolean;
  SrcExternal: boolean;
  SrcDn: string;
  SrcDnType: number;
  SrcParticipantId: number; // Groups segments into a call chain (= Call ID in hex)
  DstId: number;
  DstDisplayName: string;
  DstCallerNumber: string;
  DstInternal: boolean;
  DstExternal: boolean;
  DstDn: string;
  DstDnType: number; // 0=Extension, 5=VMail, 6=IVR, 12=EndCall
  DstParticipantId: number;
  CallTime: string; // ISO 8601 duration e.g. "PT2.926253S"
  CallAnswered: boolean;
}

/** Filter options for call history queries */
export interface CallHistoryFilterOptions {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  fromNumber?: string; // contains search on SrcCallerNumber or SrcDisplayName
  toNumber?: string;   // contains search on DstCallerNumber or DstDisplayName
  answered?: boolean;
}

// ─── Queue Types ───────────────────────────────────────────

export interface ThreecxQueue {
  Id: number;
  Name: string;
  Number: string;
  PollingStrategy: string; // "RingAll", "LongestWaiting", "RoundRobin", etc.
  RingTimeout: number;
  MaxCallersInQueue: number;
  MaxCallerWaitTime: number;
  IntroductionMessage?: string;
  MasterTimeout?: number;
  CallbackEnabled?: boolean;
  CallbackTimeout?: number;
  Priority?: number;
  ClickToCallId?: number;
}

export interface ThreecxQueueAgent {
  Number: string;
  QueueStatus?: string; // "LoggedIn", "LoggedOut"
}

export interface ThreecxQueueManager {
  Number: string;
}

// ─── Ring Group Types ──────────────────────────────────────

export interface ThreecxRingGroup {
  Id: number;
  Name: string;
  Number: string;
  RingStrategy: string; // "RingAll", "Paging", "Hunt", etc.
  RingTimeout: number;
  ForwardNoAnswer?: string;
  ForwardNoAnswerToNumber?: string;
}

export interface ThreecxRingGroupMember {
  Number: string;
}

// ─── Group (Department) Types ──────────────────────────────

export interface ThreecxGroup {
  Id: number;
  Name: string;
}

// ─── Expanded Trunk Types (full detail) ────────────────────

export interface ThreecxTrunkDetail {
  Number: string;
  Id: number;
  IsOnline: boolean;
  ExternalNumber?: string;
  SimultaneousCalls: number;
  DidNumbers?: string[];
  Gateway?: {
    Name: string;
    Host: string;
    Port?: number;
    Type?: string;
  };
  TrunkRegTimes?: string[];
  InboundParams?: {
    CallerIdOverwrite?: string;
    DestinationCallerNumber?: string;
  };
  OutboundParams?: {
    CallerIdOverwrite?: string;
    DialPlan?: string;
  };
  AuthId?: string;
  AuthPassword?: string;
  RegistrarHost?: string;
  RegistrarPort?: number;
  SupportReInvite?: boolean;
  Type?: string; // "Provider", "Gateway", etc.
}
