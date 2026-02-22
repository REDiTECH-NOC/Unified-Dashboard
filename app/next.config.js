/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "ioredis", "dockerode"],
    instrumentationHook: true,
    outputFileTracingIncludes: {
      "/api/trpc/\\[trpc\\]": ["./node_modules/ioredis/**/*"],
    },
  },
};

module.exports = nextConfig;
