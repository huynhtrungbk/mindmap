# ============================================
# Mindmap Selfhost — Production Dockerfile
# Multi-stage build for Next.js 16 standalone
# ============================================

# --- Stage 1: Install dependencies ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
# Rebuild native modules (argon2) for Alpine
RUN npm rebuild argon2

# --- Stage 2: Build application ---
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
# JWT_SECRET and DATABASE_URL are needed at build time because Next.js
# evaluates server modules during page data collection. These are
# build-time-only dummy values, NOT used at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV JWT_SECRET="build-time-placeholder-not-used-at-runtime"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NODE_ENV=production
RUN npm run build

# --- Stage 3: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Copy Prisma schema + migrations (for `prisma migrate deploy`)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Need dotenv for prisma.config.ts
COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
