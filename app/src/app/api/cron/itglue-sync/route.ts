/**
 * Cron API Route — triggers IT Glue data sync.
 *
 * Caches IT Glue organizations, asset types, password categories,
 * and asset metadata locally for search and permission UI.
 *
 * POST /api/cron/itglue-sync
 * Header: Authorization: Bearer <CRON_SECRET>
 * Body (optional): { "mode": "full" | "incremental" }
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runITGlueSync } from "@/server/services/itglue-sync";
import { auditLog } from "@/lib/audit";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
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

  // Parse optional mode from body
  let mode: "full" | "incremental" = "full";
  try {
    const body = await request.json();
    if (body?.mode === "incremental") mode = "incremental";
  } catch {
    // No body or invalid JSON — default to full
  }

  const result = await runITGlueSync(prisma, mode);

  await auditLog({
    action: "cron.itglue_sync.executed",
    category: "SYSTEM",
    detail: {
      mode,
      success: result.success,
      orgsUpserted: result.orgs.upserted,
      assetTypesUpserted: result.assetTypes.upserted,
      passwordCategoriesUpserted: result.passwordCategories.upserted,
      assetsUpserted: result.assets.upserted,
      durationMs: result.durationMs,
      error: result.error,
    },
  });

  return NextResponse.json(result);
}
