# SecureScope Threat Model

## Overview

This document describes the threat model for SecureScope using the STRIDE methodology. Each threat category is analyzed with potential attack vectors, impact, likelihood, and mitigations.

## Attack Surfaces

### 1. Authentication System
- Login endpoint
- Session management
- 2FA enrollment/verification
- Password reset
- Recovery codes

### 2. API Endpoints
- Tool catalog
- Run execution
- Finding management
- Chat interface
- Admin functions

### 3. Executor Service
- Job queue processing
- Docker container execution
- Network egress
- Output handling

### 4. LLM Gateway
- Prompt construction
- Response processing
- Context handling

### 5. Data Storage
- PostgreSQL database
- Redis cache
- File artifacts

---

## STRIDE Analysis

### S - Spoofing

#### S1: Credential Theft via Phishing
- **Attack**: Attacker creates fake login page
- **Impact**: HIGH - Full account compromise
- **Likelihood**: MEDIUM
- **Mitigations**:
  - 2FA requirement for sensitive operations
  - HSTS header enforcement
  - User education
  - Phishing-resistant 2FA (future: WebAuthn)

#### S2: Session Hijacking
- **Attack**: Attacker steals session cookie
- **Impact**: HIGH - Account access
- **Likelihood**: LOW
- **Mitigations**:
  - HttpOnly cookies
  - Secure flag (HTTPS only)
  - SameSite=Strict
  - Session rotation on privilege change
  - Short session timeout

#### S3: Brute Force Login
- **Attack**: Automated password guessing
- **Impact**: HIGH - Account compromise
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Account lockout after 5 failed attempts
  - Progressive delay (exponential backoff)
  - Rate limiting per IP
  - CAPTCHA after failures
  - Password complexity requirements

#### S4: API Token Replay
- **Attack**: Captured API tokens reused
- **Impact**: MEDIUM - Limited access
- **Likelihood**: LOW
- **Mitigations**:
  - Short token lifetime
  - Token binding to session
  - Refresh token rotation

---

### T - Tampering

#### T1: Command Injection
- **Attack**: Malicious input in tool parameters
- **Impact**: CRITICAL - System compromise
- **Likelihood**: HIGH (if not mitigated)
- **Mitigations**:
  - argv-only execution (no shell)
  - Strict Zod schema validation
  - Parameter sanitization
  - Allowlist for values where possible
  - Container isolation

#### T2: SQL Injection
- **Attack**: Malicious SQL in inputs
- **Impact**: CRITICAL - Data breach
- **Likelihood**: LOW (Prisma protects)
- **Mitigations**:
  - Prisma ORM (parameterized queries)
  - No raw SQL queries
  - Input validation

#### T3: Request Tampering
- **Attack**: Modify API requests in transit
- **Impact**: MEDIUM - Data manipulation
- **Likelihood**: LOW
- **Mitigations**:
  - TLS 1.2+ enforced
  - CSRF tokens for state-changing requests
  - Request signing for critical operations

#### T4: Tool Manifest Tampering
- **Attack**: Modify tool definitions
- **Impact**: CRITICAL - Arbitrary execution
- **Likelihood**: LOW
- **Mitigations**:
  - Admin-only tool management
  - Manifest versioning
  - Audit logging
  - Review workflow (optional)

#### T5: Container Escape
- **Attack**: Break out of Docker sandbox
- **Impact**: CRITICAL - Host compromise
- **Likelihood**: LOW
- **Mitigations**:
  - Seccomp profiles
  - Dropped capabilities
  - No privileged mode
  - Read-only filesystem
  - User namespace remapping
  - Regular Docker updates

---

### R - Repudiation

#### R1: Action Denial
- **Attack**: User denies performing action
- **Impact**: LOW - Accountability issues
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Comprehensive audit logging
  - Append-only audit table
  - Log integrity protection
  - Session correlation
  - Timestamp with NTP sync

