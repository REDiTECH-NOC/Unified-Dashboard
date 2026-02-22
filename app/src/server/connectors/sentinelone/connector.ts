/**
 * SentinelOne EDR Connector — implements IEdrConnector.
 *
 * Threats, agents, sites, groups, exclusions, deep visibility,
 * and security actions (isolate, mitigate, scan) via SentinelOne REST API v2.1.
 */

import type { ConnectorConfig, PaginatedResponse } from "../_base/types";
import type { IEdrConnector, ThreatFilter, AgentFilter, MitigationAction, CreateExclusionInput, DeepVisibilityQuery } from "../_interfaces/edr";
import type { NormalizedThreat, NormalizedDevice } from "../_interfaces/common";
import { SentinelOneClient } from "./client";
import type { S1Threat, S1Agent, S1Site, S1Group, S1Activity, S1Exclusion, S1AffectedResponse, S1DeepVisibilityQuery, S1DeepVisibilityEvent } from "./types";
import { mapThreat, mapAgent } from "./mappers";

export class SentinelOneEdrConnector implements IEdrConnector {
  private client: SentinelOneClient;

  constructor(config: ConnectorConfig) {
    this.client = new SentinelOneClient(config);
  }

  // ─── Threats ───────────────────────────────────────────────

  async getThreats(
    filter?: ThreatFilter,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedThreat>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: Math.min(pageSize, 1000),
      sortBy: "createdAt",
      sortOrder: "desc",
    };

    if (cursor) params.cursor = cursor;
    if (filter?.siteId) params.siteIds = filter.siteId;
    if (filter?.groupId) params.groupIds = filter.groupId;
    if (filter?.status) params.incidentStatuses = filter.status;
    if (filter?.classification) params.classifications = filter.classification;
    if (filter?.severity) params.confidenceLevels = filter.severity;
    if (filter?.createdAfter) {
      params.createdAt__gte = filter.createdAfter.toISOString();
    }
    if (filter?.searchTerm) params.query = filter.searchTerm;

    const response = await this.client.requestS1<S1Threat[]>({
      path: "/threats",
      params,
    });

