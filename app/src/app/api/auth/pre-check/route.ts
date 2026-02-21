import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Validates email + password and reports whether TOTP is needed
// This runs BEFORE signIn() so the login page knows to show the code input
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ ok: false });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.authMethod !== "LOCAL" || !user.passwordHash) {
    return NextResponse.json({ ok: false });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({
    ok: true,
    needsTotp: user.totpEnabled && !!user.totpSecret,
  });
}
