import { prisma } from "./prisma";
import type { AuditCategory } from "@prisma/client";

export type { AuditCategory };

// All valid audit categories for reference
export const AUDIT_CATEGORIES = {
  AUTH: "AUTH",
  USER: "USER",
  SECURITY: "SECURITY",
  INTEGRATION: "INTEGRATION",
  NOTIFICATION: "NOTIFICATION",
  SYSTEM: "SYSTEM",
  API: "API",
  DATA: "DATA",
} as const;

// Human-readable labels for UI display
export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  AUTH: "Authentication",
  USER: "User Management",
  SECURITY: "Security",
  INTEGRATION: "Integrations",
  NOTIFICATION: "Notifications",
  SYSTEM: "System",
  API: "API Activity",
  DATA: "Data & Reports",
};

interface AuditLogParams {
  action: string;
  category: AuditCategory;
  actorId?: string;
  resource?: string;
  detail?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  outcome?: "success" | "failure" | "denied";
}

export async function auditLog(params: AuditLogParams) {
  try {
    await prisma.auditEvent.create({
      data: {
        action: params.action,
        category: params.category,
        actorId: params.actorId || null,
        resource: params.resource || null,
        detail: params.detail ?? undefined,
        ip: params.ip || null,
        userAgent: params.userAgent || null,
        outcome: params.outcome || "success",
      },
    });
  } catch (error) {
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}
