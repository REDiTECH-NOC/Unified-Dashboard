/**
 * Avanan → normalized type mappers.
 *
 * Maps Check Point Harmony Email API responses into the unified
 * NormalizedAlert and EmailEntity types used by the dashboard.
 */

import type { NormalizedAlert } from "../_interfaces/common";
import type { EmailEntity } from "../_interfaces/email-security";
import type { AvananSecurityEvent, AvananEntity } from "./types";

// ── Severity Mapping ──

const SEVERITY_MAP: Record<string, NormalizedAlert["severity"]> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "informational",
  info: "informational",
};

const SEVERITY_SCORE_MAP: Record<string, number> = {
  critical: 10,
  high: 8,
  medium: 5,
  low: 3,
  informational: 1,
  info: 1,
};

function mapSeverity(raw: string | undefined): NormalizedAlert["severity"] {
  if (!raw) return "informational";
  return SEVERITY_MAP[raw.toLowerCase()] ?? "informational";
}

function mapSeverityScore(raw: string | undefined): number {
  if (!raw) return 1;
  return SEVERITY_SCORE_MAP[raw.toLowerCase()] ?? 1;
}

// ── Status Mapping ──
// Swagger v1.40 states: new, detected, pending, remediated, dismissed, exception, in_progress

const STATUS_MAP: Record<string, NormalizedAlert["status"]> = {
  new: "new",
  detected: "new",
  pending: "new",
  dismissed: "resolved",
  resolved: "resolved",
  remediated: "resolved",
  exception: "resolved",
  in_progress: "acknowledged",
  acknowledged: "acknowledged",
};

function mapStatus(raw: string | undefined): NormalizedAlert["status"] {
  if (!raw) return "new";
  return STATUS_MAP[raw.toLowerCase()] ?? "new";
}

// ── Event → NormalizedAlert ──

export function mapSecurityEvent(event: AvananSecurityEvent): NormalizedAlert {
  return {
    sourceToolId: "avanan",
    sourceId: event.eventId,
    title: `[${event.type}] ${event.description || "Email security event"}`,
    message: event.description,
    severity: mapSeverity(event.severity),
    severityScore: mapSeverityScore(event.severity),
    category: "security",
    status: mapStatus(event.state),
    createdAt: new Date(event.eventCreated),
    sourceUrl: undefined,
    _raw: event,
  };
}

// ── Entity → EmailEntity ──

export function mapEntity(entity: AvananEntity): EmailEntity {
  const info = entity.entityInfo;
  const payload = entity.entityPayload;
  const security = entity.entitySecurityResults;

  return {
    entityId: info.entityId,
    customerId: info.customerId,
    saas: info.saas,
    saasEntityType: info.saasEntityType,
    subject: payload?.subject,
    fromEmail: payload?.fromEmail,
    recipients: [
      ...(payload?.toRecipients ?? []),
      ...(payload?.ccRecipients ?? []),
      ...(payload?.recipients ?? []),
    ].filter(Boolean),
    receivedAt: payload?.received ? new Date(payload.received) : undefined,
    size: payload?.size,
    attachmentCount: payload?.attachmentCount,
    isRead: payload?.isRead,
    isIncoming: payload?.isIncoming,
    securityResults: security
      ? {
          ap: security.ap,
          dlp: security.dlp,
          av: security.av,
          clickTimeProtection: security.clicktimeProtection,
          shadowIt: security.shadowIt,
        }
      : undefined,
    availableActions: entity.entityAvailableActions?.map((a) => a.actionName),
    _raw: entity,
  };
}
