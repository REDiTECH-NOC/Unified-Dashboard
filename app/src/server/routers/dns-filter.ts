/**
 * DNS Filter Router — tRPC procedures for DNSFilter DNS security.
 *
 * Uses IDnsSecurityConnector via ConnectorFactory.
 * Policy mutations are audit-logged.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { ConnectorFactory } from "../connectors/factory";
import type { IDnsSecurityConnector, DnsBlockPage, DnsScheduledPolicy, DnsApplication, DnsApplicationCategory } from "../connectors/_interfaces/dns-security";
import { auditLog } from "@/lib/audit";
import { cachedQuery } from "@/lib/query-cache";
import { redis } from "@/lib/redis";

/** Bust Redis cache for policies after mutations */
async function invalidatePoliciesCache() {
  try { await redis.del("qc:dnsfilter:policies"); } catch { /* ignore */ }
}

async function invalidateNetworksCache() {
  try { await redis.del("qc:dnsfilter:networks"); } catch { /* ignore */ }
}

async function invalidateBlockPagesCache() {
  try { await redis.del("qc:dnsfilter:block-pages"); } catch { /* ignore */ }
}

const THREAT_STALE = 5 * 60_000;   // 5 min
const TRAFFIC_STALE = 5 * 60_000;  // 5 min
const REF_STALE = 60 * 60_000;     // 1 hr (categories, orgs, networks)

async function getDnsFilter(prisma: Parameters<typeof ConnectorFactory.get>[1]) {
  return ConnectorFactory.get("dns_security", prisma) as unknown as IDnsSecurityConnector;
}

