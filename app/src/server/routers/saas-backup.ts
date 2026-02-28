/**
 * SaaS Backup Router — tRPC procedures for Dropsuite (NinjaOne SaaS Backup).
 *
 * Uses DropsuiteConnector via ConnectorFactory.getByToolId("dropsuite").
 * All routes are read-only (monitoring/reporting).
 */

import { z } from "zod";
import { router, requirePerm } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { ISaasBackupConnector } from "../connectors/_interfaces/saas-backup";
import { cachedQuery } from "@/lib/query-cache";

const SAAS_BACKUP_STALE = 10 * 60_000; // 10 min

/** Get the Dropsuite connector instance */
async function getDropsuite(prisma: Parameters<typeof ConnectorFactory.getByToolId>[1]) {
  return ConnectorFactory.getByToolId("dropsuite", prisma) as Promise<ISaasBackupConnector>;
}

export const saasBackupRouter = router({
  // ─── Dashboard Summary ────────────────────────────────────────

  getDashboardSummary: requirePerm("backups.dropsuite.view").query(async ({ ctx }) => {
    try {
      const ds = await getDropsuite(ctx.prisma);
      return await ds.getDashboardSummary();
    } catch (err) {
      console.error("[saasBackup.getDashboardSummary] Error:", err);
      throw err;
    }
  }),

  // ─── Organizations ────────────────────────────────────────────

  getOrganizations: requirePerm("backups.dropsuite.view").query(async ({ ctx }) => {
    try {
      const ds = await getDropsuite(ctx.prisma);
      return await ds.getOrganizations();
    } catch (err) {
      console.error("[saasBackup.getOrganizations] Error:", err);
      throw err;
    }
  }),

  // ─── Tenants ──────────────────────────────────────────────────

  getOrganizationTenants: requirePerm("backups.dropsuite.view")
    .input(
      z.object({
        orgSourceId: z.string(),
        orgAuthToken: z.string(),
        type: z.enum(["m365", "gws"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getOrganizationTenants(input.orgSourceId, input.orgAuthToken, input.type);
      } catch (err) {
        console.error("[saasBackup.getOrganizationTenants] Error:", err);
        throw err;
      }
    }),

  // ─── Tenant Mailboxes ─────────────────────────────────────────

  getTenantMailboxes: requirePerm("backups.dropsuite.view")
    .input(
      z.object({
        orgSourceId: z.string(),
        orgAuthToken: z.string(),
        tenantId: z.number(),
        type: z.enum(["m365", "gws"]),
        status: z.enum(["active", "excluded", "available"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getTenantMailboxes(
          input.orgSourceId,
          input.orgAuthToken,
          input.tenantId,
          input.type,
          input.status
        );
      } catch (err) {
        console.error("[saasBackup.getTenantMailboxes] Error:", err);
        throw err;
      }
    }),

  // ─── Backup Accounts ──────────────────────────────────────────

  getBackupAccounts: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getBackupAccounts(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getBackupAccounts] Error:", err);
        throw err;
      }
    }),

  // ─── Connection Failures ──────────────────────────────────────

  getConnectionFailures: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getConnectionFailures(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getConnectionFailures] Error:", err);
        throw err;
      }
    }),

  // ─── Journals ──────────────────────────────────────────────────

  getJournals: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getJournals(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getJournals] Error:", err);
        throw err;
      }
    }),

  // ─── NDR Journal ─────────────────────────────────────────────

  getNdrJournal: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getNdrJournal(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getNdrJournal] Error:", err);
        throw err;
      }
    }),

  // ─── OneDrive ────────────────────────────────────────────────

  getOneDrives: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getOneDrives(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getOneDrives] Error:", err);
        throw err;
      }
    }),

  // ─── SharePoint ──────────────────────────────────────────────

  getSharePoints: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getSharePoints(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getSharePoints] Error:", err);
        throw err;
      }
    }),

  // ─── SharePoint Sites ──────────────────────────────────────────

  getSharePointSites: requirePerm("backups.dropsuite.view")
    .input(z.object({ domainId: z.number(), orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getSharePointSites(input.domainId, input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getSharePointSites] Error:", err);
        throw err;
      }
    }),

  // ─── Teams & Groups ──────────────────────────────────────────

  getTeamsAndGroups: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getTeamsAndGroups(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getTeamsAndGroups] Error:", err);
        throw err;
      }
    }),

  // ─── Teams Groups ──────────────────────────────────────────────

  getTeamsGroups: requirePerm("backups.dropsuite.view")
    .input(z.object({ domainId: z.number(), orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getTeamsGroups(input.domainId, input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getTeamsGroups] Error:", err);
        throw err;
      }
    }),

  // ─── Calendars ───────────────────────────────────────────────

  getCalendars: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getCalendars(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getCalendars] Error:", err);
        throw err;
      }
    }),

  // ─── Contacts ────────────────────────────────────────────────

  getContacts: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getContacts(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getContacts] Error:", err);
        throw err;
      }
    }),

  // ─── Tasks ───────────────────────────────────────────────────

  getTasks: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getTasks(input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getTasks] Error:", err);
        throw err;
      }
    }),

  // ─── Retention Policies ──────────────────────────────────────

  getRetentionPolicies: requirePerm("backups.dropsuite.view")
    .input(z.object({ orgSourceId: z.string(), orgAuthToken: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getRetentionPolicies(input.orgSourceId, input.orgAuthToken);
      } catch (err) {
        console.error("[saasBackup.getRetentionPolicies] Error:", err);
        throw err;
      }
    }),

  // ─── Alerts ─────────────────────────────────────────────────

  getAlerts: requirePerm("backups.dropsuite.view").query(async ({ ctx }) => {
    return cachedQuery("saas-backup", SAAS_BACKUP_STALE, "alerts", async () => {
      try {
        const ds = await getDropsuite(ctx.prisma);
        return await ds.getActiveAlerts();
      } catch (err) {
        console.error("[saasBackup.getAlerts] Error:", err);
        throw err;
      }
    });
  }),
});
