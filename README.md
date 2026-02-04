# HexStrike Security Platform

A professional web application providing a UI for HexStrike AI MCP security tools with Claude-powered analysis.

## Features

- **26+ Security Tools** organized by category (Network, Web, Password, OSINT, Binary, Forensics)
- **Claude AI Analysis** - Automatic interpretation of scan results with OWASP/CWE mapping
- **Secure Execution** - Scope-based authorization and sandboxed tool execution
- **RBAC** - Admin, Engineer, and Viewer roles with 2FA support
- **Full Audit Logging** - Track all security-relevant actions
- **Chat Interface** - Discuss findings with Claude AI assistant

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌───────────────┐
│  Next.js    │─────▶│   NestJS    │─────▶│  PostgreSQL   │
│  Frontend   │      │   API       │      │  + Redis      │
│  :3000      │      │  :4000      │      │  :5432/:6379  │
└─────────────┘      └──────┬──────┘      └───────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                              ▼
 ┌──────────────────────┐    ┌──────────────────────┐
 │  HexStrike AI MCP    │    │  Claude API          │
 │  :8888 (Kali Docker) │    │  (Analysis Engine)   │
 └──────────────────────┘    └──────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm 8+
- Claude API key (Anthropic)

### 1. Clone and Setup

```bash
git clone <repo-url>
cd kali-web-app

# Copy environment file
cp .env.example .env

# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and HexStrike MCP
docker-compose up -d

# Wait for HexStrike to initialize (first time takes ~5 min)
docker logs -f kali-hexstrike
```

### 3. Install Dependencies & Run

```bash
# Install all packages
pnpm install

# Run database migrations
pnpm db:migrate

# Seed database with tools and admin user
pnpm db:seed

# Start development servers
pnpm dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **HexStrike MCP**: http://localhost:8888

### Default Admin Credentials

```
Email: admin@hexstrike.local
Password: admin123!@#
```

**Important**: Change the admin password after first login!

## Project Structure

```
kali-web-app/
├── packages/
│   ├── api/          # NestJS backend
│   ├── web/          # Next.js frontend
│   └── executor/     # Tool execution service
├── tools/
│   └── manifests/    # Tool JSON definitions
├── infra/
│   ├── terraform/    # AWS IaC
│   └── docker/       # Dockerfiles
└── hexstrike-ai/     # HexStrike MCP (cloned)
```

## Available Tools

| Category | Tools |
|----------|-------|
| Network | Nmap, Masscan |
| Web Security | Gobuster, Feroxbuster, Nikto, SQLMap, WPScan, Dirb, Dirsearch, HTTPx, Curl |
| Vulnerability | Nuclei |
| Password | Hydra, John, Hashcat |
| OSINT | Amass, Subfinder |
| Binary | Binwalk, Checksec, Strings, File |
| Forensics | Foremost, Steghide, ExifTool |

## Security

- **Authentication**: Argon2id password hashing, secure sessions
- **2FA**: TOTP with recovery codes
- **Authorization**: RBAC with scope-based access control
- **Execution**: No shell injection, template-based commands only
- **LLM Safety**: Secret redaction, prompt injection defenses

## Development

```bash
# Run API only
pnpm --filter @hexstrike/api dev

# Run Web only
pnpm --filter @hexstrike/web dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Database studio
pnpm db:studio
```

## Environment Variables

See [.env.example](.env.example) for all configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ANTHROPIC_API_KEY` - Claude API key
- `HEXSTRIKE_URL` - HexStrike MCP endpoint
- `SESSION_SECRET` - Session encryption key

## License

Proprietary - Internal Use Only
