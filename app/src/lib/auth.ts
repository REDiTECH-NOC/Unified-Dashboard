import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { auditLog } from "./audit";
import bcrypt from "bcryptjs";

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
    async authorize(credentials) {
      const email = credentials?.email as string;
      const password = credentials?.password as string;
      const totpCode = credentials?.totpCode as string | undefined;

      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.authMethod !== "LOCAL" || !user.passwordHash) {
        await auditLog({
          action: "auth.local.failed",
          category: "AUTH",
          detail: { email, reason: "invalid_credentials" },
          outcome: "failure",
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
        });
        return null;
      }

      // If TOTP is enabled, verify the code
      if (user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          throw new Error("TOTP_REQUIRED");
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
      if (account?.provider === "local") return true;

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
