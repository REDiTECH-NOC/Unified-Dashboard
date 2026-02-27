/**
 * Notification Inbox Router — tRPC procedures for in-app notification management.
 *
 * All procedures are protectedProcedure (authenticated users only).
 * Each user can only access their own notifications.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { redis } from "@/lib/redis";
import { ConnectorFactory } from "../connectors/factory";
import type { IPsaConnector } from "../connectors/_interfaces/psa";
import {
  createNotification,
  resolveAllTicketRecipients,
  resolveTicketOwner,
  detectTicketChanges,
  detectNewReply,
  cacheTicketState,
  getCachedTicketState,
} from "@/lib/notification-engine";

export const notificationInboxRouter = router({
  /**
   * Get paginated notifications for the current user.
   */
  list: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { userId: ctx.user.id };
      if (input.unreadOnly) {
        where.read = false;
      }

      const notifications = await ctx.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (notifications.length > input.limit) {
        const last = notifications.pop()!;
        nextCursor = last.id;
      }

      return { notifications, nextCursor };
    }),

  /**
   * Get unread notification count for the current user.
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.inAppNotification.count({
      where: { userId: ctx.user.id, read: false },
    });
    return { count };
  }),

  /**
   * Mark a single notification as read.
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.inAppNotification.updateMany({
        where: { id: input.id, userId: ctx.user.id },
        data: { read: true },
      });
      return { success: true };
    }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.inAppNotification.updateMany({
      where: { userId: ctx.user.id, read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }),

  /**
   * Dismiss (delete) a single notification.
   */
  dismiss: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.inAppNotification.deleteMany({
        where: { id: input.id, userId: ctx.user.id },
      });
      await auditLog({
        action: "notification.dismissed",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `notification:${input.id}`,
      });
      return { success: true };
    }),

  /**
   * Register a CW callback to receive ticket events.
   * Admin-only. Calls CW API POST /system/callbacks.
   */
  registerCwCallback: adminProcedure
    .input(
      z.object({
        webhookUrl: z.string().url(),
        secret: z.string().min(16),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = (await ConnectorFactory.get(
        "psa",
        ctx.prisma
      )) as IPsaConnector;

      // The CW client exposes the underlying HTTP client for raw requests
      const client = (psa as any).client;
      if (!client?.request) {
        throw new Error(
          "ConnectWise connector does not expose HTTP client for callback registration"
        );
      }

      const callbackUrl = input.webhookUrl.includes("?")
        ? `${input.webhookUrl}&secret=${input.secret}`
        : `${input.webhookUrl}?secret=${input.secret}`;

      const result = await client.request({
        method: "POST",
        path: "/system/callbacks",
        body: {
          url: callbackUrl,
          objectId: 0,
          type: "Ticket",
          level: "Owner",
          description: "RCC Ticket Notifications",
        },
      });

      await auditLog({
        action: "psa.callback.registered",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: {
          webhookUrl: input.webhookUrl,
          callbackId: result?.id,
        },
      });

      return { success: true, callbackId: result?.id };
    }),

  /**
   * List existing CW callbacks. Admin-only.
   */
  listCwCallbacks: adminProcedure.query(async ({ ctx }) => {
    try {
      const psa = (await ConnectorFactory.get(
        "psa",
        ctx.prisma
      )) as IPsaConnector;
      const client = (psa as any).client;
      if (!client?.request) return [];
      const callbacks = await client.request({ method: "GET", path: "/system/callbacks" });
      return Array.isArray(callbacks) ? callbacks : [];
    } catch {
      return [];
    }
  }),

  /**
   * Delete a CW callback. Admin-only.
   */
  deleteCwCallback: adminProcedure
    .input(z.object({ callbackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const psa = (await ConnectorFactory.get(
        "psa",
        ctx.prisma
      )) as IPsaConnector;
      const client = (psa as any).client;
      if (!client?.request) {
        throw new Error("ConnectWise connector does not expose HTTP client");
      }
      await client.request({
        method: "DELETE",
        path: `/system/callbacks/${input.callbackId}`,
      });
      await auditLog({
        action: "psa.callback.deleted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: { callbackId: input.callbackId },
      });
      return { success: true };
    }),

  /**
   * Poll CW for recently updated tickets and create notifications.
   * Uses a Redis lock to prevent concurrent/redundant polls (90s cooldown).
   * Any authenticated user can trigger it; it processes ALL mapped users.
   */
  pollTickets: protectedProcedure.mutation(async ({ ctx }) => {
    // Redis lock — only one poll per 90 seconds
    const lockKey = "ticket-poll:lock";
    const acquired = await redis.set(lockKey, "1", "EX", 90, "NX");
    if (!acquired) {
      return { skipped: true, reason: "poll_cooldown", notifications: 0 };
    }

    try {
      const psa = (await ConnectorFactory.get("psa", ctx.prisma)) as IPsaConnector;

      // Get all users with CW integration mappings
      const mappings = await ctx.prisma.userIntegrationMapping.findMany({
        where: { toolId: "connectwise" },
      });
      if (mappings.length === 0) {
        return { skipped: true, reason: "no_mappings", notifications: 0 };
      }

      // Fetch CW members for resource identifier resolution (cached 1hr in Redis)
      let cwMembers: Array<{ id: string; identifier: string; name: string; email: string }> = [];
      try {
        const cached = await redis.get("cw:members:cache");
        if (cached) {
          cwMembers = JSON.parse(cached);
        } else {
          cwMembers = await psa.getMembers();
          await redis.set("cw:members:cache", JSON.stringify(cwMembers), "EX", 3600);
        }
      } catch {}

      // Query CW for tickets updated in the last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = await psa.getTickets({ updatedAfter: fiveMinAgo }, 1, 100);
      const tickets = result.data;

      if (tickets.length === 0) {
        return { skipped: false, notifications: 0, ticketsChecked: 0 };
      }

      let notificationCount = 0;

      for (const ticket of tickets) {
        const ticketId = ticket.sourceId;
        const rawTicket = ticket._raw as Record<string, any> | undefined;

        // Resolve ALL recipients (owner + resources)
        const allRecipientUserIds = await resolveAllTicketRecipients(rawTicket, cwMembers);
        if (allRecipientUserIds.length === 0) continue;

        // Suppress self-notifications: resolve who last updated this ticket
        // CW tickets have _info.updatedBy which is the member identifier
        let actorUserId: string | null = null;
        const updatedBy = rawTicket?._info?.updatedBy as string | undefined;
        if (updatedBy) {
          const member = cwMembers.find(
            (m) => m.identifier.toLowerCase() === updatedBy.toLowerCase() ||
                   m.name.toLowerCase() === updatedBy.toLowerCase()
          );
          if (member) {
            actorUserId = await resolveTicketOwner(member.name, {
              memberId: member.id,
              memberIdentifier: member.identifier,
            });
          } else {
            // Fallback: try resolving the updatedBy string directly
            actorUserId = await resolveTicketOwner(updatedBy);
          }
        }

        const recipientUserIds = actorUserId
          ? allRecipientUserIds.filter((id) => id !== actorUserId)
          : allRecipientUserIds;
        if (recipientUserIds.length === 0) continue;

        // Get cached state for comparison
        const prevState = await getCachedTicketState(ticketId);
        const currentState = {
          status: ticket.status,
          assignedTo: ticket.assignedTo,
        };

        const changes = detectTicketChanges(prevState, currentState);

        for (const change of changes) {
          if (change.type === "ticket_assigned") {
            for (const userId of recipientUserIds) {
              const dedupKey = `ticket-notif:${ticketId}:${change.type}:${userId}`;
              const alreadySent = await redis.exists(dedupKey);
              if (!alreadySent) {
                await createNotification({
                  userId,
                  type: "ticket_assigned",
                  title: `Ticket #${ticketId} assigned to you`,
                  body: `${ticket.summary}${change.description ? ` — ${change.description}` : ""}`,
                  linkUrl: `/tickets?id=${ticketId}`,
                  sourceType: "connectwise_ticket",
                  sourceId: ticketId,
                  metadata: { companyName: ticket.companyName, priority: ticket.priority },
                });
                await redis.set(dedupKey, "1", "EX", 300);
                notificationCount++;
              }
            }
          }

          if (change.type === "ticket_status_changed") {
            for (const userId of recipientUserIds) {
              const dedupKey = `ticket-notif:${ticketId}:status:${ticket.status}:${userId}`;
              const alreadySent = await redis.exists(dedupKey);
              if (!alreadySent) {
                await createNotification({
                  userId,
                  type: "ticket_status_changed",
                  title: `Ticket #${ticketId} status changed`,
                  body: `${ticket.summary} — ${change.description}`,
                  linkUrl: `/tickets?id=${ticketId}`,
                  sourceType: "connectwise_ticket",
                  sourceId: ticketId,
                  metadata: { companyName: ticket.companyName, newStatus: ticket.status },
                });
                await redis.set(dedupKey, "1", "EX", 300);
                notificationCount++;
              }
            }
          }
        }

        // Check for new client replies
        try {
          const notes = await psa.getTicketNotes(ticketId);
          const reply = await detectNewReply(ticketId, notes);
          if (reply.isNew) {
            for (const userId of recipientUserIds) {
              const dedupKey = `ticket-notif:${ticketId}:reply:${reply.noteId}:${userId}`;
              const alreadySent = await redis.exists(dedupKey);
              if (!alreadySent) {
                await createNotification({
                  userId,
                  type: "ticket_reply",
                  title: `New reply on ticket #${ticketId}`,
                  body: `${ticket.companyName ?? "Client"} replied to: ${ticket.summary}`,
                  linkUrl: `/tickets?id=${ticketId}`,
                  sourceType: "connectwise_ticket",
                  sourceId: ticketId,
                  metadata: { companyName: ticket.companyName, noteId: reply.noteId, replyFrom: reply.createdBy },
                });
                await redis.set(dedupKey, "1", "EX", 300);
                notificationCount++;
              }
            }
          }
        } catch {
          // Note fetch failed — skip reply detection for this ticket
        }

        // Update cached state for future diffs
        await cacheTicketState(ticketId, currentState);
      }

      console.log(`[ticket-poll] Checked ${tickets.length} tickets, created ${notificationCount} notifications (self-action filtering enabled)`);
      return { skipped: false, notifications: notificationCount, ticketsChecked: tickets.length };
    } catch (err: any) {
      console.error("[ticket-poll] Error:", err?.message);
      // Release lock on error so we can retry sooner
      await redis.del(lockKey);
      return { skipped: false, notifications: 0, error: err?.message };
    }
  }),
});
