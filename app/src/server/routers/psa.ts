/**
 * PSA Router — tRPC procedures for ticket and company operations.
 *
 * Uses IPsaConnector via ConnectorFactory — never imports ConnectWise directly.
 * Swap PSA tools by configuring a different connector in Settings > Integrations.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";

export const psaRouter = router({
  // ─── Tickets ─────────────────────────────────────────────

  getTickets: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        boardId: z.string().optional(),
        assignedTo: z.string().optional(),
        searchTerm: z.string().optional(),
        createdAfter: z.date().optional(),
        createdBefore: z.date().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getTickets(
        {
          companyId: input.companyId,
          status: input.status,
          priority: input.priority,
          boardId: input.boardId,
          assignedTo: input.assignedTo,
          searchTerm: input.searchTerm,
          createdAfter: input.createdAfter,
          createdBefore: input.createdBefore,
        },
        input.page,
        input.pageSize
      );
    }),

  getTicketById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getTicketById(input.id);
    }),

  createTicket: protectedProcedure
    .input(
      z.object({
        summary: z.string().min(1).max(500),
        description: z.string().optional(),
        companyId: z.string(),
        contactId: z.string().optional(),
        priority: z
          .enum(["critical", "high", "medium", "low", "none"])
          .optional(),
        boardId: z.string().optional(),
        type: z.string().optional(),
        assignTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const ticket = await psa.createTicket(input);

      await auditLog({
        action: "psa.ticket.created",
        category: "API",
        actorId: ctx.user.id,
        resource: `ticket:${ticket.sourceId}`,
        detail: {
          summary: input.summary,
          companyId: input.companyId,
          priority: input.priority,
        },
      });

      return ticket;
    }),

  updateTicket: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignTo: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const ticket = await psa.updateTicket(input.id, {
        status: input.status,
        priority: input.priority,
        assignTo: input.assignTo,
        note: input.note,
      });

      await auditLog({
        action: "psa.ticket.updated",
        category: "API",
        actorId: ctx.user.id,
        resource: `ticket:${input.id}`,
        detail: {
          fields: Object.keys(input).filter((k) => k !== "id"),
        },
      });

      return ticket;
    }),

  getTicketNotes: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getTicketNotes(input.ticketId);
    }),

  addTicketNote: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        text: z.string().min(1),
        internal: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const note = await psa.addTicketNote(
        input.ticketId,
        input.text,
        input.internal
      );

      await auditLog({
        action: "psa.ticket.note.added",
        category: "API",
        actorId: ctx.user.id,
        resource: `ticket:${input.ticketId}`,
        detail: { internal: input.internal },
      });

      return note;
    }),

  addTimeEntry: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        hoursWorked: z.number().min(0.01).max(24),
        notes: z.string().optional(),
        workType: z.string().optional(),
        memberId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const entry = await psa.addTimeEntry(input);

      await auditLog({
        action: "psa.time.added",
        category: "API",
        actorId: ctx.user.id,
        resource: `ticket:${input.ticketId}`,
        detail: { hours: input.hoursWorked },
      });

      return entry;
    }),

  // ─── Companies ───────────────────────────────────────────

  getCompanies: protectedProcedure
    .input(
      z.object({
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getCompanies(input.searchTerm, input.page, input.pageSize);
    }),

  getCompanyById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getCompanyById(input.id);
    }),

  // ─── Contacts ────────────────────────────────────────────

  getContacts: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getContacts(
        input.companyId,
        input.searchTerm,
        input.page,
        input.pageSize
      );
    }),

  getContactById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getContactById(input.id);
    }),

  // ─── Boards & Members ───────────────────────────────────

  getBoards: protectedProcedure.query(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    return psa.getBoards();
  }),

  getBoardStatuses: protectedProcedure
    .input(z.object({ boardId: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getBoardStatuses(input.boardId);
    }),

  getMembers: protectedProcedure.query(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    return psa.getMembers();
  }),
});
