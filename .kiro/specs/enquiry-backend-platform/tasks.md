# Implementation Plan: Enquiry Backend Platform

## Overview

This implementation plan breaks down the Enquiry Backend Platform into incremental coding tasks. The platform uses NestJS (TypeScript) for the backend, React (Vite) + Tailwind CSS for the frontend, PostgreSQL + Redis for data, BullMQ for queues, and a full observability stack. Tasks are ordered to build foundational layers first, then features, then cross-cutting concerns, and finally frontend and deployment.

## Tasks

- [x] 1. Set up backend project structure and core infrastructure
  - [x] 1.1 Initialize NestJS project with TypeScript, Prisma, Redis, and BullMQ dependencies
    - Create `backend/` directory with `nest new` scaffold
    - Install dependencies: `@nestjs/swagger`, `@prisma/client`, `prisma`, `ioredis`, `bullmq`, `@nestjs/bullmq`, `class-validator`, `class-transformer`, `helmet`, `nestjs-pino`, `pino-http`, `opossum`
    - Configure `tsconfig.json` with strict mode, path aliases
    - Set up `nest-cli.json` with Swagger plugin enabled
    - Create `backend/src/config/` module with env-based configuration using `@nestjs/config`
    - Create `backend/.env.example` with all required environment variables documented (DATABASE_URL, REDIS_URL, PORT, NODE_ENV, SWAGGER_ENABLED, LOG_LEVEL, HMAC_SECRET, API_KEYS, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CRM_WEBHOOK_URL, WORDPRESS_GRAPHQL_URL, CORS_ORIGINS, RATE_LIMIT_ENABLED)
    - Create `backend/.env.development` for local development defaults (pre-configured for Docker Compose services)
    - Add `.env` and `.env.production` to `.gitignore` (never commit secrets)
    - Configure `@nestjs/config` with `ConfigModule.forRoot()` using Joi validation schema to fail fast on missing/invalid env vars at startup
    - _Requirements: 35.1, 26.1_

  - [x] 1.2 Define Prisma schema with per-table migrations and PrismaService
    - Create base `backend/prisma/schema.prisma` with datasource (PostgreSQL), generator (prisma-client-js), and enum definitions only (EnquiryStatus, WebhookStatus)
    - Add Enquiry model with all fields and indexes (composite on email+propertyId+createdAt, status, createdAt) → run `npx prisma migrate dev --name create_enquiries_table`
    - Add WebhookEvent model with all fields and indexes (status, createdAt, unique eventId) → run `npx prisma migrate dev --name create_webhook_events_table`
    - Add optional relationship: `WebhookEvent.enquiryId` (nullable FK) → `Enquiry.id`, with `Enquiry.webhookEvents WebhookEvent[]` back-relation. Add `@@index([enquiryId])` on WebhookEvent for efficient relation queries.
    - Add Property model with all fields and indexes (slug, wpId unique) → run `npx prisma migrate dev --name create_properties_table`
    - Add AuditLog model with all fields and indexes (entity+entityId, createdAt, requestId) → run `npx prisma migrate dev --name create_audit_logs_table`
    - Each migration file should contain only the SQL for that specific table and its indexes, producing separate migration directories:
      - `prisma/migrations/<timestamp>_create_enquiries_table/migration.sql`
      - `prisma/migrations/<timestamp>_create_webhook_events_table/migration.sql`
      - `prisma/migrations/<timestamp>_create_properties_table/migration.sql`
      - `prisma/migrations/<timestamp>_create_audit_logs_table/migration.sql`
    - Create `PrismaService` extending `OnModuleInit` and `OnModuleDestroy` for lifecycle management
    - _Requirements: 1.1, 4.4, 8.4, 32.1_

  - [x] 1.3 Implement global API response envelope, exception filter, and request ID interceptor
    - Create `TransformInterceptor` that wraps all responses in `{ success: true, data, request_id, timestamp }`
    - Create `GlobalExceptionFilter` that maps exceptions to `ApiErrorResponse` with error codes enum
    - Create `RequestIdInterceptor` that generates UUID request IDs and attaches to response headers
    - Define `ApiErrorCode` enum with all codes from design (VALIDATION_ERROR, DUPLICATE_ENQUIRY, etc.)
    - _Requirements: 35.2, 35.3, 14.5_

  - [x] 1.4 Create BaseQueryDto and implement sanitization/validation pipes
    - Create `backend/src/common/dto/base-query.dto.ts` with reusable fields: cursor (string), limit (int, 1-100, default 20), search (string), dateFrom (ISO date), dateTo (ISO date), sortDir ('asc'|'desc', default 'desc')
    - Add `@ApiPropertyOptional` Swagger decorators and class-validator decorators on all BaseQueryDto fields
    - Create `SanitizationPipe` as global pipe: strip HTML tags, normalize email to lowercase, escape special chars, trim whitespace
    - Configure `ValidationPipe` globally with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
    - Ensure sanitization is idempotent: `sanitize(sanitize(x)) === sanitize(x)`
    - _Requirements: 1.6, 12.5, 12.6, 3.1, 3.3_

  - [x]* 1.5 Write property tests for sanitization pipeline
    - **Property 1: Sanitization Pipeline Idempotence and Correctness**
    - Use `fast-check` with `fc.string()` and `fc.emailAddress()` generators
    - Verify output contains no HTML tags, emails are lowercase, and `sanitize(sanitize(x)) === sanitize(x)`
    - **Validates: Requirements 1.6, 12.5**

  - [x] 1.6 Set up Swagger/OpenAPI documentation
    - Configure `DocumentBuilder` in `main.ts` with API title, description, version, API key security scheme
    - Enable Swagger UI at `/api/docs` gated by `SWAGGER_ENABLED` env var
    - Export OpenAPI spec at `/api/docs-json` and `/api/docs-yaml`
    - _Requirements: 35.1_

  - [x] 1.7 Configure global prefix, versioning, security headers, and CORS
    - Set global prefix `api` with health routes excluded
    - Enable URI versioning with default version `1`
    - Configure Helmet middleware for security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP)
    - Configure CORS with configurable origin allowlist from environment
    - Set body size limit to 1MB via express `json({ limit: '1mb' })`
    - Create `ContentTypeGuard` rejecting non-JSON Content-Type on API endpoints (returns 415)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 35.1_

