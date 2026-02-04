# CLAUDE.md - HexStrike Security Platform

## Project Overview

HexStrike Security Platform is a professional web application providing a UI for HexStrike AI MCP (running on Kali Linux in Docker) with Claude MCP for intelligent analysis of security assessment results.

**Repository**: kali-web-app
**Status**: Active Development

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYSTEM ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌───────────────┐   │
│   │  Next.js    │─────▶│   NestJS    │─────▶│  PostgreSQL   │   │
│   │  Frontend   │      │   API       │      │  + Redis      │   │
│   │  :3000      │      │  :4000      │      │  :5432/:6379  │   │
│   └─────────────┘      └──────┬──────┘      └───────────────┘   │
│                               │                                  │
│                               ▼                                  │
│                      ┌────────────────┐                         │
│                      │    Executor    │                         │
│                      │   (BullMQ)     │                         │
│                      └───────┬────────┘                         │
│                              │                                   │
│               ┌──────────────┴──────────────┐                   │
│               ▼                              ▼                   │
│   ┌──────────────────────┐    ┌──────────────────────┐         │
│   │  HexStrike AI MCP    │    │  Claude API          │         │
│   │  :8888 (Kali Docker) │    │  (Analysis Engine)   │         │
│   └──────────────────────┘    └──────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS with Fastify adapter, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Cache/Queue | Redis + BullMQ |
| Auth | Argon2id, TOTP (otplib), secure sessions |
| Execution | HexStrike AI MCP (Docker) |
| Analysis | Claude API (Anthropic) |
| Package Manager | pnpm (workspaces) |

## Code Quality Standards

The following skills are installed and should be applied throughout development:

### Core Skills (Apply Always)
- `vercel-react-best-practices` - Apply all 57 React/Next.js optimization rules
- `nestjs-best-practices` - Apply all 40 NestJS architecture and security rules
- `supabase-postgres-best-practices` - Apply PostgreSQL optimization patterns
- `web-design-guidelines` - Follow UI/UX design principles

### Frontend Skills
- `frontend-design` - Modern frontend patterns and distinctive UI
- `tailwind-design-system` - Consistent Tailwind CSS usage
- `shadcn-ui` - Proper shadcn/ui component usage

### Backend Skills
- `nodejs-backend-patterns` - Node.js best practices
- `typescript-advanced-types` - Strong TypeScript typing
- `api-design-principles` - RESTful API design
- `postgresql-table-design` - Optimal database schema design

### Security Skills
- `better-auth-best-practices` - Secure authentication patterns
- `auth-implementation-patterns` - Auth implementation standards

### Testing & DevOps Skills
- `webapp-testing` - Testing patterns and coverage
- `test-driven-development` - TDD approach
- `turborepo` - Monorepo structure optimization
- `github-actions-templates` - CI/CD workflows
- `architecture-patterns` - Software architecture best practices

### When Writing React/Next.js Code
1. Use `Promise.all()` for parallel data fetching
2. Use `next/dynamic` for heavy components
3. Import directly from modules, avoid barrel files
4. Use `React.cache()` for request deduplication
5. Minimize props serialization in Server Components
6. Use React Query for client-side data fetching
7. Apply proper memoization patterns

### When Writing NestJS Code
1. Follow module boundaries and single responsibility
2. Use dependency injection properly
3. Implement guards for authorization
4. Use interceptors for cross-cutting concerns
5. Apply proper exception filters
6. Use DTOs with class-validator
7. Implement health checks

## Skills Applied Status

This section tracks which best practices from installed skills have been applied.

### Backend Skills Status (Updated 2026-01-27)

| Skill | Applied | Implementation Notes |
|-------|---------|---------------------|
| `nestjs-best-practices` | ✅ 12/15 | DTOs, Guards, Filters, Interceptors implemented |
| `api-design-principles` | ✅ Applied | RESTful endpoints with proper HTTP status codes |
| `better-auth-best-practices` | ✅ Applied | Argon2id, sessions, 2FA, account lockout |
| `supabase-postgres-best-practices` | ✅ Applied | Prisma schema with indexes, enums, relations |

