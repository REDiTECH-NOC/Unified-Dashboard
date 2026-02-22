/**
 * IRmmConnector — interface for Remote Monitoring & Management tools.
 *
 * Current implementation: NinjaOne (NinjaRMM)
 * Future: Datto RMM, ConnectWise Automate, etc.
 */

import type { PaginatedResponse, HealthCheckResult } from "../_base/types";
import type {
  NormalizedDevice,
  NormalizedAlert,
  NormalizedOrganization,
} from "./common";

export interface DeviceFilter {
  organizationId?: string;
  status?: "online" | "offline";
  deviceType?: string;
  os?: string;
  searchTerm?: string;
}

export interface AlertFilter {
  organizationId?: string;
  severity?: string;
  status?: string;
  deviceId?: string;
  createdAfter?: Date;
}

export interface DeviceSoftware {
  name: string;
  version: string;
  publisher?: string;
  installDate?: string;
}

export interface DevicePatch {
  name: string;
  status: string;
  severity?: string;
  kb?: string;
  installedAt?: string;
}

export interface DeviceWindowsService {
  name: string;
  displayName: string;
  state: string;
  startType: string;
}

export interface IRmmConnector {
  // --- Devices ---
  getDevices(
    filter?: DeviceFilter,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedDevice>>;

  getDeviceById(id: string): Promise<NormalizedDevice>;

  getDeviceCustomFields(
    id: string
  ): Promise<Record<string, unknown>>;

  // --- Alerts ---
  getAlerts(
    filter?: AlertFilter,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<NormalizedAlert>>;

  acknowledgeAlert(id: string): Promise<void>;

  // --- Organizations ---
  getOrganizations(
    searchTerm?: string
  ): Promise<NormalizedOrganization[]>;

  getOrganizationById(id: string): Promise<NormalizedOrganization>;

  // --- Software Inventory ---
  getDeviceSoftware(deviceId: string): Promise<DeviceSoftware[]>;

  // --- OS Patches ---
  getDevicePatches(deviceId: string): Promise<DevicePatch[]>;

  // --- Windows Services ---
  getDeviceWindowsServices(
    deviceId: string
  ): Promise<DeviceWindowsService[]>;

  // --- Activities ---
  getDeviceActivities(
    deviceId: string,
    cursor?: string,
    pageSize?: number
  ): Promise<PaginatedResponse<{ id: string; type: string; message: string; timestamp: Date }>>;

  // --- Health Check ---
  healthCheck(): Promise<HealthCheckResult>;
}
