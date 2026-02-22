/**
 * Company Router — manages local Company records imported from the PSA.
 *
 * PSA (ConnectWise) is the source of truth. Companies are imported into
 * a local table so all other integrations can map their orgs/sites to them.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";
import type { NormalizedOrganization } from "../connectors/_interfaces/common";

export const companyRouter = router({
  // ─── List & Read ───────────────────────────────────────────

  list: protectedProcedure
    .input(
      z.object({
        searchTerm: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.searchTerm) {
        where.name = { contains: input.searchTerm, mode: "insensitive" };
      }
      if (input.status) {
        where.status = input.status;
      }

      const [companies, totalCount] = await Promise.all([
        ctx.prisma.company.findMany({
          where,
          orderBy: { name: "asc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          include: {
            integrationMappings: true,
            _count: { select: { threecxInstances: true } },
          },
        }),
        ctx.prisma.company.count({ where }),
      ]);

      return {
        data: companies,
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(totalCount / input.pageSize),
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.prisma.company.findUnique({
        where: { id: input.id },
        include: {
          integrationMappings: true,
          threecxInstances: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              fqdn: true,
              status: true,
              version: true,
              callsActive: true,
              extensionsRegistered: true,
              extensionsTotal: true,
              trunksRegistered: true,
              trunksTotal: true,
            },
          },
        },
      });

      if (!company) {
        throw new Error("Company not found");
      }

      return company;
    }),

  // ─── Import from PSA ───────────────────────────────────────

  importFromPsa: adminProcedure
    .input(
      z.object({
        statusFilter: z.string().default("Active"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const result = await psa.getCompanies(undefined, page, pageSize);
        const companies = result.data;

        for (const org of companies) {
          // Filter by status
          if (
            input.statusFilter &&
            org.status &&
            !org.status.toLowerCase().includes(input.statusFilter.toLowerCase())
          ) {
            skipped++;
            continue;
          }

          const raw = org._raw as Record<string, unknown> | undefined;
          const identifier =
            raw && typeof raw.identifier === "string"
              ? raw.identifier
              : undefined;

          const existing = await ctx.prisma.company.findUnique({
            where: { psaSourceId: org.sourceId },
          });

          if (existing) {
            await ctx.prisma.company.update({
              where: { id: existing.id },
              data: {
                name: org.name,
                identifier,
                status: org.status ?? "Active",
                phone: org.phone,
                website: org.website,
                addressLine1: org.address?.street,
                city: org.address?.city,
                state: org.address?.state,
                zip: org.address?.zip,
                country: org.address?.country,
                lastSyncedAt: new Date(),
              },
            });
            updated++;
          } else {
            await ctx.prisma.company.create({
              data: {
                name: org.name,
                psaSourceId: org.sourceId,
                identifier,
                status: org.status ?? "Active",
                phone: org.phone,
                website: org.website,
                addressLine1: org.address?.street,
                city: org.address?.city,
                state: org.address?.state,
                zip: org.address?.zip,
                country: org.address?.country,
                lastSyncedAt: new Date(),
              },
            });
            imported++;
          }
        }

        hasMore = result.hasMore;
        page++;
      }

      await auditLog({
        action: "company.import.batch",
        category: "DATA",
        actorId: ctx.user.id,
        detail: {
          statusFilter: input.statusFilter,
          imported,
          updated,
          skipped,
        },
      });

      return { imported, updated, skipped };
    }),

  importSingle: adminProcedure
    .input(z.object({ psaCompanyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      const org: NormalizedOrganization = await psa.getCompanyById(
        input.psaCompanyId
      );

      const raw = org._raw as Record<string, unknown> | undefined;
      const identifier =
        raw && typeof raw.identifier === "string" ? raw.identifier : undefined;

      const company = await ctx.prisma.company.upsert({
        where: { psaSourceId: org.sourceId },
        update: {
          name: org.name,
          identifier,
          status: org.status ?? "Active",
          phone: org.phone,
          website: org.website,
          addressLine1: org.address?.street,
          city: org.address?.city,
          state: org.address?.state,
          zip: org.address?.zip,
          country: org.address?.country,
          lastSyncedAt: new Date(),
        },
        create: {
          name: org.name,
          psaSourceId: org.sourceId,
          identifier,
          status: org.status ?? "Active",
          phone: org.phone,
          website: org.website,
          addressLine1: org.address?.street,
          city: org.address?.city,
          state: org.address?.state,
          zip: org.address?.zip,
          country: org.address?.country,
          lastSyncedAt: new Date(),
        },
      });

      await auditLog({
        action: "company.import.single",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `company:${company.id}`,
        detail: { psaSourceId: org.sourceId, name: org.name },
      });

      return company;
    }),

  syncAll: adminProcedure.mutation(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);

    const companies = await ctx.prisma.company.findMany({
      where: { syncEnabled: true },
      select: { id: true, psaSourceId: true },
    });

    let synced = 0;
    let failed = 0;

    for (const local of companies) {
      try {
        const org = await psa.getCompanyById(local.psaSourceId);
        const raw = org._raw as Record<string, unknown> | undefined;
        const identifier =
          raw && typeof raw.identifier === "string"
            ? raw.identifier
            : undefined;

        await ctx.prisma.company.update({
          where: { id: local.id },
          data: {
            name: org.name,
            identifier,
            status: org.status ?? "Active",
            phone: org.phone,
            website: org.website,
            addressLine1: org.address?.street,
            city: org.address?.city,
            state: org.address?.state,
            zip: org.address?.zip,
            country: org.address?.country,
            lastSyncedAt: new Date(),
          },
        });
        synced++;
      } catch {
        failed++;
      }
    }

    await auditLog({
      action: "company.sync.all",
      category: "DATA",
      actorId: ctx.user.id,
      detail: { synced, failed, total: companies.length },
    });

    return { synced, failed, total: companies.length };
  }),

  // ─── Integration Mappings ──────────────────────────────────

  getMappings: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.companyIntegrationMapping.findMany({
        where: { companyId: input.companyId },
        orderBy: { toolId: "asc" },
      });
    }),

  setMapping: adminProcedure
    .input(
      z.object({
        companyId: z.string(),
        toolId: z.string(),
        externalId: z.string(),
        externalName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.companyIntegrationMapping.upsert({
        where: {
          companyId_toolId: {
            companyId: input.companyId,
            toolId: input.toolId,
          },
        },
        update: {
          externalId: input.externalId,
          externalName: input.externalName,
          matchMethod: "manual",
          matchScore: null,
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        },
        create: {
          companyId: input.companyId,
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
          matchMethod: "manual",
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        },
      });

      await auditLog({
        action: "company.mapping.set",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${input.companyId}`,
        detail: {
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
        },
      });

      return mapping;
    }),

  removeMapping: adminProcedure
    .input(z.object({ mappingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.companyIntegrationMapping.delete({
        where: { id: input.mappingId },
      });

      await auditLog({
        action: "company.mapping.removed",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${mapping.companyId}`,
        detail: { toolId: mapping.toolId, externalId: mapping.externalId },
      });

      return { success: true };
    }),

  // ─── Lookup Helper ─────────────────────────────────────────

  resolveExternalId: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        toolId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // For ConnectWise, use psaSourceId directly
      if (input.toolId === "connectwise") {
        const company = await ctx.prisma.company.findUnique({
          where: { id: input.companyId },
          select: { psaSourceId: true },
        });
        return { externalId: company?.psaSourceId ?? null };
      }

      // For other tools, look up the mapping
      const mapping = await ctx.prisma.companyIntegrationMapping.findUnique({
        where: {
          companyId_toolId: {
            companyId: input.companyId,
            toolId: input.toolId,
          },
        },
      });

      return { externalId: mapping?.externalId ?? null };
    }),
});
