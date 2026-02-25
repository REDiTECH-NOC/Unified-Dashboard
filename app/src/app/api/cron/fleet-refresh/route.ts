/**
 * Cron API Route — triggers fleet data refresh from NinjaOne.
 *
 * Called by external scheduler (n8n, Azure cron, or crontab).
 * Protected by shared secret in CRON_SECRET env var.
 *
 * POST /api/cron/fleet-refresh
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshFleetData } from "@/server/services/fleet-refresh";

/** Timing-safe comparison of two secret strings */
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  // Validate cron secret — return generic 401 for all failure cases
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !timingSafeCompare(token, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshFleetData(prisma);
  return NextResponse.json(result);
}
