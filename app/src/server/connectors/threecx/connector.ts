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
  ExtensionInfo,
  ActiveCall,
  ServiceInfo,
} from "../_interfaces/phone";
import { ThreecxClient } from "./client";
import type {
  ThreecxSystemStatus,
  ThreecxTelemetryPoint,
  ThreecxHealthStatus,
  ThreecxTrunk,
  ThreecxUser,
  ThreecxActiveCall,
  ThreecxService,
} from "./types";
import {
  mapSystemStatus,
  mapTelemetry,
  mapHealthStatus,
  mapTrunk,
  mapExtension,
  mapActiveCall,
  mapService,
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

  async healthCheck(): Promise<HealthCheckResult> {
    return this.client.healthCheck();
  }
}
