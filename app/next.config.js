/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: {
    APP_VERSION: require("./package.json").version,
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "ioredis", "dockerode"],
    instrumentationHook: true,
    outputFileTracingIncludes: {
      "/api/trpc/\\[trpc\\]": ["./node_modules/ioredis/**/*"],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent clickjacking — allow same-origin iframes only (Grafana embeds)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy — send origin on cross-origin, full URL on same-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable unnecessary browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // HSTS — enforce HTTPS for 1 year (browsers remember even if user types http://)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com",
              "frame-src 'self'",
              "frame-ancestors 'self'",
              "form-action 'self' https://login.microsoftonline.com",
              "base-uri 'self'",
              "object-src 'none'",
              "worker-src 'self'",
            ].join("; "),
          },
        ],
      },
      // Service worker must be served with correct scope header
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      // PWA manifest should not be cached aggressively
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
