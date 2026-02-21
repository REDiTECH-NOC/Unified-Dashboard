import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";

const TOOL_REGISTRY = [
  { toolId: "entra-id", displayName: "Microsoft Entra ID (SSO)", category: "identity" },
  { toolId: "ninjaone", displayName: "NinjaOne (RMM)", category: "rmm" },
  { toolId: "connectwise", displayName: "ConnectWise PSA", category: "psa" },
  { toolId: "sentinelone", displayName: "SentinelOne", category: "security" },
  { toolId: "blackpoint", displayName: "Blackpoint Compass One", category: "security" },
  { toolId: "avanan", displayName: "Avanan", category: "security" },
  { toolId: "dnsfilter", displayName: "DNS Filter", category: "security" },
  { toolId: "huntress", displayName: "Huntress SAT", category: "security" },
  { toolId: "duo", displayName: "Duo MFA", category: "identity" },
  { toolId: "autoelevate", displayName: "AutoElevate", category: "identity" },
  { toolId: "quickpass", displayName: "Quickpass", category: "identity" },
  { toolId: "cipp", displayName: "CIPP (365 Management)", category: "identity" },
  { toolId: "itglue", displayName: "IT Glue", category: "documentation" },
  { toolId: "sharepoint", displayName: "SharePoint & OneNote", category: "documentation" },
  { toolId: "keeper", displayName: "Keeper", category: "documentation" },
  { toolId: "cove", displayName: "Cove Backups", category: "backup" },
  { toolId: "dropsuite", displayName: "Dropsuite", category: "backup" },
  { toolId: "unifi", displayName: "Unifi", category: "network" },
  { toolId: "watchguard", displayName: "WatchGuard", category: "network" },
  { toolId: "threecx", displayName: "3CX", category: "phone" },
  { toolId: "pax8", displayName: "PAX8", category: "licensing" },
];

export const integrationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const configs = await ctx.prisma.integrationConfig.findMany({
      orderBy: { category: "asc" },
    });
    return TOOL_REGISTRY.map((tool) => {
      const config = configs.find((c) => c.toolId === tool.toolId);
      return {
        ...tool,
        status: config?.status || "unconfigured",
        lastHealthCheck: config?.lastHealthCheck || null,
        lastSync: config?.lastSync || null,
        config: config?.config || null,
        id: config?.id || null,
      };
    });
  }),

  updateConfig: adminProcedure
    .input(z.object({
      toolId: z.string(),
      config: z.record(z.unknown()).optional(),
      credentialRef: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tool = TOOL_REGISTRY.find((t) => t.toolId === input.toolId);
      if (!tool) throw new Error("Unknown tool");
      const result = await ctx.prisma.integrationConfig.upsert({
        where: { toolId: input.toolId },
        update: {
          config: input.config || null,
          credentialRef: input.credentialRef || null,
          status: "connected",
          updatedBy: ctx.user.id,
        },
        create: {
          toolId: input.toolId,
          displayName: tool.displayName,
          category: tool.category,
          config: input.config || null,
          credentialRef: input.credentialRef || null,
          status: "connected",
          updatedBy: ctx.user.id,
        },
      });
      await auditLog({
        action: "integration.credential.updated",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "integration:" + input.toolId,
        detail: { toolId: input.toolId },
      });
      return result;
    }),

  testConnection: adminProcedure
    .input(z.object({ toolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await auditLog({
        action: "integration.credential.tested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "integration:" + input.toolId,
        detail: { toolId: input.toolId },
      });
      return { success: true, message: "Connection test placeholder" };
    }),

  // Get SSO configuration (masked secrets)
  getSsoConfig: adminProcedure.query(async ({ ctx }) => {
    const config = await ctx.prisma.integrationConfig.findUnique({
      where: { toolId: "entra-id" },
    });
    const c = (config?.config as Record<string, string>) || {};
    return {
      status: config?.status || "unconfigured",
      clientId: c.clientId || process.env.AZURE_AD_CLIENT_ID || "",
      tenantId: c.tenantId || process.env.AZURE_AD_TENANT_ID || "",
      adminGroupId: c.adminGroupId || process.env.ENTRA_GROUP_ADMINS || "",
      userGroupId: c.userGroupId || process.env.ENTRA_GROUP_USERS || "",
      // Never expose the full secret — mask it
      hasSecret: !!(c.clientSecret || process.env.AZURE_AD_CLIENT_SECRET),
      source: config?.config ? "database" : (process.env.AZURE_AD_CLIENT_ID ? "environment" : "none"),
    };
  }),

  // Save SSO configuration
  saveSsoConfig: adminProcedure
    .input(z.object({
      clientId: z.string().min(1),
      clientSecret: z.string(), // can be empty to keep existing
      tenantId: z.string().min(1),
      adminGroupId: z.string().min(1),
      userGroupId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // If secret is blank, preserve the existing one from DB
      let clientSecret = input.clientSecret;
      if (!clientSecret) {
        const existing = await ctx.prisma.integrationConfig.findUnique({
          where: { toolId: "entra-id" },
        });
        const c = (existing?.config as Record<string, string>) || {};
        clientSecret = c.clientSecret || "";
        if (!clientSecret) throw new Error("Client secret is required");
      }

      const configData = {
        clientId: input.clientId,
        clientSecret,
        tenantId: input.tenantId,
        adminGroupId: input.adminGroupId,
        userGroupId: input.userGroupId,
      };

      const result = await ctx.prisma.integrationConfig.upsert({
        where: { toolId: "entra-id" },
        update: {
          config: configData,
          status: "connected",
          updatedBy: ctx.user.id,
        },
        create: {
          toolId: "entra-id",
          displayName: "Microsoft Entra ID (SSO)",
          category: "identity",
          config: configData,
          status: "connected",
          updatedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "integration.sso.configured",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "integration:entra-id",
        detail: { tenantId: input.tenantId },
      });

      return result;
    }),
});
