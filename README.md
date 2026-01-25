# SecureScope

A comprehensive web-based security assessment and diagnostics platform built with Node.js/TypeScript.

## Features

- **Tool Catalog**: Browse and execute security tools organized by category
- **Isolated Execution**: Tools run in Docker sandbox containers with resource limits
- **AI-Powered Analysis**: Claude interprets tool output and identifies security issues
- **Finding Management**: Track, triage, and remediate security findings
- **Role-Based Access**: Admin, Engineer, and Viewer roles with scope-based access
- **2FA Support**: TOTP-based two-factor authentication with recovery codes
- **Audit Logging**: Complete audit trail of all security-relevant actions
- **Chat Assistant**: AI-powered chat to discuss findings and get remediation guidance

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Git

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd securescope

# Run setup script
./scripts/setup.sh

# Or manually:
cp .env.example .env
npm install
docker-compose up -d postgres redis
npm run db:migrate
npm run db:seed
```

### Start Development

```bash
# Start all services with Docker Compose
docker-compose up

# Or start services individually
npm run dev:api      # API server on port 3001
npm run dev:web      # Web UI on port 3000
npm run dev:executor # Executor service
```

### Access the Application

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs (Swagger)

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@securescope.local | SecureScope2024! |
| Engineer | engineer@securescope.local | Engineer2024! |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SecureScope Platform                      │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │   Web UI    │────►│     API     │────►│   PostgreSQL    │   │
│  │  (Next.js)  │     │  (NestJS)   │     │                 │   │
│  └─────────────┘     └──────┬──────┘     └─────────────────┘   │
│                             │                                    │
│                    ┌────────┴────────┐                          │
│                    │                 │                          │
│                    ▼                 ▼                          │
│              ┌──────────┐    ┌─────────────┐                   │
│              │  Redis   │    │  Executor   │                   │
│              │ (BullMQ) │    │  Service    │                   │
│              └──────────┘    └──────┬──────┘                   │
│                                     │                           │
│                              ┌──────▼──────┐                   │
│                              │   Docker    │                   │
│                              │  Sandbox    │                   │
│                              └─────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS backend API
│   ├── web/          # Next.js frontend
│   └── executor/     # Tool execution service
├── packages/
│   ├── shared/       # Shared types and utilities
│   ├── tool-schemas/ # Tool manifest schemas
│   └── security-utils/
├── tools/
│   └── manifests/    # Tool configuration files
├── infra/
│   ├── docker/       # Docker configurations
│   └── terraform/    # AWS infrastructure
├── scripts/          # Development scripts
└── docs/             # Documentation
```

## Available Tools

| Category | Tools |
|----------|-------|
| Network Diagnostics | Nmap, Traceroute |
| TLS/HTTP | SSLyze, testssl.sh, curl, Nikto |
| DNS | dig |
| Inventory | WHOIS, Subfinder |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://postgres:postgres@localhost:5432/securescope |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| SESSION_SECRET | Session encryption key | (required) |
| ANTHROPIC_API_KEY | Claude API key for AI features | (optional) |
| WEB_URL | Frontend URL | http://localhost:3000 |
| API_URL | API URL | http://localhost:3001 |

### Adding New Tools

1. Create a manifest JSON in `tools/manifests/`:

```json
{
  "name": "my-tool",
  "displayName": "My Tool",
  "category": "network-diagnostics",
  "description": "Description of the tool",
  "riskLevel": "low",
  "binary": "/usr/bin/my-tool",
  "commandTemplate": ["my-tool", "{{target}}"],
  "argsSchema": [
    {
      "name": "target",
      "displayName": "Target",
      "type": "host",
      "required": true
    }
  ],
  "timeout": 60000
}
```

2. Add the tool binary to the sandbox Dockerfile
3. Run `npm run db:seed` to load the new tool

## Security

- **Authentication**: Argon2id password hashing with 2FA support
- **Authorization**: RBAC with scope-based access control
- **Execution**: Tools run in isolated Docker containers
- **Input Validation**: Zod schemas for all inputs
- **Secret Redaction**: Automatic redaction of sensitive data
- **Audit Logging**: Complete audit trail

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full security analysis.

## Deployment

### AWS (Terraform)

```bash
cd infra/terraform/environments/prod
terraform init
terraform plan
terraform apply
```

See [infra/terraform/README.md](infra/terraform/README.md) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test`
5. Submit a pull request

## License

MIT
