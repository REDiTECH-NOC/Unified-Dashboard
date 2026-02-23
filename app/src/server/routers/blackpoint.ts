/**
 * Blackpoint CompassOne Router — tRPC procedures for the full CompassOne API.
 *
 * Uses BlackpointConnector via ConnectorFactory.getByToolId("blackpoint").
 * All write operations are audit-logged.
 *
 * Categories: detections, assets, tenants, accounts, collections, cloud-mdr,
 *             vulnerability-management, notification-channels, users, contact-groups
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { BlackpointConnector } from "../connectors/blackpoint/connector";
import { auditLog } from "@/lib/audit";

/** Get the Blackpoint connector instance (always by toolId, not category) */
async function getBP(prisma: Parameters<typeof ConnectorFactory.getByToolId>[1]) {
  return ConnectorFactory.getByToolId("blackpoint", prisma) as Promise<BlackpointConnector>;
}

export const blackpointRouter = router({
  // =========================================================================
  // Detections (Alert Groups)
  // =========================================================================

  getDetections: protectedProcedure
    .input(
      z.object({
        status: z.array(z.string()).optional(),
        detectionType: z.string().optional(),
        search: z.string().optional(),
        since: z.date().optional(),
        sortByColumn: z.string().optional(),
        sortDirection: z.enum(["ASC", "DESC"]).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDetections(
        {
          detectionType: input.detectionType,
          search: input.search,
          since: input.since,
          sortByColumn: input.sortByColumn,
          sortDirection: input.sortDirection,
        },
        input.skip,
        input.take
      );
    }),

  getDetectionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDetectionById(input.id);
    }),

  getDetectionAlerts: protectedProcedure
    .input(
      z.object({
        alertGroupId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDetectionAlerts(input.alertGroupId, input.skip, input.take);
    }),

  getDetectionCount: protectedProcedure
    .input(
      z.object({
        detectionType: z.string().optional(),
        since: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDetectionCount({
        detectionType: input.detectionType,
        since: input.since,
      });
    }),

  getDetectionsByWeek: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDetectionsByWeek(input.startDate, input.endDate);
    }),

  getTopDetectionsByEntity: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTopDetectionsByEntity(input.startDate, input.endDate, input.limit);
    }),

  getTopDetectionsByThreat: protectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTopDetectionsByThreat(input.startDate, input.endDate, input.limit);
    }),

  // =========================================================================
  // Assets
  // =========================================================================

  getAssets: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        assetClass: z.string().optional(),
        search: z.string().optional(),
        sortByColumn: z.string().optional(),
        sortDirection: z.enum(["ASC", "DESC"]).optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAssets(
        {
          tenantId: input.tenantId,
          assetClass: input.assetClass,
          search: input.search,
          sortByColumn: input.sortByColumn,
          sortDirection: input.sortDirection,
        },
        input.skip,
        input.take
      );
    }),

  getAssetById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAssetById(input.id);
    }),

  getAssetRelationships: protectedProcedure
    .input(
      z.object({
        assetId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAssetRelationships(input.assetId, input.skip, input.take);
    }),

  // =========================================================================
  // Tenants
  // =========================================================================

  getTenants: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenants(input.skip, input.take);
    }),

  getTenantById: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenantById(input.accountId, input.tenantId);
    }),

  // =========================================================================
  // Accounts
  // =========================================================================

  getAccounts: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccounts(input.skip, input.take);
    }),

  getAccountById: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccountById(input.accountId);
    }),

  // =========================================================================
  // Collections
  // =========================================================================

  getCollections: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCollections(input.skip, input.take);
    }),

  getCollectionById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCollectionById(input.id);
    }),

  createCollection: protectedProcedure
    .input(
      z.object({
        context: z.string(),
        name: z.string(),
        search: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createCollection(input as Parameters<typeof bp.createCollection>[0]);
      await auditLog({
        action: "blackpoint.collection.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  updateCollection: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.updateCollection(input.id, { name: input.name, search: input.search });
      await auditLog({
        action: "blackpoint.collection.update",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${input.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  deleteCollection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteCollection(input.id);
      await auditLog({
        action: "blackpoint.collection.delete",
        category: "API",
        actorId: ctx.user.id,
        resource: `collection:${input.id}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Cloud MDR — M365
  // =========================================================================

  getMs365Connections: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365Connections(input.tenantId);
    }),

  getMs365ConnectionById: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365ConnectionById(input.connectionId);
    }),

  getMs365ApprovedCountries: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365ApprovedCountries(input.connectionId);
    }),

  approveMs365Country: protectedProcedure
    .input(z.object({ connectionId: z.string(), isoCountryCode: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.approveMs365Country(input.connectionId, input.isoCountryCode);
      await auditLog({
        action: "blackpoint.ms365.country.approve",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `connection:${input.connectionId}`,
        detail: { country: input.isoCountryCode },
      });
      return { success: true };
    }),

  removeMs365ApprovedCountry: protectedProcedure
    .input(z.object({ connectionId: z.string(), isoCountryCode: z.string().length(2) }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.removeMs365ApprovedCountry(input.connectionId, input.isoCountryCode);
      await auditLog({
        action: "blackpoint.ms365.country.remove",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `connection:${input.connectionId}`,
        detail: { country: input.isoCountryCode },
      });
      return { success: true };
    }),

  getMs365Users: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getMs365Users(input.connectionId, input.skip, input.take);
    }),

  // =========================================================================
  // Cloud MDR — Generic Connections
  // =========================================================================

  getConnectionApprovedCountries: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getConnectionApprovedCountries(input.connectionId, input.skip, input.take);
    }),

  getConnectionUsers: protectedProcedure
    .input(
      z.object({
        connectionId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getConnectionUsers(input.connectionId, input.skip, input.take);
    }),

  getIsoCountries: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getIsoCountries();
    }),

  // =========================================================================
  // Cloud MDR — Google
  // =========================================================================

  getGoogleOnboardings: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getGoogleOnboardings();
    }),

  getGoogleOnboardingById: protectedProcedure
    .input(z.object({ onboardingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getGoogleOnboardingById(input.onboardingId);
    }),

  // =========================================================================
  // Cloud MDR — Cisco Duo
  // =========================================================================

  getCiscoDuoOnboardings: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCiscoDuoOnboardings();
    }),

  getCiscoDuoOnboardingById: protectedProcedure
    .input(z.object({ onboardingId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCiscoDuoOnboardingById(input.onboardingId);
    }),

  createCiscoDuoOnboarding: protectedProcedure
    .input(
      z.object({
        host: z.string().optional(),
        ikey: z.string().optional(),
        skey: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createCiscoDuoOnboarding(input);
      await auditLog({
        action: "blackpoint.cisco.onboarding.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `onboarding:${result.id}`,
      });
      return result;
    }),

  deleteCiscoDuoOnboarding: protectedProcedure
    .input(z.object({ onboardingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteCiscoDuoOnboarding(input.onboardingId);
      await auditLog({
        action: "blackpoint.cisco.onboarding.delete",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `onboarding:${input.onboardingId}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Vulnerability Management — Vulnerabilities
  // =========================================================================

  getVulnerabilities: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().optional(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getVulnerabilities(input.skip, input.take, input.tenantId);
    }),

  getVulnerabilityById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getVulnerabilityById(input.id);
    }),

  getVulnerabilityAssets: protectedProcedure
    .input(
      z.object({
        vulnId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getVulnerabilityAssets(input.vulnId, input.skip, input.take);
    }),

  getVulnerabilitySeverityStats: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getVulnerabilitySeverityStats();
    }),

  getVulnerabilityTenantStats: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getVulnerabilityTenantStats();
    }),

  // =========================================================================
  // Vulnerability Management — CVEs
  // =========================================================================

  getCveById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCveById(input.id);
    }),

  getCveReferences: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getCveReferences(input.id);
    }),

  // =========================================================================
  // Vulnerability Management — Scans
  // =========================================================================

  getScans: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScans(input.skip, input.take);
    }),

  getScanById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanById(input.id);
    }),

  createScan: protectedProcedure
    .input(
      z.object({
        type: z.enum(["darkweb", "external", "local", "network"]),
        tenantId: z.string(),
        config: z.record(z.unknown()).optional(),
        assetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createScan(input);
      await auditLog({
        action: "blackpoint.scan.create",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${result.id}`,
        detail: { type: input.type, tenantId: input.tenantId },
      });
      return result;
    }),

  cancelScan: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.cancelScan(input.id);
      await auditLog({
        action: "blackpoint.scan.cancel",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${input.id}`,
      });
      return { success: true };
    }),

  deleteScan: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteScan(input.id);
      await auditLog({
        action: "blackpoint.scan.delete",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scan:${input.id}`,
      });
      return { success: true };
    }),

  getScanCves: protectedProcedure
    .input(
      z.object({
        scanId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanCves(input.scanId, input.skip, input.take);
    }),

  // =========================================================================
  // Vulnerability Management — Scan Schedules
  // =========================================================================

  getScanSchedules: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanSchedules(input.skip, input.take);
    }),

  getScanScheduleById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScanScheduleById(input.id);
    }),

  createScanSchedule: protectedProcedure
    .input(
      z.object({
        type: z.enum(["darkweb", "external", "local", "network"]),
        tenantId: z.string(),
        name: z.string(),
        time: z.string(),
        frequency: z.enum(["daily", "monthly", "once", "weekly"]),
        config: z.record(z.unknown()).optional(),
        frequencyConfig: z.record(z.unknown()).optional(),
        assetId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createScanSchedule(input);
      await auditLog({
        action: "blackpoint.scanSchedule.create",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${result.id}`,
        detail: { name: input.name, type: input.type },
      });
      return result;
    }),

  runScanSchedule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.runScanSchedule(input.id);
      await auditLog({
        action: "blackpoint.scanSchedule.run",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${input.id}`,
      });
      return { success: true };
    }),

  deleteScanSchedule: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteScanSchedule(input.id);
      await auditLog({
        action: "blackpoint.scanSchedule.delete",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `scanSchedule:${input.id}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Vulnerability Management — Scans & Schedules Combined
  // =========================================================================

  getScansAndSchedules: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScansAndSchedules(input.skip, input.take);
    }),

  getScansAndSchedulesStats: protectedProcedure
    .query(async ({ ctx }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getScansAndSchedulesStats();
    }),

  // =========================================================================
  // Vulnerability Management — External & Dark Web
  // =========================================================================

  getExternalScanExposures: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getExternalScanExposures(input.id);
    }),

  getExternalScanReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getExternalScanReport(input.id);
    }),

  getDarkwebScanExposures: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDarkwebScanExposures(input.tenantId);
    }),

  getDarkwebScanReport: protectedProcedure
    .input(z.object({ tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getDarkwebScanReport(input.tenantId);
    }),

  // =========================================================================
  // Notification Channels
  // =========================================================================

  getChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getChannels(input.accountId, input.tenantId);
    }),

  getEmailChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getEmailChannels(input.accountId, input.tenantId);
    }),

  createEmailChannel: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        emails: z.array(z.string().email()),
        enabled: z.boolean(),
        accountId: z.string(),
        tenantId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createEmailChannel(input);
      await auditLog({
        action: "blackpoint.emailChannel.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `emailChannel:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  getWebhookChannels: protectedProcedure
    .input(z.object({ accountId: z.string(), tenantId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getWebhookChannels(input.accountId, input.tenantId);
    }),

  createWebhookChannel: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        enabled: z.boolean(),
        accountId: z.string(),
        url: z.string().url(),
        apiSecretNameHeader: z.string(),
        headers: z.record(z.unknown()),
        tenantId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createWebhookChannel(input);
      await auditLog({
        action: "blackpoint.webhookChannel.create",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `webhookChannel:${result.id}`,
        detail: { name: input.name, url: input.url },
      });
      return result;
    }),

  testEmailChannel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.testEmailChannel(input.id);
      return { success: true };
    }),

  testWebhookChannel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.testWebhookChannel(input.id);
      return { success: true };
    }),

  // =========================================================================
  // Users
  // =========================================================================

  getUsers: protectedProcedure
    .input(
      z.object({
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getUsers(input.skip, input.take);
    }),

  getAccountUsers: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getAccountUsers(input.accountId, input.skip, input.take);
    }),

  getTenantUsers: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        tenantId: z.string(),
        skip: z.number().min(0).default(0),
        take: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getTenantUsers(input.accountId, input.tenantId, input.skip, input.take);
    }),

  // =========================================================================
  // Contact Groups
  // =========================================================================

  getContactGroups: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroups(input.accountId);
    }),

  getContactGroupById: protectedProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroupById(input.accountId, input.contactGroupId);
    }),

  getContactGroupMembers: protectedProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      return bp.getContactGroupMembers(input.accountId, input.contactGroupId);
    }),

  createContactGroup: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        name: z.string(),
        type: z.enum(["Informational", "Urgent", "Urgent & Informational"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      const result = await bp.createContactGroup(input.accountId, {
        name: input.name,
        type: input.type,
      });
      await auditLog({
        action: "blackpoint.contactGroup.create",
        category: "API",
        actorId: ctx.user.id,
        resource: `contactGroup:${result.id}`,
        detail: { name: input.name },
      });
      return result;
    }),

  deleteContactGroup: protectedProcedure
    .input(z.object({ accountId: z.string(), contactGroupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const bp = await getBP(ctx.prisma);
      await bp.deleteContactGroup(input.accountId, input.contactGroupId);
      await auditLog({
        action: "blackpoint.contactGroup.delete",
        category: "API",
        actorId: ctx.user.id,
        resource: `contactGroup:${input.contactGroupId}`,
      });
      return { success: true };
    }),

  // =========================================================================
  // Health Check
  // =========================================================================

  healthCheck: protectedProcedure.query(async ({ ctx }) => {
    const bp = await getBP(ctx.prisma);
    return bp.healthCheck();
  }),
});