**Backend Implementations:**
- ✅ DTOs with class-validator for all endpoints
- ✅ SessionGuard for authentication
- ✅ RoleGuard for RBAC (ADMIN > ENGINEER > VIEWER)
- ✅ ScopeGuard for target validation
- ✅ HttpExceptionFilter, PrismaExceptionFilter
- ✅ LoggingInterceptor, TransformInterceptor
- ✅ 2FA with TOTP and recovery codes
- ✅ AuditService for action logging
- ✅ Health check endpoint

### Frontend Skills Status (Updated 2026-01-27)

| Skill | Applied | Implementation Notes |
|-------|---------|---------------------|
| `vercel-react-best-practices` | ✅ 9/10 | Parallel fetching, dynamic imports, shared components |
| `shadcn-ui` | ✅ Applied | 19+ components configured |
| `tailwind-design-system` | ✅ Applied | Dark mode, severity colors, centralized utilities |

**Frontend Implementations:**
- ✅ `useQueries()` for parallel data fetching (dashboard, tools pages)
- ✅ `next/dynamic` for heavy components (TerminalOutput, ConversationsList)
- ✅ Shared StatusBadge component with centralized styling
- ✅ Centralized color utilities (getSeverityColor, getStatusColor, getHealthStatusColor)
- ✅ Memoized components to prevent re-renders
- ✅ React Query for all client-side data fetching
- ⬜ `React.cache()` for server-side deduplication (pending SSR adoption)

### Testing & DevOps Status

| Skill | Applied | Implementation Notes |
|-------|---------|---------------------|
| `test-driven-development` | ❌ Not Started | Need Jest, Vitest, Playwright setup |
| `github-actions-templates` | ❌ Not Started | CI/CD workflows pending |
| `turborepo` | ✅ Applied | Monorepo structure with pnpm workspaces |

## Repository Structure

```
kali-web-app/
├── CLAUDE.md                    # This file
├── README.md                    # User documentation
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml          # pnpm workspaces
├── docker-compose.yml           # Full stack compose
├── Makefile                     # Dev commands
├── .env.example                 # Environment template
│
├── packages/
│   ├── web/                     # Next.js Frontend
│   ├── api/                     # NestJS Backend
│   └── executor/                # Tool execution service
│
├── tools/
│   └── manifests/               # Tool JSON definitions
│
├── infra/
│   ├── terraform/               # AWS IaC
│   └── docker/                  # Dockerfiles
│
└── .github/workflows/           # CI/CD
```

## Development Commands

