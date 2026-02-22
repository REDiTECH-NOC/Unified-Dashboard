import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth configuration.
 * This file MUST NOT import Prisma or any Node.js-only modules.
 * Used by middleware.ts (Edge Runtime) for session decoding and route protection.
 * Extended by auth.ts (Node.js) with full Prisma-backed callbacks.
 */
export const authConfig = {
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // Configured in auth.ts — middleware doesn't need providers
  callbacks: {
    // Map JWT token fields to session — NO database calls
    session({ session, token }: { session: any; token: any }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.mustSetupTotp = token.mustSetupTotp;
        session.user.authMethod = token.authMethod;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
