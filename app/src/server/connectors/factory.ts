/**
 * Connector Factory — resolves tool categories to live connector instances.
 *
 * Usage in tRPC routers:
 *   const psa = await ConnectorFactory.get("psa", ctx.prisma);
 *   const tickets = await psa.getTickets();
 *
 * The factory:
 * 1. Queries IntegrationConfig for the active connector in the given category
 * 2. Loads credentials from the config JSONB
 * 3. Instantiates (or returns cached) connector instance
 * 4. Auto-invalidates cache when config changes (via config hash)
 */

import type { PrismaClient } from "@prisma/client";
import type { IPsaConnector } from "./_interfaces/psa";
import type { IRmmConnector } from "./_interfaces/rmm";
import type { IEdrConnector } from "./_interfaces/edr";
import type { IDocumentationConnector } from "./_interfaces/documentation";
import type { INetworkConnector } from "./_interfaces/network";
import { ConnectorNotConfiguredError } from "./_base/errors";
import type { ConnectorConfig } from "./_base/types";
import { CONNECTOR_REGISTRY, type ConnectorCategory } from "./registry";

type ConnectorTypeMap = {
  psa: IPsaConnector;
  rmm: IRmmConnector;
  edr: IEdrConnector;
  documentation: IDocumentationConnector;
  network: INetworkConnector;
};

/** Cached connector instances keyed by toolId */
const instanceCache = new Map<
  string,
  { instance: unknown; configHash: string }
>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export class ConnectorFactory {
  /**
   * Get the active connector for a given category.
   * Returns the most recently updated "connected" tool in that category.
   */
  static async get<C extends ConnectorCategory>(
    category: C,
    prisma: PrismaClient
  ): Promise<ConnectorTypeMap[C]> {
    // Find all connected tools in this category
    const configs = await prisma.integrationConfig.findMany({
      where: { category, status: "connected" },
      orderBy: { updatedAt: "desc" },
    });

    if (configs.length === 0) {
      throw new ConnectorNotConfiguredError(category);
    }

    const activeConfig = configs[0];
    return this.instantiate<C>(activeConfig.toolId, activeConfig.config);
  }

  /**
   * Get a connector by specific toolId (not by category).
   * Used when you need a specific tool regardless of what's "active".
   */
  static async getByToolId<C extends ConnectorCategory>(
    toolId: string,
    prisma: PrismaClient
  ): Promise<ConnectorTypeMap[C]> {
    const config = await prisma.integrationConfig.findUnique({
      where: { toolId },
    });

    if (!config || config.status !== "connected") {
      throw new ConnectorNotConfiguredError(toolId);
    }

    return this.instantiate<C>(toolId, config.config);
  }

  /**
   * Instantiate or return cached connector instance.
   */
  private static instantiate<C extends ConnectorCategory>(
    toolId: string,
    configJson: unknown
  ): ConnectorTypeMap[C] {
    const registration = CONNECTOR_REGISTRY[toolId];
    if (!registration) {
      throw new ConnectorNotConfiguredError(toolId);
    }

    // Check cache
    const configStr = JSON.stringify(configJson ?? {});
    const configHash = simpleHash(configStr);

    const cached = instanceCache.get(toolId);
    if (cached && cached.configHash === configHash) {
      return cached.instance as ConnectorTypeMap[C];
    }

    // Parse credentials from JSONB config
    const parsedConfig = (configJson ?? {}) as Record<string, string>;
    const connectorConfig: ConnectorConfig = {
      toolId,
      baseUrl: parsedConfig.baseUrl ?? registration.defaultBaseUrl,
      credentials: parsedConfig,
      rateLimitMax: registration.rateLimitMax,
      rateLimitWindowMs: registration.rateLimitWindowMs,
    };

    // Create new instance
    const instance = registration.factory(connectorConfig);
    instanceCache.set(toolId, { instance, configHash });

    return instance as ConnectorTypeMap[C];
  }

  /** Invalidate cached instance (call after credential update) */
  static invalidate(toolId: string): void {
    instanceCache.delete(toolId);
  }

  /** Invalidate all cached instances */
  static invalidateAll(): void {
    instanceCache.clear();
  }
}
