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
import { BlackpointConnector } from "./blackpoint/connector";
import { CIPPConnector } from "./cipp/connector";
import { AvananEmailSecurityConnector } from "./avanan/connector";
import { CoveBackupConnector } from "./cove/connector";
import { Pax8LicensingConnector } from "./pax8/connector";
import { DropsuiteConnector } from "./dropsuite/connector";
import { DnsFilterConnector } from "./dnsfilter/connector";

export type ConnectorCategory = "psa" | "rmm" | "edr" | "documentation" | "network" | "mdr" | "cipp" | "email_security" | "backup" | "saas_backup" | "licensing" | "dns_security";

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
    rateLimitMax: 10,
    rateLimitWindowMs: 10 * 60_000, // 10 requests per 10 minutes on query endpoints
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

  blackpoint: {
    category: "mdr",
    defaultBaseUrl: "https://api.blackpointcyber.com",
    // BP limits: Users 2,000/hr, Tenants 5,000/hr, Accounts 100,000/24hr
    // 200/min = 12,000/hr — per-tenant lazy loading means fewer burst requests
    rateLimitMax: 200,
    rateLimitWindowMs: 60_000,
    factory: (config) => new BlackpointConnector(config),
  },

  cipp: {
    category: "cipp",
    defaultBaseUrl: "", // Always from config — instance-specific CIPP deployment URL
    factory: (config) => new CIPPConnector(config),
  },

  avanan: {
    category: "email_security",
    defaultBaseUrl: "", // Resolved from region selection (US, EU, CA, AU, UK, UAE, IN)
    rateLimitMax: 60,
    rateLimitWindowMs: 60_000,
    factory: (config) => new AvananEmailSecurityConnector(config),
  },

  cove: {
    category: "backup",
    defaultBaseUrl: "https://api.backup.management/jsonapi",
    rateLimitMax: 30,
    rateLimitWindowMs: 60_000,
    factory: (config) => new CoveBackupConnector(config),
  },

  pax8: {
    category: "licensing",
    defaultBaseUrl: "https://api.pax8.com/v1",
    rateLimitMax: 900, // Official limit 1000/min, keep 10% buffer
    rateLimitWindowMs: 60_000,
    factory: (config) => new Pax8LicensingConnector(config),
  },

  dropsuite: {
    category: "saas_backup",
    defaultBaseUrl: "https://dropsuite.us/api",
    rateLimitMax: 30,
    rateLimitWindowMs: 60_000,
    factory: (config) => new DropsuiteConnector(config),
  },

  dnsfilter: {
    category: "dns_security",
    defaultBaseUrl: "https://api.dnsfilter.com",
    rateLimitMax: 100,
    rateLimitWindowMs: 60_000,
    factory: (config) => new DnsFilterConnector(config),
  },
};
