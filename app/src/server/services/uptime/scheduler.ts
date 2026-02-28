import type { Monitor, MonitorStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getExecutor } from "./executors/registry";
import type { ExecutorResult } from "./types";
import { notifyUsersForAlert } from "@/lib/notification-engine";
import { auditLog } from "@/lib/audit";

export class UptimeScheduler {
  private timers = new Map<string, NodeJS.Timeout>();
  private retryCounters = new Map<string, number>();
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const monitors = await prisma.monitor.findMany({
        where: { active: true },
      });

      for (const monitor of monitors) {
        this.scheduleMonitor(monitor);
      }

      console.log(
        `[UPTIME] Monitoring engine started with ${monitors.length} active monitors`
      );
    } catch (error) {
      console.error("[UPTIME] Failed to start monitoring engine:", error);
      this.running = false;
    }
  }

  async stop(): Promise<void> {
    for (const [id, timer] of Array.from(this.timers)) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    this.retryCounters.clear();
    this.running = false;
    console.log("[UPTIME] Monitoring engine stopped");
  }

  scheduleMonitor(monitor: Monitor): void {
    // Clear existing timer if any
    this.unscheduleMonitor(monitor.id);

    // Run first check immediately
    this.executeCheck(monitor.id).catch((err) => {
      console.error(`[UPTIME] Initial check failed for ${monitor.id}:`, err);
    });

    // Schedule recurring checks
    const timer = setInterval(() => {
      this.executeCheck(monitor.id).catch((err) => {
        console.error(`[UPTIME] Check failed for ${monitor.id}:`, err);
      });
    }, monitor.intervalSeconds * 1000);

    this.timers.set(monitor.id, timer);
  }

  unscheduleMonitor(monitorId: string): void {
    const timer = this.timers.get(monitorId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(monitorId);
    }
    this.retryCounters.delete(monitorId);
  }

  async rescheduleMonitor(monitorId: string): Promise<void> {
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
    });
    if (monitor && monitor.active) {
      this.scheduleMonitor(monitor);
    } else {
      this.unscheduleMonitor(monitorId);
    }
  }

  private async executeCheck(monitorId: string): Promise<void> {
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
    });

    if (!monitor || !monitor.active) {
      this.unscheduleMonitor(monitorId);
      return;
    }

    const executor = getExecutor(monitor.type);
    const config = (monitor.config as Record<string, unknown>) || {};

    let result: ExecutorResult;
    try {
      result = await executor.execute(config, monitor.timeoutMs);
    } catch (error) {
      result = {
        status: "DOWN",
        latencyMs: 0,
        message: `Executor error: ${(error as Error).message}`,
      };
    }

    // Determine final user-visible status
    const retryCount = this.retryCounters.get(monitorId) || 0;
    let finalStatus: MonitorStatus;
    let isRetrying = false;
    let warningReasons: string[] = [];

    if (result.status === "DOWN") {
      if (retryCount < monitor.maxRetries) {
        // Still in retry phase — keep the current visible status, don't expose PENDING
        this.retryCounters.set(monitorId, retryCount + 1);
        isRetrying = true;
        // Preserve whatever the monitor was showing before
        finalStatus = monitor.status === "PENDING" || monitor.status === "UNKNOWN"
          ? "UNKNOWN"
          : monitor.status;
      } else {
        // Max retries exceeded — confirmed DOWN
        finalStatus = "DOWN";
      }
    } else {
      // Check succeeded — reset retry counter
      this.retryCounters.set(monitorId, 0);

      // Evaluate WARNING conditions
      if (monitor.latencyWarningMs && result.latencyMs > monitor.latencyWarningMs) {
        warningReasons.push(`high_latency:${result.latencyMs}ms>${monitor.latencyWarningMs}ms`);
      }
      if (
        monitor.packetLossWarningPct &&
        result.packetLoss !== undefined &&
        result.packetLoss > 0 &&
        result.packetLoss > monitor.packetLossWarningPct
      ) {
        warningReasons.push(`packet_loss:${result.packetLoss}%>${monitor.packetLossWarningPct}%`);
      }

      finalStatus = warningReasons.length > 0 ? "WARNING" : "UP";
    }

    // Write heartbeat — record PENDING for retries (raw internal data)
    const heartbeatStatus: MonitorStatus = isRetrying ? "PENDING" : finalStatus;

    await prisma.heartbeat.create({
      data: {
        monitorId: monitor.id,
        status: heartbeatStatus,
        latencyMs: result.latencyMs,
        message: result.message,
        tlsInfo: result.tlsInfo
          ? (result.tlsInfo as unknown as Prisma.InputJsonValue)
          : undefined,
        dnsResult: result.dnsResult
          ? (result.dnsResult as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    // Handle status transitions and incidents (only on actual visible changes)
    if (!isRetrying) {
      const isStatusChange = monitor.status !== finalStatus;

      if (isStatusChange) {
        await this.handleStatusTransition(monitor, finalStatus, result, warningReasons);
      }

      // Update monitor status
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          status: finalStatus,
          lastCheckedAt: new Date(),
          ...(isStatusChange ? { lastStatusChange: new Date() } : {}),
        },
      });
    } else {
      // During retry phase, only update lastCheckedAt
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { lastCheckedAt: new Date() },
      });
    }

    // If retry, temporarily reschedule to retrySeconds interval
    if (result.status === "DOWN" && retryCount < monitor.maxRetries) {
      const existingTimer = this.timers.get(monitorId);
      if (existingTimer) {
        clearInterval(existingTimer);
      }
      // Schedule a single retry
      const retryTimer = setTimeout(() => {
        this.executeCheck(monitorId).catch((err) => {
          console.error(`[UPTIME] Retry check failed for ${monitorId}:`, err);
        });
        // After retry, restore normal interval
        if (this.timers.has(monitorId)) {
          const normalTimer = setInterval(() => {
            this.executeCheck(monitorId).catch((err) => {
              console.error(`[UPTIME] Check failed for ${monitorId}:`, err);
            });
          }, monitor.intervalSeconds * 1000);
          this.timers.set(monitorId, normalTimer);
        }
      }, monitor.retrySeconds * 1000);
      this.timers.set(monitorId, retryTimer as unknown as NodeJS.Timeout);
    }
  }

  /**
   * Handle a user-visible status transition: create/close incidents and send alerts.
   */
  private async handleStatusTransition(
    monitor: Monitor,
    newStatus: MonitorStatus,
    result: ExecutorResult,
    warningReasons: string[]
  ): Promise<void> {
    const now = new Date();

    // 1. Close any open incident for this monitor (recovery or status change)
    if (monitor.status === "DOWN" || monitor.status === "WARNING") {
      const openIncident = await prisma.monitorIncident.findFirst({
        where: { monitorId: monitor.id, resolvedAt: null },
        orderBy: { startedAt: "desc" },
      });

      if (openIncident) {
        const durationSecs = Math.round(
          (now.getTime() - openIncident.startedAt.getTime()) / 1000
        );
        await prisma.monitorIncident.update({
          where: { id: openIncident.id },
          data: { resolvedAt: now, durationSecs, recoverySentAt: now },
        });

        // Send recovery notification only for DOWN → UP/WARNING transitions
        if (openIncident.status === "DOWN" && newStatus !== "DOWN") {
          await this.sendRecoveryAlert(monitor, openIncident, durationSecs);
        }

        await auditLog({
          action: "uptime.incident.resolved",
          category: "INTEGRATION",
          detail: {
            incidentId: openIncident.id,
            monitorName: monitor.name,
            previousStatus: openIncident.status,
            newStatus,
            durationSecs,
          },
        });
      }
    }

    // 2. Open a new incident if transitioning to DOWN or WARNING
    if (newStatus === "DOWN" || newStatus === "WARNING") {
      const cause =
        newStatus === "DOWN"
          ? "unreachable"
          : warningReasons.join(", ");

      const incident = await prisma.monitorIncident.create({
        data: {
          monitorId: monitor.id,
          status: newStatus,
          cause,
          alertSentAt: now,
        },
      });

      // Send alert notification
      await this.sendIncidentAlert(monitor, incident, result);

      await auditLog({
        action: "uptime.incident.created",
        category: "INTEGRATION",
        detail: {
          incidentId: incident.id,
          monitorName: monitor.name,
          status: newStatus,
          cause,
          message: result.message,
        },
      });
    }
  }

  /**
   * Send an alert notification for a new incident (DOWN or WARNING).
   */
  private async sendIncidentAlert(
    monitor: Monitor,
    incident: { id: string; status: MonitorStatus; cause: string | null },
    result: ExecutorResult
  ): Promise<void> {
    let companyName: string | undefined;
    if (monitor.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: monitor.companyId },
        select: { name: true },
      });
      companyName = company?.name;
    }

    const severity = incident.status === "DOWN" ? "critical" : "medium";
    const alertId = `uptime-incident-${incident.id}`;

    try {
      await notifyUsersForAlert({
        id: alertId,
        source: "uptime",
        severity,
        title: `${monitor.name} is ${incident.status}`,
        description: result.message || incident.cause || undefined,
        organizationName: companyName,
      });
    } catch (err) {
      console.error(`[UPTIME] Failed to send incident alert for ${monitor.name}:`, err);
    }
  }

  /**
   * Send a recovery notification when a DOWN monitor comes back UP.
   */
  private async sendRecoveryAlert(
    monitor: Monitor,
    incident: { id: string; startedAt: Date },
    durationSecs: number
  ): Promise<void> {
    let companyName: string | undefined;
    if (monitor.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: monitor.companyId },
        select: { name: true },
      });
      companyName = company?.name;
    }

    const durationStr =
      durationSecs < 60
        ? `${durationSecs}s`
        : durationSecs < 3600
          ? `${Math.round(durationSecs / 60)}m`
          : `${Math.floor(durationSecs / 3600)}h ${Math.round((durationSecs % 3600) / 60)}m`;

    const alertId = `uptime-recovery-${incident.id}`;

    try {
      await notifyUsersForAlert({
        id: alertId,
        source: "uptime",
        severity: "low",
        title: `${monitor.name} is back UP`,
        description: `Recovered after ${durationStr} of downtime`,
        organizationName: companyName,
      });
    } catch (err) {
      console.error(`[UPTIME] Failed to send recovery alert for ${monitor.name}:`, err);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getMonitorCount(): number {
    return this.timers.size;
  }
}
