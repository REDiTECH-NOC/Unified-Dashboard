/**
 * Blackpoint CompassOne mappers — pure functions mapping vendor types to normalized types.
 */

import type { NormalizedThreat, NormalizedAlert, NormalizedDevice, NormalizedOrganization } from "../_interfaces/common";
import type { BPAlertGroup, BPAlert, BPAsset, BPDevice, BPTenant } from "./types";

const TOOL_ID = "blackpoint";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function riskScoreToSeverity(riskScore: number): NormalizedThreat["severity"] {
  if (riskScore >= 80) return "critical";
  if (riskScore >= 60) return "high";
  if (riskScore >= 40) return "medium";
  if (riskScore >= 20) return "low";
  return "informational";
}

/** Map 0-100 risk score to 1-10 severity score for cross-tool comparison */
function riskScoreToSeverityScore(riskScore: number): number {
  return Math.max(1, Math.min(10, Math.ceil(riskScore / 10)));
}

function alertGroupStatusToNormalized(status: string): NormalizedThreat["status"] {
  switch (status) {
    case "OPEN": return "active";
    case "RESOLVED": return "resolved";
    default: return "active";
  }
}

function ticketStatusToThreatStatus(ticketStatus?: string): NormalizedThreat["status"] {
  switch (ticketStatus) {
    case "CLOSE":
    case "RESOLVE": return "resolved";
    case "INVESTIGATE":
    case "CLAIM": return "in_progress";
    case "ESCALATE": return "active";
    default: return "active";
  }
}

// ---------------------------------------------------------------------------
// Alert Group → NormalizedThreat
// ---------------------------------------------------------------------------

export function mapAlertGroupToThreat(alertGroup: BPAlertGroup): NormalizedThreat {
  const status = alertGroup.ticket
    ? ticketStatusToThreatStatus(alertGroup.ticket.status)
    : alertGroupStatusToNormalized(alertGroup.status);

  return {
    sourceToolId: TOOL_ID,
    sourceId: alertGroup.id,
    title: alertGroup.alertTypes.length > 0
      ? `[Blackpoint] ${alertGroup.alertTypes.join(", ")}`
      : `[Blackpoint] Detection ${alertGroup.groupKey}`,
    description: alertGroup.alert
      ? `${alertGroup.alert.action ?? "Detection"} on ${alertGroup.alert.hostname ?? "unknown host"} by ${alertGroup.alert.username ?? "unknown user"}`
      : `${alertGroup.alertCount} alert(s) in group`,
    severity: riskScoreToSeverity(alertGroup.riskScore),
    severityScore: riskScoreToSeverityScore(alertGroup.riskScore),
    status,
    classification: alertGroup.alertTypes[0] ?? undefined,
    deviceHostname: alertGroup.alert?.hostname ?? undefined,
    deviceSourceId: alertGroup.alert?.deviceId ?? undefined,
    organizationSourceId: alertGroup.customerId,
    indicators: alertGroup.alert ? {
      processName: alertGroup.alert.action ?? undefined,
      networkTarget: alertGroup.alert.eventProvider ?? undefined,
    } : undefined,
    detectedAt: new Date(alertGroup.created),
    resolvedAt: alertGroup.status === "RESOLVED" && alertGroup.updated
      ? new Date(alertGroup.updated)
      : undefined,
    availableActions: [], // Blackpoint SOC handles actions — no self-service actions
    _raw: alertGroup,
  };
}

// ---------------------------------------------------------------------------
// Alert → NormalizedAlert
// ---------------------------------------------------------------------------

export function mapAlertToNormalized(alert: BPAlert): NormalizedAlert {
  return {
    sourceToolId: TOOL_ID,
    sourceId: alert.id,
    title: alert.ruleName ?? alert.action ?? `Alert ${alert.id.substring(0, 8)}`,
    message: [
      alert.action && `Action: ${alert.action}`,
      alert.hostname && `Host: ${alert.hostname}`,
      alert.username && `User: ${alert.username}`,
      alert.eventProvider && `Provider: ${alert.eventProvider}`,
      alert.threatFramework && `Framework: ${alert.threatFramework}`,
    ].filter(Boolean).join(" | ") || undefined,
    severity: riskScoreToSeverity(alert.riskScore),
    severityScore: riskScoreToSeverityScore(alert.riskScore),
    category: "security",
    status: "new",
    deviceHostname: alert.hostname ?? undefined,
    deviceSourceId: alert.deviceId ?? undefined,
    organizationSourceId: alert.customerId,
    createdAt: new Date(alert.created),
    _raw: alert,
  };
}

