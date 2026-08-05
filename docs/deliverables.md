# Project Deliverables

## Enquiry Backend Platform — Complete Delivery Summary

This document provides a top-level overview of everything delivered in the Enquiry Backend Platform project. It is designed for reviewers and stakeholders to quickly identify, navigate, and validate all components.

---

## Production URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend (SPA) | `https://enquiry-hub.karthikmuneeswaran.com` | React admin dashboard |
| Backend API | `https://enquiry-hub-backend.karthikmuneeswaran.com/api/v1` | REST API (versioned) |
| GraphQL | `https://enquiry-hub-backend.karthikmuneeswaran.com/graphql` | Property queries |
| Swagger Docs | `https://enquiry-hub-backend.karthikmuneeswaran.com/api/docs` | Interactive API docs |
| WordPress CMS | `https://enquiry-hub-wp.karthikmuneeswaran.com` | Property content management |
| Grafana | `https://enquiry-hub-grafana.karthikmuneeswaran.com` | Monitoring dashboards |
| Health (Live) | `https://enquiry-hub-backend.karthikmuneeswaran.com/health/live` | Liveness probe |
| Health (Ready) | `https://enquiry-hub-backend.karthikmuneeswaran.com/health/ready` | Readiness probe |

---

## Technology Stack

### Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 24.x | Server runtime |
| Framework | NestJS | 10.4 | Application framework |
| Language | TypeScript | 5.5 | Type-safe development |
| Database | PostgreSQL | 15 | Primary datastore |
| ORM | Prisma | 5.18 | Type-safe database access |
| Cache | Redis | 7 | Caching + queue broker |
| Queue | BullMQ | 5.12 | Async job processing |
| GraphQL | Apollo Server | 4.10 | Property data API |
| HTTP Client | Axios | 1.7 | External service calls |
| Circuit Breaker | Opossum | 8.1 | Resilience pattern |
| Metrics | OpenTelemetry | 1.25 | Observability |
| Logging | Pino (nestjs-pino) | 4.1 | Structured logging |
| Validation | class-validator | 0.14 | Input validation |
| Security | Helmet | 7.1 | HTTP security headers |
| API Docs | Swagger (@nestjs/swagger) | 7.4 | OpenAPI documentation |
| Testing | Jest | 29.7 | Test runner |

### Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | React | 18.3 | UI library |
| Build Tool | Vite | 5.3 | Dev server + bundler |
| Language | TypeScript | 5.5 | Type safety |
| Styling | TailwindCSS | 3.4 | Utility-first CSS |
| Routing | React Router | 6.24 | SPA routing |
| REST Client | TanStack React Query | 5.50 | Server state management |
| GraphQL Client | Apollo Client | 3.10 | Property data fetching |
| Forms | React Hook Form | 7.52 | Form management |
| HTTP | Axios | 1.7 | API client |
| Charts | Recharts | 2.12 | Metrics visualization |
| Animation | Framer Motion | 11.3 | UI transitions |
| Testing | Vitest | 1.6 | Test runner |
| Testing Utils | React Testing Library | 15.0 | Component testing |

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Reverse Proxy | NGINX 1.25 | SSL termination, routing, rate limiting |
| Containerization | Docker + Docker Compose | Service orchestration |
| Process Manager | PM2 (inside container) | Node.js cluster mode |
| SSL | Let's Encrypt | TLS certificates |
| CI/CD | GitHub Actions | Automated pipeline |
| Secret Scanning | Gitleaks | Pre-commit secret detection |
| Vulnerability Scanning | Trivy | Container + dependency scanning |

### Observability Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Metrics | Prometheus 2.51 | Time-series metrics collection |
| Dashboards | Grafana 10.4 | Visualization + alerting |
| Log Aggregation | Loki 2.9 | Centralized log storage |
| Log Shipping | Promtail 3.1 | Container log collection |
| Tracing | Tempo 2.4 | Distributed trace storage |
| Trace Protocol | OTLP (OpenTelemetry) | Trace export format |

---

## Architecture Patterns & Design Decisions

### Scalability Patterns

