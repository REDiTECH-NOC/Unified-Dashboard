/**
 * Connector Registry — maps toolId to its connector class and metadata.
 *
 * To add a new connector (e.g., Datto RMM replacing NinjaOne):
 * 1. Create app/src/server/connectors/datto/ directory
 * 2. Implement IRmmConnector interface
 * 3. Add entry here with toolId "datto"
 * 4. Configure "datto" credentials in Settings > Integrations
 * 5. The factory automatically uses whichever RMM tool has status "connected"
 */

import type { ConnectorConfig } from "./_base/types";
import { ConnectWisePsaConnector } from "./connectwise/connector";
import { NinjaOneRmmConnector } from "./ninjaone/connector";
import { SentinelOneEdrConnector } from "./sentinelone/connector";
import { ItGlueDocumentationConnector } from "./itglue/connector";
import { UnifiNetworkConnector } from "./unifi/connector";

export type ConnectorCategory = "psa" | "rmm" | "edr" | "documentation" | "network";

export interface ConnectorRegistration {
  category: ConnectorCategory;
  defaultBaseUrl: string;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  factory: (config: ConnectorConfig) => unknown;
}

export const CONNECTOR_REGISTRY: Record<string, ConnectorRegistration> = {
  connectwise: {
    category: "psa",
    defaultBaseUrl: "https://api-na.myconnectwise.net/v4_6_release/apis/3.0",
    rateLimitMax: 55,
    rateLimitWindowMs: 60_000,
    factory: (config) => new ConnectWisePsaConnector(config),
  },

  ninjaone: {
    category: "rmm",
    defaultBaseUrl: "https://app.ninjarmm.com/api/v2",
    factory: (config) => new NinjaOneRmmConnector(config),
  },

  sentinelone: {
    category: "edr",
    defaultBaseUrl: "", // Always from config — tenant-specific
    factory: (config) => new SentinelOneEdrConnector(config),
  },

  itglue: {
    category: "documentation",
    defaultBaseUrl: "https://api.itglue.com",
    rateLimitMax: 550,
    rateLimitWindowMs: 60_000,
    factory: (config) => new ItGlueDocumentationConnector(config),
  },

  unifi: {
    category: "network",
    defaultBaseUrl: "https://api.ui.com",
    rateLimitMax: 150,
    rateLimitWindowMs: 60_000,
    factory: (config) => new UnifiNetworkConnector(config),
  },
};
