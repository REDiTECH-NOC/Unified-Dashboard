/**
 * Notification Preferences Router
 *
 * Per-user configuration for which alert sources, severity levels, and delivery
 * channels trigger real-time notifications. Sources are permission-gated — users
 * only see sources their admin has granted via the permission system.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { hasPermissions } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

const ALERT_SOURCES = [
  { id: "sentinelone", label: "SentinelOne", category: "security", permissionKey: "notifications.sentinelone" },
  { id: "blackpoint", label: "Blackpoint", category: "security", permissionKey: "notifications.blackpoint" },
  { id: "ninjaone", label: "NinjaRMM", category: "monitoring", permissionKey: "notifications.ninjaone" },
  { id: "uptime", label: "Uptime Monitor", category: "monitoring", permissionKey: "notifications.uptime" },
  { id: "cove", label: "Cove Backup", category: "backup", permissionKey: "notifications.cove" },
] as const;

const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "informational"] as const;
const DEFAULT_SEVERITIES = ["critical", "high"];
const DEFAULT_CHANNELS = ["push"];

const sourceIds = ALERT_SOURCES.map((s) => s.id);

export const notificationPreferencesRouter = router({
  /**
   * Get the current user's notification preferences, filtered to sources
   * they have permission for. Returns defaults for unconfigured sources.
   */
  getMyPrefs: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Check which sources this user has permission for
    const permKeys = ALERT_SOURCES.map((s) => s.permissionKey);
    const permResults = await hasPermissions(userId, permKeys);

    const allowedSources = ALERT_SOURCES.filter(
      (s) => permResults[s.permissionKey]
    );

    if (allowedSources.length === 0) {
      return { sources: [], channels: [] };
    }

    // Get saved preferences
    const saved = await ctx.prisma.userNotificationPref.findMany({
      where: { userId },
    });
    const savedMap = new Map(saved.map((p) => [p.source, p]));

    // Get available channels
    const channels = await ctx.prisma.notificationChannel.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });

    const sources = allowedSources.map((src) => {
      const pref = savedMap.get(src.id);
      return {
        source: src.id,
        label: src.label,
        category: src.category,
        enabled: pref?.enabled ?? true,
        severities: pref?.severities ?? DEFAULT_SEVERITIES,
        channels: pref?.channels ?? DEFAULT_CHANNELS,
      };
    });

    return {
      sources,
      channels: channels.map((ch) => ({
        id: ch.id,
        type: ch.type,
        name: ch.name,
        isBuiltIn: ch.isBuiltIn,
        /** Key used in the user's channels array */
        channelKey: ch.isBuiltIn ? ch.type : `${ch.type}:${ch.id}`,
      })),
    };
  }),

  /**
   * Update a single source preference for the current user.
   * Validates the user has permission for the source and that channels exist.
   */
  upsertPref: protectedProcedure
    .input(
      z.object({
        source: z.enum(sourceIds as unknown as [string, ...string[]]),
        enabled: z.boolean(),
        severities: z.array(z.enum(SEVERITY_LEVELS)).min(0),
        channels: z.array(z.string()).min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const src = ALERT_SOURCES.find((s) => s.id === input.source);
      if (!src) throw new Error("Unknown source");

      // Verify permission
      const permResults = await hasPermissions(userId, [src.permissionKey]);
      if (!permResults[src.permissionKey]) {
        throw new Error("You do not have permission for this alert source");
      }

      const result = await ctx.prisma.userNotificationPref.upsert({
        where: {
          userId_source: { userId, source: input.source },
        },
        update: {
          enabled: input.enabled,
          severities: input.severities,
          channels: input.channels,
        },
        create: {
          userId,
          source: input.source,
          enabled: input.enabled,
          severities: input.severities,
          channels: input.channels,
        },
      });

      await auditLog({
        action: "notification.preference.updated",
        category: "NOTIFICATION",
        actorId: userId,
        resource: `notif-pref:${input.source}`,
        detail: {
          source: input.source,
          enabled: input.enabled,
          severities: input.severities,
          channels: input.channels,
        },
      });

      return result;
    }),

  /**
   * Get available channels for the channel picker UI.
   */
  getAvailableChannels: protectedProcedure.query(async ({ ctx }) => {
    const channels = await ctx.prisma.notificationChannel.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    });

    return channels.map((ch) => ({
      id: ch.id,
      type: ch.type,
      name: ch.name,
      isBuiltIn: ch.isBuiltIn,
      channelKey: ch.isBuiltIn ? ch.type : `${ch.type}:${ch.id}`,
    }));
  }),

  /**
   * Get static metadata for UI rendering.
   */
  getSources: protectedProcedure.query(() => ({
    sources: ALERT_SOURCES.map((s) => ({
      id: s.id,
      label: s.label,
      category: s.category,
    })),
    severities: SEVERITY_LEVELS.map((s) => ({
      id: s,
      label: s === "informational" ? "Info" : s.charAt(0).toUpperCase() + s.slice(1),
    })),
  })),
});
