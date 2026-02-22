/**
 * UniFi Network Connector — implements INetworkConnector + full Network Server API.
 *
 * Two API layers:
 * 1. Site Manager API (cloud) — INetworkConnector methods for cross-site monitoring
 * 2. Network Server API (Cloud Connector proxy) — per-console management (~67 endpoints)
 *
 * Cloud Connector proxies requests to a specific console via:
 *   /v1/connector/consoles/{hostId}/proxy/network/integration/v1/{path}
 */

import type { ConnectorConfig } from "../_base/types";
import type {
  INetworkConnector,
  NetworkSite,
  NetworkHost,
  IspMetrics,
  NetworkSummary,
} from "../_interfaces/network";
import type { NormalizedDevice } from "../_interfaces/common";
import { UnifiClient } from "./client";
import type {
  UnifiHostResponse,
  UnifiSiteResponse,
  UnifiDeviceResponse,
  UnifiIspMetricsResponse,
  // Network Server API types
  NsPaginatedResponse,
  NsPaginationParams,
  NsAppInfo,
  NsLocalSite,
  NsDevice,
  NsDeviceStatistics,
  NsDeviceAction,
  NsDevicePort,
  NsDevicePortAction,
  NsPendingDevice,
  NsClient,
  NsClientAction,
  NsNetwork,
  NsNetworkReference,
  NsWifi,
  NsVoucher,
  NsFirewallZone,
  NsFirewallPolicy,
  NsAclRule,
  NsAclReference,
  NsDnsPolicy,
  NsTrafficMatchingList,
  NsWan,
  NsVpnTunnel,
  NsRadiusProfile,
  NsDeviceTag,
  NsDpiApp,
  NsCountry,
} from "./types";
import { mapDevice, mapSite, mapHost } from "./mappers";

// Type alias for pagination params passthrough
type Params = Record<string, unknown> | undefined;

export class UnifiNetworkConnector implements INetworkConnector {
  public client: UnifiClient;

  constructor(config: ConnectorConfig) {
    this.client = new UnifiClient(config);
  }

  // ═══════════════════════════════════════════════════════════════
  // SITE MANAGER API (cloud) — INetworkConnector implementation
  // ═══════════════════════════════════════════════════════════════

  async getSites(): Promise<NetworkSite[]> {
    const response = await this.client.cloudGet<UnifiSiteResponse>("/ea/sites");
    return (response.data ?? []).map(mapSite);
  }

  async getHosts(): Promise<NetworkHost[]> {
    const response = await this.client.cloudGet<UnifiHostResponse>("/ea/hosts");
    return (response.data ?? []).map(mapHost);
  }

  async getDevices(hostIds?: string[]): Promise<NormalizedDevice[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (hostIds?.length) {
      params["hostIds"] = hostIds.join(",");
    }

    const response = await this.client.cloudGet<UnifiDeviceResponse>(
      "/ea/devices",
      params
    );

    const devices: NormalizedDevice[] = [];
    for (const group of response.data ?? []) {
      for (const device of group.devices ?? []) {
        devices.push(mapDevice(device, group.hostId, group.hostName));
      }
    }
    return devices;
  }

  async getIspMetrics(hostId: string): Promise<IspMetrics> {
    const response = await this.client.cloudGet<UnifiIspMetricsResponse>(
      "/ea/isp-metrics",
      { hostId }
    );

    const metrics = response.data?.[0];
    return {
      hostId,
      latencyMs: metrics?.latency,
      downloadMbps: metrics?.download,
      uploadMbps: metrics?.upload,
      packetLossPercent: metrics?.packetLoss,
      uptimePercent: metrics?.uptime,
      periodStart: metrics?.periodStart
        ? new Date(metrics.periodStart)
        : undefined,
      periodEnd: metrics?.periodEnd
        ? new Date(metrics.periodEnd)
        : undefined,
      _raw: metrics,
    };
  }

