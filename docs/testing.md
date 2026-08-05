# Testing Guide

This document covers the testing strategy, test types, local execution workflow, and CI pipeline integration for the Enquiry Backend Platform.

---

## Testing Philosophy

- **Test at the right level** — unit tests for isolated logic, integration tests for cross-boundary interactions, smoke tests for deployment validation.
- **Fast feedback loop** — unit tests complete in seconds, integration tests within a minute. Long-running tests (load, soak) run separately.
- **Fail early** — CI gates block merges on test failures. Flaky tests are quarantined, not skipped.
- **Security as a first-class concern** — regression tests cover injection, XSS, prototype pollution, and race conditions.
- **Production parity** — tests run inside Docker containers using the same images and network topology as production.

---

## Test Pyramid

```
           ┌───────────────┐
           │    Smoke      │   Health & sanity checks (API)
           ├───────────────┤
           │  Integration  │   Real DB + Redis + full app bootstrap
           ├───────────────┤
           │     Unit      │   Isolated logic, mocked dependencies
           └───────────────┘
```

| Layer | Speed | Scope | Infrastructure Required |
|-------|-------|-------|-------------------------|
| Unit | < 10s | Single function/class | None (all mocked) |
| Integration | 15–30s | Module with real DB/Redis | Postgres + Redis |
| Regression | 15–30s | Security edge cases | Running app |
| Smoke | 5–10s | Health and sanity checks | Running app |
| Load (k6) | Minutes | Performance and capacity | Running app |

---

## Test Types

### Unit Tests

Validate isolated business logic with all external dependencies mocked.

**Backend (Jest + ts-jest)**
- Service-layer business rules (idempotency, duplicate detection, validation)
- Guards (API key validation, HMAC signature verification, content-type enforcement)
- Interceptors (response envelope transformation, request ID propagation, load shedding)
- Pipes (input sanitization, XSS prevention)
- Filters (error formatting, status code mapping)

**Frontend (Vitest + React Testing Library)**
- Custom hooks (data fetching, mutations, form persistence, online status)
- Auth components (route protection, permission gating)
- Page components (rendering, loading/error states, user interactions)
- Services (offline queue, API client)

### Integration Tests

Full request lifecycles against real infrastructure inside Docker.

- Enquiry CRUD with actual Postgres writes and reads
- Webhook ingestion with HMAC signature validation
- Queue job enqueuing via BullMQ with Redis
- Cache SWR (stale-while-revalidate) behavior with real Redis TTLs
- Rate limiting with sliding window algorithm

### Regression Tests

Guard against previously discovered vulnerabilities and edge cases:

- SQL injection via crafted payloads
- XSS prevention through sanitization pipeline
- Prototype pollution attempts on JSON parsing
- Oversized payload rejection (413 responses)
- Race condition detection (concurrent duplicate submissions)

### Smoke Tests

Quick health checks against a running deployment:

- Health endpoints return 200
- API key authentication accepts valid keys and rejects invalid ones
- Basic CRUD operations complete without error
- Database connectivity is healthy

### Load Tests (k6)

Performance validation under various traffic patterns:

| Scenario | Purpose | Duration |
|----------|---------|----------|
| Smoke | Baseline verification at minimal load | 1 min |
| Stress | Find breaking point with ramped concurrency | 5 min |
| Spike | Sudden traffic burst to test load shedding | 3 min |
| Soak | Sustained load to detect memory leaks | 30 min |

---

## Running Tests Locally (Docker Dev)

All tests run inside Docker containers to ensure environment consistency.

### Prerequisites

```bash
# Start the full development stack
docker compose up -d

# Verify all services are healthy
docker compose ps
```

### Backend Commands

```bash
# Unit tests (fast, no infrastructure needed)
docker compose exec backend npm run test:unit

# Integration tests (requires Postgres + Redis)
docker compose exec backend npm run test:integration

# Regression/security tests (requires running app)
docker compose exec backend npm run test:regression

# Smoke tests (quick sanity check)
docker compose exec backend npm run test:smoke

# All tests with coverage report
docker compose exec backend npm run test:coverage

# Watch mode during development
docker compose exec backend npm run test:watch
```

### Frontend Commands

```bash
# Unit tests (single run, jsdom environment)
docker compose exec frontend npm run test

# Unit tests with coverage
docker compose exec frontend npm run test:coverage
```

### Load Tests (k6)

Run from the host machine or via Docker:

```bash
# Direct execution (requires k6 installed)
k6 run backend/test/k6/scenarios/smoke.js
k6 run backend/test/k6/scenarios/stress.js
k6 run backend/test/k6/scenarios/spike.js
k6 run backend/test/k6/scenarios/soak.js

# Via Docker (no local install needed)
docker run --rm -i --network host grafana/k6 run - < backend/test/k6/scenarios/smoke.js
```

