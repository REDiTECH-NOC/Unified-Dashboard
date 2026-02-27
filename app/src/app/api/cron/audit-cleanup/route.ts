/**
 * Cron API Route — deletes audit log entries older than the configured retention period.
 *
 * Called by external scheduler (n8n, Azure cron, or crontab).
 * Protected by shared secret in CRON_SECRET env var.
 *
 * POST /api/cron/audit-cleanup
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  try {
    // Read retention config
    const config = await prisma.auditRetentionConfig.findFirst();
    if (!config?.autoCleanupEnabled) {
      return NextResponse.json({
        skipped: true,
        reason: "auto_cleanup_disabled",
        deleted: 0,
      });
    }

    const retentionDays = config.retentionDays;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Count how many will be deleted (for reporting)
    const expiredCount = await prisma.auditEvent.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    if (expiredCount === 0) {
      return NextResponse.json({
        skipped: false,
        reason: "no_expired_events",
        deleted: 0,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    // Delete in batches to avoid long-running transactions
    const BATCH_SIZE = 5000;
    let totalDeleted = 0;

    while (totalDeleted < expiredCount) {
      const batch = await prisma.auditEvent.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });
      totalDeleted += batch.count;
      if (batch.count === 0) break;
      if (batch.count < BATCH_SIZE) break;
    }

    // Update config with cleanup stats
    await prisma.auditRetentionConfig.update({
      where: { id: config.id },
      data: {
        lastCleanupAt: new Date(),
        lastCleanupCount: totalDeleted,
      },
    });

    // Log the cleanup itself
    await auditLog({
      action: "cron.audit_cleanup.executed",
      category: "SYSTEM",
      detail: {
        deleted: totalDeleted,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
    });

    console.log(
      `[CRON:audit-cleanup] Deleted ${totalDeleted} audit events older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`
    );

    return NextResponse.json({
      skipped: false,
      deleted: totalDeleted,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (err) {
    console.error("[CRON:audit-cleanup] Error:", err);
    await auditLog({
      action: "cron.audit_cleanup.failed",
      category: "SYSTEM",
      outcome: "failure",
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Audit cleanup failed", details: String(err) },
      { status: 500 }
    );
  }
}
