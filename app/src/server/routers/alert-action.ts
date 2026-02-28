/**
 * Alert Action Router — tRPC procedures for alert state overlay.
 *
 * Manages ownership, closed status, notes, and ticket linking
 * for alerts from external sources (S1, BP, Ninja, Uptime, Cove, etc.).
 * AlertState rows are lightweight — they don't duplicate alert data.
 */

import { z } from "zod";
import { router, requirePerm } from "../trpc";
import { auditLog } from "@/lib/audit";

export const alertActionRouter = router({
  // ─── Batch Get States ───────────────────────────────────
  getStates: requirePerm("alerts.view")
    .input(
      z.object({
        alertIds: z.array(z.string()).max(500),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.alertIds.length === 0) return {};
      const states = await ctx.prisma.alertState.findMany({
        where: { alertId: { in: input.alertIds } },
        include: {
          owner: { select: { id: true, name: true, avatar: true } },
          closedBy: { select: { id: true, name: true } },
        },
      });
      const map: Record<string, (typeof states)[number]> = {};
      for (const s of states) {
        map[s.alertId] = s;
      }
      return map;
    }),

  // ─── Take Ownership ─────────────────────────────────────
  takeOwnership: requirePerm("alerts.manage")
    .input(
      z.object({
        alertIds: z.array(z.string()).min(1).max(100),
        source: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.alertIds.map((alertId) =>
          ctx.prisma.alertState.upsert({
            where: { alertId },
            create: { alertId, source: input.source, ownerId: ctx.user.id },
            update: { ownerId: ctx.user.id },
          })
        )
      );

      await auditLog({
        action: "alert.ownership.taken",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alertIds: input.alertIds, count: input.alertIds.length },
      });

      return results;
    }),

  // ─── Release Ownership ──────────────────────────────────
  releaseOwnership: requirePerm("alerts.manage")
    .input(
      z.object({
        alertIds: z.array(z.string()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.alertState.updateMany({
        where: { alertId: { in: input.alertIds }, ownerId: ctx.user.id },
        data: { ownerId: null },
      });

      await auditLog({
        action: "alert.ownership.released",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alertIds: input.alertIds },
      });

      return { released: input.alertIds.length };
    }),

  // ─── Close Alert(s) With Notes ──────────────────────────
  close: requirePerm("alerts.manage")
    .input(
      z.object({
        alertIds: z.array(z.string()).min(1).max(100),
        source: z.string(),
        note: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const results = await Promise.all(
        input.alertIds.map((alertId) =>
          ctx.prisma.alertState.upsert({
            where: { alertId },
            create: {
              alertId,
              source: input.source,
              closed: true,
              closedAt: now,
              closedById: ctx.user.id,
              closeNote: input.note,
              ownerId: ctx.user.id,
            },
            update: {
              closed: true,
              closedAt: now,
              closedById: ctx.user.id,
              closeNote: input.note,
            },
          })
        )
      );

      await auditLog({
        action: "alert.closed",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: {
          alertIds: input.alertIds,
          note: input.note.substring(0, 200),
          count: input.alertIds.length,
        },
      });

      return results;
    }),

  // ─── Reopen Alert ───────────────────────────────────────
  reopen: requirePerm("alerts.manage")
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.alertState.update({
        where: { alertId: input.alertId },
        data: { closed: false, closedAt: null, closedById: null, closeNote: null },
      });

      await auditLog({
        action: "alert.reopened",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alertId: input.alertId },
      });

      return result;
    }),

  // ─── Link Existing Ticket ──────────────────────────────
  linkTicket: requirePerm("alerts.manage")
    .input(
      z.object({
        alertId: z.string(),
        source: z.string(),
        ticketId: z.string(),
        ticketSummary: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.alertState.upsert({
        where: { alertId: input.alertId },
        create: {
          alertId: input.alertId,
          source: input.source,
          linkedTicketId: input.ticketId,
          linkedTicketSummary: input.ticketSummary,
          matchMethod: "manual_link",
          matchedAt: new Date(),
        },
        update: {
          linkedTicketId: input.ticketId,
          linkedTicketSummary: input.ticketSummary,
          matchMethod: "manual_link",
          matchedAt: new Date(),
        },
      });

      await auditLog({
        action: "alert.ticket.linked",
        category: "SECURITY",
        actorId: ctx.user.id,
        detail: { alertId: input.alertId, ticketId: input.ticketId },
      });

      return result;
    }),

  // ─── Create Ticket + Link to Alert(s) ──────────────────
  createAndLink: requirePerm("tickets.create")
    .input(
      z.object({
        alertIds: z.array(z.string()).min(1).max(50),
        source: z.string(),
        summary: z.string().min(1).max(500),
        description: z.string().optional(),
        companyId: z.string(),
        priority: z
          .enum(["critical", "high", "medium", "low", "none"])
          .optional(),
        boardId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user's CW member ID for auto-assignment
      const memberMapping =
        await ctx.prisma.userIntegrationMapping.findUnique({
          where: {
            userId_toolId: { userId: ctx.user.id, toolId: "connectwise" },
          },
        });

      // Create the ticket via the PSA connector
      const { ConnectorFactory } = await import("../connectors/factory");
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const ticket = await psa.createTicket({
        summary: input.summary,
        description: input.description,
        companyId: input.companyId,
        priority: input.priority,
        assignTo: memberMapping?.externalId,
        boardId: input.boardId,
      });

      // Link all alerts to this ticket
      const now = new Date();
      await Promise.all(
        input.alertIds.map((alertId) =>
          ctx.prisma.alertState.upsert({
            where: { alertId },
            create: {
              alertId,
              source: input.source,
              linkedTicketId: ticket.sourceId,
              linkedTicketSummary: ticket.summary,
              matchMethod: "manual_create",
              matchedAt: now,
              ownerId: ctx.user.id,
            },
            update: {
              linkedTicketId: ticket.sourceId,
              linkedTicketSummary: ticket.summary,
              matchMethod: "manual_create",
              matchedAt: now,
            },
          })
        )
      );

      await auditLog({
        action: "alert.ticket.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `ticket:${ticket.sourceId}`,
        detail: {
          alertIds: input.alertIds,
          ticketId: ticket.sourceId,
          summary: input.summary,
          companyId: input.companyId,
        },
      });

      return { ticket, linkedCount: input.alertIds.length };
    }),
});
