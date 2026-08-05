# Backend Architecture

## Overview

The Enquiry Backend Platform is a production-grade NestJS application that serves as the API layer for a property enquiry management system. It integrates with WordPress (WPGraphQL) for property data, PostgreSQL for persistence, Redis for caching and queuing, and delivers a full observability stack via OpenTelemetry.

**Tech Stack:**

- Runtime: Node.js with TypeScript
- Framework: NestJS 10
- API Layer: REST (versioned) + GraphQL (Apollo Server)
- Database: PostgreSQL 15 via Prisma ORM
- Cache/Queue: Redis 7 (ioredis + BullMQ)
- Observability: OpenTelemetry, Prometheus, Grafana, Loki, Tempo
- External Integration: WordPress WPGraphQL
- Documentation: Swagger/OpenAPI

---

## System Architecture Diagram

```
                         ┌─────────────────────────────────────────────────────────┐
                         │                     NGINX (Reverse Proxy)               │
                         │          SSL Termination / Rate Limiting / Routing      │
                         └─────────────┬──────────────────────┬───────────────────┘
                                       │                      │
                              ┌────────▼────────┐   ┌────────▼────────┐
                              │  Backend (NestJS)│   │ Frontend (Nginx) │
                              │   Port 3000      │   │   Static SPA     │
                              └───┬──────┬───┬───┘   └──────────────────┘
                                  │      │   │
                    ┌─────────────┼──────┼───┼─────────────────┐
                    │             │      │   │                  │
             ┌──────▼───┐  ┌─────▼──┐ ┌─▼───▼──┐  ┌───────────▼─────────┐
             │PostgreSQL │  │ Redis  │ │WordPress│  │  Observability Stack │
             │  (Prisma) │  │Cache/Q │ │WPGraphQL│  │ Prometheus/Grafana/  │
             └───────────┘  └────────┘ └────────┘  │ Loki/Tempo/Promtail  │
                                                    └─────────────────────┘
```

---

## Project Structure

```
backend/
├── src/
│   ├── main.ts                      # Application bootstrap
│   ├── app.module.ts                # Root module (wires all modules)
│   ├── config/                      # Configuration module
│   │   ├── config.module.ts
│   │   ├── config.service.ts        # Typed config accessor
│   │   └── config.validation.ts     # Joi-based env validation
│   ├── database/                    # Prisma database module
│   │   ├── database.module.ts       # Global PrismaService
│   │   └── prisma.service.ts
│   ├── cache/                       # Redis caching layer
│   │   ├── cache.module.ts
│   │   ├── cache.service.ts         # SWR + fallback + mutex
│   │   └── in-memory-lru.cache.ts   # LRU fallback cache
│   ├── queue/                       # BullMQ job processing
│   │   ├── queue.module.ts
│   │   ├── queue.constants.ts       # Queue names + default job opts
│   │   ├── notification.producer.ts # Job producer
│   │   ├── admin-queue.controller.ts
│   │   └── workers/
│   │       ├── email.worker.ts
│   │       ├── push.worker.ts
│   │       ├── crm-sync.worker.ts
│   │       └── retention.worker.ts
│   ├── observability/               # Tracing, metrics, logging
│   │   ├── tracing.ts              # OpenTelemetry SDK init
│   │   ├── metrics.service.ts      # Business + system metrics
│   │   └── logger.config.ts        # Pino structured logging
│   ├── common/                      # Shared infrastructure
│   │   ├── guards/                  # ApiKeyGuard, HmacGuard, ContentTypeGuard
│   │   ├── interceptors/           # RequestId, HttpMetrics, ETag, LoadShedding, Transform
│   │   ├── filters/                # GlobalExceptionFilter
│   │   ├── pipes/                  # SanitizationPipe
│   │   ├── decorators/             # @RateLimit custom decorator
│   │   ├── circuit-breaker/        # Opossum circuit breaker factory
│   │   ├── services/               # EventLoopMonitor, GracefulShutdownService
│   │   ├── response/               # ApiErrorCode, standardized response types
│   │   └── utils/                  # Context extraction helpers
│   └── modules/                     # Domain modules
│       ├── enquiry/                 # Core business domain
│       ├── webhook/                 # CRM webhook ingestion
│       ├── property/                # WordPress property proxy
│       ├── audit/                   # Audit logging
│       ├── gdpr/                    # Data export & erasure
│       ├── health/                  # Liveness & readiness probes
│       ├── admin/                   # Admin operations
│       └── rate-limit/              # Sliding window rate limiter
├── prisma/
│   ├── schema.prisma               # Database models
│   ├── migrations/                  # Migration history
│   └── seed.ts                     # Database seeding
├── test/
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests (DB + Redis)
│   ├── regression/                 # Regression tests
│   └── smoke/                      # Smoke/health tests
├── Dockerfile                       # Multi-stage (dev + production)
├── package.json
└── tsconfig.json
```

