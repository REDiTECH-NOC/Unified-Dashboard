import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { hasPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

// Middleware that checks quicklinks.manage permission
const manageProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const allowed = await hasPermission(ctx.user.id, "quicklinks.manage");
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Quick links management permission required" });
  }
  return next({ ctx });
});

// ── Merge logic: combine items from multiple groups, dedup by title (folders) / url (links) ──

type RawItem = {
  id: string;
  type: string;
  title: string;
  url: string | null;
  sortOrder: number;
  parentId: string | null;
  children: RawItem[];
};

type MergedItem = {
  type: "FOLDER" | "LINK";
  title: string;
  url: string | null;
  children: MergedItem[];
};

function mergeItemLists(allItems: RawItem[][]): MergedItem[] {
  const folderMap = new Map<string, MergedItem>();
  const linkUrls = new Set<string>();
  const result: MergedItem[] = [];

  for (const items of allItems) {
    // Process root items (parentId === null)
    const roots = items.filter((i) => !i.parentId);
    roots.sort((a, b) => a.sortOrder - b.sortOrder);

    for (const item of roots) {
      if (item.type === "FOLDER") {
        const key = item.title.toLowerCase();
        if (!folderMap.has(key)) {
          const folder: MergedItem = { type: "FOLDER", title: item.title, url: null, children: [] };
          folderMap.set(key, folder);
          result.push(folder);
        }
        // Merge children into this folder
        const folder = folderMap.get(key)!;
        mergeChildren(folder, item.children);
      } else if (item.type === "LINK" && item.url) {
        if (!linkUrls.has(item.url)) {
          linkUrls.add(item.url);
          result.push({ type: "LINK", title: item.title, url: item.url, children: [] });
        }
      }
    }
  }
  return result;
}

function mergeChildren(folder: MergedItem, children: RawItem[]) {
  const existingUrls = new Set(folder.children.filter((c) => c.type === "LINK" && c.url).map((c) => c.url!));
  const subFolderMap = new Map<string, MergedItem>();
  for (const c of folder.children) {
    if (c.type === "FOLDER") subFolderMap.set(c.title.toLowerCase(), c);
  }

  const sorted = [...children].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of sorted) {
    if (child.type === "LINK" && child.url && !existingUrls.has(child.url)) {
      existingUrls.add(child.url);
      folder.children.push({ type: "LINK", title: child.title, url: child.url, children: [] });
    } else if (child.type === "FOLDER") {
      const key = child.title.toLowerCase();
      if (!subFolderMap.has(key)) {
        const subFolder: MergedItem = { type: "FOLDER", title: child.title, url: null, children: [] };
        subFolderMap.set(key, subFolder);
        folder.children.push(subFolder);
      }
      // Merge sub-folder children (links only at this depth — no deeper nesting)
      const subFolder = subFolderMap.get(key)!;
      const subExistingUrls = new Set(subFolder.children.filter((c) => c.url).map((c) => c.url!));
      for (const subChild of child.children) {
        if (subChild.type === "LINK" && subChild.url && !subExistingUrls.has(subChild.url)) {
          subExistingUrls.add(subChild.url);
          subFolder.children.push({ type: "LINK", title: subChild.title, url: subChild.url, children: [] });
        }
      }
    }
  }
}