```bash
# Start all services
docker-compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Seed database with initial data
pnpm db:seed

# Start development servers
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## MCP Integration

### HexStrike AI MCP
- **Endpoint**: http://localhost:8888
- **Tools Available**: 150+ security tools
- **Categories**: Network Reconnaissance, Web Security, Vulnerability Scanning, Password & Auth, OSINT & Recon, Binary Analysis, Forensics & CTF, Cloud & Container, API Security, Exploitation

### Claude API
- **Purpose**: Analyze scan outputs, map to OWASP/CWE, generate remediation
- **Model**: claude-sonnet-4-20250514 (configurable)
- **Features**: Structured JSON responses with Zod validation

## Security Tools Arsenal (200+ Tools)

### Network Reconnaissance (15+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Nmap | Network discovery with NSE scripts | MEDIUM |
| Masscan | High-speed Internet-scale port scanning | MEDIUM |
| Rustscan | Ultra-fast port scanner with Nmap integration | MEDIUM |
| AutoRecon | Comprehensive automated reconnaissance | MEDIUM |
| Fierce | DNS reconnaissance and zone transfers | LOW |
| DNSEnum | DNS enumeration and brute forcing | LOW |
| ARP-Scan | Layer 2 network discovery | LOW |
| NBTScan | NetBIOS name scanning | LOW |
| RPCClient | MS-RPC enumeration | MEDIUM |
| Enum4linux | SMB enumeration suite | MEDIUM |
| Enum4linux-ng | Advanced SMB enumeration | MEDIUM |
| SMBMap | SMB share enumeration | MEDIUM |
| Responder | LLMNR/NBT-NS poisoner | HIGH |
| NetExec | Network exploitation framework | HIGH |

### Local Network Security (7+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Netdiscover | Active/passive ARP reconnaissance | LOW |
| Bettercap | Network attacks and monitoring (WiFi, BLE, MITM) | HIGH |
| Ettercap | Man-in-the-middle attack suite | HIGH |
| MITMproxy | TLS-capable intercepting HTTP proxy | MEDIUM |
| TCPDump | Command-line packet analyzer | LOW |
| Tshark | Terminal-based Wireshark | LOW |
| Hping3 | Network packet assembler/analyzer | MEDIUM |

### External Network Security (8+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Shodan CLI | Internet-connected device search engine | INFO |
| Censys CLI | Internet device and certificate search | INFO |
| Whatweb | Website technology identification | INFO |
| DNSRecon | Comprehensive DNS enumeration | LOW |
| Whois | Domain registration information | INFO |
| Dig | DNS lookup utility | INFO |
| Nslookup | DNS query tool | INFO |
| Host | Simple DNS lookup | INFO |

### Web Application Security (25+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Gobuster | Directory and DNS enumeration | LOW |
| Feroxbuster | Recursive content discovery | LOW |
| FFuf | Fast web fuzzer | LOW |
| Dirsearch | Web path discovery | LOW |
| Dirb | Classic web scanner | LOW |
| Nikto | Web server vulnerability scanner | MEDIUM |
| SQLMap | Automatic SQL injection | HIGH |
| WPScan | WordPress security scanner | MEDIUM |
| Nuclei | Template-based vulnerability scanner | MEDIUM |
| Katana | JavaScript-aware crawler | LOW |
| Hakrawler | Fast endpoint discovery | LOW |
| Gau | URL discovery from archives | INFO |
| Waybackurls | Wayback Machine URL fetcher | INFO |
| Arjun | HTTP parameter discovery | LOW |
| ParamSpider | Parameter mining | INFO |
| X8 | Hidden parameter discovery | LOW |
| Jaeles | Custom signature scanner | MEDIUM |
| Dalfox | Advanced XSS scanner | MEDIUM |
| Wafw00f | WAF fingerprinting | INFO |
| TestSSL | SSL/TLS testing | INFO |
| SSLScan | SSL cipher enumeration | INFO |
| SSLyze | SSL/TLS analyzer | INFO |
| Commix | Command injection exploitation | HIGH |
| NoSQLMap | NoSQL injection testing | HIGH |
| Tplmap | Template injection exploitation | HIGH |

### Database Security (8+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| SQLMap | SQL injection and database takeover | HIGH |
| NoSQLMap | NoSQL database exploitation (MongoDB, CouchDB) | HIGH |
| MongoDB Scanner | Exposed MongoDB instance detection | MEDIUM |
| MySQL Audit | MySQL security assessment | MEDIUM |
| PostgreSQL Audit | PostgreSQL security assessment | MEDIUM |
| Redis Scanner | Redis security scanning | MEDIUM |
| MSSQL Audit | Microsoft SQL Server assessment (Impacket) | MEDIUM |
| Oracle Audit (ODAT) | Oracle database attacking tool | MEDIUM |

### AWS Security (6+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Prowler AWS | AWS security best practices (300+ checks) | MEDIUM |
| ScoutSuite AWS | Multi-cloud security auditing | MEDIUM |
| Pacu | AWS exploitation framework | HIGH |
| CloudMapper | AWS environment analysis and visualization | LOW |
| S3Scanner | Open S3 bucket scanner | MEDIUM |
| AWS CLI | Direct AWS service access | LOW |

### Azure Security (5+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Prowler Azure | Azure CIS benchmark assessment | MEDIUM |
| ScoutSuite Azure | Azure security configuration auditing | MEDIUM |
| Azure CLI | Direct Azure service access | LOW |
| ROADtools | Azure AD exploration framework | MEDIUM |
| AzureHound | Azure AD BloodHound data collector | MEDIUM |

### GCP Security (4+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Prowler GCP | GCP CIS benchmark assessment | MEDIUM |
| ScoutSuite GCP | GCP security configuration auditing | MEDIUM |
| GCloud CLI | Direct GCP service access | LOW |
| GCPBucketBrute | GCP bucket enumeration | LOW |

### Cloud & Container Security (7+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Trivy | Container vulnerability scanner | MEDIUM |
| Kube-Hunter | Kubernetes penetration testing | MEDIUM |
| Kube-Bench | CIS Kubernetes benchmarks | MEDIUM |
| Docker Bench | Docker security assessment | MEDIUM |
| Checkov | IaC security scanning | LOW |
| Falco | Runtime container monitoring | MEDIUM |
| Clair | Container vulnerability analysis | MEDIUM |

### Active Directory Security (8+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| BloodHound | AD attack path mapping | MEDIUM |
| GetUserSPNs | Kerberoasting attack tool | HIGH |
| GetNPUsers | AS-REP Roasting attack tool | HIGH |
| Secretsdump | Credential extraction (SAM, LSA, NTDS) | CRITICAL |
| CrackMapExec | Windows/AD pentesting swiss army knife | HIGH |
| Kerbrute | Kerberos brute-forcing | MEDIUM |
| LDAPSearch | LDAP/AD enumeration | LOW |
| Rubeus | Kerberos abuse toolkit | HIGH |

### Wireless Security (8+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Aircrack-ng | WiFi security auditing suite | HIGH |
| Airodump-ng | Wireless packet capture | MEDIUM |
| Aireplay-ng | Wireless packet injection | HIGH |
| Wifite | Automated wireless auditor | HIGH |
| Reaver | WPS PIN brute force | HIGH |
| Kismet | Wireless network detector/sniffer | LOW |
| Fern WiFi Cracker | Wireless security auditing | HIGH |
| Bully | WPS brute force (Reaver alternative) | HIGH |

### Password & Authentication (8+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Hydra | Network login cracker (50+ protocols) | HIGH |
| John the Ripper | Hash cracking with custom rules | MEDIUM |
| Hashcat | GPU-accelerated password recovery | MEDIUM |
| Medusa | Parallel login brute-forcer | HIGH |
| Patator | Multi-purpose brute-forcer | HIGH |
| Evil-WinRM | WinRM shell for pentesting | HIGH |
| Hash-Identifier | Hash type identification | INFO |
| HashID | Advanced hash identification | INFO |

### Binary Analysis & Reverse Engineering (12+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Binwalk | Firmware analysis and extraction | LOW |
| Checksec | Binary security feature checker | INFO |
| Strings | Extract printable strings | INFO |
| File | File type identification | INFO |
| GDB | GNU debugger | MEDIUM |
| Radare2 | Reverse engineering framework | MEDIUM |
| Ghidra | NSA's reverse engineering suite | MEDIUM |
| ROPgadget | ROP gadget finder | MEDIUM |
| Ropper | Gadget finder and chain builder | MEDIUM |
| One-Gadget | One-shot RCE gadget finder | MEDIUM |
| Objdump | Object file disassembler | INFO |
| Readelf | ELF file analyzer | INFO |
| Pwntools | CTF framework and exploit library | HIGH |
| MSFVenom | Metasploit payload generator | CRITICAL |

### Forensics & CTF (10+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Foremost | File carving and recovery | LOW |
| Steghide | Steganography detection/extraction | LOW |
| ExifTool | Metadata reader/writer | INFO |
| Volatility3 | Memory forensics framework | LOW |
| PhotoRec | File recovery software | LOW |
| Stegsolve | Steganography analysis | INFO |
| Zsteg | PNG/BMP steganography detection | INFO |
| Scalpel | Fast file carver | LOW |
| Bulk Extractor | Feature extraction tool | LOW |

### OSINT & Bug Bounty (10+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| Amass | Subdomain enumeration and OSINT | LOW |
| Subfinder | Passive subdomain discovery | LOW |
| theHarvester | Email and subdomain harvesting | LOW |
| Aquatone | Visual inspection of websites | INFO |
| Subjack | Subdomain takeover checker | MEDIUM |
| Sherlock | Username investigation (400+ sites) | INFO |
| Recon-ng | Web reconnaissance framework | LOW |
| SpiderFoot | OSINT automation (200+ modules) | LOW |
| TruffleHog | Git secret scanning | MEDIUM |

### API Security (3+ Tools)
| Tool | Description | Risk Level |
|------|-------------|------------|
| JWT-Tool | JWT vulnerability testing | MEDIUM |
| GraphQL Voyager | GraphQL schema exploration | INFO |
| Wfuzz | Web application fuzzer | MEDIUM |

## AI Agents (13 Specialized Agents)

### Core Decision Agents
| Agent | Type | Description |
|-------|------|-------------|
| Intelligent Decision Engine | DECISION_ENGINE | Tool selection, parameter optimization, workflow orchestration |
| Parameter Optimizer | PARAMETER_OPTIMIZER | Context-aware parameter tuning based on target characteristics |
| Technology Detector | TECHNOLOGY_DETECTOR | Technology stack identification and fingerprinting |

### Workflow Agents
| Agent | Type | Description |
|-------|------|-------------|
| Bug Bounty Workflow Manager | BUG_BOUNTY | Automated recon, scope compliance, report generation |
| CTF Challenge Solver | CTF_SOLVER | Multi-category challenge analysis and solution guidance |
| Vulnerability Correlator | VULNERABILITY_CORRELATOR | Attack chain discovery and multi-vuln correlation |

### Intelligence Agents
| Agent | Type | Description |
|-------|------|-------------|
| CVE Intelligence Manager | CVE_INTELLIGENCE | CVE monitoring, exploit availability, remediation advice |
| AI Exploit Generator | EXPLOIT_GENERATOR | Safe PoC generation with documentation |

### System Agents
| Agent | Type | Description |
|-------|------|-------------|
| Rate Limit Detector | RATE_LIMIT_DETECTOR | WAF detection, automatic throttling, evasion suggestions |
| Failure Recovery System | FAILURE_RECOVERY | Error handling, retry logic, graceful degradation |
| Performance Monitor | PERFORMANCE_MONITOR | Resource tracking, bottleneck identification |
| Graceful Degradation | GRACEFUL_DEGRADATION | Fallback workflows, service health monitoring |

### Browser Automation
| Agent | Type | Description |
|-------|------|-------------|
| Browser Agent | BROWSER_AGENT | Headless Chrome automation, DOM analysis, screenshot capture |

### Agent Capabilities
- **Smart Caching**: LRU-based result caching with TTL
- **Real-time Monitoring**: Live command control and metrics
- **Multi-tool Workflows**: Orchestrated scan sequences
- **Adaptive Learning**: Performance optimization from history

## Security Requirements

### Authentication
- Argon2id password hashing (memory: 64MB, iterations: 3, parallelism: 4)
- HTTP-only, Secure, SameSite=Strict cookies
- Session rotation on privilege changes
- Account lockout after 5 failed attempts (15 min)

### 2FA (TOTP)
- Mandatory for Admin and Engineer roles
- Recovery codes (10, one-time use)
- Re-authentication required for sensitive actions

### RBAC Roles
| Role | Permissions |
|------|-------------|
| Admin | Full access, user management, tool configuration |
| Engineer | Execute tools within assigned scopes |
| Viewer | Read-only access to runs and findings |

### Scope Validation
- All tool executions must target hosts within assigned scopes
- Scopes defined as CIDRs or hostname patterns
- Validation occurs before job queue submission

## Tool Manifest Format

Each security tool is defined by a JSON manifest:

```json
{
  "name": "nmap",
  "slug": "nmap",
  "category": "network",
  "description": "Network exploration and security auditing",
  "riskLevel": "MEDIUM",
  "binary": "nmap",
  "argsSchema": {
    "type": "object",
    "properties": {
      "target": { "type": "string", "required": true },
      "ports": { "type": "string", "default": "1-1000" },
      "scanType": { "type": "string", "enum": ["-sV", "-sT", "-sS"] }
    }
  },
  "commandTemplate": ["nmap", "{{scanType}}", "-p", "{{ports}}", "{{target}}"],
  "timeout": 600,
  "memoryLimit": 512,
  "outputParser": "nmap-parser"
}
```

## API Endpoints

### Auth
- `POST /auth/register` - Create account
- `POST /auth/login` - Authenticate
- `POST /auth/logout` - End session
- `POST /auth/2fa/setup` - Enable TOTP
- `POST /auth/2fa/verify` - Verify TOTP code

### Tools
- `GET /tools` - List all tools
- `GET /tools/:slug` - Get tool details
- `POST /tools/:slug/run` - Execute tool

### Runs
- `GET /runs` - List user's runs
- `GET /runs/:id` - Get run details with artifacts
- `GET /runs/:id/analysis` - Get Claude analysis

### Findings
- `GET /findings` - List findings with filters
- `GET /findings/stats` - Severity breakdown

### Chat
- `POST /chat/conversations` - Create conversation
- `POST /chat/conversations/:id/messages` - Send message
- `GET /chat/conversations/:id` - Get conversation

## Database Schema (Key Models)

### Core Models
- **User**: Authentication, roles, sessions, 2FA
- **Scope**: Authorized targets (CIDRs, hosts)
- **Tool**: Tool catalog with manifests (150+ tools)
- **ToolCategory**: Tool categorization (10 categories)
- **Run**: Execution history with artifacts
- **Finding**: Security findings with OWASP/CWE

### AI Agent Models
- **AIAgent**: Agent definitions and configurations
- **AgentExecution**: Agent execution history and logs

### System Models
- **AuditLog**: Immutable action log
- **CacheEntry**: Smart caching for results
- **SystemMetrics**: Performance monitoring data

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/hexstrike

# Redis
REDIS_URL=redis://localhost:6379

# Auth
SESSION_SECRET=<random-32-bytes>
TOTP_ISSUER=HexStrike

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# HexStrike MCP
HEXSTRIKE_URL=http://localhost:8888

# App
NODE_ENV=development
API_PORT=4001
WEB_PORT=4000
```

