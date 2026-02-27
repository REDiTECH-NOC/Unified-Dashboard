import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";

const auditCategoryEnum = z.enum(["AUTH", "USER", "SECURITY", "INTEGRATION", "NOTIFICATION", "SYSTEM", "API", "DATA"]);

const RETENTION_DEFAULTS = {
  retentionDays: 2555, // 7 years
  autoCleanupEnabled: false,
  cleanupFrequency: "monthly",
  lastCleanupAt: null as Date | null,
  lastCleanupCount: 0,
};

export const auditRouter = router({
  list: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
      action: z.string().optional(),
      actorId: z.string().optional(),
      category: auditCategoryEnum.optional(),
      outcome: z.enum(["success", "failure", "denied"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.auditEvent.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: {
          ...(input.action && { action: { startsWith: input.action } }),
          ...(input.actorId && { actorId: input.actorId }),
          ...(input.category && { category: input.category }),
          ...(input.outcome && { outcome: input.outcome }),
        },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true, avatar: true } } },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  // Get category counts for filter badges
  categoryCounts: adminProcedure.query(async ({ ctx }) => {
    const counts = await ctx.prisma.auditEvent.groupBy({
      by: ["category"],
      _count: { id: true },
    });
    return counts.reduce((acc, c) => {
      acc[c.category] = c._count.id;
      return acc;
    }, {} as Record<string, number>);
  }),

  // User-specific activity (for user detail page)
  userActivity: adminProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().min(1).max(100).default(30),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.prisma.auditEvent.findMany({
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        where: { actorId: input.userId },
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  myActivity: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.auditEvent.findMany({
        where: { actorId: ctx.user.id },
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── Retention Config ───────────────────────────────────────

  getRetentionConfig: adminProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.auditRetentionConfig.findFirst();
    return config ?? RETENTION_DEFAULTS;
  }),

  updateRetentionConfig: adminProcedure
    .input(z.object({
      retentionDays: z.number().min(30).max(3650),
      autoCleanupEnabled: z.boolean(),
      cleanupFrequency: z.enum(["daily", "weekly", "monthly"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.auditRetentionConfig.findFirst();

      let result;
      if (existing) {
        result = await ctx.prisma.auditRetentionConfig.update({
          where: { id: existing.id },
          data: { ...input, updatedBy: ctx.user.id },
        });
      } else {
        result = await ctx.prisma.auditRetentionConfig.create({
          data: { ...input, updatedBy: ctx.user.id },
        });
      }

      await auditLog({
        action: "audit.retention_config.updated",
        category: "SYSTEM",
        actorId: ctx.user.id,
        detail: {
          retentionDays: input.retentionDays,
          autoCleanupEnabled: input.autoCleanupEnabled,
          cleanupFrequency: input.cleanupFrequency,
        },
      });

      return result;
    }),

  // ─── Stats ──────────────────────────────────────────────────

  getStats: adminProcedure.query(async ({ ctx }) => {
    const [totalCount, oldestEvent, categoryCounts] = await Promise.all([
      ctx.prisma.auditEvent.count(),
      ctx.prisma.auditEvent.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      ctx.prisma.auditEvent.groupBy({
        by: ["category"],
        _count: { id: true },
      }),
    ]);

    // Estimate DB size (rough: ~500 bytes per event)
    const estimatedSizeMb = Math.round((totalCount * 500) / (1024 * 1024) * 10) / 10;

    const retentionConfig = await ctx.prisma.auditRetentionConfig.findFirst();
    const retentionDays = retentionConfig?.retentionDays ?? RETENTION_DEFAULTS.retentionDays;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const expiredCount = await ctx.prisma.auditEvent.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    return {
      totalEvents: totalCount,
      oldestEventDate: oldestEvent?.createdAt ?? null,
      estimatedSizeMb,
      expiredCount,
      retentionDays,
      lastCleanupAt: retentionConfig?.lastCleanupAt ?? null,
      lastCleanupCount: retentionConfig?.lastCleanupCount ?? 0,
      byCategory: categoryCounts.reduce((acc, c) => {
        acc[c.category] = c._count.id;
        return acc;
      }, {} as Record<string, number>),
    };
  }),

  // ─── CSV Export ─────────────────────────────────────────────

  exportCsv: adminProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: auditCategoryEnum.optional(),
      outcome: z.enum(["success", "failure", "denied"]).optional(),
      limit: z.number().min(1).max(100000).default(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.startDate || input.endDate) {
        where.createdAt = {
          ...(input.startDate && { gte: new Date(input.startDate) }),
          ...(input.endDate && { lte: new Date(input.endDate) }),
        };
      }
      if (input.category) where.category = input.category;
      if (input.outcome) where.outcome = input.outcome;

      const events = await ctx.prisma.auditEvent.findMany({
        where,
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      });

      // Build CSV
      const headers = ["Timestamp", "Category", "Action", "Actor", "Actor Email", "Resource", "Outcome", "IP", "Detail"];
      const rows = events.map((e) => [
        e.createdAt.toISOString(),
        e.category,
        e.action,
        e.actor?.name ?? "System",
        e.actor?.email ?? "",
        e.resource ?? "",
        e.outcome,
        e.ip ?? "",
        e.detail ? JSON.stringify(e.detail) : "",
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) =>
          r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      await auditLog({
        action: "audit.exported",
        category: "DATA",
        actorId: ctx.user.id,
        detail: {
          rowCount: events.length,
          filters: { startDate: input.startDate, endDate: input.endDate, category: input.category },
        },
      });

      return { csv: csvContent, rowCount: events.length };
    }),
});
