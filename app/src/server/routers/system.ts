import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { auditLog } from "@/lib/audit";

// ─── Types ──────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number | null;
  message: string;
  type: "container" | "database" | "cache";
  version: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

// Container name → Docker image mapping for updatable services
const UPDATABLE_CONTAINERS: Record<string, { image: string; containerName: string }> = {
  n8n: { image: "n8nio/n8n", containerName: "rcc-n8n" },
  grafana: { image: "grafana/grafana-oss", containerName: "rcc-grafana" },
  app: { image: "reditech-command-center-app", containerName: "rcc-app" },
};

// ─── Health Check Helpers ───────────────────────────────────────────

async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    const versionResult = await prisma.$queryRaw<[{ server_version: string }]>`SHOW server_version`;
    const pgVersion = versionResult[0]?.server_version ?? null;

    return {
      name: "PostgreSQL",
      status: "healthy",
      latencyMs: latency,
      message: `Connected (v${pgVersion})`,
      type: "database",
      version: pgVersion,
      latestVersion: null,
      updateAvailable: false,
    };
  } catch (error) {
    return {
      name: "PostgreSQL",
      status: "down",
      latencyMs: null,
      message: error instanceof Error ? error.message : "Connection failed",
      type: "database",
      version: null,
      latestVersion: null,
      updateAvailable: false,
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    const latency = Date.now() - start;
    const info = await redis.info("server");
    const versionMatch = info.match(/redis_version:(\S+)/);
    const redisVersion = versionMatch?.[1] ?? null;

    return {
      name: "Redis",
      status: pong === "PONG" ? "healthy" : "degraded",
      latencyMs: latency,
      message: `Connected (v${redisVersion})`,
      type: "cache",
      version: redisVersion,
      latestVersion: null,
      updateAvailable: false,
    };
  } catch (error) {
    return {
      name: "Redis",
      status: "down",
      latencyMs: null,
      message: error instanceof Error ? error.message : "Connection failed",
      type: "cache",
      version: null,
      latestVersion: null,
      updateAvailable: false,
    };
  }
}

async function checkHttpService(
  name: string,
  url: string,
  type: "container",
  versionExtractor?: (data: unknown) => string | null
): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    let version: string | null = null;

    if (res.ok && versionExtractor) {
      try {
        const data = await res.json();
        version = versionExtractor(data);
      } catch {
        // response wasn't JSON
      }
    }

    return {
      name,
      status: res.ok ? "healthy" : "degraded",
      latencyMs: latency,
      message: res.ok ? `Running${version ? ` (v${version})` : ""}` : `HTTP ${res.status}`,
      type,
      version,
      latestVersion: null,
      updateAvailable: false,
    };
  } catch (error) {
    return {
      name,
      status: "down",
      latencyMs: null,
      message: error instanceof Error
        ? (error.name === "AbortError" ? "Timeout (5s)" : error.message)
        : "Connection failed",
      type,
      version: null,
      latestVersion: null,
      updateAvailable: false,
    };
  }
}

/** Compare two semver strings, returns positive if a > b */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/** Fetch latest Docker Hub tag for an image (picks highest clean semver) */
async function getLatestDockerTag(image: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://registry.hub.docker.com/v2/repositories/${image}/tags?page_size=20&ordering=last_updated`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ name: string }> };

    // Find all clean semver tags (e.g. "12.3.3", not "12.3.3-ubuntu" or "latest")
    const cleanTags = data.results
      ?.filter((t: { name: string }) => /^\d+\.\d+\.\d+$/.test(t.name))
      .map((t: { name: string }) => t.name) ?? [];

    if (cleanTags.length === 0) return null;

    // Return the highest version
    cleanTags.sort(compareSemver);
    return cleanTags[cleanTags.length - 1] ?? null;
  } catch {
    return null;
  }
}

// ─── Docker Helpers ─────────────────────────────────────────────────

/** Get a Dockerode instance (lazy, fail-safe) */
async function getDocker() {
  try {
    const Dockerode = (await import("dockerode")).default;
    const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
    // Quick ping to verify connectivity
    await docker.ping();
    return docker;
  } catch {
    return null;
  }
}

/** Extract version from a Docker container's image tag or labels */
async function getContainerVersion(
  containerName: string,
  docker: Awaited<ReturnType<typeof getDocker>>
): Promise<string | null> {
  if (!docker) return null;
  try {
    const container = docker.getContainer(containerName);
    const inspect = await container.inspect();
    // Try image tag first (e.g. "n8nio/n8n:1.70.3" → "1.70.3")
    const imageTag = inspect.Config.Image;
    const tagMatch = imageTag?.match(/:(\d+\.\d+[\w.-]*)/);
    if (tagMatch) return tagMatch[1];

    // If tag is "latest", try to get version from image labels
    const image = docker.getImage(inspect.Image);
    const imageInspect = await image.inspect();
    const labels = imageInspect.Config?.Labels ?? {};
    // Common label conventions
    return labels["org.opencontainers.image.version"]
      ?? labels["version"]
      ?? null;
  } catch {
    return null;
  }
}

