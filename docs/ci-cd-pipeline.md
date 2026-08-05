# CI/CD Pipeline Architecture

## Overview

The Enquiry Backend Platform uses **GitHub Actions** for continuous integration and deployment. The pipeline follows a **gate-based** model where each stage must pass before the next can proceed, ensuring only validated, secure code reaches production.

Three workflows handle the full lifecycle:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `backend-ci.yml` | Push/PR to backend paths | Backend lint → test → build → deploy → smoke |
| `frontend-ci.yml` | Push/PR to frontend paths | Frontend lint → test → build → deploy → smoke |
| `security-weekly.yml` | Weekly (Monday 07:00 UTC) | Trivy + npm audit → report → GitHub Issue |

---

## Pipeline Philosophy

1. **Path-scoped triggers** — Only run pipelines for code that actually changed
2. **Sequential gates** — Each stage depends on the previous passing
3. **Security-first** — Secret scanning, vulnerability scanning, HMAC verification at every stage
4. **Zero-downtime deploy** — PM2 cluster mode inside container + health checks
5. **Automatic rollback** — Failed smoke tests trigger immediate rollback
6. **Production gating** — Deploy only on `main` branch push (not PRs)

---

## Backend Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Backend CI/CD Pipeline                              │
│                                                                              │
│  PR / Push                                                                   │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐     │
│  │ Gate 1: Lint │────▶│ Gate 2: Unit │────▶│ Gate 3: Integration     │     │
│  │ & SAST       │     │ Tests (≥20%) │     │ Tests (DB + Redis)      │     │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘     │
│                                                    │                         │
│                                                    ▼                         │
│                              ┌──────────────────────────────────────┐        │
│                              │ Gate 4: Docker Build + Trivy Scan    │        │
│                              └──────────────────────────────────────┘        │
│                                                    │                         │
│                                              (main only)                     │
│                                                    ▼                         │
│                              ┌──────────────────────────────────────┐        │
│                              │ Gate 5: Deploy to VPS (SSH)          │        │
│                              └──────────────────────────────────────┘        │
│                                                    │                         │
│                                                    ▼                         │
│                              ┌──────────────────────────────────────┐        │
│                              │ Gate 6: Smoke Tests (auto-rollback)  │        │
│                              └──────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Gate 1: Lint & SAST

**Purpose:** Catch code quality and security issues before tests run.

| Check | Tool | Failure Condition |
|-------|------|-------------------|
| Linting | ESLint (with security plugin) | Any warning or error |
| Type safety | TypeScript `--noEmit` | Any type error |
| Formatting | Prettier `--check` | Any unformatted file |
| Secret detection | Gitleaks | Any secret found in code |

**Configuration:**
- ESLint runs with `--max-warnings=0` (zero tolerance)
- Gitleaks uses custom `.gitleaks.toml` with allowlist for `SECURITY_REPORT.md`

### Gate 2: Unit Tests

**Purpose:** Validate business logic in isolation with coverage enforcement.

| Aspect | Configuration |
|--------|---------------|
| Test runner | Jest (selectProjects: unit) |
| Coverage threshold | ≥20% line coverage |
| Coverage reporters | text, lcov, json-summary |
| Artifact | Coverage report uploaded for review |

**Steps:**
1. Install dependencies
2. Generate Prisma Client (required for type imports)
3. Run unit tests with coverage
4. Parse coverage JSON and enforce threshold
5. Upload coverage artifact (retained even on failure)

### Gate 3: Integration Tests

**Purpose:** Validate database and Redis interactions with real services.

**Service Containers:**

| Service | Image | Configuration |
|---------|-------|---------------|
| PostgreSQL | `postgres:15-alpine` | User: testuser, DB: enquiry_test |
| Redis | `redis:7-alpine` | Default config, health checked |

**Steps:**
1. Install dependencies
2. Generate Prisma Client
3. Run database migrations (`prisma migrate deploy`)
4. Run integration tests (`--runInBand` for sequential execution)
5. Run regression tests (`--runInBand`)

**Environment Variables (CI-only):**
```
DATABASE_URL=postgresql://testuser:testpass@localhost:5432/enquiry_test
REDIS_URL=redis://localhost:6379
NODE_ENV=test
HMAC_SECRET=test-hmac-secret-for-ci-only-not-real
API_KEYS=test-api-key-1,test-api-key-2
```

### Gate 4: Docker Build + Security Scan

**Purpose:** Build production image and scan for vulnerabilities.

