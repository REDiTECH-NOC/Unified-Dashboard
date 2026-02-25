/**
 * Fleet Refresh Service — orchestrates sequential refresh of all NinjaOne
 * fleet query endpoints, respecting rate limits (10 req / 10 min).
 *
 * Triggered by:
 * - Admin "Refresh Now" button
 * - /api/cron/fleet-refresh route (called by external cron/n8n)
 * - Stale-while-revalidate pattern when cached data is requested
 */

import { ConnectorFactory } from "../connectors/factory";
import { NinjaOneRmmConnector } from "../connectors/ninjaone/connector";
import {
  setFleetData,
  isFleetRefreshInProgress,
  setFleetRefreshInProgress,
  FLEET_ENDPOINTS,
  type FleetEndpoint,
} from "@/lib/fleet-cache";
import type { PrismaClient } from "@prisma/client";

/** How long to wait between API calls (ms). 60s = safe within 10 req / 10 min. */
const INTER_REQUEST_DELAY_MS = 60_000;

export interface FleetRefreshResult {
  success: boolean;
  refreshed: FleetEndpoint[];
  failed: Array<{ endpoint: FleetEndpoint; error: string }>;
  durationMs: number;
}

/**
 * Get the NinjaOne connector cast to the specific class (for fleet query methods).
 */
async function getNinjaConnector(
  prisma: PrismaClient
): Promise<NinjaOneRmmConnector> {
  const connector = await ConnectorFactory.get("rmm", prisma);
  return connector as NinjaOneRmmConnector;
}

/**
 * Map a FleetEndpoint key to the corresponding connector method call.
 */
async function fetchEndpointData(
  connector: NinjaOneRmmConnector,
  endpoint: FleetEndpoint
): Promise<unknown[]> {
  switch (endpoint) {
    case "device-health":
      return connector.queryDeviceHealth();
    case "processors":
      return connector.queryProcessors();
    case "volumes":
      return connector.queryVolumes();
    case "operating-systems":
      return connector.queryOperatingSystems();
    case "computer-systems":
      return connector.queryComputerSystems();
    case "software":
      return connector.querySoftware();
    case "antivirus-status":
      return connector.queryAntivirusStatus();
    case "antivirus-threats":
      return connector.queryAntivirusThreats();
    case "os-patch-installs":
      return connector.queryOsPatchInstalls();
    case "backup-jobs":
      return connector.queryBackupJobs();
  }
}

/**
 * Refresh all fleet query endpoints sequentially.
 * Spaces API calls 60s apart to respect NinjaOne rate limits.
 *
 * @param prisma — Prisma client for connector factory
 * @param endpoints — specific endpoints to refresh (default: all)
 * @param skipDelay — skip inter-request delay (use for single endpoint refresh)
 */
export async function refreshFleetData(
  prisma: PrismaClient,
  endpoints?: FleetEndpoint[],
  skipDelay = false
): Promise<FleetRefreshResult> {
  // Prevent concurrent refreshes
  if (await isFleetRefreshInProgress()) {
    return {
      success: false,
      refreshed: [],
      failed: [{ endpoint: "device-health", error: "Refresh already in progress" }],
      durationMs: 0,
    };
  }

  await setFleetRefreshInProgress(true);
  const startTime = Date.now();
  const toRefresh = endpoints ?? FLEET_ENDPOINTS;
  const refreshed: FleetEndpoint[] = [];
  const failed: Array<{ endpoint: FleetEndpoint; error: string }> = [];

  try {
    const connector = await getNinjaConnector(prisma);

    for (let i = 0; i < toRefresh.length; i++) {
      const endpoint = toRefresh[i];
      try {
        const data = await fetchEndpointData(connector, endpoint);
        await setFleetData(endpoint, data);
        refreshed.push(endpoint);
      } catch (error) {
        failed.push({
          endpoint,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Wait between requests to respect rate limits (skip on last item)
      if (!skipDelay && i < toRefresh.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS));
      }
    }
  } finally {
    await setFleetRefreshInProgress(false);
  }

  return {
    success: failed.length === 0,
    refreshed,
    failed,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Refresh a single fleet endpoint (no delay, no lock contention).
 */
export async function refreshSingleEndpoint(
  prisma: PrismaClient,
  endpoint: FleetEndpoint
): Promise<{ success: boolean; error?: string }> {
  try {
    const connector = await getNinjaConnector(prisma);
    const data = await fetchEndpointData(connector, endpoint);
    await setFleetData(endpoint, data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