#### R2: Log Tampering
- **Attack**: Modify audit logs to hide actions
- **Impact**: MEDIUM - Lost accountability
- **Likelihood**: LOW
- **Mitigations**:
  - Append-only table (no DELETE/UPDATE)
  - Separate DB user for audit writes
  - Log shipping to external system
  - Log integrity hashing

---

### I - Information Disclosure

#### I1: Sensitive Data in Logs
- **Attack**: Secrets exposed in application logs
- **Impact**: HIGH - Credential leak
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Structured logging with redaction
  - Secret pattern matching
  - Log review automation
  - Secure log storage

#### I2: LLM Data Leakage
- **Attack**: Secrets sent to Claude API
- **Impact**: HIGH - Third-party exposure
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Pre-submission redaction
  - Pattern-based secret detection
  - Truncation of large outputs
  - User consent for LLM usage

#### I3: Error Message Disclosure
- **Attack**: Stack traces reveal internals
- **Impact**: LOW - Information gathering
- **Likelihood**: HIGH (if not mitigated)
- **Mitigations**:
  - Generic error messages in production
  - Error ID for support correlation
  - Detailed errors only in dev mode

#### I4: Database Breach
- **Attack**: Direct DB access
- **Impact**: CRITICAL - Full data exposure
- **Likelihood**: LOW
- **Mitigations**:
  - Encryption at rest (RDS)
  - Network isolation (VPC)
  - Strong credentials (Secrets Manager)
  - Row-level security
  - Regular backups with encryption

#### I5: Tool Output Exposure
- **Attack**: View other users' run results
- **Impact**: MEDIUM - Data breach
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Scope-based access control
  - Row-level filtering
  - Authorization checks per request
  - RBAC enforcement

---

### D - Denial of Service

#### D1: API Rate Abuse
- **Attack**: Flood API with requests
- **Impact**: MEDIUM - Service degradation
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Rate limiting (per IP + per user)
  - WAF rules
  - Auto-scaling
  - Request size limits

#### D2: Resource Exhaustion via Tools
- **Attack**: Run tools that consume all resources
- **Impact**: HIGH - Platform unavailable
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Per-container resource limits (CPU, memory, PIDs)
  - Timeout enforcement
  - Job concurrency limits
  - Queue depth limits
  - User quota system

#### D3: Database Overload
- **Attack**: Complex queries or data flood
- **Impact**: HIGH - Database unavailable
- **Likelihood**: LOW
- **Mitigations**:
  - Query timeout
  - Connection pooling
  - Index optimization
  - Read replicas for heavy reads
  - Pagination enforcement

#### D4: Redis Memory Exhaustion
- **Attack**: Fill cache/queue with data
- **Impact**: MEDIUM - Queue failures
- **Likelihood**: LOW
- **Mitigations**:
  - Memory limits
  - Key TTL enforcement
  - Queue size limits
  - Memory eviction policy

---

### E - Elevation of Privilege

#### E1: Horizontal Privilege Escalation
- **Attack**: Access another user's resources
- **Impact**: HIGH - Data breach
- **Likelihood**: MEDIUM
- **Mitigations**:
  - User ID validation on all requests
  - Scope-based access control
  - Row-level filtering
  - Authorization middleware

#### E2: Vertical Privilege Escalation
- **Attack**: Gain admin access as regular user
- **Impact**: CRITICAL - Full control
- **Likelihood**: LOW
- **Mitigations**:
  - RBAC with least privilege
  - Role validation middleware
  - Audit logging for admin actions
  - 2FA for admin accounts

#### E3: Scope Bypass
- **Attack**: Run tools against unauthorized targets
- **Impact**: HIGH - Unauthorized scanning
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Scope validation before execution
  - Target allowlist per user/team
  - Network egress filtering in sandbox
  - Audit logging of all runs

#### E4: LLM Prompt Injection
- **Attack**: Malicious content in tool output manipulates LLM
- **Impact**: MEDIUM - Misleading results
- **Likelihood**: MEDIUM
- **Mitigations**:
  - Tool output treated as untrusted
  - Structured output validation (Zod)
  - Conservative severity ratings
  - Human review for critical findings
  - System prompt hardening

