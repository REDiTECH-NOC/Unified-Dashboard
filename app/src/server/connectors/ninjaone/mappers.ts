/**
 * NinjaOne → Normalized type mappers.
 */

import type {
  NormalizedDevice,
  NormalizedAlert,
  NormalizedOrganization,
} from "../_interfaces/common";
import type { NinjaDevice, NinjaAlert, NinjaOrganization } from "./types";

const TOOL_ID = "ninjaone";

function mapNodeClass(
  nodeClass?: string
): NormalizedDevice["deviceType"] {
  if (!nodeClass) return "other";
  const nc = nodeClass.toUpperCase();
  if (nc.includes("SERVER")) return "server";
  if (nc.includes("WORKSTATION")) return "workstation";
  if (nc.includes("LAPTOP")) return "laptop";
  if (nc.includes("MAC")) return "workstation";
  if (nc.includes("LINUX")) return "server";
  if (nc.includes("NETWORK") || nc.includes("NMS")) return "network";
  if (nc.includes("MOBILE")) return "mobile";
  return "other";
}

function mapDeviceStatus(device: NinjaDevice): NormalizedDevice["status"] {
  if (device.offline === true) return "offline";
  if (device.offline === false) return "online";
  if (device.approvalStatus === "PENDING") return "warning";
  return "unknown";
}

export function mapDevice(device: NinjaDevice): NormalizedDevice {
  return {
    sourceToolId: TOOL_ID,
    sourceId: String(device.id),
    hostname:
      device.displayName ??
      device.systemName ??
      device.dnsName ??
      `Device-${device.id}`,
    organizationSourceId: device.organizationId
      ? String(device.organizationId)
      : device.references?.organization?.id
        ? String(device.references.organization.id)
        : undefined,
    organizationName: device.references?.organization?.name,
    os: device.os?.name,
    osVersion: device.os?.buildNumber ?? device.os?.releaseId,
    publicIp: device.publicIP,
    privateIp: device.ipAddresses?.[0],
    macAddress: device.macAddresses?.[0],
    lastSeen: device.lastContact ? new Date(device.lastContact) : undefined,
    status: mapDeviceStatus(device),
    serialNumber: device.system?.serialNumber,
    model: device.system?.model,
    manufacturer: device.system?.manufacturer,
    deviceType: mapNodeClass(device.nodeClass),
    metadata: {
      nodeClass: device.nodeClass,
      policyId: device.policyId,
      location: device.references?.location?.name,
      needsReboot: device.os?.needsReboot,
    },
    _raw: device,
  };
}

function mapAlertSeverity(
  severity?: string
): NormalizedAlert["severity"] {
  if (!severity) return "informational";
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "MAJOR":
      return "high";
    case "MODERATE":
      return "medium";
    case "MINOR":
      return "low";
    default:
      return "informational";
  }
}

function mapAlertSeverityScore(severity?: string): number {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return 10;
    case "MAJOR":
      return 8;
    case "MODERATE":
      return 5;
    case "MINOR":
      return 3;
    default:
      return 1;
  }
}

export function mapAlert(alert: NinjaAlert): NormalizedAlert {
  return {
    sourceToolId: TOOL_ID,
    sourceId: String(alert.id),
    title: alert.subject ?? alert.message ?? `Alert ${alert.id}`,
    message: alert.message,
    severity: mapAlertSeverity(alert.severity),
    severityScore: mapAlertSeverityScore(alert.severity),
    category: alert.sourceType === "SECURITY" ? "security" : "performance",
    status: "new",
    deviceHostname: alert.device?.displayName ?? alert.device?.systemName,
    deviceSourceId: alert.deviceId ? String(alert.deviceId) : undefined,
    createdAt: alert.createTime ? new Date(alert.createTime) : new Date(),
    _raw: alert,
  };
}

export function mapOrganization(
  org: NinjaOrganization
): NormalizedOrganization {
  return {
    sourceToolId: TOOL_ID,
    sourceId: String(org.id),
    name: org.name,
    status: undefined,
    _raw: org,
  };
}
