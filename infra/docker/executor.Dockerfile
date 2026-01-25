# SecureScope Executor Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies including Docker CLI for container management
RUN apk add --no-cache python3 make g++ git docker-cli

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY apps/executor/package*.json ./apps/executor/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/tool-schemas/package*.json ./packages/tool-schemas/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/executor ./apps/executor
COPY packages ./packages
COPY tsconfig.json ./

# Build packages
RUN npm run build --workspace=@securescope/shared
RUN npm run build --workspace=@securescope/tool-schemas

CMD ["npm", "run", "dev:executor"]