---

## Application Bootstrap (`main.ts`)

The server bootstrap configures:

1. **OpenTelemetry Tracing** — imported before NestFactory for early instrumentation
2. **Body Size Limit** — 1MB maximum payload (returns 413)
3. **Security Headers** — Helmet with CSP, HSTS (2 years), X-Frame-Options DENY
4. **Global Prefix** — All routes at `/api` (except `/health/*`)
5. **URI Versioning** — `/api/v1/...`, `/api/v2/...` with default version `1`
6. **Global Exception Filter** — Structured error responses
7. **Global Pipes** — Sanitization then Validation (whitelist + transform)
8. **Content-Type Guard** — Rejects non-JSON on mutating methods (415)
9. **CORS** — Configurable origins from env
10. **Swagger** — Auto-generated OpenAPI docs at `/api/docs` (disabled in production)

---

## API Design

### REST API (Versioned)

All REST endpoints follow `/api/v1/{resource}` convention:

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/v1/enquiry` | Create new enquiry | 10/min/IP |
| GET | `/api/v1/enquiry/:id` | Get enquiry by ID | 100/min/IP |
| GET | `/api/v1/enquiries` | List with cursor pagination | 60/min/IP |
| PATCH | `/api/v1/enquiry/:id/status` | Update status | 30/min/IP |
| POST | `/api/v1/webhook` | Ingest CRM webhook | HMAC-secured |
| GET | `/api/v1/admin/queues` | Queue dashboard | API Key |
| POST | `/api/v1/gdpr/export` | GDPR data export | API Key |
| DELETE | `/api/v1/gdpr/erase/:email` | GDPR data erasure | API Key |
| GET | `/health/live` | Liveness probe | None |
| GET | `/health/ready` | Readiness probe | None |

### GraphQL API

Served at `/graphql` via Apollo Server with auto-generated schema:

```graphql
type Query {
  properties(first: Int, after: String, search: String): PropertyConnection!
  property(slug: String, wpId: Int): Property
}
```

- Cursor-based pagination (Relay-style connections)
- Playground enabled in non-production
- Introspection disabled in production

### Response Envelope

All REST responses are wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "request_id": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "email must be valid", "constraint": "isEmail" }
    ],
    "request_id": "uuid",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Database Layer

### ORM: Prisma

- **PostgreSQL 15** as the primary datastore
- Prisma Client for type-safe queries
- Interactive transactions with configurable isolation levels
- Global `PrismaService` shared across all modules

### Schema (4 Models)

| Model | Purpose |
|-------|---------|
| `Enquiry` | Core business entity — property enquiries |
| `WebhookEvent` | Inbound CRM webhook events with processing status |
| `Property` | Cached WordPress property data |
| `AuditLog` | Immutable audit trail (entity, action, before/after) |

### Indexing Strategy

```prisma
// Enquiry: composite index for duplicate detection
@@index([email, propertyId, createdAt])
@@index([status])
@@index([createdAt])

// WebhookEvent: optimized for status-based processing
@@index([status])
@@index([createdAt])
@@index([enquiryId])

