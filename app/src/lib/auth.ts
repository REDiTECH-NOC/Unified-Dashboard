import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { auditLog } from "./audit";
import { authRateLimit, totpRateLimit, getClientIp } from "./rate-limit";
import bcrypt from "bcryptjs";
import { ConnectorFactory } from "@/server/connectors/factory";

// SSO config — read from env vars (populated by instrumentation.ts from DB, or directly from Docker env)
const tenantId = process.env.AZURE_AD_TENANT_ID || "";
const clientId = process.env.AZURE_AD_CLIENT_ID || "";
const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || "";
const ssoConfigured = !!(tenantId && clientId && clientSecret);

async function getGroupMembership(accessToken: string): Promise<string[]> {
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=id",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.value?.map((g: { id: string }) => g.id) || [];
  } catch {
    return [];
  }
}

/**
 * Auto-match a user to their ConnectWise member record by exact email match.
 * Called during sign-in so the user has their CW identity from their very first session.
 * Silently no-ops if CW isn't configured, user is already mapped, or no email match found.
 */
async function tryAutoMatchCwMember(userId: string, email: string): Promise<void> {
  try {
    // Skip if user already has a CW mapping
    const existing = await prisma.userIntegrationMapping.findUnique({
      where: { userId_toolId: { userId, toolId: "connectwise" } },
    });
    if (existing) return;

    // Get PSA connector (throws if not configured — caught below)
    const psa = await ConnectorFactory.get("psa", prisma);
    const members = await psa.getMembers(); // Redis-cached

    // Exact email match (case-insensitive)
    const match = members.find(
      (m) => m.email && m.email.toLowerCase() === email.toLowerCase()
    );
    if (!match) return;

    // Ensure this CW member isn't already mapped to a different user
    const memberAlreadyMapped = await prisma.userIntegrationMapping.findFirst({
      where: { toolId: "connectwise", externalId: match.id },
    });
    if (memberAlreadyMapped) return;

    await prisma.userIntegrationMapping.create({
      data: {
        userId,
        toolId: "connectwise",
        externalId: match.id,
        externalName: match.name,
        externalEmail: match.email,
        matchMethod: "auto_email",
      },
    });

    await auditLog({
      action: "member.matching.auto_login",
      category: "INTEGRATION",
      actorId: userId,
      detail: {
        toolId: "connectwise",
        externalId: match.id,
        externalName: match.name,
        trigger: "login",
      },
    });
  } catch {
    // Never block login — CW may not be configured or reachable
  }
}

/**
 * Sync a user's permission roles based on their Entra group memberships.
 * On every Entra login: fetch EntraGroupRoleMapping entries for the user's groups,
 * then SET their UserPermissionRole records to match exactly.
 * Roles not linked to any of their groups are REMOVED.
 * Per-user overrides (UserPermission) are NEVER touched.
 * No-ops if no mappings exist (backward compatible).
 */
