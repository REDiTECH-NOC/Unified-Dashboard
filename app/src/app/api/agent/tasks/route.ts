/**
 * GET /api/agent/tasks — Poll for pending tasks.
 *
 * The on-prem relay agent calls this every ~5 seconds. If a pending task
 * exists, we atomically claim it, decrypt SSH credentials, load SSO file
 * contents, and return the full payload. Returns 204 if no tasks.
 *
 * Also recovers stale tasks (claimed >5min with no result) by resetting
 * them to pending so they can be re-claimed.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateAgent } from "@/lib/agent-auth";
import { decrypt } from "@/lib/crypto";
import { getSsoFiles, SSO_TARGET_PATH } from "@/lib/sso-files";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Update heartbeat on every poll
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  await prisma.onPremAgent.update({
    where: { id: agent.id },
    data: { lastHeartbeat: new Date(), lastIp: clientIp },
  });

  // Recover stale tasks (claimed >5min ago with no result)
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.agentTask.updateMany({
    where: {
      status: "claimed",
      updatedAt: { lt: fiveMinAgo },
    },
    data: { status: "pending", agentId: null },
  });

  // Find and claim the oldest pending task
  const pending = await prisma.agentTask.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!pending) {
    return new Response(null, { status: 204 });
  }

  // Atomically claim — updateMany with status filter prevents double-claim
  const claimed = await prisma.agentTask.updateMany({
    where: { id: pending.id, status: "pending" },
    data: {
      status: "claimed",
      agentId: agent.id,
      lastAttemptAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0) {
    // Another agent beat us — no task
    return new Response(null, { status: 204 });
  }

  // Build payload based on task type
  let payload: Record<string, unknown> = {};

  if (pending.type === "deploy_sso") {
    const instance = await prisma.threecxInstance.findUnique({
      where: { id: pending.targetInstanceId },
      select: {
        localIp: true,
        sshUsername: true,
        encryptedSshPassword: true,
        name: true,
        fqdn: true,
      },
    });

    if (!instance?.localIp || !instance.encryptedSshPassword) {
      // Can't execute — mark failed
      await prisma.agentTask.update({
        where: { id: pending.id },
        data: {
          status: "failed",
          errorMessage: "SSH credentials not configured on this instance",
          completedAt: new Date(),
        },
      });
      return new Response(null, { status: 204 });
    }

    payload = {
      localIp: instance.localIp,
      sshUsername: instance.sshUsername || "root",
      sshPassword: decrypt(instance.encryptedSshPassword),
      targetPath: SSO_TARGET_PATH,
      files: getSsoFiles(),
      instanceName: instance.name,
      fqdn: instance.fqdn,
    };
  } else if (pending.type === "remove_sso") {
    const instance = await prisma.threecxInstance.findUnique({
      where: { id: pending.targetInstanceId },
      select: {
        localIp: true,
        sshUsername: true,
        encryptedSshPassword: true,
        name: true,
        fqdn: true,
      },
    });

    if (!instance?.localIp || !instance.encryptedSshPassword) {
      await prisma.agentTask.update({
        where: { id: pending.id },
        data: {
          status: "failed",
          errorMessage: "SSH credentials not configured on this instance",
          completedAt: new Date(),
        },
      });
      return new Response(null, { status: 204 });
    }

    payload = {
      localIp: instance.localIp,
      sshUsername: instance.sshUsername || "root",
      sshPassword: decrypt(instance.encryptedSshPassword),
      targetPath: SSO_TARGET_PATH,
      fileNames: ["sso-helper.html", "sso-helper.js"],
      instanceName: instance.name,
      fqdn: instance.fqdn,
    };
  }

  // Store payload temporarily on the task (cleared after completion)
  await prisma.agentTask.update({
    where: { id: pending.id },
    data: { payload: payload as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    task: {
      id: pending.id,
      type: pending.type,
      targetInstanceId: pending.targetInstanceId,
      payload,
    },
  });
}
