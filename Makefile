.PHONY: setup dev dev-api dev-web dev-executor build test lint clean docker-up docker-down db-migrate db-seed db-studio sandbox-build

# Setup
setup:
	./scripts/setup.sh

# Development
dev:
	docker-compose up

dev-api:
	npm run dev:api

dev-web:
	npm run dev:web

dev-executor:
	npm run dev:executor

# Build
build:
	npm run build

# Test
test:
	npm run test

lint:
	npm run lint

typecheck:
	npm run typecheck

# Clean
clean:
	npm run clean
	docker-compose down -v

# Docker
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Database
db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

db-studio:
	npm run db:studio

db-reset:
	docker-compose down -v
	docker-compose up -d postgres redis
	sleep 5
	npm run db:migrate
	npm run db:seed

# Sandbox
sandbox-build:
	docker build -t securescope/executor-sandbox:latest -f apps/executor/sandbox/Dockerfile .

# Production build
prod-build:
	docker-compose -f docker-compose.prod.yml build

# Help
help:
	@echo "SecureScope Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup        - Run initial setup"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services with docker-compose"
	@echo "  make dev-api      - Start API server only"
	@echo "  make dev-web      - Start web UI only"
	@echo "  make dev-executor - Start executor only"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed the database"
	@echo "  make db-studio    - Open Prisma Studio"
	@echo "  make db-reset     - Reset database (destructive)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start infrastructure"
	@echo "  make docker-down  - Stop infrastructure"
	@echo "  make docker-logs  - View logs"
	@echo ""
	@echo "Build:"
	@echo "  make build        - Build all packages"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linter"
	@echo "  make sandbox-build - Build executor sandbox image"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Clean build artifacts and containers"
