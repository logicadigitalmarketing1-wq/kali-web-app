# HexStrike API Dockerfile
FROM node:20-alpine AS base

RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --filter @hexstrike/api

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY packages/api ./packages/api
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/api
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/node_modules ./node_modules
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/packages/api/package.json ./

USER nestjs

EXPOSE 4000

CMD ["node", "dist/main.js"]
