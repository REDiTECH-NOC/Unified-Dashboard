import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MonitorType } from "@prisma/client";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { getUptimeEngine } from "../services/uptime";
import { auditLog } from "@/lib/audit";

// ─── Per-type config schemas ────────────────────────────────────

const httpConfigSchema = z.object({
  url: z.string().url(),
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
    .default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  expectedStatus: z.string().default("200-299"),
  keyword: z.string().optional(),
  invertKeyword: z.boolean().default(false),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().min(0).max(100).default(10),
  ignoreTls: z.boolean().default(false),
  authType: z.enum(["none", "basic"]).default("none"),
  authUser: z.string().optional(),
  authPass: z.string().optional(),
});

const tcpConfigSchema = z.object({
  hostname: z.string().min(1),
  port: z.number().min(1).max(65535),
});

const pingConfigSchema = z.object({
  hostname: z.string().min(1),
  packetSize: z.number().min(1).max(65535).default(56),
});

const dnsConfigSchema = z.object({
  hostname: z.string().min(1),
  resolveServer: z.string().default("1.1.1.1"),
  recordType: z
    .enum([
      "A",
      "AAAA",
      "CAA",
      "CNAME",
      "MX",
      "NS",
      "PTR",
      "SOA",
      "SRV",
      "TXT",
    ])
    .default("A"),
  expectedValue: z.string().optional(),
});

const redisConfigSchema = z.object({
  connectionString: z.string().min(1),
  ignoreTls: z.boolean().default(false),
});

const mysqlConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535).default(3306),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
});

const postgresqlConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535).default(5432),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
});

const sqlserverConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535).default(1433),
  username: z.string().optional(),
  password: z.string().optional(),
  database: z.string().optional(),
});

const mongodbConfigSchema = z.object({
  connectionString: z.string().min(1),
});

const dockerConfigSchema = z.object({
  containerId: z.string().min(1),
  dockerHost: z.string().default("http://localhost:2375"),
});

function validateConfig(type: string, config: unknown) {
  switch (type) {
    case "HTTP":
      return httpConfigSchema.parse(config);
    case "TCP":
      return tcpConfigSchema.parse(config);
    case "PING":
      return pingConfigSchema.parse(config);
    case "DNS":
      return dnsConfigSchema.parse(config);
    case "REDIS":
      return redisConfigSchema.parse(config);
    case "MYSQL":
      return mysqlConfigSchema.parse(config);
    case "POSTGRESQL":
      return postgresqlConfigSchema.parse(config);
    case "SQLSERVER":
      return sqlserverConfigSchema.parse(config);
    case "MONGODB":
      return mongodbConfigSchema.parse(config);
    case "DOCKER":
      return dockerConfigSchema.parse(config);
    default:
      throw new Error(`Unknown monitor type: ${type}`);
  }
}

// ─── Shared input schemas ───────────────────────────────────────

const baseMonitorInput = z.object({
  name: z.string().min(1).max(200),
  type: z.nativeEnum(MonitorType),
  description: z.string().max(500).optional(),
  intervalSeconds: z.number().min(20).max(86400).default(60),
  retrySeconds: z.number().min(20).max(86400).default(60),
  maxRetries: z.number().min(0).max(10).default(3),
  timeoutMs: z.number().min(1000).max(60000).default(10000),
  sslExpiryDays: z.number().min(1).max(365).default(30),
  config: z.record(z.unknown()),
  companyId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
});

// ─── Router ─────────────────────────────────────────────────────

