/**
 * SentinelOne → Normalized type mappers.
 */

import type { NormalizedThreat, NormalizedDevice } from "../_interfaces/common";
import type { S1Threat, S1Agent } from "./types";

const TOOL_ID = "sentinelone";

function mapThreatSeverity(
  threat: S1Threat
): NormalizedThreat["severity"] {
  const confidence = threat.threatInfo?.confidenceLevel?.toLowerCase();
  const classification = threat.threatInfo?.classification?.toLowerCase();

  if (confidence === "malicious" || classification === "malware") return "critical";
  if (classification === "pup" || classification === "adware") return "medium";
  if (confidence === "suspicious") return "high";
  return "medium";
}

function mapThreatSeverityScore(threat: S1Threat): number {
  const confidence = threat.threatInfo?.confidenceLevel?.toLowerCase();
  const classification = threat.threatInfo?.classification?.toLowerCase();

  if (confidence === "malicious" && classification === "malware") return 10;
  if (confidence === "malicious") return 9;
  if (confidence === "suspicious") return 7;
  if (classification === "pup") return 4;
  return 5;
}

function mapThreatStatus(
  threat: S1Threat
): NormalizedThreat["status"] {
  const status = threat.threatInfo?.mitigationStatus?.toLowerCase();
  const incident = threat.threatInfo?.incidentStatus?.toLowerCase();

  if (status === "mitigated" || incident === "resolved") return "resolved";
  if (status === "active" || status === "not_mitigated") return "active";
  if (incident === "in_progress") return "in_progress";
  if (status === "blocked" || status === "marked_as_benign") return "mitigated";
  return "active";
}

export function mapThreat(threat: S1Threat): NormalizedThreat {
  const info = threat.threatInfo;
  const detection = threat.agentDetectionInfo;
  const realtime = threat.agentRealtimeInfo;

  return {
    sourceToolId: TOOL_ID,
    sourceId: threat.id,
    title: info?.threatName ?? `Threat ${threat.id}`,
    description: info?.classification
      ? `${info.classification} - ${info.classificationSource ?? "unknown source"}`
      : undefined,
    severity: mapThreatSeverity(threat),
    severityScore: mapThreatSeverityScore(threat),
    status: mapThreatStatus(threat),
    classification: info?.classification,
    deviceHostname:
      realtime?.agentComputerName ??
      detection?.agentDomain,
    deviceSourceId: threat.agentId,
    organizationName: detection?.siteName ?? realtime?.siteName,
    organizationSourceId: detection?.siteId ?? realtime?.siteId,
    indicators: {
      filePath: info?.filePath,
      fileHash: info?.sha256 ?? info?.sha1 ?? info?.md5,
      processName: info?.originatorProcess,
    },
    detectedAt: info?.identifiedAt
      ? new Date(info.identifiedAt)
      : info?.createdAt
        ? new Date(info.createdAt)
        : new Date(),
    resolvedAt: undefined,
    availableActions: [
      "kill",
      "quarantine",
      "remediate",
      "rollback",
      "isolate",
      "scan",
    ],
    _raw: threat,
  };
}

function mapAgentStatus(agent: S1Agent): NormalizedDevice["status"] {
  if (agent.isDecommissioned || agent.isUninstalled) return "offline";
  if (!agent.isActive) return "offline";
  if (agent.infected || (agent.activeThreats ?? 0) > 0) return "warning";
  if (agent.networkStatus === "connected") return "online";
  if (agent.networkStatus === "disconnected") return "offline";
  return "unknown";
}

function mapMachineType(
  machineType?: string
): NormalizedDevice["deviceType"] {
  if (!machineType) return "other";
  const mt = machineType.toLowerCase();
  if (mt.includes("server")) return "server";
  if (mt.includes("laptop")) return "laptop";
  if (mt.includes("desktop") || mt.includes("workstation")) return "workstation";
  return "other";
}

export function mapAgent(agent: S1Agent): NormalizedDevice {
  const primaryIp = agent.networkInterfaces?.[0]?.inet?.[0];

  return {
    sourceToolId: TOOL_ID,
    sourceId: agent.id,
    hostname:
      agent.computerName ?? `Agent-${agent.id}`,
    organizationSourceId: agent.siteId,
    organizationName: agent.siteName,
    os: agent.osName,
    osVersion: agent.osRevision,
    publicIp: agent.externalIp,
    privateIp: agent.lastIpToMgmt ?? primaryIp,
    lastSeen: agent.lastActiveDate
      ? new Date(agent.lastActiveDate)
      : undefined,
    status: mapAgentStatus(agent),
    agentVersion: agent.agentVersion,
    serialNumber: agent.serialNumber,
    model: agent.modelName,
    manufacturer: agent.manufacturerName,
    deviceType: mapMachineType(agent.machineType),
    metadata: {
      groupName: agent.groupName,
      groupId: agent.groupId,
      accountName: agent.accountName,
      networkStatus: agent.networkStatus,
      scanStatus: agent.scanStatus,
      activeThreats: agent.activeThreats,
      infected: agent.infected,
      operationalState: agent.operationalState,
    },
    _raw: agent,
  };
}