// AuditLog: fast lookup by entity and request correlation
@@index([entity, entityId])
@@index([createdAt])
@@index([requestId])
```

### Transactions

The platform uses **interactive Prisma transactions** for operations requiring atomicity:

```typescript
await this.prisma.$transaction(async (tx) => {
  const created = await tx.enquiry.create({ data: {...} });
  await tx.auditLog.create({ data: { entity: 'Enquiry', action: 'CREATE', ... } });
  return created;
}, {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  timeout: 10000,
});
```

- Enquiry creation + audit log are atomic
- Status updates + audit log are atomic
- `ReadCommitted` isolation prevents dirty reads while minimizing lock contention
- 10-second timeout prevents long-running transactions from blocking

---

## Caching Architecture

### Multi-Tier Caching with Graceful Degradation

```
┌─────────────────────────────────────────────────────┐
│                   CacheService                       │
│                                                     │
│  ┌───────────────┐    ┌─────────────────────────┐  │
│  │  Redis (Primary) │    │ In-Memory LRU (Fallback) │  │
│  │  - SWR semantics │    │ - 1000 items max         │  │
│  │  - 5min stale TTL│    │ - 60s TTL               │  │
│  │  - 15min expire  │    │ - Auto-activates on     │  │
│  │  - Pipeline ops  │    │   Redis failure          │  │
│  └───────────────┘    └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Stale-While-Revalidate (SWR)

- **Fresh** (0–5min): Serve immediately
- **Stale** (5–15min): Serve immediately + trigger background refresh
- **Expired** (>15min): Fetch fresh data, cache it, then serve

### Stampede Protection

Uses Redis distributed mutex (`SET NX PX`) to prevent thundering herd:

- Only one caller fetches fresh data on cache miss
- Others wait briefly then get the freshly cached result
- Lua-scripted lock release ensures safety (token comparison)

### Cache Strategies by Domain

| Domain | Strategy | TTL |
|--------|----------|-----|
| Enquiry (by ID) | Write-through + SWR | 5min stale / 15min expire |
| Enquiry (list) | SWR + invalidation on write | 5min stale / 15min expire |
| WordPress properties | Cache-as-fallback on circuit open | 5min stale / 15min expire |
| Idempotency keys | Write-once, read-many | 24 hours |
| Duplicate markers | Write-through | 10 minutes |
| Rate limit counters | Sliding window counters | Per-window |

### Redis Health Monitoring

- Automatic health checks via periodic PING
- On failure: seamlessly switches to in-memory LRU fallback
- On recovery: automatically restores Redis as primary
- All operations wrapped with 2-second timeout

---

## Queue System (BullMQ)

### Architecture

```
┌──────────────────────┐     ┌─────────────┐     ┌────────────────────┐
│  NotificationProducer │────▶│    Redis     │◀────│      Workers       │
│  (enqueue jobs)       │     │  (BullMQ)   │     │                    │
└──────────────────────┘     └─────────────┘     │  - EmailWorker     │
                                                   │  - PushWorker      │
                                                   │  - CrmSyncWorker   │
                                                   │  - RetentionWorker │
                                                   └────────────────────┘
```

### Queue Names

| Queue | Purpose |
|-------|---------|
| `email-queue` | Confirmation emails, admin notifications |
| `push-queue` | Push notifications to recipients |
| `crm-queue` | Webhook event processing, CRM sync |
| `maintenance` | Data retention cleanup, scheduled tasks |

### Job Configuration

```typescript
DEFAULT_JOB_OPTIONS = {
  attempts: 3,                          // Max retry attempts
  backoff: { type: 'exponential', delay: 1000 }, // 1s, 4s, 16s
  removeOnComplete: { age: 30 days, count: 1000 },
  removeOnFail: false,                  // Keep for DLQ inspection
}
```

### Fault Tolerance

- Jobs are persisted in Redis — survives application restarts
- Failed jobs are retained for Dead Letter Queue (DLQ) inspection
- Exponential backoff prevents cascade failures
- Queue is fire-and-forget from the API perspective — queue failures never fail API requests

---

## Resilience Patterns

### 1. Circuit Breaker (WordPress Client)

Uses `opossum` library with configurable thresholds:

