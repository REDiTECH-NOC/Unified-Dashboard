/**
 * POST /api/agent/tasks/[id]/result — Report task completion or failure.
 *
 * The relay agent calls this after executing a task. On success, we update
 * the PBX instance status. On failure, we retry up to maxAttempts.
 * Payload is cleared after processing (defense-in-depth).
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authenticateAgent } from "@/lib/agent-auth";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: taskId } = await params;

  const task = await prisma.agentTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.agentId !== agent.id) {
    return NextResponse.json(
      { error: "Task not assigned to this agent" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { success, error, details } = body as {
    success: boolean;
    error?: string;
    details?: unknown;
  };

  if (success) {
    // Mark completed, update instance
    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: "completed",
        result: { success: true, details: details || null },
        payload: Prisma.DbNull, // Clear decrypted credentials
        completedAt: new Date(),
      },
    });

    if (task.type === "deploy_sso") {
      await prisma.threecxInstance.update({
        where: { id: task.targetInstanceId },
        data: {
          ssoDeployed: true,
          ssoDeployedAt: new Date(),
          ssoDeployStatus: "deployed",
        },
      });
    } else if (task.type === "remove_sso") {
      await prisma.threecxInstance.update({
        where: { id: task.targetInstanceId },
        data: {
          ssoDeployed: false,
          ssoDeployedAt: null,
          ssoDeployStatus: null,
        },
      });
    }

    await auditLog({
      action: `agent.task.completed`,
      category: "INTEGRATION",
      actorId: task.createdBy || "system",
      resource: `threecx:${task.targetInstanceId}`,
      detail: {
        taskId,
        type: task.type,
        agentId: agent.id,
        agentName: agent.name,
      },
    });
  } else {
    // Failed — retry or mark final failure
    const canRetry = task.attempts < task.maxAttempts;

    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: canRetry ? "pending" : "failed",
        agentId: canRetry ? null : task.agentId,
        result: { success: false, error, details: details || null },
        errorMessage: error || "Unknown error",
        payload: Prisma.DbNull, // Clear decrypted credentials
        completedAt: canRetry ? null : new Date(),
      },
    });

    // Update instance status on final failure
    if (!canRetry) {
      await prisma.threecxInstance.update({
        where: { id: task.targetInstanceId },
        data: {
          ssoDeployStatus: "failed",
        },
      });
    }

    await auditLog({
      action: `agent.task.failed`,
      category: "INTEGRATION",
      actorId: task.createdBy || "system",
      resource: `threecx:${task.targetInstanceId}`,
      detail: {
        taskId,
        type: task.type,
        agentId: agent.id,
        error,
        attempt: task.attempts,
        willRetry: canRetry,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
