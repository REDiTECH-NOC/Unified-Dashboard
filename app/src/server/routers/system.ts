import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { auditLog } from "@/lib/audit";
import { isAzureEnvironment, getAzureToken, getResourceGroupBaseUrl } from "@/lib/azure";

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

// Azure Container App names (same as Docker container names)
const AZURE_CONTAINER_APPS: Record<string, string> = {
  n8n: "rcc-n8n",
  grafana: "rcc-grafana",
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
    const timeout = setTimeout(() => controller.abort(), 3000);
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
        ? (error.name === "AbortError" ? "Timeout (3s)" : error.message)
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

/** Get a Dockerode instance (cached, fail-safe).
 *  Once we know Docker socket is unavailable (e.g. Azure), stop retrying for 5 min. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _dockerInstance: any = undefined;
let _dockerCheckedAt = 0;
const DOCKER_CACHE_MS = 5 * 60_000; // re-check every 5 min

async function getDocker() {
  const now = Date.now();
  if (_dockerInstance !== undefined && now - _dockerCheckedAt < DOCKER_CACHE_MS) {
    return _dockerInstance;
  }
  try {
    const Dockerode = (await import("dockerode")).default;
    const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
    await docker.ping();
    _dockerInstance = docker;
    _dockerCheckedAt = now;
    return docker;
  } catch {
    _dockerInstance = null;
    _dockerCheckedAt = now;
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

// ─── Azure Container Apps Helpers ────────────────────────────────────

// isAzureEnvironment and getAzureToken imported from @/lib/azure

/** Update an Azure Container App's image via the Azure Management REST API */
async function updateAzureContainerApp(
  appName: string,
  image: string
): Promise<void> {
  const token = await getAzureToken();
  const baseUrl = `${getResourceGroupBaseUrl()}/providers/Microsoft.App/containerApps/${appName}`;
  const apiVersion = "api-version=2024-03-01";

  // GET current container app config to preserve all settings
  const getRes = await fetch(`${baseUrl}?${apiVersion}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!getRes.ok) {
    const body = await getRes.text();
    throw new Error(`Failed to read container app config (${getRes.status}): ${body}`);
  }
  const currentConfig = await getRes.json() as {
    properties?: {
      template?: {
        containers?: Array<{ name: string; image: string; [key: string]: unknown }>;
      };
    };
  };

  const containers = currentConfig.properties?.template?.containers;
  if (!containers || containers.length === 0) {
    throw new Error("No containers found in the container app template.");
  }

  // Update the image on the first (primary) container
  containers[0].image = image;

  // PATCH back with updated container image
  const patchRes = await fetch(`${baseUrl}?${apiVersion}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        template: { containers },
      },
    }),
  });

  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`Azure API error (${patchRes.status}): ${body}`);
  }
}

// ─── Health Cache ───────────────────────────────────────────────────

const HEALTH_CACHE_KEY = "rcc:system:health";
const HEALTH_CACHE_TTL = 60; // seconds — all users share one cached result

const UPDATE_INFO_CACHE_KEY = "rcc:system:updateInfo";
const UPDATE_INFO_CACHE_TTL = 300; // 5 minutes

