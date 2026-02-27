/**
 * Backup Router — tRPC procedures for backup monitoring (Cove Data Protection).
 *
 * Uses IBackupConnector via ConnectorFactory — never imports Cove directly.
 * All routes are read-only (monitoring/reporting, no backup actions).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { BackupErrorDetail, RecoveryVerification } from "../connectors/_interfaces/backup";
import { redis } from "@/lib/redis";
import { cachedQuery } from "@/lib/query-cache";
import { auditLog } from "@/lib/audit";

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

  // ─── Per-File Error Details (Cove Storage Node) ────────────────

  getDeviceErrors: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        // Per-file errors use the Cove storage node API — not on IBackupConnector
        if ("getDeviceErrorDetails" in backup) {
          return await (backup as { getDeviceErrorDetails: (id: string) => Promise<BackupErrorDetail[]> })
            .getDeviceErrorDetails(input.deviceId);
        }
        return [] as BackupErrorDetail[];
      } catch (err) {
        console.error("[backup.getDeviceErrors] Error:", err);
        throw err;
      }
    }),

  // ─── Recovery Verification (DRaaS) ──────────────────────────────

  getRecoveryVerification: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const backup = await ConnectorFactory.get("backup", ctx.prisma);
        if ("getRecoveryVerification" in backup) {
          return await (backup as { getRecoveryVerification: (id: string) => Promise<RecoveryVerification> })
            .getRecoveryVerification(input.deviceId);
        }
        return { available: false } as RecoveryVerification;
      } catch (err) {
        console.error("[backup.getRecoveryVerification] Error:", err);
        throw err;
      }
    }),

  // ─── Bulk Recovery-Enabled Devices (DRaaS) ─────────────────────

  getRecoveryEnabledDevices: protectedProcedure.query(async ({ ctx }) => {
    try {
      const backup = await ConnectorFactory.get("backup", ctx.prisma);
      if ("getRecoveryEnabledDevices" in backup) {
        return await (
          backup as {
            getRecoveryEnabledDevices: () => Promise<
              Array<{ deviceId: string; type: string; status: string; planName: string; targetType: string }>
            >;
          }
        ).getRecoveryEnabledDevices();
      }
      return [] as Array<{ deviceId: string; type: string; status: string; planName: string; targetType: string }>;
    } catch (err) {
      console.error("[backup.getRecoveryEnabledDevices] Error:", err);
      return [];
    }
  }),

  // ─── Alerts ───────────────────────────────────────────────────

  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("backup", BACKUP_STALE, "alerts", async () => {
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
      await auditLog({
        action: "backup.customer_note.updated",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `cove-customer:${input.covePartnerId}`,
        detail: { covePartnerId: input.covePartnerId, noteLength: input.note.length },
      });
      return result;
    }),

  // ─── Cove Partner ID (for portal URLs) ─────────────────────
  // The Cove portal URLs require the root partner ID:
  // https://backup.management/#/backup/overview/view/{partnerId}(panel:device-properties/{deviceId}/errors)

  getCovePartnerId: protectedProcedure.query(async ({ ctx }) => {
    try {
      const config = await ctx.prisma.integrationConfig.findFirst({
        where: { toolId: "cove" },
      });
      if (!config) return null;

      // Partner ID is cached in Redis by CoveClient during login
      const cached = await redis.get(`cove:rootpartner:${config.toolId}`);
      if (cached) return Number(cached);

      // If not cached, trigger a device fetch which forces login → caches partner ID
      const backup = await ConnectorFactory.get("backup", ctx.prisma);
      await backup.getDevices({ searchTerm: "__force_login__" });

      const afterLogin = await redis.get(`cove:rootpartner:${config.toolId}`);
      return afterLogin ? Number(afterLogin) : null;
    } catch (err) {
      console.error("[backup.getCovePartnerId] Error:", err);
      return null;
    }
  }),

  // ─── Cache Info ─────────────────────────────────────────────
  // Returns cache freshness timestamps so the UI can show "Last updated X ago"

  getCacheInfo: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Find the Cove tool config to get the toolId for cache keys
      const config = await ctx.prisma.integrationConfig.findFirst({
        where: { toolId: "cove" },
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