// ─── Router ─────────────────────────────────────────────────────────

export const systemRouter = router({
  /** Dashboard widget: quick health + version check for all services */
  health: protectedProcedure.query(async () => {
    const docker = await getDocker();

    // Use internal URLs — works on both Docker Compose and Azure Container Apps
    const n8nUrl = process.env.N8N_INTERNAL_URL ?? `http://${process.env.N8N_HOST ?? "n8n"}:5678`;
    const grafanaUrl = process.env.GRAFANA_INTERNAL_URL ?? `http://${process.env.GRAFANA_HOST ?? "grafana"}:3000`;

    const [db, redisStatus, n8n, grafana] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkHttpService(
        "n8n",
        `${n8nUrl}/healthz`,
        "container",
        () => null
      ),
      checkHttpService(
        "Grafana",
        `${grafanaUrl}/api/health`,
        "container",
        (data) => (data as { version?: string })?.version ?? null
      ),
    ]);

    // Try Docker image labels for n8n version (only available in docker-compose env)
    if (n8n.status === "healthy" && !n8n.version && docker) {
      const ver = await getContainerVersion("rcc-n8n", docker);
      if (ver) {
        n8n.version = ver;
        n8n.message = `Running (v${ver})`;
      }
    }

    const appVersion = process.env.APP_VERSION ?? process.env.npm_package_version ?? "0.1.0";
    const app: ServiceStatus = {
      name: "RCC App",
      status: "healthy",
      latencyMs: 0,
      message: `Running (v${appVersion})`,
      type: "container",
      version: appVersion,
      latestVersion: null,
      updateAvailable: false,
    };

    const [latestN8n, latestGrafana] = await Promise.all([
      getLatestDockerTag("n8nio/n8n"),
      getLatestDockerTag("grafana/grafana-oss"),
    ]);

    if (latestN8n) {
      n8n.latestVersion = latestN8n;
      if (n8n.version && n8n.version !== latestN8n) n8n.updateAvailable = true;
    }
    if (latestGrafana) {
      grafana.latestVersion = latestGrafana;
      if (grafana.version && grafana.version !== latestGrafana) grafana.updateAvailable = true;
    }

    const services: ServiceStatus[] = [app, db, redisStatus, n8n, grafana];
    const overallStatus = services.every((s) => s.status === "healthy")
      ? "healthy"
      : "degraded";

    return { status: overallStatus, services, checkedAt: new Date().toISOString() };
  }),

  /** Settings page: detailed container info with Docker metadata */
  containerInfo: adminProcedure.query(async () => {
    const docker = await getDocker();
    const dockerAvailable = !!docker;

    // Get running container details if Docker is accessible
    const containers: Array<{
      service: string;
      containerName: string;
      image: string;
      currentVersion: string | null;
      latestVersion: string | null;
      updateAvailable: boolean;
      status: string;
      uptime: string | null;
      canUpdate: boolean;
    }> = [];

    // n8n version — try Docker labels first, then HTTP API
    let n8nVersion = await getContainerVersion("rcc-n8n", docker);
    let n8nReachable = false;
    if (!n8nVersion) {
      const n8nUrl = process.env.N8N_INTERNAL_URL ?? `http://${process.env.N8N_HOST ?? "n8n"}:5678`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${n8nUrl}/healthz`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) n8nReachable = true;
      } catch { /* ignore */ }
    }

    // Grafana version — use internal URL (works on Docker Compose and Azure)
    const grafanaUrl = process.env.GRAFANA_INTERNAL_URL ?? `http://${process.env.GRAFANA_HOST ?? "grafana"}:3000`;
    let grafanaVersion: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `${grafanaUrl}/api/health`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as { version?: string };
        grafanaVersion = data.version ?? null;
      }
    } catch { /* ignore */ }

    const appVersion = process.env.APP_VERSION ?? process.env.npm_package_version ?? "0.1.0";

    // Check latest versions from Docker Hub
    const [latestN8n, latestGrafana] = await Promise.all([
      getLatestDockerTag("n8nio/n8n"),
      getLatestDockerTag("grafana/grafana-oss"),
    ]);

    // Get container uptime from Docker if available
    let containerUptimes: Record<string, string> = {};
    if (docker) {
      try {
        const allContainers = await docker.listContainers();
        for (const c of allContainers) {
          const name = c.Names?.[0]?.replace("/", "") ?? "";
          containerUptimes[name] = c.Status ?? "unknown";
        }
      } catch { /* ignore */ }
    }

    // RCC App
    containers.push({
      service: "RCC App",
      containerName: "rcc-app",
      image: "reditech-command-center-app",
      currentVersion: appVersion,
      latestVersion: null,
      updateAvailable: false,
      status: "running",
      uptime: containerUptimes["rcc-app"] ?? null,
      canUpdate: false, // App updates via CI/CD
    });

    // n8n
    const n8nRunning = !!containerUptimes["rcc-n8n"] || n8nReachable;
    containers.push({
      service: "n8n",
      containerName: "rcc-n8n",
      image: "n8nio/n8n",
      currentVersion: n8nVersion,
      latestVersion: latestN8n,
      updateAvailable: !!(n8nVersion && latestN8n && n8nVersion !== latestN8n),
      status: n8nRunning ? "running" : "unknown",
      uptime: containerUptimes["rcc-n8n"] ?? null,
      canUpdate: dockerAvailable,
    });

    // Grafana
    const grafanaRunning = !!containerUptimes["rcc-grafana"];
    containers.push({
      service: "Grafana",
      containerName: "rcc-grafana",
      image: "grafana/grafana-oss",
      currentVersion: grafanaVersion,
      latestVersion: latestGrafana,
      updateAvailable: !!(grafanaVersion && latestGrafana && grafanaVersion !== latestGrafana),
      status: grafanaRunning ? "running" : "unknown",
      uptime: containerUptimes["rcc-grafana"] ?? null,
      canUpdate: dockerAvailable,
    });

    return {
      dockerAvailable,
      containers,
      checkedAt: new Date().toISOString(),
    };
  }),

  /** Pull specific version tag and recreate a container */
  applyUpdate: adminProcedure
    .input(z.object({
      service: z.enum(["n8n", "grafana"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const docker = await getDocker();
      if (!docker) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Docker socket not available. Cannot apply updates.",
        });
      }

      const containerDef = UPDATABLE_CONTAINERS[input.service];
      if (!containerDef) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown service" });
      }

      // Look up the actual latest version tag (e.g. "2.9.1") instead of pulling ":latest"
      const latestVersion = await getLatestDockerTag(containerDef.image);
      if (!latestVersion) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Could not determine latest version from Docker Hub.",
        });
      }
      const imageName = `${containerDef.image}:${latestVersion}`;

      await auditLog({
        action: "system.update.started",
        category: "SYSTEM",
        actorId: ctx.user.id,
        resource: `container:${input.service}`,
        detail: { service: input.service, image: imageName },
      });

      try {
        // Step 1: Pull the latest image
        const stream = await docker.pull(imageName);

        // Wait for pull to complete
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(
            stream,
            (err: Error | null) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        // Step 2: Get the old container config
        const oldContainer = docker.getContainer(containerDef.containerName);
        const oldInspect = await oldContainer.inspect();

        // Build networking config from inspected NetworkSettings
        const networks = oldInspect.NetworkSettings?.Networks ?? {};
        const endpointsConfig: Record<string, { Aliases?: string[] }> = {};
        for (const [netName, netInfo] of Object.entries(networks)) {
          endpointsConfig[netName] = {
            Aliases: (netInfo as { Aliases?: string[] })?.Aliases ?? [],
          };
        }

        // Step 3: Stop the old container
        try {
          await oldContainer.stop({ t: 10 });
        } catch {
          // might already be stopped
        }

        // Step 4: Rename old container (backup)
        const backupName = `${containerDef.containerName}-old-${Date.now()}`;
        await oldContainer.rename({ name: backupName });

        // Step 5: Create new container with same config
        const newContainer = await docker.createContainer({
          name: containerDef.containerName,
          Image: imageName,
          Env: oldInspect.Config.Env,
          ExposedPorts: oldInspect.Config.ExposedPorts,
          HostConfig: oldInspect.HostConfig,
          NetworkingConfig: {
            EndpointsConfig: endpointsConfig,
          },
        } as Record<string, unknown>);

        // Step 6: Start the new container
        await newContainer.start();

        // Step 7: Remove the old container
        try {
          await docker.getContainer(backupName).remove({ force: true });
        } catch {
          // non-critical
        }

        await auditLog({
          action: "system.update.completed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `container:${input.service}`,
          detail: { service: input.service, image: imageName, version: latestVersion },
        });

        return { success: true, message: `${input.service} updated to v${latestVersion}` };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Update failed";

        await auditLog({
          action: "system.update.failed",
          category: "SYSTEM",
          actorId: ctx.user.id,
          resource: `container:${input.service}`,
          detail: { service: input.service, error: message },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update ${input.service}: ${message}`,
        });
      }
    }),
});