async function syncPermissionRolesFromGroups(userId: string, entraGroupIds: string[]): Promise<void> {
  try {
    if (entraGroupIds.length === 0) return;

    // 1. Get all group → role mappings for this user's groups
    const mappings = await prisma.entraGroupRoleMapping.findMany({
      where: { entraGroupId: { in: entraGroupIds } },
      select: { permissionRoleId: true, entraGroupName: true },
    });

    // If no mappings configured at all, skip sync entirely (preserve manual assignments)
    const anyMappingsExist = await prisma.entraGroupRoleMapping.count();
    if (anyMappingsExist === 0) return;

    // 2. Compute the set of permission role IDs this user SHOULD have
    const targetRoleIds = new Set(mappings.map((m: { permissionRoleId: string }) => m.permissionRoleId));

    // 3. Get current assignments
    const currentAssignments = await prisma.userPermissionRole.findMany({
      where: { userId },
      select: { permissionRoleId: true, permissionRole: { select: { name: true } } },
    });
    const currentRoleIds = new Set(currentAssignments.map((a) => a.permissionRoleId));

    // 4. Compute diff
    const toAdd = ([...targetRoleIds] as string[]).filter((id) => !currentRoleIds.has(id));
    const toRemove = currentAssignments.filter((a) => !targetRoleIds.has(a.permissionRoleId));

    // 5. No changes needed
    if (toAdd.length === 0 && toRemove.length === 0) return;

    // 6. Apply changes in a transaction
    await prisma.$transaction([
      // Remove roles user no longer qualifies for
      ...toRemove.map((a) =>
        prisma.userPermissionRole.delete({
          where: { userId_permissionRoleId: { userId, permissionRoleId: a.permissionRoleId } },
        })
      ),
      // Add new roles from group mappings
      ...toAdd.map((roleId: string) =>
        prisma.userPermissionRole.create({
          data: { userId, permissionRoleId: roleId, assignedBy: "entra_group_sync" },
        })
      ),
    ]);

    // 7. Audit log the sync
    await auditLog({
      action: "permission_roles.entra_synced",
      category: "USER",
      actorId: userId,
      resource: `user:${userId}`,
      detail: {
        added: toAdd.length,
        removed: toRemove.length,
        removedRoles: toRemove.map((a) => a.permissionRole.name),
        totalMappedGroups: mappings.length,
        source: "entra_group_sync",
      },
    });
  } catch {
    // Never block login — silently fail if mappings table doesn't exist yet
  }
}

// Build providers list dynamically — only include Entra ID if configured
const providers: Provider[] = [
  Credentials({
    id: "local",
    name: "Admin Login",
    credentials: {
      email: { type: "email" },
      password: { type: "password" },
      totpCode: { type: "text" },
    },
    async authorize(credentials, req) {
      const email = credentials?.email as string;
      const password = credentials?.password as string;
      const totpCode = credentials?.totpCode as string | undefined;

      if (!email || !password) return null;

      // IP-based rate limiting to prevent credential stuffing (5 attempts / 15 min)
      const ip = getClientIp((req as any)?.headers ?? new Headers());
      const ipLimit = await authRateLimit(ip);
      if (!ipLimit.allowed) {
        await auditLog({
          action: "auth.local.ratelimited",
          category: "SECURITY",
          detail: { email, retryAfter: ipLimit.retryAfter },
          outcome: "denied",
          ip,
        });
        throw new Error("AUTH_RATE_LIMITED");
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.authMethod !== "LOCAL" || !user.passwordHash) {
        await auditLog({
          action: "auth.local.failed",
          category: "AUTH",
          detail: { email, reason: "invalid_credentials" },
          outcome: "failure",
          ip,
        });
        return null;
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        await auditLog({
          action: "auth.local.failed",
          category: "AUTH",
          actorId: user.id,
          detail: { email, reason: "wrong_password" },
          outcome: "failure",
          ip,
        });
        return null;
      }

      // If TOTP is enabled, verify the code with rate limiting
      if (user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          throw new Error("TOTP_REQUIRED");
        }

        // Rate limit TOTP verification to prevent brute-force (6-digit = 1M possibilities)
        const limit = await totpRateLimit(user.id);
        if (!limit.allowed) {
          await auditLog({
            action: "auth.local.totp.ratelimited",
            category: "SECURITY",
            actorId: user.id,
            detail: { email, retryAfter: limit.retryAfter },
            outcome: "denied",
            ip,
          });
          throw new Error("TOTP_RATE_LIMITED");
        }

        const { authenticator } = await import("otplib");
        const valid = authenticator.verify({
          token: totpCode,
          secret: user.totpSecret,
        });
        if (!valid) {
          await auditLog({
            action: "auth.local.totp.failed",
            category: "SECURITY",
            actorId: user.id,
            detail: { email },
            outcome: "failure",
            ip,
          });
          throw new Error("TOTP_INVALID");
        }
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await auditLog({
        action: "auth.local.login",
        category: "AUTH",
        actorId: user.id,
        detail: { email, role: user.role },
        ip,
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatar,
      };
    },
  }),
];

// Only add Entra ID provider if SSO is configured
if (ssoConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId,
      clientSecret,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      authorization: {
        url: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
        params: {
          scope: "openid profile email User.Read GroupMember.Read.All",
        },
      },
      token: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      userinfo: "https://graph.microsoft.com/oidc/userinfo",
    })
  );
}

