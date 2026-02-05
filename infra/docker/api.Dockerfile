# HexStrike API Dockerfile
FROM node:20-alpine AS base

RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/api/package.json ./packages/api/

# Install all dependencies including devDependencies for build
RUN pnpm install --frozen-lockfile --filter @hexstrike/api...

FROM base AS builder
WORKDIR /app

# Copy everything from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source and config files
COPY packages/api ./packages/api
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/packages/api

# Add node_modules/.bin to PATH for CLI tools (nest, prisma)
ENV PATH="/app/node_modules/.bin:/app/packages/api/node_modules/.bin:$PATH"

# Generate Prisma client and build
RUN prisma generate
RUN nest build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy built output and package files
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/packages/api/prisma ./prisma

# Install production dependencies with npm (not pnpm) to avoid symlink issues
RUN npm install --omit=dev --ignore-scripts

# Generate Prisma client in the final stage
RUN npx prisma generate

USER nestjs

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
