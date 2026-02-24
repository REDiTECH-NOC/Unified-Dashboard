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
  azurePatch,
  azurePost,
  azureDelete,
  storeKeyVaultSecret,
  getKeyVaultSecret,
} from "@/lib/azure";
import crypto from "crypto";

// ─── Azure API Versions ─────────────────────────────────────────────

const PG_API = "api-version=2022-12-01";
const REDIS_API = "api-version=2023-08-01";
const KV_API = "api-version=2023-07-01";
const CONTAINERAPP_API = "api-version=2024-03-01";
const HEALTH_API = "api-version=2023-07-01-preview";
const COST_API = "api-version=2023-11-01";
const ACTIVITY_API = "api-version=2015-04-01";
const ALERTS_API = "api-version=2023-01-01";

// ─── Resource Type Constants ────────────────────────────────────────

const FIREWALLABLE_RESOURCES = [
  { type: "postgresql", label: "PostgreSQL Flexible Server", icon: "Database" },
  { type: "redis", label: "Redis Cache", icon: "HardDrive" },
  { type: "keyvault", label: "Key Vault", icon: "Shield" },
  { type: "containerapp", label: "Container App", icon: "Cloud" },
] as const;

type FirewallResourceType = (typeof FIREWALLABLE_RESOURCES)[number]["type"];

