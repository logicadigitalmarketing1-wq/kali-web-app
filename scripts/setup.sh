#!/bin/bash

set -e

echo "🔧 SecureScope Setup Script"
echo "=========================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ All prerequisites met"

# Create .env if not exists
echo ""
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please review and update settings."
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Start infrastructure
echo ""
echo "Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

# Wait for services
echo "Waiting for services to be ready..."
sleep 5

# Run migrations
echo ""
echo "Running database migrations..."
npm run db:migrate

# Seed database
echo ""
echo "Seeding database..."
npm run db:seed

# Build sandbox image
echo ""
echo "Building executor sandbox image..."
docker build -t securescope/executor-sandbox:latest -f apps/executor/sandbox/Dockerfile .

echo ""
echo "=========================="
echo "✅ Setup complete!"
echo ""
echo "To start the development servers:"
echo "  docker-compose up"
echo ""
echo "Or start individual services:"
echo "  npm run dev:api     # API server on port 3001"
echo "  npm run dev:web     # Web UI on port 3000"
echo "  npm run dev:executor # Executor service"
echo ""
echo "Default credentials:"
echo "  Admin: admin@securescope.local / SecureScope2024!"
echo "  Engineer: engineer@securescope.local / Engineer2024!"
echo ""
