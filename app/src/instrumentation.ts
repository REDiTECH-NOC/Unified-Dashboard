export async function register() {
  // Runs once on server startup
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Load SSO config from DB into env vars (before auth.ts initializes)
    try {
      const { prisma } = await import("./lib/prisma");
      const ssoConfig = await prisma.integrationConfig.findUnique({
        where: { toolId: "entra-id" },
      });
      if (ssoConfig?.config && typeof ssoConfig.config === "object") {
        const c = ssoConfig.config as Record<string, string>;
        if (c.clientId) process.env.AZURE_AD_CLIENT_ID = c.clientId;
        if (c.clientSecret) process.env.AZURE_AD_CLIENT_SECRET = c.clientSecret;
        if (c.tenantId) process.env.AZURE_AD_TENANT_ID = c.tenantId;
        if (c.adminGroupId) process.env.ENTRA_GROUP_ADMINS = c.adminGroupId;
        if (c.userGroupId) process.env.ENTRA_GROUP_USERS = c.userGroupId;
        console.log("[INIT] Loaded SSO config from database");
      }
    } catch (error) {
      console.error("[INIT] Failed to load SSO config from DB:", error);
    }

    // Seed glass-break admin
    const { seedGlassBreakAdmin } = await import("./lib/seed");
    await seedGlassBreakAdmin();
  }
}