- [x] 2. Implement Enquiry module (CRUD + validation + idempotency)
  - [x] 2.1 Create Enquiry DTOs with validation decorators and Swagger annotations
    - Create `CreateEnquiryDto` with class-validator decorators (@IsNotEmpty, @IsEmail, @IsString, @MaxLength, @IsBoolean)
    - Create `ListEnquiriesDto` extending `BaseQueryDto` with additional status enum filter and sortBy field
    - Create `EnquiryResponseDto` with @ApiProperty decorators for Swagger
    - Create `PaginatedEnquiryResponseDto` with pagination metadata type
    - _Requirements: 1.1, 1.2, 3.1, 3.3_

  - [x] 2.2 Implement EnquiryRepository with cursor pagination
    - Create `EnquiryRepository` class wrapping Prisma client
    - Implement `create(data)` method
    - Implement `findById(id)` method
    - Implement `findWithCursor(params)` with cursor encoding (base64 JSON of id+createdAt), limit, filters, sort
    - Implement `findDuplicate(email, propertyId, withinMinutes)` using createdAt comparison
    - Include pagination metadata: nextCursor, previousCursor, hasMore, totalCount
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.3 Implement EnquiryService with idempotency, duplicate detection, and transactional creation
    - Implement `create(dto, idempotencyKey?)`: check Redis for idempotency key → check duplicate (email+propertyId, 10 min) → wrap INSERT enquiry + audit_log INSERT in `Prisma.$transaction` (ReadCommitted isolation) → store idempotency key (24h TTL) → enqueue email + CRM jobs
    - Implement `findById(id)`: fetch from repository, throw NotFoundException if not found
    - Implement `findAll(params)`: delegate to repository with filter/sort/pagination
    - Inject `NotificationProducer` to enqueue confirmation + admin emails on creation
    - Inject `AuditService` to record creation within the same transaction
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 32.1_

  - [x] 2.4 Implement EnquiryController with Swagger decorators, ETag support, and @RateLimit() per route
    - POST /enquiry → create with optional Idempotency-Key header, @RateLimit({ limit: 10, window: 60, scope: 'ip' })
    - GET /enquiry/:id → findOne with ETag generation and If-None-Match 304 support, @RateLimit({ limit: 100, window: 60, scope: 'ip' })
    - GET /enquiries → findAll with query params (cursor, limit, status, dateFrom, dateTo, search, sort), @RateLimit({ limit: 60, window: 60, scope: 'ip' })
    - Add full Swagger decorators (@ApiOperation, @ApiResponse, @ApiHeader, @ApiQuery, @ApiParam)
    - Create `ETagInterceptor` that computes hash of response body and handles conditional requests
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 3.1, 3.3, 3.4, 3.5, 11.1, 35.1_

  - [x]* 2.5 Write property tests for enquiry validation
    - **Property 2: Enquiry Validation Rejects Invalid Input**
    - Use `fast-check` to generate partial/malformed enquiry objects
    - Verify 400 response with field-level errors for each invalid field
    - **Validates: Requirements 1.2, 4.6**

  - [x]* 2.6 Write property tests for duplicate detection and idempotency
    - **Property 3: Duplicate Detection Within Time Window**
    - Generate pairs of enquiries with time offsets, verify 409 within 10min and acceptance after 10min
    - **Property 4: Idempotency Key Produces Identical Responses**
    - Generate random UUIDs as keys, verify repeated requests return identical responses
    - **Validates: Requirements 1.3, 1.4, 4.5**

  - [x]* 2.7 Write property tests for cursor pagination, filtering, and sorting
    - **Property 6: Cursor Pagination Completeness and Non-Overlap**
    - Generate random datasets (1-200 records), iterate all pages, verify every record returned exactly once
    - **Property 7: Filtering Produces Strict Subsets**
    - Verify filtered results are subsets satisfying all predicates
    - **Property 8: Sort Ordering Invariant**
    - Verify consecutive items respect ordering constraint
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x]* 2.8 Write property test for enquiry creation round-trip
    - **Property 5: Enquiry Creation Round-Trip**
    - Generate valid payloads, create then fetch by ID, verify fields match sanitized input with status PENDING
    - **Validates: Requirements 1.1, 2.1**

  - [x]* 2.9 Write property test for ETag conditional response
    - **Property 12: ETag Conditional Response**
    - Verify unmodified resource with matching If-None-Match returns 304, modified resource returns 200 with new ETag
    - **Validates: Requirements 2.3, 17.5**

