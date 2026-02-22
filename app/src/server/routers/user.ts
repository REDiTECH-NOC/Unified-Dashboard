import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { auditLog } from "@/lib/audit";
import { getUserEffectivePermissions, PERMISSIONS } from "@/lib/permissions";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: { featureFlags: true },
    });
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      include: {
        preferences: { where: { key: { startsWith: "profile." } } },
        permissionRoles: { include: { permissionRole: { select: { name: true } } } },
      },
    });
    if (!user) throw new Error("User not found");

    const prefs = Object.fromEntries(user.preferences.map((p) => [p.key, p.value]));
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      authMethod: user.authMethod,
      totpEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      phone: (prefs["profile.phone"] as string) || "",
      title: (prefs["profile.title"] as string) || "",
      permissionRoles: user.permissionRoles.map((pr) => pr.permissionRole.name),
    };
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200).optional(),
      phone: z.string().max(50).optional(),
      title: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.name !== undefined) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { name: input.name },
        });
      }

      // Store phone and title as user preferences
      if (input.phone !== undefined) {
        await ctx.prisma.userPreference.upsert({
          where: { userId_key: { userId: ctx.user.id, key: "profile.phone" } },
          update: { value: input.phone },
          create: { userId: ctx.user.id, key: "profile.phone", value: input.phone },
        });
      }
      if (input.title !== undefined) {
        await ctx.prisma.userPreference.upsert({
          where: { userId_key: { userId: ctx.user.id, key: "profile.title" } },
          update: { value: input.title },
          create: { userId: ctx.user.id, key: "profile.title", value: input.title },
        });
      }

      await auditLog({
        action: "user.profile.updated",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + ctx.user.id,
        detail: { fields: Object.keys(input).filter((k) => (input as any)[k] !== undefined) },
      });

      return { success: true };
    }),

  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { featureFlags: true, permissions: true },
    });
  }),

  // Get a single user's full details (for user detail page)
  getById: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        include: {
          featureFlags: true,
          permissions: true,
          permissionRoles: {
            include: { permissionRole: { select: { id: true, name: true, description: true, permissions: true } } },
          },
        },
      });
      if (!user) throw new Error("User not found");
      const effectivePermissions = await getUserEffectivePermissions(input.userId);
      return { ...user, effectivePermissions };
    }),

  // Set a specific permission override for a user
  setPermission: adminProcedure
    .input(z.object({
      userId: z.string(),
      permission: z.string(),
      granted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate the permission key exists
      const valid = PERMISSIONS.find((p) => p.key === input.permission);
      if (!valid) throw new Error("Invalid permission key");

      const result = await ctx.prisma.userPermission.upsert({
        where: { userId_permission: { userId: input.userId, permission: input.permission } },
        update: { granted: input.granted, grantedBy: ctx.user.id, grantedAt: new Date() },
        create: {
          userId: input.userId,
          permission: input.permission,
          granted: input.granted,
          grantedBy: ctx.user.id,
        },
      });

      await auditLog({
        action: "user.permission.changed",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { permission: input.permission, granted: input.granted },
      });

      return result;
    }),

  // Remove a per-user permission override (revert to role default)
  resetPermission: adminProcedure
    .input(z.object({
      userId: z.string(),
      permission: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.userPermission.deleteMany({
        where: { userId: input.userId, permission: input.permission },
      });

      await auditLog({
        action: "user.permission.reset",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { permission: input.permission, resetToRoleDefault: true },
      });

      return { success: true };
    }),

  updateRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["ADMIN", "MANAGER", "USER", "CLIENT"]) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });
      await auditLog({
        action: "user.role.changed",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { newRole: input.role },
      });
      return updated;
    }),

  setFeatureFlag: adminProcedure
    .input(z.object({
      userId: z.string(),
      flag: z.string(),
      enabled: z.boolean(),
      value: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.userFeatureFlag.upsert({
        where: { userId_flag: { userId: input.userId, flag: input.flag } },
        update: { enabled: input.enabled, value: (input.value as any) ?? undefined, updatedBy: ctx.user.id },
        create: {
          userId: input.userId,
          flag: input.flag,
          enabled: input.enabled,
          value: (input.value as any) ?? undefined,
          updatedBy: ctx.user.id,
        },
      });
      await auditLog({
        action: "user.feature_flag.changed",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { flag: input.flag, enabled: input.enabled },
      });
      return result;
    }),

  // Create a new local user account
  create: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1).max(200),
      role: z.enum(["ADMIN", "MANAGER", "USER", "CLIENT"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check for existing user
      const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      if (existing) throw new Error("A user with this email already exists");

      // Generate a random temporary password
      const tempPassword = crypto.randomBytes(16).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const user = await ctx.prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          authMethod: "LOCAL",
          passwordHash,
          mustSetupTotp: true, // Force TOTP setup on first login
        },
      });

      await auditLog({
        action: "user.created",
        category: "USER",
        actorId: ctx.user.id,
        resource: "user:" + user.id,
        detail: { email: input.email, name: input.name, role: input.role },
      });

      // Return the temp password so admin can share it with the user
      // (this is the only time it's visible — it's hashed in the DB)
      return {
        user,
        tempPassword,
      };
    }),

  // Reset a user's password (admin action)
  resetPassword: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new Error("User not found");
      if (user.authMethod !== "LOCAL") throw new Error("Cannot reset password for SSO users");

      const tempPassword = crypto.randomBytes(16).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      await ctx.prisma.user.update({
        where: { id: input.userId },
        data: { passwordHash, mustSetupTotp: true, totpEnabled: false, totpSecret: null },
      });

      await auditLog({
        action: "user.password.reset",
        category: "SECURITY",
        actorId: ctx.user.id,
        resource: "user:" + input.userId,
        detail: { email: user.email },
      });

      return { tempPassword };
    }),
});
