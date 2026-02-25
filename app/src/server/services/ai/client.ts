/**
 * Provider-agnostic AI client.
 *
 * Supports three provider types via the same OpenAI SDK:
 * 1. Azure OpenAI — runs in Azure tenant, data stays in-boundary
 * 2. OpenAI — standard cloud API
 * 3. Custom (OpenAI-compatible) — Ollama, vLLM, LM Studio, etc.
 *
 * The official `openai` package supports all three natively:
 * - OpenAI: default baseURL
 * - Azure OpenAI: via AzureOpenAI class
 * - Custom: via custom baseURL
 */
import OpenAI from "openai";
import type { PrismaClient, AiProviderConfig } from "@prisma/client";
import { safeDecrypt } from "@/lib/crypto";

export type AiModelTier = "complex" | "simple" | "embedding";

// Default model assignments per AI function (admin can override via AiModelConfig)
export const DEFAULT_MODEL_ASSIGNMENTS: Record<string, AiModelTier> = {
  create_ticket: "complex",
  search_tickets: "simple",
  update_ticket: "simple",
  search_alerts: "simple",
  run_troubleshoot: "complex",
  lookup_device: "simple",
  lookup_user: "simple",
  search_knowledge: "complex",
  create_document: "complex",
  update_document: "complex",
  get_password: "simple",
  get_client_health: "simple",
  query_audit_log: "simple",
};

// All 13 AI function definitions for the catalog
export const AI_FUNCTION_CATALOG = [
  { name: "create_ticket", label: "Create Ticket", description: "Draft + confirm → ConnectWise", defaultTier: "complex" as const },
  { name: "search_tickets", label: "Search Tickets", description: "Filter by client, date, subject, tool", defaultTier: "simple" as const },
  { name: "update_ticket", label: "Update Ticket", description: "Assign, change status, add notes", defaultTier: "simple" as const },
  { name: "search_alerts", label: "Search Alerts", description: "Query unified alert queue", defaultTier: "simple" as const },
  { name: "run_troubleshoot", label: "Run Troubleshoot", description: "Trigger n8n: ping IP, check WAN, scan subnet", defaultTier: "complex" as const },
  { name: "lookup_device", label: "Lookup Device", description: "Cross-tool device lookup (NinjaRMM + S1)", defaultTier: "simple" as const },
  { name: "lookup_user", label: "Lookup User", description: "User/contact lookup (CW + Entra)", defaultTier: "simple" as const },
  { name: "search_knowledge", label: "Search Knowledge", description: "RAG semantic search (read-only)", defaultTier: "complex" as const },
  { name: "create_document", label: "Create Document", description: "Create IT Glue/OneNote/SP doc", defaultTier: "complex" as const },
  { name: "update_document", label: "Update Document", description: "Update existing doc", defaultTier: "complex" as const },
  { name: "get_password", label: "Get Password", description: "IT Glue credential + TOTP retrieval (MFA)", defaultTier: "simple" as const },
  { name: "get_client_health", label: "Get Client Health", description: "Composite health score (6 metrics)", defaultTier: "simple" as const },
  { name: "query_audit_log", label: "Query Audit Log", description: "Compliance audit event search", defaultTier: "simple" as const },
] as const;

let _cachedClient: OpenAI | null = null;
let _cachedConfigId: string | null = null;

/**
 * Get the active AI provider config from the database.
 * Returns null if no provider is configured.
 */
