export type UserRole = "ADMIN" | "MANAGER" | "USER" | "CLIENT";

export interface IntegrationTool {
  toolId: string;
  displayName: string;
  category: string;
  status: "connected" | "degraded" | "error" | "unconfigured";
  lastHealthCheck: Date | null;
  lastSync: Date | null;
  config: Record<string, unknown> | null;
}
