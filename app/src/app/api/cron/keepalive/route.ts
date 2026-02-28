/**
 * Cron API Route — keeps external service backends warm by hitting
 * authenticated API endpoints that trigger the Functions runtime.
 *
 * Currently warms:
 *  - CIPP (Azure Static Web App with managed Functions — goes cold after ~20min)
 *
 * Called by external scheduler (n8n, Azure cron) every 5 minutes.
 * Protected by shared secret in CRON_SECRET env var.
 *
 * POST /api/cron/keepalive
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ConnectorFactory } from "@/server/connectors/factory";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token || !timingSafeCompare(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Keepalive pings ─────────────────────────────────────────────────
  const results: Record<string, { ok: boolean; latencyMs: number; error?: string }> = {};

  // CIPP — hit ListTenants (lightweight, returns quickly even on cold start)
  try {
    const cipp = await ConnectorFactory.getByToolId("cipp", prisma);
    if (cipp) {
      const start = Date.now();
      const health = await cipp.healthCheck();
      results.cipp = {
        ok: health.ok,
        latencyMs: Date.now() - start,
        ...(health.message ? { error: health.message } : {}),
      };
    } else {
      results.cipp = { ok: false, latencyMs: 0, error: "Not configured" };
    }
  } catch (error) {
    results.cipp = {
      ok: false,
      latencyMs: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json({
    status: allOk ? "all_warm" : "partial",
    timestamp: new Date().toISOString(),
    services: results,
  });
}