const FIREWALL_RESOURCE_TYPES = z.enum(["postgresql", "redis", "keyvault", "containerapp"]);

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
          const parts = r.id.split("/");
          const providersIdx = parts.indexOf("providers");
          const resourceType =
            providersIdx >= 0 && parts.length > providersIdx + 2
              ? `${parts[providersIdx + 1]}/${parts[providersIdx + 2]}`
              : "Unknown";
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
    } catch {
      // Provider may not be registered yet — return empty gracefully
      return { resources: [], source: "azure" as const, message: "Resource Health provider may not be registered yet" };
    }
  }),

  /** Get month-to-date cost summary grouped by service (scoped to resource group) */
  getCostSummary: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { costs: [], total: 0, currency: "USD", source: "unavailable" as const };
    }

    try {
      // Scope to resource group instead of entire subscription
      const rgUrl = getResourceGroupBaseUrl();
      const data = await azurePost<{
        properties: {
          rows: AzureCostRow[];
          columns: Array<{ name: string; type: string }>;
        };
      }>(`${rgUrl}/providers/Microsoft.CostManagement/query?${COST_API}`, {
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

      costs.sort((a, b) => b.cost - a.cost);

      return {
        costs,
        total: Math.round(total * 100) / 100,
        currency: costs[0]?.currency || "USD",
        source: "azure" as const,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      const isUnsupportedOffer = msg.includes("422") || msg.includes("offer type");
      return {
        costs: [],
        total: 0,
        currency: "USD",
        source: "azure" as const,
        message: isUnsupportedOffer
          ? "Cost Management is not supported for this subscription type (Sponsorship/MSDN). Costs are visible in the Azure Portal."
          : "Cost data unavailable",
        unsupported: isUnsupportedOffer,
      };
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
    } catch {
      // Alerts provider may not be configured or permissions missing
      return { counts: {}, total: 0, source: "azure" as const, message: "Alert data unavailable" };
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
    .input(z.object({ databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name") }))
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
          // Use format() for safe identifier quoting + parameterized password
          await pool.query(
            `CREATE ROLE "${username}" WITH LOGIN PASSWORD $1`,
            [password]
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

  // ═══ FIREWALL RULE PROCEDURES (Multi-Resource) ═════════════════════

  /** List available resources that support firewall rules */
  listFirewallResources: adminProcedure.query(async () => {
    if (!isAzureEnvironment()) {
      return { resources: [], source: "unavailable" as const };
    }

    const config = await getInfraConfig();
    const resources: Array<{ type: FirewallResourceType; name: string; label: string }> = [];

    if (config.pgServerName) {
      resources.push({ type: "postgresql", name: config.pgServerName, label: "PostgreSQL — " + config.pgServerName });
    }

    // Discover Redis in the resource group
    try {
      const rgUrl = getResourceGroupBaseUrl();
      const redisData = await azureGet<{ value: Array<{ name: string }> }>(
        `${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`
      );
      for (const r of redisData.value || []) {
        resources.push({ type: "redis", name: r.name, label: "Redis — " + r.name });
      }
    } catch { /* no Redis or no access */ }

    if (config.keyVaultName) {
      resources.push({ type: "keyvault", name: config.keyVaultName, label: "Key Vault — " + config.keyVaultName });
    }

    // Discover Container Apps in the resource group (skip the main rcc-app)
    try {
      const rgUrl = getResourceGroupBaseUrl();
      const caData = await azureGet<{ value: Array<{ name: string }> }>(
        `${rgUrl}/providers/Microsoft.App/containerApps?${CONTAINERAPP_API}`
      );
      for (const app of caData.value || []) {
        resources.push({ type: "containerapp", name: app.name, label: "Container App — " + app.name });
      }
    } catch { /* no Container Apps or no access */ }

    return { resources, source: "azure" as const };
  }),

  /** List firewall rules for a specific resource */
  listFirewallRules: adminProcedure
    .input(
      z.object({
        resourceType: FIREWALL_RESOURCE_TYPES.default("postgresql"),
        resourceName: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      if (!isAzureEnvironment()) {
        return { rules: [], source: "unavailable" as const, message: "Requires Azure deployment" };
      }

      const config = await getInfraConfig();
      const resourceType = input?.resourceType || "postgresql";
      const rgUrl = getResourceGroupBaseUrl();

      try {
        if (resourceType === "postgresql") {
          const serverName = input?.resourceName || config.pgServerName;
          if (!serverName) return { rules: [], source: "not_configured" as const, message: "PostgreSQL server not configured" };

          const serverUrl = getPostgresServerUrl(serverName);
          const data = await azureGet<{ value: AzureFirewallRule[] }>(`${serverUrl}/firewallRules?${PG_API}`);
          return {
            rules: data.value.map((r) => ({
              name: r.name,
              startIpAddress: r.properties.startIpAddress,
              endIpAddress: r.properties.endIpAddress,
            })),
            source: "azure" as const,
            resourceType: "postgresql" as const,
          };
        }

        if (resourceType === "redis") {
          // Discover redis name if not provided
          let redisName = input?.resourceName;
          if (!redisName) {
            const redisData = await azureGet<{ value: Array<{ name: string }> }>(`${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`);
            redisName = redisData.value?.[0]?.name;
          }
          if (!redisName) return { rules: [], source: "not_configured" as const, message: "No Redis resource found" };

          const data = await azureGet<{ value: Array<{ name: string; properties: { startIP: string; endIP: string } }> }>(
            `${rgUrl}/providers/Microsoft.Cache/Redis/${redisName}/firewallRules?${REDIS_API}`
          );
          return {
            rules: (data.value || []).map((r) => ({
              name: r.name,
              startIpAddress: r.properties.startIP,
              endIpAddress: r.properties.endIP,
            })),
            source: "azure" as const,
            resourceType: "redis" as const,
          };
        }

        if (resourceType === "keyvault") {
          const vaultName = input?.resourceName || config.keyVaultName;
          if (!vaultName) return { rules: [], source: "not_configured" as const, message: "Key Vault not configured" };

          const data = await azureGet<{ properties: { networkAcls?: { ipRules?: Array<{ value: string }> } } }>(
            `${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`
          );
          const ipRules = data.properties?.networkAcls?.ipRules || [];
          return {
            rules: ipRules.map((r, i) => {
              const ip = r.value.replace(/\/32$/, "");
              return { name: `rule-${i + 1}`, startIpAddress: ip, endIpAddress: ip, cidr: r.value };
            }),
            source: "azure" as const,
            resourceType: "keyvault" as const,
          };
        }

        if (resourceType === "containerapp") {
          const appName = input?.resourceName;
          if (!appName) return { rules: [], source: "not_configured" as const, message: "No Container App specified" };

          const app = await azureGet<{
            properties: {
              configuration?: {
                ingress?: {
                  ipSecurityRestrictions?: Array<{ name: string; ipAddressRange: string; action: string }>;
                };
              };
            };
          }>(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`);
          const restrictions = app.properties?.configuration?.ingress?.ipSecurityRestrictions || [];
          return {
            rules: restrictions.map((r) => {
              const ip = r.ipAddressRange.replace(/\/32$/, "").replace(/\/0$/, "");
              return {
                name: r.name,
                startIpAddress: ip,
                endIpAddress: ip,
                cidr: r.ipAddressRange,
                action: r.action,
              };
            }),
            source: "azure" as const,
            resourceType: "containerapp" as const,
          };
        }

        return { rules: [], source: "azure" as const };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list firewall rules: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /** Create a new firewall rule on any supported resource */
  createFirewallRule: adminProcedure
    .input(
      z.object({
        resourceType: FIREWALL_RESOURCE_TYPES.default("postgresql"),
        resourceName: z.string().optional(),
        ruleName: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
        startIpAddress: z.string().ip({ version: "v4" }),
        endIpAddress: z.string().ip({ version: "v4" }),
        action: z.enum(["Allow", "Deny"]).optional(), // Container Apps only
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      const rgUrl = getResourceGroupBaseUrl();

      await auditLog({
        action: "infrastructure.firewall.created",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.resourceType}:${input.ruleName}`,
        detail: { resourceType: input.resourceType, ruleName: input.ruleName, startIp: input.startIpAddress, endIp: input.endIpAddress },
      });

      try {
        if (input.resourceType === "postgresql") {
          const serverName = input.resourceName || config.pgServerName;
          if (!serverName) throw new Error("PostgreSQL server not configured.");
          const serverUrl = getPostgresServerUrl(serverName);
          await azurePut(`${serverUrl}/firewallRules/${input.ruleName}?${PG_API}`, {
            properties: { startIpAddress: input.startIpAddress, endIpAddress: input.endIpAddress },
          });
        } else if (input.resourceType === "redis") {
          let redisName = input.resourceName;
          if (!redisName) {
            const redisData = await azureGet<{ value: Array<{ name: string }> }>(`${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`);
            redisName = redisData.value?.[0]?.name;
          }
          if (!redisName) throw new Error("No Redis resource found.");
          await azurePut(`${rgUrl}/providers/Microsoft.Cache/Redis/${redisName}/firewallRules/${input.ruleName}?${REDIS_API}`, {
            properties: { startIP: input.startIpAddress, endIP: input.endIpAddress },
          });
        } else if (input.resourceType === "keyvault") {
          const vaultName = input.resourceName || config.keyVaultName;
          if (!vaultName) throw new Error("Key Vault not configured.");
          // Key Vault uses network ACLs — need to read current rules, append, and patch
          const vault = await azureGet<{ properties: { networkAcls?: { defaultAction?: string; ipRules?: Array<{ value: string }> } } }>(
            `${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`
          );
          const currentRules = vault.properties?.networkAcls?.ipRules || [];
          const cidr = input.startIpAddress === input.endIpAddress ? `${input.startIpAddress}/32` : input.startIpAddress;
          if (!currentRules.some((r) => r.value === cidr)) {
            currentRules.push({ value: cidr });
          }
          await azurePut(`${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`, {
            ...vault,
            properties: {
              ...vault.properties,
              networkAcls: { ...vault.properties?.networkAcls, ipRules: currentRules },
            },
          });
        } else if (input.resourceType === "containerapp") {
          const appName = input.resourceName;
          if (!appName) throw new Error("Container App name required.");
          const app = await azureGet<{
            properties: {
              configuration?: {
                ingress?: {
                  ipSecurityRestrictions?: Array<{ name: string; ipAddressRange: string; action: string }>;
                  [key: string]: unknown;
                };
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }>(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`);

          const restrictions = app.properties?.configuration?.ingress?.ipSecurityRestrictions || [];
          // 0.0.0.0 → /0 (all traffic), anything else → /32
          const cidr = input.startIpAddress === "0.0.0.0"
            ? "0.0.0.0/0"
            : `${input.startIpAddress}/32`;
          const action = input.action || "Allow";
          // Don't add duplicates
          if (!restrictions.some((r) => r.name === input.ruleName)) {
            restrictions.push({ name: input.ruleName, ipAddressRange: cidr, action });
          }
          await azurePatch(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`, {
            properties: {
              configuration: {
                ingress: {
                  ...app.properties?.configuration?.ingress,
                  ipSecurityRestrictions: restrictions,
                },
              },
            },
          });
        }

        return { success: true, ruleName: input.ruleName };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create firewall rule";
        await auditLog({
          action: "infrastructure.firewall.create_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `firewall:${input.resourceType}:${input.ruleName}`,
          detail: { error: message },
          outcome: "failure",
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /** Delete a firewall rule from any supported resource */
  deleteFirewallRule: adminProcedure
    .input(z.object({
      resourceType: FIREWALL_RESOURCE_TYPES.default("postgresql"),
      resourceName: z.string().optional(),
      ruleName: z.string().min(1),
      cidr: z.string().optional(), // For keyvault/containerapp (to identify the IP to remove)
    }))
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      const rgUrl = getResourceGroupBaseUrl();

      await auditLog({
        action: "infrastructure.firewall.deleted",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.resourceType}:${input.ruleName}`,
        detail: { resourceType: input.resourceType, ruleName: input.ruleName },
      });

      try {
        if (input.resourceType === "postgresql") {
          const serverName = input.resourceName || config.pgServerName;
          if (!serverName) throw new Error("PostgreSQL server not configured.");
          const serverUrl = getPostgresServerUrl(serverName);
          await azureDelete(`${serverUrl}/firewallRules/${input.ruleName}?${PG_API}`);
        } else if (input.resourceType === "redis") {
          let redisName = input.resourceName;
          if (!redisName) {
            const redisData = await azureGet<{ value: Array<{ name: string }> }>(`${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`);
            redisName = redisData.value?.[0]?.name;
          }
          if (!redisName) throw new Error("No Redis resource found.");
          await azureDelete(`${rgUrl}/providers/Microsoft.Cache/Redis/${redisName}/firewallRules/${input.ruleName}?${REDIS_API}`);
        } else if (input.resourceType === "keyvault") {
          const vaultName = input.resourceName || config.keyVaultName;
          if (!vaultName) throw new Error("Key Vault not configured.");
          const vault = await azureGet<{ properties: { networkAcls?: { ipRules?: Array<{ value: string }> } } }>(
            `${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`
          );
          const cidrToRemove = input.cidr || `${input.ruleName}/32`;
          const updatedRules = (vault.properties?.networkAcls?.ipRules || []).filter((r) => r.value !== cidrToRemove);
          await azurePut(`${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`, {
            ...vault,
            properties: {
              ...vault.properties,
              networkAcls: { ...vault.properties?.networkAcls, ipRules: updatedRules },
            },
          });
        } else if (input.resourceType === "containerapp") {
          const appName = input.resourceName;
          if (!appName) throw new Error("Container App name required.");
          const app = await azureGet<{
            properties: {
              configuration?: {
                ingress?: {
                  ipSecurityRestrictions?: Array<{ name: string; ipAddressRange: string; action: string }>;
                  [key: string]: unknown;
                };
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }>(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`);
          const restrictions = (app.properties?.configuration?.ingress?.ipSecurityRestrictions || [])
            .filter((r) => r.name !== input.ruleName);
          await azurePatch(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`, {
            properties: {
              configuration: {
                ingress: {
                  ...app.properties?.configuration?.ingress,
                  ipSecurityRestrictions: restrictions,
                },
              },
            },
          });
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete firewall rule";
        await auditLog({
          action: "infrastructure.firewall.delete_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `firewall:${input.resourceType}:${input.ruleName}`,
          detail: { error: message },
          outcome: "failure",
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /** Update an existing firewall rule (change IPs) */
  updateFirewallRule: adminProcedure
    .input(
      z.object({
        resourceType: FIREWALL_RESOURCE_TYPES.default("postgresql"),
        resourceName: z.string().optional(),
        ruleName: z.string().min(1).max(128),
        startIpAddress: z.string().ip({ version: "v4" }),
        endIpAddress: z.string().ip({ version: "v4" }),
        oldCidr: z.string().optional(), // For keyvault: the old CIDR to replace
        action: z.enum(["Allow", "Deny"]).optional(), // Container Apps only
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      const rgUrl = getResourceGroupBaseUrl();

      await auditLog({
        action: "infrastructure.firewall.updated",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.resourceType}:${input.ruleName}`,
        detail: { resourceType: input.resourceType, ruleName: input.ruleName, startIp: input.startIpAddress, endIp: input.endIpAddress },
      });

      try {
        if (input.resourceType === "postgresql") {
          const serverName = input.resourceName || config.pgServerName;
          if (!serverName) throw new Error("PostgreSQL server not configured.");
          const serverUrl = getPostgresServerUrl(serverName);
          await azurePut(`${serverUrl}/firewallRules/${input.ruleName}?${PG_API}`, {
            properties: { startIpAddress: input.startIpAddress, endIpAddress: input.endIpAddress },
          });
        } else if (input.resourceType === "redis") {
          let redisName = input.resourceName;
          if (!redisName) {
            const redisData = await azureGet<{ value: Array<{ name: string }> }>(`${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`);
            redisName = redisData.value?.[0]?.name;
          }
          if (!redisName) throw new Error("No Redis resource found.");
          await azurePut(`${rgUrl}/providers/Microsoft.Cache/Redis/${redisName}/firewallRules/${input.ruleName}?${REDIS_API}`, {
            properties: { startIP: input.startIpAddress, endIP: input.endIpAddress },
          });
        } else if (input.resourceType === "keyvault") {
          const vaultName = input.resourceName || config.keyVaultName;
          if (!vaultName) throw new Error("Key Vault not configured.");
          const vault = await azureGet<{ properties: { networkAcls?: { ipRules?: Array<{ value: string }> } } }>(
            `${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`
          );
          const newCidr = `${input.startIpAddress}/32`;
          let rules = vault.properties?.networkAcls?.ipRules || [];
          if (input.oldCidr) {
            rules = rules.map((r) => r.value === input.oldCidr ? { value: newCidr } : r);
          } else {
            rules.push({ value: newCidr });
          }
          await azurePut(`${rgUrl}/providers/Microsoft.KeyVault/vaults/${vaultName}?${KV_API}`, {
            ...vault,
            properties: { ...vault.properties, networkAcls: { ...vault.properties?.networkAcls, ipRules: rules } },
          });
        } else if (input.resourceType === "containerapp") {
          const appName = input.resourceName;
          if (!appName) throw new Error("Container App name required.");
          const app = await azureGet<{
            properties: {
              configuration?: {
                ingress?: {
                  ipSecurityRestrictions?: Array<{ name: string; ipAddressRange: string; action: string }>;
                  [key: string]: unknown;
                };
                [key: string]: unknown;
              };
              [key: string]: unknown;
            };
            [key: string]: unknown;
          }>(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`);

          const newCidr = input.startIpAddress === "0.0.0.0"
            ? "0.0.0.0/0"
            : `${input.startIpAddress}/32`;
          const action = input.action || "Allow";
          const restrictions = (app.properties?.configuration?.ingress?.ipSecurityRestrictions || [])
            .map((r) => r.name === input.ruleName ? { ...r, ipAddressRange: newCidr, action } : r);
          await azurePatch(`${rgUrl}/providers/Microsoft.App/containerApps/${appName}?${CONTAINERAPP_API}`, {
            properties: {
              configuration: {
                ingress: {
                  ...app.properties?.configuration?.ingress,
                  ipSecurityRestrictions: restrictions,
                },
              },
            },
          });
        }

        return { success: true, ruleName: input.ruleName };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update firewall rule";
        await auditLog({
          action: "infrastructure.firewall.update_failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `firewall:${input.resourceType}:${input.ruleName}`,
          detail: { error: message },
          outcome: "failure",
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /** Create multiple firewall rules at once (batch) — PostgreSQL + Redis only */
  createFirewallRuleBatch: adminProcedure
    .input(
      z.object({
        resourceType: z.enum(["postgresql", "redis"]).default("postgresql"),
        resourceName: z.string().optional(),
        rulePrefix: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
        ipAddresses: z.array(z.string().ip({ version: "v4" })).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      const rgUrl = getResourceGroupBaseUrl();
      const results: Array<{ ruleName: string; ip: string; success: boolean; error?: string }> = [];

      for (let i = 0; i < input.ipAddresses.length; i++) {
        const ip = input.ipAddresses[i];
        const ruleName = input.ipAddresses.length === 1 ? input.rulePrefix : `${input.rulePrefix}-${i + 1}`;

        try {
          if (input.resourceType === "postgresql") {
            const serverName = input.resourceName || config.pgServerName;
            if (!serverName) throw new Error("PostgreSQL server not configured.");
            const serverUrl = getPostgresServerUrl(serverName);
            await azurePut(`${serverUrl}/firewallRules/${ruleName}?${PG_API}`, {
              properties: { startIpAddress: ip, endIpAddress: ip },
            });
          } else if (input.resourceType === "redis") {
            let redisName = input.resourceName;
            if (!redisName) {
              const redisData = await azureGet<{ value: Array<{ name: string }> }>(`${rgUrl}/providers/Microsoft.Cache/Redis?${REDIS_API}`);
              redisName = redisData.value?.[0]?.name;
            }
            if (!redisName) throw new Error("No Redis resource found.");
            await azurePut(`${rgUrl}/providers/Microsoft.Cache/Redis/${redisName}/firewallRules/${ruleName}?${REDIS_API}`, {
              properties: { startIP: ip, endIP: ip },
            });
          }
          results.push({ ruleName, ip, success: true });
        } catch (error) {
          results.push({ ruleName, ip, success: false, error: error instanceof Error ? error.message : "Failed" });
        }
      }

      await auditLog({
        action: "infrastructure.firewall.batch_created",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `firewall:${input.resourceType}:${input.rulePrefix}`,
        detail: { resourceType: input.resourceType, rulePrefix: input.rulePrefix, count: input.ipAddresses.length, succeeded: results.filter((r) => r.success).length },
      });

      return { results };
    }),

  // ═══ DATABASE EXPLORER ════════════════════════════════════════════

  /** List tables in a database with row counts, sizes, and index counts */
  getDatabaseTables: adminProcedure
    .input(z.object({ databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name") }))
    .query(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        return { tables: [], source: "unavailable" as const };
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        return { tables: [], source: "not_configured" as const };
      }

      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        const result = await pool.query(`
          SELECT
            t.table_name,
            t.table_schema,
            COALESCE(s.n_live_tup, 0) AS row_count,
            pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)) AS total_bytes,
            (
              SELECT COUNT(*)::int
              FROM pg_indexes pi
              WHERE pi.schemaname = t.table_schema AND pi.tablename = t.table_name
            ) AS index_count
          FROM information_schema.tables t
          LEFT JOIN pg_stat_user_tables s
            ON s.schemaname = t.table_schema AND s.relname = t.table_name
          WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
            AND t.table_type = 'BASE TABLE'
          ORDER BY COALESCE(s.n_live_tup, 0) DESC, t.table_name
        `);

        await auditLog({
          action: "infrastructure.database.tables_viewed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}`,
          detail: { databaseName: input.databaseName, tableCount: result.rows.length },
        });

        return {
          tables: result.rows.map((row: { table_name: string; table_schema: string; row_count: string; total_bytes: string; index_count: number }) => ({
            name: row.table_name,
            schema: row.table_schema,
            rowCount: Number(row.row_count),
            totalBytes: Number(row.total_bytes),
            indexCount: row.index_count,
          })),
          source: "azure" as const,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list tables: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
      }
    }),

  /** Get column schema for a specific table */
  getTableSchema: adminProcedure
    .input(
      z.object({
        databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name"),
        tableName: z.string().min(1),
        schemaName: z.string().max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid schema name").default("public"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        return { columns: [], source: "unavailable" as const };
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        return { columns: [], source: "not_configured" as const };
      }

      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        const result = await pool.query(
          `
          SELECT
            c.column_name,
            c.data_type,
            c.udt_name,
            c.is_nullable,
            c.column_default,
            c.character_maximum_length,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
              AND tc.table_schema = ku.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
          ) pk ON pk.column_name = c.column_name
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position
          `,
          [input.schemaName, input.tableName]
        );

        await auditLog({
          action: "infrastructure.database.schema_viewed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}:${input.tableName}`,
          detail: { databaseName: input.databaseName, tableName: input.tableName },
        });

        return {
          columns: result.rows.map((row: { column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null; is_primary_key: boolean }) => ({
            name: row.column_name,
            type: row.data_type === "USER-DEFINED" ? row.udt_name : row.data_type,
            nullable: row.is_nullable === "YES",
            default: row.column_default,
            maxLength: row.character_maximum_length,
            isPrimaryKey: row.is_primary_key,
          })),
          source: "azure" as const,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get table schema: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
      }
    }),

  // ═══ INDEX MANAGEMENT ══════════════════════════════════════════════

  /** List indexes for a specific table */
  getTableIndexes: adminProcedure
    .input(
      z.object({
        databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name"),
        tableName: z.string().min(1),
        schemaName: z.string().max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid schema name").default("public"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        return { indexes: [], source: "unavailable" as const };
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        return { indexes: [], source: "not_configured" as const };
      }

      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        const result = await pool.query(
          `
          SELECT
            i.indexname AS index_name,
            i.indexdef AS definition,
            ix.indisunique AS is_unique,
            ix.indisprimary AS is_primary,
            pg_relation_size(quote_ident(i.schemaname) || '.' || quote_ident(i.indexname)) AS size_bytes,
            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
          FROM pg_indexes i
          JOIN pg_class c ON c.relname = i.tablename
          JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = i.schemaname
          JOIN pg_index ix ON ix.indrelid = c.oid
          JOIN pg_class ic ON ic.oid = ix.indexrelid AND ic.relname = i.indexname
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(ix.indkey)
          WHERE i.schemaname = $1 AND i.tablename = $2
          GROUP BY i.indexname, i.indexdef, ix.indisunique, ix.indisprimary, i.schemaname
          ORDER BY ix.indisprimary DESC, ix.indisunique DESC, i.indexname
          `,
          [input.schemaName, input.tableName]
        );

        return {
          indexes: result.rows.map((row: {
            index_name: string;
            definition: string;
            is_unique: boolean;
            is_primary: boolean;
            size_bytes: string;
            columns: string[];
          }) => ({
            name: row.index_name,
            definition: row.definition,
            isUnique: row.is_unique,
            isPrimary: row.is_primary,
            sizeBytes: Number(row.size_bytes),
            columns: row.columns,
          })),
          source: "azure" as const,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list indexes: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
      }
    }),

  /** Create an index on a table */
  createIndex: adminProcedure
    .input(
      z.object({
        databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name").max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name"),
        tableName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid table name"),
        schemaName: z.string().max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid schema name").default("public"),
        columns: z.array(z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid column name")).min(1).max(10),
        indexName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid index name").optional(),
        unique: z.boolean().default(false),
        method: z.enum(["btree", "hash", "gin", "gist"]).default("btree"),
        concurrent: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL not configured." });
      }

      // Generate index name if not provided
      const idxName = input.indexName || `idx_${input.tableName}_${input.columns.join("_")}`;

      // Validate column names against actual table columns to prevent injection
      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        const colCheck = await pool.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
          [input.schemaName, input.tableName]
        );
        const validColumns = new Set(colCheck.rows.map((r: { column_name: string }) => r.column_name));
        for (const col of input.columns) {
          if (!validColumns.has(col)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Column "${col}" does not exist on table "${input.tableName}"`,
            });
          }
        }

        await auditLog({
          action: "infrastructure.database.index_create",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}:${input.tableName}`,
          detail: { indexName: idxName, columns: input.columns, unique: input.unique, method: input.method },
        });

        // Build safe SQL — column/table names validated above
        const quotedCols = input.columns.map((c) => `"${c}"`).join(", ");
        const uniqueClause = input.unique ? "UNIQUE " : "";
        const concurrentClause = input.concurrent ? "CONCURRENTLY " : "";
        const sql = `CREATE ${uniqueClause}INDEX ${concurrentClause}"${idxName}" ON "${input.schemaName}"."${input.tableName}" USING ${input.method} (${quotedCols})`;

        await pool.query(sql);

        await auditLog({
          action: "infrastructure.database.index_created",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}:${input.tableName}`,
          detail: { indexName: idxName, columns: input.columns },
          outcome: "success",
        });

        return { success: true, indexName: idxName };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create index: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
      }
    }),

  /** Drop an index */
  dropIndex: adminProcedure
    .input(
      z.object({
        databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name").max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name"),
        indexName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid index name"),
        schemaName: z.string().max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid schema name").default("public"),
        concurrent: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL not configured." });
      }

      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        // Verify the index exists and is not a primary key constraint
        const check = await pool.query(
          `
          SELECT ic.relname AS index_name, ix.indisprimary
          FROM pg_index ix
          JOIN pg_class ic ON ic.oid = ix.indexrelid
          JOIN pg_class tc ON tc.oid = ix.indrelid
          JOIN pg_namespace n ON n.oid = tc.relnamespace
          WHERE n.nspname = $1 AND ic.relname = $2
          `,
          [input.schemaName, input.indexName]
        );

        if (check.rows.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Index "${input.indexName}" not found.` });
        }

        if (check.rows[0].indisprimary) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot drop a primary key index. Drop the constraint instead.",
          });
        }

        await auditLog({
          action: "infrastructure.database.index_drop",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}:${input.indexName}`,
          detail: { indexName: input.indexName, schemaName: input.schemaName },
        });

        const concurrentClause = input.concurrent ? "CONCURRENTLY " : "";
        await pool.query(`DROP INDEX ${concurrentClause}"${input.schemaName}"."${input.indexName}"`);

        await auditLog({
          action: "infrastructure.database.index_dropped",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}:${input.indexName}`,
          detail: { indexName: input.indexName },
          outcome: "success",
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to drop index: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
      }
    }),

  /** Apply recommended indexes for known 3CX tables */
  applyRecommendedIndexes: adminProcedure
    .input(
      z.object({
        databaseName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name").max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid database name"),
        tableName: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid table name").optional(),
        schemaName: z.string().max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid schema name").default("public"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAzureEnvironment()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Requires Azure deployment." });
      }

      const config = await getInfraConfig();
      if (!config.pgServerName || !config.pgAdminPassword) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PostgreSQL not configured." });
      }

      // Recommended indexes for known 3CX tables (v20 U6+ schema)
      const RECOMMENDED: Record<string, Array<{ columns: string[]; unique?: boolean; name?: string }>> = {
        cdroutput: [
          { columns: ["cdr_started_at"], name: "idx_cdroutput_started_at" },
          { columns: ["call_history_id"], name: "idx_cdroutput_call_history_id" },
          { columns: ["source_dn_number"], name: "idx_cdroutput_source_dn" },
          { columns: ["destination_dn_number"], name: "idx_cdroutput_dest_dn" },
          { columns: ["source_participant_phone_number"], name: "idx_cdroutput_source_phone" },
          { columns: ["destination_participant_phone_number"], name: "idx_cdroutput_dest_phone" },
          { columns: ["source_entity_type"], name: "idx_cdroutput_source_entity" },
          { columns: ["creation_method"], name: "idx_cdroutput_creation_method" },
          { columns: ["cdr_started_at", "source_dn_number"], name: "idx_cdroutput_time_source_dn" },
          { columns: ["cdr_started_at", "destination_dn_number"], name: "idx_cdroutput_time_dest_dn" },
        ],
        cdrbilling: [
          { columns: ["cdr_id"], name: "idx_cdrbilling_cdr_id" },
          { columns: ["billing_code"], name: "idx_cdrbilling_code" },
        ],
        recordings: [
          { columns: ["start_time"], name: "idx_recordings_start_time" },
          { columns: ["cl_participants_id"], name: "idx_recordings_participant" },
          { columns: ["call_type"], name: "idx_recordings_call_type" },
        ],
        callcent_queuecalls: [
          { columns: ["q_num"], name: "idx_queuecalls_q_num" },
          { columns: ["time_start"], name: "idx_queuecalls_time_start" },
          { columns: ["call_history_id"], name: "idx_queuecalls_call_history" },
          { columns: ["is_answered"], name: "idx_queuecalls_answered" },
          { columns: ["q_num", "time_start"], name: "idx_queuecalls_q_time" },
        ],
        // Legacy tables (v18 / pre-v20 U6)
        cl_calls: [
          { columns: ["start_time"], name: "idx_cl_calls_start_time" },
          { columns: ["end_time"], name: "idx_cl_calls_end_time" },
        ],
        cl_participants: [
          { columns: ["call_id"], name: "idx_cl_participants_call_id" },
          { columns: ["start_time"], name: "idx_cl_participants_start_time" },
        ],
        cl_segments: [
          { columns: ["call_id"], name: "idx_cl_segments_call_id" },
          { columns: ["start_time"], name: "idx_cl_segments_start_time" },
        ],
        callhistory3: [
          { columns: ["starttime"], name: "idx_callhistory3_starttime" },
          { columns: ["from_no"], name: "idx_callhistory3_from_no" },
          { columns: ["to_no"], name: "idx_callhistory3_to_no" },
        ],
      };

      const pool = await getAdminPool(config.pgServerName, config.pgAdminPassword, input.databaseName);
      try {
        // Get actual tables in the database
        const tablesResult = await pool.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
          [input.schemaName]
        );
        const existingTables = new Set(tablesResult.rows.map((r: { table_name: string }) => r.table_name));

        // Get existing index names to avoid duplicates
        const indexResult = await pool.query(
          `SELECT indexname FROM pg_indexes WHERE schemaname = $1`,
          [input.schemaName]
        );
        const existingIndexes = new Set(indexResult.rows.map((r: { indexname: string }) => r.indexname));

        const results: Array<{ table: string; index: string; columns: string[]; status: "created" | "skipped" | "error"; error?: string }> = [];

        // Determine which tables to process
        const tablesToProcess = input.tableName ? [input.tableName] : Object.keys(RECOMMENDED);

        for (const table of tablesToProcess) {
          if (!existingTables.has(table)) continue;
          const indexes = RECOMMENDED[table];
          if (!indexes) continue;

          // Verify which columns actually exist on this table
          const colResult = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
            [input.schemaName, table]
          );
          const validColumns = new Set(colResult.rows.map((r: { column_name: string }) => r.column_name));

          for (const idx of indexes) {
            const idxName = idx.name || `idx_${table}_${idx.columns.join("_")}`;

            // Skip if index already exists
            if (existingIndexes.has(idxName)) {
              results.push({ table, index: idxName, columns: idx.columns, status: "skipped" });
              continue;
            }

            // Skip if any column doesn't exist
            const missingCols = idx.columns.filter((c) => !validColumns.has(c));
            if (missingCols.length > 0) {
              results.push({ table, index: idxName, columns: idx.columns, status: "skipped", error: `Missing columns: ${missingCols.join(", ")}` });
              continue;
            }

            try {
              const quotedCols = idx.columns.map((c) => `"${c}"`).join(", ");
              const uniqueClause = idx.unique ? "UNIQUE " : "";
              await pool.query(`CREATE ${uniqueClause}INDEX CONCURRENTLY "${idxName}" ON "${input.schemaName}"."${table}" (${quotedCols})`);
              results.push({ table, index: idxName, columns: idx.columns, status: "created" });
              existingIndexes.add(idxName);
            } catch (error) {
              results.push({
                table,
                index: idxName,
                columns: idx.columns,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }
        }

        await auditLog({
          action: "infrastructure.database.recommended_indexes_applied",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `database:${input.databaseName}`,
          detail: {
            tableName: input.tableName || "all",
            created: results.filter((r) => r.status === "created").length,
            skipped: results.filter((r) => r.status === "skipped").length,
            errors: results.filter((r) => r.status === "error").length,
          },
          outcome: "success",
        });

        return {
          results,
          created: results.filter((r) => r.status === "created").length,
          skipped: results.filter((r) => r.status === "skipped").length,
          errors: results.filter((r) => r.status === "error").length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to apply indexes: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        await pool.end();
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
