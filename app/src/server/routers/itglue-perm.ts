/**
 * IT Glue Permission Router — admin CRUD for IT Glue access control.
 *
 * Manages: permission groups, rules, user/role assignments, cached data, sync.
 */

import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import {
  resolveITGlueAccess,
  getITGlueGroupsForUser,
} from "@/lib/itglue-permissions";
import { runITGlueSync, getSyncProgress } from "../services/itglue-sync";
import { ConnectorFactory } from "../connectors/factory";

const accessModeEnum = z.enum(["READ_WRITE", "READ_ONLY", "DENIED"]);
const sectionEnum = z.enum(["passwords", "flexible_assets", "configurations", "contacts", "documents"]);

export const itGluePermRouter = router({
  // ─── Permission Group CRUD ──────────────────────────────────────

  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.iTGluePermissionGroup.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            rules: true,
            users: true,
            roles: true,
          },
        },
      },
    });
  }),

  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.prisma.iTGluePermissionGroup.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          rules: { orderBy: [{ orgId: "asc" }, { section: "asc" }, { categoryId: "asc" }] },
          users: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          roles: {
            include: { permissionRole: { select: { id: true, name: true } } },
          },
        },
      });

      // Enrich rules with cached org/category names for display
      const orgIds = [...new Set(group.rules.map((r) => r.orgId))];
      const cachedOrgs = await ctx.prisma.iTGlueCachedOrg.findMany({
        where: { itGlueId: { in: orgIds } },
        select: { itGlueId: true, name: true },
      });
      const orgNameMap = new Map(cachedOrgs.map((o) => [o.itGlueId, o.name]));

      const enrichedRules = group.rules.map((r) => ({
        ...r,
        orgName: orgNameMap.get(r.orgId) ?? r.orgId,
      }));

      return { ...group, rules: enrichedRules };
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.iTGluePermissionGroup.create({
        data: {
          name: input.name,
          description: input.description,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "itglue_perm_group.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${group.id}`,
        detail: { name: group.name },
      });

      return group;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const group = await ctx.prisma.iTGluePermissionGroup.update({
        where: { id },
        data,
      });

      await auditLog({
        action: "itglue_perm_group.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${group.id}`,
        detail: { name: group.name, fields: Object.keys(data) },
      });

      return group;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.iTGluePermissionGroup.delete({
        where: { id: input.id },
      });

      await auditLog({
        action: "itglue_perm_group.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${group.id}`,
        detail: { name: group.name },
      });

      return { success: true };
    }),

  // ─── Permission Rule CRUD ───────────────────────────────────────

  addRule: adminProcedure
    .input(z.object({
      groupId: z.string(),
      orgId: z.string(),
      section: sectionEnum.nullable().optional(),
      categoryId: z.string().nullable().optional(),
      assetId: z.string().nullable().optional(),
      accessMode: accessModeEnum.default("READ_WRITE"),
    }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.iTGluePermissionRule.create({
        data: {
          groupId: input.groupId,
          orgId: input.orgId,
          section: input.section ?? null,
          categoryId: input.categoryId ?? null,
          assetId: input.assetId ?? null,
          accessMode: input.accessMode,
        },
      });

      await auditLog({
        action: "itglue_perm_rule.created",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_rule:${rule.id}`,
        detail: {
          groupId: input.groupId,
          orgId: input.orgId,
          section: input.section,
          categoryId: input.categoryId,
          assetId: input.assetId,
          accessMode: input.accessMode,
        },
      });

      return rule;
    }),

  updateRule: adminProcedure
    .input(z.object({
      id: z.string(),
      accessMode: accessModeEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.iTGluePermissionRule.update({
        where: { id: input.id },
        data: { accessMode: input.accessMode },
      });

      await auditLog({
        action: "itglue_perm_rule.updated",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_rule:${rule.id}`,
        detail: { accessMode: input.accessMode },
      });

      return rule;
    }),

  removeRule: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.iTGluePermissionRule.delete({
        where: { id: input.id },
      });

      await auditLog({
        action: "itglue_perm_rule.deleted",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_rule:${rule.id}`,
        detail: { orgId: rule.orgId, section: rule.section },
      });

      return { success: true };
    }),

  bulkSetRules: adminProcedure
    .input(z.object({
      groupId: z.string(),
      rules: z.array(z.object({
        orgId: z.string(),
        section: sectionEnum.nullable().optional(),
        categoryId: z.string().nullable().optional(),
        assetId: z.string().nullable().optional(),
        accessMode: accessModeEnum.default("READ_WRITE"),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Transaction: delete all existing rules for this group, then create new ones
      await ctx.prisma.$transaction(async (tx) => {
        await tx.iTGluePermissionRule.deleteMany({
          where: { groupId: input.groupId },
        });

        if (input.rules.length > 0) {
          await tx.iTGluePermissionRule.createMany({
            data: input.rules.map((r) => ({
              groupId: input.groupId,
              orgId: r.orgId,
              section: r.section ?? null,
              categoryId: r.categoryId ?? null,
              assetId: r.assetId ?? null,
              accessMode: r.accessMode,
            })),
          });
        }
      });

      await auditLog({
        action: "itglue_perm_rules.bulk_set",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${input.groupId}`,
        detail: { ruleCount: input.rules.length },
      });

      return { success: true, ruleCount: input.rules.length };
    }),

  // ─── Assignments ────────────────────────────────────────────────

  assignToUser: adminProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.iTGluePermissionGroupUser.create({
        data: {
          groupId: input.groupId,
          userId: input.userId,
          assignedBy: ctx.user.id,
        },
        include: {
          group: { select: { name: true } },
          user: { select: { email: true } },
        },
      });

      await auditLog({
        action: "itglue_perm_group.assigned_user",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${input.groupId}`,
        detail: { userId: input.userId, userEmail: assignment.user.email, groupName: assignment.group.name },
      });

      return assignment;
    }),

  removeFromUser: adminProcedure
    .input(z.object({ groupId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.iTGluePermissionGroupUser.delete({
        where: { groupId_userId: { groupId: input.groupId, userId: input.userId } },
      });

      await auditLog({
        action: "itglue_perm_group.removed_user",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${input.groupId}`,
        detail: { userId: input.userId },
      });

      return { success: true };
    }),

  assignToRole: adminProcedure
    .input(z.object({ groupId: z.string(), permissionRoleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.iTGluePermissionGroupRole.create({
        data: {
          groupId: input.groupId,
          permissionRoleId: input.permissionRoleId,
          assignedBy: ctx.user.id,
        },
        include: {
          group: { select: { name: true } },
          permissionRole: { select: { name: true } },
        },
      });

      await auditLog({
        action: "itglue_perm_group.assigned_role",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${input.groupId}`,
        detail: { permissionRoleId: input.permissionRoleId, roleName: assignment.permissionRole.name, groupName: assignment.group.name },
      });

      return assignment;
    }),

  removeFromRole: adminProcedure
    .input(z.object({ groupId: z.string(), permissionRoleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.iTGluePermissionGroupRole.delete({
        where: { groupId_permissionRoleId: { groupId: input.groupId, permissionRoleId: input.permissionRoleId } },
      });

      await auditLog({
        action: "itglue_perm_group.removed_role",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: `itglue_perm_group:${input.groupId}`,
        detail: { permissionRoleId: input.permissionRoleId },
      });

      return { success: true };
    }),

  // ─── Testing / Debugging ────────────────────────────────────────

  testAccess: adminProcedure
    .input(z.object({
      userId: z.string(),
      orgId: z.string(),
      section: sectionEnum.optional(),
      categoryId: z.string().optional(),
      assetId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const result = await resolveITGlueAccess(
        input.userId,
        input.orgId,
        input.section,
        input.categoryId,
        input.assetId
      );

      const groups = await getITGlueGroupsForUser(input.userId);

      return { ...result, userGroups: groups };
    }),

  getUserGroups: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return getITGlueGroupsForUser(input.userId);
    }),

  // ─── Cached Data for Permission UI ──────────────────────────────

  getCachedOrgs: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.iTGlueCachedOrg.findMany({
      orderBy: { name: "asc" },
      select: { itGlueId: true, name: true, status: true, shortName: true, companyId: true, orgType: true },
    });
  }),

  getCachedAssetTypes: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.iTGlueCachedFlexibleAssetType.findMany({
      orderBy: { name: "asc" },
      select: { itGlueId: true, name: true, description: true },
    });
  }),

  getCachedPasswordCategories: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.iTGlueCachedPasswordCategory.findMany({
      orderBy: { name: "asc" },
      select: { itGlueId: true, name: true },
    });
  }),

  getCachedAssets: adminProcedure
    .input(z.object({
      orgId: z.string(),
      section: sectionEnum,
      categoryId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.iTGlueCachedAsset.findMany({
        where: {
          orgId: input.orgId,
          section: input.section,
          ...(input.categoryId && { categoryId: input.categoryId }),
        },
        orderBy: { name: "asc" },
        select: { itGlueId: true, name: true, categoryId: true, categoryName: true },
      });
    }),

  // Return flexible asset type categories that actually exist for a specific org
  getOrgSectionCategories: adminProcedure
    .input(z.object({
      orgId: z.string(),
      section: z.enum(["flexible_assets", "documents"]),
    }))
    .query(async ({ ctx, input }) => {
      // First check if we have cached assets for this org+section — derive categories from those
      const cachedCategories = await ctx.prisma.iTGlueCachedAsset.groupBy({
        by: ["categoryId", "categoryName"],
        where: {
          orgId: input.orgId,
          section: input.section,
          categoryId: { not: null },
        },
        _count: { _all: true },
      });

      if (cachedCategories.length > 0) {
        return cachedCategories
          .filter((c) => c.categoryId !== null)
          .map((c) => ({
            itGlueId: c.categoryId!,
            name: c.categoryName ?? c.categoryId!,
            count: c._count._all,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // Cache empty — query IT Glue API to discover categories for this org
      try {
        const connector = await ConnectorFactory.get("documentation", ctx.prisma);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = connector as any;

        // Section-specific API config
        const isFlexAssets = input.section === "flexible_assets";
        const catIdKey = isFlexAssets ? "flexible-asset-type-id" : "document-folder-id";
        const catNameKey = isFlexAssets ? "flexible-asset-type-name" : "document-folder-name";

        // Flexible assets use flat endpoint with filter (relationship path returns 404)
        // Documents use org-scoped relationship path
        const res = await raw.requestListRaw({
          path: isFlexAssets
            ? "/flexible_assets"
            : `/organizations/${input.orgId}/relationships/documents`,
          page: 1,
          pageSize: 1000,
          ...(isFlexAssets && { filters: { "organization-id": input.orgId } }),
        });

        // Extract distinct flexible asset type categories
        const categoryMap = new Map<string, { name: string; count: number }>();
        for (const item of (res.data ?? [])) {
          const catId = item.attributes?.[catIdKey];
          const catName = item.attributes?.[catNameKey];
          if (catId) {
            const key = String(catId);
            const existing = categoryMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              categoryMap.set(key, { name: (catName as string) ?? key, count: 1 });
            }
          }
        }

        // Also cache these assets for future use
        const items = ((res.data ?? []) as { id: string; attributes: Record<string, unknown> }[]).map((r) => ({
          sourceId: r.id,
          name: (r.attributes.name as string) || `Asset ${r.id}`,
          catId: r.attributes[catIdKey] ? String(r.attributes[catIdKey]) : null,
          catName: r.attributes[catNameKey] ? String(r.attributes[catNameKey]) : null,
        }));

        if (items.length > 0) {
          await Promise.all(
            items.map((a) =>
              ctx.prisma.iTGlueCachedAsset.upsert({
                where: { itGlueId: a.sourceId },
                create: {
                  itGlueId: a.sourceId,
                  orgId: input.orgId,
                  section: input.section,
                  categoryId: a.catId,
                  categoryName: a.catName,
                  name: a.name,
                  syncedAt: new Date(),
                },
                update: {
                  name: a.name,
                  section: input.section,
                  categoryId: a.catId,
                  categoryName: a.catName,
                  syncedAt: new Date(),
                },
              })
            )
          );
        }

        return Array.from(categoryMap.entries())
          .map(([id, data]) => ({
            itGlueId: id,
            name: data.name,
            count: data.count,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
      } catch (err) {
        console.error("[getOrgSectionCategories] Failed for org", input.orgId, input.section, err);
        return [];
      }
    }),

  // Live-fetch assets from IT Glue API when cache is empty, then cache them
  fetchSectionAssets: adminProcedure
    .input(z.object({
      orgId: z.string(),
      section: sectionEnum,
      categoryId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Check cache first
      const cached = await ctx.prisma.iTGlueCachedAsset.findMany({
        where: {
          orgId: input.orgId,
          section: input.section,
          ...(input.categoryId && { categoryId: input.categoryId }),
        },
        orderBy: { name: "asc" },
        select: { itGlueId: true, name: true, categoryId: true, categoryName: true },
      });

      if (cached.length > 0) return cached;

      // Cache empty — fetch from IT Glue API using raw requests for all types
      try {
        const connector = await ConnectorFactory.get("documentation", ctx.prisma);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = connector as any;

        // Map section to IT Glue API path and attribute keys
        // Note: Most sections use /organizations/{id}/relationships/{section} path
        //       but flexible_assets uses the flat /flexible_assets endpoint with filter (relationship path returns 404)
        const SECTION_CONFIG: Record<string, {
          path: string;
          useOrgFilter: boolean; // true = pass filter[organization-id] (for flat endpoints)
          sort?: string;
          catIdKey: string | null;
          catNameKey: string | null;
          nameExtractor: (attrs: Record<string, unknown>) => string;
          filterKey?: string;
        }> = {
          passwords: {
            path: `/organizations/${input.orgId}/relationships/passwords`,
            useOrgFilter: false,
            sort: "name",
            catIdKey: "password-category-id",
            catNameKey: "password-category-name",
            nameExtractor: (a) => (a.name as string) || "Unnamed",
            filterKey: "password-category-id",
          },
          flexible_assets: {
            path: "/flexible_assets",
            useOrgFilter: true, // flat endpoint needs org filter
            catIdKey: "flexible-asset-type-id",
            catNameKey: "flexible-asset-type-name",
            nameExtractor: (a) => (a.name as string) || "Asset",
            filterKey: "flexible-asset-type-id",
          },
          configurations: {
            path: `/organizations/${input.orgId}/relationships/configurations`,
            useOrgFilter: false,
            sort: "name",
            catIdKey: "configuration-type-id",
            catNameKey: "configuration-type-name",
            nameExtractor: (a) => (a.name as string) || (a.hostname as string) || "Unnamed",
          },
          contacts: {
            path: `/organizations/${input.orgId}/relationships/contacts`,
            useOrgFilter: false,
            sort: "last-name",
            catIdKey: "contact-type-id",
            catNameKey: "contact-type-name",
            nameExtractor: (a) => {
              const first = (a["first-name"] as string) || "";
              const last = (a["last-name"] as string) || "";
              return `${first} ${last}`.trim() || "Unnamed";
            },
          },
          documents: {
            path: `/organizations/${input.orgId}/relationships/documents`,
            useOrgFilter: false,
            catIdKey: "document-folder-id",
            catNameKey: "document-folder-name",
            nameExtractor: (a) => (a.name as string) || "Untitled",
          },
        };

        const config = SECTION_CONFIG[input.section];
        const filters: Record<string, string> = {};
        if (config.useOrgFilter) filters["organization-id"] = input.orgId;
        if (input.categoryId && config.filterKey) {
          filters[config.filterKey] = input.categoryId;
        }

        const res = await raw.requestListRaw({
          path: config.path,
          page: 1,
          pageSize: 500,
          ...(Object.keys(filters).length > 0 && { filters }),
          ...(config.sort && { sort: config.sort }),
        });

        type RawItem = { id: string; attributes: Record<string, unknown> };
        const items = ((res.data ?? []) as RawItem[]).map((r) => {
          const attrs = r.attributes;
          const catIdRaw = config.catIdKey ? attrs[config.catIdKey] : null;
          const catNameRaw = config.catNameKey ? attrs[config.catNameKey] : null;
          return {
            sourceId: r.id,
            name: config.nameExtractor(attrs),
            catId: catIdRaw ? String(catIdRaw) : null,
            catName: catNameRaw ? String(catNameRaw) : null,
          };
        });

        // Upsert into cache
        if (items.length > 0) {
          await Promise.all(
            items.map((a) =>
              ctx.prisma.iTGlueCachedAsset.upsert({
                where: { itGlueId: a.sourceId },
                create: {
                  itGlueId: a.sourceId,
                  orgId: input.orgId,
                  section: input.section,
                  categoryId: a.catId,
                  categoryName: a.catName,
                  name: a.name,
                  syncedAt: new Date(),
                },
                update: {
                  name: a.name,
                  section: input.section,
                  categoryId: a.catId,
                  categoryName: a.catName,
                  syncedAt: new Date(),
                },
              })
            )
          );
        }

        return items.map((a) => ({
          itGlueId: a.sourceId,
          name: a.name,
          categoryId: a.catId,
          categoryName: a.catName,
        }));
      } catch (err) {
        console.error("[fetchSectionAssets] Failed for", input.orgId, input.section, err);
        return [];
      }
    }),

  getSyncStatus: adminProcedure.query(async ({ ctx }) => {
    const states = await ctx.prisma.iTGlueSyncState.findMany();
    const progress = await getSyncProgress();

    const totalAssets = await ctx.prisma.iTGlueCachedAsset.count();
    const totalOrgs = await ctx.prisma.iTGlueCachedOrg.count();

    return { states, progress, totalAssets, totalOrgs };
  }),

  triggerSync: adminProcedure
    .input(z.object({
      mode: z.enum(["full", "incremental"]).default("full"),
    }))
    .mutation(async ({ ctx, input }) => {
      await auditLog({
        action: "itglue_sync.triggered",
        category: "INTEGRATION",
        actorId: ctx.user.id,
        detail: { mode: input.mode },
      });

      // Run sync (this can be long-running — in production you'd want a background job)
      const result = await runITGlueSync(ctx.prisma, input.mode);
      return result;
    }),
});