| Step | Tool | Configuration |
|------|------|---------------|
| Build | Docker Buildx | Multi-stage, `production` target |
| Cache | GitHub Actions cache (GHA) | `cache-from` / `cache-to` for layer reuse |
| Scan | Trivy | SARIF output, HIGH/CRITICAL severity, exit code 1 on findings |
| Report | CodeQL SARIF upload | GitHub Security tab integration |

**Docker Build:**
```yaml
tags: enquiry-backend:${{ github.sha }}
target: production
cache-from: type=gha
cache-to: type=gha,mode=max
```

- Uses GitHub Actions cache for fast rebuilds
- Targets the `production` stage of the multi-stage Dockerfile
- Tags with commit SHA for traceability

### Gate 5: Deploy to Production

**Condition:** Only runs on `main` branch push (not PRs or `develop`).

**Environment:** `production` (requires GitHub Environment approval if configured).

**Deployment Strategy:**
```bash
cd /opt/enquiry-platform
git pull origin main
# Rebuild only the backend container (zero-downtime via PM2 cluster)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps backend
# Wait for container startup
sleep 15
# Run any pending database migrations
docker compose exec -T backend npx prisma migrate deploy
# Verify health endpoint responds
curl -sf http://localhost:3000/health/ready || exit 1
```