export const dnsFilterRouter = router({
  // ─── Threats (for Alerts page) ──────────────────────────

  getThreats: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        organizationIds: z.array(z.string()).optional(),
        networkIds: z.array(z.string()).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgKey = input.organizationIds?.join(",") ?? "all";
      const key = `threats:${orgKey}:${input.page}:${input.pageSize}:${input.from?.toISOString().substring(0, 10) ?? "30d"}`;
      return cachedQuery("dnsfilter", THREAT_STALE, key, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getThreats({
          from: input.from,
          to: input.to,
          organizationIds: input.organizationIds,
          networkIds: input.networkIds,
          page: input.page,
          pageSize: input.pageSize,
        });
      });
    }),

  getThreatSummary: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const fromKey = input.from?.toISOString().substring(0, 10) ?? "30d";
      return cachedQuery("dnsfilter", THREAT_STALE, `threat-summary:${fromKey}`, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getThreatSummary(input.from, input.to);
      });
    }),

  // ─── Traffic Reports (for Network deep dive) ───────────

  getTrafficSummary: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        organizationIds: z.array(z.string()).optional(),
        networkIds: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const fromKey = input.from?.toISOString().substring(0, 10) ?? "7d";
      const orgKey = input.organizationIds?.join(",") ?? "all";
      return cachedQuery("dnsfilter", TRAFFIC_STALE, `traffic:${orgKey}:${fromKey}`, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getTrafficSummary({
          from: input.from,
          to: input.to,
          organizationIds: input.organizationIds,
          networkIds: input.networkIds,
        });
      });
    }),

  getTopDomains: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        organizationIds: z.array(z.string()).optional(),
        networkIds: z.array(z.string()).optional(),
        type: z.enum(["all", "allowed", "blocked"]).default("all"),
        securityReport: z.boolean().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const fromKey = input.from?.toISOString().substring(0, 10) ?? "7d";
      const orgKey = input.organizationIds?.join(",") ?? "all";
      const key = `top-domains:${orgKey}:${fromKey}:${input.type}:${input.securityReport ?? ""}:${input.page}`;
      return cachedQuery("dnsfilter", TRAFFIC_STALE, key, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getTopDomains({
          from: input.from,
          to: input.to,
          organizationIds: input.organizationIds,
          networkIds: input.networkIds,
          type: input.type,
          securityReport: input.securityReport,
          page: input.page,
          pageSize: input.pageSize,
        });
      });
    }),

  getTopCategories: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        organizationIds: z.array(z.string()).optional(),
        networkIds: z.array(z.string()).optional(),
        type: z.enum(["all", "allowed", "blocked"]).default("all"),
        securityReport: z.boolean().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const fromKey = input.from?.toISOString().substring(0, 10) ?? "7d";
      const orgKey = input.organizationIds?.join(",") ?? "all";
      const key = `top-categories:${orgKey}:${fromKey}:${input.type}:${input.securityReport ?? ""}:${input.page}`;
      return cachedQuery("dnsfilter", TRAFFIC_STALE, key, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getTopCategories({
          from: input.from,
          to: input.to,
          organizationIds: input.organizationIds,
          networkIds: input.networkIds,
          type: input.type,
          securityReport: input.securityReport,
          page: input.page,
          pageSize: input.pageSize,
        });
      });
    }),

  getQueryLogs: protectedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        organizationIds: z.array(z.string()).optional(),
        networkIds: z.array(z.string()).optional(),
        securityReport: z.boolean().optional(),
        type: z.enum(["all", "allowed", "blocked"]).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getQueryLogs({
        from: input.from,
        to: input.to,
        organizationIds: input.organizationIds,
        networkIds: input.networkIds,
        securityReport: input.securityReport,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  // ─── Organizations & Networks ──────────────────────────

  getOrganizations: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "organizations", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getOrganizations();
    });
  }),

  getNetworks: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "networks", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getNetworks();
    });
  }),

  // ─── Policies ─────────────────────────────────────────

  getPolicies: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "policies", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getPolicies();
    });
  }),

  getPolicyDetail: protectedProcedure
    .input(z.object({ policyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getPolicyDetail(input.policyId);
    }),

  addAllowDomain: adminProcedure
    .input(z.object({ policyId: z.string(), domain: z.string().min(1), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.addAllowDomain(input.policyId, input.domain);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.domain.allowed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { domain: input.domain, ...(input.note ? { note: input.note } : {}) },
      });
      return { success: true };
    }),

  addBlockDomain: adminProcedure
    .input(z.object({ policyId: z.string(), domain: z.string().min(1), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.addBlockDomain(input.policyId, input.domain);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.domain.blocked",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { domain: input.domain, ...(input.note ? { note: input.note } : {}) },
      });
      return { success: true };
    }),

  // ─── Universal List (DB-backed) ──────────────────────────

  getUniversalList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.dnsUniversalListEntry.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  addUniversalDomain: adminProcedure
    .input(z.object({
      domain: z.string().min(1),
      rule: z.enum(["allow", "block"]),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const domain = input.domain.trim().toLowerCase();

      // Store in our DB
      const entry = await ctx.prisma.dnsUniversalListEntry.create({
        data: {
          domain,
          rule: input.rule,
          note: input.note?.trim() || null,
          addedBy: ctx.user.id,
        },
      });

      // Bulk-add to ALL DNSFilter policies
      const dns = await getDnsFilter(ctx.prisma);
      const allPolicies = await dns.getPolicies();
      const results: { policyId: string; policyName: string; success: boolean }[] = [];

      for (const policy of allPolicies) {
        try {
          if (input.rule === "allow") {
            await dns.addAllowDomain(policy.id, domain);
          } else {
            await dns.addBlockDomain(policy.id, domain);
          }
          results.push({ policyId: policy.id, policyName: policy.name, success: true });
        } catch {
          results.push({ policyId: policy.id, policyName: policy.name, success: false });
        }
      }

      await invalidatePoliciesCache();
      await auditLog({
        action: `dns_filter.universal.domain.${input.rule === "allow" ? "allowed" : "blocked"}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: "universal",
        detail: {
          domain,
          rule: input.rule,
          policiesUpdated: results.filter((r) => r.success).length,
          policiesTotal: allPolicies.length,
          ...(input.note ? { note: input.note } : {}),
        },
      });

      return { success: true, entry, results };
    }),

  removeUniversalDomain: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch the entry first so we know the domain + rule
      const entry = await ctx.prisma.dnsUniversalListEntry.findUnique({
        where: { id: input.id },
      });
      if (!entry) throw new Error("Universal list entry not found");

      // Delete from our DB
      await ctx.prisma.dnsUniversalListEntry.delete({ where: { id: input.id } });

      // Bulk-remove from ALL DNSFilter policies (silent failures OK)
      const dns = await getDnsFilter(ctx.prisma);
      const allPolicies = await dns.getPolicies();
      let removed = 0;

      for (const policy of allPolicies) {
        try {
          if (entry.rule === "allow") {
            await dns.removeAllowDomain(policy.id, entry.domain);
          } else {
            await dns.removeBlockDomain(policy.id, entry.domain);
          }
          removed++;
        } catch {
          // Domain may have been manually removed from this policy — that's fine
        }
      }

      await invalidatePoliciesCache();
      await auditLog({
        action: `dns_filter.universal.domain.${entry.rule === "allow" ? "allow_removed" : "block_removed"}`,
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: "universal",
        detail: {
          domain: entry.domain,
          rule: entry.rule,
          policiesUpdated: removed,
          policiesTotal: allPolicies.length,
        },
      });

      return { success: true, removed, total: allPolicies.length };
    }),

  removeAllowDomain: adminProcedure
    .input(z.object({ policyId: z.string(), domain: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.removeAllowDomain(input.policyId, input.domain);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.domain.allow_removed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { domain: input.domain },
      });
      return { success: true };
    }),

  removeBlockDomain: adminProcedure
    .input(z.object({ policyId: z.string(), domain: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.removeBlockDomain(input.policyId, input.domain);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.domain.block_removed",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { domain: input.domain },
      });
      return { success: true };
    }),

  // ─── Policy Editing ──────────────────────────────────

  updatePolicy: adminProcedure
    .input(z.object({
      policyId: z.string(),
      updates: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      const result = await dns.updatePolicy(input.policyId, input.updates);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { updates: input.updates },
      });
      return result;
    }),

  addBlockedCategory: adminProcedure
    .input(z.object({ policyId: z.string(), categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.addBlockedCategory(input.policyId, input.categoryId);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.category.blocked",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { categoryId: input.categoryId },
      });
      return { success: true };
    }),

  removeBlockedCategory: adminProcedure
    .input(z.object({ policyId: z.string(), categoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.removeBlockedCategory(input.policyId, input.categoryId);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.category.unblocked",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { categoryId: input.categoryId },
      });
      return { success: true };
    }),

  addBlockedApplication: adminProcedure
    .input(z.object({ policyId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.addBlockedApplication(input.policyId, input.name);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.app.blocked",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { app: input.name },
      });
      return { success: true };
    }),

  removeBlockedApplication: adminProcedure
    .input(z.object({ policyId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.removeBlockedApplication(input.policyId, input.name);
      await invalidatePoliciesCache();
      await auditLog({
        action: "dns_filter.policy.app.unblocked",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `policy:${input.policyId}`,
        detail: { app: input.name },
      });
      return { success: true };
    }),

  // ─── Block Pages ───────────────────────────────────────

  getBlockPages: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "block-pages", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getBlockPages();
    });
  }),

  getBlockPageDetail: protectedProcedure
    .input(z.object({ blockPageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getBlockPageDetail(input.blockPageId);
    }),

  updateBlockPage: adminProcedure
    .input(z.object({
      blockPageId: z.string(),
      name: z.string().optional(),
      orgName: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      const updates: { name?: string; block_org_name?: string | null; block_email_addr?: string | null } = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.orgName !== undefined) updates.block_org_name = input.orgName;
      if (input.email !== undefined) updates.block_email_addr = input.email;
      const result = await dns.updateBlockPage(input.blockPageId, updates);
      await invalidateBlockPagesCache();
      await auditLog({
        action: "dns_filter.block_page.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `block_page:${input.blockPageId}`,
        detail: updates,
      });
      return result;
    }),

  // ─── Scheduled Policies ────────────────────────────────

  getScheduledPolicies: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "scheduled-policies", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getScheduledPolicies();
    });
  }),

  // ─── Network Detail / Local Domains / Resolvers ────────

  getNetworkDetail: protectedProcedure
    .input(z.object({ networkId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getNetworkDetail(input.networkId);
    }),

  updateLocalDomains: adminProcedure
    .input(z.object({ networkId: z.string(), domains: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.updateNetworkLocalDomains(input.networkId, input.domains);
      await invalidateNetworksCache();
      await auditLog({
        action: "dns_filter.network.local_domains.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `network:${input.networkId}`,
        detail: { domains: input.domains },
      });
      return { success: true };
    }),

  updateLocalResolvers: adminProcedure
    .input(z.object({ networkId: z.string(), resolvers: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      await dns.updateNetworkLocalResolvers(input.networkId, input.resolvers);
      await invalidateNetworksCache();
      await auditLog({
        action: "dns_filter.network.local_resolvers.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `network:${input.networkId}`,
        detail: { resolvers: input.resolvers },
      });
      return { success: true };
    }),

  // ─── Agent Cleanup ─────────────────────────────────────

  cleanupInactiveAgents: adminProcedure
    .input(z.object({
      organizationIds: z.array(z.string()),
      inactiveForDays: z.number().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      const result = await dns.cleanupInactiveAgents(input.organizationIds, input.inactiveForDays);
      await auditLog({
        action: "dns_filter.agents.cleanup",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: "agents",
        detail: { organizationIds: input.organizationIds, inactiveForDays: input.inactiveForDays, toDeleteCount: result.toDeleteCount },
      });
      return result;
    }),

  getCleanupStatus: protectedProcedure
    .input(z.object({ cleanupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getCleanupStatus(input.cleanupId);
    }),

  // ─── User Agent Updates ────────────────────────────────

  updateUserAgent: adminProcedure
    .input(z.object({
      agentId: z.string(),
      policyId: z.number().nullable().optional(),
      scheduledPolicyId: z.number().nullable().optional(),
      blockPageId: z.number().nullable().optional(),
      friendlyName: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      const updates: Record<string, unknown> = {};
      if (input.policyId !== undefined) updates.policy_id = input.policyId;
      if (input.scheduledPolicyId !== undefined) updates.scheduled_policy_id = input.scheduledPolicyId;
      if (input.blockPageId !== undefined) updates.block_page_id = input.blockPageId;
      if (input.friendlyName !== undefined) updates.friendly_name = input.friendlyName;
      if (input.tags !== undefined) updates.tags = input.tags;
      await dns.updateUserAgent(input.agentId, updates);
      await auditLog({
        action: "dns_filter.agent.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `agent:${input.agentId}`,
        detail: updates,
      });
      return { success: true };
    }),

  // ─── Applications (AppAware) ───────────────────────────

  getApplications: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "applications", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getApplications();
    });
  }),

  getApplicationCategories: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "app-categories", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getApplicationCategories();
    });
  }),

  // ─── Roaming Clients ──────────────────────────────────

  getRoamingClients: protectedProcedure
    .input(
      z.object({
        organizationIds: z.array(z.string()).optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getRoamingClients({
        organizationIds: input.organizationIds,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  getAgentCounts: protectedProcedure
    .input(
      z.object({
        organizationIds: z.array(z.string()).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const orgKey = input?.organizationIds?.join(",") ?? "all";
      return cachedQuery("dnsfilter", THREAT_STALE, `agent-counts:${orgKey}`, async () => {
        const dns = await getDnsFilter(ctx.prisma);
        return dns.getAgentCounts(input?.organizationIds);
      });
    }),

  // ─── Users ──────────────────────────────────────────────

  getUsers: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "users", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getUsers();
    });
  }),

  // ─── Reference Data ────────────────────────────────────

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    return cachedQuery("dnsfilter", REF_STALE, "categories", async () => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.getCategories();
    });
  }),

  lookupDomain: protectedProcedure
    .input(z.object({ fqdn: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const dns = await getDnsFilter(ctx.prisma);
      return dns.lookupDomain(input.fqdn);
    }),
});
