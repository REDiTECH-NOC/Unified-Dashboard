/**
 * UniFi API response → normalized type mappers.
 */

import type { NormalizedDevice } from "../_interfaces/common";
import type { NetworkSite, NetworkHost } from "../_interfaces/network";
import type { UnifiDevice, UnifiSite, UnifiHost } from "./types";

/** Map UniFi device status to normalized status */
function mapStatus(status: string): NormalizedDevice["status"] {
  switch (status.toLowerCase()) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    case "updating":
    case "provisioning":
    case "adopting":
    case "pending":
      return "warning";
    default:
      return "unknown";
  }
}

/** Map UniFi device to NormalizedDevice */
export function mapDevice(
  device: UnifiDevice,
  hostId: string,
  hostName: string
): NormalizedDevice {
  return {
    sourceToolId: "unifi",
    sourceId: device.id,
    hostname: device.name || device.shortname || device.mac,
    organizationSourceId: hostId,
    organizationName: hostName,
    publicIp: undefined,
    privateIp: device.ip,
    macAddress: device.mac,
    lastSeen: device.startupTime ? new Date(device.startupTime) : undefined,
    status: mapStatus(device.status),
    agentVersion: device.version,
    model: device.model,
    manufacturer: "Ubiquiti",
    deviceType: "network",
    metadata: {
      productLine: device.productLine,
      shortname: device.shortname,
      firmwareStatus: device.firmwareStatus,
      isConsole: device.isConsole,
      isManaged: device.isManaged,
      updateAvailable: device.updateAvailable,
      hostId,
      hostName,
    },
  };
}

/** Map UniFi site to NetworkSite */
export function mapSite(site: UnifiSite): NetworkSite {
  return {
    sourceToolId: "unifi",
    siteId: site.siteId,
    hostId: site.hostId,
    name: site.meta.name,
    description: site.meta.desc,
    timezone: site.meta.timezone,
    gatewayMac: site.meta.gatewayMac,
    permission: site.permission,
    isOwner: site.isOwner,
    _raw: site,
  };
}

/** Map UniFi host to NetworkHost */
export function mapHost(host: UnifiHost): NetworkHost {
  return {
    sourceToolId: "unifi",
    id: host.id,
    name:
      host.reportedState?.name ||
      host.reportedState?.hostname ||
      host.userData?.name,
    ipAddress: host.ipAddress,
    type: host.type,
    isBlocked: host.isBlocked,
    isOwner: host.owner,
    lastConnectionStateChange: host.lastConnectionStateChange
      ? new Date(host.lastConnectionStateChange)
      : undefined,
    latestBackupTime: host.latestBackupTime
      ? new Date(host.latestBackupTime)
      : undefined,
    registrationTime: host.registrationTime
      ? new Date(host.registrationTime)
      : undefined,
    firmwareVersion: host.reportedState?.firmware,
    _raw: host,
  };
}
