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
  // Uptime alerts are now handled directly by the UptimeScheduler on state
  // transitions (incident-based). No polling needed here.

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

/**
 * Match alerts to CW companies and open tickets.
 * For each alert, resolves the company via fuzzy name match on the local
 * Company table, then searches for open CW tickets matching that company
 * + hostname. Results are persisted to AlertState for instant UI display.
 * Non-fatal: individual alert failures are skipped.
 */
async function matchAlertsToTickets(alerts: AlertItem[]): Promise<number> {
  let matched = 0;

  for (const alert of alerts) {
    try {
      // Skip if already has a linked ticket
      const existing = await prisma.alertState.findUnique({
        where: { alertId: alert.id },
        select: { linkedTicketId: true },
      });
      if (existing?.linkedTicketId) continue;

      // Step 1: Resolve CW company ID
      let cwCompanyId: string | null = null;
      let matchedCompanyName: string | null = null;

      if (alert.organizationName) {
        const company = await prisma.company.findFirst({
          where: {
            name: { contains: alert.organizationName, mode: "insensitive" },
            status: "Active",
          },
        });
        if (company?.psaSourceId) {
          cwCompanyId = company.psaSourceId;
          matchedCompanyName = company.name;
        }
      }

      // Always upsert the company match (even if no ticket found yet)
      await prisma.alertState.upsert({
        where: { alertId: alert.id },
        create: {
          alertId: alert.id,
          source: alert.source,
          matchedCompanyId: cwCompanyId,
          matchedCompanyName,
        },
        update: {
          // Only overwrite if we found a match (don't erase existing)
          ...(cwCompanyId ? { matchedCompanyId: cwCompanyId, matchedCompanyName } : {}),
        },
      });

      if (!cwCompanyId) continue;

      // Step 2: Search for matching open tickets
      const psa = await ConnectorFactory.get("psa", prisma);
      const result = await psa.getTickets(
        {
          companyId: cwCompanyId,
          searchTerm: alert.deviceHostname || undefined,
        },
        1,
        5
      );

      const openTickets = result.data.filter(
        (t) => !["Closed", "Resolved", "Completed"].includes(t.status)
      );

      if (openTickets.length > 0) {
        const ticket = openTickets[0];
        await prisma.alertState.update({
          where: { alertId: alert.id },
          data: {
            linkedTicketId: ticket.sourceId,
            linkedTicketSummary: ticket.summary,
            matchMethod: "cron_auto",
            matchedAt: new Date(),
          },
        });
        matched++;
      }
    } catch {
      // Individual alert matching failure — skip and continue
    }
  }

  return matched;
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

    // Match alerts to CW companies and open tickets
    let ticketsMatched = 0;
    try {
      ticketsMatched = await matchAlertsToTickets(alerts);
    } catch (err) {
      console.error("[CRON:alert-check] Ticket matching error:", err);
    }

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
      `[CRON:alert-check] ${alerts.length} alerts checked, ${ticketsMatched} tickets matched, ${notified} notifications sent, ${skipped} skipped. ${elapsed}ms`
    );

    await auditLog({
      action: "cron.alert_check.executed",
      category: "SYSTEM",
      detail: { alertsChecked: alerts.length, ticketsMatched, notificationsSent: notified, skipped, elapsedMs: elapsed },
    });

    return NextResponse.json({
      success: true,
      alertsChecked: alerts.length,
      ticketsMatched,
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
