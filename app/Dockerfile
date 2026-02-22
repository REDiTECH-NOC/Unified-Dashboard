# ── Stage 1: Dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
# Install ALL deps (including devDeps needed for build: tailwindcss, typescript, etc.)
# Also ensure SWC binary for Alpine (musl) is available
RUN npm ci && npm install @next/swc-linux-x64-musl --no-save 2>/dev/null || true

# ── Stage 2: Builder ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# ── Stage 3: Runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# OpenSSL is required for Prisma query engine at runtime
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema + migrations for runtime migration
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# ioredis + transitive deps (not fully traced by Next.js standalone nft)
COPY --from=builder /app/node_modules/ioredis ./node_modules/ioredis
COPY --from=builder /app/node_modules/@ioredis ./node_modules/@ioredis
COPY --from=builder /app/node_modules/cluster-key-slot ./node_modules/cluster-key-slot
COPY --from=builder /app/node_modules/debug ./node_modules/debug
COPY --from=builder /app/node_modules/denque ./node_modules/denque
COPY --from=builder /app/node_modules/lodash.defaults ./node_modules/lodash.defaults
COPY --from=builder /app/node_modules/lodash.isarguments ./node_modules/lodash.isarguments
COPY --from=builder /app/node_modules/redis-errors ./node_modules/redis-errors
COPY --from=builder /app/node_modules/redis-parser ./node_modules/redis-parser
COPY --from=builder /app/node_modules/standard-as-callback ./node_modules/standard-as-callback
COPY --from=builder /app/node_modules/ms ./node_modules/ms

# dockerode + transitive deps (Docker API access for container management)
COPY --from=builder /app/node_modules/dockerode ./node_modules/dockerode
COPY --from=builder /app/node_modules/docker-modem ./node_modules/docker-modem
COPY --from=builder /app/node_modules/split-ca ./node_modules/split-ca
COPY --from=builder /app/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder /app/node_modules/tar-fs ./node_modules/tar-fs
COPY --from=builder /app/node_modules/tar-stream ./node_modules/tar-stream
COPY --from=builder /app/node_modules/pump ./node_modules/pump
COPY --from=builder /app/node_modules/end-of-stream ./node_modules/end-of-stream
COPY --from=builder /app/node_modules/once ./node_modules/once
COPY --from=builder /app/node_modules/wrappy ./node_modules/wrappy
COPY --from=builder /app/node_modules/bl ./node_modules/bl
COPY --from=builder /app/node_modules/readable-stream ./node_modules/readable-stream
COPY --from=builder /app/node_modules/inherits ./node_modules/inherits
COPY --from=builder /app/node_modules/safe-buffer ./node_modules/safe-buffer
COPY --from=builder /app/node_modules/string_decoder ./node_modules/string_decoder

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