// Build nested tree from flat item list
function buildTree(flatItems: { id: string; type: string; title: string; url: string | null; sortOrder: number; parentId: string | null }[]): RawItem[] {
  const map = new Map<string, RawItem>();
  const roots: RawItem[] = [];

  for (const item of flatItems) {
    map.set(item.id, { ...item, children: [] });
  }
  for (const item of flatItems) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export const quicklinksRouter = router({
  // ── User-facing: get merged links visible to current user ──
  getMyLinks: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { role: true },
    });
    if (!user) return { items: [] };

    const assignments = await ctx.prisma.quickLinkAssignment.findMany({
      where: {
        OR: [
          { role: user.role },
          { userId: ctx.user.id },
        ],
      },
      select: { groupId: true },
    });

    const groupIds = Array.from(new Set(assignments.map((a) => a.groupId)));
    if (groupIds.length === 0) return { items: [] };

    // Fetch all items for all assigned groups
    const allItems = await ctx.prisma.quickLinkItem.findMany({
      where: { groupId: { in: groupIds } },
      orderBy: { sortOrder: "asc" },
    });

    // Build tree per group, then merge
    const groupedItems: Map<string, typeof allItems> = new Map();
    for (const item of allItems) {
      if (!groupedItems.has(item.groupId)) groupedItems.set(item.groupId, []);
      groupedItems.get(item.groupId)!.push(item);
    }

    const treesPerGroup: RawItem[][] = [];
    for (const groupId of groupIds) {
      const items = groupedItems.get(groupId) ?? [];
      treesPerGroup.push(buildTree(items));
    }

    const merged = mergeItemLists(treesPerGroup);
    return { items: merged };
  }),

  canManage: protectedProcedure.query(async ({ ctx }) => {
    return hasPermission(ctx.user.id, "quicklinks.manage");
  }),

  // ── Admin: list everything ──
  listAll: manageProcedure.query(async ({ ctx }) => {
    const groups = await ctx.prisma.quickLinkGroup.findMany({
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    return groups;
  }),

  // ── Group CRUD ──
  createGroup: manageProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.prisma.quickLinkGroup.aggregate({ _max: { sortOrder: true } });
      const group = await ctx.prisma.quickLinkGroup.create({
        data: {
          name: input.name,
          description: input.description,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          createdBy: ctx.user.id,
        },
      });
      await auditLog({ action: "quicklinks.group.created", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + group.id, detail: { name: input.name } });
      return group;
    }),

  updateGroup: manageProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100).optional(), description: z.string().max(500).optional().nullable(), sortOrder: z.number().int().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const group = await ctx.prisma.quickLinkGroup.update({ where: { id }, data });
      await auditLog({ action: "quicklinks.group.updated", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + id, detail: data });
      return group;
    }),

  deleteGroup: manageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const group = await ctx.prisma.quickLinkGroup.delete({ where: { id: input.id } });
      await auditLog({ action: "quicklinks.group.deleted", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + input.id, detail: { name: group.name } });
      return { success: true };
    }),

  copyGroup: manageProcedure
    .input(z.object({ id: z.string(), newName: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.quickLinkGroup.findUnique({
        where: { id: input.id },
        include: { items: true },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Group not found" });

      const maxOrder = await ctx.prisma.quickLinkGroup.aggregate({ _max: { sortOrder: true } });
      const newGroup = await ctx.prisma.quickLinkGroup.create({
        data: {
          name: input.newName,
          description: source.description,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          createdBy: ctx.user.id,
        },
      });

      // Copy items preserving parent structure
      // First pass: create all items, building old→new ID map
      const idMap = new Map<string, string>();
      // Root items first
      const roots = source.items.filter((i) => !i.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
      for (const item of roots) {
        const created = await ctx.prisma.quickLinkItem.create({
          data: { groupId: newGroup.id, type: item.type, title: item.title, url: item.url, sortOrder: item.sortOrder, createdBy: ctx.user.id },
        });
        idMap.set(item.id, created.id);
      }
      // Children (1 level)
      const children = source.items.filter((i) => i.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
      for (const item of children) {
        const newParentId = idMap.get(item.parentId!);
        if (newParentId) {
          const created = await ctx.prisma.quickLinkItem.create({
            data: { groupId: newGroup.id, parentId: newParentId, type: item.type, title: item.title, url: item.url, sortOrder: item.sortOrder, createdBy: ctx.user.id },
          });
          idMap.set(item.id, created.id);
        }
      }
      // Deepest level (sub-folder children)
      const deepChildren = source.items.filter((i) => i.parentId && !idMap.has(i.id));
      for (const item of deepChildren) {
        const newParentId = idMap.get(item.parentId!);
        if (newParentId) {
          await ctx.prisma.quickLinkItem.create({
            data: { groupId: newGroup.id, parentId: newParentId, type: item.type, title: item.title, url: item.url, sortOrder: item.sortOrder, createdBy: ctx.user.id },
          });
        }
      }

      await auditLog({ action: "quicklinks.group.copied", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + newGroup.id, detail: { sourceId: input.id, sourceName: source.name, newName: input.newName } });
      return newGroup;
    }),

  // ── Item CRUD (folders + links) ──
  createItem: manageProcedure
    .input(z.object({
      groupId: z.string(),
      parentId: z.string().optional(),
      type: z.enum(["FOLDER", "LINK"]),
      title: z.string().min(1).max(200),
      url: z.string().url().max(2000).optional(),
    }).refine((d) => d.type === "LINK" ? !!d.url : true, { message: "URL required for links" }))
    .mutation(async ({ ctx, input }) => {
      // Enforce max nesting: if parent is already inside a folder, limit depth
      if (input.parentId) {
        const parent = await ctx.prisma.quickLinkItem.findUnique({ where: { id: input.parentId }, select: { parentId: true, type: true } });
        if (!parent || parent.type !== "FOLDER") throw new TRPCError({ code: "BAD_REQUEST", message: "Parent must be a folder" });
        if (parent.parentId && input.type === "FOLDER") throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum folder depth is 2 levels" });
      }

      const maxOrder = await ctx.prisma.quickLinkItem.aggregate({
        where: { groupId: input.groupId, parentId: input.parentId ?? null },
        _max: { sortOrder: true },
      });

      const item = await ctx.prisma.quickLinkItem.create({
        data: {
          groupId: input.groupId,
          parentId: input.parentId ?? null,
          type: input.type,
          title: input.title,
          url: input.url ?? null,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({ action: `quicklinks.${input.type.toLowerCase()}.created`, category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-item:" + item.id, detail: { groupId: input.groupId, title: input.title, type: input.type } });
      return item;
    }),

  updateItem: manageProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      url: z.string().url().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await ctx.prisma.quickLinkItem.update({ where: { id }, data });
      await auditLog({ action: "quicklinks.item.updated", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-item:" + id, detail: data });
      return item;
    }),

  deleteItem: manageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.quickLinkItem.delete({ where: { id: input.id } });
      await auditLog({ action: `quicklinks.${item.type.toLowerCase()}.deleted`, category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-item:" + input.id, detail: { title: item.title } });
      return { success: true };
    }),

  moveItem: manageProcedure
    .input(z.object({
      id: z.string(),
      newParentId: z.string().nullable(), // null = move to root
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate nesting depth
      if (input.newParentId) {
        const parent = await ctx.prisma.quickLinkItem.findUnique({ where: { id: input.newParentId }, select: { parentId: true, type: true } });
        if (!parent || parent.type !== "FOLDER") throw new TRPCError({ code: "BAD_REQUEST", message: "Target must be a folder" });
        const item = await ctx.prisma.quickLinkItem.findUnique({ where: { id: input.id }, select: { type: true } });
        if (item?.type === "FOLDER" && parent.parentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot nest folder more than 2 levels deep" });
      }
      const item = await ctx.prisma.quickLinkItem.update({
        where: { id: input.id },
        data: { parentId: input.newParentId },
      });
      await auditLog({ action: "quicklinks.item.moved", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-item:" + input.id, detail: { newParentId: input.newParentId } });
      return item;
    }),

  reorderItems: manageProcedure
    .input(z.object({
      parentId: z.string().nullable(),
      groupId: z.string(),
      itemIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.itemIds.map((id, index) =>
          ctx.prisma.quickLinkItem.update({ where: { id }, data: { sortOrder: index } })
        )
      );
      await auditLog({ action: "quicklinks.items.reordered", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + input.groupId, detail: { count: input.itemIds.length } });
      return { success: true };
    }),

  // ── Assignment management ──
  assignGroup: manageProcedure
    .input(z.object({
      groupId: z.string(),
      role: z.enum(["ADMIN", "MANAGER", "USER", "CLIENT"]).optional(),
      userId: z.string().optional(),
    }).refine((d) => (d.role && !d.userId) || (!d.role && d.userId), { message: "Provide either role or userId, not both" }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.quickLinkAssignment.create({
        data: { groupId: input.groupId, role: input.role ?? null, userId: input.userId ?? null, assignedBy: ctx.user.id },
      });
      await auditLog({ action: "quicklinks.group.assigned", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + input.groupId, detail: { role: input.role, userId: input.userId } });
      return assignment;
    }),

  unassignGroup: manageProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.quickLinkAssignment.delete({ where: { id: input.id } });
      await auditLog({ action: "quicklinks.group.unassigned", category: "SYSTEM", actorId: ctx.user.id, resource: "quicklink-group:" + assignment.groupId, detail: { role: assignment.role, userId: assignment.userId } });
      return { success: true };
    }),
});
