/**
 * Network Connector Interface — for UniFi, WatchGuard, and future network tools.
 *
 * Provides visibility into network infrastructure: sites, devices (APs, switches,
 * gateways), ISP health metrics, and console/controller status.
 */

import type { NormalizedDevice } from "./common";
import type { HealthCheckResult } from "../_base/types";

// ─── Network-specific normalized types ────────────────────────────────

/** A managed network site/location */
export interface NetworkSite {
  sourceToolId: string;
  siteId: string;
  hostId: string;
  name: string;
  description?: string;
  timezone?: string;
  gatewayMac?: string;
  permission?: string;
  isOwner?: boolean;
  _raw?: unknown;
}

/** A network console/controller (e.g., UniFi Dream Machine, Cloud Key) */
export interface NetworkHost {
  sourceToolId: string;
  id: string;
  name?: string;
  ipAddress?: string;
  type?: string;
  isBlocked?: boolean;
  isOwner?: boolean;
  lastConnectionStateChange?: Date;
  latestBackupTime?: Date;
  registrationTime?: Date;
  firmwareVersion?: string;
  _raw?: unknown;
}

/** ISP health metrics for a specific host/site */
export interface IspMetrics {
  hostId: string;
  /** Average latency in ms */
  latencyMs?: number;
  /** Average download speed in Mbps */
  downloadMbps?: number;
  /** Average upload speed in Mbps */
  uploadMbps?: number;
  /** Packet loss percentage (0-100) */
  packetLossPercent?: number;
  /** Uptime percentage (0-100) */
  uptimePercent?: number;
  /** Data period */
  periodStart?: Date;
  periodEnd?: Date;
  _raw?: unknown;
}

/** Aggregated network summary stats */
export interface NetworkSummary {
  totalSites: number;
  totalHosts: number;
  totalDevices: number;
  devicesOnline: number;
  devicesOffline: number;
  devicesPendingUpdate: number;
}

// ─── Interface ────────────────────────────────────────────────────────

export interface INetworkConnector {
  /** List all managed sites */
  getSites(): Promise<NetworkSite[]>;

  /** List all consoles/controllers */
  getHosts(): Promise<NetworkHost[]>;

  /** List all network devices, optionally filtered by host IDs */
  getDevices(hostIds?: string[]): Promise<NormalizedDevice[]>;

  /** Get ISP health metrics for a specific host */
  getIspMetrics(hostId: string): Promise<IspMetrics>;

  /** Get aggregated summary stats */
  getSummary(): Promise<NetworkSummary>;

  /** Health check for the connection */
  healthCheck(): Promise<HealthCheckResult>;
}