- [x] 3. Checkpoint - Core enquiry module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Webhook module (HMAC validation + API key auth + queue processing)

  - [x] 4.1 Implement HmacGuard and ApiKeyGuard
    - Create `HmacGuard` that validates X-Webhook-Signature header using HMAC-SHA256 with timing-safe comparison
    - Create `ApiKeyGuard` that validates X-API-Key header against configured active keys set
    - Support multiple active API keys for rotation without downtime
    - Return 401 for invalid HMAC, 403 for invalid/missing API key
    - _Requirements: 4.1, 4.2, 4.3, 13.1, 13.2, 13.3_

  - [x] 4.2 Implement WebhookService, WebhookRepository, and WebhookController with event listing
    - Create `WebhookPayloadDto` with schema validation
    - Create `ListWebhookEventsDto` extending `BaseQueryDto` with additional filters: status (WebhookStatus enum), type (string), source (string), sortBy ('createdAt'|'processedAt', default 'createdAt')
    - Create `WebhookRepository` for WebhookEvent CRUD with `findWithCursor(params)` supporting full pagination/search/filter/sort (search applies ILIKE on eventId, type, source)
    - Create `WebhookService.processEvent()`: check eventId deduplication → create WebhookEvent(RECEIVED) → enqueue to CRM queue
    - Create `WebhookService.findAll(params)`: delegate to repository with cursor pagination
    - Create `WebhookController` POST /webhook/crm with @UseGuards(ApiKeyGuard, HmacGuard) and @RateLimit({ limit: 200, window: 60, scope: 'apiKey' }), returns 202
    - Create `WebhookController` GET /webhook/events with @RateLimit({ limit: 60, window: 60, scope: 'ip' }) returning `PaginatedResponse<WebhookEventResponse>`
    - Handle duplicate eventId → return 200 without re-processing
    - Handle schema validation failure → return 422
    - Add full Swagger decorators for all responses including query params for the events list
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.3 Implement CRM webhook queue processor with retry, DLQ, and transactional status updates
    - Create `CrmSyncProcessor` as BullMQ processor for the CRM queue
    - Process webhook event: wrap status update + audit_log INSERT in `Prisma.$transaction` (ReadCommitted isolation) → update WebhookEvent status to PROCESSED on success
    - Configure retry: 3 attempts with exponential backoff (1s, 4s, 16s)
    - On exhaustion → move to DLQ, update WebhookEvent status to DEAD_LETTER with error message
    - Wrap CRM delivery call with opossum circuit breaker (timeout: 10s, errorThreshold: 50%, resetTimeout: 30s, volumeThreshold: 5)
    - Implement admin endpoint to retry DLQ jobs: POST /admin/queues/:name/retry/:jobId — wraps webhook_event status update + re-enqueue in `Prisma.$transaction` (ReadCommitted)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.1_

  - [x]* 4.4 Write property tests for HMAC and API key authentication
    - **Property 9: HMAC Signature Verification Correctness**
    - Generate random payloads + secrets, verify correct HMAC accepted and any mutation rejected
    - **Property 10: API Key Authentication Completeness**
    - Generate random strings vs valid key sets, verify only valid keys accepted
    - **Validates: Requirements 4.1, 4.2, 13.1, 13.2, 13.3**

  - [x]* 4.5 Write property test for exponential backoff
    - **Property 11: Exponential Backoff Calculation**
    - Generate integers 1-3, verify delay = 4^(n-1) seconds
    - **Validates: Requirements 5.2, 6.2, 7.2, 25.1**

- [x] 5. Implement Notification module (email + push queues)

  - [x] 5.1 Implement NotificationProducer and email/push queue setup
    - Create BullMQ queues: `email-queue`, `push-queue`, `crm-queue`
    - Create `NotificationProducer` service with methods: `enqueueConfirmationEmail`, `enqueueAdminNotification`, `enqueuePushNotification`
    - Configure job options with retry: 3 attempts, exponential backoff (1s, 4s, 16s)
    - _Requirements: 1.5, 6.1, 7.1_

  - [x] 5.2 Implement EmailWorker and PushWorker processors with circuit breakers
    - Create `EmailWorker` (@Processor('email-queue')): render email template, send via SMTP transport (or log in dev)
    - Wrap SMTP send call with opossum circuit breaker (timeout: 10s, errorThreshold: 50%, resetTimeout: 30s, volumeThreshold: 5)
    - Create `PushWorker` (@Processor('push-queue')): process push notification, record delivery timestamp
    - Handle failures: transient → retry, permanent (invalid data) → DLQ immediately
    - On circuit breaker OPEN: job remains in queue for retry after reset timeout (no DLQ for circuit-open failures)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 9.1_

- [x] 6. Implement Cache module with SWR and Redis degradation fallback
  - [x] 6.1 Implement CacheService with SWR strategy, in-memory LRU fallback, and graceful degradation
    - Create `CacheService` wrapping ioredis: get, set (with TTL + stale/expire thresholds), delete, invalidatePattern, pipeline
    - Implement SWR logic: fresh (<5min) → serve, stale (5-15min) → serve + background refresh, expired (>15min) → fetch fresh
    - Create `InMemoryLRUCache` class (max 1000 items, 60s TTL) as fallback
    - Implement automatic fallback: detect Redis connection failure → switch to in-memory → log degradation
    - Resume Redis when connectivity restored (within 10s detection)
    - Configure timeout for Redis operations: 2s for cache get/set and rate limit checks
    - Implement graceful degradation for BullMQ when Redis is down: queues paused, webhook events still persisted to DB (RECEIVED status), buffered jobs resume on reconnection
    - Expose `isHealthy()` method
    - _Requirements: 8.1, 8.2, 8.3, 20.1, 20.3_

  - [x]* 6.2 Write property tests for cache SWR and Redis degradation
    - **Property 13: Cache SWR State Machine**
    - Generate timestamps (0-1800s since cached), verify correct behavior per age bracket
    - **Property 21: Redis Degradation Fallback**
    - Test cache/rate-limit operations with Redis connected/disconnected, verify no client errors
    - **Validates: Requirements 8.1, 8.2, 8.3, 20.1, 20.2**

