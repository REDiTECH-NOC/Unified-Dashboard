/**
 * IEdrConnector — interface for Endpoint Detection & Response tools.
 *
 * Current implementation: SentinelOne
 * Future: CrowdStrike, Microsoft Defender for Endpoint, etc.
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type { NormalizedThreat, NormalizedDevice } from "./common";

export interface ThreatFilter {
  siteId?: string;
  groupId?: string;
  status?: string;
  classification?: string;
  severity?: string;
  createdAfter?: Date;
  searchTerm?: string;
}

export interface AgentFilter {
  groupId?: string;
  siteId?: string;
  status?: string;
  searchTerm?: string;
}

export type MitigationAction =
  | "kill"
  | "quarantine"
  | "remediate"
  | "rollback";

export type IncidentStatus = "resolved" | "in_progress" | "unresolved";

export type AnalystVerdict =
  | "true_positive"
  | "false_positive"
  | "suspicious"
  | "undefined";

export interface ThreatNote {
  id: string;
  text: string;
  createdAt: Date;
  creatorId?: string;
  creatorName?: string;
}

export interface ThreatTimelineEntry {
  id: string;
  activityType: string;
  description: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface AgentApplication {
  name: string;
  version?: string;
  publisher?: string;
  size?: number;
  installedDate?: string;
}

export interface CreateExclusionInput {
  type: "path" | "hash" | "certificate" | "browser";
  value: string;
  osType?: "windows" | "macos" | "linux";
  siteIds?: string[];
  groupIds?: string[];
  description?: string;
}

export interface DeepVisibilityQuery {
  queryId: string;
  status: "created" | "running" | "finished" | "failed";
}

export interface IEdrConnector {
  // --- Threats ---
  getThreats(
    filter?: ThreatFilter,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedThreat>>;

  getThreatById(id: string): Promise<NormalizedThreat>;

  // --- Threat Actions ---
  mitigateThreat(
    threatId: string,
    action: MitigationAction
  ): Promise<void>;

  updateIncidentStatus(
    threatIds: string[],
    status: IncidentStatus
  ): Promise<void>;

  updateAnalystVerdict(
    threatIds: string[],
    verdict: AnalystVerdict
  ): Promise<void>;

  markAsBenign(
    threatIds: string[],
    whiteningOption?: string
  ): Promise<void>;

  markAsThreat(
    threatIds: string[],
    whiteningOption?: string
  ): Promise<void>;

  // --- Threat Notes ---
  getThreatNotes(
    threatId: string,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<ThreatNote>>;

  addThreatNote(
    threatId: string,
    text: string
  ): Promise<{ id: string }>;

  // --- Threat Timeline ---
  getThreatTimeline(
    threatId: string,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<ThreatTimelineEntry>>;

  // --- Agent Actions ---
  isolateDevice(agentId: string): Promise<void>;

  unisolateDevice(agentId: string): Promise<void>;

  triggerFullScan(agentId: string): Promise<void>;

  // --- Agents (Endpoints) ---
  getAgents(
    filter?: AgentFilter,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedDevice>>;

  getAgentById(id: string): Promise<NormalizedDevice>;

  getAgentApplications(
    agentId: string,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<AgentApplication>>;

  // --- Sites & Groups ---
  getSites(): Promise<
    Array<{ id: string; name: string; state?: string; accountName?: string }>
  >;

  getGroups(
    siteId?: string
  ): Promise<Array<{ id: string; name: string; siteId?: string }>>;

  // --- Exclusions ---
  getExclusions(
    siteId?: string,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<{ id: string; type: string; value: string; description?: string }>>;

  createExclusion(input: CreateExclusionInput): Promise<{ id: string }>;

  deleteExclusion(exclusionId: string): Promise<void>;

  // --- Deep Visibility (Threat Hunting) ---
  queryDeepVisibility(
    query: string,
    fromDate: Date,
    toDate: Date
  ): Promise<DeepVisibilityQuery>;

  getDeepVisibilityResults(
    queryId: string
  ): Promise<{ status: string; events: Array<Record<string, unknown>> }>;

  // --- Activities ---
  getActivities(
    filter?: { siteId?: string; activityType?: string; createdAfter?: Date },
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<{ id: string; type: string; description: string; timestamp: Date }>>;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