---

## CI Pipeline Integration

### Gate Structure

```
┌──────────────┐    ┌───────────────┐    ┌──────────────────┐    ┌─────────────┐
│  Lint        │───▶│  Unit Tests   │───▶│  Integration     │───▶│   Deploy    │
│  + Format    │    │  + Coverage   │    │  + Regression    │    │  (staging)  │
└──────────────┘    └───────────────┘    └──────────────────┘    └──────┬──────┘
                                                                        │
                                                                 ┌──────▼──────┐
                                                                 │   Smoke     │
                                                                 └──────┬──────┘
                                                                        │
                                                                 ┌──────▼──────┐
                                                                 │Deploy (prod)│
                                                                 └─────────────┘
```

### Stage 1: Lint and Format (blocking, ~30s)

Catches style and static analysis issues before tests run.

```yaml
- docker compose exec backend npm run lint
- docker compose exec backend npm run format -- --check
- docker compose exec frontend npm run lint
- docker compose exec frontend npm run format:check
```

### Stage 2: Unit Tests + Coverage (blocking, ~30s)

Fast isolated tests. Fail the build if coverage drops below thresholds.

```yaml
- docker compose exec backend npm run test:unit
- docker compose exec frontend npm run test:coverage
```

**Coverage thresholds:**
- Lines: 75%
- Functions: 75%
- Branches: 70%
- Statements: 75%

### Stage 3: Integration + Regression (blocking, ~60s)

Requires Postgres and Redis service containers in CI.

```yaml
services:
  - postgres:15-alpine
  - redis:7-alpine

steps:
  - docker compose exec backend npm run test:integration
  - docker compose exec backend npm run test:regression
```

### Stage 4: Smoke (post-deploy to staging)

Validates the deployed staging environment before production promotion.

```yaml
- docker compose exec backend npm run test:smoke
```

### Stage 5: Load Tests (scheduled / manual trigger)

Not part of every PR. Run on a nightly schedule or before major releases.

```yaml
# Triggered manually or via cron
- k6 run backend/test/k6/scenarios/stress.js --out json=results.json
```

Results feed into Grafana dashboards for trend analysis.

---

## Coverage Reporting

### Backend

```bash
docker compose exec backend npm run test:coverage
# Output: backend/coverage/ (html, lcov, text)
```

### Frontend

```bash
docker compose exec frontend npm run test:coverage
# Output: frontend/coverage/ (html, lcov, text)
```

Upload `lcov.info` to coverage services (Codecov, Coveralls) in CI for PR-level annotations and trend tracking.

---

## Environment Configuration

Integration and smoke tests use the same environment as the dev stack. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection for data persistence tests |
| `REDIS_URL` | Redis connection for cache and queue tests |
| `API_KEYS` | Comma-separated valid API keys for auth tests |
| `HMAC_SECRET` | Secret used to validate webhook signatures |
| `WORDPRESS_GRAPHQL_URL` | WordPress endpoint for property sync tests |

For isolated CI runs, override `DATABASE_URL` to point to a disposable test database that gets created and dropped per pipeline run.

---

## Best Practices

1. **Never mock infrastructure at the integration level** — use real Postgres and Redis inside Docker.
2. **Always clean up** — integration tests flush Redis and truncate tables in `beforeEach`.
3. **Use `--runInBand`** for integration tests to prevent shared-state race conditions.
4. **Set explicit timeouts** on lifecycle hooks that bootstrap the NestJS app (30s for `beforeAll`/`afterAll`).
5. **Match CI and local environments** — run tests inside the same Docker images used in production.
6. **Keep unit tests deterministic** — no network calls, no real timers, no unseeded randomness.
7. **Quarantine flaky tests** — mark them, track them, fix them within one sprint.
8. **Test security boundaries** — every guard, pipe, and filter should have dedicated test coverage.
9. **Use realistic test data** — avoid trivial fixtures that miss edge cases (unicode, special chars, max lengths).
10. **Review test quality** — tests that never fail and tests that always fail are both worthless.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tests timeout during app bootstrap | Increase lifecycle hook timeout to 30000ms |
| Redis connection refused | Verify Redis container is healthy: `docker compose ps` |
| Prisma client not generated | Run `docker compose exec backend npx prisma generate` |
| Port conflicts on test run | Stop other instances: `docker compose down` first |
| k6 command not found | Install: `brew install k6` (macOS) or `apt install k6` (Linux) |
| Coverage below threshold | Check recent changes for untested code paths |
| Integration tests polluting each other | Ensure `beforeEach` cleans state; run with `--runInBand` |