export { ssoConfigured };

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // Local auth — already validated in authorize()
      if (account?.provider === "local") {
        if (user.id && user.email) {
          await tryAutoMatchCwMember(user.id, user.email);
        }
        return true;
      }

      // Entra ID flow
      if (!account?.access_token || !user.email) return false;

      const groups = await getGroupMembership(account.access_token);

      const adminGroupId = process.env.ENTRA_GROUP_ADMINS || "";
      const userGroupId = process.env.ENTRA_GROUP_USERS || "";
      const isAdmin = adminGroupId ? groups.includes(adminGroupId) : false;
      const isUser = userGroupId ? groups.includes(userGroupId) : false;

      if (!isAdmin && !isUser) {
        await auditLog({
          action: "auth.login.denied",
          category: "SECURITY",
          detail: { email: user.email, reason: "not_in_security_group" },
          outcome: "denied",
        });
        return false;
      }

      const role = isAdmin ? "ADMIN" : "USER";
      const entraId = (user as any).id || undefined;

      let dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            email: user.email,
            name: user.name || null,
            avatar: user.image || null,
            entraId,
            role: role as "ADMIN" | "USER",
            authMethod: "ENTRA",
          },
        });
        await auditLog({
          action: "user.provisioned",
          category: "USER",
          actorId: dbUser.id,
          resource: `user:${dbUser.id}`,
          detail: { email: dbUser.email, role: dbUser.role },
        });
      } else {
        // Sync role from Entra group membership on every login
        const updateData: Record<string, unknown> = {
          lastLoginAt: new Date(),
          name: user.name || dbUser.name,
          avatar: user.image || dbUser.avatar,
        };
        if (dbUser.authMethod === "ENTRA" && dbUser.role !== role) {
          updateData.role = role;
          await auditLog({
            action: "user.role.synced",
            category: "USER",
            actorId: dbUser.id,
            resource: `user:${dbUser.id}`,
            detail: { previousRole: dbUser.role, newRole: role, source: "entra_group_sync" },
          });
        }
        await prisma.user.update({
          where: { id: dbUser.id },
          data: updateData,
        });
      }

      await auditLog({
        action: "auth.login",
        category: "AUTH",
        actorId: dbUser.id,
        detail: { email: dbUser.email, role: dbUser.role },
      });

      // Auto-match to ConnectWise member by email (runs on every login, no-ops if already mapped)
      await tryAutoMatchCwMember(dbUser.id, dbUser.email);

      // Sync permission roles from Entra group memberships
      await syncPermissionRolesFromGroups(dbUser.id, groups);

      return true;
    },

    async jwt({ token, trigger, user }) {
      if (trigger === "signIn" || trigger === "update") {
        // On signIn use user.email; on update always use trusted token.email
        const email = trigger === "signIn" ? (user?.email || token.email) : token.email;
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
          });
          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
            token.mustSetupTotp = dbUser.mustSetupTotp;
            token.authMethod = dbUser.authMethod;
            token.lastValidated = Date.now();
          }
        }
      }

      // Periodic revalidation — verify user still exists in DB every 5 minutes
      if (token.userId) {
        const lastValidated = (token.lastValidated as number) || 0;
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - lastValidated > fiveMinutes) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: { id: true, role: true, mustSetupTotp: true, authMethod: true },
          });
          if (!dbUser) {
            // User no longer exists — invalidate token
            return { email: token.email };
          }
          token.role = dbUser.role;
          token.mustSetupTotp = dbUser.mustSetupTotp;
          token.authMethod = dbUser.authMethod;
          token.lastValidated = Date.now();
        }
      }

      return token;
    },

    // Reuse Edge-safe session callback from auth.config.ts
    session: authConfig.callbacks.session as any,
  },
});
