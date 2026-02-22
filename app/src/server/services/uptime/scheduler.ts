import type { Monitor, MonitorStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getExecutor } from "./executors/registry";
import type { ExecutorResult } from "./types";

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

    // Handle retry logic
    const retryCount = this.retryCounters.get(monitorId) || 0;
    let finalStatus: MonitorStatus;

    if (result.status === "DOWN") {
      if (retryCount < monitor.maxRetries) {
        // Still in retry phase — mark as PENDING, increment counter
        this.retryCounters.set(monitorId, retryCount + 1);
        finalStatus = "PENDING";
      } else {
        // Max retries exceeded — confirmed DOWN
        finalStatus = "DOWN";
      }
    } else {
      // UP — reset retry counter
      this.retryCounters.set(monitorId, 0);
      finalStatus = "UP";
    }

    const isStatusChange = monitor.status !== finalStatus;

    // Write heartbeat
    await prisma.heartbeat.create({
      data: {
        monitorId: monitor.id,
        status: finalStatus,
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

    // Update monitor status
    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        status: finalStatus,
        lastCheckedAt: new Date(),
        ...(isStatusChange ? { lastStatusChange: new Date() } : {}),
      },
    });

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

  isRunning(): boolean {
    return this.running;
  }

  getMonitorCount(): number {
    return this.timers.size;
  }
}
