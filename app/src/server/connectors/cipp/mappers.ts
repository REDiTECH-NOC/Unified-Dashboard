/**
 * CIPP mappers — normalize CIPP security data to unified types.
 *
 * Most CIPP data is passed through as native types (CIPPUser, CIPPTenant, etc.)
 * since M365 users/tenants don't map to existing normalized types.
 * Only security alerts are mapped for cross-tool aggregation on the alerts page.
 */

import type { NormalizedAlert } from "../_interfaces/common";
import type { CIPPSecurityAlert } from "./types";

const TOOL_ID = "cipp";

export function mapSecurityAlertToNormalized(alert: CIPPSecurityAlert): NormalizedAlert {
  return {
    sourceToolId: TOOL_ID,
    sourceId: alert.id,
    title: alert.title,
    message: alert.description,
    severity: mapSeverity(alert.severity),
    severityScore: mapSeverityScore(alert.severity),
    category: "security",
    status: mapAlertStatus(alert.status),
    createdAt: new Date(alert.createdDateTime),
    _raw: alert,
  };
}

function mapSeverity(severity: string): NormalizedAlert["severity"] {
  switch (severity?.toLowerCase()) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "informational":
      return "informational";
    default:
      return "medium";
  }
}

function mapSeverityScore(severity: string): number {
  switch (severity?.toLowerCase()) {
    case "high":
      return 8;
    case "medium":
      return 5;
    case "low":
      return 3;
    case "informational":
      return 1;
    default:
      return 5;
  }
}

function mapAlertStatus(status: string): NormalizedAlert["status"] {
  switch (status?.toLowerCase()) {
    case "new":
    case "newalert":
      return "new";
    case "inprogress":
    case "in_progress":
      return "acknowledged";
    case "resolved":
      return "resolved";
    default:
      return "new";
  }
}
