import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS, getPermissionTree } from "@/lib/permissions";

export const permissionRoleRouter = router({
  // Return the hierarchical permission tree for admin UI
  getPermissionTree: adminProcedure.query(async () => {
    return getPermissionTree();
  }),

  // List all permission roles
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.permissionRole.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
  }),

  // Get a single role with its assigned users
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.prisma.permissionRole.findUnique({
        where: { id: input.id },
        include: {
          users: {
            include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
          },
        },
      });
      if (!role) throw new Error("Permission role not found");
      return role;
    }),

  // Create a new permission role
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      permissions: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate all permission keys
      const validKeys = new Set(PERMISSIONS.map((p) => p.key));
      const invalid = input.permissions.filter((p) => !validKeys.has(p));
      if (invalid.length > 0) throw new Error(`Invalid permission keys: ${invalid.join(", ")}`);

      const role = await ctx.prisma.permissionRole.create({
        data: {
          name: input.name,
          description: input.description || null,
          permissions: input.permissions,
          createdBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "permission_role.created",
        category: "USER",
        actorId: ctx.user.id,
        resource: "permission_role:" + role.id,
        detail: { name: input.name, permissions: input.permissions },
      });

      return role;
    }),

  // Update a permission role
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      permissions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.permissions) {
        const validKeys = new Set(PERMISSIONS.map((p) => p.key));
        const invalid = input.permissions.filter((p) => !validKeys.has(p));
        if (invalid.length > 0) throw new Error(`Invalid permission keys: ${invalid.join(", ")}`);
      }

      const before = await ctx.prisma.permissionRole.findUnique({ where: { id: input.id }, select: { name: true, permissions: true } });

      const role = await ctx.prisma.permissionRole.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.permissions !== undefined && { permissions: input.permissions }),
        },
      });

      await auditLog({
        action: "permission_role.updated",
        category: "USER",
        actorId: ctx.user.id,
        resource: "permission_role:" + role.id,
        detail: {
          name: role.name,
          previousName: before?.name !== role.name ? before?.name : undefined,
          ...(input.permissions && {
            permissions: input.permissions,
            previousPermissions: before?.permissions,
          }),
        },
      });

      return role;
    }),

  // Delete a permission role (cascade removes all assignments)
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.prisma.permissionRole.findUnique({
        where: { id: input.id },
        select: { name: true, permissions: true, _count: { select: { users: true } } },
      });
      if (!role) throw new Error("Permission role not found");

      await ctx.prisma.permissionRole.delete({ where: { id: input.id } });

      await auditLog({
        action: "permission_role.deleted",
        category: "USER",
        actorId: ctx.user.id,
        resource: "permission_role:" + input.id,
        detail: { name: role.name, usersAffected: role._count.users, permissions: role.permissions },
      });

      return { success: true };
    }),

  // Assign a permission role to a user
  assignToUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      permissionRoleId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
      const result = await ctx.prisma.userPermissionRole.create({
        data: {
          userId: input.userId,
          permissionRoleId: input.permissionRoleId,
          assignedBy: ctx.user.id,
        },
        include: { permissionRole: { select: { name: true } } },
      });

      await auditLog({
        action: "permission_role.assigned",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { targetEmail: targetUser?.email, targetName: targetUser?.name, roleName: result.permissionRole.name, roleId: input.permissionRoleId },
      });

      return result;
    }),

  // Remove a permission role from a user
  removeFromUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      permissionRoleId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.userPermissionRole.findUnique({
        where: { userId_permissionRoleId: { userId: input.userId, permissionRoleId: input.permissionRoleId } },
        include: { permissionRole: { select: { name: true } } },
      });
      if (!assignment) throw new Error("Role assignment not found");

      await ctx.prisma.userPermissionRole.delete({
        where: { userId_permissionRoleId: { userId: input.userId, permissionRoleId: input.permissionRoleId } },
      });

      const targetUser = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, name: true } });
      await auditLog({
        action: "permission_role.removed",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { targetEmail: targetUser?.email, targetName: targetUser?.name, roleName: assignment.permissionRole.name, roleId: input.permissionRoleId },
      });

      return { success: true };
    }),

  // Get roles assigned to a specific user
  getUserRoles: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.userPermissionRole.findMany({
        where: { userId: input.userId },
        include: { permissionRole: true },
        orderBy: { assignedAt: "desc" },
      });
    }),

  // ─── Entra Group → Role Mapping ─────────────────────────

  // Search Entra groups via Microsoft Graph API (client credentials flow)
  searchEntraGroups: adminProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ input }) => {
      const tenantId = process.env.AZURE_AD_TENANT_ID;
      const clientId = process.env.AZURE_AD_CLIENT_ID;
      const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

      if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Entra ID SSO is not configured. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, and AZURE_AD_CLIENT_SECRET.");
      }

      // Get app-only token using client credentials flow
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default",
          }),
        }
      );

      if (!tokenRes.ok) {
        throw new Error("Failed to get Microsoft Graph token. Ensure the app registration has Group.Read.All application permission with admin consent.");
      }

      const { access_token } = await tokenRes.json();

      // Build Graph API URL with optional search filter
      let url = "https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,mailEnabled,securityEnabled&$top=100&$orderby=displayName";
      if (input.search && input.search.trim()) {
        // Use $search for case-insensitive substring matching
        url = `https://graph.microsoft.com/v1.0/groups?$select=id,displayName,description,mailEnabled,securityEnabled&$top=50&$search="displayName:${input.search.trim()}"`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          ConsistencyLevel: "eventual", // Required for $search
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("Authorization_RequestDenied")) {
          throw new Error("Missing Group.Read.All permission. Go to Azure Portal → App Registrations → API Permissions → Add 'Group.Read.All' (Application) → Grant admin consent.");
        }
        throw new Error(`Microsoft Graph API error: ${res.status}`);
      }

      const data = await res.json();
      return (data.value || []).map((g: { id: string; displayName: string; description: string | null; securityEnabled: boolean; mailEnabled: boolean }) => ({
        id: g.id,
        displayName: g.displayName,
        description: g.description,
        isSecurityGroup: g.securityEnabled && !g.mailEnabled,
      }));
    }),

  // List all current Entra group → role mappings
  listGroupMappings: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.entraGroupRoleMapping.findMany({
      include: {
        permissionRole: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Create a group → role mapping
  createGroupMapping: adminProcedure
    .input(z.object({
      entraGroupId: z.string().min(1),
      entraGroupName: z.string().min(1),
      permissionRoleId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the permission role exists
      const role = await ctx.prisma.permissionRole.findUnique({
        where: { id: input.permissionRoleId },
        select: { name: true },
      });
      if (!role) throw new Error("Permission role not found");

      const mapping = await ctx.prisma.entraGroupRoleMapping.create({
        data: {
          entraGroupId: input.entraGroupId,
          entraGroupName: input.entraGroupName,
          permissionRoleId: input.permissionRoleId,
          createdBy: ctx.user.id,
        },
        include: { permissionRole: { select: { name: true } } },
      });

      await auditLog({
        action: "entra_group_mapping.created",
        category: "USER",
        actorId: ctx.user.id,
        resource: `entra_group:${input.entraGroupId}`,
        detail: {
          entraGroupName: input.entraGroupName,
          entraGroupId: input.entraGroupId,
          permissionRoleName: role.name,
          permissionRoleId: input.permissionRoleId,
        },
      });

      return mapping;
    }),

  // Delete a group → role mapping
  deleteGroupMapping: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.prisma.entraGroupRoleMapping.findUnique({
        where: { id: input.id },
        include: { permissionRole: { select: { name: true } } },
      });
      if (!mapping) throw new Error("Group mapping not found");

      await ctx.prisma.entraGroupRoleMapping.delete({ where: { id: input.id } });

      await auditLog({
        action: "entra_group_mapping.deleted",
        category: "USER",
        actorId: ctx.user.id,
        resource: `entra_group:${mapping.entraGroupId}`,
        detail: {
          entraGroupName: mapping.entraGroupName,
          permissionRoleName: mapping.permissionRole.name,
        },
      });

      return { success: true };
    }),
});
