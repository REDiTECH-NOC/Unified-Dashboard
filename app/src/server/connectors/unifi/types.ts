/**
 * UniFi API response types.
 *
 * Two API layers:
 * 1. Site Manager API (cloud): /ea/* — high-level monitoring across all sites
 * 2. Network Server API (via Cloud Connector): per-console management (~67 endpoints)
 *
 * Prefixes:
 * - Unifi* = Site Manager API types
 * - Ns*   = Network Server API types
 */

// ═══════════════════════════════════════════════════════════════════
// SITE MANAGER API TYPES (api.ui.com /ea/*)
// ═══════════════════════════════════════════════════════════════════

// ─── Common response wrapper ─────────────────────────────────────────

export interface UnifiApiResponse<T> {
  data: T[];
  httpStatusCode: number;
  traceId: string;
}

// ─── Hosts (consoles/controllers) ─────────────────────────────────────

export interface UnifiHost {
  hardwareId?: string;
  id: string;
  ipAddress?: string;
  isBlocked: boolean;
  lastConnectionStateChange?: string;
  latestBackupTime?: string;
  owner: boolean;
  registrationTime?: string;
  reportedState?: {
    firmware?: string;
    hostname?: string;
    name?: string;
    [key: string]: unknown;
  };
  type?: string;
  userData?: {
    name?: string;
    email?: string;
    [key: string]: unknown;
  };
}

export type UnifiHostResponse = UnifiApiResponse<UnifiHost>;

// ─── Sites ────────────────────────────────────────────────────────────

export interface UnifiSite {
  hostId: string;
  isOwner: boolean;
  meta: {
    desc?: string;
    gatewayMac?: string;
    name: string;
    timezone?: string;
  };
  permission: string;
  siteId: string;
  statistics?: Record<string, unknown>;
  subscriptionEndTime?: string;
}

export type UnifiSiteResponse = UnifiApiResponse<UnifiSite>;

// ─── Devices ──────────────────────────────────────────────────────────

export interface UnifiDevice {
  adoptionTime?: string | null;
  firmwareStatus: string;
  id: string;
  ip?: string;
  isConsole: boolean;
  isManaged: boolean;
  mac: string;
  model: string;
  name?: string;
  note?: string | null;
  productLine: string;
  shortname: string;
  startupTime?: string;
  status: string;
  uidb?: {
    guid?: string;
    id?: string;
    images?: Record<string, unknown>;
  };
  updateAvailable?: string | null;
  version: string;
}

/** Devices are grouped by host in the API response */
export interface UnifiDeviceGroup {
  devices: UnifiDevice[];
  hostId: string;
  hostName: string;
  updatedAt: string;
}

export type UnifiDeviceResponse = UnifiApiResponse<UnifiDeviceGroup>;

// ─── ISP Metrics ──────────────────────────────────────────────────────

export interface UnifiIspMetrics {
  ispName?: string;
  latency?: number;
  download?: number;
  upload?: number;
  packetLoss?: number;
  uptime?: number;
  periodStart?: string;
  periodEnd?: string;
  [key: string]: unknown;
}

export type UnifiIspMetricsResponse = UnifiApiResponse<UnifiIspMetrics>;


// ═══════════════════════════════════════════════════════════════════
// NETWORK SERVER API TYPES (via Cloud Connector proxy)
// Proxy path: /v1/connector/consoles/{hostId}/proxy/network/integration/v1/*
// ═══════════════════════════════════════════════════════════════════

// ─── Paginated Response Wrapper ──────────────────────────────────────

export interface NsPaginatedResponse<T> {
  offset: number;
  limit: number;
  count: number;
  totalCount: number;
  data: T[];
}

// ─── Common Pagination Params ────────────────────────────────────────

export interface NsPaginationParams {
  offset?: number;
  limit?: number;
  /** Structured filter: property.function(args) — e.g., name.contains("office") */
  filter?: string;
  /** Sort expression: e.g., "name" or "-lastSeen" */
  sort?: string;
}

// ─── Application Info ────────────────────────────────────────────────

export interface NsAppInfo {
  name?: string;
  version?: string;
  build?: string;
  [key: string]: unknown;
}

