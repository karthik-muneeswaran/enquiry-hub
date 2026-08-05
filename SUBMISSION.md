# Enquiry Backend Platform — Final Submission

## Quick Access

| Item | Link/Location |
|------|---------------|
| Live Backend API | https://enquiry-hub-backend.karthikmuneeswaran.com/api/v1 |
| Live Frontend | https://enquiry-hub.karthikmuneeswaran.com |
| Swagger Docs | https://enquiry-hub-backend.karthikmuneeswaran.com/api/docs |
| GraphQL Playground | https://enquiry-hub-backend.karthikmuneeswaran.com/graphql |
| Grafana Monitoring | https://enquiry-hub-grafana.karthikmuneeswaran.com |
| WordPress CMS | https://enquiry-hub-wp.karthikmuneeswaran.com |
| GitHub Repository | https://github.com/karthikmkdev/enquiry-hub
| Screenshots | `screenshots/` folder in repo root |
| Full Deliverables Doc | `docs/deliverables.md` |

---

## Server Information

| Detail | Value |
|--------|-------|
| Provider | DigitalOcean Droplet |
| IP | 64.227.140.185 |
| OS | Ubuntu (hardened) |
| SSH Port | 2222 |
| Deploy User | `deploy` |
| SSL | Let's Encrypt (TLS 1.2+, HSTS preload) |
| Process Manager | PM2 (cluster mode inside Docker) |
| Reverse Proxy | NGINX 1.25 |

---

## Credentials for Testing

### Frontend Login

| Field | Value |
|-------|-------|
| URL | https://enquiry-hub.karthikmuneeswaran.com/login |

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Admin | `admin@enquiry.dev` | `admin123` | Full access (all permissions) |
| Agent | `agent@enquiry.dev` | `agent123` | Create, read, list, update enquiries + view properties & webhooks |
| Viewer | `viewer@enquiry.dev` | `viewer123` | Read-only (view enquiries + properties) |

---

### Backend Swagger (API Docs)

| Field | Value |
|-------|-------|
| URL | https://enquiry-hub-backend.karthikmuneeswaran.com/api/docs |
| API Key (Webhook) | `28bff17188a61754478431043be87da7` |
| Admin API Key | `f3f9b79d31af71ca7e39c944935e29936c2ca5d59c81ab28` |

