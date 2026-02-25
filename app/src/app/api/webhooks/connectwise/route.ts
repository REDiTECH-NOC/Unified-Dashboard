/**
 * ConnectWise Callback Webhook Receiver — ingests real-time ticket events.
 *
 * POST /api/webhooks/connectwise?secret=<CW_WEBHOOK_SECRET>
 *
 * CW sends callback payloads when tickets are added, updated, or deleted.
 * We fetch the full ticket, diff against cached state, and route
 * notifications to affected users via the notification engine.
 *
 * Env var: CW_WEBHOOK_SECRET
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  createNotification,
  resolveTicketOwner,
  getAllCwMappedUserIds,
  detectTicketChanges,
  detectNewReply,
  cacheTicketState,
  getCachedTicketState,
} from "@/lib/notification-engine";
import { ConnectorFactory } from "@/server/connectors/factory";
import type { IPsaConnector } from "@/server/connectors/_interfaces/psa";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface CWCallbackPayload {
  Action: string; // "added" | "updated" | "deleted"
  ID: number;
  Type: string; // "Ticket"
  MemberID?: number;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  // Validate shared secret
  const headerSecret =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const secret = headerSecret || querySecret || "";
  const expectedSecret = process.env.CW_WEBHOOK_SECRET;

  if (!expectedSecret || !secret || !timingSafeCompare(secret, expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: CWCallbackPayload;
  try {
    payload = (await request.json()) as CWCallbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process ticket events
  if (payload.Type !== "Ticket" || !payload.ID) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const ticketId = String(payload.ID);
  const action = payload.Action?.toLowerCase() ?? "unknown";

  // Audit log the webhook receipt
  try {
    await auditLog({
      action: "psa.webhook.received",
      category: "INTEGRATION",
      detail: { ticketId, action, type: payload.Type },
    });
  } catch {}

  // Deleted tickets — nothing to notify about
  if (action === "deleted") {
    return NextResponse.json({ received: true, action: "deleted" });
  }

  try {
    // Fetch full ticket from CW API
    const psa = (await ConnectorFactory.get("psa", prisma)) as IPsaConnector;
    const ticket = await psa.getTicketById(ticketId);

    // Extract CW owner object from raw ticket for reliable member lookup
    const rawTicket = ticket._raw as Record<string, any> | undefined;
    const ownerLookup = {
      memberId: rawTicket?.owner?.id ? String(rawTicket.owner.id) : undefined,
      memberIdentifier: rawTicket?.owner?.identifier as string | undefined,
    };

    if (action === "added") {
      let addedCount = 0;
      // New ticket — notify ticket owner if assigned
      if (ticket.assignedTo) {
        const ownerId = await resolveTicketOwner(ticket.assignedTo, ownerLookup);
        if (ownerId) {
          await createNotification({
            userId: ownerId,
            type: "ticket_assigned",
            title: `Ticket #${ticket.sourceId} assigned to you`,
            body: ticket.summary,
            linkUrl: `/tickets?id=${ticket.sourceId}`,
            sourceType: "connectwise_ticket",
            sourceId: ticket.sourceId,
            metadata: {
              companyName: ticket.companyName,
              priority: ticket.priority,
              action: "added",
            },
          });
          addedCount++;
        }
      }

      // Cache state for future diffs
      await cacheTicketState(ticketId, {
        status: ticket.status,
        assignedTo: ticket.assignedTo,
      });

      return NextResponse.json({ received: true, action: "added", notifications: addedCount });
    }

    // Updated ticket — detect changes
    const prevState = await getCachedTicketState(ticketId);
    const changes = detectTicketChanges(prevState, {
      status: ticket.status,
      assignedTo: ticket.assignedTo,
    });

    let notificationCount = 0;

    for (const change of changes) {
      if (change.type === "ticket_assigned" && ticket.assignedTo) {
        // Notify new assignee
        const ownerId = await resolveTicketOwner(ticket.assignedTo, ownerLookup);
        if (ownerId) {
          await createNotification({
            userId: ownerId,
            type: "ticket_assigned",
            title: `Ticket #${ticket.sourceId} assigned to you`,
            body: `${ticket.summary} — ${change.description}`,
            linkUrl: `/tickets?id=${ticket.sourceId}`,
            sourceType: "connectwise_ticket",
            sourceId: ticket.sourceId,
            metadata: { companyName: ticket.companyName, priority: ticket.priority },
          });
          notificationCount++;
        }
      }

      if (change.type === "ticket_status_changed" && ticket.assignedTo) {
        // Notify ticket owner about status change
        const ownerId = await resolveTicketOwner(ticket.assignedTo, ownerLookup);
        if (ownerId) {
          await createNotification({
            userId: ownerId,
            type: "ticket_status_changed",
            title: `Ticket #${ticket.sourceId} status changed`,
            body: `${ticket.summary} — ${change.description}`,
            linkUrl: `/tickets?id=${ticket.sourceId}`,
            sourceType: "connectwise_ticket",
            sourceId: ticket.sourceId,
            metadata: { companyName: ticket.companyName, newStatus: ticket.status },
          });
          notificationCount++;
        }
      }
    }

    // Check for new client reply (external note)
    try {
      const notes = await psa.getTicketNotes(ticketId);
      const reply = await detectNewReply(ticketId, notes);

      if (reply.isNew && ticket.assignedTo) {
        const ownerId = await resolveTicketOwner(ticket.assignedTo, ownerLookup);
        if (ownerId) {
          await createNotification({
            userId: ownerId,
            type: "ticket_reply",
            title: `New reply on ticket #${ticket.sourceId}`,
            body: `${ticket.companyName ?? "Client"} replied to: ${ticket.summary}`,
            linkUrl: `/tickets?id=${ticket.sourceId}`,
            sourceType: "connectwise_ticket",
            sourceId: ticket.sourceId,
            metadata: {
              companyName: ticket.companyName,
              noteId: reply.noteId,
              replyFrom: reply.createdBy,
            },
          });
          notificationCount++;
        }
      }
    } catch {
      // Don't fail the webhook if note detection fails
    }

    // Update cached state
    await cacheTicketState(ticketId, {
      status: ticket.status,
      assignedTo: ticket.assignedTo,
    });

    return NextResponse.json({
      received: true,
      action: "updated",
      notifications: notificationCount,
    });
  } catch (err: any) {
    console.error("[cw-webhook] Error processing ticket event:", err?.message);
    // Still return 200 so CW doesn't retry indefinitely
    return NextResponse.json({ received: true, error: err?.message }, { status: 200 });
  }
}
