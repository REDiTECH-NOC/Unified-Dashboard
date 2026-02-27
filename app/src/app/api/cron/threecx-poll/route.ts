/**
 * Cron API Route — polls all active 3CX PBX instances and updates cached
 * status fields in the database (version, extensions, trunks, calls, etc.).
 *
 * Called by external scheduler every 5 minutes.
 * Protected by shared secret in CRON_SECRET env var.
 *
 * GET /api/cron/threecx-poll
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ThreecxInstanceManager } from "@/server/connectors/threecx/instance-manager";
import { auditLog } from "@/lib/audit";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: Request) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !timingSafeCompare(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active instances
  const instances = await prisma.threecxInstance.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      fqdn: true,
      extensionNumber: true,
      encryptedPassword: true,
      updatedAt: true,
    },
  });

  if (instances.length === 0) {
    return NextResponse.json({ polled: 0, online: 0, offline: 0, errors: [] });
  }

  const results = await Promise.allSettled(
    instances.map(async (inst) => {
      try {
        const connector = await ThreecxInstanceManager.get(inst.id, prisma);
        const status = await connector.getSystemStatus();

        await prisma.threecxInstance.update({
          where: { id: inst.id },
          data: {
            status: "online",
            version: status.version,
            os: status.os,
            callsActive: status.callsActive,
            extensionsRegistered: status.extensionsRegistered,
            extensionsTotal: status.extensionsTotal,
            userExtensions: status.userExtensions,
            maxUserExtensions: status.maxUserExtensions,
            trunksRegistered: status.trunksRegistered,
            trunksTotal: status.trunksTotal,
            diskUsagePercent: status.diskUsagePercent,
            hasFailedServices: status.hasNotRunningServices,
            productCode: status.productCode ?? null,
            maxSimCalls: status.maxSimCalls,
            expirationDate: status.expirationDate
              ? new Date(status.expirationDate)
              : undefined,
            maintenanceExpiresAt: status.maintenanceExpiresAt
              ? new Date(status.maintenanceExpiresAt)
              : undefined,
            lastHealthCheck: new Date(),
            lastSeenAt: new Date(),
          },
        });

        return { id: inst.id, name: inst.name, ok: true };
      } catch (error) {
        await prisma.threecxInstance.update({
          where: { id: inst.id },
          data: {
            status: "offline",
            lastHealthCheck: new Date(),
          },
        });

        return {
          id: inst.id,
          name: inst.name,
          ok: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
    })
  );

  const settled = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { id: "unknown", name: "unknown", ok: false, error: "Promise rejected" }
  );

  const summary = {
    polled: settled.length,
    online: settled.filter((r) => r.ok).length,
    offline: settled.filter((r) => !r.ok).length,
    errors: settled.filter((r) => !r.ok),
  };

  await auditLog({
    action: "cron.threecx_poll.executed",
    category: "SYSTEM",
    detail: { polled: summary.polled, online: summary.online, offline: summary.offline, errorCount: summary.errors.length },
  });

  return NextResponse.json(summary);
}
