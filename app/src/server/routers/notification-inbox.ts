/**
 * Notification Inbox Router — tRPC procedures for in-app notification management.
 *
 * All procedures are protectedProcedure (authenticated users only).
 * Each user can only access their own notifications.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { ConnectorFactory } from "../connectors/factory";
import type { IPsaConnector } from "../connectors/_interfaces/psa";

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
});