| Pattern | Implementation | Benefit |
|---------|---------------|---------|
| Cursor-based pagination | Base64-encoded `{id, createdAt}` composite cursor | O(1) page fetch regardless of dataset size |
| Connection pooling | Prisma managed pool + NGINX keepalive (64 conns) | Reduces connection overhead |
| Async job processing | BullMQ (4 queues, 4 workers) | Decouples heavy work from request path |
| Cache-aside with SWR | Redis primary + in-memory LRU fallback | Sub-ms reads, background refresh |
| N+1 prevention | DataLoader batching for GraphQL | 80% fewer DB queries on nested resolves |
| Horizontal-ready | Stateless app + Redis for shared state | Can scale to multiple instances |
| Code splitting | React.lazy + Suspense per route | Smaller initial bundle load |

### Resilience Patterns

| Pattern | Implementation | Benefit |
|---------|---------------|---------|
| Circuit breaker | Opossum (WordPress client) | Isolates external service failures |
| Load shedding | Event loop lag > 200ms → 503 + Retry-After | Prevents cascade overload |
| Retry with backoff | 3 attempts, exponential (1s, 4s, 16s) | Handles transient failures |
| Graceful shutdown | SIGTERM → drain → close workers → exit | Zero dropped requests on deploy |
| Cache fallback | Redis down → in-memory LRU (1000 items) | Zero-downtime on Redis failure |
| Idempotency keys | Redis-backed 24h TTL per unique key | Safe client retries |
| Duplicate detection | Redis-first + DB fallback (10min window) | Prevents spam submissions |
| Auto-rollback | Smoke test failure → revert + rebuild | Minimizes bad deploy duration |
| Health probes | /health/live + /health/ready | Container orchestration awareness |
| DLQ retention | Failed jobs kept for inspection | No silent data loss |

### Security Patterns

| Pattern | Implementation | Benefit |
|---------|---------------|---------|
| API key authentication | Multi-key Set with O(1) lookup | Zero-downtime key rotation |
| HMAC-SHA256 webhooks | Timing-safe comparison | Proves origin, prevents replay |
| Rate limiting (L1) | NGINX zone-based (100r/m API, 10r/m POST) | Network-level protection |
| Rate limiting (L2) | Redis sliding window per-endpoint | Application-level precision |
| Input sanitization | Custom SanitizationPipe (before validation) | XSS/injection prevention |
| Content-Type enforcement | Global guard rejects non-JSON on mutating | Prevents content-type confusion |
| PII redaction | Pino log redaction (email, phone, auth) | GDPR-safe logging |
| Security headers | Helmet (CSP, HSTS 2yr, X-Frame DENY) | Browser-level protection |
| Secret scanning | Gitleaks in CI + `.gitleaks.toml` allowlist | Prevents credential leaks |
| TLS 1.2+ only | NGINX ssl_protocols directive | No weak cipher negotiation |
| Body size limit | 1MB Express-level + 50MB WordPress | DoS prevention |

### Transaction Patterns

| Operation | Isolation Level | Scope |
|-----------|----------------|-------|
| Enquiry creation + audit log | ReadCommitted | Atomic creation with full audit trail |
| Status update + audit log | ReadCommitted | Consistent state transitions |
| GDPR erasure | ReadCommitted | Complete data removal across tables |
| Webhook deduplication | Default | Idempotent event processing |

---

## Service Inventory

### Application Services

| Service | Port (Internal) | Exposed Port (Prod) | Role |
|---------|----------------|---------------------|------|
| Backend (NestJS) | 3000 | Via NGINX (443) | REST API + GraphQL + Queue workers |
| Frontend (React/NGINX) | 80 | Via NGINX (443) | Static SPA serving |
| NGINX (Reverse Proxy) | 80, 443 | 80, 443 | SSL, routing, L1 rate limiting |

### Data Services

| Service | Port (Internal) | Image | Role |
|---------|----------------|-------|------|
| PostgreSQL | 5432 | postgres:15-alpine | Primary database |
| Redis | 6379 | redis:7-alpine | Cache + queue broker |
| WordPress | 80 | wordpress:6-php8.2 | Property CMS |
| MySQL | 3306 | mysql:8.0 | WordPress database |

### Observability Services

| Service | Port (Internal) | Image | Role |
|---------|----------------|-------|------|
| Prometheus | 9090 | prom/prometheus:2.51 | Metrics collection |
| Grafana | 3000 | grafana/grafana:10.4 | Dashboards |
| Loki | 3100 | grafana/loki:2.9 | Log aggregation |
| Tempo | 4318 (OTLP), 3200 | grafana/tempo:2.4 | Trace storage |
| Promtail | — | grafana/promtail:3.1 | Log shipping |

### Metric Exporters

