# SecureScope Web Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.json ./

# Build packages
RUN npm run build --workspace=@securescope/shared

EXPOSE 3000

CMD ["npm", "run", "dev:web"]
