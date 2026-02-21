import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

export const permissionRoleRouter = router({
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
        detail: { name: input.name, permissionCount: input.permissions.length },
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
          ...(input.permissions && { permissionCount: input.permissions.length }),
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
        select: { name: true, _count: { select: { users: true } } },
      });
      if (!role) throw new Error("Permission role not found");

      await ctx.prisma.permissionRole.delete({ where: { id: input.id } });

      await auditLog({
        action: "permission_role.deleted",
        category: "USER",
        actorId: ctx.user.id,
        resource: "permission_role:" + input.id,
        detail: { name: role.name, usersAffected: role._count.users },
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
        detail: { roleName: result.permissionRole.name, roleId: input.permissionRoleId },
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

      await auditLog({
        action: "permission_role.removed",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { roleName: assignment.permissionRole.name, roleId: input.permissionRoleId },
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
});
