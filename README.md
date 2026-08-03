# Enquiry Backend Platform

A production-ready, API-driven platform for managing property enquiries, CRM integrations, WordPress content delivery, and real-time notifications. Built with resilience, performance, and observability as core design goals.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 15 + Prisma ORM |
| Cache & Queues | Redis 7, BullMQ |
| API | REST + GraphQL |
| CMS | WordPress + WPGraphQL |
| Frontend | React (Vite) + Tailwind CSS + Apollo Client |
| Observability | OpenTelemetry + Prometheus + Grafana + Loki + Tempo |
| Deployment | Docker + PM2 + Nginx |
| CI/CD | GitHub Actions |
| Testing | Jest + fast-check + Supertest + Vitest + Playwright + k6 |

---

## Architecture Overview

```
Client → Nginx (SSL, gzip, rate limit L1) → NestJS API (guards, pipes, services)
                                           ├── PostgreSQL (data)
                                           ├── Redis (cache + queues)
                                           ├── BullMQ workers (email, push, CRM)
                                           └── WordPress (property content via GraphQL)
```

Key patterns:
- **Circuit breakers** on all external service calls (WordPress, SMTP, CRM)
- **Cursor-based pagination** across all list endpoints
- **Stale-While-Revalidate** caching with Redis + in-memory LRU fallback
- **Tiered rate limiting** (Nginx L1 + NestJS L2 + per-endpoint L3)
- **Graceful degradation** when Redis or external services are down
- **Load shedding** via event loop lag monitoring with hysteresis

---

## Prerequisites

- Docker and Docker Compose (v2)
- Node.js 20+ (for local development without Docker)
- Git

---

## Local Development Setup

### 1. Clone and Configure

```bash
git clone <repo-url> enquiry-backend-platform
cd enquiry-backend-platform

# Backend environment (defaults work with Docker Compose)
cp backend/.env.example backend/.env.development

# Frontend environment
cp frontend/.env.example frontend/.env.development
```

### 2. Start with Docker Compose

```bash
# Start all services (backend, frontend, postgres, redis, wordpress, observability)
docker compose up -d

# Run database migrations
docker compose exec app npx prisma migrate deploy

# Generate Prisma client
docker compose exec app npx prisma generate
```

### 3. Verify

- **Backend API:** http://localhost:3000/health/ready
- **Swagger UI:** http://localhost:3000/api/docs
- **Frontend:** http://localhost:5173
- **Grafana:** http://localhost:3001
- **Bull Board:** http://localhost:3000/admin/queues

### 4. Development Without Docker

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
enquiry-backend-platform/
├── backend/                 # NestJS application
│   ├── src/
│   │   ├── modules/         # Feature modules (enquiry, webhook, property, etc.)
│   │   ├── common/          # Guards, pipes, interceptors, filters, DTOs
│   │   ├── config/          # Configuration module with validation
│   │   ├── database/        # Prisma service and repositories
│   │   ├── queue/           # BullMQ setup and workers
│   │   ├── cache/           # Redis cache with SWR
│   │   └── observability/   # OpenTelemetry instrumentation
│   ├── prisma/              # Schema and migrations
│   └── test/                # Unit, integration, regression, smoke, k6 tests
├── frontend/                # React (Vite) application
│   ├── src/
│   │   ├── pages/           # Route-level page components
│   │   ├── auth/            # Static auth system (mock)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/api/    # Typed API client layer
│   │   └── components/      # Shared UI components
│   └── test/                # Unit and E2E tests
├── nginx/                   # Nginx configuration
├── observability/           # Prometheus, Grafana, Loki, Tempo configs
├── scripts/                 # Backup, restore, hardening, SSL scripts
├── docs/                    # Operational documentation
├── docker-compose.yml       # Development orchestration
└── docker-compose.prod.yml  # Production overlay
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/API.md](docs/API.md) | API reference, Swagger UI links, endpoint overview |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | VPS setup, Docker deployment, SSL configuration |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Complete environment variable reference |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Performance optimizations and rationale |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Incident response, scaling, backup, rollback |

---

## Testing

```bash
# Backend unit tests
cd backend && npm run test:unit

# Backend integration tests (requires Docker services)
npm run test:integration

# Backend property-based tests (included in unit suite)
npm test

# Frontend component tests
cd frontend && npm test

# Frontend E2E tests
npm run test:e2e

# Load tests
cd backend && npm run test:load:smoke
```

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full instructions.

Quick deploy:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec app npx prisma migrate deploy
```

---

## Frontend Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@enquiry.dev | admin123 |
| Agent | agent@enquiry.dev | agent123 |
| Viewer | viewer@enquiry.dev | viewer123 |

---

## License

UNLICENSED — Private repository.
