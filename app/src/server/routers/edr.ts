/**
 * EDR Router — tRPC procedures for endpoint detection & response.
 *
 * Uses IEdrConnector via ConnectorFactory — never imports SentinelOne directly.
 * Security actions (isolate, mitigate) are audit-logged.
 */

import { z } from "zod";
import { router, adminProcedure, requirePerm } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";
import { cachedQuery } from "@/lib/query-cache";

const THREAT_STALE = 10 * 60_000; // 10 min

export const edrRouter = router({
  // ─── Threats ─────────────────────────────────────────────

  getThreats: requirePerm("alerts.sentinelone.view")
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
      const dateKey = input.createdAfter?.toISOString().substring(0, 10) ?? "all";
      const key = `threats:${dateKey}:${input.pageSize}:${input.status ?? ""}:${input.severity ?? ""}`;

      return cachedQuery("edr", THREAT_STALE, key, async () => {
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
      });
    }),

  getThreatById: requirePerm("alerts.sentinelone.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getThreatById(input.id);
    }),

  // ─── Threat Actions ──────────────────────────────────────

  mitigateThreat: adminProcedure
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

  // ─── Threat Workflow Actions ─────────────────────────────

  updateIncidentStatus: adminProcedure
    .input(
      z.object({
        threatIds: z.array(z.string()).min(1),
        status: z.enum(["resolved", "in_progress", "unresolved"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.updateIncidentStatus(input.threatIds, input.status);

      await auditLog({
        action: `security.threat.incident.${input.status}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threats:${input.threatIds.join(",")}`,
        detail: { status: input.status, count: input.threatIds.length },
      });

      return { success: true };
    }),

  updateAnalystVerdict: adminProcedure
    .input(
      z.object({
        threatIds: z.array(z.string()).min(1),
        verdict: z.enum(["true_positive", "false_positive", "suspicious", "undefined"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.updateAnalystVerdict(input.threatIds, input.verdict);

      await auditLog({
        action: `security.threat.verdict.${input.verdict}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threats:${input.threatIds.join(",")}`,
        detail: { verdict: input.verdict, count: input.threatIds.length },
      });

      return { success: true };
    }),

  markAsBenign: adminProcedure
    .input(
      z.object({
        threatIds: z.array(z.string()).min(1),
        whiteningOption: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.markAsBenign(input.threatIds, input.whiteningOption);

      await auditLog({
        action: "security.threat.marked_benign",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threats:${input.threatIds.join(",")}`,
        detail: { whiteningOption: input.whiteningOption, count: input.threatIds.length },
      });

      return { success: true };
    }),

  markAsThreat: adminProcedure
    .input(
      z.object({
        threatIds: z.array(z.string()).min(1),
        whiteningOption: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.markAsThreat(input.threatIds, input.whiteningOption);

      await auditLog({
        action: "security.threat.marked_threat",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threats:${input.threatIds.join(",")}`,
        detail: { whiteningOption: input.whiteningOption, count: input.threatIds.length },
      });

      return { success: true };
    }),

  // ─── Threat Notes ──────────────────────────────────────────

  getThreatNotes: requirePerm("alerts.sentinelone.view")
    .input(
      z.object({
        threatId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getThreatNotes(input.threatId, input.cursor, input.pageSize);
    }),

  addThreatNote: adminProcedure
    .input(
      z.object({
        threatId: z.string(),
        text: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      const result = await edr.addThreatNote(input.threatId, input.text);

      await auditLog({
        action: "security.threat.note.added",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `threat:${input.threatId}`,
        detail: { noteId: result.id },
      });

      return result;
    }),

  // ─── Threat Timeline ──────────────────────────────────────

  getThreatTimeline: requirePerm("alerts.sentinelone.view")
    .input(
      z.object({
        threatId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getThreatTimeline(input.threatId, input.cursor, input.pageSize);
    }),

  // ─── Agent Actions ─────────────────────────────────────────

  isolateDevice: adminProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      // Fetch agent info for audit before action
      let agentInfo: Record<string, unknown> = {};
      try { const a = await edr.getAgentById(input.agentId); agentInfo = { hostname: a?.hostname, organization: a?.organizationName, os: a?.os }; } catch {}
      await edr.isolateDevice(input.agentId);

      await auditLog({
        action: "security.action.isolate",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
        detail: agentInfo,
      });

      return { success: true };
    }),

  unisolateDevice: adminProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      let agentInfo: Record<string, unknown> = {};
      try { const a = await edr.getAgentById(input.agentId); agentInfo = { hostname: a?.hostname, organization: a?.organizationName, os: a?.os }; } catch {}
      await edr.unisolateDevice(input.agentId);

      await auditLog({
        action: "security.action.unisolate",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
        detail: agentInfo,
      });

      return { success: true };
    }),

  triggerFullScan: adminProcedure
    .input(z.object({ agentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      let agentInfo: Record<string, unknown> = {};
      try { const a = await edr.getAgentById(input.agentId); agentInfo = { hostname: a?.hostname, organization: a?.organizationName, os: a?.os }; } catch {}
      await edr.triggerFullScan(input.agentId);

      await auditLog({
        action: "security.action.scan",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
        detail: agentInfo,
      });

      return { success: true };
    }),

  // ─── Agents ──────────────────────────────────────────────

  getAgents: requirePerm("alerts.sentinelone.view")
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

  getAgentById: requirePerm("alerts.sentinelone.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getAgentById(input.id);
    }),

  // ─── Agent Applications ─────────────────────────────────

  getAgentApplications: requirePerm("alerts.sentinelone.view")
    .input(
      z.object({
        agentId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getAgentApplications(input.agentId, input.cursor, input.pageSize);
    }),

  // ─── Sites & Groups ─────────────────────────────────────

  getSites: requirePerm("alerts.sentinelone.view").query(async ({ ctx }) => {
    const edr = await ConnectorFactory.get("edr", ctx.prisma);
    return edr.getSites();
  }),

  getGroups: requirePerm("alerts.sentinelone.view")
    .input(z.object({ siteId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getGroups(input.siteId);
    }),

  // ─── Exclusions ──────────────────────────────────────────

  getExclusions: requirePerm("alerts.sentinelone.view")
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

  createExclusion: adminProcedure
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

  deleteExclusion: adminProcedure
    .input(z.object({ exclusionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      await edr.deleteExclusion(input.exclusionId);

      await auditLog({
        action: "security.exclusion.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `exclusion:${input.exclusionId}`,
      });

      return { success: true };
    }),

  // ─── Deep Visibility ────────────────────────────────────

  queryDeepVisibility: adminProcedure
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

  getDeepVisibilityResults: requirePerm("alerts.sentinelone.view")
    .input(z.object({ queryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const edr = await ConnectorFactory.get("edr", ctx.prisma);
      return edr.getDeepVisibilityResults(input.queryId);
    }),

  // ─── Activities ──────────────────────────────────────────

  getActivities: requirePerm("alerts.sentinelone.view")
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
