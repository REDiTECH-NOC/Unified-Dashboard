import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, adminProcedure, protectedProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { ConnectorFactory } from "../connectors/factory";
import { CONNECTOR_REGISTRY } from "../connectors/registry";
import { ConnectorNotConfiguredError } from "../connectors/_base/errors";

const TOOL_REGISTRY = [
  { toolId: "entra-id", displayName: "Microsoft Entra ID (SSO)", category: "identity" },
  { toolId: "ninjaone", displayName: "NinjaOne (RMM)", category: "rmm" },
  { toolId: "connectwise", displayName: "ConnectWise PSA", category: "psa" },
  { toolId: "sentinelone", displayName: "SentinelOne", category: "edr" },
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
  { toolId: "n8n", displayName: "n8n Automation", category: "automation" },
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
        hasConfig: !!config?.config,
        id: config?.id || null,
      };
    });
  }),

  getConfig: adminProcedure
    .input(z.object({ toolId: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId: input.toolId },
      });
      if (!config?.config) return null;

      const raw = config.config as Record<string, unknown>;
      return {
        config: raw,
        status: config.status,
      };
    }),

  updateConfig: adminProcedure
    .input(z.object({
      toolId: z.string(),
      config: z.record(z.unknown()).optional(),
      credentialRef: z.string().optional(),
      secretFields: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tool = TOOL_REGISTRY.find((t) => t.toolId === input.toolId);
      if (!tool) throw new Error("Unknown tool");

      let configToSave = { ...(input.config ?? {}) };

      // Preserve existing values for blank secret fields
      if (input.secretFields?.length) {
        const existing = await ctx.prisma.integrationConfig.findUnique({
          where: { toolId: input.toolId },
        });
        const existingConfig = (existing?.config as Record<string, unknown>) ?? {};
        for (const secretKey of input.secretFields) {
          if (!configToSave[secretKey]) {
            configToSave[secretKey] = existingConfig[secretKey];
          }
        }
      }

      const result = await ctx.prisma.integrationConfig.upsert({
        where: { toolId: input.toolId },
        update: {
          config: (configToSave as Prisma.InputJsonValue) ?? undefined,
          credentialRef: input.credentialRef || null,
          status: "connected",
          updatedBy: ctx.user.id,
        },
        create: {
          toolId: input.toolId,
          displayName: tool.displayName,
          category: tool.category,
          config: (configToSave as Prisma.InputJsonValue) ?? undefined,
          credentialRef: input.credentialRef || null,
          status: "connected",
          updatedBy: ctx.user.id,
        },
      });
      // Invalidate cached connector instance so next use picks up new credentials
      ConnectorFactory.invalidate(input.toolId);

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
      let success = false;
      let message = "No connector available for this tool";
      let latencyMs: number | undefined;

      // Try real health check if a connector is registered for this tool
      if (CONNECTOR_REGISTRY[input.toolId]) {
        try {
          const connector = await ConnectorFactory.getByToolId(input.toolId, ctx.prisma);
          const result = await (connector as { healthCheck: () => Promise<{ ok: boolean; latencyMs: number; message?: string }> }).healthCheck();
          success = result.ok;
          message = result.message ?? (result.ok ? "Connection successful" : "Connection failed");
          latencyMs = result.latencyMs;

          // Update status in DB based on health check result
          await ctx.prisma.integrationConfig.update({
            where: { toolId: input.toolId },
            data: {
              lastHealthCheck: new Date(),
              status: result.ok ? "connected" : "error",
            },
          });
        } catch (error) {
          if (error instanceof ConnectorNotConfiguredError) {
            message = "Integration not configured. Enter credentials first.";
          } else {
            message = error instanceof Error ? error.message : "Connection test failed";
          }
        }
      } else if (input.toolId === "n8n") {
        // Simple URL reachability check for n8n
        const config = await ctx.prisma.integrationConfig.findUnique({
          where: { toolId: "n8n" },
        });
        const instanceUrl = (config?.config as Record<string, string>)?.instanceUrl;
        if (!instanceUrl) {
          message = "No instance URL configured. Enter the URL first.";
        } else {
          try {
            const start = Date.now();
            const res = await fetch(`${instanceUrl.replace(/\/$/, "")}/healthz`, {
              method: "GET",
              signal: AbortSignal.timeout(10000),
            });
            latencyMs = Date.now() - start;
            success = res.ok;
            message = res.ok
              ? `n8n is reachable (${res.status})`
              : `n8n returned HTTP ${res.status}`;

            await ctx.prisma.integrationConfig.update({
              where: { toolId: "n8n" },
              data: {
                lastHealthCheck: new Date(),
                status: success ? "connected" : "error",
              },
            });
          } catch (error) {
            message = error instanceof Error ? `Cannot reach n8n: ${error.message}` : "Connection failed";
          }
        }
      }

      await auditLog({
        action: "integration.credential.tested",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "integration:" + input.toolId,
        detail: { toolId: input.toolId, success, latencyMs },
      });

      return { success, message, latencyMs };
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
