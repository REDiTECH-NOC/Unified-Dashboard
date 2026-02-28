import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";
import { hasPermission, hasPermissions } from "@/lib/permissions";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // Block API access for users who haven't completed TOTP setup
  if ((ctx.session.user as any).mustSetupTotp) {
    throw new TRPCError({ code: "FORBIDDEN", message: "TOTP setup required before accessing the application" });
  }
  return next({
    ctx: { ...ctx, user: ctx.session.user },
  });
});

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Granular Permission Middleware ─────────────────────────────────
// Creates a procedure that requires a specific permission key.
// Uses the 3-layer resolution: per-user override > permission roles > base role default.
// Usage: requirePerm("alerts.view").query(...)
export function requirePerm(permission: string) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const allowed = await hasPermission(ctx.user.id, permission);
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permission required: ${permission}`,
      });
    }
    return next({ ctx });
  });
}

// Creates a procedure that requires ANY of the listed permissions.
// Usage: requireAnyPerm(["alerts.view", "alerts.manage"]).query(...)
export function requireAnyPerm(permissions: string[]) {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const results = await hasPermissions(ctx.user.id, permissions);
    const hasAny = Object.values(results).some(Boolean);
    if (!hasAny) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `One of these permissions required: ${permissions.join(", ")}`,
      });
    }
    return next({ ctx: { ...ctx, grantedPermissions: results } });
  });
}
