/**
 * NinjaOne Webhook Receiver — ingests real-time alert events.
 *
 * POST /api/webhooks/ninjaone?secret=<NINJAONE_WEBHOOK_SECRET>
 *
 * NinjaOne sends webhook payloads for activity types:
 * - CONDITION: Alert triggers and resets
 * - DEVICE: Device online/offline events
 * - SYSTEM: System-level events
 *
 * Events are logged to the audit trail. When database schema
 * is updated (Phase B), alerts will be persisted to RmmAlert table.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";

/** Timing-safe comparison of two secret strings */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** NinjaOne webhook payload structure */
interface NinjaOneWebhookPayload {
  id: number;
  activityTime?: string;
  activityType?: string; // CONDITION, DEVICE, SYSTEM, USER, ACTIONSET
  statusCode?: string;   // TRIGGERED, RESET, etc.
  status?: string;
  activityResult?: string;
  userId?: number;
  deviceId?: number;
  message?: string;
  type?: string;
  data?: Record<string, unknown>;
}

function mapSeverity(
  payload: NinjaOneWebhookPayload
): { severity: string; score: number } {
  // Try to extract severity from nested data or status code
  const severity =
    (payload.data?.severity as string) ??
    (payload.data?.message as any)?.params?.severity ??
    "NONE";

  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return { severity: "critical", score: 10 };
    case "MAJOR":
      return { severity: "high", score: 8 };
    case "MODERATE":
      return { severity: "medium", score: 5 };
    case "MINOR":
      return { severity: "low", score: 3 };
    default:
      return { severity: "informational", score: 1 };
  }
}

export async function POST(request: Request) {
  // Validate shared secret — accept from header (preferred) or query param (legacy)
  const headerSecret = request.headers.get("x-webhook-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const secret = headerSecret || querySecret || "";
  const expectedSecret = process.env.NINJAONE_WEBHOOK_SECRET;

  if (!expectedSecret || !secret || !timingSafeCompare(secret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: NinjaOneWebhookPayload;
  try {
    payload = (await request.json()) as NinjaOneWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { severity, score } = mapSeverity(payload);

  // Audit log the webhook receipt
  try {
    await auditLog({
      action: "rmm.webhook.received",
      category: "INTEGRATION",
      actorId: "system",
      detail: {
        sourceId: String(payload.id),
        activityType: payload.activityType,
        statusCode: payload.statusCode,
        severity,
        severityScore: score,
        deviceId: payload.deviceId,
        message: payload.message,
      },
    });
  } catch {
    // Don't fail the webhook response if audit logging fails
  }

  // TODO (Phase B): Persist to RmmAlert table when schema is available
  // For now, events are audit-logged and available via the existing
  // live-polling alert triage page (trpc.rmm.getAlerts)

  return NextResponse.json({ received: true, id: payload.id });
}