| Service | Port | Image | Scrapes |
|---------|------|-------|---------|
| postgres-exporter | 9187 | prometheuscommunity/postgres-exporter:0.15 | PostgreSQL |
| redis-exporter | 9121 | oliver006/redis_exporter:1.58 | Redis |
| mysql-exporter | 9104 | prom/mysqld-exporter:0.15 | MySQL |
| wordpress-exporter | 11011 | wordpress-exporter:0.0.8 | WordPress |
| nginx-exporter | — | nginx-prometheus-exporter:1.1 | NGINX stub_status |
| Backend (OTel) | 8081 | — | PrometheusExporter in-app |

---

## API Endpoints (Complete)

### REST API (`/api/v1/`)

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/api/v1/enquiry` | None | 10/min/IP | Create property enquiry |
| GET | `/api/v1/enquiry/:id` | None | 100/min/IP | Get enquiry by UUID |
| GET | `/api/v1/enquiries` | None | 60/min/IP | List with cursor pagination |
| PATCH | `/api/v1/enquiry/:id/status` | None | 30/min/IP | Update enquiry status |
| POST | `/api/v1/webhook/crm` | HMAC | 200/min | Ingest CRM webhook |
| GET | `/api/v1/webhook/events` | API Key | 60/min | List webhook events |
| POST | `/api/v1/gdpr/export` | API Key | 5/min | Export user data (GDPR) |
| DELETE | `/api/v1/gdpr/erase/:email` | API Key | 5/min | Erase user data (GDPR) |
| GET | `/api/v1/admin/queues` | API Key | 30/min | Queue statistics |
| POST | `/api/v1/admin/queues/:name/retry` | API Key | 10/min | Retry failed jobs |

### GraphQL (`/graphql`)

```graphql
type Query {
  properties(first: Int, after: String, search: String): PropertyConnection!
  property(slug: String, wpId: Int): Property
}

type PropertyConnection {
  edges: [PropertyEdge!]!
  pageInfo: PageInfo!
}

type Property {
  id: String!
  slug: String!
  title: String!
  content: String
  excerpt: String
  featuredImage: String
  price: Float
  bedrooms: Int
  bathrooms: Int
  area: Float
  location: String
  propertyType: String
}
```

### Health Endpoints (no prefix)

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/health/live` | `{ status: "alive" }` (always 200) |
| GET | `/health/ready` | 200 if all deps healthy, 503 if not |

---

## Database Schema

### Models

| Model | Records | Purpose | Key Indexes |
|-------|---------|---------|-------------|
| Enquiry | Core entity | Property enquiry submissions | `(email, propertyId, createdAt)`, `(status)`, `(createdAt)` |
| WebhookEvent | Events | Inbound CRM webhook events | `(status)`, `(createdAt)`, `(enquiryId)` |
| Property | Cache | WordPress property cache | `(slug)`, `(wpId)` |
| AuditLog | Immutable | Full audit trail (before/after) | `(entity, entityId)`, `(createdAt)`, `(requestId)` |

### Enquiry Status Flow

```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED
                    ↘ ARCHIVED
```

### Webhook Event Status Flow

```
RECEIVED → PROCESSING → PROCESSED
                     ↘ FAILED → DEAD_LETTER
```

---

## Queue System

| Queue | Workers | Job Types | Retry |
|-------|---------|-----------|-------|
| `email-queue` | EmailWorker | confirmation, admin-notification | 3x exponential |
| `push-queue` | PushWorker | push-notification | 3x exponential |
| `crm-queue` | CrmSyncWorker | process-webhook | 3x exponential |
| `maintenance` | RetentionWorker | data cleanup, scheduled tasks | 3x exponential |

**Job Retention:**
- Completed: 30 days or 1000 jobs (whichever first)
- Failed: Kept indefinitely for DLQ inspection

---

## Monitoring & Alerting

### Grafana Dashboards

| Dashboard | Key Metrics |
|-----------|-------------|
| System Health | Event loop lag, memory/CPU, DB connections, Redis memory |
| API Performance | Request rate, latency (p50/p95/p99), error rate, status codes |
| Business Metrics | Enquiries created/completed, source breakdown, conversion |
| Queue Monitor | Job throughput, processing time, DLQ depth, worker status |

