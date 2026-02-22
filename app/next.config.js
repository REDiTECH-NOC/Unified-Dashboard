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
};

module.exports = nextConfig;
