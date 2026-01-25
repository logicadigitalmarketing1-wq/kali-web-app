# CLAUDE.md - Security Assessment Platform

## Project Overview

This is **SecureScope** - a comprehensive web-based security assessment and diagnostics platform built with Node.js/TypeScript. It provides a unified interface for running security tools, interpreting results with AI assistance, and managing findings with full traceability.

## Quick Start

```bash
# Install dependencies
npm install

# Start local development (requires Docker)
docker-compose up -d

# Run database migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Start development servers
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           TRUST BOUNDARY: Internet                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              WAF / ALB                                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                     TRUST BOUNDARY: Application                        │
│                                   │                                    │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐  │
│  │   web-ui    │◄─────────►│     api     │◄─────────►│     db      │  │
│  │  (Next.js)  │           │  (NestJS)   │           │ (PostgreSQL)│  │
│  └─────────────┘           └──────┬──────┘           └─────────────┘  │
│                                   │                                    │
│                    ┌──────────────┼──────────────┐                    │
│                    │              │              │                    │
│                    ▼              ▼              ▼                    │
│              ┌──────────┐  ┌──────────┐  ┌─────────────┐              │
│              │  redis   │  │ executor │  │ llm-gateway │              │
│              │ (BullMQ) │  │ (Runner) │  │  (Claude)   │              │
│              └──────────┘  └────┬─────┘  └─────────────┘              │
│                                 │                                      │
└─────────────────────────────────┼──────────────────────────────────────┘
                                  │
┌─────────────────────────────────┼──────────────────────────────────────┐
│              TRUST BOUNDARY: Sandbox (Docker Container)                │
│                                 │                                      │
│  ┌──────────────────────────────▼─────────────────────────────────┐   │
│  │  Isolated Tool Execution Environment                           │   │
│  │  - No shell access, argv-only execution                        │   │
│  │  - Dropped capabilities, seccomp profile                       │   │
│  │  - Network egress restricted to allowed scopes                 │   │
│  │  - Resource limits (CPU, memory, PIDs, timeout)                │   │
│  └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL 15+ |
| Queue | BullMQ + Redis |
| Auth | Argon2id, TOTP (otplib), secure sessions |
| Executor | Docker-based sandbox with network isolation |
| LLM | Claude API (Anthropic) |
| IaC | Terraform (AWS) |
| CI/CD | GitHub Actions |

## Directory Structure

```
/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/             # App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Client utilities
│   │   └── styles/          # Global styles
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/        # Authentication module
│   │   │   ├── tools/       # Tool management
│   │   │   ├── runs/        # Run execution
│   │   │   ├── findings/    # Finding management
│   │   │   ├── chat/        # Chatbot module
│   │   │   ├── admin/       # Admin endpoints
│   │   │   ├── llm/         # LLM gateway
│   │   │   └── common/      # Shared utilities
│   │   └── prisma/          # Database schema
│   └── executor/            # Sandbox runner service
│       ├── src/
│       └── sandbox/         # Container configs
├── packages/
│   ├── shared/              # Shared types & utils
│   ├── tool-schemas/        # Tool manifest schemas
│   └── security-utils/      # Security helpers
├── tools/                   # Tool manifest definitions
│   └── manifests/           # JSON tool configs
├── infra/
│   ├── terraform/           # AWS infrastructure
│   └── docker/              # Docker configurations
├── scripts/                 # Development scripts
├── docker-compose.yml
└── turbo.json              # Monorepo config
```

## Required Skills & MCPs

### Recommended MCP Servers to Install

1. **filesystem** - For file operations across the project
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/kali-web-app"]
       }
     }
   }
   ```

2. **postgres** - For database operations
   ```json
   {
     "mcpServers": {
       "postgres": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-postgres"],
         "env": {
           "POSTGRES_CONNECTION_STRING": "postgresql://postgres:postgres@localhost:5432/securescope"
         }
       }
     }
   }
   ```

3. **github** - For repository management
   ```json
   {
     "mcpServers": {
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>"
         }
       }
     }
   }
   ```

4. **docker** - For container management (optional but useful)
   ```json
   {
     "mcpServers": {
       "docker": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-docker"]
       }
     }
   }
   ```

### Skills/Tools Claude Code Should Use

- **TypeScript** - Primary language for all code
- **Prisma** - Database schema and migrations
- **NestJS** - Backend API framework
- **Next.js** - Frontend framework
- **Docker** - Container orchestration
- **Terraform** - Infrastructure as code
- **Security best practices** - OWASP, CWE mapping

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint + Prettier configuration
- Use Zod for all runtime validation
- Prefer composition over inheritance
- Write tests for critical paths

### Security Requirements

1. **Authentication**
   - Argon2id with params: memory=65536, iterations=3, parallelism=4
   - Session tokens: 32 bytes, cryptographically random
   - Password policy: min 12 chars, complexity requirements
   - Account lockout after 5 failed attempts

2. **Authorization**
   - RBAC with three roles: Admin, Engineer, Viewer
   - Scope-based access control for tool execution
   - Row-level security on findings/runs

3. **Input Validation**
   - All inputs validated with Zod schemas
   - SQL injection prevention via Prisma
   - Command injection prevention via argv-only execution
   - XSS prevention via React + CSP

