# SecureScope Architecture

## System Overview

SecureScope is a security assessment platform that provides a web interface for executing security tools in isolated containers, interpreting results with AI, and managing findings with full traceability.

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL BOUNDARY                                 │
│                                                                              │
│  Internet Users ──► WAF ──► ALB ──► [TLS Termination]                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION BOUNDARY                                 │
│                                                                              │
│  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐  │
│  │    web-ui       │◄──────►│      api        │◄──────►│       db        │  │
│  │   (Next.js)     │  REST  │   (NestJS)      │ Prisma │  (PostgreSQL)   │  │
│  │                 │        │                 │        │                 │  │
│  │ - React 18      │        │ - Auth          │        │ - Users         │  │
│  │ - App Router    │        │ - Tools         │        │ - Runs          │  │
│  │ - Tailwind      │        │ - Runs          │        │ - Findings      │  │
│  │ - shadcn/ui     │        │ - Findings      │        │ - Audit Logs    │  │
│  │                 │        │ - Chat          │        │                 │  │
│  └─────────────────┘        │ - Admin         │        └─────────────────┘  │
│                             └────────┬────────┘                              │
│                                      │                                       │
│                    ┌─────────────────┼─────────────────┐                    │
│                    │                 │                 │                    │
│                    ▼                 ▼                 ▼                    │
│           ┌─────────────┐    ┌─────────────┐    ┌─────────────┐            │
│           │    redis    │    │  executor   │    │ llm-gateway │            │
│           │  (BullMQ)   │    │  (Runner)   │    │  (Claude)   │            │
│           │             │    │             │    │             │            │
│           │ - Job Queue │    │ - Validate  │    │ - Interpret │            │
│           │ - Sessions  │    │ - Execute   │    │ - Redact    │            │
│           │ - Rate Lim  │    │ - Capture   │    │ - Summarize │            │
│           └─────────────┘    └──────┬──────┘    └─────────────┘            │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                         SANDBOX BOUNDARY                                     │
│                                     │                                        │
│  ┌──────────────────────────────────▼───────────────────────────────────┐   │
│  │                    Docker Container (Locked Down)                     │   │
│  │                                                                       │   │
│  │  - Root user disabled                                                 │   │
│  │  - Read-only filesystem (except /tmp)                                 │   │
│  │  - Dropped capabilities (CAP_NET_RAW kept for some tools)            │   │
│  │  - Seccomp profile applied                                           │   │
│  │  - No privileged mode                                                │   │
│  │  - CPU/Memory/PIDs limits                                            │   │
│  │  - Network: Default deny, whitelist only                             │   │
│  │  - Timeout enforcement (kill after limit)                            │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Trust Boundaries

### 1. External Boundary (Internet → WAF)
- All traffic passes through AWS WAF
- DDoS protection via AWS Shield
- Common attack pattern filtering (SQLi, XSS)
- Rate limiting at edge

### 2. Application Boundary (WAF → Application)
- TLS 1.2+ enforced
- Session-based authentication
- RBAC authorization
- Input validation (Zod schemas)
- CSRF protection

### 3. Sandbox Boundary (API → Executor)
- Job queue isolation (BullMQ)
- Container-based execution
- Network egress filtering
- Resource limits
- Timeout enforcement

## Data Flow

### Authentication Flow
```
User → Web UI → API → Argon2 Verify → Session Create → Redis → Cookie Set
                 ↓
              2FA Check (if enabled)
                 ↓
              Audit Log
```

### Tool Execution Flow
```
User → Web UI → API → Validate Params → Check Scope → Create Run → BullMQ
                                                                      ↓
                                                              Executor Service
                                                                      ↓
                                                           Docker Container
                                                                      ↓
                                                          Tool Execution
                                                                      ↓
                                                       Capture Output → Parse
                                                                      ↓
                                                       LLM Interpretation
                                                                      ↓
                                                       Store Findings → DB
                                                                      ↓
                                                       Notify → WebSocket
```

### Chat Flow
```
User → Web UI → API → Validate Access → Load Context (Runs/Findings)
                                              ↓
                                       Redact Secrets
                                              ↓
                                       Build Prompt
                                              ↓
                                       Claude API
                                              ↓
                                       Validate Response (Zod)
                                              ↓
                                       Store Message → DB
```

## Component Details

### web-ui (Next.js)
- **Purpose**: User interface
- **Port**: 3000
- **Key Features**:
  - Server-side rendering for initial load
  - Client-side navigation
  - Real-time updates via polling/websocket
  - Role-based UI rendering

### api (NestJS)
- **Purpose**: Business logic and API
- **Port**: 3001
- **Key Features**:
  - RESTful endpoints
  - Session management
  - RBAC enforcement
  - Audit logging
  - Job scheduling

### executor (Runner Service)
- **Purpose**: Isolated tool execution
- **Port**: Internal only
- **Key Features**:
  - BullMQ consumer
  - Docker container management
  - Output capture and parsing
  - Resource limit enforcement

### db (PostgreSQL)
- **Purpose**: Persistent storage
- **Port**: 5432
- **Key Features**:
  - Encrypted at rest (AWS RDS)
  - Point-in-time recovery
  - Row-level security policies

### redis
- **Purpose**: Caching and queuing
- **Port**: 6379
- **Key Features**:
  - Session storage
  - BullMQ job queue
  - Rate limiting counters

### llm-gateway
- **Purpose**: AI integration
- **Port**: Internal module
- **Key Features**:
  - Prompt construction
  - Secret redaction
  - Response validation
  - Token management

## Network Architecture (AWS)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VPC (10.0.0.0/16)                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Public Subnets (10.0.1.0/24, 10.0.2.0/24)        │    │
│  │                                                                      │    │
│  │   ┌─────────┐    ┌─────────┐                                         │    │
│  │   │   ALB   │    │   NAT   │                                         │    │
│  │   │         │    │ Gateway │                                         │    │
│  │   └────┬────┘    └────┬────┘                                         │    │
│  └────────┼──────────────┼──────────────────────────────────────────────┘    │
│           │              │                                                    │
│  ┌────────┼──────────────┼──────────────────────────────────────────────┐    │
│  │        │    Private Subnets (10.0.10.0/24, 10.0.11.0/24)             │    │
│  │        │              │                                              │    │
│  │   ┌────▼────┐    ┌────▼────┐    ┌──────────┐    ┌──────────┐        │    │
│  │   │   ECS   │    │   ECS   │    │  RDS     │    │ ElastiC  │        │    │
│  │   │ web+api │    │executor │    │ Postgres │    │  Redis   │        │    │
│  │   └─────────┘    └─────────┘    └──────────┘    └──────────┘        │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Security Groups

| Component | Inbound | Outbound |
|-----------|---------|----------|
| ALB | 443 from 0.0.0.0/0 | ECS:3000,3001 |
| ECS (web+api) | 3000,3001 from ALB | RDS:5432, Redis:6379, Executor, HTTPS |
| ECS (executor) | Internal from API | Limited egress (scope-based) |
| RDS | 5432 from ECS | None |
| Redis | 6379 from ECS | None |
