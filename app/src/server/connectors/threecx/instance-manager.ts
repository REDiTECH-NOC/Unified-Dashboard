// @ts-nocheck — Phase 5 scaffolding; depends on ThreecxInstance Prisma model not yet in schema
/**
 * ThreecxInstanceManager — manages connector instances for multiple PBXs.
 *
 * This is the 3CX equivalent of ConnectorFactory, but instance-aware.
 * Maintains a cache of ThreecxConnector instances keyed by instance ID.
 *
 * Usage in tRPC routers:
 *   const pbx = await ThreecxInstanceManager.get(instanceId, ctx.prisma);
 *   const status = await pbx.getSystemStatus();
 */

import type { PrismaClient } from "@prisma/client";
import { ThreecxConnector } from "./connector";
import { decrypt } from "@/lib/crypto";

const instanceCache = new Map<
  string,
  { connector: ThreecxConnector; configHash: string }
>();

export class ThreecxInstanceManager {
  /** Get a connector for a specific PBX instance */
  static async get(
    instanceId: string,
    prisma: PrismaClient
  ): Promise<ThreecxConnector> {
    const instance = await prisma.threecxInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance || !instance.isActive) {
      throw new Error(`3CX instance ${instanceId} not found or inactive`);
    }

    // Check cache — invalidate if config changed (updatedAt hash)
    const configHash = `${instance.fqdn}:${instance.extensionNumber}:${instance.updatedAt.getTime()}`;
    const cached = instanceCache.get(instanceId);
    if (cached && cached.configHash === configHash) {
      return cached.connector;
    }

    // Decrypt password and create new connector
    const password = decrypt(instance.encryptedPassword);
    const connector = new ThreecxConnector(
      instance.id,
      instance.fqdn,
      instance.extensionNumber,
      password
    );

    instanceCache.set(instanceId, { connector, configHash });
    return connector;
  }

  /** Get connectors for ALL active instances (for batch polling / dashboard) */
  static async getAll(
    prisma: PrismaClient
  ): Promise<Array<{ instanceId: string; name: string; connector: ThreecxConnector }>> {
    const instances = await prisma.threecxInstance.findMany({
      where: { isActive: true },
      select: { id: true, name: true, fqdn: true, extensionNumber: true, encryptedPassword: true, updatedAt: true },
    });

    const results: Array<{ instanceId: string; name: string; connector: ThreecxConnector }> = [];

    for (const inst of instances) {
      const configHash = `${inst.fqdn}:${inst.extensionNumber}:${inst.updatedAt.getTime()}`;
      const cached = instanceCache.get(inst.id);

      if (cached && cached.configHash === configHash) {
        results.push({ instanceId: inst.id, name: inst.name, connector: cached.connector });
      } else {
        const password = decrypt(inst.encryptedPassword);
        const connector = new ThreecxConnector(
          inst.id,
          inst.fqdn,
          inst.extensionNumber,
          password
        );
        instanceCache.set(inst.id, { connector, configHash });
        results.push({ instanceId: inst.id, name: inst.name, connector });
      }
    }

    return results;
  }

  /** Invalidate a specific instance's cached connector */
  static invalidate(instanceId: string): void {
    instanceCache.delete(instanceId);
  }

  /** Invalidate all cached connectors */
  static invalidateAll(): void {
    instanceCache.clear();
  }
}
