/**
 * Network router — UniFi integration.
 *
 * Two API layers:
 * 1. Site Manager API (cloud): getSites, getHosts, getDevices, getIspMetrics, getSummary
 * 2. Network Server API (Cloud Connector): ~67 endpoints via console.* sub-routers
 *
 * All operations audit-logged. Uses ConnectorFactory to resolve the active network connector.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import { UnifiNetworkConnector } from "../connectors/unifi/connector";
import { auditLog } from "@/lib/audit";

// ─── Common Input Schemas ─────────────────────────────────────────

const hostInput = z.object({ hostId: z.string() });

const paginatedHostInput = hostInput.extend({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  filter: z.string().optional(),
  sort: z.string().optional(),
});

// Passthrough body for create/update — UniFi API validates payloads
const dataBody = z.record(z.unknown());

// ─── Helper ────────────────────────────────────────────────────────

async function getUnifi(prisma: Parameters<typeof ConnectorFactory.get>[1]) {
  const connector = await ConnectorFactory.get("network", prisma);
  return connector as unknown as UnifiNetworkConnector;
}

function audit(
  actorId: string,
  action: string,
  resource: string,
  detail?: Record<string, unknown>
) {
  return auditLog({
    action: `network.${action}`,
    category: "API",
    actorId,
    resource: `network:${resource}`,
    detail,
  });
}

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════

export const networkRouter = router({
  // ─── Site Manager API (cloud) ─────────────────────────────────

  getSites: protectedProcedure.query(async ({ ctx }) => {
    const network = await ConnectorFactory.get("network", ctx.prisma);
    const sites = await network.getSites();
    await audit(ctx.user.id, "sites.listed", "sites", { count: sites.length });
    return sites;
  }),

  getHosts: protectedProcedure.query(async ({ ctx }) => {
    const network = await ConnectorFactory.get("network", ctx.prisma);
    const hosts = await network.getHosts();
    await audit(ctx.user.id, "hosts.listed", "hosts", { count: hosts.length });
    return hosts;
  }),

  getDevices: protectedProcedure
    .input(z.object({ hostIds: z.array(z.string()).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const network = await ConnectorFactory.get("network", ctx.prisma);
      const devices = await network.getDevices(input?.hostIds);
      await audit(ctx.user.id, "devices.listed", "devices", {
        count: devices.length,
        hostIds: input?.hostIds,
      });
      return devices;
    }),

  getIspMetrics: protectedProcedure
    .input(z.object({ hostId: z.string() }))
    .query(async ({ ctx, input }) => {
      const network = await ConnectorFactory.get("network", ctx.prisma);
      const metrics = await network.getIspMetrics(input.hostId);
      await audit(ctx.user.id, "isp.metrics", `isp:${input.hostId}`, {
        hostId: input.hostId,
      });
      return metrics;
    }),

  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const network = await ConnectorFactory.get("network", ctx.prisma);
    return network.getSummary();
  }),

  // ═════════════════════════════════════════════════════════════════
  // NETWORK SERVER API (Cloud Connector — per-console operations)
  // ═════════════════════════════════════════════════════════════════

  console: router({
    // ─── Application Info ─────────────────────────────────────────

    getInfo: protectedProcedure.input(hostInput).query(async ({ ctx, input }) => {
      const unifi = await getUnifi(ctx.prisma);
      const info = await unifi.getAppInfo(input.hostId);
      await audit(ctx.user.id, "console.info", `console:${input.hostId}`);
      return info;
    }),

    getLocalSites: protectedProcedure
      .input(hostInput)
      .query(async ({ ctx, input }) => {
        const unifi = await getUnifi(ctx.prisma);
        const sites = await unifi.getLocalSites(input.hostId);
        await audit(ctx.user.id, "console.sites.listed", `console:${input.hostId}`, {
          count: sites.length,
        });
        return sites;
      }),

    // ─── Devices ──────────────────────────────────────────────────

    devices: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          const result = await unifi.listLocalDevices(hostId, params);
          await audit(ctx.user.id, "console.devices.listed", `console:${hostId}`, {
            count: result.count,
            totalCount: result.totalCount,
          });
          return result;
        }),

      get: protectedProcedure
        .input(hostInput.extend({ deviceId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const device = await unifi.getLocalDevice(input.hostId, input.deviceId);
          await audit(ctx.user.id, "console.devices.viewed", `device:${input.deviceId}`, {
            hostId: input.hostId,
          });
          return device;
        }),

      getStats: protectedProcedure
        .input(hostInput.extend({ deviceId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getDeviceStats(input.hostId, input.deviceId);
        }),

      action: protectedProcedure
        .input(
          hostInput.extend({
            deviceId: z.string(),
            action: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deviceAction(input.hostId, input.deviceId, {
            action: input.action,
          });
          await audit(ctx.user.id, "console.devices.action", `device:${input.deviceId}`, {
            hostId: input.hostId,
            action: input.action,
          });
          return { success: true };
        }),

      listPending: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listPendingDevices(input.hostId);
        }),

      adopt: protectedProcedure
        .input(hostInput.extend({ deviceId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.adoptDevice(input.hostId, input.deviceId);
          await audit(ctx.user.id, "console.devices.adopted", `device:${input.deviceId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),

      getPorts: protectedProcedure
        .input(hostInput.extend({ deviceId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getDevicePorts(input.hostId, input.deviceId);
        }),

      portAction: protectedProcedure
        .input(
          hostInput.extend({
            deviceId: z.string(),
            portIdx: z.number(),
            action: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.devicePortAction(input.hostId, input.deviceId, {
            portIdx: input.portIdx,
            action: input.action,
          });
          await audit(ctx.user.id, "console.devices.portAction", `device:${input.deviceId}`, {
            hostId: input.hostId,
            portIdx: input.portIdx,
            action: input.action,
          });
          return { success: true };
        }),
    }),

    // ─── Clients ──────────────────────────────────────────────────

    clients: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          const result = await unifi.listClients(hostId, params);
          await audit(ctx.user.id, "console.clients.listed", `console:${hostId}`, {
            count: result.count,
            totalCount: result.totalCount,
          });
          return result;
        }),

      get: protectedProcedure
        .input(hostInput.extend({ clientId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getClient(input.hostId, input.clientId);
        }),

      action: protectedProcedure
        .input(
          hostInput.extend({
            clientId: z.string(),
            action: z.string(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.clientAction(input.hostId, input.clientId, {
            action: input.action,
          });
          await audit(ctx.user.id, "console.clients.action", `client:${input.clientId}`, {
            hostId: input.hostId,
            action: input.action,
          });
          return { success: true };
        }),
    }),

    // ─── Networks ─────────────────────────────────────────────────

    networks: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listNetworks(hostId, params);
        }),

      get: protectedProcedure
        .input(hostInput.extend({ networkId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getNetwork(input.hostId, input.networkId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createNetwork(input.hostId, input.data);
          await audit(ctx.user.id, "console.networks.created", `network:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ networkId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateNetwork(
            input.hostId,
            input.networkId,
            input.data
          );
          await audit(ctx.user.id, "console.networks.updated", `network:${input.networkId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ networkId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteNetwork(input.hostId, input.networkId);
          await audit(ctx.user.id, "console.networks.deleted", `network:${input.networkId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),

      references: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getNetworkReferences(input.hostId);
        }),
    }),

    // ─── WiFi Broadcasts ──────────────────────────────────────────

    wifi: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listWifi(hostId, params);
        }),

      get: protectedProcedure
        .input(hostInput.extend({ wifiId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getWifi(input.hostId, input.wifiId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createWifi(input.hostId, input.data);
          await audit(ctx.user.id, "console.wifi.created", `wifi:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ wifiId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateWifi(
            input.hostId,
            input.wifiId,
            input.data
          );
          await audit(ctx.user.id, "console.wifi.updated", `wifi:${input.wifiId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ wifiId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteWifi(input.hostId, input.wifiId);
          await audit(ctx.user.id, "console.wifi.deleted", `wifi:${input.wifiId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),
    }),

    // ─── Hotspot Vouchers ─────────────────────────────────────────

    hotspot: router({
      listVouchers: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listVouchers(hostId, params);
        }),

      getVoucher: protectedProcedure
        .input(hostInput.extend({ voucherId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getVoucher(input.hostId, input.voucherId);
        }),

      createVoucher: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createVoucher(input.hostId, input.data);
          await audit(ctx.user.id, "console.hotspot.voucher.created", `voucher:${result.id}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      updateVoucher: protectedProcedure
        .input(hostInput.extend({ voucherId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateVoucher(
            input.hostId,
            input.voucherId,
            input.data
          );
          await audit(ctx.user.id, "console.hotspot.voucher.updated", `voucher:${input.voucherId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      deleteVoucher: protectedProcedure
        .input(hostInput.extend({ voucherId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteVoucher(input.hostId, input.voucherId);
          await audit(ctx.user.id, "console.hotspot.voucher.deleted", `voucher:${input.voucherId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),
    }),

    // ─── Firewall ─────────────────────────────────────────────────

    firewall: router({
      // Zones
      listZones: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listFirewallZones(input.hostId);
        }),

      getZone: protectedProcedure
        .input(hostInput.extend({ zoneId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getFirewallZone(input.hostId, input.zoneId);
        }),

      createZone: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createFirewallZone(input.hostId, input.data);
          await audit(ctx.user.id, "console.firewall.zone.created", `zone:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      updateZone: protectedProcedure
        .input(hostInput.extend({ zoneId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateFirewallZone(
            input.hostId,
            input.zoneId,
            input.data
          );
          await audit(ctx.user.id, "console.firewall.zone.updated", `zone:${input.zoneId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      deleteZone: protectedProcedure
        .input(hostInput.extend({ zoneId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteFirewallZone(input.hostId, input.zoneId);
          await audit(ctx.user.id, "console.firewall.zone.deleted", `zone:${input.zoneId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),

      reorderZones: protectedProcedure
        .input(hostInput.extend({ ids: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.reorderFirewallZones(input.hostId, input.ids);
          await audit(ctx.user.id, "console.firewall.zones.reordered", `console:${input.hostId}`);
          return { success: true };
        }),

      // Policies
      listPolicies: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listFirewallPolicies(hostId, params);
        }),

      getPolicy: protectedProcedure
        .input(hostInput.extend({ policyId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getFirewallPolicy(input.hostId, input.policyId);
        }),

      createPolicy: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createFirewallPolicy(input.hostId, input.data);
          await audit(ctx.user.id, "console.firewall.policy.created", `policy:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      updatePolicy: protectedProcedure
        .input(hostInput.extend({ policyId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateFirewallPolicy(
            input.hostId,
            input.policyId,
            input.data
          );
          await audit(ctx.user.id, "console.firewall.policy.updated", `policy:${input.policyId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      deletePolicy: protectedProcedure
        .input(hostInput.extend({ policyId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteFirewallPolicy(input.hostId, input.policyId);
          await audit(ctx.user.id, "console.firewall.policy.deleted", `policy:${input.policyId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),

      reorderPolicies: protectedProcedure
        .input(hostInput.extend({ ids: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.reorderFirewallPolicies(input.hostId, input.ids);
          await audit(ctx.user.id, "console.firewall.policies.reordered", `console:${input.hostId}`);
          return { success: true };
        }),
    }),

    // ─── ACL Rules ────────────────────────────────────────────────

    acl: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listAclRules(hostId, params);
        }),

      get: protectedProcedure
        .input(hostInput.extend({ ruleId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getAclRule(input.hostId, input.ruleId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createAclRule(input.hostId, input.data);
          await audit(ctx.user.id, "console.acl.created", `acl:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ ruleId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateAclRule(
            input.hostId,
            input.ruleId,
            input.data
          );
          await audit(ctx.user.id, "console.acl.updated", `acl:${input.ruleId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ ruleId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteAclRule(input.hostId, input.ruleId);
          await audit(ctx.user.id, "console.acl.deleted", `acl:${input.ruleId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),

      reorder: protectedProcedure
        .input(hostInput.extend({ ids: z.array(z.string()) }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.reorderAclRules(input.hostId, input.ids);
          await audit(ctx.user.id, "console.acl.reordered", `console:${input.hostId}`);
          return { success: true };
        }),

      references: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getAclReferences(input.hostId);
        }),
    }),

    // ─── DNS Policies ─────────────────────────────────────────────

    dns: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listDnsPolicies(hostId, params);
        }),

      get: protectedProcedure
        .input(hostInput.extend({ policyId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getDnsPolicy(input.hostId, input.policyId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createDnsPolicy(input.hostId, input.data);
          await audit(ctx.user.id, "console.dns.created", `dns:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ policyId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateDnsPolicy(
            input.hostId,
            input.policyId,
            input.data
          );
          await audit(ctx.user.id, "console.dns.updated", `dns:${input.policyId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ policyId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteDnsPolicy(input.hostId, input.policyId);
          await audit(ctx.user.id, "console.dns.deleted", `dns:${input.policyId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),
    }),

    // ─── Traffic Matching Lists ───────────────────────────────────

    traffic: router({
      list: protectedProcedure
        .input(paginatedHostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const { hostId, ...params } = input;
          return unifi.listTrafficMatchingLists(hostId, params);
        }),

      get: protectedProcedure
        .input(hostInput.extend({ listId: z.string() }))
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.getTrafficMatchingList(input.hostId, input.listId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createTrafficMatchingList(input.hostId, input.data);
          await audit(ctx.user.id, "console.traffic.created", `traffic:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ listId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateTrafficMatchingList(
            input.hostId,
            input.listId,
            input.data
          );
          await audit(ctx.user.id, "console.traffic.updated", `traffic:${input.listId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ listId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteTrafficMatchingList(input.hostId, input.listId);
          await audit(ctx.user.id, "console.traffic.deleted", `traffic:${input.listId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),
    }),

    // ─── Supporting Resources ─────────────────────────────────────

    wans: router({
      list: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listWans(input.hostId);
        }),
    }),

    vpn: router({
      list: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listVpnTunnels(input.hostId);
        }),
    }),

    radius: router({
      list: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listRadiusProfiles(input.hostId);
        }),
    }),

    deviceTags: router({
      list: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listDeviceTags(input.hostId);
        }),

      create: protectedProcedure
        .input(hostInput.extend({ data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.createDeviceTag(input.hostId, input.data);
          await audit(ctx.user.id, "console.deviceTags.created", `tag:${result.id}`, {
            hostId: input.hostId,
            name: result.name,
          });
          return result;
        }),

      update: protectedProcedure
        .input(hostInput.extend({ tagId: z.string(), data: dataBody }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          const result = await unifi.updateDeviceTag(
            input.hostId,
            input.tagId,
            input.data
          );
          await audit(ctx.user.id, "console.deviceTags.updated", `tag:${input.tagId}`, {
            hostId: input.hostId,
          });
          return result;
        }),

      delete: protectedProcedure
        .input(hostInput.extend({ tagId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          await unifi.deleteDeviceTag(input.hostId, input.tagId);
          await audit(ctx.user.id, "console.deviceTags.deleted", `tag:${input.tagId}`, {
            hostId: input.hostId,
          });
          return { success: true };
        }),
    }),

    dpi: router({
      listApps: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listDpiApps(input.hostId);
        }),
    }),

    countries: router({
      list: protectedProcedure
        .input(hostInput)
        .query(async ({ ctx, input }) => {
          const unifi = await getUnifi(ctx.prisma);
          return unifi.listCountries(input.hostId);
        }),
    }),
  }),
});
