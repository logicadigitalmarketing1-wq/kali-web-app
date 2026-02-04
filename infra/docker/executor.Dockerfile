# HexStrike Executor Dockerfile
FROM node:20-alpine AS base

RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/executor/package.json ./packages/executor/

RUN pnpm install --frozen-lockfile --filter @hexstrike/executor

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/executor/node_modules ./packages/executor/node_modules
COPY packages/executor ./packages/executor
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/executor
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 executor

COPY --from=builder /app/packages/executor/dist ./dist
COPY --from=builder /app/packages/executor/node_modules ./node_modules
COPY --from=builder /app/packages/executor/package.json ./

USER executor

CMD ["node", "dist/index.js"]
