/**
 * RMM Router — tRPC procedures for device monitoring and management.
 *
 * Uses IRmmConnector via ConnectorFactory — never imports NinjaOne directly.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { auditLog } from "@/lib/audit";

export const rmmRouter = router({
  // ─── Devices ─────────────────────────────────────────────

  getDevices: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        status: z.enum(["online", "offline"]).optional(),
        deviceType: z.string().optional(),
        os: z.string().optional(),
        searchTerm: z.string().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDevices(
        {
          organizationId: input.organizationId,
          status: input.status,
          deviceType: input.deviceType,
          os: input.os,
          searchTerm: input.searchTerm,
        },
        input.cursor,
        input.pageSize
      );
    }),

  getDeviceById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceById(input.id);
    }),

  getDeviceCustomFields: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceCustomFields(input.id);
    }),

  // ─── Alerts ──────────────────────────────────────────────

  getAlerts: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
        severity: z.string().optional(),
        status: z.string().optional(),
        deviceId: z.string().optional(),
        createdAfter: z.date().optional(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getAlerts(
        {
          organizationId: input.organizationId,
          severity: input.severity,
          status: input.status,
          deviceId: input.deviceId,
          createdAfter: input.createdAfter,
        },
        input.cursor,
        input.pageSize
      );
    }),

  acknowledgeAlert: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      await rmm.acknowledgeAlert(input.id);

      await auditLog({
        action: "rmm.alert.acknowledged",
        category: "API",
        actorId: ctx.user.id,
        resource: `alert:${input.id}`,
      });

      return { success: true };
    }),

  // ─── Organizations ───────────────────────────────────────

  getOrganizations: protectedProcedure
    .input(z.object({ searchTerm: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getOrganizations(input.searchTerm);
    }),

  getOrganizationById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getOrganizationById(input.id);
    }),

  // ─── Software & Patches ─────────────────────────────────

  getDeviceSoftware: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceSoftware(input.deviceId);
    }),

  getDevicePatches: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDevicePatches(input.deviceId);
    }),

  getDeviceWindowsServices: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceWindowsServices(input.deviceId);
    }),

  // ─── Activities ──────────────────────────────────────────

  getDeviceActivities: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        cursor: z.string().optional(),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const rmm = await ConnectorFactory.get("rmm", ctx.prisma);
      return rmm.getDeviceActivities(
        input.deviceId,
        input.cursor,
        input.pageSize
      );
    }),
});