## Code Style

### TypeScript
- Strict mode enabled
- Explicit return types on functions
- No `any` types (use `unknown` if needed)
- Zod for runtime validation

### Naming Conventions
- Files: kebab-case (`auth.service.ts`)
- Classes: PascalCase (`AuthService`)
- Functions/variables: camelCase (`getUserById`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_LOGIN_ATTEMPTS`)
- Database tables: snake_case (via Prisma)

### Imports
- Absolute imports with `@/` prefix
- Group: external, internal, relative
- No default exports (except pages)

## Testing

### Unit Tests
- Jest for backend services
- Vitest for frontend components
- Mock external dependencies

### Integration Tests
- Supertest for API endpoints
- Test database with transactions

### E2E Tests
- Playwright for critical flows
- Auth, tool execution, findings view

## Security Checklist

- [ ] Input validation on all endpoints (Zod)
- [ ] Output encoding (XSS prevention)
- [ ] CSRF tokens on mutations
- [ ] Rate limiting (per IP + per user)
- [ ] Audit logging for sensitive actions
- [ ] Secret redaction before LLM calls
- [ ] CSP headers configured
- [ ] No shell execution in tool runner
- [ ] Scope validation before execution
- [ ] Session invalidation on password change

## Deployment

### Local Development
```bash
docker-compose up -d
pnpm dev
```

### Production (AWS)
- ECS Fargate for API and Web
- RDS PostgreSQL
- ElastiCache Redis
- ALB with WAF
- Secrets Manager for credentials
- CloudWatch for logs/metrics

## Troubleshooting

### HexStrike MCP not responding
```bash
docker logs kali-hexstrike
curl http://localhost:8888/health
```

### Database connection issues
```bash
docker-compose logs postgres
pnpm db:migrate --force
```

### Redis connection issues
```bash
docker-compose logs redis
redis-cli ping
```

## Contributing

1. Create feature branch from `main`
2. Follow code style guidelines
3. Add tests for new functionality
4. Update CLAUDE.md if architecture changes
5. Submit PR with clear description

## License

Proprietary - Internal Use Only
