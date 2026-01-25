# SecureScope API Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/tool-schemas/package*.json ./packages/tool-schemas/
COPY packages/security-utils/package*.json ./packages/security-utils/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tools ./tools
COPY tsconfig.json ./

# Generate Prisma client
RUN npm run db:generate --workspace=@securescope/api

# Build packages
RUN npm run build --workspace=@securescope/shared
RUN npm run build --workspace=@securescope/tool-schemas

EXPOSE 3001

CMD ["npm", "run", "dev:api"]