```
State Machine:
  CLOSED → (50% failures within 5 requests) → OPEN
  OPEN → (30s timeout elapsed) → HALF-OPEN
  HALF-OPEN → (probe succeeds) → CLOSED
  HALF-OPEN → (probe fails) → OPEN
```

**Configuration:**
- Timeout: 5 seconds per call
- Error threshold: 50% failure rate
- Volume threshold: 5 minimum requests before tripping
- Reset timeout: 30 seconds in OPEN state
- Rolling window: 30 seconds

**Fallback Strategy:**
When circuit is OPEN, serve cached data. If no cache available, return 503 with `Retry-After` header.

### 2. Load Shedding

`LoadSheddingInterceptor` monitors the Node.js event loop:

- Measures event loop lag continuously via `EventLoopMonitor`
- When lag exceeds 200ms, rejects incoming requests with 503
- Sets `Retry-After: 5` header for client backoff
- Protects the server from cascade overload

### 3. Retry with Exponential Backoff

Applied at multiple levels:
- **BullMQ jobs**: 3 attempts, exponential (1s, 4s, 16s)
- **WordPress HTTP calls**: Handled by circuit breaker timeout + retry
- **Redis operations**: Wrapped with 2s timeout, fallback to in-memory

### 4. Graceful Shutdown

`GracefulShutdownService` handles SIGTERM:
1. Stop accepting new connections
2. Drain existing requests (30s grace period)
3. Close BullMQ workers
4. Shutdown OpenTelemetry SDK
5. Close database connections
6. Exit process

### 5. Idempotency

POST `/api/v1/enquiry` supports `Idempotency-Key` header:
- Key stored in Redis with 24-hour TTL
- Duplicate requests return the original response
- Prevents double-submission from network retries

### 6. Duplicate Detection

Two-layer duplicate detection for enquiries:
1. **Redis cache**: Fast check for recent submissions (same email + propertyId)
2. **Database fallback**: Query if Redis misses (10-minute window)

---

## Security

### Authentication & Authorization

| Mechanism | Scope | Implementation |
|-----------|-------|----------------|
| API Key (`X-API-Key`) | Admin endpoints | `ApiKeyGuard` with Set-based O(1) lookup |
| HMAC-SHA256 (`X-Webhook-Signature`) | Webhook ingestion | `HmacGuard` with timing-safe comparison |
| Content-Type validation | All mutating requests | `ContentTypeGuard` (rejects non-JSON → 415) |

### API Key Rotation

- Supports multiple active keys simultaneously (comma-separated in env)
- Hot-reload capability via `refreshKeys()` method
- Zero-downtime rotation by adding new key before removing old

### HMAC Webhook Verification

```
Expected: X-Webhook-Signature: sha256=<hex-encoded-hmac>
Process:  HMAC-SHA256(request_body, secret) → timing-safe compare
```

- Timing-safe comparison prevents timing attacks
- Supports both raw hex and `sha256=` prefixed formats

### Security Headers (Helmet)

- Content-Security-Policy with strict directives
- HSTS: 2 years, includeSubDomains, preload
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

### Input Handling

1. **Sanitization Pipe** — Strips/escapes dangerous input before validation
2. **Validation Pipe** — class-validator with whitelist + forbidNonWhitelisted
3. **Body Size Limit** — 1MB maximum (Express-level)

### PII Redaction in Logs

```typescript
redact: {
  paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.email', 'req.body.phone'],
  censor: '[REDACTED]',
}
```

---

## Rate Limiting

Custom `@RateLimit()` decorator with Redis-backed sliding window:

```typescript
@RateLimit({ limit: 10, window: 60, scope: 'ip' })
```

- **Sliding window** algorithm (not fixed window) for smooth rate control
- Scoped by IP address
- Configurable per-endpoint limits
- Returns 429 with standard error response when exceeded
- Metrics tracked via `rate_limit_triggered_total` counter

---

## Observability

