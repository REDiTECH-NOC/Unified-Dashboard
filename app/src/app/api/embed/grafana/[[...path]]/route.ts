import { createProxyHandler } from "@/lib/proxy";
import { hasPermissions } from "@/lib/permissions";

const GRAFANA_URL = process.env.GRAFANA_INTERNAL_URL || "http://grafana:3000";
const EMBED_PREFIX = "/api/embed/grafana";

// Grafana's GF_SERVER_ROOT_URL is set to its public domain (e.g. https://grafana.reditech.com/)
// so public dashboards work with correct asset paths. For the embed proxy, we rewrite
// Grafana's HTML responses so asset loads and SPA navigation go through our proxy.
const handler = createProxyHandler({
  upstreamUrl: GRAFANA_URL,
  permission: "tools.grafana",
  serviceName: "grafana",
  auditAction: "tools.grafana.access",
  stripCookies: true,
  responseRewrite: [
    // Inject <base> tag so all relative asset URLs (public/build/...) resolve through proxy
    { from: "<head>", to: `<head><base href="${EMBED_PREFIX}/" />` },
    // Rewrite Grafana's appSubUrl so SPA API calls + navigation go through proxy
    { from: '"appSubUrl":""', to: `"appSubUrl":"${EMBED_PREFIX}"` },
  ],
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
