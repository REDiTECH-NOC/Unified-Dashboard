import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { router, adminProcedure, protectedProcedure, requirePerm } from "../trpc";
import { auditLog } from "@/lib/audit";
import {
  encrypt,
  isEncryptionConfigured,
  encryptConfigSecrets,
  INTEGRATION_SECRET_FIELDS,
  SECRET_MASK,
} from "@/lib/crypto";
import { ConnectorFactory } from "../connectors/factory";
import { CONNECTOR_REGISTRY } from "../connectors/registry";
import { ConnectorNotConfiguredError } from "../connectors/_base/errors";

const TOOL_REGISTRY = [
  { toolId: "entra-id", displayName: "Microsoft Entra ID (SSO)", category: "identity" },
  { toolId: "ninjaone", displayName: "NinjaOne (RMM)", category: "rmm" },
  { toolId: "connectwise", displayName: "ConnectWise PSA", category: "psa" },
  { toolId: "sentinelone", displayName: "SentinelOne", category: "edr" },
  { toolId: "blackpoint", displayName: "Blackpoint CompassOne", category: "mdr" },
  { toolId: "avanan", displayName: "Avanan", category: "security" },
  { toolId: "dnsfilter", displayName: "DNS Filter", category: "dns_security" },
  { toolId: "huntress", displayName: "Huntress SAT", category: "security" },
  { toolId: "duo", displayName: "Duo MFA", category: "identity" },
  { toolId: "autoelevate", displayName: "AutoElevate", category: "identity" },
  { toolId: "quickpass", displayName: "Quickpass", category: "identity" },
  { toolId: "cipp", displayName: "CIPP (365 Management)", category: "identity" },
  { toolId: "itglue", displayName: "IT Glue", category: "documentation" },
  { toolId: "sharepoint", displayName: "SharePoint & OneNote", category: "documentation" },
  { toolId: "keeper", displayName: "Keeper", category: "documentation" },
  { toolId: "cove", displayName: "Cove Backups", category: "backup" },
  { toolId: "dropsuite", displayName: "DropSuite (NinjaOne SaaS Backup)", category: "backup" },
  { toolId: "unifi", displayName: "Unifi", category: "network" },
  { toolId: "watchguard", displayName: "WatchGuard", category: "network" },
  { toolId: "threecx", displayName: "3CX", category: "phone" },
  { toolId: "pax8", displayName: "PAX8", category: "licensing" },
  { toolId: "n8n", displayName: "n8n Automation", category: "automation" },
  { toolId: "ai-provider", displayName: "AI Provider", category: "ai" },
];

