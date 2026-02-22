/**
 * Company Matching Router — auto-match external orgs to local Company records.
 *
 * Handles:
 * 1. Fuzzy organization matching across all tools (NinjaOne, SentinelOne, IT Glue, etc.)
 * 2. ConnectWise member → app User mapping (auto by email, manual fallback)
 *
 * Uses Levenshtein-based fuzzy matching with configurable thresholds.
 * Admin reviews and confirms auto-matches for confidence.
 */

import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { ConnectorNotConfiguredError } from "../connectors/_base/errors";
import { auditLog } from "@/lib/audit";
import {
  batchMatch,
  type MatchCandidate,
} from "@/lib/fuzzy-match";

/** Fetch all orgs from a given tool, returning { id, name } pairs */
async function fetchToolOrgs(
  toolId: string,
  prisma: Parameters<typeof ConnectorFactory.get>[1]
): Promise<Array<{ id: string; name: string }>> {
  switch (toolId) {
    case "ninjaone": {
      const rmm = await ConnectorFactory.get("rmm", prisma);
      const orgs = await rmm.getOrganizations();
      return orgs.map((o) => ({ id: o.sourceId, name: o.name }));
    }
    case "itglue": {
      const docs = await ConnectorFactory.get("documentation", prisma);
      const result: Array<{ id: string; name: string }> = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const resp = await docs.getOrganizations(undefined, page, 100);
        result.push(...resp.data.map((o) => ({ id: o.sourceId, name: o.name })));
        hasMore = resp.hasMore;
        page++;
      }
      return result;
    }
    case "sentinelone": {
      const edr = await ConnectorFactory.get("edr", prisma);
      const sites = await edr.getSites();
      return sites.map((s) => ({ id: s.id, name: s.name }));
    }
    default:
      throw new Error(`Unsupported tool for org matching: ${toolId}`);
  }
}

/** Tools that support org matching */
const MATCHABLE_TOOLS = ["ninjaone", "sentinelone", "itglue"] as const;