### Prometheus Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| HighErrorRate | 5xx rate > 5% for 5min | Critical |
| HighLatency | p95 > 2s for 5min | Warning |
| DLQGrowing | Failed jobs > 10 for 2min | Warning |
| DBConnectionExhaustion | Pool > 80% for 2min | Warning |
| RedisMemoryHigh | Memory > 80% of max for 5min | Warning |
| EventLoopLag | Lag > 500ms for 1min | Critical |
| ContainerRestart | Any restart in 5min | Warning |
| DiskSpaceHigh | Filesystem > 85% for 5min | Warning |

---

## CI/CD Pipeline

### Backend (6 Gates)

```
Lint/SAST → Unit Tests (≥20% coverage) → Integration Tests (real DB+Redis)
  → Docker Build + Trivy Scan → Deploy (SSH, main only) → Smoke Tests (auto-rollback)
```

### Frontend (5 Gates)

```
Lint/TypeCheck → Vitest Tests → Build + Bundle Budget + Trivy
  → Deploy (SSH, main only) → Smoke Tests (auto-rollback)
```

### Weekly Security Scan

```
Trivy (filesystem + image) + npm audit → SECURITY_REPORT.md → GitHub Issue (if HIGH/CRITICAL)
```

### Quality Gates

| Gate | Threshold |
|------|-----------|
| ESLint | Zero warnings |
| TypeScript | Zero type errors |
| Prettier | All files formatted |
| Gitleaks | No secrets in code |
| Backend coverage | ≥20% line coverage |
| Bundle size (total JS) | < 500KB gzipped |
| Bundle size (largest chunk) | < 200KB gzipped |
| Trivy scan | No HIGH/CRITICAL vulnerabilities |
| Post-deploy health | `/health/ready` returns 200 |

---

## Frontend Features

### Pages Delivered

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Public landing page (unauthenticated users) |
| Login | `/login` | Static user authentication |
| Enquiry List | `/enquiries` | Paginated list with search, filter, sort |
| New Enquiry | `/enquiry/new` | Form with validation + draft persistence |
| Enquiry Detail | `/enquiry/:id` | Full enquiry view with status updates |
| Property List | `/properties` | GraphQL-powered listing with search |
| Property Detail | `/properties/:slug` | Full property view from WordPress |
| Metrics Dashboard | `/dashboard` | Recharts-powered metrics visualization |
| Queue Dashboard | `/admin/queues` | Queue health, DLQ management |
| GDPR Tools | `/admin/gdpr` | Data export and erasure tools |
| Unauthorized | `/unauthorized` | Access denied page |
| 404 | `*` | Not found catch-all |

### Key Frontend Capabilities

| Feature | Implementation |
|---------|---------------|
| Offline support | localStorage queue + auto-flush on reconnect |
| Form draft persistence | Debounced saves (500ms) to localStorage |
| Auto-generated idempotency | UUID header on every POST request |
| Retry with backoff | 3 attempts (1s, 4s, 16s) for 5xx/network errors |
| Role-based UI | PermissionGate hides unauthorized elements |
| Auto-refresh | Enquiry list polls every 30 seconds |
| Cursor pagination | Stable navigation under concurrent writes |
| Error isolation | ErrorBoundary per page section |
| Responsive layout | Desktop sidebar + mobile bottom nav |
| Accessibility | aria-live, role="alert", keyboard nav, semantic HTML |

---

## NGINX Configuration

### Rate Limiting (L1 — Network Level)

| Zone | Rate | Burst | Scope |
|------|------|-------|-------|
| `api` | 100 req/min | 20 (nodelay) | All `/api/` endpoints |
| `enquiry_post` | 10 req/min | 5 (nodelay) | POST `/api/v1/enquiry` only |
| `conn` | 50 concurrent | — | Per IP connection limit |

### SSL/TLS