- [x] 7. Implement Property module (WordPress GraphQL + circuit breaker + DataLoader)

  - [x] 7.1 Implement circuit breaker factory and WordPressClient with circuit breaker
    - Create `createCircuitBreaker(name, options)` factory function using opossum with configurable timeouts per service
    - Create `WordPressClient` service using HTTP client to call WPGraphQL endpoint
    - Create circuit breakers for all external services with per-service timeout configuration:
      - `wordpressBreaker`: timeout 5s, errorThreshold 50%, resetTimeout 30s, volumeThreshold 5
      - `smtpBreaker`: timeout 10s, errorThreshold 50%, resetTimeout 30s, volumeThreshold 5
      - `crmBreaker`: timeout 10s, errorThreshold 50%, resetTimeout 30s, volumeThreshold 5
    - Implement state machine: CLOSED → OPEN (5 failures in 30s) → HALF-OPEN (after 30s) → CLOSED (probe success)
    - On OPEN state: serve cached data if available, else return 503 + Retry-After
    - Log all circuit state transitions as warnings and emit metrics
    - Export breaker instances for injection into EmailWorker, PushWorker, and CrmSyncProcessor
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 7.2 Implement PropertyResolver (GraphQL) with DataLoader, caching, and full search/sort support
    - Create GraphQL schema: `properties(first, after, search, sortBy, sortDir)` → PropertyConnection, `property(slug?, wpId?)` → Property
    - Define GraphQL enums: `PropertySortField { TITLE, CREATED_AT, CACHED_AT }`, `SortDirection { ASC, DESC }`
    - Create `PropertyConnectionArgs` with search (string, ILIKE on title/content/excerpt), sortBy (PropertySortField, default CACHED_AT), sortDir (SortDirection, default DESC)
    - Create `PropertyDataLoader` using DataLoader library to batch property resolution
    - Create `PropertyRepository.findWithCursor(params)` supporting search, sortBy, sortDir with cursor pagination against local DB
    - Integrate with `CacheService` for SWR caching of property data
    - Implement `PropertyCacheService` with property-specific key patterns
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.3 Implement property background sync job with batched transactions
    - Create repeatable BullMQ job running every 30 minutes
    - Fetch all properties from WPGraphQL, upsert into Property table using batched `Prisma.$transaction` (50 properties per batch, ReadCommitted isolation) to avoid long-running locks
    - Use `chunk(properties, 50)` utility to split into manageable batches
    - Update cachedAt timestamp on each upserted property
    - On failure: log with full context, retry on next scheduled interval
    - Create admin endpoint POST /admin/cache/invalidate → clear all property cache + trigger immediate sync
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x]* 7.4 Write property tests for circuit breaker and DataLoader
    - **Property 14: DataLoader Batching Invariant**
    - Generate sets of 1-50 IDs in same tick, verify at most 1 query resolves all
    - **Property 15: Circuit Breaker State Transitions**
    - Generate sequences of success/failure, verify state transitions per rules
    - **Validates: Requirements 8.6, 9.1, 9.2**

