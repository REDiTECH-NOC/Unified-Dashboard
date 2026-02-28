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
      return docs.getOrganizations(
        input.searchTerm,
        input.page,
        input.pageSize
      );
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
      const docs = await ConnectorFactory.get("documentation", ctx.prisma);

      // Audit log password list access (security event)
      await auditLog({
        action: "credential.list.accessed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `organization:${input.organizationId}`,
        detail: { searchTerm: input.searchTerm },
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
});
