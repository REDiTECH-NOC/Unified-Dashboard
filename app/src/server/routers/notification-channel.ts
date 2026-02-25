/**
 * Notification Channel Router (Admin-Only)
 *
 * CRUD for delivery channels that users can select per alert source.
 * Built-in channels (push + email) are seeded on first access and cannot be deleted.
 * Admin can add custom Teams webhooks and SMS endpoints.
 */

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";

async function ensureBuiltInChannels(prisma: any) {
  const existing = await prisma.notificationChannel.findMany({
    where: { isBuiltIn: true },
  });

  const builtInTypes = new Set(existing.map((c: any) => c.type));

  if (!builtInTypes.has("push")) {
    await prisma.notificationChannel.create({
      data: {
        type: "push",
        name: "Browser Push",
        config: {},
        isBuiltIn: true,
        enabled: true,
      },
    });
  }

  if (!builtInTypes.has("email")) {
    await prisma.notificationChannel.create({
      data: {
        type: "email",
        name: "Email",
        config: {},
        isBuiltIn: true,
        enabled: true,
      },
    });
  }
}

export const notificationChannelRouter = router({
  /**
   * List all notification channels. Auto-seeds built-in channels on first call.
   */
  list: adminProcedure.query(async ({ ctx }) => {
    await ensureBuiltInChannels(ctx.prisma);

    return ctx.prisma.notificationChannel.findMany({
      orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
    });
  }),

  /**
   * Create a custom notification channel (Teams webhook, SMS endpoint).
   * Cannot create built-in types (push/email).
   */
  create: adminProcedure
    .input(
      z.object({
        type: z.enum(["teams", "sms"]),
        name: z.string().min(1).max(100),
        config: z.record(z.unknown()).default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.notificationChannel.create({
        data: {
          type: input.type,
          name: input.name,
          config: input.config as Prisma.InputJsonValue,
          isBuiltIn: false,
          enabled: true,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "notification.channel.created",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `channel:${channel.id}`,
        detail: { type: input.type, name: input.name },
      });

      return channel;
    }),

  /**
   * Update a channel. Built-in channels: can only toggle enabled.
   * Custom channels: can update name, config, and enabled.
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        config: z.record(z.unknown()).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.notificationChannel.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new Error("Channel not found");

      // Built-in channels: only allow enabling/disabling
      const updateData: Prisma.NotificationChannelUpdateInput = {};
      if (input.enabled !== undefined) updateData.enabled = input.enabled;

      if (!existing.isBuiltIn) {
        if (input.name !== undefined) updateData.name = input.name;
        if (input.config !== undefined) updateData.config = input.config as Prisma.InputJsonValue;
      }

      const channel = await ctx.prisma.notificationChannel.update({
        where: { id: input.id },
        data: updateData,
      });

      await auditLog({
        action: "notification.channel.updated",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `channel:${channel.id}`,
        detail: updateData as Record<string, unknown>,
      });

      return channel;
    }),

  /**
   * Delete a custom channel. Cannot delete built-in channels.
   * Also removes the channel from all user preferences.
   */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.notificationChannel.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new Error("Channel not found");
      if (existing.isBuiltIn) throw new Error("Cannot delete built-in channels");

      const channelKey = `${existing.type}:${existing.id}`;

      // Remove this channel from all user preferences
      const affectedPrefs = await ctx.prisma.userNotificationPref.findMany({
        where: { channels: { has: channelKey } },
      });

      if (affectedPrefs.length > 0) {
        await ctx.prisma.$transaction(
          affectedPrefs.map((pref) =>
            ctx.prisma.userNotificationPref.update({
              where: { id: pref.id },
              data: {
                channels: pref.channels.filter((c: string) => c !== channelKey),
              },
            })
          )
        );
      }

      await ctx.prisma.notificationChannel.delete({
        where: { id: input.id },
      });

      await auditLog({
        action: "notification.channel.deleted",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `channel:${existing.id}`,
        detail: { type: existing.type, name: existing.name, usersAffected: affectedPrefs.length },
      });

      return { success: true };
    }),

  /**
   * Test a channel by sending a test notification.
   */
  test: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.notificationChannel.findUnique({
        where: { id: input.id },
      });
      if (!channel) throw new Error("Channel not found");

      if (channel.type === "teams") {
        const config = channel.config as { webhookUrl?: string };
        if (!config.webhookUrl) throw new Error("No webhook URL configured");

        const res = await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            themeColor: "10B981",
            summary: "Test Notification",
            sections: [
              {
                activityTitle: "REDiTECH Command Center - Test",
                activitySubtitle: `Sent by ${ctx.user.name || ctx.user.email}`,
                facts: [
                  { name: "Channel", value: channel.name },
                  { name: "Type", value: "Test Notification" },
                  { name: "Status", value: "If you see this, the webhook is working!" },
                ],
              },
            ],
          }),
        });

        if (!res.ok) {
          throw new Error(`Teams webhook returned ${res.status}: ${await res.text()}`);
        }
      }

      await auditLog({
        action: "notification.channel.tested",
        category: "NOTIFICATION",
        actorId: ctx.user.id,
        resource: `channel:${channel.id}`,
        detail: { type: channel.type, name: channel.name },
      });

      return { success: true, type: channel.type };
    }),
});
