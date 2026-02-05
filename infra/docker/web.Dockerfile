# HexStrike Web Dockerfile
FROM node:20-slim AS base

RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile --filter @hexstrike/web...

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web ./packages/web
COPY package.json pnpm-workspace.yaml ./

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/packages/web
RUN pnpm build

# Debug: show standalone structure
RUN find .next/standalone -type f -name "*.js" | head -20

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./.next/static
COPY --from=builder /app/packages/web/public ./public

# Debug: show what was copied
RUN find . -maxdepth 3 -type f -name "*.js" | head -10

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Try server.js at root (standard standalone)
CMD ["node", "server.js"]
