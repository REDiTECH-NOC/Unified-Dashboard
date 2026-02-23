import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "../trpc";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auditLog } from "@/lib/audit";
import {
  isAzureEnvironment,
  getAzureToken,
  getPostgresServerUrl,
  getSubscriptionBaseUrl,
  getResourceGroupBaseUrl,
  azureGet,
  azurePut,
  azurePost,
  azureDelete,
  storeKeyVaultSecret,
  getKeyVaultSecret,
} from "@/lib/azure";
import crypto from "crypto";

// ─── Azure API Versions ─────────────────────────────────────────────

const PG_API = "api-version=2022-12-01";
const HEALTH_API = "api-version=2023-07-01-preview";
const COST_API = "api-version=2023-11-01";
const ACTIVITY_API = "api-version=2015-04-01";
const ALERTS_API = "api-version=2023-01-01";

// ─── Types ──────────────────────────────────────────────────────────

interface AzureDatabase {
  name: string;
  id: string;
  properties: { charset: string; collation: string };
}

interface AzureFirewallRule {
  name: string;
  id: string;
  properties: { startIpAddress: string; endIpAddress: string };
}

interface AzureResourceHealth {
  id: string;
  name: string;
  properties: {
    availabilityState: string;
    summary: string;
    reasonType: string;
    occuredTime?: string;
  };
}

interface AzureCostRow {
  // Columns: Cost, CostUSD, Currency, ServiceName
  [index: number]: string | number;
}

interface AzureActivityEvent {
  eventTimestamp: string;
  caller: string;
  operationName: { localizedValue: string; value: string };
  resourceGroupName: string;
  resourceType: { localizedValue: string; value: string };
  status: { localizedValue: string; value: string };
  subStatus?: { localizedValue: string };
  resourceId: string;
  level: string;
}

