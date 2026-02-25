import { z } from "zod";
import { router, adminProcedure, protectedProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import {
  encrypt,
  isEncryptionConfigured,
  isEncrypted,
  SECRET_MASK,
} from "@/lib/crypto";
import {
  AI_FUNCTION_CATALOG,
  DEFAULT_MODEL_ASSIGNMENTS,
  getActiveProvider,
  testConnection,
  listAvailableModels,
  invalidateClient,
} from "../services/ai/client";

export const aiRouter = router({
  // ─── Provider Config ─────────────────────────────────────────

  /** Get current AI provider config (secrets masked) */
  getProviderConfig: adminProcedure.query(async ({ ctx }) => {
    const config = await getActiveProvider(ctx.prisma);
    if (!config) return null;

    return {
      id: config.id,
      providerType: config.providerType,
      endpointUrl: config.endpointUrl,
      hasApiKey: !!config.apiKey,
      apiVersion: config.apiVersion,
      complexModel: config.complexModel,
      simpleModel: config.simpleModel,
      embeddingModel: config.embeddingModel,
      isActive: config.isActive,
      updatedAt: config.updatedAt,
    };
  }),

  /** Save/update AI provider config */
  updateProviderConfig: adminProcedure
    .input(
      z.object({
        providerType: z.enum(["AZURE_OPENAI", "OPENAI", "CUSTOM"]),
        endpointUrl: z.string().min(1),
        apiKey: z.string(), // Empty string = keep existing
        apiVersion: z.string().nullable().optional(),
        complexModel: z.string().min(1),
        simpleModel: z.string().min(1),
        embeddingModel: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Resolve API key: preserve existing if blank/masked
      let apiKey = input.apiKey;
      if (!apiKey || apiKey === SECRET_MASK) {
        const existing = await getActiveProvider(ctx.prisma);
        apiKey = existing?.apiKey || "";
        if (!apiKey) throw new Error("API key is required");
      } else if (isEncryptionConfigured() && !isEncrypted(apiKey)) {
        apiKey = encrypt(apiKey);
      }

      // Deactivate all existing configs, then upsert the new one
      await ctx.prisma.aiProviderConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      const existing = await getActiveProvider(ctx.prisma);

      let result;
      if (existing) {
        result = await ctx.prisma.aiProviderConfig.update({
          where: { id: existing.id },
          data: {
            providerType: input.providerType,
            endpointUrl: input.endpointUrl,
            apiKey,
            apiVersion: input.apiVersion || null,
            complexModel: input.complexModel,
            simpleModel: input.simpleModel,
            embeddingModel: input.embeddingModel,
            isActive: true,
            updatedBy: ctx.user.id,
          },
        });
      } else {
        result = await ctx.prisma.aiProviderConfig.create({
          data: {
            providerType: input.providerType,
            endpointUrl: input.endpointUrl,
            apiKey,
            apiVersion: input.apiVersion || null,
            complexModel: input.complexModel,
            simpleModel: input.simpleModel,
            embeddingModel: input.embeddingModel,
            isActive: true,
            updatedBy: ctx.user.id,
          },
        });
      }

      // Invalidate cached AI client so next use picks up new config
      invalidateClient();

      await auditLog({
        action: "ai.provider.configured",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: "ai-provider",
        detail: {
          providerType: input.providerType,
          endpointUrl: input.endpointUrl,
          complexModel: input.complexModel,
          simpleModel: input.simpleModel,
          embeddingModel: input.embeddingModel,
        },
      });

      return {
        id: result.id,
        providerType: result.providerType,
        isActive: result.isActive,
        updatedAt: result.updatedAt,
      };
    }),

  /** Test AI provider connectivity */
  testProviderConnection: adminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.aiProviderConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return { ok: false, message: "No AI provider configured", latencyMs: 0 };
    }

    const result = await testConnection(config);

    await auditLog({
      action: "ai.provider.tested",
      category: "INTEGRATION",
      actorId: ctx.user.id,
      resource: "ai-provider",
      detail: {
        providerType: config.providerType,
        success: result.ok,
        latencyMs: result.latencyMs,
      },
    });

    return result;
  }),

  /** Fetch available models from the configured AI provider */
  listAvailableModels: adminProcedure.mutation(async ({ ctx }) => {
    const config = await ctx.prisma.aiProviderConfig.findFirst({
      where: { isActive: true },
    });

    if (!config) {
      return { ok: false as const, models: [], message: "No AI provider configured. Save your provider settings first." };
    }

    try {
      const models = await listAvailableModels(config);
      return { ok: true as const, models, message: `Found ${models.length} models` };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch models";
      return { ok: false as const, models: [], message };
    }
  }),

  // ─── Model Assignments ────────────────────────────────────────

  /** Get all AI function model assignments (catalog + overrides) */
  listModelAssignments: adminProcedure.query(async ({ ctx }) => {
    const overrides = await ctx.prisma.aiModelConfig.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.functionName, o]));

    return AI_FUNCTION_CATALOG.map((fn) => {
      const override = overrideMap.get(fn.name);
      return {
        functionName: fn.name,
        label: fn.label,
        description: fn.description,
        defaultTier: fn.defaultTier,
        currentTier: (override?.modelTier ?? fn.defaultTier) as string,
        customModel: override?.customModel || null,
        hasOverride: !!override,
      };
    });
  }),

  /** Update model assignment for a function */
  updateModelAssignment: adminProcedure
    .input(
      z.object({
        functionName: z.string().min(1),
        modelTier: z.enum(["complex", "simple"]),
        customModel: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.aiModelConfig.upsert({
        where: { functionName: input.functionName },
        update: {
          modelTier: input.modelTier,
          customModel: input.customModel || null,
          updatedBy: ctx.user.id,
        },
        create: {
          functionName: input.functionName,
          modelTier: input.modelTier,
          customModel: input.customModel || null,
          updatedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "ai.model.assigned",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `ai-function:${input.functionName}`,
        detail: {
          functionName: input.functionName,
          modelTier: input.modelTier,
          customModel: input.customModel,
        },
      });

      return result;
    }),

  /** Reset a function's model assignment to default */
  resetModelAssignment: adminProcedure
    .input(z.object({ functionName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.aiModelConfig.deleteMany({
        where: { functionName: input.functionName },
      });

      await auditLog({
        action: "ai.model.reset",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `ai-function:${input.functionName}`,
        detail: { functionName: input.functionName },
      });

      return { success: true };
    }),

  // ─── Budget & Rate Limits ─────────────────────────────────────

  /** List all budget configs */
  listBudgetConfigs: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.aiBudgetConfig.findMany({
      orderBy: [{ entityType: "asc" }, { entityId: "asc" }],
    });
  }),

  /** Create or update a budget config */
  upsertBudgetConfig: adminProcedure
    .input(
      z.object({
        entityType: z.enum(["user", "role"]),
        entityId: z.string().min(1),
        dailyTokenLimit: z.number().int().positive().nullable().optional(),
        monthlyTokenLimit: z.number().int().positive().nullable().optional(),
        rateLimitPerHour: z.number().int().positive().nullable().optional(),
        maxConcurrent: z.number().int().min(1).max(10).default(1),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.aiBudgetConfig.upsert({
        where: {
          entityType_entityId: {
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        update: {
          dailyTokenLimit: input.dailyTokenLimit ?? null,
          monthlyTokenLimit: input.monthlyTokenLimit ?? null,
          rateLimitPerHour: input.rateLimitPerHour ?? null,
          maxConcurrent: input.maxConcurrent,
          isActive: input.isActive,
          updatedBy: ctx.user.id,
        },
        create: {
          entityType: input.entityType,
          entityId: input.entityId,
          dailyTokenLimit: input.dailyTokenLimit ?? null,
          monthlyTokenLimit: input.monthlyTokenLimit ?? null,
          rateLimitPerHour: input.rateLimitPerHour ?? null,
          maxConcurrent: input.maxConcurrent,
          isActive: input.isActive,
          updatedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "ai.budget.configured",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `ai-budget:${input.entityType}:${input.entityId}`,
        detail: {
          entityType: input.entityType,
          entityId: input.entityId,
          dailyTokenLimit: input.dailyTokenLimit,
          monthlyTokenLimit: input.monthlyTokenLimit,
          rateLimitPerHour: input.rateLimitPerHour,
        },
      });

      return result;
    }),

  /** Delete a budget config */
  deleteBudgetConfig: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.prisma.aiBudgetConfig.findUnique({
        where: { id: input.id },
      });
      if (!config) throw new Error("Budget config not found");

      await ctx.prisma.aiBudgetConfig.delete({ where: { id: input.id } });

      await auditLog({
        action: "ai.budget.deleted",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        resource: `ai-budget:${config.entityType}:${config.entityId}`,
        detail: { entityType: config.entityType, entityId: config.entityId },
      });

      return { success: true };
    }),

  // ─── Usage Stats ──────────────────────────────────────────────

  /** Get AI usage summary (admin sees all, users see own) */
  getUsageSummary: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().optional(),
          days: z.number().int().min(1).max(90).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.user.role === "ADMIN";
      const targetUserId = isAdmin ? input?.userId : ctx.user.id;
      const days = input?.days ?? 30;

      const since = new Date();
      since.setDate(since.getDate() - days);

      const where = {
        createdAt: { gte: since },
        ...(targetUserId ? { userId: targetUserId } : {}),
      };

      const logs = await ctx.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
      const totalRequests = logs.length;
      const cachedRequests = logs.filter((l) => l.cached).length;
      const avgLatency = logs.length
        ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / logs.length)
        : 0;

      // Group by function
      const byFunction: Record<string, { requests: number; tokens: number }> = {};
      for (const log of logs) {
        if (!byFunction[log.functionName]) {
          byFunction[log.functionName] = { requests: 0, tokens: 0 };
        }
        byFunction[log.functionName].requests++;
        byFunction[log.functionName].tokens += log.totalTokens;
      }

      // Group by day (last 7 days)
      const dailyUsage: { date: string; tokens: number; requests: number }[] = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      for (let d = 0; d < 7; d++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split("T")[0];
        const dayLogs = logs.filter(
          (l) => l.createdAt.toISOString().split("T")[0] === dateStr
        );
        dailyUsage.push({
          date: dateStr,
          tokens: dayLogs.reduce((s, l) => s + l.totalTokens, 0),
          requests: dayLogs.length,
        });
      }

      return {
        totalTokens,
        totalRequests,
        cachedRequests,
        avgLatency,
        byFunction,
        dailyUsage,
      };
    }),

  // ─── Function Catalog (read-only) ─────────────────────────────

  /** Get the AI function catalog for display */
  getFunctionCatalog: protectedProcedure.query(() => {
    return AI_FUNCTION_CATALOG.map((fn) => ({
      name: fn.name,
      label: fn.label,
      description: fn.description,
      defaultTier: fn.defaultTier,
    }));
  }),
});
