import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { authenticator } from "otplib";

// GET: Generate a new TOTP secret + otpauth URI for QR code
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, authMethod: true, mustSetupTotp: true, totpEnabled: true },
  });

  if (!user || user.authMethod !== "LOCAL") {
    return NextResponse.json({ error: "Not a local account" }, { status: 400 });
  }

  if (user.totpEnabled && !user.mustSetupTotp) {
    return NextResponse.json({ error: "TOTP already configured" }, { status: 400 });
  }

  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(
    user.email,
    "REDiTECH Command Center",
    secret
  );

  // Store the secret temporarily — it's not verified yet
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret },
  });

  return NextResponse.json({ secret, otpauthUri });
}

// POST: Verify a TOTP code and finalize setup
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await req.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, authMethod: true },
  });

  if (!user || user.authMethod !== "LOCAL" || !user.totpSecret) {
    return NextResponse.json({ error: "No pending TOTP setup" }, { status: 400 });
  }

  const valid = authenticator.verify({
    token: code,
    secret: user.totpSecret,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Finalize TOTP setup
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: true, mustSetupTotp: false },
  });

  await auditLog({
    action: "auth.totp.enabled",
    category: "SECURITY",
    actorId: session.user.id,
    detail: { method: "authenticator" },
  });

  return NextResponse.json({ success: true });
}
