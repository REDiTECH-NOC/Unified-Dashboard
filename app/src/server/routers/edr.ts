/**
 * EDR Router — tRPC procedures for endpoint detection & response.
 *
 * Uses IEdrConnector via ConnectorFactory — never imports SentinelOne directly.
 * Security actions (isolate, mitigate) are audit-logged.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";

export const edrRouter = router({
  // ─── Threats ─────────────────────────────────────────────

  getThreats: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        groupId: z.string().optional(),
        status: z.string().optional(),
        classification: z.string().optional(),
        severity: z.string().optional(),
        createdAfter: z.date().optional(),
        searchTerm: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getThreats(
        {
          siteId: input.siteId,
          groupId: input.groupId,
          status: input.status,
          classification: input.classification,
          severity: input.severity,
          createdAfter: input.createdAfter,
          searchTerm: input.searchTerm,
        },
        input.cursor,
        input.pageSize
      );
    }),

  getThreatById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getThreatById(input.id);
    }),

  // ─── Threat Actions ──────────────────────────────────────

  mitigateThreat: protectedProcedure
    .input(
      z.object({
        threatId: z.string(),
        action: z.enum(["kill", "quarantine", "remediate", "rollback"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.mitigateThreat(input.threatId, input.action);

      await auditLog({
        action: `security.threat.${input.action}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threat:${input.threatId}`,
        detail: { action: input.action },
      });

      return { success: true };
    }),

  isolateDevice: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.isolateDevice(input.agentId);

      await auditLog({
        action: "security.action.isolate",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
      });

      return { success: true };
    }),

  unisolateDevice: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.unisolateDevice(input.agentId);

      await auditLog({
        action: "security.action.unisolate",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
      });

      return { success: true };
    }),

  triggerFullScan: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.triggerFullScan(input.agentId);

      await auditLog({
        action: "security.action.scan",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
      });

      return { success: true };
    }),

  // ─── Agents ──────────────────────────────────────────────

  getAgents: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        groupId: z.string().optional(),
        status: z.string().optional(),
        searchTerm: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getAgents(
        {
          siteId: input.siteId,
          groupId: input.groupId,
          status: input.status,
          searchTerm: input.searchTerm,
        },
        input.cursor,
        input.pageSize
      );
    }),

  getAgentById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getAgentById(input.id);
    }),

  // ─── Sites & Groups ─────────────────────────────────────

  getSites: protectedProcedure.query(async ({ ctx }) => {
    const edr = await ConnectorFactory.get("edr", ctx.prisma);
    return edr.getSites();
  }),

  getGroups: protectedProcedure
    .input(z.object({ siteId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getGroups(input.siteId);
    }),

  // ─── Exclusions ──────────────────────────────────────────

  getExclusions: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getExclusions(input.siteId, input.cursor, input.pageSize);
    }),

  createExclusion: protectedProcedure
    .input(
      z.object({
        type: z.enum(["path", "hash", "certificate", "browser"]),
        value: z.string().min(1),
        osType: z.enum(["windows", "macos", "linux"]).optional(),
        siteIds: z.array(z.string()).optional(),
        groupIds: z.array(z.string()).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      const result = await edr.createExclusion(input);

      await auditLog({
        action: "security.exclusion.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `exclusion:${result.id}`,
        detail: { type: input.type, value: input.value },
      });

      return result;
    }),

  // ─── Deep Visibility ────────────────────────────────────

  queryDeepVisibility: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        fromDate: z.date(),
        toDate: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      const result = await edr.queryDeepVisibility(
        input.query,
        input.fromDate,
        input.toDate
      );

      await auditLog({
        action: "security.dv.query.started",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { queryId: result.queryId },
      });

      return result;
    }),

  getDeepVisibilityResults: protectedProcedure
    .input(z.object({ queryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getDeepVisibilityResults(input.queryId);
    }),

  // ─── Activities ──────────────────────────────────────────

  getActivities: protectedProcedure
    .input(
      z.object({
        siteId: z.string().optional(),
        activityType: z.string().optional(),
        createdAfter: z.date().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getActivities(
        {
          siteId: input.siteId,
          activityType: input.activityType,
          createdAfter: input.createdAfter,
        },
        input.cursor,
        input.pageSize
      );
    }),
});