export async function getActiveProvider(
  prisma: PrismaClient
): Promise<AiProviderConfig | null> {
  return prisma.aiProviderConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Build an OpenAI client from a provider config.
 * Caches the client instance and invalidates if config changes.
 */
export function buildClient(config: AiProviderConfig): OpenAI {
  // Return cached if config hasn't changed
  if (_cachedClient && _cachedConfigId === config.id) {
    return _cachedClient;
  }

  const apiKey = safeDecrypt(config.apiKey);

  let client: OpenAI;

  switch (config.providerType) {
    case "AZURE_OPENAI":
      client = new OpenAI({
        apiKey,
        baseURL: `${config.endpointUrl.replace(/\/$/, "")}/openai/deployments`,
        defaultQuery: { "api-version": config.apiVersion || "2024-12-01-preview" },
        defaultHeaders: { "api-key": apiKey },
      });
      break;

    case "OPENAI":
      client = new OpenAI({
        apiKey,
      });
      break;

    case "CUSTOM":
      client = new OpenAI({
        apiKey: apiKey || "not-needed", // Some local servers don't need a key
        baseURL: config.endpointUrl.replace(/\/$/, ""),
      });
      break;

    default:
      throw new Error(`Unknown provider type: ${config.providerType}`);
  }

  _cachedClient = client;
  _cachedConfigId = config.id;
  return client;
}

/** Invalidate the cached client (call when config changes) */
export function invalidateClient(): void {
  _cachedClient = null;
  _cachedConfigId = null;
}

/**
 * Resolve which model name to use for a given function.
 * Checks AiModelConfig overrides first, then falls back to defaults.
 */
export async function resolveModel(
  prisma: PrismaClient,
  functionName: string,
  provider: AiProviderConfig
): Promise<string> {
  // Check for per-function override
  const override = await prisma.aiModelConfig.findUnique({
    where: { functionName },
  });

  if (override?.customModel) {
    return override.customModel;
  }

  const tier = override?.modelTier ?? DEFAULT_MODEL_ASSIGNMENTS[functionName] ?? "simple";

  switch (tier) {
    case "complex":
      return provider.complexModel;
    case "simple":
      return provider.simpleModel;
    case "embedding":
      return provider.embeddingModel;
    default:
      return provider.simpleModel;
  }
}

/**
 * List available models from the configured AI provider.
 * Works across all three provider types via GET /models.
 */
export async function listAvailableModels(
  config: AiProviderConfig
): Promise<{ id: string; owned_by?: string }[]> {
  const apiKey = safeDecrypt(config.apiKey);

  // Azure OpenAI models list uses a different endpoint than deployments
  if (config.providerType === "AZURE_OPENAI") {
    const url = `${config.endpointUrl.replace(/\/$/, "")}/openai/models?api-version=${config.apiVersion || "2024-12-01-preview"}`;
    const res = await fetch(url, {
      headers: { "api-key": apiKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Azure API returned ${res.status}`);
    const json = await res.json();
    const models = (json.data ?? json.value ?? []) as { id: string; owned_by?: string }[];
    return models
      .map((m: { id: string; owned_by?: string }) => ({ id: m.id, owned_by: m.owned_by }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
  }

  // OpenAI and Custom (Ollama, vLLM) — use the SDK
  const client = new OpenAI({
    apiKey: apiKey || "not-needed",
    baseURL: config.providerType === "OPENAI" ? undefined : config.endpointUrl.replace(/\/$/, ""),
  });

  const response = await client.models.list();
  const models: { id: string; owned_by?: string }[] = [];
  for await (const model of response) {
    models.push({ id: model.id, owned_by: model.owned_by });
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Test connectivity to the configured AI provider.
 * Sends a minimal request to verify the endpoint + key work.
 */
export async function testConnection(
  config: AiProviderConfig
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();

  try {
    const client = buildClient(config);

    // For Azure OpenAI, we need to use deployment names as model
    const model = config.simpleModel;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5,
    });

    const latencyMs = Date.now() - start;

    if (response.choices?.[0]?.message) {
      return {
        ok: true,
        message: `Connected successfully — ${config.providerType} responded in ${latencyMs}ms`,
        latencyMs,
      };
    }

    return {
      ok: false,
      message: "Provider returned an unexpected response format",
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    const message = error instanceof Error ? error.message : "Connection failed";

    // Provide helpful error messages for common issues
    if (message.includes("401") || message.includes("Unauthorized")) {
      return { ok: false, message: "Authentication failed — check your API key", latencyMs };
    }
    if (message.includes("404")) {
      return { ok: false, message: "Model not found — check your model deployment names", latencyMs };
    }
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
      return { ok: false, message: "Cannot reach endpoint — check the URL", latencyMs };
    }

    return { ok: false, message, latencyMs };
  }
}