### Three Pillars

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│   Metrics  │    │   Logging  │    │  Tracing   │
│ Prometheus │    │    Loki    │    │   Tempo    │
│  + Grafana │    │ + Promtail │    │  + OTLP    │
└────────────┘    └────────────┘    └────────────┘
```

### Metrics (Prometheus + OpenTelemetry)

**Counters:**
- `enquiry_created_total` — New enquiries by source
- `cache_hit_total` / `cache_miss_total` — Cache efficiency
- `rate_limit_triggered_total` — Rate limit activations
- `webhook_received_total` — Inbound webhooks

**Histograms:**
- `http_request_duration_seconds` — Request latency (p50, p95, p99)
- `queue_job_duration_seconds` — Job processing time
- `db_query_duration_seconds` — Database query latency

**Gauges:**
- `queue_depth` — Current pending jobs per queue
- `db_pool_active_connections` — Active DB connections
- `event_loop_lag_seconds` — Node.js event loop health

Prometheus scrapes metrics from port 8081 (`PrometheusExporter`).

### Structured Logging (Pino + Loki)

- JSON-formatted logs with consistent fields
- Automatic trace ID correlation (injected from active OpenTelemetry span)
- PII redaction (email, phone, auth headers)
- Log levels: debug for client errors, error for server errors
- Promtail ships container logs to Loki

### Distributed Tracing (OpenTelemetry + Tempo)

- Auto-instrumentation for HTTP, PostgreSQL, Redis
- Custom spans for business operations
- Trace propagation across service boundaries
- OTLP export to Tempo (port 4318)
- Disabled for noisy paths (`/health`, `/metrics`)

### Grafana Dashboards

| Dashboard | Metrics |
|-----------|---------|
| System Health | Event loop lag, memory, CPU, DB connections |
| API Performance | Request rates, latency percentiles, error rates |
| Business Metrics | Enquiries created, conversion rates, source breakdown |
| Queue Monitor | Job rates, processing times, DLQ depth, worker health |

---

## External Integrations

### WordPress (WPGraphQL)

The `WordPressClient` acts as a resilient proxy to WordPress:

```
Request → Circuit Breaker → HTTP Client → WPGraphQL → WordPress
              │                                          │
              │ (on OPEN)                               │
              ▼                                          ▼
         Cache Fallback ← Cache (write-through) ←── Response
```

- Circuit breaker protects against WordPress downtime
- Successful responses are cached with SWR semantics
- On circuit OPEN: serves stale cache or returns 503 + Retry-After
- GraphQL queries for paginated listings and single property lookup

### CRM Integration (Webhooks)

**Inbound:**
- HMAC-SHA256 verified webhook ingestion
- Event deduplication by `eventId`
- Persisted with `RECEIVED` status, then async-processed via CRM queue

**Outbound:**
- Notifications dispatched via BullMQ (email, push, CRM sync)
- Fire-and-forget from API perspective
- Retry with exponential backoff on failure

---

## Request Lifecycle

```
Client Request
      │
      ▼
┌─ NGINX (SSL, routing) ─┐
      │
      ▼
┌─ Express Middleware ────┐
│  1. Helmet (security)   │
│  2. JSON body parser    │
│  3. CORS               │
└─────────────────────────┘
      │
      ▼
┌─ NestJS Interceptor Chain ─────────────────────┐
│  1. RequestIdInterceptor (assign/forward UUID)  │
│  2. HttpMetricsInterceptor (record duration)    │
│  3. TransformInterceptor (envelope response)    │
│  4. LoadSheddingInterceptor (503 if overloaded) │
└─────────────────────────────────────────────────┘
      │
      ▼
┌─ Guards ─────────────────────┐
│  ContentTypeGuard (415)       │
│  ApiKeyGuard / HmacGuard      │
└───────────────────────────────┘
      │
      ▼
┌─ Pipes ──────────────────────┐
│  SanitizationPipe             │
│  ValidationPipe               │
└───────────────────────────────┘
      │
      ▼
┌─ Controller → Service → Repository → Database ─┐
│  Business logic execution                        │
└──────────────────────────────────────────────────┘
      │
      ▼
