/**
 * POST /api/agent/heartbeat — Explicit heartbeat from relay agent.
 *
 * Called on startup and periodically. Updates lastHeartbeat, lastIp,
 * and version on the agent record.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { version } = body as { version?: string };

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  await prisma.onPremAgent.update({
    where: { id: agent.id },
    data: {
      lastHeartbeat: new Date(),
      lastIp: clientIp,
      ...(version ? { version } : {}),
    },
  });

  return NextResponse.json({ ok: true, serverTime: new Date().toISOString() });
}