  async getSummary(): Promise<NetworkSummary> {
    const [sites, hosts, devices] = await Promise.all([
      this.getSites(),
      this.getHosts(),
      this.getDevices(),
    ]);

    return {
      totalSites: sites.length,
      totalHosts: hosts.length,
      totalDevices: devices.length,
      devicesOnline: devices.filter((d) => d.status === "online").length,
      devicesOffline: devices.filter((d) => d.status === "offline").length,
      devicesPendingUpdate: devices.filter(
        (d) =>
          (d.metadata as Record<string, unknown>)?.updateAvailable != null
      ).length,
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }

  // ═══════════════════════════════════════════════════════════════
  // NETWORK SERVER API (via Cloud Connector proxy)
  // All methods require a hostId to route to the correct console.
  // ═══════════════════════════════════════════════════════════════

  // ─── Application Info ──────────────────────────────────────────

  async getAppInfo(hostId: string): Promise<NsAppInfo> {
    return this.client.proxyGet<NsAppInfo>(hostId, "info");
  }

  // ─── Local Sites ───────────────────────────────────────────────

  async getLocalSites(hostId: string): Promise<NsLocalSite[]> {
    const res = await this.client.proxyGet<NsPaginatedResponse<NsLocalSite>>(
      hostId,
      "sites"
    );
    return res.data;
  }

  // ─── Devices (detailed) ────────────────────────────────────────

  async listLocalDevices(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsDevice>> {
    return this.client.proxyGet<NsPaginatedResponse<NsDevice>>(
      hostId,
      "devices",
      params as Params
    );
  }

  async getLocalDevice(hostId: string, deviceId: string): Promise<NsDevice> {
    return this.client.proxyGet<NsDevice>(hostId, `devices/${deviceId}`);
  }

  async getDeviceStats(
    hostId: string,
    deviceId: string
  ): Promise<NsDeviceStatistics> {
    return this.client.proxyGet<NsDeviceStatistics>(
      hostId,
      `devices/${deviceId}/statistics/latest`
    );
  }

  async deviceAction(
    hostId: string,
    deviceId: string,
    action: NsDeviceAction
  ): Promise<void> {
    await this.client.proxyPost(hostId, `devices/${deviceId}/actions`, action);
  }

  async listPendingDevices(
    hostId: string
  ): Promise<NsPaginatedResponse<NsPendingDevice>> {
    return this.client.proxyGet<NsPaginatedResponse<NsPendingDevice>>(
      hostId,
      "devices/pending"
    );
  }

  async adoptDevice(hostId: string, deviceId: string): Promise<void> {
    await this.client.proxyPost(hostId, `devices/${deviceId}/adopt`);
  }

  async getDevicePorts(
    hostId: string,
    deviceId: string
  ): Promise<NsDevicePort[]> {
    const res = await this.client.proxyGet<NsPaginatedResponse<NsDevicePort>>(
      hostId,
      `devices/${deviceId}/ports`
    );
    return res.data;
  }

  async devicePortAction(
    hostId: string,
    deviceId: string,
    action: NsDevicePortAction
  ): Promise<void> {
    await this.client.proxyPost(
      hostId,
      `devices/${deviceId}/ports/actions`,
      action
    );
  }

  // ─── Clients ───────────────────────────────────────────────────

  async listClients(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsClient>> {
    return this.client.proxyGet<NsPaginatedResponse<NsClient>>(
      hostId,
      "clients",
      params as Params
    );
  }

  async getClient(hostId: string, clientId: string): Promise<NsClient> {
    return this.client.proxyGet<NsClient>(hostId, `clients/${clientId}`);
  }

  async clientAction(
    hostId: string,
    clientId: string,
    action: NsClientAction
  ): Promise<void> {
    await this.client.proxyPost(
      hostId,
      `clients/${clientId}/actions`,
      action
    );
  }

  // ─── Networks ──────────────────────────────────────────────────

  async listNetworks(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsNetwork>> {
    return this.client.proxyGet<NsPaginatedResponse<NsNetwork>>(
      hostId,
      "networks",
      params as Params
    );
  }

  async getNetwork(hostId: string, networkId: string): Promise<NsNetwork> {
    return this.client.proxyGet<NsNetwork>(hostId, `networks/${networkId}`);
  }

  async createNetwork(
    hostId: string,
    data: Partial<NsNetwork>
  ): Promise<NsNetwork> {
    return this.client.proxyPost<NsNetwork>(hostId, "networks", data);
  }

  async updateNetwork(
    hostId: string,
    networkId: string,
    data: Partial<NsNetwork>
  ): Promise<NsNetwork> {
    return this.client.proxyPut<NsNetwork>(
      hostId,
      `networks/${networkId}`,
      data
    );
  }

  async deleteNetwork(hostId: string, networkId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `networks/${networkId}`);
  }

  async getNetworkReferences(
    hostId: string
  ): Promise<NsNetworkReference[]> {
    const res = await this.client.proxyGet<
      NsPaginatedResponse<NsNetworkReference>
    >(hostId, "networks/references");
    return res.data;
  }

  // ─── WiFi Broadcasts ──────────────────────────────────────────

  async listWifi(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsWifi>> {
    return this.client.proxyGet<NsPaginatedResponse<NsWifi>>(
      hostId,
      "wifi",
      params as Params
    );
  }

  async getWifi(hostId: string, wifiId: string): Promise<NsWifi> {
    return this.client.proxyGet<NsWifi>(hostId, `wifi/${wifiId}`);
  }

  async createWifi(hostId: string, data: Partial<NsWifi>): Promise<NsWifi> {
    return this.client.proxyPost<NsWifi>(hostId, "wifi", data);
  }

  async updateWifi(
    hostId: string,
    wifiId: string,
    data: Partial<NsWifi>
  ): Promise<NsWifi> {
    return this.client.proxyPut<NsWifi>(hostId, `wifi/${wifiId}`, data);
  }

  async deleteWifi(hostId: string, wifiId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `wifi/${wifiId}`);
  }

  // ─── Hotspot Vouchers ──────────────────────────────────────────

  async listVouchers(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsVoucher>> {
    return this.client.proxyGet<NsPaginatedResponse<NsVoucher>>(
      hostId,
      "hotspot/vouchers",
      params as Params
    );
  }

  async getVoucher(hostId: string, voucherId: string): Promise<NsVoucher> {
    return this.client.proxyGet<NsVoucher>(
      hostId,
      `hotspot/vouchers/${voucherId}`
    );
  }

  async createVoucher(
    hostId: string,
    data: Partial<NsVoucher>
  ): Promise<NsVoucher> {
    return this.client.proxyPost<NsVoucher>(hostId, "hotspot/vouchers", data);
  }

  async updateVoucher(
    hostId: string,
    voucherId: string,
    data: Partial<NsVoucher>
  ): Promise<NsVoucher> {
    return this.client.proxyPut<NsVoucher>(
      hostId,
      `hotspot/vouchers/${voucherId}`,
      data
    );
  }

  async deleteVoucher(hostId: string, voucherId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `hotspot/vouchers/${voucherId}`);
  }

  // ─── Firewall Zones ────────────────────────────────────────────

  async listFirewallZones(
    hostId: string
  ): Promise<NsPaginatedResponse<NsFirewallZone>> {
    return this.client.proxyGet<NsPaginatedResponse<NsFirewallZone>>(
      hostId,
      "firewall/zones"
    );
  }

  async getFirewallZone(
    hostId: string,
    zoneId: string
  ): Promise<NsFirewallZone> {
    return this.client.proxyGet<NsFirewallZone>(
      hostId,
      `firewall/zones/${zoneId}`
    );
  }

  async createFirewallZone(
    hostId: string,
    data: Partial<NsFirewallZone>
  ): Promise<NsFirewallZone> {
    return this.client.proxyPost<NsFirewallZone>(
      hostId,
      "firewall/zones",
      data
    );
  }

  async updateFirewallZone(
    hostId: string,
    zoneId: string,
    data: Partial<NsFirewallZone>
  ): Promise<NsFirewallZone> {
    return this.client.proxyPut<NsFirewallZone>(
      hostId,
      `firewall/zones/${zoneId}`,
      data
    );
  }

  async deleteFirewallZone(hostId: string, zoneId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `firewall/zones/${zoneId}`);
  }

  async reorderFirewallZones(
    hostId: string,
    ids: string[]
  ): Promise<void> {
    await this.client.proxyPut(hostId, "firewall/zones/reorder", { ids });
  }

  // ─── Firewall Policies ─────────────────────────────────────────

  async listFirewallPolicies(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsFirewallPolicy>> {
    return this.client.proxyGet<NsPaginatedResponse<NsFirewallPolicy>>(
      hostId,
      "firewall/policies",
      params as Params
    );
  }

  async getFirewallPolicy(
    hostId: string,
    policyId: string
  ): Promise<NsFirewallPolicy> {
    return this.client.proxyGet<NsFirewallPolicy>(
      hostId,
      `firewall/policies/${policyId}`
    );
  }

  async createFirewallPolicy(
    hostId: string,
    data: Partial<NsFirewallPolicy>
  ): Promise<NsFirewallPolicy> {
    return this.client.proxyPost<NsFirewallPolicy>(
      hostId,
      "firewall/policies",
      data
    );
  }

  async updateFirewallPolicy(
    hostId: string,
    policyId: string,
    data: Partial<NsFirewallPolicy>
  ): Promise<NsFirewallPolicy> {
    return this.client.proxyPut<NsFirewallPolicy>(
      hostId,
      `firewall/policies/${policyId}`,
      data
    );
  }

  async deleteFirewallPolicy(
    hostId: string,
    policyId: string
  ): Promise<void> {
    await this.client.proxyDelete(hostId, `firewall/policies/${policyId}`);
  }

  async reorderFirewallPolicies(
    hostId: string,
    ids: string[]
  ): Promise<void> {
    await this.client.proxyPut(hostId, "firewall/policies/reorder", { ids });
  }

  // ─── ACL Rules ─────────────────────────────────────────────────

  async listAclRules(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsAclRule>> {
    return this.client.proxyGet<NsPaginatedResponse<NsAclRule>>(
      hostId,
      "acl/rules",
      params as Params
    );
  }

  async getAclRule(hostId: string, ruleId: string): Promise<NsAclRule> {
    return this.client.proxyGet<NsAclRule>(hostId, `acl/rules/${ruleId}`);
  }

  async createAclRule(
    hostId: string,
    data: Partial<NsAclRule>
  ): Promise<NsAclRule> {
    return this.client.proxyPost<NsAclRule>(hostId, "acl/rules", data);
  }

  async updateAclRule(
    hostId: string,
    ruleId: string,
    data: Partial<NsAclRule>
  ): Promise<NsAclRule> {
    return this.client.proxyPut<NsAclRule>(
      hostId,
      `acl/rules/${ruleId}`,
      data
    );
  }

  async deleteAclRule(hostId: string, ruleId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `acl/rules/${ruleId}`);
  }

  async reorderAclRules(hostId: string, ids: string[]): Promise<void> {
    await this.client.proxyPut(hostId, "acl/rules/reorder", { ids });
  }

  async getAclReferences(hostId: string): Promise<NsAclReference[]> {
    const res = await this.client.proxyGet<
      NsPaginatedResponse<NsAclReference>
    >(hostId, "acl/rules/references");
    return res.data;
  }

  // ─── DNS Policies ──────────────────────────────────────────────

  async listDnsPolicies(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsDnsPolicy>> {
    return this.client.proxyGet<NsPaginatedResponse<NsDnsPolicy>>(
      hostId,
      "dns/policies",
      params as Params
    );
  }

  async getDnsPolicy(hostId: string, policyId: string): Promise<NsDnsPolicy> {
    return this.client.proxyGet<NsDnsPolicy>(
      hostId,
      `dns/policies/${policyId}`
    );
  }

  async createDnsPolicy(
    hostId: string,
    data: Partial<NsDnsPolicy>
  ): Promise<NsDnsPolicy> {
    return this.client.proxyPost<NsDnsPolicy>(hostId, "dns/policies", data);
  }

  async updateDnsPolicy(
    hostId: string,
    policyId: string,
    data: Partial<NsDnsPolicy>
  ): Promise<NsDnsPolicy> {
    return this.client.proxyPut<NsDnsPolicy>(
      hostId,
      `dns/policies/${policyId}`,
      data
    );
  }

  async deleteDnsPolicy(hostId: string, policyId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `dns/policies/${policyId}`);
  }

  // ─── Traffic Matching Lists ────────────────────────────────────

  async listTrafficMatchingLists(
    hostId: string,
    params?: NsPaginationParams
  ): Promise<NsPaginatedResponse<NsTrafficMatchingList>> {
    return this.client.proxyGet<NsPaginatedResponse<NsTrafficMatchingList>>(
      hostId,
      "traffic/matching-lists",
      params as Params
    );
  }

  async getTrafficMatchingList(
    hostId: string,
    listId: string
  ): Promise<NsTrafficMatchingList> {
    return this.client.proxyGet<NsTrafficMatchingList>(
      hostId,
      `traffic/matching-lists/${listId}`
    );
  }

  async createTrafficMatchingList(
    hostId: string,
    data: Partial<NsTrafficMatchingList>
  ): Promise<NsTrafficMatchingList> {
    return this.client.proxyPost<NsTrafficMatchingList>(
      hostId,
      "traffic/matching-lists",
      data
    );
  }

  async updateTrafficMatchingList(
    hostId: string,
    listId: string,
    data: Partial<NsTrafficMatchingList>
  ): Promise<NsTrafficMatchingList> {
    return this.client.proxyPut<NsTrafficMatchingList>(
      hostId,
      `traffic/matching-lists/${listId}`,
      data
    );
  }

  async deleteTrafficMatchingList(
    hostId: string,
    listId: string
  ): Promise<void> {
    await this.client.proxyDelete(hostId, `traffic/matching-lists/${listId}`);
  }

  // ─── Supporting Resources ──────────────────────────────────────

  async listWans(
    hostId: string
  ): Promise<NsPaginatedResponse<NsWan>> {
    return this.client.proxyGet<NsPaginatedResponse<NsWan>>(hostId, "wans");
  }

  async listVpnTunnels(
    hostId: string
  ): Promise<NsPaginatedResponse<NsVpnTunnel>> {
    return this.client.proxyGet<NsPaginatedResponse<NsVpnTunnel>>(
      hostId,
      "vpn/tunnels"
    );
  }

  async listRadiusProfiles(
    hostId: string
  ): Promise<NsPaginatedResponse<NsRadiusProfile>> {
    return this.client.proxyGet<NsPaginatedResponse<NsRadiusProfile>>(
      hostId,
      "radius/profiles"
    );
  }

  async listDeviceTags(
    hostId: string
  ): Promise<NsPaginatedResponse<NsDeviceTag>> {
    return this.client.proxyGet<NsPaginatedResponse<NsDeviceTag>>(
      hostId,
      "devices/tags"
    );
  }

  async createDeviceTag(
    hostId: string,
    data: Partial<NsDeviceTag>
  ): Promise<NsDeviceTag> {
    return this.client.proxyPost<NsDeviceTag>(hostId, "devices/tags", data);
  }

  async updateDeviceTag(
    hostId: string,
    tagId: string,
    data: Partial<NsDeviceTag>
  ): Promise<NsDeviceTag> {
    return this.client.proxyPut<NsDeviceTag>(
      hostId,
      `devices/tags/${tagId}`,
      data
    );
  }

  async deleteDeviceTag(hostId: string, tagId: string): Promise<void> {
    await this.client.proxyDelete(hostId, `devices/tags/${tagId}`);
  }

  async listDpiApps(
    hostId: string
  ): Promise<NsPaginatedResponse<NsDpiApp>> {
    return this.client.proxyGet<NsPaginatedResponse<NsDpiApp>>(
      hostId,
      "dpi/apps"
    );
  }

  async listCountries(
    hostId: string
  ): Promise<NsPaginatedResponse<NsCountry>> {
    return this.client.proxyGet<NsPaginatedResponse<NsCountry>>(
      hostId,
      "countries"
    );
  }
}
