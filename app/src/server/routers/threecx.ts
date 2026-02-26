/**
 * 3CX Router — PBX instance management and monitoring.
 *
 * Manages multiple 3CX PBX instances (one per customer). Each PBX has its own
 * FQDN, credentials, and company mapping. The ThreecxInstanceManager handles
 * connector lifecycle; the router handles CRUD and monitoring endpoints.
 */

import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ThreecxInstanceManager } from "../connectors/threecx/instance-manager";
import { encrypt, decrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit";

/** Parse 3CX ProductCode into a human-readable license type */
function parseLicenseType(productCode: string | null | undefined): string | null {
  if (!productCode) return null;
  const code = productCode.toUpperCase();
  if (code.includes("ENT")) return "Enterprise";
  if (code.includes("PROF") || code.includes("PRO")) return "Professional";
  if (code.includes("STD") || code.includes("STARTUP")) return "Startup";
  return null;
}

/** Shared select fields for dashboard/list views */
const DASHBOARD_SELECT = {
  id: true,
  name: true,
  fqdn: true,
  extensionNumber: true,
  companyName: true,
  status: true,
  version: true,
  os: true,
  isActive: true,
  lastHealthCheck: true,
  lastSeenAt: true,
  productCode: true,
  maxSimCalls: true,
  expirationDate: true,
  maintenanceExpiresAt: true,
  updateAvailable: true,
  latestVersion: true,
  callsActive: true,
  extensionsRegistered: true,
  extensionsTotal: true,
  userExtensions: true,
  maxUserExtensions: true,
  trunksRegistered: true,
  trunksTotal: true,
  cpuUsage: true,
  diskUsagePercent: true,
  hasFailedServices: true,
  localIp: true,
  sshUsername: true,
  ssoDeployed: true,
  ssoDeployedAt: true,
  ssoDeployStatus: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true } },
} as const;

