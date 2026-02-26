/**
 * Backup Router — tRPC procedures for backup monitoring (Cove Data Protection).
 *
 * Uses IBackupConnector via ConnectorFactory — never imports Cove directly.
 * All routes are read-only (monitoring/reporting, no backup actions).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { redis } from "@/lib/redis";
import { cachedQuery } from "@/lib/query-cache";

// ── In-memory stale-while-revalidate cache for backup alert queries ──
const _backupCache: import("@/lib/query-cache").QueryCacheMap = new Map();
const _backupBg = new Set<string>();
const BACKUP_STALE = 10 * 60_000; // 10 min

export const backupRouter = router({
  // ─── Dashboard Summary ────────────────────────────────────────

  getDashboardSummary: protectedProcedure.query(async ({ ctx }) => {
    try {
      const backup = await ConnectorFactory.get("backup", ctx.prisma);
      return await backup.getDashboardSummary();
    } catch (err) {
      console.error("[backup.getDashboardSummary] Error:", err);
      throw err;
    }
  }),

  // ─── Customers ────────────────────────────────────────────────

  getCustomers: protectedProcedure.query(async ({ ctx }) => {
    try {
      const backup = await ConnectorFactory.get("backup", ctx.prisma);
      return await backup.getCustomers();
    } catch (err) {
      console.error("[backup.getCustomers] Error:", err);
      throw err;
    }
  }),

  // ─── Devices ──────────────────────────────────────────────────

  getDevices: protectedProcedure
    .input(
      z.object({
        customerId: z.string().optional(),
        status: z
          .enum(["healthy", "warning", "failed", "overdue", "offline", "never_ran", "unknown"])
          .optional(),
        deviceType: z.enum(["workstation", "server"]).optional(),
        searchTerm: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        return await backup.getDevices(input);
      } catch (err) {
        console.error("[backup.getDevices] Error:", err);
        throw err;
      }
    }),

  getDeviceById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        return await backup.getDeviceById(input.id);
      } catch (err) {
        console.error("[backup.getDeviceById] Error:", err);
        throw err;
      }
    }),

  // ─── Session History ────────────────────────────────────────────

  getDeviceHistory: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        days: z.number().min(1).max(90).optional().default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        return await backup.getDeviceSessionHistory(input.deviceId, input.days);
      } catch (err) {
        console.error("[backup.getDeviceHistory] Error:", err);
        throw err;
      }
    }),

  // ─── Alerts ───────────────────────────────────────────────────

  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery(_backupCache, _backupBg, BACKUP_STALE, "backup:alerts", async () => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        return await backup.getActiveAlerts();
      } catch (err) {
        console.error("[backup.getAlerts] Error:", err);
        throw err;
      }
    });
  }),

  // ─── Storage ──────────────────────────────────────────────────

  getStorage: protectedProcedure
    .input(z.object({ customerId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        return await backup.getStorageStatistics(input.customerId);
      } catch (err) {
        console.error("[backup.getStorage] Error:", err);
        throw err;
      }
    }),

  // ─── Customer Names (lightweight — always callable) ───────

  getCustomerNames: protectedProcedure.query(async ({ ctx }) => {
    try {
      const backup = await ConnectorFactory.get("backup", ctx.prisma);
      const customers = await backup.getCustomers();
      return customers.map((c) => ({ id: c.sourceId, name: c.name }));
    } catch (err) {
      console.error("[backup.getCustomerNames] Error:", err);
      throw err;
    }
  }),

  // ─── Customer Notes ─────────────────────────────────────────

  getCustomerNote: protectedProcedure
    .input(z.object({ covePartnerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const note = await ctx.prisma.backupCustomerNote.findUnique({
        where: { covePartnerId: input.covePartnerId },
      });
      return note;
    }),

  setCustomerNote: protectedProcedure
    .input(z.object({ covePartnerId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.backupCustomerNote.upsert({
        where: { covePartnerId: input.covePartnerId },
        update: {
          note: input.note,
          updatedBy: ctx.user.id,
        },
        create: {
          covePartnerId: input.covePartnerId,
          note: input.note,
          updatedBy: ctx.user.id,
        },
      });
      return result;
    }),

  // ─── Cache Info ─────────────────────────────────────────────
  // Returns cache freshness timestamps so the UI can show "Last updated X ago"

  getCacheInfo: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Find the Cove tool config to get the toolId for cache keys
      const config = await ctx.prisma.integrationConfig.findFirst({
        where: { toolId: "cove-data-protection" },
      });
      if (!config) return null;

      const keys = {
        devices: `cove:devices:${config.toolId}`,
        summary: `cove:summary:${config.toolId}`,
      };

      const [devicesRaw, summaryRaw] = await Promise.all([
        redis.get(keys.devices),
        redis.get(keys.summary),
      ]);

      const parse = (raw: string | null) => {
        if (!raw) return null;
        try {
          const envelope = JSON.parse(raw) as { cachedAt: number };
          return envelope.cachedAt ?? null;
        } catch {
          return null;
        }
      };

      return {
        devicesCachedAt: parse(devicesRaw),
        summaryCachedAt: parse(summaryRaw),
      };
    } catch {
      return null;
    }
  }),
});