- [x] 8. Implement Rate Limiting module (tiered)

  - [x] 8.1 Implement Redis-backed rate limiting with @RateLimit() decorator and full per-endpoint matrix
    - Create `@RateLimit(config: RateLimitConfig)` custom decorator using `SetMetadata` with interface `{ limit: number; window: number; scope: 'ip' | 'apiKey' | 'user' }`
    - Create `RateLimitGuard` that reads `@RateLimit()` metadata at runtime and applies sliding-window algorithm using Redis sorted sets
    - Apply per-endpoint rate limits as defined in design:
      - POST /api/v1/enquiry → 10/min per IP
      - GET /api/v1/enquiry/:id → 100/min per IP
      - GET /api/v1/enquiries → 60/min per IP
      - POST /api/v1/webhook/crm → 200/min per API key
      - GET /api/v1/webhook/events → 60/min per IP
      - GET /api/v1/audit → 30/min per IP
      - GET /api/v1/gdpr/export/:email → 5/min per IP
      - DELETE /api/v1/gdpr/erase/:email → 3/min per IP
      - POST /admin/* → 30/min per IP
      - GET /admin/* → 60/min per IP
      - POST /graphql → 120/min per IP
    - Include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on all responses
    - Return 429 with Retry-After header when limit exceeded
    - Implement in-memory fallback when Redis unavailable (per-instance counter)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 20.2_

  - [x]* 8.2 Write property test for rate limiter
    - **Property 16: Rate Limiter Sliding Window Enforcement**
    - Generate request sequences over time, verify 429 above limit and correct header values
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 9. Checkpoint - Backend core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement Health, GDPR, Audit, and Backpressure modules

  - [x] 10.1 Implement Health module (liveness + readiness probes)
    - Create `HealthController` at /health/live (always 200) and /health/ready (checks DB + Redis + queues)
    - Exclude health routes from global API prefix and versioning
    - Return 503 with failing component details when any dependency unhealthy
    - _Requirements: 18.1, 18.2, 18.3_

  - [x]* 10.2 Write property test for health readiness
    - **Property 20: Health Readiness Conjunction**
    - Generate boolean tuples (pg, redis, queue), verify 200 only when all true, 503 with failing components otherwise
    - **Validates: Requirements 18.2, 18.3**

  - [x] 10.3 Implement Audit module with transactional logging and queryable list endpoint
    - Create `AuditService.logChange()` that records entity, entityId, action, before, after, performedBy, requestId — accepts optional `tx: PrismaTransaction` parameter to participate in caller's transaction
    - Create `AuditRepository` with `create(data, tx?)` method and `findWithCursor(params)` for paginated listing
    - Create `ListAuditLogsDto` extending `BaseQueryDto` with additional filters: entity (string), entityId (string), action ('CREATE'|'UPDATE'|'DELETE'), performedBy (string), sortBy ('createdAt', default 'createdAt'). Search applies ILIKE on entity, entityId, performedBy, requestId
    - Create `AuditController` GET /audit with @RateLimit({ limit: 30, window: 60, scope: 'ip' }) returning `PaginatedResponse<AuditLogResponse>`
    - Add full Swagger decorators (@ApiOperation, @ApiQuery for all filter params, @ApiResponse)
    - Write audit records within the same Prisma transaction as the mutating operation (transaction passed in)
    - Integrate with EnquiryService (create, update) and WebhookService (process)
    - _Requirements: 32.1, 32.2, 32.3_

  - [x]* 10.4 Write property test for audit log completeness
    - **Property 26: Audit Log Completeness**
    - Perform create/update/delete operations, verify AuditLog records with correct entity, action, before/after, requestId
    - **Validates: Requirements 31.3, 32.1**

  - [x] 10.5 Implement GDPR module (paginated export + Serializable erasure transaction)
    - Create `GdprExportQueryDto` with cursor (string), limit (int, 1-100, default 50), entity ('enquiry'|'audit'|'all', default 'all')
    - Create `GdprController` GET /gdpr/export/:email with @RateLimit({ limit: 5, window: 60, scope: 'ip' }) → return paginated `PaginatedResponse<GdprRecord>` for email, supporting cursor pagination across enquiry + audit records
    - Create `GdprController` DELETE /gdpr/erase/:email with @RateLimit({ limit: 3, window: 60, scope: 'ip' }) → anonymize all records using `Prisma.$transaction` with **Serializable** isolation level (enquiry + webhook_event + audit_log updates wrapped atomically to prevent concurrent PII reads during anonymization)
    - Record erasure in audit log within the same Serializable transaction
    - Add Swagger decorators including @ApiQuery for cursor, limit, entity params
    - _Requirements: 31.1, 31.2, 31.3_

  - [x]* 10.6 Write property tests for GDPR export and erasure
    - **Property 24: GDPR Export Completeness**
    - Generate emails with 0-N records, verify export returns all
    - **Property 25: GDPR Erasure Completeness**
    - After erasure, verify no PII retrievable for that email
    - **Validates: Requirements 31.1, 31.2**

  - [x] 10.7 Implement load shedding interceptor with event loop monitoring
    - Create `EventLoopMonitor` service sampling lag every 1s
    - Create `LoadSheddingInterceptor`: reject with 503 + Retry-After when lag > 200ms, resume when lag < 100ms (hysteresis)
    - Export `event_loop_lag_seconds` gauge metric
    - _Requirements: 33.1, 33.2_

  - [x]* 10.8 Write property test for load shedding
    - **Property 22: Load Shedding Decision Function**
    - Generate lag values 0-500ms, verify rejection above 200ms and recovery below 100ms with hysteresis
    - **Validates: Requirements 33.1**

  - [x] 10.9 Implement graceful shutdown service and timeout configuration
    - Create `GracefulShutdownService` implementing `OnModuleDestroy`
    - Stop accepting connections → pause queues → drain in-flight (30s) → disconnect DB → quit Redis
    - Configure Docker `stop_grace_period: 35s` and PM2 `kill_timeout: 30000`
    - Configure application-wide timeout constants:
      - Database queries (default): 5s
      - Database queries (complex/reports/GDPR export): 30s
      - Redis operations: 2s
      - WordPress GraphQL: 5s (via circuit breaker)
      - SMTP send: 10s (via circuit breaker)
      - CRM webhook delivery: 10s (via circuit breaker)
      - Internal HTTP (health probes): 3s
      - Prisma transaction timeout: 10s
      - HTTP request (Nginx proxy): 30s
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 10.10 Implement data retention job
    - Create repeatable BullMQ maintenance job running nightly at 3am
    - Archive enquiries older than 2 years (status → ARCHIVED)
    - Delete processed webhook events older than 90 days
    - Clean completed queue jobs older than 30 days
    - _Requirements: 34.3_

- [x] 11. Implement Observability module
  - [x] 11.1 Set up OpenTelemetry SDK with Prometheus exporter and trace exporter
    - Create `backend/src/observability/tracing.ts` loaded before NestJS bootstrap
    - Configure NodeSDK with auto-instrumentations (HTTP, PostgreSQL, Redis)
    - Set up PrometheusExporter on port 8081
    - Set up OTLP trace exporter pointing to Tempo
    - Configure pino logger with trace correlation (traceId, spanId in every log line)
    - Configure PII redaction in logs (email, phone, Authorization)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 11.2 Implement custom metrics and slow query detection
    - Create `MetricsService` with counters: enquiry_created_total, cache_hit_total, cache_miss_total, rate_limit_triggered_total, webhook_received_total
    - Add histograms: http_request_duration_seconds, queue_job_duration_seconds, db_query_duration_seconds
    - Add gauges: queue_depth, db_pool_active_connections, event_loop_lag_seconds
    - Create Prisma middleware that logs queries > 500ms at warn level
    - _Requirements: 14.2, 14.3, 14.4, 17.3_

  - [x]* 11.3 Write property tests for security headers and error response format
    - **Property 17: Security Headers Present on All Responses**
    - Verify X-Content-Type-Options, X-Frame-Options, HSTS, CSP on various responses
    - **Property 18: Content-Type Enforcement**
    - Generate random MIME types, verify 415 for non-JSON
    - **Property 19: CORS Origin Allowlist**
    - Generate random origins, verify CORS headers only for allowlisted
    - **Property 23: Structured Error Response Format**
    - Generate various exception types, verify response contains required fields
    - **Validates: Requirements 12.1, 12.2, 12.3, 14.5, 35.2, 35.3**

- [x] 12. Implement Admin module (Bull Board + queue management)

  - [x] 12.1 Implement Bull Board integration and admin endpoints with full DLQ query support
    - Mount Bull Board UI at /admin/queues with all registered queues
    - Create `ListDlqJobsDto` extending `BaseQueryDto` with additional filters: queueName ('email'|'push'|'crm'), sortBy ('failedAt'|'attemptsMade', default 'failedAt'). Search applies ILIKE on error message and serialized job data
    - Create admin endpoints:
      - GET /admin/queues/stats → queue statistics (single object, not paginated)
      - GET /admin/queues/dlq with full `ListDlqJobsDto` query support (cursor pagination, search, filter by queue, sort by failedAt/attemptsMade) with @RateLimit({ limit: 60, window: 60, scope: 'ip' })
      - POST /admin/queues/:name/retry/:jobId with @RateLimit({ limit: 30, window: 60, scope: 'ip' })
      - POST /admin/queues/:name/pause with @RateLimit({ limit: 30, window: 60, scope: 'ip' })
      - POST /admin/queues/:name/resume with @RateLimit({ limit: 30, window: 60, scope: 'ip' })
    - Restrict access with admin authentication guard
    - Add Swagger decorators including @ApiQuery for DLQ listing params
    - _Requirements: 36.1, 36.2, 5.4, 24.1, 24.2, 24.3_

- [x] 13. Checkpoint - Backend fully implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Set up frontend project structure

  - [x] 14.1 Initialize React + Vite + TypeScript project with dependencies
    - Create `frontend/` directory with Vite React-TS template
    - Install: `@tanstack/react-query`, `@apollo/client`, `graphql`, `axios`, `react-router-dom`, `react-hook-form`, `tailwindcss`
    - Configure Tailwind CSS
    - Configure path aliases in `tsconfig.json` and `vite.config.ts`
    - Set up ESLint + Prettier configuration
    - Create `frontend/.env.example` with frontend environment variables (VITE_API_BASE_URL, VITE_GRAPHQL_URL)
    - Create `frontend/.env.development` with defaults pointing to local backend
    - _Requirements: 21.1, 23.1_

  - [x] 14.2 Implement frontend providers (QueryClient, Apollo, UI, Auth)
    - Create `QueryProvider.tsx` with React Query client (staleTime: 30s, gcTime: 5min, retry: 2)
    - Create `ApolloProvider.tsx` with InMemoryCache and type policies for properties pagination
    - Create `UIProvider.tsx` with toast notification context (success, error, warning)
    - Set up provider nesting order: QueryClient → Apollo → Auth → UI → Router
    - _Requirements: 21.1, 23.1_

  - [x] 14.3 Implement API client service layer
    - Create `frontend/src/services/api/client.ts`: Axios instance with base URL, timeout (15s), auth interceptor, response unwrapper, retry with backoff (3 attempts, 4^n seconds), auto Idempotency-Key on POST
    - Create `frontend/src/services/api/types.ts`: ApiResponse<T>, PaginatedResponse<T>, NormalizedApiError
    - Create typed API modules: `enquiry.api.ts`, `property.api.ts`, `webhook.api.ts`, `health.api.ts`, `gdpr.api.ts`, `admin.api.ts`, `audit.api.ts`
    - Create barrel export `index.ts`
    - _Requirements: 25.1, 21.1_

- [x] 15. Implement frontend authentication and routing

  - [x] 15.1 Implement static auth system with roles and permissions
    - Create `frontend/src/auth/users.ts` with StaticUser interface, UserRole enum, Permission enum, and 3 static users (admin, agent, viewer)
    - Create `AuthContext.tsx` with login, logout, hasPermission, hasRole; store session in localStorage
    - Create `ProtectedRoute.tsx` component: redirect to /login if unauthenticated, /unauthorized if missing permission
    - Create `PermissionGate.tsx` component: conditionally render children based on permission
    - _Requirements: 36.2_

  - [x] 15.2 Implement LoginPage and route configuration
    - Create `LoginPage.tsx`: email + password form, validate against STATIC_USERS, redirect on success, show test credentials hint
    - Create `UnauthorizedPage.tsx`: message + back button
    - Set up React Router with all routes per role→page access matrix in design
    - Implement code splitting with `React.lazy()` for property and admin routes
    - _Requirements: 23.3, 36.2_

- [x] 16. Implement frontend pages

  - [x] 16.1 Implement EnquiryFormPage with validation and resilience
    - Create enquiry form with all fields (name, email, phone, propertyId, propertyTitle, message, source, consent)
    - Use `react-hook-form` with client-side validation matching backend rules
    - Integrate with `enquiryApi.create()` via `useCreateEnquiry` mutation hook
    - Handle responses: 201 → success toast, 409 → duplicate warning, 429 → countdown timer
    - Pre-fill propertyId and propertyTitle from URL params
    - _Requirements: 21.1, 21.2, 21.3, 21.4_

  - [x] 16.2 Implement form state persistence hook
    - Create `usePersistedForm` hook: debounced localStorage save (500ms), restore on mount with "Continue where you left off?" prompt
    - Clear persisted state on successful submission
    - Integrate with EnquiryFormPage
    - _Requirements: 21.5_

  - [x]* 16.3 Write property test for form state persistence
    - **Property 27: Frontend Form State Persistence Round-Trip**
    - Generate arbitrary form state objects, verify localStorage write/read round-trip preserves values
    - **Validates: Requirements 21.5**

  - [x] 16.4 Implement PropertyListPage and PropertyDetailPage
    - Create `PropertyListPage.tsx`: fetch properties via Apollo Client GraphQL query, display as cards with skeleton loading, "Load More" button for pagination
    - Create `PropertyDetailPage.tsx`: fetch single property by slug, display full details with "Make Enquiry" button linking to form
    - Handle circuit breaker open state: show "Properties temporarily unavailable" fallback
    - _Requirements: 23.1, 23.2_

  - [x] 16.5 Implement AdminDashboardPage with enquiry listing
    - Create `AdminDashboardPage.tsx`: paginated enquiry list with cursor pagination
    - Implement filters (status, date range, search) updating URL search params
    - Display status badges with distinct styling per status
    - Auto-refresh every 30s using React Query's refetchInterval
    - _Requirements: 22.1, 22.2, 22.3, 22.4_

  - [x] 16.6 Implement QueueDashboardPage and GdprToolsPage
    - Create `QueueDashboardPage.tsx`: display queue metrics, retry/pause/resume controls
    - Create `GdprToolsPage.tsx`: email input → export data or erase data with confirmation dialog
    - _Requirements: 24.1, 24.2, 24.3, 31.1, 31.2_

- [x] 17. Implement frontend resilience features

  - [x] 17.1 Implement offline detection, offline queue, and error boundaries
    - Create `useOnlineStatus` hook tracking navigator.onLine + window events
    - Create `OfflineQueue` class: localStorage-backed queue with enqueue, flush, getPendingCount
    - Create `OfflineBanner.tsx`: shows when offline with pending count, auto-flushes on reconnect
    - Create `ErrorBoundary.tsx`: per-page-section error isolation with retry button
    - Wire offline queue into enquiry form: queue submissions when offline, auto-flush on restore
    - _Requirements: 25.1, 25.2, 25.3_

  - [x]* 17.2 Write property test for offline queue
    - **Property 28: Frontend Offline Queue Round-Trip**
    - Generate enquiry payloads, verify enqueue → persist → flush sends to API correctly
    - **Validates: Requirements 25.3**

  - [x] 17.3 Implement request cancellation and loading states
    - Create `useApiData` hook with AbortController for request cancellation on unmount
    - Create `SkeletonLoader.tsx` component matching final layout dimensions
    - Ensure every data-fetching component has loading (skeleton), success, and error states
    - _Requirements: 25.1, 25.2_

- [x] 18. Checkpoint - Frontend fully implemented
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Docker, Nginx, and deployment configuration

  - [x] 19.1 Create Dockerfiles and Docker Compose configurations
    - Create `backend/Dockerfile` (multi-stage: builder + production, non-root user, HEALTHCHECK)
    - Create `frontend/Dockerfile` (multi-stage: builder + nginx serving dist)
    - Create root `docker-compose.yml` (dev): app, postgres:15, redis:7, wordpress+mysql, prometheus, grafana, loki, tempo
    - Create root `docker-compose.prod.yml` (production overlay): resource limits, restart policies, volume mounts
    - Create `backend/ecosystem.config.js` for PM2 cluster mode
    - _Requirements: 26.1, 26.2, 26.3_

  - [x] 19.2 Create Nginx configuration
    - Create `nginx/nginx.conf` with: SSL (Let's Encrypt paths), rate limiting (L1), security headers, gzip compression, SPA fallback, API proxy, GraphQL proxy, asset caching (immutable)
    - Configure upstream health checks and keepalive connections
    - HTTP → HTTPS redirect on port 80
    - _Requirements: 26.4, 27.1, 12.1, 17.2_

  - [x] 19.3 Create operational scripts
    - Create `scripts/backup.sh`: pg_dump with compression, retention (7 daily, 4 weekly, 3 monthly)
    - Create `scripts/restore.sh`: gunzip + psql restore
    - Create `scripts/harden-vps.sh`: non-root user, SSH hardening (port 2222, key-only, MaxAuthTries 3), UFW (80,443,2222), fail2ban, unattended-upgrades
    - Create `scripts/setup-ssl.sh`: certbot Let's Encrypt provisioning with auto-renewal
    - _Requirements: 27.1, 27.2, 34.1, 34.2_

- [x] 20. Observability stack configuration and dashboards

  - [x] 20.1 Create Prometheus, Grafana, Loki, and Tempo configurations
    - Create `observability/prometheus/prometheus.yml` with scrape configs for app (:8081), redis-exporter, postgres-exporter
    - Create `observability/prometheus/alerts.yml` with all alert rules (HighErrorRate, DLQGrowing, HighLatency, DBConnectionExhaustion, RedisMemoryHigh, EventLoopLag, ContainerRestart, DiskSpaceHigh)
    - Create `observability/loki/` and `observability/tempo/` base configs
    - Create `observability/grafana/provisioning/datasources/datasources.yml` with Prometheus, Loki, Tempo correlation
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 20.2 Create Grafana dashboard JSON files
    - Create `observability/grafana/dashboards/api-performance.json` (request rate, latency percentiles, error rate, status codes)
    - Create `observability/grafana/dashboards/system-health.json` (CPU, memory, event loop lag, DB connections)
    - Create `observability/grafana/dashboards/queue-monitor.json` (per-queue depth, throughput, DLQ)
    - Create `observability/grafana/dashboards/business-metrics.json` (enquiries/hour, source breakdown, SLO tracking)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 21. CI/CD pipelines and security scanning

  - [x] 21.1 Create backend CI/CD pipeline
    - Create `backend/.github/workflows/backend-ci.yml` with gates: lint (ESLint + security plugin + tsc + Prettier + gitleaks), unit tests (Jest --coverage, ≥80%), integration tests (Supertest + real DB/Redis), Docker build + Trivy scan + npm audit, deploy + smoke tests, k6 load test
    - Configure path triggers: `backend/**`, `docker-compose*.yml`
    - Implement auto-rollback on smoke test failure
    - _Requirements: 28.1, 28.2, 29.1, 29.2, 29.4_

  - [x] 21.2 Create frontend CI/CD pipeline
    - Create `frontend/.github/workflows/frontend-ci.yml` with gates: lint + type check, Vitest component tests (≥75%), Playwright E2E, production build + bundle analysis + Trivy, deploy static assets, smoke
    - Configure path triggers: `frontend/**`
    - Set bundle budgets: total JS < 500KB gzipped, largest chunk < 200KB
    - _Requirements: 28.1, 29.2_

  - [x] 21.3 Create Dependabot config and weekly security scan workflow
    - Create `.github/dependabot.yml` for backend and frontend npm + Docker ecosystems
    - Create `.github/workflows/security-weekly.yml`: full Trivy + npm audit, generate SECURITY_REPORT.md, create Issue on findings
    - Create `scripts/generate-security-report.ts` aggregating scan results
    - _Requirements: 28.3, 28.4, 29.2, 29.5_

- [x] 22. Backend integration tests and regression tests

  - [x] 22.1 Write backend integration tests (Supertest + real DB/Redis)
    - Create `backend/test/integration/setup/` with NestJS testing module factory and global setup (Docker containers + migrations)
    - Write `enquiry.integration.spec.ts`: full CRUD flow, pagination, idempotency, duplicate detection, ETag
    - Write `webhook.integration.spec.ts`: HMAC validation, API key auth, event deduplication, queue processing
    - Write `queue.integration.spec.ts`: job processing, retry, DLQ, admin retry
    - Write `rate-limit.integration.spec.ts`: sliding window enforcement, header values, IP isolation
    - Write `cache.integration.spec.ts`: SWR behavior, TTL, pipeline, invalidation
    - _Requirements: 30.2_

  - [x] 22.2 Write backend regression tests
    - Write `sql-injection.spec.ts`: verify parameterized queries block injection in all fields
    - Write `xss-prevention.spec.ts`: verify HTML stripped from all inputs
    - Write `prototype-pollution.spec.ts`: verify __proto__ payloads blocked
    - Write `oversized-payload.spec.ts`: verify 413 for oversized bodies
    - Write `race-condition.spec.ts`: 10 concurrent identical POSTs → exactly 1 created
    - _Requirements: 30.2, 12.5, 12.6_

  - [x] 22.3 Write backend smoke test suite
    - Create `backend/test/smoke/` with 10 sequential checks per design (health, create enquiry, retrieve, list, webhook, GraphQL, frontend, metrics, rate-limit headers, safe errors)
    - Configurable base URL via SMOKE_BASE_URL env var
    - Exit code 0/non-zero for CI gate
    - _Requirements: 30.5_

- [x] 23. Frontend tests

  - [x] 23.1 Write frontend component tests (Vitest + React Testing Library)
    - Write tests for: LoginPage, EnquiryFormPage, PropertyListPage, AdminDashboardPage
    - Write tests for: AuthContext, ProtectedRoute, PermissionGate
    - Write tests for: useOnlineStatus, usePersistedForm, useEnquiries hooks
    - Write tests for: ApiClient (interceptors, retry, error handling), OfflineQueue
    - Write tests for: ErrorBoundary, OfflineBanner, SkeletonLoader components
    - Configure Vitest with jsdom environment and coverage thresholds (≥75% lines)
    - _Requirements: 30.1_

  - [x] 23.2 Write Playwright E2E tests
    - Create `frontend/test/e2e/enquiry-flow.spec.ts`: full submission flow
    - Create `frontend/test/e2e/auth-flow.spec.ts`: login, role-based access, logout
    - Create `frontend/test/e2e/property-browsing.spec.ts`: list, paginate, detail
    - Create `frontend/test/e2e/resilience.spec.ts`: offline queue, error states, retry
    - Configure Playwright with Chromium + mobile viewport projects
    - _Requirements: 30.3_

- [x] 24. Load tests and performance documentation

  - [x] 24.1 Write k6 load test scenarios
    - Create `backend/test/k6/scenarios/smoke.js` (5 VUs, 1 min)
    - Create `backend/test/k6/scenarios/stress.js` (0 → 200 VUs, 10 min)
    - Create `backend/test/k6/scenarios/spike.js` (10 → 500 → 10 VUs, 5 min)
    - Create `backend/test/k6/scenarios/soak.js` (50 VUs, 30 min)
    - Create helpers: `api-client.js`, `test-data.js` (random payload generators)
    - Define thresholds: p95 < 500ms, error rate < 1%
    - _Requirements: 30.4_

- [x] 25. Documentation and final wiring

  - [x] 25.1 Create operational documentation
    - Create `docs/RUNBOOK.md` with incident response procedures for each alert rule, scaling procedures, backup restoration, rollback steps
    - Create `docs/DEPLOYMENT.md` with VPS setup, Docker deployment, SSL, environment variables
    - Create `docs/PERFORMANCE.md` with optimization documentation (N+1→DataLoader, OFFSET→cursor, pipeline, gzip, ETag)
    - Create `docs/API.md` with links to Swagger UI and OpenAPI spec export
    - Create `docs/ENVIRONMENT.md` documenting every environment variable across backend and frontend: name, description, required/optional, default value, example
    - Create root `README.md` with project overview, architecture diagram reference, tech stack, prerequisites, local development setup instructions (Docker Compose), API documentation links, project structure overview, and deployment guide reference
    - _Requirements: 37.1, 37.2_

  - [x] 25.2 Wire everything together and verify end-to-end
    - Verify all NestJS modules are imported in AppModule
    - Verify all guards, interceptors, pipes registered globally in main.ts
    - Verify Docker Compose brings up full stack (app, postgres, redis, wordpress, nginx, observability)
    - Verify frontend builds and serves through Nginx
    - Verify health endpoints work with all services connected
    - _Requirements: 26.2, 18.1, 18.2_

- [x] 26. Final checkpoint - Full platform operational
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend and frontend are completely isolated applications with independent dependencies and CI/CD
- TypeScript is used throughout (NestJS backend + React frontend)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.6"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.7"] },
    { "id": 3, "tasks": ["1.5", "2.1", "14.1"] },
    { "id": 4, "tasks": ["2.2", "14.2", "14.3"] },
    { "id": 5, "tasks": ["2.3", "5.1", "6.1", "15.1"] },
    { "id": 6, "tasks": ["2.4", "4.1", "5.2", "7.1", "15.2"] },
    { "id": 7, "tasks": ["2.5", "2.6", "4.2", "6.2", "7.2", "8.1"] },
    { "id": 8, "tasks": ["2.7", "2.8", "2.9", "4.3", "7.3", "7.4", "8.2"] },
    { "id": 9, "tasks": ["4.4", "4.5", "10.1", "10.3", "10.7", "16.1", "16.2"] },
    { "id": 10, "tasks": ["10.2", "10.4", "10.5", "10.8", "10.9", "10.10", "16.3", "16.4"] },
    { "id": 11, "tasks": ["10.6", "11.1", "11.2", "12.1", "16.5", "16.6"] },
    { "id": 12, "tasks": ["11.3", "17.1", "17.3"] },
    { "id": 13, "tasks": ["17.2", "19.1", "19.2", "19.3"] },
    { "id": 14, "tasks": ["20.1", "20.2"] },
    { "id": 15, "tasks": ["21.1", "21.2", "21.3"] },
    { "id": 16, "tasks": ["22.1", "22.2", "22.3", "23.1"] },
    { "id": 17, "tasks": ["23.2", "24.1"] },
    { "id": 18, "tasks": ["25.1", "25.2"] }
  ]
}
```