**Key Design Choices:**
- `--no-deps` — Only rebuilds backend, not its dependencies (Postgres, Redis)
- PM2 cluster mode inside container enables zero-downtime restart
- 15-second wait allows graceful startup
- Migrations run after container is up (safe because they're additive)
- Health check verification before declaring success

### Gate 6: Smoke Tests

**Purpose:** Verify the deployed application is functional in production.

**Test Suite:** `jest --selectProjects smoke` against production URL.

**Auto-Rollback on Failure:**
```bash
cd /opt/enquiry-platform
git checkout HEAD~1 -- backend/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps backend
sleep 15
curl -sf http://localhost:3000/health/ready || echo "WARNING: Rollback health check failed"
```

- Reverts the `backend/` directory to previous commit
- Rebuilds and restarts only the backend container
- Verifies health after rollback
- Warning (not failure) if rollback health check fails (requires manual intervention)

---

## Frontend Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Frontend CI/CD Pipeline                              │
│                                                                              │
│  PR / Push                                                                   │
│     │                                                                        │
│     ▼                                                                        │
│  ┌──────────────────┐     ┌──────────────────┐     ┌────────────────────┐   │
│  │ Gate 1: Lint &   │────▶│ Gate 2: Vitest   │────▶│ Gate 3: Build &   │   │
│  │ Type Check       │     │ + Coverage       │     │ Bundle + Trivy    │   │
│  └──────────────────┘     └──────────────────┘     └────────────────────┘   │
│                                                          │                   │
│                                                    (main only)               │
│                                                          ▼                   │
│                              ┌────────────────────────────────────────┐      │
│                              │ Gate 4: Deploy to Production           │      │
│                              └────────────────────────────────────────┘      │
│                                                          │                   │
│                                                          ▼                   │
│                              ┌────────────────────────────────────────┐      │
│                              │ Gate 5: Smoke Tests (auto-rollback)    │      │
│                              └────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Gate 1: Lint & Type Check

| Check | Tool | Command |
|-------|------|---------|
| Type safety | TypeScript `--noEmit` | `npx tsc --noEmit` |
| Linting | ESLint | `npm run lint` |
| Formatting | Prettier | `npm run format:check` |

### Gate 2: Vitest Component Tests

| Aspect | Configuration |
|--------|---------------|
| Test runner | Vitest (`vitest run`) |
| Coverage | V8 coverage provider |
| Reporters | Default + JUnit XML |
| Artifacts | Coverage report + JUnit results (14 days retention) |

### Gate 3: Build & Security Scan

This gate performs three critical checks:

**1. Docker Build (Production Target):**
```yaml
build-args:
  VITE_API_BASE_URL: https://enquiry-hub-backend.karthikmuneeswaran.com/api/v1
  VITE_GRAPHQL_URL: https://enquiry-hub-backend.karthikmuneeswaran.com/graphql
  VITE_ADMIN_API_KEY: build-test-key
```

**2. Bundle Size Budget:**

| Metric | Budget | Action on Exceed |
|--------|--------|-----------------|
| Total JS (gzipped) | < 500KB | Fail the build |
| Largest chunk (gzipped) | < 200KB | Fail the build |

The pipeline extracts the built dist from the Docker image and analyzes each JS chunk:
```bash
docker create --name fe-extract enquiry-frontend:${{ github.sha }}
docker cp fe-extract:/usr/share/nginx/html ./dist
# Analyze each .js file gzipped size
```

**3. Trivy Vulnerability Scan:**
- Scans the production Docker image
- CRITICAL and HIGH severity trigger failure
- Results uploaded as SARIF to GitHub Security tab

### Gate 4: Deploy to Production

**Condition:** `main` branch push only.

```bash
cd /opt/enquiry-platform
git pull origin main
# Source VITE_ env vars for Docker Compose build-arg interpolation
grep "^VITE_" frontend/.env > .env 2>/dev/null || true
# Rebuild only the frontend container
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps frontend
# Verify container is running
docker compose ps frontend | grep -q "Up" || exit 1
```

### Gate 5: Smoke Tests

Lightweight HTTP-based checks against the production URL:

| Check | Validation |
|-------|------------|
| Root loads | HTTP 200 from `/` |
| Valid HTML | Response contains `DOCTYPE` |
| SPA routing | `/properties` returns 200 (nginx SPA fallback works) |
| Security headers | HSTS header present (warning only) |

**Auto-Rollback:**
```bash
git checkout HEAD~1 -- frontend/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps frontend
```

---

## Weekly Security Scan

```
┌─────────────────────────────────────────────────────────────────────┐
│              Weekly Security Scan (Monday 07:00 UTC)                  │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │ Trivy: Backend  │  │ Trivy: Frontend │  │   npm audit       │   │
│  │ - Filesystem    │  │ - Filesystem    │  │  - Backend        │   │
│  │ - Docker Image  │  │ - Docker Image  │  │  - Frontend       │   │
│  └────────┬────────┘  └────────┬────────┘  └─────────┬─────────┘   │
│           │                     │                      │             │
│           └─────────────────────┼──────────────────────┘             │
│                                 ▼                                    │
│                  ┌──────────────────────────────┐                    │
│                  │  Generate SECURITY_REPORT.md  │                    │
│                  │  (ts-node script)             │                    │
│                  └──────────────┬───────────────┘                    │
│                                 │                                    │
│                                 ▼                                    │
│                  ┌──────────────────────────────┐                    │
│                  │  Create GitHub Issue          │                    │
│                  │  (if CRITICAL/HIGH found)     │                    │
│                  └──────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Scan Types

| Scanner | Target | Severity Filter |
|---------|--------|-----------------|
| Trivy (filesystem) | `./backend` source code | CRITICAL, HIGH, MEDIUM |
| Trivy (image) | Built Docker image | CRITICAL, HIGH, MEDIUM |
| Trivy (filesystem) | `./frontend` source code | CRITICAL, HIGH, MEDIUM |
| Trivy (image) | Built Docker image | CRITICAL, HIGH, MEDIUM |
| npm audit | Backend `package-lock.json` | All severities |
| npm audit | Frontend `package-lock.json` | All severities |

### Report Generation (`scripts/generate-security-report.ts`)

The custom TypeScript script:
1. Reads all scan JSON results
2. Parses Trivy and npm audit formats
3. Deduplicates findings by ID + package + source
4. Sorts by severity (CRITICAL → LOW)
5. Groups by scan source
6. Generates a Markdown report with:
   - Summary table (counts by severity)
   - Status indicator (action urgency)
   - Detailed findings table per source
   - Remediation guidance (automated + manual)

### GitHub Issue Creation

When CRITICAL or HIGH vulnerabilities are found:
- Creates a GitHub Issue with the full report as body
- Labels: `security`, `automated`
- Deduplication: Skips creation if an open security issue already exists
- Manual trigger available via `workflow_dispatch`

### Artifacts

| Artifact | Retention |
|----------|-----------|
| Trivy backend results | 30 days |
| Trivy frontend results | 30 days |
| npm audit results | 30 days |
| SECURITY_REPORT.md | 90 days |

---

## Infrastructure & Secrets

### GitHub Secrets Required

| Secret | Purpose |
|--------|---------|
| `VPS_HOST` | Production server hostname/IP |
| `VPS_USER` | SSH username for deployment |
| `VPS_SSH_KEY` | SSH private key for authentication |
| `VPS_SSH_PORT` | SSH port (non-default for security) |
| `GITHUB_TOKEN` | Auto-provided for Gitleaks and issue creation |

### GitHub Environments

| Environment | Protection Rules |
|-------------|-----------------|
| `production` | Deployment gate (can require manual approval) |

### Caching Strategy

| Cache | Scope | Key |
|-------|-------|-----|
| npm dependencies | Per workflow | `npm` cache with `package-lock.json` hash |
| Docker layers | Cross-run | GitHub Actions cache (`type=gha`) |

---

## Deployment Architecture

### Target Infrastructure

```
VPS (/opt/enquiry-platform/)
├── docker-compose.yml           # Base service definitions
├── docker-compose.prod.yml      # Production overlay (resource limits, no ports)
├── backend/                     # Backend source (pulled via git)
├── frontend/                    # Frontend source (pulled via git)
├── nginx/                       # Reverse proxy config
└── observability/               # Monitoring configs
```

### Deployment Flow

```
GitHub (main push) ──SSH──▶ VPS
                              │
                              ├── git pull origin main
                              ├── docker compose build (target service only)
                              ├── docker compose up -d (zero-downtime)
                              ├── prisma migrate deploy (backend only)
                              └── health check verification
```

### Zero-Downtime Strategy

1. **Backend:** PM2 cluster mode inside container — new processes start before old ones stop
2. **Frontend:** NGINX serves static files — rebuild replaces files atomically
3. **Database migrations:** Run after container is up; migrations are additive (no destructive changes in production)

---

## Trigger Matrix

| Event | Backend CI | Frontend CI | Security Scan |
|-------|-----------|-------------|---------------|
| Push to `main` (backend paths) | Full pipeline + deploy | — | — |
| Push to `main` (frontend paths) | — | Full pipeline + deploy | — |
| Push to `develop` | Lint → Test → Build (no deploy) | Lint → Test → Build (no deploy) | — |
| PR to `main` (backend paths) | Lint → Test → Build (no deploy) | — | — |
| PR to `main` (frontend paths) | — | Lint → Test → Build (no deploy) | — |
| Monday 07:00 UTC | — | — | Full scan + report |
| Manual (`workflow_dispatch`) | Full pipeline | Full pipeline | Full scan + report |

### Path Filters

```yaml
# Backend triggers on:
paths:
  - 'backend/**'
  - 'docker-compose*.yml'

# Frontend triggers on:
paths:
  - 'frontend/**'
```

---

## Rollback Strategy

### Automatic Rollback (Smoke Test Failure)

Both pipelines implement the same rollback pattern:

```
Smoke test fails
     │
     ▼
git checkout HEAD~1 -- <service-dir>/
     │
     ▼
docker compose up -d --build --no-deps <service>
     │
     ▼
Health check verification
```

**Characteristics:**
- Only the failing service is rolled back (not the entire stack)
- Reverts source to previous commit, then rebuilds
- Non-blocking rollback health check (warning on failure)
- Database migrations are NOT rolled back (they must be backward-compatible)

### Manual Rollback

For situations requiring manual intervention:

```bash
ssh user@vps
cd /opt/enquiry-platform

# Rollback to specific commit
git checkout <commit-sha> -- backend/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps backend

# Or rollback N commits
git checkout HEAD~N -- backend/
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps backend
```

---

## Quality Gates Summary

| Gate | Backend | Frontend | Blocks Deploy? |
|------|---------|----------|----------------|
| ESLint (zero warnings) | Yes | Yes | Yes |
| TypeScript type check | Yes | Yes | Yes |
| Prettier formatting | Yes | Yes | Yes |
| Gitleaks secret scan | Yes | No | Yes |
| Unit test coverage (≥20%) | Yes | — | Yes |
| Vitest component tests | — | Yes | Yes |
| Integration tests (real DB) | Yes | — | Yes |
| Regression tests | Yes | — | Yes |
| Docker build (production) | Yes | Yes | Yes |
| Bundle size budget | — | Yes (500KB total / 200KB chunk) | Yes |
| Trivy vulnerability scan | Yes (HIGH/CRITICAL) | Yes (CRITICAL/HIGH) | Yes |
| Health check post-deploy | Yes | Yes (container "Up") | Yes |
| Smoke tests | Yes (Jest suite) | Yes (HTTP checks) | Triggers rollback |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Path-scoped triggers | Don't waste CI minutes on unchanged code |
| Sequential gates (not parallel) | Fail fast — don't run expensive tests if lint fails |
| Real service containers for integration | Catches Prisma/Redis issues that unit tests miss |
| Bundle size budgets | Prevents performance regressions from bloated dependencies |
| SARIF upload to GitHub Security | Native security tab integration for vulnerability tracking |
| Automatic rollback on smoke failure | Minimizes production downtime without human intervention |
| `--no-deps` on deploy | Only restart the changed service, not the full stack |
| Git-based rollback (not image tags) | Simple, works with docker compose build workflow |
| Weekly security scan (not per-PR) | Balances security awareness vs CI speed |
| GitHub Issue creation | Ensures security findings get tracked and assigned |
| GHA Docker layer cache | Dramatically speeds up rebuilds (only changed layers) |
| Non-default SSH port | Defense-in-depth for production server access |
