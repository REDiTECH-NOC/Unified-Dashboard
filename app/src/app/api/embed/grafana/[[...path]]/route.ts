import { createProxyHandler } from "@/lib/proxy";
import { hasPermissions } from "@/lib/permissions";

const GRAFANA_URL = process.env.GRAFANA_INTERNAL_URL || "http://grafana:3000";

// Grafana serves from sub-path /api/embed/grafana/ (GF_SERVER_SERVE_FROM_SUB_PATH=true)
// We must include the sub-path in the upstream URL so Grafana serves directly
// without redirecting to http://localhost/api/embed/grafana/ (unreachable)
const handler = createProxyHandler({
  upstreamUrl: GRAFANA_URL + "/api/embed/grafana",
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
