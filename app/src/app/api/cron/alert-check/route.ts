/**
 * Cron API Route — checks all alert sources for new alerts and creates
 * in-app notifications based on per-user preferences.
 *
 * Called by external scheduler (n8n, Azure cron) every 2-5 minutes.
 * Protected by shared secret in CRON_SECRET env var.
 *
 * POST /api/cron/alert-check
 * Header: Authorization: Bearer <CRON_SECRET>
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ConnectorFactory } from "@/server/connectors/factory";
import { notifyUsersForAlert } from "@/lib/notification-engine";
import { auditLog } from "@/lib/audit";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface AlertItem {
  id: string;
  source: string;
  severity: string;
  title: string;
  description?: string;
  deviceHostname?: string;
  organizationName?: string;
}

/**
 * Collect alerts from all configured sources.
 * Non-fatal: if a source fails, we skip it and continue.
 */
async function collectAlerts(): Promise<AlertItem[]> {
  const alerts: AlertItem[] = [];

  // ── SentinelOne ──
  try {
    const edr = await ConnectorFactory.get("edr", prisma);
    const result = await edr.getThreats(undefined, undefined, 50);
    for (const t of result.data) {
      alerts.push({
        id: `s1-${t.sourceId}`,
        source: "sentinelone",
        severity: t.severity,
        title: t.title,
        description: t.description,
        deviceHostname: t.deviceHostname,
        organizationName: t.organizationName,
      });
    }
  } catch {
    // Not configured or API error — skip
  }

  // ── Blackpoint ──
  try {
    const mdr = await ConnectorFactory.get("mdr", prisma);
    const result = await mdr.getDetections(undefined, undefined, 50);
    for (const d of result.data) {
      alerts.push({
        id: `bp-${d.sourceId}`,
        source: "blackpoint",
        severity: d.severity,
        title: d.title,
        description: d.description,
        deviceHostname: d.deviceHostname,
        organizationName: d.organizationName,
      });
    }
  } catch {
    // Not configured or API error — skip
  }

  // ── NinjaRMM ──
  try {
    const rmm = await ConnectorFactory.get("rmm", prisma);
    const result = await rmm.getAlerts(undefined, undefined, 50);
    for (const a of result.data) {
      alerts.push({
        id: `ninja-${a.sourceId}`,
        source: "ninjaone",
        severity: a.severity,
        title: a.title,
        description: a.message,
        deviceHostname: a.deviceHostname,
        organizationName: a.organizationName,
      });
    }
  } catch {
    // Not configured or API error — skip
  }

  // ── Uptime Monitors ──
  try {
    const monitors = await prisma.monitor.findMany({
      where: { active: true, status: { in: ["DOWN", "PENDING"] } },
      include: { company: { select: { name: true } } },
    });
    for (const m of monitors) {
      const isDown = m.status === "DOWN";
      alerts.push({
        id: `uptime-${m.id}`,
        source: "uptime",
        severity: isDown ? "critical" : "medium",
        title: `${m.name} is ${m.status}`,
        description: m.description || undefined,
        organizationName: m.company?.name,
      });
    }
  } catch {
    // DB error — skip
  }

  // ── Cove Backup ──
  try {
    const backup = await ConnectorFactory.get("backup", prisma);
    const result = await backup.getActiveAlerts();
    for (const a of result as {
      sourceId: string; title: string; severity: string;
      deviceHostname?: string; organizationName?: string;
    }[]) {
      alerts.push({
        id: `cove-${a.sourceId}`,
        source: "cove",
        severity: a.severity ?? "medium",
        title: a.title,
        deviceHostname: a.deviceHostname,
        organizationName: a.organizationName,
      });
    }
  } catch {
    // Not configured or API error — skip
  }

  return alerts;
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

  const startTime = Date.now();

  try {
    const alerts = await collectAlerts();
    let notified = 0;
    let skipped = 0;

    for (const alert of alerts) {
      const count = await notifyUsersForAlert(alert);
      if (count > 0) {
        notified += count;
      } else {
        skipped++;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[CRON:alert-check] ${alerts.length} alerts checked, ${notified} notifications sent, ${skipped} skipped (already seen or no matching prefs). ${elapsed}ms`
    );

    await auditLog({
      action: "cron.alert_check.executed",
      category: "SYSTEM",
      detail: { alertsChecked: alerts.length, notificationsSent: notified, skipped, elapsedMs: elapsed },
    });

    return NextResponse.json({
      success: true,
      alertsChecked: alerts.length,
      notificationsSent: notified,
      skipped,
      elapsedMs: elapsed,
    });
  } catch (err) {
    console.error("[CRON:alert-check] Error:", err);
    await auditLog({
      action: "cron.alert_check.failed",
      category: "SYSTEM",
      outcome: "failure",
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Alert check failed", details: String(err) },
      { status: 500 }
    );
  }
}