export const companyMatchingRouter = router({
  // ─── Organization Matching ─────────────────────────────────

  autoMatch: adminProcedure
    .input(z.object({ toolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch external orgs
      const externalOrgs = await fetchToolOrgs(input.toolId, ctx.prisma);

      // Fetch local companies as candidates
      const companies = await ctx.prisma.company.findMany({
        select: { id: true, name: true },
      });
      const candidates: MatchCandidate[] = companies.map((c) => ({
        id: c.id,
        name: c.name,
      }));

      // Get existing mappings to exclude already-matched orgs
      const existingMappings =
        await ctx.prisma.companyIntegrationMapping.findMany({
          where: { toolId: input.toolId },
          select: { externalId: true },
        });
      const mappedExternalIds = new Set(existingMappings.map((m) => m.externalId));

      // Filter to only unmatched orgs
      const unmatchedOrgs = externalOrgs.filter(
        (o) => !mappedExternalIds.has(o.id)
      );

      // Run fuzzy matching
      const results = batchMatch(unmatchedOrgs, candidates);

      // Also check that the target companies don't already have a mapping for this tool
      const existingCompanyMappings =
        await ctx.prisma.companyIntegrationMapping.findMany({
          where: { toolId: input.toolId },
          select: { companyId: true },
        });
      const mappedCompanyIds = new Set(
        existingCompanyMappings.map((m) => m.companyId)
      );

      // Create mappings for confident auto-matches
      let autoCreated = 0;
      for (const match of results.matched) {
        if (mappedCompanyIds.has(match.companyId)) continue;

        await ctx.prisma.companyIntegrationMapping.create({
          data: {
            companyId: match.companyId,
            toolId: input.toolId,
            externalId: match.externalId,
            externalName: match.externalName,
            matchMethod: "auto",
            matchScore: match.score,
          },
        });
        mappedCompanyIds.add(match.companyId);
        autoCreated++;
      }

      await auditLog({
        action: "company.matching.auto",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: {
          toolId: input.toolId,
          totalExternal: externalOrgs.length,
          alreadyMapped: mappedExternalIds.size,
          autoMatched: autoCreated,
          suggested: results.suggested.length,
          unmatched: results.unmatched.length,
        },
      });

      return {
        autoMatched: autoCreated,
        suggested: results.suggested.length,
        unmatched: results.unmatched.length,
        totalExternal: externalOrgs.length,
        alreadyMapped: mappedExternalIds.size,
      };
    }),

  getUnmatched: adminProcedure
    .input(z.object({ toolId: z.string() }))
    .query(async ({ ctx, input }) => {
      let externalOrgs: Array<{ id: string; name: string }>;
      try {
        externalOrgs = await fetchToolOrgs(input.toolId, ctx.prisma);
      } catch (error) {
        if (error instanceof ConnectorNotConfiguredError) {
          return { unmatched: [], suggested: [], toolConfigured: false };
        }
        throw error;
      }

      // Get existing mappings
      const existingMappings =
        await ctx.prisma.companyIntegrationMapping.findMany({
          where: { toolId: input.toolId },
          select: { externalId: true },
        });
      const mappedExternalIds = new Set(existingMappings.map((m) => m.externalId));

      // Filter to unmatched
      const unmatchedOrgs = externalOrgs.filter(
        (o) => !mappedExternalIds.has(o.id)
      );

      // Get candidates for suggestions
      const companies = await ctx.prisma.company.findMany({
        select: { id: true, name: true },
      });
      const candidates: MatchCandidate[] = companies.map((c) => ({
        id: c.id,
        name: c.name,
      }));

      const results = batchMatch(unmatchedOrgs, candidates);

      return {
        unmatched: results.unmatched,
        suggested: [...results.suggested, ...results.matched],
        toolConfigured: true,
      };
    }),

  verifyMatch: adminProcedure
    .input(z.object({ mappingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.companyIntegrationMapping.update({
        where: { id: input.mappingId },
        data: {
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
        },
      });

      await auditLog({
        action: "company.matching.verified",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `company:${mapping.companyId}`,
        detail: {
          toolId: mapping.toolId,
          externalId: mapping.externalId,
          matchMethod: mapping.matchMethod,
          matchScore: mapping.matchScore,
        },
      });

      return mapping;
    }),

  getMatchingStats: adminProcedure.query(async ({ ctx }) => {
    const stats: Array<{
      toolId: string;
      displayName: string;
      totalMapped: number;
      autoMapped: number;
      manualMapped: number;
      verified: number;
      configured: boolean;
    }> = [];

    for (const toolId of MATCHABLE_TOOLS) {
      // Check if tool is configured
      const config = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId },
      });
      const configured = config?.status === "connected";

      const mappings = await ctx.prisma.companyIntegrationMapping.findMany({
        where: { toolId },
      });

      stats.push({
        toolId,
        displayName:
          toolId === "ninjaone"
            ? "NinjaOne"
            : toolId === "sentinelone"
              ? "SentinelOne"
              : toolId === "itglue"
                ? "IT Glue"
                : toolId,
        totalMapped: mappings.length,
        autoMapped: mappings.filter((m) => m.matchMethod === "auto").length,
        manualMapped: mappings.filter((m) => m.matchMethod === "manual").length,
        verified: mappings.filter((m) => m.verifiedAt !== null).length,
        configured,
      });
    }

    const totalCompanies = await ctx.prisma.company.count();

    return { stats, totalCompanies };
  }),

  // ─── ConnectWise Member → User Mapping ─────────────────────

  autoMatchMembers: adminProcedure.mutation(async ({ ctx }) => {
    const psa = await ConnectorFactory.get("psa", ctx.prisma);
    const members = await psa.getMembers();

    // Get all app users
    const users = await ctx.prisma.user.findMany({
      select: { id: true, email: true, name: true },
    });

    // Get existing mappings
    const existingMappings = await ctx.prisma.userIntegrationMapping.findMany({
      where: { toolId: "connectwise" },
      select: { externalId: true, userId: true },
    });
    const mappedExternalIds = new Set(existingMappings.map((m) => m.externalId));
    const mappedUserIds = new Set(existingMappings.map((m) => m.userId));

    let matched = 0;
    const unmatchedMembers: Array<{ id: string; name: string; email: string }> =
      [];

    for (const member of members) {
      if (mappedExternalIds.has(member.id)) continue;

      // Try exact email match (case-insensitive)
      const user = member.email
        ? users.find(
            (u) =>
              u.email.toLowerCase() === member.email.toLowerCase() &&
              !mappedUserIds.has(u.id)
          )
        : undefined;

      if (user) {
        await ctx.prisma.userIntegrationMapping.create({
          data: {
            userId: user.id,
            toolId: "connectwise",
            externalId: member.id,
            externalName: member.name,
            externalEmail: member.email,
            matchMethod: "auto_email",
          },
        });
        mappedUserIds.add(user.id);
        matched++;
      } else {
        unmatchedMembers.push(member);
      }
    }

    await auditLog({
      action: "member.matching.auto",
      category: "INTEGRATION",
      actorId: ctx.user.id,
      detail: {
        toolId: "connectwise",
        totalMembers: members.length,
        autoMatched: matched,
        unmatched: unmatchedMembers.length,
      },
    });

    return {
      matched,
      unmatched: unmatchedMembers.length,
      unmatchedMembers,
    };
  }),

  getUnmatchedMembers: adminProcedure.query(async ({ ctx }) => {
    let members: Array<{ id: string; name: string; email: string }>;
    try {
      const psa = await ConnectorFactory.get("psa", ctx.prisma);
      members = await psa.getMembers();
    } catch (error) {
      if (error instanceof ConnectorNotConfiguredError) {
        return { members: [], psaConfigured: false };
      }
      throw error;
    }

    const existingMappings = await ctx.prisma.userIntegrationMapping.findMany({
      where: { toolId: "connectwise" },
      select: { externalId: true },
    });
    const mappedIds = new Set(existingMappings.map((m) => m.externalId));

    return {
      members: members.filter((m) => !mappedIds.has(m.id)),
      psaConfigured: true,
    };
  }),

  mapMember: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        toolId: z.string(),
        externalId: z.string(),
        externalName: z.string().optional(),
        externalEmail: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.userIntegrationMapping.upsert({
        where: {
          userId_toolId: {
            userId: input.userId,
            toolId: input.toolId,
          },
        },
        update: {
          externalId: input.externalId,
          externalName: input.externalName,
          externalEmail: input.externalEmail,
          matchMethod: "manual",
        },
        create: {
          userId: input.userId,
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
          externalEmail: input.externalEmail,
          matchMethod: "manual",
        },
      });

      await auditLog({
        action: "member.mapping.manual",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `user:${input.userId}`,
        detail: {
          toolId: input.toolId,
          externalId: input.externalId,
          externalName: input.externalName,
        },
      });

      return mapping;
    }),

  getUserMappings: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.userIntegrationMapping.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
