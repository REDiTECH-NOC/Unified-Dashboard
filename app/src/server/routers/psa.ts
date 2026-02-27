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

  /** Find open tickets related to an alert by company + hostname */
  findRelatedTickets: protectedProcedure
    .input(
      z.object({
        hostname: z.string().optional(),
        organizationName: z.string().optional(),
        toolId: z.string().optional(),
        organizationSourceId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let cwCompanyId: string | null = null;
      let matchedCompanyName: string | null = null;

      // 1. Try CompanyIntegrationMapping (most reliable)
      if (input.toolId && input.organizationSourceId) {
        const mapping = await ctx.prisma.companyIntegrationMapping.findFirst({
          where: {
            toolId: input.toolId,
            externalId: input.organizationSourceId,
          },
          include: { company: true },
        });
        if (mapping) {
          cwCompanyId = mapping.company.psaSourceId;
          matchedCompanyName = mapping.company.name;
        }
      }

      // 2. Fallback: fuzzy match on company name
      if (!cwCompanyId && input.organizationName) {
        const company = await ctx.prisma.company.findFirst({
          where: {
            name: { contains: input.organizationName, mode: "insensitive" },
            status: "Active",
          },
        });
        if (company?.psaSourceId) {
          cwCompanyId = company.psaSourceId;
          matchedCompanyName = company.name;
        }
      }

      if (!cwCompanyId) {
        return { tickets: [], matchedCompanyId: null, matchedCompanyName: null };
      }

      // 3. Search open tickets for this company (optionally filtered by hostname)
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const result = await psa.getTickets(
        {
          companyId: cwCompanyId,
          searchTerm: input.hostname || undefined,
        },
        1,
        15
      );

      // Filter out closed/resolved tickets
      const openTickets = result.data.filter(
        (t) => !["Closed", "Resolved", "Completed"].includes(t.status)
      );

      return {
        tickets: openTickets.slice(0, 10),
        matchedCompanyId: cwCompanyId,
        matchedCompanyName,
      };
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
        boardId: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const ticket = await psa.updateTicket(input.id, {
        status: input.status,
        priority: input.priority,
        assignTo: input.assignTo,
        boardId: input.boardId,
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
        emailContact: z.boolean().optional(),
        emailResources: z.boolean().optional(),
        emailCc: z.string().optional(),
        timeHours: z.number().min(0.01).max(24).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const note = await psa.addTicketNote(
        input.ticketId,
        input.text,
        input.internal,
        {
          emailContact: input.emailContact,
          emailResources: input.emailResources,
          emailCc: input.emailCc,
          timeHours: input.timeHours,
        }
      );

      await auditLog({
        action: "psa.ticket.note.added",
        category: "API",
        actorId: ctx.user.id,
        resource: `ticket:${input.ticketId}`,
        detail: { internal: input.internal, emailedContact: !!input.emailContact, emailedResources: !!input.emailResources, timeHours: input.timeHours },
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
        timeStart: z.string().optional(),
        timeEnd: z.string().optional(),
        billableOption: z.enum(["Billable", "DoNotBill", "NoCharge", "NoDefault"]).optional(),
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
        detail: { hours: input.hoursWorked, billable: input.billableOption },
      });

      return entry;
    }),

  getWorkTypes: protectedProcedure.query(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    if ("getWorkTypes" in psa && typeof (psa as any).getWorkTypes === "function") {
      return (psa as any).getWorkTypes() as Promise<Array<{ id: string; name: string }>>;
    }
    return [] as Array<{ id: string; name: string }>;
  }),

  getTimeEntries: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      if ("getTimeEntries" in psa && typeof (psa as any).getTimeEntries === "function") {
        return (psa as any).getTimeEntries(input.ticketId) as Promise<Array<{
          id: string;
          member?: string;
          actualHours: number;
          notes?: string;
          workType?: string;
          timeStart?: string;
          timeEnd?: string;
          dateEntered?: string;
        }>>;
      }
      return [] as Array<{
        id: string;
        member?: string;
        actualHours: number;
        notes?: string;
        workType?: string;
        timeStart?: string;
        timeEnd?: string;
        dateEntered?: string;
      }>;
    }),

  // ─── Companies ───────────────────────────────────────────

  getCompanies: protectedProcedure
    .input(
      z.object({
        searchTerm: z.string().optional(),
        statuses: z.array(z.string()).optional(),
        types: z.array(z.string()).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const result = await psa.getCompanies(
        {
          searchTerm: input.searchTerm,
          statuses: input.statuses,
          types: input.types,
        },
        input.page,
        input.pageSize
      );
      // Extract CW-specific display fields from _raw
      return {
        ...result,
        data: result.data.map((org) => {
          const raw = org._raw as Record<string, unknown> | undefined;
          return {
            sourceToolId: org.sourceToolId,
            sourceId: org.sourceId,
            name: org.name,
            phone: org.phone,
            website: org.website,
            address: org.address,
            status: org.status,
            identifier: (raw?.identifier as string) ?? undefined,
            typeName: (raw?.types as Array<{ name: string }> | undefined)?.[0]?.name,
          };
        }),
      };
    }),

  getCompanyById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      return psa.getCompanyById(input.id);
    }),

  getCompanyStatuses: protectedProcedure.query(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    const connector = psa as { getCompanyStatuses?: () => Promise<Array<{ id: number; name: string }>> };
    if (typeof connector.getCompanyStatuses === "function") {
      return connector.getCompanyStatuses();
    }
    return [];
  }),

  getCompanyTypes: protectedProcedure.query(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    const connector = psa as { getCompanyTypes?: () => Promise<Array<{ id: number; name: string }>> };
    if (typeof connector.getCompanyTypes === "function") {
      return connector.getCompanyTypes();
    }
    return [];
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

  // ─── Multi-Board Data (dashboard module) ────────────────────

  getMultiBoardData: protectedProcedure
    .input(
      z.object({
        boardIds: z.array(z.string()).min(1).max(10),
        assignedTo: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);

      // Fetch statuses and tickets for each board in parallel
      const results = await Promise.all(
        input.boardIds.map(async (boardId) => {
          const [statuses, tickets] = await Promise.all([
            psa.getBoardStatuses(boardId),
            psa.getTickets(
              { boardId, assignedTo: input.assignedTo },
              1,
              100
            ),
          ]);
          return { boardId, statuses, tickets: tickets.data };
        })
      );

      // Merge statuses (deduplicated by name, keep first occurrence)
      const seenStatuses = new Map<string, { name: string; boardId: string }>();
      for (const r of results) {
        for (const s of r.statuses) {
          if (!seenStatuses.has(s.name)) {
            seenStatuses.set(s.name, { name: s.name, boardId: r.boardId });
          }
        }
      }

      // Merge all tickets
      const allTickets = results.flatMap((r) => r.tickets);

      return {
        statuses: Array.from(seenStatuses.values()),
        tickets: allTickets,
        totalTickets: allTickets.length,
      };
    }),

  // ─── Current User's CW Member ID ──────────────────────────

  getMyMemberId: protectedProcedure.query(async ({ ctx }) => {
    const mapping = await ctx.prisma.userIntegrationMapping.findUnique({
      where: {
        userId_toolId: { userId: ctx.user.id, toolId: "connectwise" },
      },
    });
    return mapping?.externalId ?? null;
  }),

  // ─── Member Time Entries (Calendar) ───────────────────────

  getMemberTimeEntries: protectedProcedure
    .input(
      z.object({
        memberIdentifier: z.string(),
        dateStart: z.date(),
        dateEnd: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const connector = psa as {
        getMemberTimeEntries?: (
          memberIdentifier: string,
          dateStart: Date,
          dateEnd: Date
        ) => Promise<Array<{
          id: string;
          ticketId?: string;
          companyName?: string;
          member?: string;
          actualHours: number;
          notes?: string;
          timeStart?: string;
          timeEnd?: string;
          dateEntered?: string;
        }>>;
      };
      if (typeof connector.getMemberTimeEntries !== "function") {
        return [];
      }
      return connector.getMemberTimeEntries(
        input.memberIdentifier,
        input.dateStart,
        input.dateEnd
      );
    }),

  // ─── Schedule Entries (Calendar) ──────────────────────────

  getScheduleEntries: protectedProcedure
    .input(
      z.object({
        memberIdentifier: z.string().optional(),
        dateStart: z.date(),
        dateEnd: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const connector = psa as {
        getScheduleEntries?: (params: {
          memberIdentifier?: string;
          dateStart: Date;
          dateEnd: Date;
        }) => Promise<Array<{
          id: string;
          objectId?: string;
          memberName?: string;
          type?: string;
          dateStart: Date;
          dateEnd: Date;
          hours?: number;
          status?: string;
        }>>;
      };
      if (typeof connector.getScheduleEntries !== "function") {
        return [];
      }
      return connector.getScheduleEntries({
        memberIdentifier: input.memberIdentifier,
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
      });
    }),
});