interface AzureAlert {
  id: string;
  name: string;
  properties: {
    essentials: {
      severity: string;
      alertState: string;
      monitorCondition: string;
      targetResource: string;
      targetResourceName: string;
      targetResourceType: string;
      startDateTime: string;
      lastModifiedDateTime: string;
      description?: string;
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Generate a cryptographically secure password */
function generatePassword(length = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_+-=";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/** Get the stored infrastructure config from IntegrationConfig */
async function getInfraConfig(): Promise<{
  pgServerName: string | null;
  pgAdminPassword: string | null;
  keyVaultName: string | null;
}> {
  const [pgConfig, kvConfig] = await Promise.all([
    prisma.integrationConfig.findUnique({
      where: { toolId: "azure-postgres" },
      select: { config: true },
    }),
    prisma.integrationConfig.findUnique({
      where: { toolId: "azure-keyvault" },
      select: { config: true },
    }),
  ]);

  const pg = pgConfig?.config as Record<string, unknown> | null;
  const kv = kvConfig?.config as Record<string, unknown> | null;

  return {
    pgServerName: (pg?.serverName as string) || null,
    pgAdminPassword: (pg?.adminPassword as string) || null,
    keyVaultName: (kv?.vaultName as string) || null,
  };
}

/** Get a pg Pool connected as admin to the Azure PostgreSQL server */
async function getAdminPool(serverName: string, adminPassword: string, database = "postgres") {
  const { Pool } = await import("pg");
  const host = `${serverName}.postgres.database.azure.com`;
  return new Pool({
    host,
    port: 5432,
    user: "rccadmin",
    password: adminPassword,
    database,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
  });
}

// ─── Router ─────────────────────────────────────────────────────────

export const infrastructureRouter = router({
  // ═══ AVAILABILITY & CONFIG ════════════════════════════════════════

  /** Check if Azure infrastructure management is available */
  isAvailable: adminProcedure.query(() => {
    return { available: isAzureEnvironment() };
  }),

  /** Get current infrastructure configuration */
  getConfig: adminProcedure.query(async () => {
    const config = await getInfraConfig();
    return {
      pgServerName: config.pgServerName,
      pgAdminPassword: config.pgAdminPassword ? "••••••••" : null,
      keyVaultName: config.keyVaultName,
      isAzure: isAzureEnvironment(),
    };
  }),

  /** Save infrastructure configuration */
  saveConfig: adminProcedure
    .input(
      z.object({
        pgServerName: z.string().min(1).max(100).optional(),
        pgAdminPassword: z.string().min(1).max(200).optional(),
        keyVaultName: z.string().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Save PostgreSQL config
      if (input.pgServerName !== undefined || input.pgAdminPassword !== undefined) {
        const existing = await prisma.integrationConfig.findUnique({
          where: { toolId: "azure-postgres" },
          select: { config: true },
        });
        const current = (existing?.config as Record<string, unknown>) || {};

        const newConfig: Record<string, unknown> = { ...current };
        if (input.pgServerName !== undefined) newConfig.serverName = input.pgServerName;
        if (input.pgAdminPassword !== undefined) newConfig.adminPassword = input.pgAdminPassword;

        await prisma.integrationConfig.upsert({
          where: { toolId: "azure-postgres" },
          create: { toolId: "azure-postgres", displayName: "Azure PostgreSQL", category: "infrastructure", config: newConfig as Prisma.InputJsonValue },
          update: { config: newConfig as Prisma.InputJsonValue },
        });
      }

      // Save Key Vault config
      if (input.keyVaultName !== undefined) {
        await prisma.integrationConfig.upsert({
          where: { toolId: "azure-keyvault" },
          create: { toolId: "azure-keyvault", displayName: "Azure Key Vault", category: "infrastructure", config: { vaultName: input.keyVaultName } as Prisma.InputJsonValue },
          update: { config: { vaultName: input.keyVaultName } as Prisma.InputJsonValue },
        });
      }

      await auditLog({
        action: "infrastructure.config.updated",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: "infrastructure:config",
        detail: {
          pgServerName: input.pgServerName ?? "(unchanged)",
          pgAdminPassword: input.pgAdminPassword ? "(updated)" : "(unchanged)",
          keyVaultName: input.keyVaultName ?? "(unchanged)",
        },
      });

      return { success: true };
    }),

  /** Test infrastructure connections */
  testConnection: adminProcedure.mutation(async ({ ctx }) => {
    const config = await getInfraConfig();
    const results: { pg: string; keyVault: string } = {
      pg: "not_configured",
      keyVault: "not_configured",
    };

    // Test PostgreSQL admin connection
    if (config.pgServerName && config.pgAdminPassword) {
      try {
        const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword);
        try {
          await pool.query("SELECT 1");
          results.pg = "connected";
        } finally {
          await pool.end();
        }
      } catch (error) {
        results.pg = `error: ${error instanceof Error ? error.message : "Connection failed"}`;
      }
    }

    // Test Key Vault access
    if (config.keyVaultName && isAzureEnvironment()) {
      try {
        // Just try to list secrets (even if empty, the auth works)
        const token = await getAzureToken("https://vault.azure.net");
        const res = await fetch(
          `https://${config.keyVaultName}.vault.azure.net/secrets?api-version=7.4&maxresults=1`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        results.keyVault = res.ok ? "connected" : `error: HTTP ${res.status}`;
      } catch (error) {
        results.keyVault = `error: ${error instanceof Error ? error.message : "Connection failed"}`;
      }
    } else if (config.keyVaultName && !isAzureEnvironment()) {
      results.keyVault = "requires_azure";
    }

    await auditLog({
      action: "infrastructure.config.test",
      category: "SYSTEM",
      actorId: ctx.user.id,
      resource: "infrastructure:config",
      detail: results,
    });

    return results;
  }),

  // ═══ OVERVIEW: RESOURCE HEALTH + COSTS + ALERTS SUMMARY ═══════════

  /** Get health status of all Azure resources in the resource group */
  getResourceHealth: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { resources: [], source: "unavailable" as const };
    }

    try {
      const rgUrl = getResourceGroupBaseUrl();
      const data = await azureGet<{ value: AzureResourceHealth[] }>(
        `${rgUrl}/providers/Microsoft.ResourceHealth/availabilityStatuses?${HEALTH_API}`
      );

      return {
        resources: data.value.map((r) => {
          // Extract resource name and type from the ID
          const parts = r.id.split("/");
          const providersIdx = parts.indexOf("providers");
          const resourceType =
            providersIdx >= 0 && parts.length > providersIdx + 2
              ? `${parts[providersIdx + 1]}/${parts[providersIdx + 2]}`
              : "Unknown";
          // The resource name is typically the second-to-last before /providers/Microsoft.ResourceHealth
          const healthIdx = parts.indexOf("Microsoft.ResourceHealth");
          const resourceName = healthIdx >= 2 ? parts[healthIdx - 1] : r.name;

          return {
            name: resourceName,
            type: resourceType,
            status: r.properties.availabilityState,
            summary: r.properties.summary,
            reason: r.properties.reasonType,
            lastChecked: r.properties.occuredTime || null,
          };
        }),
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch resource health: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  /** Get month-to-date cost summary grouped by service */
  getCostSummary: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { costs: [], total: 0, currency: "USD", source: "unavailable" as const };
    }

    try {
      const subUrl = getSubscriptionBaseUrl();
      const data = await azurePost<{
        properties: {
          rows: AzureCostRow[];
          columns: Array<{ name: string; type: string }>;
        };
      }>(`${subUrl}/providers/Microsoft.CostManagement/query?${COST_API}`, {
        type: "Usage",
        timeframe: "MonthToDate",
        dataset: {
          granularity: "None",
          aggregation: {
            totalCost: { name: "Cost", function: "Sum" },
            totalCostUSD: { name: "CostUSD", function: "Sum" },
          },
          grouping: [{ type: "Dimension", name: "ServiceName" }],
        },
      });

      const rows = data.properties?.rows ?? [];
      let total = 0;
      const costs = rows.map((row) => {
        const cost = Number(row[0]) || 0;
        total += cost;
        return {
          service: String(row[2] || "Unknown"),
          cost: Math.round(cost * 100) / 100,
          costUSD: Math.round((Number(row[1]) || 0) * 100) / 100,
          currency: String(row[3] || "USD"),
        };
      });

      // Sort by cost descending
      costs.sort((a, b) => b.cost - a.cost);

      return {
        costs,
        total: Math.round(total * 100) / 100,
        currency: costs[0]?.currency || "USD",
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch cost data: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  /** Get summary count of active Azure Monitor alerts by severity */
  getAlertsSummary: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { counts: {}, total: 0, source: "unavailable" as const };
    }

    try {
      const subUrl = getSubscriptionBaseUrl();
      const data = await azureGet<{ value: AzureAlert[] }>(
        `${subUrl}/providers/Microsoft.AlertsManagement/alerts?${ALERTS_API}&alertState=New&alertState=Acknowledged`
      );

      const alerts = data.value || [];
      const counts: Record<string, number> = {};
      for (const alert of alerts) {
        const severity = alert.properties.essentials.severity || "Unknown";
        counts[severity] = (counts[severity] || 0) + 1;
      }

      return {
        counts,
        total: alerts.length,
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch alerts summary: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  // ═══ DATABASE PROCEDURES ════════════════════════════════════════════

  /** List all databases on the Azure PostgreSQL Flexible Server */
  listDatabases: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { databases: [], source: "unavailable" as const, message: "Requires Azure deployment" };
    }

    const config = await getInfraConfig();
    if (!config.pgServerName) {
      return { databases: [], source: "not_configured" as const, message: "PostgreSQL server not configured" };
    }

    try {
      const serverUrl = getPostgresServerUrl(config.pgServerName);
      const data = await azureGet<{ value: AzureDatabase[] }>(
        `${serverUrl}/databases?${PG_API}`
      );

      const systemDbs = ["azure_maintenance", "azure_sys", "postgres"];
      return {
        databases: data.value
          .filter((db) => !systemDbs.includes(db.name))
          .map((db) => ({
            name: db.name,
            charset: db.properties.charset,
            collation: db.properties.collation,
          })),
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to list databases: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  /** Get connection details for a specific database */
  getConnectionDetails: adminProcedure
    .input(z.object({ databaseName: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const config = await getInfraConfig();
      if (!config.pgServerName) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL server not configured" });
      }

      const host = `${config.pgServerName}.postgres.database.azure.com`;
      const port = 5432;
      // Derive username from database name (e.g., "reditech3cx_database" → "reditech_tcx")
      // Convention: {clientname}3cx_database → {clientname}_tcx
      const clientName = input.databaseName.replace("3cx_database", "").replace(/_$/, "");
      const username = `${clientName}_tcx`;

      // Try to retrieve password from Key Vault
      let password: string | null = null;
      if (config.keyVaultName && isAzureEnvironment()) {
        try {
          const secretName = `pg-${input.databaseName.replace(/_/g, "-")}`;
          password = await getKeyVaultSecret(config.keyVaultName, secretName);
        } catch {
          // Key Vault unavailable — password will be null
        }
      }

      await auditLog({
        action: "infrastructure.database.details_viewed",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `database:${input.databaseName}`,
        detail: { databaseName: input.databaseName },
      });

      return { host, port, databaseName: input.databaseName, username, password, sslMode: "require" };
    }),

  /** Create a new database with user and grants */
  createDatabase: adminProcedure
    .input(
      z.object({
        clientName: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z0-9]+$/, "Only lowercase letters and numbers allowed"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "PostgreSQL server name and admin password must be configured first.",
        });
      }
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const dbName = `${input.clientName}3cx_database`;
      const username = `${input.clientName}_tcx`;
      const password = generatePassword(32);

      await auditLog({
        action: "infrastructure.database.create_started",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `database:${dbName}`,
        detail: { clientName: input.clientName, dbName, username },
      });

      try {
        // Step 1: Create database via Azure Management API
        const serverUrl = getPostgresServerUrl(config.pgServerName);
        await azurePut(`${serverUrl}/databases/${dbName}?${PG_API}`, {
          properties: { charset: "UTF8", collation: "en_US.utf8" },
        });

        // Step 2: Create PG user + grants via direct SQL
        const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword);
        try {
          // Escape password for SQL (replace single quotes)
          const escapedPassword = password.replace(/'/g, "''");
          await pool.query(
            `CREATE ROLE "${username}" WITH LOGIN PASSWORD '${escapedPassword}'`
          );
          await pool.query(`GRANT CONNECT ON DATABASE "${dbName}" TO "${username}"`);
        } finally {
          await pool.end();
        }

        // Step 3: Grant schema-level privileges (connect to the new database)
        const dbPool = await getAdminPool(config.pgServerName, config.pgAdminPassword, dbName);
        try {
          await dbPool.query(`GRANT USAGE ON SCHEMA public TO "${username}"`);
          await dbPool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${username}"`);
          await dbPool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${username}"`);
          await dbPool.query(
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${username}"`
          );
          await dbPool.query(
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${username}"`
          );
          await dbPool.query(`GRANT CREATE ON SCHEMA public TO "${username}"`);
        } finally {
          await dbPool.end();
        }

        // Step 4: Store password in Key Vault
        if (config.keyVaultName) {
          try {
            const secretName = `pg-${dbName.replace(/_/g, "-")}`;
            await storeKeyVaultSecret(config.keyVaultName, secretName, password);
          } catch (error) {
            console.error("[INFRA] Failed to store password in Key Vault:", error);
            // Non-fatal — password is returned to the admin
          }
        }

        const host = `${config.pgServerName}.postgres.database.azure.com`;

        await auditLog({
          action: "infrastructure.database.created",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${dbName}`,
          detail: { clientName: input.clientName, dbName, username },
          outcome: "success",
        });

        return {
          success: true,
          databaseName: dbName,
          username,
          password, // shown once to the admin
          host,
          port: 5432,
          sslMode: "require",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Database creation failed";

        await auditLog({
          action: "infrastructure.database.create_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${dbName}`,
          detail: { clientName: input.clientName, error: message },
          outcome: "failure",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create database: ${message}`,
        });
      }
    }),

  // ═══ FIREWALL RULE PROCEDURES ═══════════════════════════════════════

  /** List all firewall rules on the Azure PostgreSQL Flexible Server */
  listFirewallRules: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { rules: [], source: "unavailable" as const, message: "Requires Azure deployment" };
    }

    const config = await getInfraConfig();
    if (!config.pgServerName) {
      return { rules: [], source: "not_configured" as const, message: "PostgreSQL server not configured" };
    }

    try {
      const serverUrl = getPostgresServerUrl(config.pgServerName);
      const data = await azureGet<{ value: AzureFirewallRule[] }>(
        `${serverUrl}/firewallRules?${PG_API}`
      );

      return {
        rules: data.value.map((r) => ({
          name: r.name,
          startIpAddress: r.properties.startIpAddress,
          endIpAddress: r.properties.endIpAddress,
        })),
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to list firewall rules: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  /** Create a new firewall rule */
  createFirewallRule: adminProcedure
    .input(
      z.object({
        ruleName: z
          .string()
          .min(1)
          .max(128)
          .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
        startIpAddress: z.string().ip({ version: "v4" }),
        endIpAddress: z.string().ip({ version: "v4" }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      if (!config.pgServerName) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL server not configured." });
      }

      await auditLog({
        action: "infrastructure.firewall.created",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.ruleName}`,
        detail: { ruleName: input.ruleName, startIp: input.startIpAddress, endIp: input.endIpAddress },
      });

      try {
        const serverUrl = getPostgresServerUrl(config.pgServerName);
        await azurePut(`${serverUrl}/firewallRules/${input.ruleName}?${PG_API}`, {
          properties: {
            startIpAddress: input.startIpAddress,
            endIpAddress: input.endIpAddress,
          },
        });

        return { success: true, ruleName: input.ruleName };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create firewall rule";
        await auditLog({
          action: "infrastructure.firewall.create_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `firewall:${input.ruleName}`,
          detail: { error: message },
          outcome: "failure",
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /** Delete a firewall rule */
  deleteFirewallRule: adminProcedure
    .input(z.object({ ruleName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      if (!config.pgServerName) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL server not configured." });
      }

      await auditLog({
        action: "infrastructure.firewall.deleted",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.ruleName}`,
        detail: { ruleName: input.ruleName },
      });

      try {
        const serverUrl = getPostgresServerUrl(config.pgServerName);
        await azureDelete(`${serverUrl}/firewallRules/${input.ruleName}?${PG_API}`);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete firewall rule";
        await auditLog({
          action: "infrastructure.firewall.delete_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `firewall:${input.ruleName}`,
          detail: { error: message },
          outcome: "failure",
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  // ═══ ACTIVITY LOG & ALERTS ════════════════════════════════════════

  /** Get Azure Activity Log events */
  getActivityLog: adminProcedure
    .input(
      z.object({
        hours: z.number().min(1).max(168).default(24), // max 7 days
      }).optional()
    )
    .query(async ({ input }) => {
      if (!isAzureEnvironment()) {
        return { events: [], source: "unavailable" as const };
      }

      const hours = input?.hours ?? 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      try {
        const subUrl = getSubscriptionBaseUrl();
        const filter = encodeURIComponent(
          `eventTimestamp ge '${startTime}' and eventTimestamp le '${endTime}' and resourceGroupName eq '${process.env.AZURE_RESOURCE_GROUP}'`
        );
        const data = await azureGet<{ value: AzureActivityEvent[] }>(
          `${subUrl}/providers/Microsoft.Insights/eventtypes/management/values?${ACTIVITY_API}&$filter=${filter}&$top=100`
        );

        return {
          events: (data.value || []).map((e) => ({
            timestamp: e.eventTimestamp,
            caller: e.caller,
            operation: e.operationName.localizedValue || e.operationName.value,
            resourceType: e.resourceType?.localizedValue || e.resourceType?.value || "",
            status: e.status.localizedValue || e.status.value,
            level: e.level,
            resourceId: e.resourceId,
          })),
          source: "azure" as const,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch activity log: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /** Get Azure Monitor alerts */
  getAlerts: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { alerts: [], source: "unavailable" as const };
    }

    try {
      const subUrl = getSubscriptionBaseUrl();
      const data = await azureGet<{ value: AzureAlert[] }>(
        `${subUrl}/providers/Microsoft.AlertsManagement/alerts?${ALERTS_API}`
      );

      return {
        alerts: (data.value || []).map((a) => ({
          id: a.id,
          name: a.name,
          severity: a.properties.essentials.severity,
          state: a.properties.essentials.alertState,
          condition: a.properties.essentials.monitorCondition,
          targetResource: a.properties.essentials.targetResourceName,
          targetResourceType: a.properties.essentials.targetResourceType,
          description: a.properties.essentials.description || "",
          firedAt: a.properties.essentials.startDateTime,
          lastModified: a.properties.essentials.lastModifiedDateTime,
        })),
        source: "azure" as const,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch alerts: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),
});
