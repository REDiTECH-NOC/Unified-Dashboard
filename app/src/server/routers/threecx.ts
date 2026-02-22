/**
 * 3CX Router — PBX instance management and monitoring.
 *
 * Manages multiple 3CX PBX instances (one per customer). Each PBX has its own
 * FQDN, credentials, and company mapping. The ThreecxInstanceManager handles
 * connector lifecycle; the router handles CRUD and monitoring endpoints.
 *
 * Phase 2: Instance management + read-only monitoring.
 * Phase 5: Service restart, backup trigger, and other write actions.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ThreecxInstanceManager } from "../connectors/threecx/instance-manager";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";

export const threecxRouter = router({
  // ─── Instance Management (Admin) ───────────────────────────

  listInstances: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.threecxInstance.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        fqdn: true,
        extensionNumber: true,
        status: true,
        version: true,
        os: true,
        isActive: true,
        lastHealthCheck: true,
        lastSeenAt: true,
        callsActive: true,
        extensionsRegistered: true,
        extensionsTotal: true,
        trunksRegistered: true,
        trunksTotal: true,
        cpuUsage: true,
        diskUsagePercent: true,
        hasFailedServices: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true } },
      },
    });
  }),

  getInstance: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.findUnique({
        where: { id: input.id },
        include: {
          company: { select: { id: true, name: true } },
        },
      });

      if (!instance) throw new Error("3CX instance not found");

      // Never expose encrypted password
      const { encryptedPassword: _, ...safe } = instance;
      return { ...safe, hasPassword: true };
    }),

  addInstance: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        fqdn: z.string().min(1).max(500),
        extensionNumber: z.string().min(1).max(20),
        password: z.string().min(1),
        companyId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const encryptedPassword = encrypt(input.password);

      const instance = await ctx.prisma.threecxInstance.create({
        data: {
          name: input.name,
          fqdn: input.fqdn.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          extensionNumber: input.extensionNumber,
          encryptedPassword,
          companyId: input.companyId || null,
        },
      });

      await auditLog({
        action: "threecx.instance.created",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${instance.id}`,
        detail: { name: input.name, fqdn: input.fqdn },
      });

      return { id: instance.id, name: instance.name };
    }),

  updateInstance: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        fqdn: z.string().min(1).max(500).optional(),
        extensionNumber: z.string().min(1).max(20).optional(),
        password: z.string().min(1).optional(),
        companyId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {};

      if (input.name !== undefined) data.name = input.name;
      if (input.fqdn !== undefined)
        data.fqdn = input.fqdn.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (input.extensionNumber !== undefined)
        data.extensionNumber = input.extensionNumber;
      if (input.password !== undefined)
        data.encryptedPassword = encrypt(input.password);
      if (input.companyId !== undefined) data.companyId = input.companyId;
      if (input.isActive !== undefined) data.isActive = input.isActive;

      const instance = await ctx.prisma.threecxInstance.update({
        where: { id: input.id },
        data,
      });

      // Invalidate cached connector instance so next use picks up changes
      ThreecxInstanceManager.invalidate(input.id);

      await auditLog({
        action: "threecx.instance.updated",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.id}`,
        detail: {
          fields: Object.keys(input).filter(
            (k) => k !== "id" && k !== "password"
          ),
          passwordChanged: !!input.password,
        },
      });

      return { id: instance.id, name: instance.name };
    }),

  deleteInstance: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.delete({
        where: { id: input.id },
      });

      ThreecxInstanceManager.invalidate(input.id);

      await auditLog({
        action: "threecx.instance.deleted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.id}`,
        detail: { name: instance.name, fqdn: instance.fqdn },
      });

      return { success: true };
    }),

  testConnection: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.id, ctx.prisma);
      const result = await connector.healthCheck();

      // Update status in DB
      await ctx.prisma.threecxInstance.update({
        where: { id: input.id },
        data: {
          status: result.ok ? "online" : "offline",
          lastHealthCheck: new Date(),
          lastSeenAt: result.ok ? new Date() : undefined,
        },
      });

      await auditLog({
        action: "threecx.instance.tested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.id}`,
        detail: {
          success: result.ok,
          latencyMs: result.latencyMs,
          message: result.message,
        },
      });

      return result;
    }),

  // ─── Monitoring (Read-Only) ────────────────────────────────

  getSystemStatus: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getSystemStatus();
    }),

  getTrunks: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getTrunks();
    }),

  getUsers: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getUsers();
    }),

  getActiveCalls: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getActiveCalls();
    }),

  getServices: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getServices();
    }),

  getSystemHealth: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getSystemHealth();
    }),

  getSystemTelemetry: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getSystemTelemetry();
    }),

  // ─── Dashboard Aggregate ───────────────────────────────────

  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    // Read from cached DB fields — does NOT query PBXs live
    return ctx.prisma.threecxInstance.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        fqdn: true,
        status: true,
        version: true,
        lastSeenAt: true,
        callsActive: true,
        extensionsRegistered: true,
        extensionsTotal: true,
        trunksRegistered: true,
        trunksTotal: true,
        cpuUsage: true,
        diskUsagePercent: true,
        hasFailedServices: true,
        company: { select: { id: true, name: true } },
      },
    });
  }),
});
