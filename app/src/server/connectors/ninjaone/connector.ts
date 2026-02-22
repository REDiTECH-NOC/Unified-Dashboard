/**
 * NinjaOne RMM Connector — implements IRmmConnector.
 *
 * Devices, alerts, organizations, software inventory, patches,
 * Windows services, and activities via NinjaOne REST API v2.
 */

import type { ConnectorConfig, PaginatedResponse } from "../_base/types";
import type { IRmmConnector, DeviceFilter, AlertFilter, DeviceSoftware, DevicePatch, DeviceWindowsService } from "../_interfaces/rmm";
import type { NormalizedDevice, NormalizedAlert, NormalizedOrganization } from "../_interfaces/common";
import { NinjaOneClient } from "./client";
import type { NinjaDevice, NinjaDevicesResponse, NinjaAlert, NinjaAlertsResponse, NinjaOrganization, NinjaSoftware, NinjaPatch, NinjaWindowsService, NinjaActivity, NinjaActivitiesResponse } from "./types";
import { mapDevice, mapAlert, mapOrganization } from "./mappers";

export class NinjaOneRmmConnector implements IRmmConnector {
  private client: NinjaOneClient;

  constructor(config: ConnectorConfig) {
    this.client = new NinjaOneClient(config);
  }

  // ─── Devices ───────────────────────────────────────────────

  async getDevices(
    filter?: DeviceFilter,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedDevice>> {
    const params: Record<string, string | number | boolean | undefined> = {
      pageSize,
    };

    if (cursor) params.after = cursor;
    if (filter?.organizationId) params.organizationId = filter.organizationId;
    if (filter?.status === "online") params.online = true;
    if (filter?.status === "offline") params.online = false;
    if (filter?.deviceType) params.nodeClass = filter.deviceType;

    // Use detailed endpoint for full device info
    const response = await this.client["request"]<NinjaDevice[] | NinjaDevicesResponse>({
      path: "/devices-detailed",
      params,
    });

    // NinjaOne may return array directly or wrapped in results
    const devices = Array.isArray(response)
      ? response
      : response.results ?? [];
    const nextCursor = Array.isArray(response)
      ? undefined
      : response.cursor;

    return {
      data: devices.map(mapDevice),
      hasMore: !!nextCursor || devices.length === pageSize,
      nextCursor: nextCursor,
    };
  }

  async getDeviceById(id: string): Promise<NormalizedDevice> {
    const device = await this.client["request"]<NinjaDevice>({
      path: `/device/${id}`,
    });
    return mapDevice(device);
  }

  async getDeviceCustomFields(id: string): Promise<Record<string, unknown>> {
    const fields = await this.client["request"]<Record<string, unknown>>({
      path: `/device/${id}/custom-fields`,
    });
    return fields;
  }

  // ─── Alerts ────────────────────────────────────────────────

  async getAlerts(
    filter?: AlertFilter,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<NormalizedAlert>> {
    const params: Record<string, string | number | boolean | undefined> = {
      pageSize,
    };

    if (cursor) params.after = cursor;
    if (filter?.deviceId) params.deviceId = filter.deviceId;
    if (filter?.severity) params.severity = filter.severity;
    if (filter?.createdAfter) {
      params.after = String(filter.createdAfter.getTime());
    }

    const response = await this.client["request"]<NinjaAlert[] | NinjaAlertsResponse>({
      path: "/alerts",
      params,
    });

    const alerts = Array.isArray(response)
      ? response
      : response.results ?? [];
    const nextCursor = Array.isArray(response)
      ? undefined
      : response.cursor;

    return {
      data: alerts.map(mapAlert),
      hasMore: !!nextCursor || alerts.length === pageSize,
      nextCursor,
    };
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await this.client["request"]<void>({
      method: "POST",
      path: `/alert/${id}/reset`,
    });
  }

  // ─── Organizations ────────────────────────────────────────

  async getOrganizations(
    searchTerm?: string
  ): Promise<NormalizedOrganization[]> {
    const orgs = await this.client["request"]<NinjaOrganization[]>({
      path: "/organizations",
      params: { pageSize: 1000 },
    });

    let filtered = orgs;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = orgs.filter((o) =>
        o.name.toLowerCase().includes(term)
      );
    }

    return filtered.map(mapOrganization);
  }

  async getOrganizationById(id: string): Promise<NormalizedOrganization> {
    const org = await this.client["request"]<NinjaOrganization>({
      path: `/organization/${id}`,
    });
    return mapOrganization(org);
  }

  // ─── Software Inventory ────────────────────────────────────

  async getDeviceSoftware(deviceId: string): Promise<DeviceSoftware[]> {
    const software = await this.client["request"]<NinjaSoftware[]>({
      path: `/device/${deviceId}/software`,
    });

    return software.map((s) => ({
      name: s.name,
      version: s.version ?? "",
      publisher: s.publisher,
      installDate: s.installDate,
    }));
  }

  // ─── OS Patches ────────────────────────────────────────────

  async getDevicePatches(deviceId: string): Promise<DevicePatch[]> {
    const patches = await this.client["request"]<NinjaPatch[]>({
      path: `/device/${deviceId}/os-patches`,
    });

    return patches.map((p) => ({
      name: p.name,
      status: p.status ?? "unknown",
      severity: p.severity,
      kb: p.kbNumber,
      installedAt: p.installedAt,
    }));
  }

  // ─── Windows Services ──────────────────────────────────────

  async getDeviceWindowsServices(
    deviceId: string
  ): Promise<DeviceWindowsService[]> {
    const services = await this.client["request"]<NinjaWindowsService[]>({
      path: `/device/${deviceId}/windows-services`,
    });

    return services.map((s) => ({
      name: s.serviceName,
      displayName: s.displayName,
      state: s.state,
      startType: s.startType,
    }));
  }

  // ─── Activities ────────────────────────────────────────────

  async getDeviceActivities(
    deviceId: string,
    cursor?: string,
    pageSize = 50
  ): Promise<PaginatedResponse<{ id: string; type: string; message: string; timestamp: Date }>> {
    const params: Record<string, string | number | boolean | undefined> = {
      pageSize,
    };
    if (cursor) params.after = cursor;

    const response = await this.client["request"]<NinjaActivity[] | NinjaActivitiesResponse>({
      path: `/device/${deviceId}/activities`,
      params,
    });

    const activities = Array.isArray(response)
      ? response
      : response.activities ?? [];

    return {
      data: activities.map((a) => ({
        id: String(a.id),
        type: a.activityType ?? "unknown",
        message: a.message ?? a.subject ?? "",
        timestamp: a.activityTime ? new Date(a.activityTime) : new Date(),
      })),
      hasMore: activities.length === pageSize,
    };
  }

  // ─── Health Check ──────────────────────────────────────────

  async healthCheck() {
    return this.client.healthCheck();
  }
}