async function fetchHealthData() {
  const docker = await getDocker();

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

  // Fallback: scrape n8n version from HTML root page (works on both Docker and Azure)
  if (n8n.status === "healthy" && !n8n.version) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${n8nUrl}/`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/name="n8n:config:sentry"\s+content="([^"]+)"/);
        if (match?.[1]) {
          try {
            const decoded = JSON.parse(Buffer.from(match[1], "base64").toString());
            const release = decoded?.release as string | undefined;
            if (release?.startsWith("n8n@")) {
              n8n.version = release.slice(4);
              n8n.message = `Running (v${n8n.version})`;
            }
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
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

  const services: ServiceStatus[] = [app, db, redisStatus, n8n, grafana];
  const overallStatus = services.every((s) => s.status === "healthy")
    ? "healthy"
    : "degraded";

  return { status: overallStatus, services, checkedAt: new Date().toISOString() };
}

type HealthResult = Awaited<ReturnType<typeof fetchHealthData>>;

// In-flight dedup: if a health check is already running, share its result
let healthInflight: Promise<HealthResult> | null = null;

// ─── Router ─────────────────────────────────────────────────────────

export const systemRouter = router({
  /** Dashboard widget: quick health + version check for all services */
  health: protectedProcedure.query(async (): Promise<HealthResult> => {
    // Try Redis cache first — avoids re-running all health checks for every user
    try {
      const cached = await redis.get(HEALTH_CACHE_KEY);
      if (cached) return JSON.parse(cached) as HealthResult;
    } catch { /* Redis down — fall through to live check */ }

    // Dedup concurrent requests: if another request is already fetching, wait for it
    if (healthInflight) {
      try {
        return await healthInflight;
      } catch { /* fall through to fresh fetch */ }
    }

    healthInflight = fetchHealthData();
    try {
      const result = await healthInflight;
      // Cache in Redis for all users to share
      try {
        await redis.set(HEALTH_CACHE_KEY, JSON.stringify(result), "EX", HEALTH_CACHE_TTL);
      } catch { /* Redis down — still return the result */ }
      return result;
    } finally {
      healthInflight = null;
    }
  }),

  /** Separate endpoint for update availability — called infrequently, not on every health poll */
  updateInfo: protectedProcedure.query(async () => {
    // Check Redis cache first — Docker Hub calls are slow and rarely change
    try {
      const cached = await redis.get(UPDATE_INFO_CACHE_KEY);
      if (cached) return JSON.parse(cached) as { n8n: string | null; grafana: string | null; checkedAt: string };
    } catch { /* Redis down — fall through */ }

    const [latestN8n, latestGrafana] = await Promise.all([
      getLatestDockerTag("n8nio/n8n"),
      getLatestDockerTag("grafana/grafana-oss"),
    ]);

    const result = {
      n8n: latestN8n,
      grafana: latestGrafana,
      checkedAt: new Date().toISOString(),
    };

    try {
      await redis.set(UPDATE_INFO_CACHE_KEY, JSON.stringify(result), "EX", UPDATE_INFO_CACHE_TTL);
    } catch { /* Redis down — still return result */ }

    return result;
  }),

  /** Runtime external URLs for sidebar links — reads from integration config DB */
  externalUrls: protectedProcedure.query(async () => {
    const n8nConfig = await prisma.integrationConfig.findUnique({
      where: { toolId: "n8n" },
      select: { config: true },
    });
    const n8nUrl = (n8nConfig?.config as Record<string, unknown>)?.instanceUrl as string | undefined;

    return {
      n8n: n8nUrl || process.env.N8N_EXTERNAL_URL || null,
    };
  }),

  /** Settings page: detailed container info with Docker metadata */
  containerInfo: adminProcedure.query(async () => {
    const docker = await getDocker();
    const dockerAvailable = !!docker;
    const azureAvailable = isAzureEnvironment();

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

    // n8n version — try Docker labels first, then HTTP API, then HTML scrape
    let n8nVersion = await getContainerVersion("rcc-n8n", docker);
    let n8nReachable = false;
    const n8nUrl = process.env.N8N_INTERNAL_URL ?? `http://${process.env.N8N_HOST ?? "n8n"}:5678`;
    if (!n8nVersion) {
      // Try n8n's root page — version is in a base64-encoded sentry meta tag
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${n8nUrl}/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          n8nReachable = true;
          const html = await res.text();
          const match = html.match(/name="n8n:config:sentry"\s+content="([^"]+)"/);
          if (match?.[1]) {
            try {
              const decoded = JSON.parse(Buffer.from(match[1], "base64").toString());
              const release = decoded?.release as string | undefined;
              if (release?.startsWith("n8n@")) {
                n8nVersion = release.slice(4); // strip "n8n@" prefix
              }
            } catch { /* ignore decode errors */ }
          }
        }
      } catch { /* ignore */ }
    }
    if (!n8nVersion && !n8nReachable) {
      // Fallback: just check if n8n is reachable via healthz
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
      updateAvailable: !!(n8nVersion && latestN8n && compareSemver(latestN8n, n8nVersion) > 0),
      status: n8nRunning ? "running" : "unknown",
      uptime: containerUptimes["rcc-n8n"] ?? null,
      canUpdate: dockerAvailable || azureAvailable,
    });

    // Grafana — use HTTP reachability as fallback when Docker socket unavailable
    const grafanaRunning = !!containerUptimes["rcc-grafana"] || !!grafanaVersion;
    containers.push({
      service: "Grafana",
      containerName: "rcc-grafana",
      image: "grafana/grafana-oss",
      currentVersion: grafanaVersion,
      latestVersion: latestGrafana,
      updateAvailable: !!(grafanaVersion && latestGrafana && compareSemver(latestGrafana, grafanaVersion) > 0),
      status: grafanaRunning ? "running" : "unknown",
      uptime: containerUptimes["rcc-grafana"] ?? null,
      canUpdate: dockerAvailable || azureAvailable,
    });

    return {
      dockerAvailable,
      azureAvailable,
      containers,
      checkedAt: new Date().toISOString(),
    };
  }),

  /** Pull specific version tag and recreate a container (Docker or Azure) */
  applyUpdate: adminProcedure
    .input(z.object({
      service: z.enum(["n8n", "grafana"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const docker = await getDocker();
      const azure = isAzureEnvironment();

      if (!docker && !azure) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Neither Docker socket nor Azure managed identity available. Cannot apply updates.",
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
        detail: { service: input.service, image: imageName, method: docker ? "docker" : "azure" },
      });

      try {
        if (docker) {
          // ── Docker path: pull image, recreate container ──
          const stream = await docker.pull(imageName);
          await new Promise<void>((resolve, reject) => {
            docker.modem.followProgress(
              stream,
              (err: Error | null) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          const oldContainer = docker.getContainer(containerDef.containerName);
          const oldInspect = await oldContainer.inspect();

          const networks = oldInspect.NetworkSettings?.Networks ?? {};
          const endpointsConfig: Record<string, { Aliases?: string[] }> = {};
          for (const [netName, netInfo] of Object.entries(networks)) {
            endpointsConfig[netName] = {
              Aliases: (netInfo as { Aliases?: string[] })?.Aliases ?? [],
            };
          }

          try {
            await oldContainer.stop({ t: 10 });
          } catch {
            // might already be stopped
          }

          const backupName = `${containerDef.containerName}-old-${Date.now()}`;
          await oldContainer.rename({ name: backupName });

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

          await newContainer.start();

          try {
            await docker.getContainer(backupName).remove({ force: true });
          } catch {
            // non-critical
          }
        } else {
          // ── Azure path: update container app image via REST API ──
          const azureAppName = AZURE_CONTAINER_APPS[input.service];
          if (!azureAppName) {
            throw new Error(`No Azure container app mapping for service: ${input.service}`);
          }
          await updateAzureContainerApp(azureAppName, imageName);
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
