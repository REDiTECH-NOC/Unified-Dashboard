/**
 * 3CX Connector — implements IPhoneConnector for PBX monitoring.
 *
 * Each instance represents one PBX (one customer). The ThreecxInstanceManager
 * handles resolving instance IDs to connector instances.
 *
 * Phase 2: Read-only monitoring endpoints only.
 * Phase 5: Service restart, backup trigger, and other write actions.
 */

import type { HealthCheckResult } from "../_base/types";
import type {
  IPhoneConnector,
  SystemStatus,
  SystemTelemetry,
  SystemHealthStatus,
  TrunkInfo,
  TrunkDetail,
  ExtensionInfo,
  ActiveCall,
  ServiceInfo,
  CallHistoryRecord,
  CallHistoryFilter,
  QueueInfo,
  RingGroupInfo,
  GroupInfo,
} from "../_interfaces/phone";
import { ThreecxClient } from "./client";
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
  ThreecxQueueManager,
  ThreecxRingGroup,
  ThreecxRingGroupMember,
  ThreecxGroup,
} from "./types";
import {
  mapSystemStatus,
  mapTelemetry,
  mapHealthStatus,
  mapTrunk,
  mapTrunkDetail,
  mapExtension,
  mapActiveCall,
  mapService,
  mapCallHistoryRecord,
  mapQueue,
  mapRingGroup,
  mapGroup,
} from "./mappers";

export class ThreecxConnector implements IPhoneConnector {
  private client: ThreecxClient;

  constructor(
    instanceId: string,
    fqdn: string,
    extensionNumber: string,
    password: string
  ) {
    this.client = new ThreecxClient(instanceId, fqdn, extensionNumber, password);
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const raw = await this.client.xapiRequest<ThreecxSystemStatus>(
      "/SystemStatus"
    );
    return mapSystemStatus(raw);
  }

  async getSystemTelemetry(): Promise<SystemTelemetry[]> {
    const raw = await this.client.xapiRequest<{
      value: ThreecxTelemetryPoint[];
    }>("/SystemStatus/Pbx.SystemTelemetry()");
    // 3CX wraps OData collections in { value: [...] }
    const points = Array.isArray(raw) ? raw : raw.value ?? [];
    return points.map(mapTelemetry);
  }

  async getSystemHealth(): Promise<SystemHealthStatus> {
    const raw = await this.client.xapiRequest<ThreecxHealthStatus>(
      "/SystemStatus/Pbx.SystemHealthStatus()"
    );
    return mapHealthStatus(raw);
  }

