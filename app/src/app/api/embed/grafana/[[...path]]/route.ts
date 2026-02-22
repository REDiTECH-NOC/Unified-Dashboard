import { createProxyHandler } from "@/lib/proxy";
import { hasPermissions } from "@/lib/permissions";

const GRAFANA_URL = process.env.GRAFANA_INTERNAL_URL || "http://grafana:3000";

// Grafana serves from root — GF_SERVER_ROOT_URL tells it to generate links
// with /api/embed/grafana/ prefix, but it listens at /. Our Next.js route
// at /api/embed/grafana/[[...path]] strips the prefix, so we forward to root.
// Works identically on Docker Compose and Azure Container Apps.
const handler = createProxyHandler({
  upstreamUrl: GRAFANA_URL,
  permission: "tools.grafana",
  serviceName: "grafana",
  auditAction: "tools.grafana.access",
  stripCookies: true,
  injectHeaders: async (session) => {
    // Determine Grafana role from RCC permissions (highest wins)
    // tools.grafana.admin → Admin, tools.grafana.edit → Editor, else → Viewer
    const perms = await hasPermissions(session.user.id, [
      "tools.grafana.admin",
      "tools.grafana.edit",
    ]);

    let grafanaRole = "Viewer";
    if (perms["tools.grafana.admin"]) grafanaRole = "Admin";
    else if (perms["tools.grafana.edit"]) grafanaRole = "Editor";

    return {
      "X-WEBAUTH-USER": session.user.email,
      "X-WEBAUTH-ROLE": grafanaRole,
    };
  },
});

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
