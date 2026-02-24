import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authRateLimit, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";

// Pre-computed bcrypt hash for constant-time comparison when user doesn't exist
// Prevents timing-based user enumeration
const DUMMY_HASH = "$2a$12$LJ3m4ks9YCjEqIHwTuSwNeNXisWCpv3qJlvZNqyPKNb7eR6hNNKMG";

// Validates email + password and reports whether TOTP is needed
// This runs BEFORE signIn() so the login page knows to show the code input
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  // Rate limit: 5 attempts per 15 minutes per IP (OWASP standard)
  const limit = await authRateLimit(ip);
  if (!limit.allowed) {
    await auditLog({
      action: "auth.login.rate_limited",
      category: "SECURITY",
      detail: { ip, retryAfter: limit.retryAfter },
      outcome: "denied",
      ip,
    });
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      }
    );
  }

  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ ok: false });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, authMethod: true, passwordHash: true, totpEnabled: true, totpSecret: true },
  });

  if (!user || user.authMethod !== "LOCAL" || !user.passwordHash) {
    // Constant-time: still do bcrypt compare to prevent timing enumeration
    await bcrypt.compare(password, DUMMY_HASH);
    await auditLog({
      action: "auth.login.failed",
      category: "AUTH",
      detail: { email, ip, reason: "invalid_credentials" },
      outcome: "failure",
      ip,
    });
    return NextResponse.json({ ok: false });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    await auditLog({
      action: "auth.login.failed",
      category: "AUTH",
      actorId: user.id,
      detail: { email, ip, reason: "wrong_password" },
      outcome: "failure",
      ip,
    });
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({
    ok: true,
    needsTotp: user.totpEnabled && !!user.totpSecret,
  });
}