export const uptimeRouter = router({
  /** List all monitors with latest heartbeat, company, and tags. */
  list: protectedProcedure
    .input(z.object({
      companyId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      type: z.string().optional(),
      status: z.string().optional(), // "UP", "DOWN", "PAUSED"
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Prisma.MonitorWhereInput = {};

      if (input?.companyId) {
        where.companyId = input.companyId;
      }
      if (input?.tagIds?.length) {
        where.tags = { some: { tagId: { in: input.tagIds } } };
      }
      if (input?.type) {
        where.type = input.type as MonitorType;
      }
      if (input?.status === "PAUSED") {
        where.active = false;
      } else if (input?.status === "UP" || input?.status === "DOWN") {
        where.active = true;
        where.status = input.status;
      }
      if (input?.search) {
        where.name = { contains: input.search, mode: "insensitive" };
      }

      const monitors = await ctx.prisma.monitor.findMany({
        where,
        orderBy: [
          { status: "asc" }, // DOWN first
          { name: "asc" },
        ],
        include: {
          heartbeats: {
            orderBy: { timestamp: "desc" },
            take: 1,
          },
          company: {
            select: { id: true, name: true },
          },
          tags: {
            include: { tag: true },
          },
        },
      });

      return monitors.map((m) => ({
        ...m,
        latestHeartbeat: m.heartbeats[0] || null,
        heartbeats: undefined,
        tags: m.tags.map((t) => t.tag),
      }));
    }),

  /** Get a single monitor with recent heartbeats, company, and tags. */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const monitor = await ctx.prisma.monitor.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          heartbeats: {
            orderBy: { timestamp: "desc" },
            take: 100,
          },
          company: {
            select: { id: true, name: true },
          },
          tags: {
            include: { tag: true },
          },
        },
      });

      return {
        ...monitor,
        tags: monitor.tags.map((t) => t.tag),
      };
    }),

  /** Get paginated heartbeats for a monitor. */
  heartbeats: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        hours: z.number().min(1).max(720).default(24),
        limit: z.number().min(1).max(500).default(100),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);

      const items = await ctx.prisma.heartbeat.findMany({
        where: {
          monitorId: input.monitorId,
          timestamp: { gte: since },
        },
        orderBy: { timestamp: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  /** Get computed stats for a monitor. */
  stats: protectedProcedure
    .input(z.object({ monitorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [total24h, up24h, totalWeek, upWeek, totalMonth, upMonth, avgLatency] =
        await Promise.all([
          ctx.prisma.heartbeat.count({
            where: { monitorId: input.monitorId, timestamp: { gte: day } },
          }),
          ctx.prisma.heartbeat.count({
            where: {
              monitorId: input.monitorId,
              timestamp: { gte: day },
              status: "UP",
            },
          }),
          ctx.prisma.heartbeat.count({
            where: { monitorId: input.monitorId, timestamp: { gte: week } },
          }),
          ctx.prisma.heartbeat.count({
            where: {
              monitorId: input.monitorId,
              timestamp: { gte: week },
              status: "UP",
            },
          }),
          ctx.prisma.heartbeat.count({
            where: { monitorId: input.monitorId, timestamp: { gte: month } },
          }),
          ctx.prisma.heartbeat.count({
            where: {
              monitorId: input.monitorId,
              timestamp: { gte: month },
              status: "UP",
            },
          }),
          ctx.prisma.heartbeat.aggregate({
            where: {
              monitorId: input.monitorId,
              timestamp: { gte: day },
              latencyMs: { not: null },
            },
            _avg: { latencyMs: true },
          }),
        ]);

      return {
        uptime24h: total24h > 0 ? (up24h / total24h) * 100 : null,
        uptime7d: totalWeek > 0 ? (upWeek / totalWeek) * 100 : null,
        uptime30d: totalMonth > 0 ? (upMonth / totalMonth) * 100 : null,
        avgLatency24h: avgLatency._avg.latencyMs,
      };
    }),

  /** Get uptime bar data for the list view. */
  uptimeBars: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        segments: z.number().min(10).max(90).default(45),
      })
    )
    .query(async ({ ctx, input }) => {
      const hours = 24;
      const now = Date.now();
      const since = new Date(now - hours * 60 * 60 * 1000);
      const segmentMs = (hours * 60 * 60 * 1000) / input.segments;

      const heartbeats = await ctx.prisma.heartbeat.findMany({
        where: {
          monitorId: input.monitorId,
          timestamp: { gte: since },
        },
        orderBy: { timestamp: "asc" },
        select: { status: true, timestamp: true, latencyMs: true },
      });

      const bars: Array<{
        status: string | null;
        timestamp: string;
        latencyMs: number | null;
      }> = [];

      for (let i = 0; i < input.segments; i++) {
        const segStart = since.getTime() + i * segmentMs;
        const segEnd = segStart + segmentMs;

        const segBeats = heartbeats.filter((hb) => {
          const t = hb.timestamp.getTime();
          return t >= segStart && t < segEnd;
        });

        if (segBeats.length === 0) {
          bars.push({
            status: null,
            timestamp: new Date(segStart).toISOString(),
            latencyMs: null,
          });
        } else {
          // Dominant status: if any DOWN, show DOWN. If any UP, show UP. Else PENDING.
          const hasDown = segBeats.some((b) => b.status === "DOWN");
          const hasUp = segBeats.some((b) => b.status === "UP");
          const avgLat =
            segBeats.reduce((sum, b) => sum + (b.latencyMs || 0), 0) /
            segBeats.length;

          bars.push({
            status: hasDown ? "DOWN" : hasUp ? "UP" : "PENDING",
            timestamp: new Date(segStart).toISOString(),
            latencyMs: Math.round(avgLat),
          });
        }
      }

      return bars;
    }),

  /** Engine health status. */
  health: protectedProcedure.query(async () => {
    const engine = getUptimeEngine();
    return {
      running: engine.isRunning(),
      monitorCount: engine.getMonitorCount(),
    };
  }),

  /** Add a new monitor. Admin only. */
  add: adminProcedure
    .input(baseMonitorInput)
    .mutation(async ({ ctx, input }) => {
      const { tagIds, companyId, ...rest } = input;

      // Validate config against type-specific schema
      const validatedConfig = validateConfig(rest.type, rest.config);

      const monitor = await ctx.prisma.monitor.create({
        data: {
          name: rest.name,
          type: rest.type,
          description: rest.description,
          intervalSeconds: rest.intervalSeconds,
          retrySeconds: rest.retrySeconds,
          maxRetries: rest.maxRetries,
          timeoutMs: rest.timeoutMs,
          sslExpiryDays: rest.sslExpiryDays,
          config: validatedConfig as unknown as Prisma.InputJsonValue,
          companyId: companyId || null,
          createdBy: ctx.user.id,
          ...(tagIds?.length ? {
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          } : {}),
        },
      });

      // Schedule the monitor
      const engine = getUptimeEngine();
      engine.scheduleMonitor(monitor);

      await auditLog({
        action: "uptime.monitor.created",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor:${monitor.id}`,
        detail: {
          name: rest.name,
          type: rest.type,
          monitorId: monitor.id,
          companyId: companyId || null,
          tagIds: tagIds || [],
        },
      });

      return monitor;
    }),

  /** Edit an existing monitor. Admin only. */
  edit: adminProcedure
    .input(
      z.object({ id: z.string() }).merge(baseMonitorInput.partial())
    )
    .mutation(async ({ ctx, input }) => {
      const { id, config, type, tagIds, companyId, ...rest } = input;

      // If config is being updated, validate it
      let validatedConfig: Record<string, unknown> | undefined;
      if (config) {
        const existingMonitor = await ctx.prisma.monitor.findUniqueOrThrow({
          where: { id },
        });
        const effectiveType = type || existingMonitor.type;
        validatedConfig = validateConfig(
          effectiveType,
          config
        ) as Record<string, unknown>;
      }

      const monitor = await ctx.prisma.monitor.update({
        where: { id },
        data: {
          ...rest,
          ...(type ? { type } : {}),
          ...(validatedConfig ? { config: validatedConfig as unknown as Prisma.InputJsonValue } : {}),
          ...(companyId !== undefined ? { companyId: companyId || null } : {}),
        },
      });

      // Replace tag assignments if tagIds provided
      if (tagIds !== undefined) {
        await ctx.prisma.monitorTagAssignment.deleteMany({ where: { monitorId: id } });
        if (tagIds.length > 0) {
          await ctx.prisma.monitorTagAssignment.createMany({
            data: tagIds.map((tagId) => ({ monitorId: id, tagId })),
          });
        }
      }

      // Reschedule the monitor
      const engine = getUptimeEngine();
      await engine.rescheduleMonitor(id);

      await auditLog({
        action: "uptime.monitor.edited",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor:${id}`,
        detail: {
          monitorId: id,
          changedFields: Object.keys(input).filter((k) => k !== "id"),
        },
      });

      return monitor;
    }),

  /** Delete a monitor. Admin only. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await ctx.prisma.monitor.findUnique({
        where: { id: input.id },
      });

      // Unschedule first
      const engine = getUptimeEngine();
      engine.unscheduleMonitor(input.id);

      await ctx.prisma.monitor.delete({ where: { id: input.id } });

      await auditLog({
        action: "uptime.monitor.deleted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor:${input.id}`,
        detail: {
          monitorId: input.id,
          name: monitor?.name,
        },
      });

      return { ok: true };
    }),

  /** Pause a monitor. Admin only. */
  pause: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const engine = getUptimeEngine();
      engine.unscheduleMonitor(input.id);

      await ctx.prisma.monitor.update({
        where: { id: input.id },
        data: { active: false },
      });

      await auditLog({
        action: "uptime.monitor.paused",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor:${input.id}`,
        detail: { monitorId: input.id },
      });

      return { ok: true };
    }),

  /** Resume a paused monitor. Admin only. */
  resume: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await ctx.prisma.monitor.update({
        where: { id: input.id },
        data: { active: true, status: "PENDING" },
      });

      const engine = getUptimeEngine();
      engine.scheduleMonitor(monitor);

      await auditLog({
        action: "uptime.monitor.resumed",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor:${input.id}`,
        detail: { monitorId: input.id },
      });

      return { ok: true };
    }),

  /** Execute an immediate check. Admin only. */
  testNow: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const monitor = await ctx.prisma.monitor.findUniqueOrThrow({
        where: { id: input.id },
      });

      const { getExecutor } = await import("../services/uptime/executors/registry");
      const executor = getExecutor(monitor.type);
      const config = (monitor.config as Record<string, unknown>) || {};
      const result = await executor.execute(config, monitor.timeoutMs);

      return result;
    }),

  // ─── Tag Management ──────────────────────────────────────────

  /** List all tags. */
  listTags: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.monitorTag.findMany({
      orderBy: { name: "asc" },
    });
  }),

  /** Create a tag. Admin only. */
  createTag: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#ef4444"),
    }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.monitorTag.create({
        data: {
          name: input.name,
          color: input.color,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "uptime.tag.created",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor-tag:${tag.id}`,
        detail: { name: input.name, color: input.color },
      });

      return tag;
    }),

  /** Delete a tag. Admin only. */
  deleteTag: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.monitorTag.findUnique({ where: { id: input.id } });
      await ctx.prisma.monitorTag.delete({ where: { id: input.id } });

      await auditLog({
        action: "uptime.tag.deleted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `monitor-tag:${input.id}`,
        detail: { name: tag?.name },
      });

      return { ok: true };
    }),

  // ─── Company List (lightweight for dropdowns) ────────────────

  /** List companies for monitor assignment dropdown. */
  listCompanies: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.company.findMany({
        where: {
          status: "Active",
          ...(input?.search ? { name: { contains: input.search, mode: "insensitive" as const } } : {}),
        },
        select: { id: true, name: true, identifier: true },
        orderBy: { name: "asc" },
        take: 50,
      });
    }),
});