---

## Risk Matrix

| ID | Threat | Impact | Likelihood | Risk | Status |
|----|--------|--------|------------|------|--------|
| S1 | Credential Phishing | HIGH | MEDIUM | HIGH | Mitigated (2FA) |
| S2 | Session Hijacking | HIGH | LOW | MEDIUM | Mitigated |
| S3 | Brute Force | HIGH | MEDIUM | HIGH | Mitigated |
| T1 | Command Injection | CRITICAL | HIGH | CRITICAL | Mitigated |
| T2 | SQL Injection | CRITICAL | LOW | MEDIUM | Mitigated |
| T4 | Manifest Tampering | CRITICAL | LOW | MEDIUM | Mitigated |
| T5 | Container Escape | CRITICAL | LOW | MEDIUM | Mitigated |
| I1 | Secrets in Logs | HIGH | MEDIUM | HIGH | Mitigated |
| I2 | LLM Data Leakage | HIGH | MEDIUM | HIGH | Mitigated |
| I4 | Database Breach | CRITICAL | LOW | MEDIUM | Mitigated |
| D1 | API Rate Abuse | MEDIUM | MEDIUM | MEDIUM | Mitigated |
| D2 | Resource Exhaustion | HIGH | MEDIUM | HIGH | Mitigated |
| E1 | Horizontal Escalation | HIGH | MEDIUM | HIGH | Mitigated |
| E2 | Vertical Escalation | CRITICAL | LOW | MEDIUM | Mitigated |
| E3 | Scope Bypass | HIGH | MEDIUM | HIGH | Mitigated |
| E4 | Prompt Injection | MEDIUM | MEDIUM | MEDIUM | Mitigated |

---

## Security Controls Summary

### Authentication & Session
- Argon2id password hashing (memory=65536, iterations=3, parallelism=4)
- 32-byte cryptographically random session tokens
- Session stored in Redis with TTL
- HttpOnly, Secure, SameSite=Strict cookies
- 2FA via TOTP (otplib) with QR provisioning
- 8x recovery codes (single use)
- Account lockout after 5 failed attempts
- Session rotation on login/privilege change

### Authorization
- RBAC: Admin, Engineer, Viewer
- Scope-based resource access
- Row-level filtering on queries
- Authorization middleware on all routes
- Re-authentication for sensitive operations

### Input Validation
- Zod schemas for all inputs
- Type-safe parameter forms
- Allowlist validation where possible
- File upload restrictions (if any)

### Output Protection
- Secret redaction (patterns: password, token, key, secret, cookie)
- Generic error messages in production
- Structured logging with pino
- Response size limits

### Execution Safety
- argv-only execution (no shell)
- Docker container isolation
- Seccomp profiles
- Capability dropping
- Resource limits (CPU, memory, PIDs)
- Timeout enforcement
- Network egress filtering
- Read-only filesystem

### Data Protection
- TLS 1.2+ in transit
- Encryption at rest (RDS, S3)
- Secrets in AWS Secrets Manager
- Regular backups with encryption
- Point-in-time recovery

### Monitoring & Audit
- Append-only audit log
- All security events logged
- CloudWatch integration
- Alerting for anomalies
- Log retention policy

---

## Incident Response

### Security Event Categories
1. **P1 (Critical)**: Active breach, data exfiltration
2. **P2 (High)**: Attempted breach, vulnerability exploitation
3. **P3 (Medium)**: Suspicious activity, policy violation
4. **P4 (Low)**: Security configuration issues

### Response Procedures
1. Detect via monitoring/alerts
2. Contain (isolate affected systems)
3. Eradicate (remove threat)
4. Recover (restore services)
5. Post-incident review

---

## Compliance Considerations

### Relevant Standards
- OWASP ASVS Level 2
- OWASP Top 10 coverage
- CWE/SANS Top 25 awareness
- SOC 2 Type II (if applicable)

### Data Handling
- No PII collection beyond username/email
- Scan results may contain sensitive data
- Data retention policy required
- User consent for LLM processing
