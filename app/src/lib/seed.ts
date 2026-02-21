import { prisma } from "./prisma";
import { auditLog } from "./audit";
import bcrypt from "bcryptjs";

/**
 * Seeds a glass-break local admin account if:
 * 1. GLASSBREAK_ADMIN_EMAIL and GLASSBREAK_ADMIN_PASSWORD env vars are set
 * 2. No local admin account exists yet
 *
 * The admin will be forced to set up TOTP on first login (mustSetupTotp=true).
 * This runs once on app initialization.
 */
export async function seedGlassBreakAdmin() {
  const email = process.env.GLASSBREAK_ADMIN_EMAIL;
  const password = process.env.GLASSBREAK_ADMIN_PASSWORD;

  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      name: "Local Administrator",
      role: "ADMIN",
      authMethod: "LOCAL",
      passwordHash,
      mustSetupTotp: true,
      totpEnabled: false,
    },
  });

  await auditLog({
    action: "user.glassbreak.seeded",
    category: "SYSTEM",
    actorId: admin.id,
    resource: `user:${admin.id}`,
    detail: { email, role: "ADMIN", authMethod: "LOCAL" },
  });

  console.log(`[SEED] Glass-break admin created: ${email}`);
}