// ---------------------------------------------------------------------------
// Asset (Device) → NormalizedDevice
// ---------------------------------------------------------------------------

function isDevice(asset: BPAsset): asset is BPDevice {
  return asset.assetClass === "DEVICE";
}

function assetStatusToNormalized(asset: BPAsset): NormalizedDevice["status"] {
  if (asset.status === "active" || asset.status === "online") return "online";
  if (asset.status === "inactive" || asset.status === "offline") return "offline";
  if (asset.status === "warning") return "warning";

  // Infer from lastSeenOn — if seen in last 24h, consider online
  if (asset.lastSeenOn) {
    const lastSeen = new Date(asset.lastSeenOn);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (lastSeen > dayAgo) return "online";
    return "offline";
  }

  return "unknown";
}

function inferDeviceType(asset: BPAsset): NormalizedDevice["deviceType"] {
  const name = (asset.name ?? "").toLowerCase();
  const type = (asset.type ?? "").toLowerCase();
  const classification = (asset.classification ?? "").toLowerCase();
  const combined = `${name} ${type} ${classification}`;

  if (combined.includes("server")) return "server";
  if (combined.includes("laptop")) return "laptop";
  if (combined.includes("workstation") || combined.includes("desktop")) return "workstation";
  if (combined.includes("mobile") || combined.includes("phone") || combined.includes("tablet")) return "mobile";
  if (combined.includes("switch") || combined.includes("router") || combined.includes("firewall") || combined.includes("ap")) return "network";
  if (asset.assetClass === "CONTAINER") return "other";
  return "workstation"; // default assumption for endpoints
}

export function mapAssetToDevice(asset: BPAsset): NormalizedDevice {
  const device = isDevice(asset) ? asset : null;

  return {
    sourceToolId: TOOL_ID,
    sourceId: asset.id,
    hostname: device?.hostname ?? asset.displayName ?? asset.name,
    organizationSourceId: asset.tenantId,
    os: device?.osName ?? device?.platform ?? undefined,
    osVersion: device?.osVersion ?? undefined,
    publicIp: device?.publicIps?.[0] ?? undefined,
    privateIp: device?.ips?.[0] ?? undefined,
    macAddress: device?.macs?.[0] ?? undefined,
    lastSeen: asset.lastSeenOn ? new Date(asset.lastSeenOn) : undefined,
    status: assetStatusToNormalized(asset),
    agentVersion: device?.agentVersion ?? undefined,
    serialNumber: device?.hardwareSerial ?? undefined,
    model: device?.hardwareModel ?? asset.model,
    manufacturer: device?.hardwareVendor ?? undefined,
    deviceType: inferDeviceType(asset),
    metadata: {
      assetClass: asset.assetClass,
      criticality: asset.criticality,
      classification: asset.classification,
      production: asset.production,
      tags: asset.tags?.map(t => t.name),
      sources: asset.sources?.map(s => s.name),
      encrypted: device?.encrypted,
      firewallEnabled: device?.firewallEnabled,
      malwareProtected: device?.malwareProtected,
      osIsEol: device?.osIsEol,
      osUpdatesEnabled: device?.osUpdatesEnabled,
      windowsDefenderEnabled: device?.windowsDefenderEnabled,
    },
    _raw: asset,
  };
}

// ---------------------------------------------------------------------------
// Tenant → NormalizedOrganization
// ---------------------------------------------------------------------------

export function mapTenantToOrganization(tenant: BPTenant): NormalizedOrganization {
  return {
    sourceToolId: TOOL_ID,
    sourceId: tenant.id,
    name: tenant.name,
    status: "active",
    _raw: tenant,
  };
}