  async getTrunks(): Promise<TrunkInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxTrunk[] }>(
      "/Trunks"
    );
    const trunks = Array.isArray(raw) ? raw : raw.value ?? [];
    return trunks.map(mapTrunk);
  }

  async getUsers(): Promise<ExtensionInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxUser[] }>(
      "/Users"
    );
    const users = Array.isArray(raw) ? raw : raw.value ?? [];
    return users.map(mapExtension);
  }

  async getActiveCalls(): Promise<ActiveCall[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxActiveCall[] }>(
      "/ActiveCalls"
    );
    const calls = Array.isArray(raw) ? raw : raw.value ?? [];
    return calls.map(mapActiveCall);
  }

  async getServices(): Promise<ServiceInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxService[] }>(
      "/Services"
    );
    const services = Array.isArray(raw) ? raw : raw.value ?? [];
    return services.map(mapService);
  }

  async getTrunkDetails(): Promise<TrunkDetail[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxTrunkDetail[] }>(
      "/Trunks"
    );
    const trunks = Array.isArray(raw) ? raw : raw.value ?? [];
    return trunks.map(mapTrunkDetail);
  }

  async getQueues(): Promise<QueueInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxQueue[] }>(
      "/Queues"
    );
    const queues = Array.isArray(raw) ? raw : raw.value ?? [];

    // Fetch agents and managers for each queue in parallel
    const results = await Promise.all(
      queues.map(async (q) => {
        const [agentsRaw, managersRaw] = await Promise.all([
          this.client
            .xapiRequest<{ value: ThreecxQueueAgent[] }>(`/Queues(${q.Id})/Agents`)
            .catch(() => ({ value: [] as ThreecxQueueAgent[] })),
          this.client
            .xapiRequest<{ value: ThreecxQueueManager[] }>(`/Queues(${q.Id})/Managers`)
            .catch(() => ({ value: [] as ThreecxQueueManager[] })),
        ]);
        const agents = Array.isArray(agentsRaw) ? agentsRaw : agentsRaw.value ?? [];
        const managers = Array.isArray(managersRaw) ? managersRaw : managersRaw.value ?? [];
        return mapQueue(q, agents, managers.map((m) => m.Number));
      })
    );

    return results;
  }

  async getRingGroups(): Promise<RingGroupInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxRingGroup[] }>(
      "/RingGroups"
    );
    const groups = Array.isArray(raw) ? raw : raw.value ?? [];

    // Fetch members for each ring group in parallel
    const results = await Promise.all(
      groups.map(async (rg) => {
        const membersRaw = await this.client
          .xapiRequest<{ value: ThreecxRingGroupMember[] }>(`/RingGroups(${rg.Id})/Members`)
          .catch(() => ({ value: [] as ThreecxRingGroupMember[] }));
        const members = Array.isArray(membersRaw) ? membersRaw : membersRaw.value ?? [];
        return mapRingGroup(rg, members.map((m) => m.Number));
      })
    );

    return results;
  }

  async getGroups(): Promise<GroupInfo[]> {
    const raw = await this.client.xapiRequest<{ value: ThreecxGroup[] }>(
      "/Groups"
    );
    const groups = Array.isArray(raw) ? raw : raw.value ?? [];

    const results = await Promise.all(
      groups.map(async (g) => {
        const membersRaw = await this.client
          .xapiRequest<{ value: { Number: string }[] }>(`/Groups(${g.Id})/Members`)
          .catch(() => ({ value: [] as { Number: string }[] }));
        const members = Array.isArray(membersRaw) ? membersRaw : membersRaw.value ?? [];
        return mapGroup(g, members.map((m) => m.Number));
      })
    );

    return results;
  }

  /** Log a queue agent in to a specific queue */
  async queueAgentLogin(queueId: number, extensionNumber: string): Promise<void> {
    await this.client.xapiAction(`/Queues(${queueId})/Agents/Pbx.LogIn`, {
      Number: extensionNumber,
    });
  }

  /** Log a queue agent out of a specific queue */
  async queueAgentLogout(queueId: number, extensionNumber: string): Promise<void> {
    await this.client.xapiAction(`/Queues(${queueId})/Agents/Pbx.LogOut`, {
      Number: extensionNumber,
    });
  }

  async getCallHistory(top = 100, filter?: CallHistoryFilter): Promise<CallHistoryRecord[]> {
    const params: string[] = [
      `$top=${top}`,
      `$orderby=SegmentStartTime desc`,
    ];

    // Build OData $filter from filter options
    const filters: string[] = [];
    if (filter?.dateFrom) {
      filters.push(`SegmentStartTime ge ${filter.dateFrom}`);
    }
    if (filter?.dateTo) {
      // Add 1 day to make "to" inclusive (end of day)
      filters.push(`SegmentStartTime le ${filter.dateTo}`);
    }
    if (filter?.fromNumber) {
      const q = filter.fromNumber.replace(/'/g, "''"); // escape single quotes
      filters.push(`(contains(SrcCallerNumber,'${q}') or contains(SrcDisplayName,'${q}'))`);
    }
    if (filter?.toNumber) {
      const q = filter.toNumber.replace(/'/g, "''");
      filters.push(`(contains(DstCallerNumber,'${q}') or contains(DstDisplayName,'${q}'))`);
    }
    if (filter?.answered !== undefined) {
      filters.push(`CallAnswered eq ${filter.answered}`);
    }

    if (filters.length > 0) {
      params.push(`$filter=${filters.join(" and ")}`);
    }

    const raw = await this.client.xapiRequest<{ value: ThreecxCallHistoryRecord[] }>(
      `/CallHistoryView?${params.join("&")}`
    );
    const records = Array.isArray(raw) ? raw : raw.value ?? [];
    return records.map(mapCallHistoryRecord);
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }

  // ─── Admin Actions ───────────────────────────────────────

  /** Restart one or more services by name */
  async restartService(...serviceNames: string[]): Promise<void> {
    await this.client.xapiAction("/Services/Pbx.Restart", {
      options: { ServiceNames: serviceNames },
    });
  }

  /** Restart all restartable services */
  async restartAllServices(): Promise<void> {
    const services = await this.getServices();
    const names = services.filter((s) => s.restartEnabled).map((s) => s.name);
    if (names.length > 0) {
      await this.restartService(...names);
    }
  }

  /** Restart the PBX operating system */
  async restartServer(): Promise<void> {
    await this.client.xapiAction("/Services/Pbx.RestartOperatingSystem");
  }
}