// ─── Local Site ──────────────────────────────────────────────────────

export interface NsLocalSite {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

// ─── Device (detailed, from Network Server) ──────────────────────────

export interface NsDevice {
  id: string;
  mac: string;
  model: string;
  name?: string;
  type?: string;
  ip?: string;
  version?: string;
  state?: string;
  adopted?: boolean;
  disabled?: boolean;
  upgradeable?: boolean;
  uptime?: number;
  lastSeen?: string;
  connectedAt?: string;
  siteId?: string;
  configNetwork?: {
    type?: string;
    ip?: string;
    [key: string]: unknown;
  };
  features?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NsDeviceStatistics {
  deviceId?: string;
  uplink?: {
    type?: string;
    speed?: number;
    fullDuplex?: boolean;
    ip?: string;
    gateway?: string;
    [key: string]: unknown;
  };
  system?: {
    cpu?: number;
    mem?: number;
    uptime?: number;
    temps?: Record<string, number>;
    [key: string]: unknown;
  };
  ports?: Array<{
    idx?: number;
    name?: string;
    speed?: number;
    rxBytes?: number;
    txBytes?: number;
    poeEnabled?: boolean;
    poePower?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface NsDeviceAction {
  action: "restart" | "upgrade" | "locate" | "power-cycle" | (string & {});
  [key: string]: unknown;
}

export interface NsDevicePort {
  idx: number;
  name?: string;
  enabled?: boolean;
  speed?: number;
  duplex?: string;
  poeMode?: string;
  mediaType?: string;
  [key: string]: unknown;
}

export interface NsDevicePortAction {
  portIdx: number;
  action: "power-cycle" | (string & {});
  [key: string]: unknown;
}

export interface NsPendingDevice {
  id: string;
  mac: string;
  model?: string;
  name?: string;
  ip?: string;
  type?: string;
  [key: string]: unknown;
}

// ─── Client ──────────────────────────────────────────────────────────

export interface NsClient {
  id: string;
  mac: string;
  ip?: string;
  hostname?: string;
  name?: string;
  type?: "WIRED" | "WIRELESS" | (string & {});
  network?: string;
  uplinkMac?: string;
  uplinkDeviceId?: string;
  firstSeen?: string;
  lastSeen?: string;
  txBytes?: number;
  rxBytes?: number;
  txPackets?: number;
  rxPackets?: number;
  blocked?: boolean;
  noted?: boolean;
  fixedIp?: string;
  satisfaction?: number;
  wifiExperience?: number;
  signalStrength?: number;
  channel?: number;
  radioName?: string;
  essid?: string;
  vlan?: number;
  oui?: string;
  [key: string]: unknown;
}

export interface NsClientAction {
  action: "kick" | "block" | "unblock" | "authorize" | "unauthorize" | (string & {});
  [key: string]: unknown;
}

// ─── Network (VLAN configuration) ────────────────────────────────────

export interface NsNetwork {
  id: string;
  name: string;
  purpose?: "corporate" | "guest" | "remote-user-vpn" | "vlan-only" | "wan" | (string & {});
  vlan?: number;
  subnet?: string;
  dhcpEnabled?: boolean;
  dhcpStart?: string;
  dhcpStop?: string;
  dhcpLeasetime?: number;
  dhcpDns?: string[];
  domain?: string;
  igmpSnooping?: boolean;
  enabled?: boolean;
  networkGroup?: string;
  gatewayIp?: string;
  gatewayMac?: string;
  [key: string]: unknown;
}

export interface NsNetworkReference {
  id: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

// ─── WiFi Broadcast ──────────────────────────────────────────────────

export interface NsWifi {
  id: string;
  name: string;
  enabled?: boolean;
  security?: "wpapsk" | "wpaeap" | "open" | (string & {});
  wpaMode?: "wpa2" | "wpa3" | "wpa2wpa3" | (string & {});
  wlanBand?: "2g" | "5g" | "6g" | "both" | (string & {});
  networkId?: string;
  isGuest?: boolean;
  broadcastEnabled?: boolean;
  macFilterEnabled?: boolean;
  macFilterPolicy?: string;
  radiusProfileId?: string;
  schedule?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Hotspot Voucher ─────────────────────────────────────────────────

export interface NsVoucher {
  id: string;
  code?: string;
  duration?: number;
  dataLimit?: number;
  downloadLimit?: number;
  uploadLimit?: number;
  quota?: number;
  used?: number;
  note?: string;
  createTime?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  [key: string]: unknown;
}

// ─── Firewall Zone ───────────────────────────────────────────────────

export interface NsFirewallZone {
  id: string;
  name: string;
  interfaces?: string[];
  networkIds?: string[];
  [key: string]: unknown;
}

// ─── Firewall Policy ─────────────────────────────────────────────────

export interface NsFirewallPolicy {
  id: string;
  name: string;
  enabled?: boolean;
  action?: "ALLOW" | "DROP" | "REJECT" | (string & {});
  sourceZoneId?: string;
  destinationZoneId?: string;
  protocol?: string;
  sourceAddress?: string;
  sourceAddressGroup?: string;
  destinationAddress?: string;
  destinationAddressGroup?: string;
  sourcePort?: string;
  destinationPort?: string;
  index?: number;
  logging?: boolean;
  stateNew?: boolean;
  stateEstablished?: boolean;
  stateRelated?: boolean;
  stateInvalid?: boolean;
  description?: string;
  [key: string]: unknown;
}

// ─── ACL Rule ────────────────────────────────────────────────────────

export interface NsAclRule {
  id: string;
  name: string;
  enabled?: boolean;
  action?: "ALLOW" | "DENY" | (string & {});
  source?: {
    zoneId?: string;
    address?: string;
    networkId?: string;
    [key: string]: unknown;
  };
  destination?: {
    zoneId?: string;
    address?: string;
    networkId?: string;
    [key: string]: unknown;
  };
  protocol?: string;
  port?: string;
  index?: number;
  description?: string;
  [key: string]: unknown;
}

export interface NsAclReference {
  id: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

// ─── DNS Policy ──────────────────────────────────────────────────────

export interface NsDnsPolicy {
  id: string;
  name: string;
  enabled?: boolean;
  servers?: string[];
  filterCategories?: string[];
  clientIds?: string[];
  networkIds?: string[];
  description?: string;
  [key: string]: unknown;
}

// ─── Traffic Matching List ───────────────────────────────────────────

export interface NsTrafficMatchingList {
  id: string;
  name: string;
  type?: "IP" | "DOMAIN" | "APP" | (string & {});
  entries?: Array<{
    value?: string;
    port?: number;
    protocol?: string;
    [key: string]: unknown;
  }>;
  description?: string;
  [key: string]: unknown;
}

// ─── WAN ─────────────────────────────────────────────────────────────

export interface NsWan {
  id: string;
  name: string;
  provider?: string;
  type?: string;
  enabled?: boolean;
  ip?: string;
  gateway?: string;
  dns?: string[];
  vlan?: number;
  [key: string]: unknown;
}

// ─── VPN Tunnel ──────────────────────────────────────────────────────

export interface NsVpnTunnel {
  id: string;
  name: string;
  type?: "site-to-site" | "remote-access" | (string & {});
  status?: string;
  enabled?: boolean;
  peerAddress?: string;
  localNetworks?: string[];
  remoteNetworks?: string[];
  [key: string]: unknown;
}

// ─── RADIUS Profile ──────────────────────────────────────────────────

export interface NsRadiusProfile {
  id: string;
  name: string;
  authServer?: string;
  authPort?: number;
  acctServer?: string;
  acctPort?: number;
  [key: string]: unknown;
}

// ─── Device Tag ──────────────────────────────────────────────────────

export interface NsDeviceTag {
  id: string;
  name: string;
  deviceIds?: string[];
  [key: string]: unknown;
}

// ─── DPI Application ─────────────────────────────────────────────────

export interface NsDpiApp {
  id: string;
  name: string;
  category?: string;
  [key: string]: unknown;
}

// ─── Country ─────────────────────────────────────────────────────────

export interface NsCountry {
  code: string;
  name: string;
  [key: string]: unknown;
}

// ─── Reorder Request ─────────────────────────────────────────────────

export interface NsReorderRequest {
  ids: string[];
}