export const integrationRouter = router({
  list: requirePerm("settings.integrations").query(async ({ ctx }) => {
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
    .input(z.object({
      toolId: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId: input.toolId },
      });
      if (!config?.config) return null;

      const raw = { ...(config.config as Record<string, unknown>) };

      // Mask secret fields server-side — authoritative list, NOT client-controlled
      for (const key of Object.keys(raw)) {
        if (INTEGRATION_SECRET_FIELDS.has(key) && raw[key]) {
          raw[key] = SECRET_MASK;
        }
      }

      await auditLog({
        action: "integration.config.viewed",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "integration:" + input.toolId,
        detail: { toolId: input.toolId },
      });

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
    }))
    .mutation(async ({ ctx, input }) => {
      const tool = TOOL_REGISTRY.find((t) => t.toolId === input.toolId);
      if (!tool) throw new Error("Unknown tool");

      let configToSave = { ...(input.config ?? {}) };

      // Load existing config to preserve encrypted secrets
      const existing = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId: input.toolId },
      });
      const existingConfig = (existing?.config as Record<string, unknown>) ?? {};

      // Process secret fields server-side: preserve existing or accept new values
      for (const key of Object.keys(configToSave)) {
        if (INTEGRATION_SECRET_FIELDS.has(key)) {
          const val = configToSave[key];
          if (!val || val === SECRET_MASK) {
            // Blank or masked — preserve existing (already encrypted) value
            configToSave[key] = existingConfig[key];
          }
        }
      }

      // Preserve encrypted secrets from DB that weren't in the update payload
      for (const key of Object.keys(existingConfig)) {
        if (INTEGRATION_SECRET_FIELDS.has(key) && !(key in configToSave)) {
          configToSave[key] = existingConfig[key];
        }
      }

      // Encrypt any new plaintext secret values
      configToSave = encryptConfigSecrets(configToSave) as Record<string, unknown>;

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

      // Return safe subset — never send config JSONB (contains encrypted secrets) to client
      return {
        id: result.id,
        toolId: result.toolId,
        status: result.status,
        updatedAt: result.updatedAt,
      };
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
          // SSRF protection: validate URL scheme and block internal/metadata endpoints
          let urlValid = true;
          try {
            const parsedUrl = new URL(instanceUrl);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
              message = "Only HTTP/HTTPS URLs are allowed.";
              urlValid = false;
            }
            const blockedHosts = ["169.254.169.254", "metadata.google.internal", "metadata.internal"];
            if (urlValid && blockedHosts.includes(parsedUrl.hostname)) {
              message = "URL points to a blocked endpoint.";
              urlValid = false;
            }
          } catch {
            message = "Invalid URL format.";
            urlValid = false;
          }

          if (urlValid) {
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
      // If secret is blank, preserve the existing one from DB (already encrypted)
      let clientSecret = input.clientSecret;
      if (!clientSecret) {
        const existing = await ctx.prisma.integrationConfig.findUnique({
          where: { toolId: "entra-id" },
        });
        const c = (existing?.config as Record<string, string>) || {};
        clientSecret = c.clientSecret || "";
        if (!clientSecret) throw new Error("Client secret is required");
      } else if (isEncryptionConfigured()) {
        // New plaintext secret — encrypt before storing
        clientSecret = encrypt(clientSecret);
      }

      const configData = {
        clientId: input.clientId,
        clientSecret,
        tenantId: input.tenantId,
        adminGroupId: input.adminGroupId,
        userGroupId: input.userGroupId,
      };

      await ctx.prisma.integrationConfig.upsert({
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

      // Return safe response — never send config JSONB to client
      return { success: true };
    }),

  // ─── Sync Config (per-tool sync preferences) ───────────

  getSyncConfig: adminProcedure
    .input(z.object({ toolId: z.string() }))
    .query(async ({ ctx, input }) => {
      const config = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId: input.toolId },
      });
      if (!config?.config) return null;
      const raw = config.config as Record<string, unknown>;
      return {
        syncEnabled: (raw.syncEnabled as boolean) ?? false,
        syncMode: (raw.syncMode as string) ?? "auto",
        syncStatuses: (raw.syncStatuses as string[]) ?? [],
        syncTypes: (raw.syncTypes as string[]) ?? [],
        autoSyncSchedule: (raw.autoSyncSchedule as string) ?? "on_demand",
        removalPolicy: (raw.removalPolicy as string) ?? "keep",
        removalDays: (raw.removalDays as number) ?? 30,
      };
    }),

  updateSyncConfig: adminProcedure
    .input(
      z.object({
        toolId: z.string(),
        syncEnabled: z.boolean(),
        syncMode: z.enum(["auto", "manual"]),
        syncStatuses: z.array(z.string()),
        syncTypes: z.array(z.string()),
        autoSyncSchedule: z.enum([
          "on_demand",
          "every12h",
          "daily",
        ]),
        removalPolicy: z.enum(["keep", "remove_after_days"]),
        removalDays: z.number().min(1).max(365).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.integrationConfig.findUnique({
        where: { toolId: input.toolId },
      });
      const existingConfig =
        (existing?.config as Record<string, unknown>) ?? {};

      const newConfig = {
        ...existingConfig,
        syncEnabled: input.syncEnabled,
        syncMode: input.syncMode,
        syncStatuses: input.syncStatuses,
        syncTypes: input.syncTypes,
        autoSyncSchedule: input.autoSyncSchedule,
        removalPolicy: input.removalPolicy,
        removalDays: input.removalDays,
      };

      await ctx.prisma.integrationConfig.update({
        where: { toolId: input.toolId },
        data: {
          config: newConfig as Prisma.InputJsonValue,
          updatedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "integration.syncconfig.updated",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `integration:${input.toolId}`,
        detail: {
          syncEnabled: input.syncEnabled,
          syncMode: input.syncMode,
          syncStatuses: input.syncStatuses,
          syncTypes: input.syncTypes,
          autoSyncSchedule: input.autoSyncSchedule,
          removalPolicy: input.removalPolicy,
          removalDays: input.removalDays,
        },
      });

      return { success: true };
    }),
});