**Admin routes** (require `X-Admin-Key` header):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/queues/stats` | Queue statistics (waiting, active, failed, etc.) |
| GET | `/api/v1/admin/queues/dlq` | List dead-letter queue jobs (paginated, filterable) |
| POST | `/api/v1/admin/queues/:name/retry/:jobId` | Retry a failed DLQ job |
| POST | `/api/v1/admin/queues/:name/pause` | Pause a queue (crm, email, push) |
| POST | `/api/v1/admin/queues/:name/resume` | Resume a paused queue |

> **Note:** Swagger UI is enabled in production for testing purposes. You can use it to interactively test all REST API endpoints — create enquiries, list with pagination, check health endpoints, and more — directly from the browser without needing curl or Postman. Use the API keys above to authenticate protected endpoints via the "Authorize" button in Swagger.

---

### Grafana

| Field | Value |
|-------|-------|
| URL | https://enquiry-hub-grafana.karthikmuneeswaran.com |
| Username | `admin` |
| Password | `H0bBD98WFyagPuW` |

## Screenshots

Located at `screenshots/` in the repository root, organized into `backend/` and `frontend/` subdirectories:

### Backend (`screenshots/backend/`)

| Screenshot | Shows |
|------------|-------|
| `pm2-process.png` | PM2 process list inside backend container |
| `Docker containers.png` | All production containers running |
| `HTTPS enabled (certificate info).png` | SSL certificate details (Let's Encrypt) |
| `Nginx configuration.png` | Reverse proxy config with rate limiting |
| `swagger-docs-support.png` | API documentation via Swagger |
| `self-hosted-wp.png` | Self-hosted WordPress integration |

### Backend - Grafana Dashboards (`screenshots/backend/grafana/`)

| Screenshot | Shows |
|------------|-------|
| `system-health-dashboard.png` | System health monitoring dashboard |
| `api-performance-dashboard.png` | API performance metrics dashboard |
| `business-metrics-dashboard.png` | Business metrics dashboard |
| `queue-monitor-dashboard.png` | Queue monitoring dashboard |
| `traces-via-tempo-grafana.png` | Distributed tracing via Tempo + Grafana |

### Backend - CI/CD (`screenshots/backend/ci-cd/`)

| Screenshot | Shows |
|------------|-------|
| `frontend-gh-actions.png` | GitHub Actions CI/CD pipeline |

### Frontend (`screenshots/frontend/`)

| Screenshot | Shows |
|------------|-------|
| `dashboard.png` | Admin dashboard overview |
| `enquiries-listings-page.png` | Enquiries listing page |
| `new-enquiry-page.png` | New enquiry form page |
| `properties-listing-page.png` | Properties listing page |
| `properties-single-page.png` | Single property detail page |
| `landing-page/landing-page-hero.png` | Landing page hero section |
| `landing-page/landing-page-capture-2.png` | Landing page section 2 |
| `landing-page/landing-page-capture-3.png` | Landing page section 3 |
| `login/login.png` | Login page |
| NGINX configuration | Reverse proxy config with rate limiting |

---

## What Was Delivered

### Core Requirements (Tasks 1-6)

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Backend API Development (REST + GraphQL + Queue) | Done |
| Task 2 | Performance Optimisation (N+1, caching, load shedding) | Done |
| Task 3 | WordPress Headless CMS Integration | Done |
| Task 4 | Security Assessment (OWASP report) | Done |
| Task 5 | Threat Scenario Analysis (5 scenarios documented) | Done |
| Task 6 | Deployment & Production Setup (Docker, HTTPS, CI/CD) | Done |

### Bonus Deliverables

| Bonus | Description | Status |
|-------|-------------|--------|
| CI/CD Pipeline | 6-gate backend + 5-gate frontend + weekly security scan | Done |
| Redis Caching | Multi-tier SWR (Redis + LRU fallback), stampede protection | Done |
| API Response Caching | ETag + 304, stale-while-revalidate | Done |
| Webhook Retry | BullMQ 3x exponential backoff | Done |
| Dead-Letter Queue | Failed job retention + admin retry endpoint | Done |
| Monitoring & Alerts | Prometheus + Grafana (4 dashboards) + 8 alert rules | Done |
| Load Testing | k6 scripts for smoke/soak/spike scenarios | Done |
| Auto-Rollback | Smoke test failure triggers automatic revert | Done |
| Frontend SPA | Full React admin dashboard with offline support | Done |
| Observability Stack | Loki (logs) + Tempo (traces) + Promtail | Done |

---

## Key Architecture Decisions

| Decision | Why |
|----------|-----|
| Cursor pagination (not OFFSET) | O(1) fetch for any page depth; stable under concurrent writes |
| BullMQ over in-process | Persistent jobs survive restarts; visible DLQ; retry with backoff |
| Circuit breaker on WordPress | Isolates external failures; cache fallback ensures 0 downtime |
| Two-layer rate limiting | NGINX L1 stops floods at the network; Redis L2 gives per-endpoint precision |
| SWR caching pattern | Serves stale instantly, refreshes in background — sub-ms reads |
| PM2 inside Docker | Cluster mode (multi-core), graceful reload, zero-downtime deploys |
| Prisma (not raw SQL) | Type-safe queries, parameterised by default (no SQL injection possible) |
| Structured logging (Pino) | JSON format → Promtail → Loki; trace ID correlation across services |

---

## Running Locally

```bash
git clone https://github.com/karthikmkdev/enquiry-hub.git
cd enquiry-hub
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
# Grafana: http://localhost:3001
```

---

## Documentation Map

| What You Need | Where to Look |
|---------------|---------------|
| Full delivery checklist | `docs/deliverables.md` |
| Backend architecture | `docs/backend-architecture.md` |
| Frontend architecture | `docs/frontend-architecture.md` |
| CI/CD pipeline details | `docs/ci-cd-pipeline.md` |
| API reference | `docs/API.md` + Swagger UI |
| Database design | `docs/DATABASE_SCHEMA.md` + `backend/prisma/schema.prisma` |
| Deployment guide | `docs/DEPLOYMENT.md` |
| Security report | `docs/SECURITY_REPORT.md` |
| Performance optimisations | `docs/PERFORMANCE.md` |
| Incident runbook | `docs/RUNBOOK.md` |
| Test strategy | `docs/testing.md` |
