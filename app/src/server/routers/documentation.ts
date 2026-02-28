/**
 * Documentation Router — tRPC procedures for docs, passwords, and configurations.
 *
 * Uses IDocumentationConnector via ConnectorFactory — never imports IT Glue directly.
 * Password retrieval is audit-logged (credential access is a security event).
 */

import { z } from "zod";
import { router, protectedProcedure, requirePerm } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";
import {
  resolveITGlueAccess,
  batchResolveITGlueAccess,
  getAllowedOrgIds,
} from "@/lib/itglue-permissions";

export const documentationRouter = router({
  // ─── Organizations ───────────────────────────────────────

  getOrganizations: requirePerm("documentation.view")
    .input(
      z.object({
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      const result = await docs.getOrganizations(
        input.searchTerm,
        input.page,
        input.pageSize
      );

      // Filter by IT Glue permissions — only return orgs the user has access to
      const allowedOrgs = await getAllowedOrgIds(ctx.user.id);
      if (allowedOrgs.size > 0) {
        result.data = result.data.filter((org) => allowedOrgs.has(org.sourceId));
      }

      return result;
    }),

  getOrganizationById: requirePerm("documentation.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      return docs.getOrganizationById(input.id);
    }),

  // ─── Documents (Flexible Assets / KB) ────────────────────

  getDocuments: requirePerm("documentation.view")
    .input(
      z.object({
        organizationId: z.string().optional(),
        documentType: z.string().optional(),
        searchTerm: z.string().optional(),
        updatedAfter: z.date().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // If org is specified, check IT Glue permissions for flexible_assets section
      if (input.organizationId) {
        const access = await resolveITGlueAccess(ctx.user.id, input.organizationId, "flexible_assets");
        if (!access.allowed) {
          return { data: [], hasMore: false, totalCount: 0 };
        }
      }

      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      return docs.getDocuments(
        {
          organizationId: input.organizationId,
          documentType: input.documentType,
          searchTerm: input.searchTerm,
          updatedAfter: input.updatedAfter,
        },
        input.page,
        input.pageSize
      );
    }),

  getDocumentById: requirePerm("documentation.view")
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      return docs.getDocumentById(input.id);
    }),

  createDocument: requirePerm("documentation.edit")
    .input(
      z.object({
        organizationId: z.string(),
        title: z.string().min(1).max(500),
        content: z.string().min(1),
        typeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      const doc = await docs.createDocument(input);

      await auditLog({
        action: "kb.document.created",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `document:${doc.sourceId}`,
        detail: {
          title: input.title,
          organizationId: input.organizationId,
        },
      });

      return doc;
    }),

  updateDocument: requirePerm("documentation.edit")
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      const doc = await docs.updateDocument(input.id, {
        title: input.title,
        content: input.content,
      });

      await auditLog({
        action: "kb.document.updated",
        category: "DATA",
        actorId: ctx.user.id,
        resource: `document:${input.id}`,
        detail: {
          fields: Object.keys(input).filter((k) => k !== "id"),
        },
      });

      return doc;
    }),

  // ─── Passwords / Credentials ─────────────────────────────

  getPasswords: requirePerm("documentation.passwords.view")
    .input(
      z.object({
        organizationId: z.string(),
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      // Check IT Glue permissions for this org + passwords section
      const access = await resolveITGlueAccess(ctx.user.id, input.organizationId, "passwords");
      if (!access.allowed) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({ code: "FORBIDDEN", message: "No access to passwords in this organization" });
      }

      const docs = await ConnectorFactory.get("documentation", ctx.prisma);

      await auditLog({
        action: "credential.list.accessed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `organization:${input.organizationId}`,
        detail: { searchTerm: input.searchTerm, accessMode: access.mode },
      });

      return docs.getPasswords(
        input.organizationId,
        input.searchTerm,
        input.page,
        input.pageSize
      );
    }),

  getPasswordById: requirePerm("documentation.passwords.reveal")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Using mutation instead of query to enforce it's a deliberate action
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);

      // TODO: Phase 4 — Check MFA session validity (2-hour window)
      // TODO: Phase 4 — Check per-user rate limit for password retrievals

      // Check IT Glue per-asset permissions via cached metadata
      const cachedAsset = await ctx.prisma.iTGlueCachedAsset.findUnique({
        where: { itGlueId: input.id },
      });
      if (cachedAsset) {
        const access = await resolveITGlueAccess(
          ctx.user.id,
          cachedAsset.orgId,
          "passwords",
          cachedAsset.categoryId ?? undefined,
          cachedAsset.itGlueId
        );
        if (!access.allowed) {
          const { TRPCError } = await import("@trpc/server");
          throw new TRPCError({ code: "FORBIDDEN", message: "No access to this password" });
        }
      }

      await auditLog({
        action: "credential.requested",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `password:${input.id}`,
      });

      const credential = await docs.getPasswordById(input.id);

      await auditLog({
        action: "credential.revealed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `password:${input.id}`,
        detail: {
          name: credential.name,
          organizationName: credential.organizationName,
          hasTotp: !!credential.otpSecret,
        },
      });

      return credential;
    }),

  // ─── Configurations ──────────────────────────────────────

  getConfigurations: requirePerm("documentation.view")
    .input(
      z.object({
        organizationId: z.string().optional(),
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.organizationId) {
        const access = await resolveITGlueAccess(ctx.user.id, input.organizationId, "configurations");
        if (!access.allowed) {
          return { data: [], hasMore: false, totalCount: 0 };
        }
      }

      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      return docs.getConfigurations(
        input.organizationId,
        input.searchTerm,
        input.page,
        input.pageSize
      );
    }),

  // ─── Contacts ────────────────────────────────────────────

  getContacts: requirePerm("documentation.view")
    .input(
      z.object({
        organizationId: z.string().optional(),
        searchTerm: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.organizationId) {
        const access = await resolveITGlueAccess(ctx.user.id, input.organizationId, "contacts");
        if (!access.allowed) {
          return { data: [], hasMore: false, totalCount: 0 };
        }
      }

      const docs = await ConnectorFactory.get("documentation", ctx.prisma);
      return docs.getContacts(
        input.organizationId,
        input.searchTerm,
        input.page,
        input.pageSize
      );
    }),

  // ─── Flexible Asset Types ────────────────────────────────

  getFlexibleAssetTypes: requirePerm("documentation.view").query(async ({ ctx }) => {
    const docs = await ConnectorFactory.get("documentation", ctx.prisma);
    return docs.getFlexibleAssetTypes();
  }),

  // ─── Search (Cached Data + Permission Filtered) ─────────

  search: requirePerm("documentation.view")
    .input(
      z.object({
        query: z.string().min(1).max(200),
        orgId: z.string().optional(),
        section: z.enum(["passwords", "flexible_assets", "configurations", "contacts", "documents"]).optional(),
        assetTypeId: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      // Query cached IT Glue assets with case-insensitive name match
      const assets = await ctx.prisma.iTGlueCachedAsset.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
          ...(input.orgId && { orgId: input.orgId }),
          ...(input.section && { section: input.section }),
          ...(input.assetTypeId && { categoryId: input.assetTypeId }),
        },
        orderBy: { name: "asc" },
        take: input.pageSize * 4, // Over-fetch to account for permission filtering
      });

      if (assets.length === 0) {
        return { data: [], total: 0, totalBeforeFilter: 0, hasMore: false };
      }

      // Batch resolve IT Glue permissions
      const accessMap = await batchResolveITGlueAccess(
        ctx.user.id,
        assets.map((a) => ({
          orgId: a.orgId,
          section: a.section,
          categoryId: a.categoryId ?? undefined,
          assetId: a.itGlueId,
        }))
      );

      // Filter by access and apply pagination
      const allowed = assets
        .filter((a) => {
          const access = accessMap.get(a.itGlueId);
          return access?.allowed;
        })
        .map((a) => ({
          itGlueId: a.itGlueId,
          name: a.name,
          orgId: a.orgId,
          section: a.section,
          categoryId: a.categoryId,
          categoryName: a.categoryName,
          accessMode: accessMap.get(a.itGlueId)!.mode,
        }));

      const start = (input.page - 1) * input.pageSize;
      const paged = allowed.slice(start, start + input.pageSize);

      // Enrich with org names
      const orgIds = [...new Set(paged.map((a) => a.orgId))];
      const orgs = await ctx.prisma.iTGlueCachedOrg.findMany({
        where: { itGlueId: { in: orgIds } },
        select: { itGlueId: true, name: true },
      });
      const orgNameMap = new Map(orgs.map((o) => [o.itGlueId, o.name]));

      const enriched = paged.map((a) => ({
        ...a,
        orgName: orgNameMap.get(a.orgId) ?? a.orgId,
      }));

      await auditLog({
        action: "itglue.search",
        category: "DATA",
        actorId: ctx.user.id,
        detail: {
          query: input.query,
          resultCount: enriched.length,
          totalBeforeFilter: assets.length,
          orgId: input.orgId,
          section: input.section,
        },
      });

      return {
        data: enriched,
        total: allowed.length,
        totalBeforeFilter: assets.length,
        hasMore: start + input.pageSize < allowed.length,
      };
    }),
});
