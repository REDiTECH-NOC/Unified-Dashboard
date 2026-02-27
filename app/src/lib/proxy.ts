import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { auditLog } from "@/lib/audit";

interface ProxyConfig {
  upstreamUrl: string;
  permission: string;
  serviceName: string;
  auditAction: string;
  injectHeaders?: (session: any) => Record<string, string> | Promise<Record<string, string>>;
  stripCookies?: boolean;
  /** Rewrite rules applied to text responses (HTML/JS/CSS) going through the proxy */
  responseRewrite?: { from: string; to: string }[];
}

const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "accept-encoding",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "connection",
  "keep-alive",
  "x-frame-options",
]);

export function createProxyHandler(config: ProxyConfig) {
  return async function handler(
    req: NextRequest,
    { params }: { params: Promise<{ path?: string[] }> }
  ) {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Permission check
    const allowed = await hasPermission(session.user.id, config.permission);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Build upstream URL (path is undefined for optional catch-all root)
    const { path: pathSegments } = await params;
    const path = (pathSegments || []).join("/");
    const search = req.nextUrl.search;
    const upstreamUrl = `${config.upstreamUrl}/${path}${search}`;

    // 4. Build forwarded headers
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) return;
      if (config.stripCookies && key.toLowerCase() === "cookie") return;
      if (key.toLowerCase() === "authorization") return;
      headers.set(key, value);
    });

    // Inject custom headers (e.g., Grafana auth proxy)
    if (config.injectHeaders) {
      const extra = await config.injectHeaders(session);
      Object.entries(extra).forEach(([k, v]) => {
        headers.set(k, v);
      });
    }

    // 5. Forward the request (manual redirects so we can rewrite Location headers)
    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        redirect: "manual",
        body:
          req.method !== "GET" && req.method !== "HEAD"
            ? req.body
            : undefined,
        // @ts-expect-error -- duplex needed for streaming body in Node 18+
        duplex:
          req.method !== "GET" && req.method !== "HEAD" ? "half" : undefined,
      });

      // 6. Build response headers
      const responseHeaders = new Headers();
      upstreamRes.headers.forEach((value, key) => {
        if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });

      // 6a. Rewrite redirect Location headers — upstream may use internal
      // hostnames (e.g. http://grafana:3000/...) that the browser can't reach.
      // Strip the origin so the browser redirects through our proxy.
      if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
        const location = upstreamRes.headers.get("location");
        if (location) {
          try {
            const locUrl = new URL(location);
            responseHeaders.set(
              "location",
              locUrl.pathname + locUrl.search + locUrl.hash
            );
          } catch {
            responseHeaders.set("location", location);
          }
        }
      }

      // Allow framing from our own origin
      responseHeaders.delete("x-frame-options");
      responseHeaders.set("Content-Security-Policy", "frame-ancestors 'self'");

      // 7. Audit log (only for HTML page loads, not assets)
      const contentType = upstreamRes.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        await auditLog({
          action: config.auditAction,
          category: "API",
          actorId: session.user.id,
          resource: `${config.serviceName}:/${path}`,
          detail: { method: req.method, path },
        });
      }

      // 8. Response body rewriting for text content (HTML/JS/CSS)
      if (
        config.responseRewrite?.length &&
        contentType.match(/text\/html|application\/javascript|text\/css/)
      ) {
        let body = await upstreamRes.text();
        for (const rule of config.responseRewrite) {
          body = body.replaceAll(rule.from, rule.to);
        }
        return new NextResponse(body, {
          status: upstreamRes.status,
          statusText: upstreamRes.statusText,
          headers: responseHeaders,
        });
      }

      return new NextResponse(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error(`[PROXY] ${config.serviceName} proxy error:`, error);
      return NextResponse.json(
        { error: `Failed to connect to ${config.serviceName}` },
        { status: 502 }
      );
    }
  };
}