export const threecxRouter = router({
  // ─── Instance Management (Admin) ───────────────────────────

  listInstances: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.threecxInstance.findMany({
      orderBy: { name: "asc" },
      select: DASHBOARD_SELECT,
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

      // Never expose encrypted passwords
      const { encryptedPassword: _, encryptedSshPassword: _2, ...safe } = instance;
      return {
        ...safe,
        hasPassword: true,
        hasSshPassword: !!instance.encryptedSshPassword,
      };
    }),

  addInstance: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        fqdn: z.string().min(1).max(500),
        extensionNumber: z.string().min(1).max(20),
        password: z.string().min(1),
        companyId: z.string().optional(),
        companyName: z.string().max(200).optional(),
        // SSO deployment fields
        localIp: z.string().max(100).optional(),
        sshUsername: z.string().max(100).optional(),
        sshPassword: z.string().optional(),
        deploySso: z.boolean().optional(),
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
          companyName: input.companyId ? null : (input.companyName || null),
          localIp: input.localIp || null,
          sshUsername: input.sshUsername || null,
          encryptedSshPassword: input.sshPassword ? encrypt(input.sshPassword) : null,
          ssoDeployStatus: input.deploySso ? "pending" : null,
        },
      });

      await auditLog({
        action: "threecx.instance.created",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${instance.id}`,
        detail: { name: input.name, fqdn: input.fqdn },
      });

      // Auto-refresh to get initial status from the PBX
      try {
        const connector = await ThreecxInstanceManager.get(instance.id, ctx.prisma);
        const status = await connector.getSystemStatus();
        await ctx.prisma.threecxInstance.update({
          where: { id: instance.id },
          data: {
            status: "online",
            version: status.version,
            os: status.os,
            callsActive: status.callsActive,
            extensionsRegistered: status.extensionsRegistered,
            extensionsTotal: status.extensionsTotal,
            userExtensions: status.userExtensions,
            maxUserExtensions: status.maxUserExtensions,
            trunksRegistered: status.trunksRegistered,
            trunksTotal: status.trunksTotal,
            diskUsagePercent: status.diskUsagePercent,
            hasFailedServices: status.hasNotRunningServices,
            productCode: status.productCode ?? null,
            maxSimCalls: status.maxSimCalls,
            expirationDate: status.expirationDate ? new Date(status.expirationDate) : null,
            maintenanceExpiresAt: status.maintenanceExpiresAt ? new Date(status.maintenanceExpiresAt) : null,
            lastHealthCheck: new Date(),
            lastSeenAt: new Date(),
          },
        });
      } catch (err) {
        console.error(`[3CX] Auto-refresh failed for "${input.name}" (${input.fqdn}):`, err instanceof Error ? err.message : err);
        await ctx.prisma.threecxInstance.update({
          where: { id: instance.id },
          data: { status: "offline", lastHealthCheck: new Date() },
        });
      }

      // Create SSO deployment task if requested
      if (input.deploySso && input.localIp && input.sshPassword) {
        await ctx.prisma.agentTask.create({
          data: {
            type: "deploy_sso",
            status: "pending",
            targetInstanceId: instance.id,
            createdBy: ctx.user.id,
          },
        });

        await auditLog({
          action: "threecx.sso.deploy.requested",
          category: "INTEGRATION",
          actorId: ctx.user.id,
          resource: `threecx:${instance.id}`,
          detail: { instanceName: input.name, fqdn: input.fqdn },
        });
      }

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
        companyName: z.string().max(200).nullable().optional(),
        isActive: z.boolean().optional(),
        // SSO deployment fields
        localIp: z.string().max(100).nullable().optional(),
        sshUsername: z.string().max(100).nullable().optional(),
        sshPassword: z.string().optional(),
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
      if (input.companyId !== undefined) {
        data.companyId = input.companyId;
        // Clear manual name when linking to a CW company
        if (input.companyId) data.companyName = null;
      }
      if (input.companyName !== undefined) data.companyName = input.companyName;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      if (input.localIp !== undefined) data.localIp = input.localIp;
      if (input.sshUsername !== undefined) data.sshUsername = input.sshUsername;
      if (input.sshPassword !== undefined)
        data.encryptedSshPassword = encrypt(input.sshPassword);

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

  // ─── SSO Quick Access ─────────────────────────────────────

  getSsoUrl: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.findUnique({
        where: { id: input.instanceId },
      });

      if (!instance) throw new Error("3CX instance not found");

      const password = decrypt(instance.encryptedPassword);
      const payload = Buffer.from(
        JSON.stringify({ u: instance.extensionNumber, p: password })
      ).toString("base64");

      await auditLog({
        action: "threecx.sso.opened",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threecx:${instance.id}`,
        detail: { pbxName: instance.name, fqdn: instance.fqdn },
      });

      return { url: `https://${instance.fqdn}/sso-helper.html#${payload}` };
    }),

  // ─── Live Refresh ─────────────────────────────────────────

  refreshInstance: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const connector = await ThreecxInstanceManager.get(
          input.instanceId,
          ctx.prisma
        );
        const status = await connector.getSystemStatus();

        const updated = await ctx.prisma.threecxInstance.update({
          where: { id: input.instanceId },
          data: {
            status: "online",
            version: status.version,
            os: status.os,
            callsActive: status.callsActive,
            extensionsRegistered: status.extensionsRegistered,
            extensionsTotal: status.extensionsTotal,
            userExtensions: status.userExtensions,
            maxUserExtensions: status.maxUserExtensions,
            trunksRegistered: status.trunksRegistered,
            trunksTotal: status.trunksTotal,
            cpuUsage: null, // telemetry is separate
            diskUsagePercent: status.diskUsagePercent,
            hasFailedServices: status.hasNotRunningServices,
            productCode: status.productCode ?? null,
            maxSimCalls: status.maxSimCalls,
            expirationDate: status.expirationDate
              ? new Date(status.expirationDate)
              : null,
            maintenanceExpiresAt: status.maintenanceExpiresAt
              ? new Date(status.maintenanceExpiresAt)
              : null,
            lastHealthCheck: new Date(),
            lastSeenAt: new Date(),
          },
          select: DASHBOARD_SELECT,
        });

        return { ok: true, instance: updated };
      } catch (error) {
        await ctx.prisma.threecxInstance.update({
          where: { id: input.instanceId },
          data: {
            status: "offline",
            lastHealthCheck: new Date(),
          },
        });

        return {
          ok: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
    }),

  refreshAllInstances: protectedProcedure.mutation(async ({ ctx }) => {
    const instances = await ctx.prisma.threecxInstance.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const results = await Promise.allSettled(
      instances.map(async (inst) => {
        try {
          const connector = await ThreecxInstanceManager.get(
            inst.id,
            ctx.prisma
          );
          const status = await connector.getSystemStatus();

          await ctx.prisma.threecxInstance.update({
            where: { id: inst.id },
            data: {
              status: "online",
              version: status.version,
              os: status.os,
              callsActive: status.callsActive,
              extensionsRegistered: status.extensionsRegistered,
              extensionsTotal: status.extensionsTotal,
              userExtensions: status.userExtensions,
              maxUserExtensions: status.maxUserExtensions,
              trunksRegistered: status.trunksRegistered,
              trunksTotal: status.trunksTotal,
              diskUsagePercent: status.diskUsagePercent,
              hasFailedServices: status.hasNotRunningServices,
              productCode: status.productCode ?? null,
              maxSimCalls: status.maxSimCalls,
              expirationDate: status.expirationDate
                ? new Date(status.expirationDate)
                : null,
              maintenanceExpiresAt: status.maintenanceExpiresAt
                ? new Date(status.maintenanceExpiresAt)
                : null,
              lastHealthCheck: new Date(),
              lastSeenAt: new Date(),
            },
          });

          return { id: inst.id, name: inst.name, ok: true };
        } catch (error) {
          await ctx.prisma.threecxInstance.update({
            where: { id: inst.id },
            data: { status: "offline", lastHealthCheck: new Date() },
          });

          return {
            id: inst.id,
            name: inst.name,
            ok: false,
            error:
              error instanceof Error ? error.message : "Connection failed",
          };
        }
      })
    );

    const settled = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { id: "unknown", name: "unknown", ok: false, error: "Promise rejected" }
    );

    return {
      success: settled.filter((r) => r.ok).length,
      failed: settled.filter((r) => !r.ok).length,
      results: settled,
    };
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

  getQueues: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getQueues();
    }),

  getRingGroups: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getRingGroups();
    }),

  getGroups: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      return connector.getGroups();
    }),

  getTrunkDetails: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      const result = await connector.getTrunkDetails();
      // Temporary debug logging — remove after trunk crash is fixed
      if (result.length > 0) {
        console.log("[3CX DEBUG] getTrunkDetails sample:", JSON.stringify(result[0], null, 2));
      }
      return result;
    }),

  /** Fetches users + cross-references with queues, ring groups, and groups to show membership */
  getUsersWithMembership: protectedProcedure
    .input(z.object({ instanceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );

      // Fetch all data in parallel
      const [users, queues, ringGroups, groups] = await Promise.all([
        connector.getUsers(),
        connector.getQueues().catch(() => []),
        connector.getRingGroups().catch(() => []),
        connector.getGroups().catch(() => []),
      ]);

      // Build membership lookup: extension number → { queues, ringGroups, groups }
      return users.map((user) => {
        const memberQueues = queues
          .filter((q) => q.agents.some((a) => a.number === user.number))
          .map((q) => ({
            id: q.id,
            name: q.name,
            number: q.number,
            isManager: queues
              .filter((qq) => qq.managers.includes(user.number))
              .some((qq) => qq.id === q.id),
            queueStatus: q.agents.find((a) => a.number === user.number)?.queueStatus,
          }));

        const memberRingGroups = ringGroups
          .filter((rg) => rg.members.includes(user.number))
          .map((rg) => ({
            id: rg.id,
            name: rg.name,
            number: rg.number,
          }));

        const memberGroups = groups
          .filter((g) => g.members.includes(user.number))
          .map((g) => ({
            id: g.id,
            name: g.name,
          }));

        return {
          ...user,
          queues: memberQueues,
          ringGroups: memberRingGroups,
          groups: memberGroups,
        };
      });
    }),

  getCallHistory: protectedProcedure
    .input(z.object({
      instanceId: z.string(),
      top: z.number().min(1).max(500).optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      fromNumber: z.string().max(100).optional(),
      toNumber: z.string().max(100).optional(),
      answered: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(
        input.instanceId,
        ctx.prisma
      );
      const filter = (input.dateFrom || input.dateTo || input.fromNumber || input.toNumber || input.answered !== undefined)
        ? {
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            fromNumber: input.fromNumber,
            toNumber: input.toNumber,
            answered: input.answered,
          }
        : undefined;
      return connector.getCallHistory(input.top ?? 200, filter);
    }),

  // ─── Queue Agent Actions ────────────────────────────────────

  queueAgentLogin: protectedProcedure
    .input(z.object({
      instanceId: z.string(),
      queueId: z.number(),
      extensionNumber: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.instanceId, ctx.prisma);
      await connector.queueAgentLogin(input.queueId, input.extensionNumber);

      await auditLog({
        action: "threecx.queue.agent.login",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: { queueId: input.queueId, extension: input.extensionNumber },
      });

      return { ok: true };
    }),

  queueAgentLogout: protectedProcedure
    .input(z.object({
      instanceId: z.string(),
      queueId: z.number(),
      extensionNumber: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.instanceId, ctx.prisma);
      await connector.queueAgentLogout(input.queueId, input.extensionNumber);

      await auditLog({
        action: "threecx.queue.agent.logout",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: { queueId: input.queueId, extension: input.extensionNumber },
      });

      return { ok: true };
    }),

  // ─── Admin Actions ──────────────────────────────────────────

  restartService: adminProcedure
    .input(z.object({ instanceId: z.string(), serviceName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.instanceId, ctx.prisma);
      await connector.restartService(input.serviceName);

      await auditLog({
        action: "threecx.service.restarted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: { serviceName: input.serviceName },
      });

      return { ok: true };
    }),

  restartAllServices: adminProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.instanceId, ctx.prisma);
      await connector.restartAllServices();

      await auditLog({
        action: "threecx.services.restartAll",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: {},
      });

      return { ok: true };
    }),

  restartServer: adminProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connector = await ThreecxInstanceManager.get(input.instanceId, ctx.prisma);
      await connector.restartServer();

      await auditLog({
        action: "threecx.server.restarted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: {},
      });

      return { ok: true };
    }),

  // ─── Dashboard Aggregate ───────────────────────────────────

  getDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    // Read from cached DB fields — does NOT query PBXs live
    return ctx.prisma.threecxInstance.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: DASHBOARD_SELECT,
    });
  }),

  // ─── SSO Deployment ──────────────────────────────────────────

  deploySso: adminProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.findUnique({
        where: { id: input.instanceId },
        select: { id: true, name: true, fqdn: true, localIp: true, encryptedSshPassword: true },
      });

      if (!instance) throw new Error("Instance not found");
      if (!instance.localIp || !instance.encryptedSshPassword) {
        throw new Error("SSH credentials not configured for this instance");
      }

      const task = await ctx.prisma.agentTask.create({
        data: {
          type: "deploy_sso",
          status: "pending",
          targetInstanceId: input.instanceId,
          createdBy: ctx.user.id,
        },
      });

      await ctx.prisma.threecxInstance.update({
        where: { id: input.instanceId },
        data: { ssoDeployStatus: "pending" },
      });

      await auditLog({
        action: "threecx.sso.deploy.requested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: { taskId: task.id, instanceName: instance.name, fqdn: instance.fqdn },
      });

      return { taskId: task.id };
    }),

  removeSso: adminProcedure
    .input(z.object({ instanceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.threecxInstance.findUnique({
        where: { id: input.instanceId },
        select: { id: true, name: true, fqdn: true, localIp: true, encryptedSshPassword: true },
      });

      if (!instance) throw new Error("Instance not found");
      if (!instance.localIp || !instance.encryptedSshPassword) {
        throw new Error("SSH credentials not configured for this instance");
      }

      const task = await ctx.prisma.agentTask.create({
        data: {
          type: "remove_sso",
          status: "pending",
          targetInstanceId: input.instanceId,
          createdBy: ctx.user.id,
        },
      });

      await ctx.prisma.threecxInstance.update({
        where: { id: input.instanceId },
        data: { ssoDeployStatus: "pending" },
      });

      await auditLog({
        action: "threecx.sso.remove.requested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `threecx:${input.instanceId}`,
        detail: { taskId: task.id, instanceName: instance.name, fqdn: instance.fqdn },
      });

      return { taskId: task.id };
    }),

  getDeploymentTasks: adminProcedure
    .input(z.object({ instanceId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.agentTask.findMany({
        where: {
          ...(input?.instanceId ? { targetInstanceId: input.instanceId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          targetInstanceId: true,
          errorMessage: true,
          attempts: true,
          maxAttempts: true,
          createdAt: true,
          completedAt: true,
          lastAttemptAt: true,
        },
      });
    }),

  // ─── Relay Agent Management ────────────────────────────────

  getAgentStatus: protectedProcedure.query(async ({ ctx }) => {
    const agents = await ctx.prisma.onPremAgent.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        lastHeartbeat: true,
        lastIp: true,
        version: true,
      },
    });

    return agents.map((a) => ({
      ...a,
      isOnline: a.lastHeartbeat
        ? Date.now() - new Date(a.lastHeartbeat).getTime() < 30_000
        : false,
    }));
  }),

  registerAgent: adminProcedure
    .input(z.object({ name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = `rcc_ag_${crypto.randomBytes(32).toString("hex")}`;
      const apiKeyPrefix = apiKey.substring(0, 8);
      const apiKeyHash = await bcrypt.hash(apiKey, 12);

      const agent = await ctx.prisma.onPremAgent.create({
        data: {
          name: input.name,
          apiKeyHash,
          apiKeyPrefix,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "agent.registered",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${agent.id}`,
        detail: { name: input.name },
      });

      // Return the API key ONCE — cannot be retrieved again
      return { id: agent.id, name: agent.name, apiKey };
    }),

  regenerateAgentKey: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = `rcc_ag_${crypto.randomBytes(32).toString("hex")}`;
      const apiKeyPrefix = apiKey.substring(0, 8);
      const apiKeyHash = await bcrypt.hash(apiKey, 12);

      const agent = await ctx.prisma.onPremAgent.update({
        where: { id: input.id },
        data: { apiKeyHash, apiKeyPrefix },
      });

      await auditLog({
        action: "agent.key_regenerated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${agent.id}`,
        detail: { name: agent.name },
      });

      return { id: agent.id, name: agent.name, apiKey };
    }),

  deactivateAgent: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.onPremAgent.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await auditLog({
        action: "agent.deactivated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.id}`,
      });

      return { success: true };
    }),
});