4. **Output Handling**
   - Secrets redacted before LLM submission
   - Structured logging with pino
   - Audit log for all sensitive operations

### Tool Manifest Format

```json
{
  "name": "nmap-basic",
  "displayName": "Nmap Port Scanner",
  "category": "network-diagnostics",
  "description": "Network discovery and security auditing",
  "binary": "/usr/bin/nmap",
  "riskLevel": "medium",
  "allowedScopes": ["internal", "authorized"],
  "argsSchema": {
    "type": "object",
    "properties": {
      "target": { "type": "string", "format": "hostname-or-ip" },
      "ports": { "type": "string", "pattern": "^[0-9,-]+$" },
      "scanType": { "type": "string", "enum": ["-sT", "-sS", "-sU"] }
    },
    "required": ["target"]
  },
  "commandTemplate": ["nmap", "{{scanType}}", "-p", "{{ports}}", "{{target}}"],
  "timeout": 300000,
  "resourceLimits": {
    "memory": "512Mi",
    "cpu": "0.5"
  },
  "outputParser": "parsers/nmap",
  "redactionRules": ["password", "token", "key", "secret"]
}
```

## Environment Variables

### Required for Development

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/securescope

# Redis
REDIS_URL=redis://localhost:6379

# Session
SESSION_SECRET=<32-byte-hex-string>

# Claude API
ANTHROPIC_API_KEY=<your-api-key>  # Optional: mock LLM used if not set

# App
NODE_ENV=development
API_URL=http://localhost:3001
WEB_URL=http://localhost:3000
```

### Required for Production

```bash
# Set via AWS Secrets Manager
DATABASE_URL
REDIS_URL
SESSION_SECRET
ANTHROPIC_API_KEY

# Set via environment
NODE_ENV=production
LOG_LEVEL=info
```

## Common Commands

```bash
# Development
npm run dev              # Start all services
npm run dev:api          # Start API only
npm run dev:web          # Start web only
npm run dev:executor     # Start executor only

# Database
npm run db:migrate       # Run migrations
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed demo data
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run all tests
npm run test:api         # Test API
npm run test:web         # Test web
npm run test:e2e         # End-to-end tests

# Build
npm run build            # Build all packages
npm run lint             # Lint all packages
npm run typecheck        # TypeScript check

# Docker
docker-compose up -d     # Start infrastructure
docker-compose down      # Stop infrastructure
docker-compose logs -f   # View logs
```

## RBAC Roles

| Role | Capabilities |
|------|--------------|
| Admin | Full access: manage users, tools, scopes, view all data, audit logs |
| Engineer | Run tools within assigned scopes, view own runs/findings, use chat |
| Viewer | Read-only access to runs/findings within assigned scopes |

## API Endpoints Overview

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | /auth/login | Login with password | Public |
| POST | /auth/logout | End session | All |
| POST | /auth/2fa/setup | Setup TOTP | All |
| POST | /auth/2fa/verify | Verify TOTP | All |
| GET | /tools | List all tools | All |
| GET | /tools/:id | Get tool details | All |
| POST | /runs | Execute a tool | Engineer, Admin |
| GET | /runs | List runs | All |
| GET | /runs/:id | Get run details | All |
| GET | /findings | List findings | All |
| POST | /chat | Send chat message | Engineer, Admin |
| GET | /admin/users | List users | Admin |
| POST | /admin/users | Create user | Admin |
| GET | /admin/audit | View audit logs | Admin |

## LLM Integration Guidelines

### System Prompt Requirements

The LLM gateway enforces:
1. No exploit/attack guidance
2. Focus on interpretation and remediation
3. Conservative severity ratings
4. OWASP/CWE references when applicable
5. Redaction of sensitive data

### Response Schema

```typescript
interface LLMInterpretation {
  summary: string;
  keyObservations: string[];
  potentialIssues: Array<{
    title: string;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    description: string;
    remediation: string;
    references: string[];
  }>;
  recommendations: string[];
}
```

## Threat Model Summary (STRIDE)

| Threat | Surface | Mitigation |
|--------|---------|------------|
| Spoofing | Auth | Argon2id, 2FA, session tokens |
| Tampering | Commands | Argv-only execution, input validation |
| Repudiation | All | Append-only audit log |
| Info Disclosure | LLM, DB | Secret redaction, encryption at rest |
| DoS | API, Executor | Rate limiting, resource limits |
| Elevation | RBAC | Scope-based access, role checks |

## Testing Strategy

1. **Unit Tests** - Business logic, validators
2. **Integration Tests** - API endpoints, DB operations
3. **E2E Tests** - Critical user flows
4. **Security Tests** - Auth bypass, injection attempts

## Deployment Checklist

- [ ] All secrets in Secrets Manager
- [ ] TLS enabled via ACM
- [ ] WAF rules configured
- [ ] Security groups least-privilege
- [ ] Audit logging enabled
- [ ] Backup/DR configured
- [ ] Monitoring alerts set up

## Contributing

1. Create feature branch from `main`
2. Follow code style guidelines
3. Add tests for new functionality
4. Update documentation as needed
5. Submit PR with clear description