┌─ Response ───────────────────┐
│  TransformInterceptor wraps   │
│  ETag computed + set          │
│  X-Request-Id header set      │
└───────────────────────────────┘
```

---

## Deployment Architecture

### Development (docker-compose.yml)

All services run locally with hot-reload:
- Backend with `nest start --watch`
- Frontend with Vite dev server
- PostgreSQL, Redis, MySQL, WordPress
- Full observability stack

### Production (docker-compose.prod.yml)

```
┌─────────────────────────────────────────────────────────┐
│                      NGINX                               │
│  - SSL termination (Let's Encrypt)                       │
│  - Routes: backend / frontend / grafana subdomains       │
│  - Prometheus exporter                                   │
└─────────┬────────────────────┬──────────────────────────┘
          │                    │
   ┌──────▼──────┐    ┌───────▼───────┐
   │   Backend   │    │   Frontend    │
   │ (PM2 cluster│    │ (nginx static │
   │  inside     │    │  container)   │
   │  container) │    └───────────────┘
   │  1G / 2 CPU │
   └──────┬──────┘
          │
   ┌──────┼──────────────────────┐
   │      │                      │
   ▼      ▼                      ▼
 PostgreSQL  Redis            WordPress + MySQL
 512M/1CPU   300M/0.5CPU      512M/1CPU each
```

**Resource Limits:**
| Service | Memory | CPU |
|---------|--------|-----|
| Backend | 1G | 2 |
| Frontend | 128M | 0.5 |
| NGINX | 128M | 0.5 |
| PostgreSQL | 512M | 1 |
| Redis | 300M | 0.5 |
| WordPress | 512M | 1 |
| Grafana | 256M | 0.5 |
| Prometheus | 256M | 0.5 |

**Production Features:**
- `restart: unless-stopped` on all services
- `stop_grace_period: 35s` for backend (graceful drain)
- Internal-only ports (no external exposure for DB/Redis/observability)
- PM2 cluster mode inside backend container
- Multi-stage Dockerfile (build → production)

---

## Testing Strategy

```
test/
├── unit/           # Isolated service/logic tests (jest --selectProjects unit)
├── integration/    # DB + Redis integration tests (--runInBand)
├── regression/     # Regression suite (--runInBand)
└── smoke/          # Production smoke tests
```

- **Unit tests**: Mock all dependencies, test business logic in isolation
- **Integration tests**: Real PostgreSQL + Redis, run sequentially
- **Regression tests**: Cover previously reported bugs
- **Smoke tests**: Hit health endpoints post-deploy
- **Property-based testing**: Uses `fast-check` for invariant testing
- **Test timeout**: 30 seconds (accounts for DB/Redis startup)

---

## Configuration Management

### Environment Validation

All environment variables validated at startup via Joi schema:
- Missing required vars → application fails to start with clear message
- Type coercion for numbers and booleans
- Default values for optional settings

### Typed Configuration Service

`AppConfigService` provides type-safe access:

```typescript
configService.databaseUrl    // string (required)
configService.port           // number (default: 3000)
configService.isProduction   // boolean (derived)
configService.apiKeys        // string[] (comma-split)
configService.corsOrigins    // string[] (comma-split)
```

### Module Path Aliases

```
@/          → src/
@config/    → src/config/
@common/    → src/common/
@modules/   → src/modules/
@database/  → src/database/
@queue/     → src/queue/
@cache/     → src/cache/
@observability/ → src/observability/
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Cursor-based pagination | Stable pagination under concurrent writes, no offset drift |
| SWR caching | Optimizes for read-heavy workload while staying fresh |
| Circuit breaker on WordPress | WordPress is an external dependency — isolate failures |
| BullMQ over in-process | Survives crashes, horizontal scaling, DLQ inspection |
| Prisma interactive transactions | Atomic multi-table operations with explicit isolation |
| Redis distributed locks | Prevents cache stampede under high concurrency |
| Idempotency keys | Safe retries for network-unreliable mobile clients |
| Event loop monitoring | Proactive overload detection before performance degrades |
| Audit logging in transaction | Guarantees audit trail consistency with business data |
| HMAC webhook verification | Proves webhook origin, prevents replay attacks |
| In-memory LRU fallback | Zero-downtime operation even if Redis goes down |
| Global request IDs | End-to-end request correlation across logs and traces |