    return {
      data: response.data.map(mapThreat),
      hasMore: !!response.nextCursor,
      nextCursor: response.nextCursor,
      totalCount: response.totalItems,
    };
  }

  async getThreatById(id: string): Promise<NormalizedThreat> {
    const response = await this.client.requestS1<S1Threat[]>({
      path: "/threats",
      params: { ids: id },
    });

    if (!response.data.length) {
      throw new Error(`Threat ${id} not found`);
    }

    return mapThreat(response.data[0]);
  }

  // ─── Threat Actions ────────────────────────────────────────

  async mitigateThreat(
    threatId: string,
    action: MitigationAction
  ): Promise<void> {
    const actionMap: Record<MitigationAction, string> = {
      kill: "kill",
      quarantine: "quarantine",
      remediate: "remediate",
      rollback: "rollback",
    };

    await this.client.requestS1<S1AffectedResponse>({
      method: "POST",
      path: `/threats/mitigate/${actionMap[action]}`,
      body: {
        filter: { ids: [threatId] },
      },
    });
  }

  // ─── Agent Actions ─────────────────────────────────────────

  async isolateDevice(agentId: string): Promise<void> {
    await this.client.requestS1<S1AffectedResponse>({
      method: "POST",
      path: "/agents/actions/disconnect",
      body: {
        filter: { ids: [agentId] },
      },
    });
  }

  async unisolateDevice(agentId: string): Promise<void> {
    await this.client.requestS1<S1AffectedResponse>({
      method: "POST",
      path: "/agents/actions/connect",
      body: {
        filter: { ids: [agentId] },
      },
    });
  }

  async triggerFullScan(agentId: string): Promise<void> {
    await this.client.requestS1<S1AffectedResponse>({
      method: "POST",
      path: "/agents/actions/initiate-scan",
      body: {
        filter: { ids: [agentId] },
        data: { scanType: "full" },
      },
    });
  }

  // ─── Agents ────────────────────────────────────────────────

  async getAgents(
    filter?: AgentFilter,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedDevice>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: Math.min(pageSize, 1000),
      sortBy: "computerName",
      sortOrder: "asc",
    };

    if (cursor) params.cursor = cursor;
    if (filter?.siteId) params.siteIds = filter.siteId;
    if (filter?.groupId) params.groupIds = filter.groupId;
    if (filter?.status) {
      if (filter.status === "online") params.networkStatuses = "connected";
      if (filter.status === "offline") params.networkStatuses = "disconnected";
    }
    if (filter?.searchTerm) params.computerNameContains = filter.searchTerm;

    const response = await this.client.requestS1<S1Agent[]>({
      path: "/agents",
      params,
    });

    return {
      data: response.data.map(mapAgent),
      hasMore: !!response.nextCursor,
      nextCursor: response.nextCursor,
      totalCount: response.totalItems,
    };
  }

  async getAgentById(id: string): Promise<NormalizedDevice> {
    const response = await this.client.requestS1<S1Agent[]>({
      path: "/agents",
      params: { ids: id },
    });

    if (!response.data.length) {
      throw new Error(`Agent ${id} not found`);
    }

    return mapAgent(response.data[0]);
  }

  // ─── Sites & Groups ────────────────────────────────────────

  async getSites(): Promise<
    Array<{ id: string; name: string; state?: string; accountName?: string }>
  > {
    const response = await this.client.requestS1<{ sites: S1Site[] }>({
      path: "/sites",
      params: { limit: 1000 },
    });

    return response.data.sites.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      accountName: s.accountName,
    }));
  }

  async getGroups(
    siteId?: string
  ): Promise<Array<{ id: string; name: string; siteId?: string }>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: 1000,
    };
    if (siteId) params.siteIds = siteId;

    const response = await this.client.requestS1<S1Group[]>({
      path: "/groups",
      params,
    });

    return response.data.map((g) => ({
      id: g.id,
      name: g.name,
      siteId: g.siteId,
    }));
  }

  // ─── Exclusions ────────────────────────────────────────────

  async getExclusions(
    siteId?: string,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<{ id: string; type: string; value: string; description?: string }>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: Math.min(pageSize, 1000),
    };

    if (cursor) params.cursor = cursor;
    if (siteId) params.siteIds = siteId;

    const response = await this.client.requestS1<S1Exclusion[]>({
      path: "/exclusions",
      params,
    });

    return {
      data: response.data.map((e) => ({
        id: e.id,
        type: e.type ?? "unknown",
        value: e.value ?? "",
        description: e.description,
      })),
      hasMore: !!response.nextCursor,
      nextCursor: response.nextCursor,
    };
  }

  async createExclusion(
    input: CreateExclusionInput
  ): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      filter: {},
      data: {
        type: input.type,
        value: input.value,
        osType: input.osType ?? "windows",
        description: input.description,
      },
    };

    if (input.siteIds?.length) {
      (body.filter as Record<string, unknown>).siteIds = input.siteIds;
    }
    if (input.groupIds?.length) {
      (body.filter as Record<string, unknown>).groupIds = input.groupIds;
    }

    const response = await this.client.requestS1<S1Exclusion>({
      method: "POST",
      path: "/exclusions",
      body,
    });

    return { id: response.data.id };
  }

  // ─── Deep Visibility ──────────────────────────────────────

  async queryDeepVisibility(
    query: string,
    fromDate: Date,
    toDate: Date
  ): Promise<DeepVisibilityQuery> {
    const response = await this.client.requestS1<S1DeepVisibilityQuery>({
      method: "POST",
      path: "/dv/init-query",
      body: {
        query,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    });

    return {
      queryId: response.data.queryId,
      status: response.data.status === "RUNNING" ? "running" : "created",
    };
  }

  async getDeepVisibilityResults(
    queryId: string
  ): Promise<{ status: string; events: Array<Record<string, unknown>> }> {
    // Check query status first
    const statusResponse = await this.client.requestS1<{ queryState: string; responseState?: string }>({
      path: "/dv/query-status",
      params: { queryId },
    });

    const queryState = statusResponse.data.queryState;

    if (queryState !== "FINISHED") {
      return {
        status: queryState.toLowerCase(),
        events: [],
      };
    }

    // Fetch results
    const eventsResponse = await this.client.requestS1<S1DeepVisibilityEvent[]>({
      path: "/dv/events",
      params: { queryId, limit: 1000 },
    });

    return {
      status: "finished",
      events: eventsResponse.data,
    };
  }

  // ─── Activities ────────────────────────────────────────────

  async getActivities(
    filter?: { siteId?: string; activityType?: string; createdAfter?: Date },
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<{ id: string; type: string; description: string; timestamp: Date }>> {
    const params: Record<string, string | number | boolean | undefined> = {
      limit: Math.min(pageSize, 1000),
      sortBy: "createdAt",
      sortOrder: "desc",
    };

    if (cursor) params.cursor = cursor;
    if (filter?.siteId) params.siteIds = filter.siteId;
    if (filter?.activityType) params.activityTypes = filter.activityType;
    if (filter?.createdAfter) {
      params.createdAt__gte = filter.createdAfter.toISOString();
    }

    const response = await this.client.requestS1<S1Activity[]>({
      path: "/activities",
      params,
    });

    return {
      data: response.data.map((a) => ({
        id: a.id,
        type: String(a.activityType ?? "unknown"),
        description: a.primaryDescription ?? a.description ?? "",
        timestamp: a.createdAt ? new Date(a.createdAt) : new Date(),
      })),
      hasMore: !!response.nextCursor,
      nextCursor: response.nextCursor,
    };
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck() {
    return this.client.healthCheck();
  }
}
