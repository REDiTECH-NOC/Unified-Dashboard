import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";

const auditCategoryEnum = z.enum(["AUTH", "USER", "SECURITY", "INTEGRATION", "NOTIFICATION", "SYSTEM", "API", "DATA"]);

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
});