- Multi-domain certificate (Let's Encrypt)
- TLS 1.2 and TLS 1.3 only
- High-strength ciphers (no aNULL, MD5, RC4)
- Session cache: 10MB shared
- HSTS: 2 years, includeSubDomains, preload

### Security Headers (all domains)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Testing Coverage

### Backend Tests

| Type | Location | Runner | Infrastructure |
|------|----------|--------|----------------|
| Unit | `backend/test/unit/` | Jest | None (mocked) |
| Integration | `backend/test/integration/` | Jest | PostgreSQL + Redis |
| Regression | `backend/test/regression/` | Jest | Running app |
| Smoke | `backend/test/smoke/` | Jest | Production URL |

### Frontend Tests

| Type | Location | Runner | Infrastructure |
|------|----------|--------|----------------|
| Unit/Component | `frontend/test/unit/` | Vitest | JSDOM (mocked) |

### What's Tested

- Auth flows (login, logout, permission checks)
- Protected routes and permission gates
- Enquiry CRUD operations
- Offline queue (enqueue, flush, persistence)
- Form persistence (save, restore, clear)
- API client (retry logic, error normalization)
- Error boundaries (crash isolation, retry)
- Property list/detail (GraphQL)
- Dashboard page rendering

---

## Environment Configuration

### Backend (`.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `NODE_ENV` | No | development | Environment mode |
| `PORT` | No | 3000 | Server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `HMAC_SECRET` | Yes | — | Webhook signature secret |
| `API_KEYS` | Yes | — | Comma-separated API keys |
| `SMTP_HOST` | Yes | — | Email server host |
| `SMTP_PORT` | No | 587 | Email server port |
| `SMTP_USER` | Yes | — | Email credentials |
| `SMTP_PASS` | Yes | — | Email credentials |
| `CRM_WEBHOOK_URL` | Yes | — | Outbound CRM endpoint |
| `WORDPRESS_GRAPHQL_URL` | Yes | — | WordPress WPGraphQL URL |
| `CORS_ORIGINS` | No | http://localhost:5173 | Allowed CORS origins |
| `SWAGGER_ENABLED` | No | true | API docs toggle |
| `LOG_LEVEL` | No | info | Logging verbosity |
| `RATE_LIMIT_ENABLED` | No | true | Rate limiting toggle |
| `OTEL_SERVICE_NAME` | No | enquiry-backend | Tracing service name |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | http://tempo:4318 | Trace export URL |

### Frontend (`.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_API_BASE_URL` | No | /api/v1 | REST API base URL |
| `VITE_GRAPHQL_URL` | No | http://localhost:3000/graphql | GraphQL endpoint |
| `VITE_ADMIN_API_KEY` | No | — | Admin operations key |

---

## Project Structure (Top-Level)

```
enquiry-backend-platform/
├── backend/                    # NestJS API application
│   ├── src/                   # Source code (modules, services, guards, etc.)
│   ├── prisma/                # Database schema + migrations
│   ├── test/                  # Unit, integration, regression, smoke tests
│   ├── Dockerfile             # Multi-stage (dev + production)
│   └── package.json
├── frontend/                   # React SPA
│   ├── src/                   # Components, hooks, services, pages
│   ├── test/                  # Vitest unit tests
│   ├── Dockerfile             # Multi-stage (dev + production/nginx)
│   └── package.json
├── nginx/                      # Reverse proxy configuration
│   ├── nginx.conf             # Main config (rate limiting, upstream)
│   └── conf.d/default.conf   # Server blocks (SSL, routing)
├── observability/              # Monitoring configuration
│   ├── prometheus/            # prometheus.yml + alerts.yml
│   ├── grafana/               # Provisioning + dashboards (4 JSON files)
│   ├── loki/                  # loki-config.yml
│   ├── tempo/                 # tempo-config.yml
│   └── promtail/             # promtail-config.yml
├── wordpress/                  # WordPress auto-setup script
├── postman/                    # Postman collection + environments
├── scripts/                    # Utility scripts (security report)
├── docs/                       # Documentation
│   ├── deliverables.md        # This file
│   ├── backend-architecture.md
│   ├── frontend-architecture.md
│   ├── ci-cd-pipeline.md
│   ├── API.md
│   ├── DATABASE_SCHEMA.md
│   ├── DEPLOYMENT.md
│   ├── ENVIRONMENT.md
│   ├── PERFORMANCE.md
│   ├── RUNBOOK.md
│   └── testing.md
├── .github/workflows/          # CI/CD pipelines
│   ├── backend-ci.yml         # 6-gate backend pipeline
│   ├── frontend-ci.yml        # 5-gate frontend pipeline
│   └── security-weekly.yml    # Weekly vulnerability scan
├── docker-compose.yml          # Development environment (all services)
├── docker-compose.prod.yml     # Production overlay (resource limits)
├── .gitleaks.toml             # Secret scanning config
└── .gitignore
```

---

## Documentation Index

| Document | Path | Content |
|----------|------|---------|
| **Deliverables** (this) | `docs/deliverables.md` | Complete delivery overview |
| Backend Architecture | `docs/backend-architecture.md` | Full backend design, patterns, flows |
| Frontend Architecture | `docs/frontend-architecture.md` | Full frontend design, patterns, flows |
| CI/CD Pipeline | `docs/ci-cd-pipeline.md` | Pipeline gates, deployment, rollback |
| API Reference | `docs/API.md` | Endpoint documentation + Swagger |
| Database Schema | `docs/DATABASE_SCHEMA.md` | Models, indexes, relationships |
| Deployment Guide | `docs/DEPLOYMENT.md` | VPS setup, Docker deploy, SSL |
| Environment Guide | `docs/ENVIRONMENT.md` | All env vars documented |
| Performance | `docs/PERFORMANCE.md` | Optimization decisions + impact |
| Runbook | `docs/RUNBOOK.md` | Incident response procedures |
| Testing Guide | `docs/testing.md` | Test strategy, commands, CI integration |
| Postman Collection | `postman/` | Import-ready API testing collection |

---

## How to Run Locally

### Prerequisites

- Docker + Docker Compose v2
- Node.js 24+ (for running tests outside Docker)
- Git

### Quick Start

```bash
# Clone and start all services
git clone <repo-url>
cd enquiry-backend-platform

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start everything (backend, frontend, DB, Redis, WordPress, observability)
docker compose up -d

# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Seed sample data
docker compose exec backend npx prisma db seed
```

### Access Points (Local)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| GraphQL Playground | http://localhost:3000/graphql |
| Swagger Docs | http://localhost:3000/api/docs |
| WordPress | http://localhost:8080 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

### Test Accounts (Local)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@enquiry.dev | admin123 |
| Agent | agent@enquiry.dev | agent123 |
| Viewer | viewer@enquiry.dev | viewer123 |

---

## Hosting & Infrastructure

### Production Server

| Spec | Value |
|------|-------|
| Provider | DigitalOcean |
| Type | Droplet |
| CPU | 2 vCPUs |
| Memory | 4 GB RAM |
| Disk | 80 GB SSD |
| OS | Ubuntu 24.04 LTS x64 |
| Region | — |

### Resource Allocation (Docker Compose)

| Service | Memory Limit | CPU Limit | Restart Policy |
|---------|-------------|-----------|----------------|
| Backend | 1 GB | 2 cores | unless-stopped |
| Frontend | 128 MB | 0.5 cores | unless-stopped |
| NGINX | 128 MB | 0.5 cores | unless-stopped |
| PostgreSQL | 512 MB | 1 core | unless-stopped |
| Redis | 300 MB | 0.5 cores | unless-stopped |
| WordPress | 512 MB | 1 core | unless-stopped |
| MySQL | 512 MB | 1 core | unless-stopped |
| Grafana | 256 MB | 0.5 cores | unless-stopped |
| Prometheus | 256 MB | 0.5 cores | unless-stopped |
| Loki | 256 MB | 0.5 cores | unless-stopped |
| Tempo | 256 MB | 0.5 cores | unless-stopped |
| Promtail | 128 MB | 0.25 cores | unless-stopped |
| All exporters | 64 MB each | 0.25 cores | unless-stopped |

**Note:** Docker Compose resource limits are soft caps. The 2-CPU / 4GB droplet relies on Docker's CPU sharing and memory overcommit — services are scheduled across the available cores with priority-based allocation. Under normal load, the full stack runs comfortably within the 4 GB budget due to most services being idle or low-traffic.

---

## Key Deliverable Highlights

| Category | What's Delivered |
|----------|-----------------|
| **API** | Versioned REST (v1) + GraphQL with full Swagger docs |
| **Database** | 4 models, cursor pagination, composite indexes, audit trail |
| **Caching** | Multi-tier (Redis + LRU fallback), SWR, stampede protection |
| **Queues** | 4 async queues, DLQ, exponential retry, admin dashboard |
| **Security** | API keys, HMAC webhooks, rate limiting (L1+L2), HSTS, CSP |
| **Resilience** | Circuit breaker, load shedding, idempotency, graceful shutdown |
| **Observability** | Metrics + Logs + Traces, 4 Grafana dashboards, 8 alert rules |
| **CI/CD** | 6-gate backend + 5-gate frontend + weekly security scan |
| **Frontend** | 12 pages, offline support, RBAC, draft persistence, auto-refresh |
| **Infrastructure** | Docker Compose (dev+prod), NGINX, SSL, resource limits |
| **Testing** | Unit + Integration + Regression + Smoke + Property-based |
| **Documentation** | 11 documents covering all aspects |
| **GDPR** | Data export + erasure endpoints, PII redaction in logs |
