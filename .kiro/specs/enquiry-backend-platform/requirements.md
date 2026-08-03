# Requirements Document

## Introduction

This document defines the requirements for the Property Platform Backend — a production-ready, API-driven system that receives property enquiries, integrates with CRM systems via webhooks, serves WordPress content through GraphQL, and delivers push/email notifications. The platform is built with NestJS, PostgreSQL, Redis, and BullMQ, and is designed for high-volume traffic, security, observability, and resilience.

## Glossary

- **Platform**: The complete enquiry backend platform system including API server, queue workers, and supporting infrastructure
- **Enquiry_API**: The REST API module responsible for creating, retrieving, and listing property enquiries
- **Webhook_Handler**: The module responsible for receiving, validating, and processing CRM webhook events
- **Queue_Processor**: The BullMQ-based asynchronous job processing system handling email, push notifications, and CRM events
- **WordPress_Client**: The GraphQL client that fetches property data from the WordPress WPGraphQL endpoint
- **Cache_Layer**: The Redis-based caching system implementing stale-while-revalidate strategy
- **Circuit_Breaker**: The opossum-based resilience component that prevents cascading failures from external service calls
- **Rate_Limiter**: The tiered rate limiting system combining Nginx and NestJS Throttler with Redis backing
- **Sanitization_Pipeline**: The input processing chain that strips HTML, normalizes emails, and escapes special characters
- **DataLoader**: The batching utility that prevents N+1 query problems in GraphQL resolvers
- **Observability_Stack**: The monitoring infrastructure comprising OpenTelemetry, Prometheus, Grafana, Loki, and Tempo
- **DLQ**: Dead Letter Queue — storage for failed jobs that have exhausted all retry attempts
- **Idempotency_Key**: A client-provided unique identifier ensuring duplicate requests produce the same result
- **SWR**: Stale-While-Revalidate — a caching strategy that serves stale content while refreshing in the background
- **Cursor**: An opaque token used for cursor-based pagination that references the position in a result set
- **HMAC_Validator**: The component that verifies webhook authenticity using HMAC-SHA256 signatures
- **Health_Monitor**: The component exposing liveness and readiness probe endpoints
- **Audit_Logger**: The component that records entity changes with before/after state for compliance

---

## Requirements

### Requirement 1: Enquiry Creation

**User Story:** As a property seeker, I want to submit an enquiry about a property, so that the property agent receives my contact details and message.

#### Acceptance Criteria

1. WHEN a valid POST request is received at /api/v1/enquiry with name, email, phone, propertyId, propertyTitle, message, source, and consentGiven fields, THE Enquiry_API SHALL create an Enquiry record with status PENDING and return a 201 response containing the enquiry ID and creation timestamp.
2. WHEN a POST request is received with missing or invalid required fields, THE Enquiry_API SHALL return a 400 response with a structured error object containing field-level validation messages and a request ID.
3. WHEN a POST request is received with an email and propertyId combination that matches an existing enquiry created within the previous 10 minutes, THE Enquiry_API SHALL return a 409 response indicating a duplicate enquiry was detected.
4. WHEN a POST request includes an Idempotency-Key header matching a previously processed request, THE Enquiry_API SHALL return the same response as the original request without creating a new record.
5. WHEN an enquiry is successfully created, THE Queue_Processor SHALL enqueue an email confirmation job for the submitter and an email notification job for the property admin.
6. THE Sanitization_Pipeline SHALL strip HTML tags from the message field, normalize the email to lowercase, and escape special characters in all string inputs before persistence.

### Requirement 2: Enquiry Retrieval

**User Story:** As a property admin, I want to retrieve individual enquiries by ID, so that I can review enquiry details.

#### Acceptance Criteria

1. WHEN a GET request is received at /api/v1/enquiry/:id with a valid enquiry ID, THE Enquiry_API SHALL return a 200 response containing the full enquiry record.
2. WHEN a GET request is received at /api/v1/enquiry/:id with a non-existent ID, THE Enquiry_API SHALL return a 404 response with a structured error containing a request ID.
3. THE Enquiry_API SHALL support ETag headers on enquiry responses so that subsequent requests with matching If-None-Match headers receive a 304 Not Modified response.

### Requirement 3: Enquiry Listing with Pagination

**User Story:** As a property admin, I want to list enquiries with pagination, filtering, and sorting, so that I can efficiently manage large volumes of enquiries.

#### Acceptance Criteria

1. WHEN a GET request is received at /api/v1/enquiries, THE Enquiry_API SHALL return a paginated response using cursor-based pagination with a default page size of 20 and a configurable limit up to 100.
2. WHEN a cursor query parameter is provided, THE Enquiry_API SHALL return results starting after the referenced position.
3. WHERE status, dateFrom, dateTo, or search filter parameters are provided, THE Enquiry_API SHALL apply the corresponding filters to the result set.
4. WHERE a sort parameter is provided with field and direction, THE Enquiry_API SHALL order results accordingly, defaulting to createdAt descending.
5. THE Enquiry_API SHALL include nextCursor, previousCursor, and hasMore fields in the pagination metadata of list responses.

### Requirement 4: CRM Webhook Reception

**User Story:** As a system integrator, I want to send CRM events to the platform via webhooks, so that enquiry statuses and property data stay synchronized.

#### Acceptance Criteria

1. WHEN a POST request is received at /api/v1/webhook/crm with a valid HMAC-SHA256 signature in the X-Webhook-Signature header, THE Webhook_Handler SHALL accept the event for processing.
2. WHEN a POST request is received at /api/v1/webhook/crm with an invalid or missing HMAC signature, THE Webhook_Handler SHALL return a 401 response and log the rejection.
3. WHEN a POST request is received at /api/v1/webhook/crm without a valid API key in the X-API-Key header, THE Webhook_Handler SHALL return a 403 response.
4. WHEN a valid webhook event is received, THE Webhook_Handler SHALL create a WebhookEvent record with status RECEIVED and enqueue the event for asynchronous processing via BullMQ.
5. WHEN a webhook event with a previously seen eventId is received, THE Webhook_Handler SHALL return a 200 response without re-processing the event.
6. WHEN a webhook payload fails schema validation, THE Webhook_Handler SHALL return a 422 response with validation error details.

### Requirement 5: Webhook Queue Processing

**User Story:** As a platform operator, I want webhook events to be processed asynchronously with retry logic, so that transient failures do not result in data loss.

#### Acceptance Criteria

1. WHEN a webhook job is dequeued, THE Queue_Processor SHALL process the event and update the WebhookEvent status to PROCESSED upon success.
2. IF a webhook job fails during processing, THEN THE Queue_Processor SHALL retry the job up to 3 times with exponential backoff delays of 1 second, 4 seconds, and 16 seconds.
3. IF a webhook job fails after exhausting all 3 retry attempts, THEN THE Queue_Processor SHALL move the job to the DLQ and update the WebhookEvent status to DEAD_LETTER with the error message recorded.
4. WHEN an admin sends a POST request to the DLQ retry endpoint, THE Queue_Processor SHALL re-enqueue the specified dead-letter job for reprocessing.

### Requirement 6: Email Notification Processing

**User Story:** As a property seeker, I want to receive a confirmation email after submitting an enquiry, so that I know my enquiry was received.

#### Acceptance Criteria

1. WHEN an email job is dequeued from the notification queue, THE Queue_Processor SHALL send the email using the configured SMTP transport and mark the job as completed.
2. IF an email job fails, THEN THE Queue_Processor SHALL retry up to 3 times with exponential backoff before moving the job to the DLQ.
3. WHEN an enquiry is created, THE Queue_Processor SHALL send a confirmation email to the enquirer containing the enquiry reference and property title.
4. WHEN an enquiry is created, THE Queue_Processor SHALL send a notification email to the configured admin address containing the enquiry details.

### Requirement 7: Push Notification Processing

**User Story:** As a platform user, I want to receive push notifications for CRM events, so that I am alerted to status changes in real time.

#### Acceptance Criteria

1. WHEN a CRM event triggers a push notification, THE Queue_Processor SHALL enqueue a push notification job with the event payload and recipient details.
2. IF a push notification job fails, THEN THE Queue_Processor SHALL retry up to 3 times with exponential backoff before moving the job to the DLQ.
3. WHEN a push notification job is processed successfully, THE Queue_Processor SHALL record the delivery timestamp on the job metadata.

### Requirement 8: WordPress Property Fetching via GraphQL

**User Story:** As a frontend developer, I want to fetch property listings via GraphQL from the platform, so that I can render property pages without direct WordPress coupling.

#### Acceptance Criteria

1. WHEN a GraphQL query for properties is received, THE Platform SHALL resolve property data from the Cache_Layer if a valid cached entry exists.
2. WHEN cached property data is older than 5 minutes but within the 15-minute grace period, THE Cache_Layer SHALL serve the stale data and trigger a background refresh.
3. WHEN cached property data is older than the 15-minute grace period, THE WordPress_Client SHALL fetch fresh data from WPGraphQL before responding.
4. THE Platform SHALL expose a GraphQL schema with a properties query supporting cursor-based pagination with first and after arguments.
5. THE Platform SHALL expose a GraphQL schema with a property query accepting a slug or wpId argument to fetch individual properties.
6. THE DataLoader SHALL batch property resolution queries to prevent N+1 database queries when resolving nested relationships.

### Requirement 9: WordPress Circuit Breaker

**User Story:** As a platform operator, I want WordPress calls to be protected by a circuit breaker, so that WordPress downtime does not cascade to the platform.

#### Acceptance Criteria

1. WHILE the Circuit_Breaker is in open state, THE WordPress_Client SHALL serve cached data without attempting WordPress requests and log the circuit state.
2. WHEN the WordPress_Client experiences 5 consecutive failures within 30 seconds, THE Circuit_Breaker SHALL transition to open state.
3. WHEN the Circuit_Breaker has been open for 30 seconds, THE Circuit_Breaker SHALL transition to half-open state and allow a single probe request.
4. WHEN a probe request succeeds in half-open state, THE Circuit_Breaker SHALL transition to closed state and resume normal operation.
5. IF the Circuit_Breaker is open and no cached data is available, THEN THE WordPress_Client SHALL return a 503 response with a Retry-After header.

### Requirement 10: Property Background Sync

**User Story:** As a platform operator, I want property data to be periodically synchronized from WordPress, so that the local Property table remains current.

#### Acceptance Criteria

1. THE Platform SHALL execute a background sync job every 30 minutes that fetches all properties from WPGraphQL and upserts them into the Property table.
2. WHEN the sync job completes, THE Platform SHALL update the cachedAt timestamp on each synced Property record.
3. IF the sync job fails, THEN THE Platform SHALL log the error with full context and retry on the next scheduled interval without blocking other operations.
4. WHEN an admin sends a POST request to the cache invalidation endpoint, THE Cache_Layer SHALL clear all property cache entries and trigger an immediate sync.

### Requirement 11: Rate Limiting

**User Story:** As a platform operator, I want API endpoints to be rate limited, so that the system is protected from abuse and denial-of-service attacks.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce per-endpoint rate limits using a Redis-backed sliding window algorithm with configurable thresholds per route.
2. WHEN a client exceeds the configured rate limit, THE Rate_Limiter SHALL return a 429 response with Retry-After header.
3. THE Rate_Limiter SHALL include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers in all API responses.
4. THE Platform SHALL apply a stricter rate limit to the POST /api/v1/enquiry endpoint (10 requests per minute per IP) compared to GET endpoints (100 requests per minute per IP).
5. WHILE Nginx rate limiting is active, THE Platform SHALL apply NestJS Throttler as a second layer of defense for requests that pass the Nginx limit.

### Requirement 12: Security Headers and Input Protection

**User Story:** As a security engineer, I want the platform to enforce security best practices, so that common attack vectors are mitigated.

#### Acceptance Criteria

1. THE Platform SHALL set security headers via Helmet including X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, and Content-Security-Policy on all responses.
2. THE Platform SHALL enforce CORS with a configurable allowlist of permitted origins.
3. THE Platform SHALL reject requests with Content-Type headers that do not match application/json for API endpoints, returning a 415 response.
4. THE Platform SHALL reject request bodies exceeding 1MB in size, returning a 413 response.
5. THE Sanitization_Pipeline SHALL process all incoming string fields to strip HTML tags, normalize email addresses to lowercase, and escape SQL-significant characters before any persistence or processing.
6. THE Platform SHALL use parameterized queries exclusively through Prisma ORM, preventing SQL injection by construction.

### Requirement 13: API Key Authentication for Webhooks

**User Story:** As a system integrator, I want webhook endpoints to require API key authentication, so that only authorized systems can send events.

#### Acceptance Criteria

1. WHEN a request to a webhook endpoint includes a valid API key in the X-API-Key header, THE Platform SHALL allow the request to proceed to handler logic.
2. WHEN a request to a webhook endpoint is missing the X-API-Key header or contains an invalid key, THE Platform SHALL return a 403 response without processing the payload.
3. THE Platform SHALL support multiple active API keys to allow key rotation without downtime.

### Requirement 14: Observability Instrumentation

**User Story:** As a platform operator, I want comprehensive observability, so that I can monitor system health, diagnose issues, and track business metrics.

#### Acceptance Criteria

1. THE Observability_Stack SHALL export OpenTelemetry traces for all HTTP requests and queue job executions with correlation IDs linking logs, metrics, and traces.
2. THE Observability_Stack SHALL expose a Prometheus metrics endpoint on port 8081 with custom counters for enquiry_created_total, cache_hit_total, cache_miss_total, and rate_limit_triggered_total.
3. THE Observability_Stack SHALL export histogram metrics for http_request_duration_seconds and queue_job_duration_seconds with appropriate bucket boundaries.
4. THE Observability_Stack SHALL export gauge metrics for queue_depth, db_pool_active_connections, and event_loop_lag_seconds.
5. THE Platform SHALL include a request_id in all structured log entries and error responses to enable request tracing across services.

### Requirement 15: Alerting Rules

**User Story:** As a platform operator, I want alerting rules for critical conditions, so that I am notified before users are affected.

#### Acceptance Criteria

1. WHEN the 5xx error rate exceeds 5% over a 5-minute window, THE Observability_Stack SHALL trigger a HighErrorRate alert.
2. WHEN the DLQ depth increases by more than 10 jobs within 15 minutes, THE Observability_Stack SHALL trigger a DLQGrowing alert.
3. WHEN the p95 request latency exceeds 500ms over a 5-minute window, THE Observability_Stack SHALL trigger a HighLatency alert.
4. WHEN active database connections exceed 80% of the pool maximum, THE Observability_Stack SHALL trigger a DBConnectionExhaustion alert.
5. WHEN Redis memory usage exceeds 80% of configured maximum, THE Observability_Stack SHALL trigger a RedisMemoryHigh alert.
6. WHEN event loop lag exceeds 100ms, THE Observability_Stack SHALL trigger an EventLoopLag alert.

### Requirement 16: Grafana Dashboards

**User Story:** As a platform operator, I want pre-configured dashboards, so that I can visualize system behavior without manual setup.

#### Acceptance Criteria

1. THE Observability_Stack SHALL provision a Grafana API Performance dashboard displaying request rate, error rate, latency percentiles, and throughput per endpoint.
2. THE Observability_Stack SHALL provision a Grafana System Health dashboard displaying CPU usage, memory usage, event loop lag, and database connection pool utilization.
3. THE Observability_Stack SHALL provision a Grafana Queue Monitor dashboard displaying queue depth, job completion rate, failure rate, and DLQ depth per queue.
4. THE Observability_Stack SHALL provision a Grafana Business Metrics dashboard displaying enquiry creation rate, enquiry conversion rate, and top properties by enquiry count.

### Requirement 17: Performance Optimization

**User Story:** As a platform operator, I want the system to handle high-volume traffic efficiently, so that response times remain low under load.

#### Acceptance Criteria

1. THE Platform SHALL configure Prisma connection pooling with a minimum of 2 and maximum of 10 connections per instance.
2. THE Platform SHALL enable Nginx gzip compression for application/json responses larger than 1KB.
3. THE Platform SHALL log queries exceeding 500ms execution time with the full query context for performance analysis.
4. THE Cache_Layer SHALL use Redis pipelining for bulk cache operations involving 3 or more keys.
5. THE Platform SHALL support ETag-based conditional requests, returning 304 Not Modified when content has not changed since the client's last request.

### Requirement 18: Health Check Endpoints

**User Story:** As a deployment orchestrator, I want health check endpoints, so that load balancers and monitoring systems can verify service availability.

#### Acceptance Criteria

1. WHEN a GET request is received at /health/live, THE Health_Monitor SHALL return a 200 response if the process is running, regardless of dependency state.
2. WHEN a GET request is received at /health/ready, THE Health_Monitor SHALL return a 200 response only when PostgreSQL, Redis, and queue connections are all healthy.
3. WHEN any dependency health check fails, THE Health_Monitor SHALL return a 503 response from /health/ready with details of the failing component.

### Requirement 19: Graceful Shutdown

**User Story:** As a platform operator, I want the application to shut down gracefully, so that in-flight requests are not dropped during deployments.

#### Acceptance Criteria

1. WHEN a SIGTERM signal is received, THE Platform SHALL stop accepting new connections and wait up to 30 seconds for in-flight requests to complete before terminating.
2. WHEN a SIGTERM signal is received, THE Queue_Processor SHALL finish processing current jobs and stop accepting new jobs from the queue.
3. WHEN the 30-second shutdown timeout is reached, THE Platform SHALL force-terminate remaining connections and exit with a non-zero exit code.

### Requirement 20: Redis Degradation Mode

**User Story:** As a platform operator, I want the system to continue operating when Redis is unavailable, so that a Redis outage does not cause total service failure.

#### Acceptance Criteria

1. IF Redis becomes unreachable, THEN THE Cache_Layer SHALL fall back to an in-memory LRU cache with a reduced TTL of 60 seconds and log the degradation.
2. IF Redis becomes unreachable, THEN THE Rate_Limiter SHALL fall back to an in-memory rate limiter per instance and log the degradation.
3. WHEN Redis connectivity is restored, THE Platform SHALL resume using Redis-backed caching and rate limiting within 10 seconds of detection.

### Requirement 21: Frontend Enquiry Submission

**User Story:** As a property seeker, I want to submit enquiries through a web form, so that I can express interest in properties conveniently.

#### Acceptance Criteria

1. WHEN the user submits the enquiry form with valid data, THE Platform SHALL send a POST request to /api/v1/enquiry and display a success confirmation with the enquiry reference.
2. WHEN the user submits invalid form data, THE Platform SHALL display inline validation errors on the corresponding fields without submitting to the server.
3. WHEN the server returns a 409 duplicate response, THE Platform SHALL display a message indicating the enquiry was already submitted for this property.
4. WHEN the server returns a 429 rate limit response, THE Platform SHALL display a countdown timer showing when the user can retry.
5. THE Platform SHALL persist form state to localStorage on input change so that data survives page refreshes.

### Requirement 22: Frontend Enquiry Listing

**User Story:** As a property admin, I want to view and filter enquiries in a dashboard, so that I can manage enquiries efficiently.

#### Acceptance Criteria

1. THE Platform SHALL display enquiries in a paginated list using cursor-based pagination with infinite scroll or explicit page navigation.
2. WHERE filter parameters are applied (status, date range, search), THE Platform SHALL update the query and display filtered results.
3. THE Platform SHALL display status badges with distinct visual styling for each EnquiryStatus value.
4. THE Platform SHALL auto-refresh the enquiry list every 30 seconds to display new enquiries.

### Requirement 23: Frontend Property Pages

**User Story:** As a property seeker, I want to browse property listings, so that I can find properties of interest.

#### Acceptance Criteria

1. WHEN the property list page loads, THE Platform SHALL fetch properties via GraphQL with Apollo Client and display skeleton loading states during fetch.
2. WHEN the Circuit_Breaker is open for WordPress data, THE Platform SHALL display a graceful fallback message indicating properties are temporarily unavailable.
3. THE Platform SHALL implement code splitting for property page routes to reduce initial bundle size.

### Requirement 24: Frontend Admin Queue Dashboard

**User Story:** As a platform admin, I want a queue management dashboard, so that I can monitor and intervene on failed jobs.

#### Acceptance Criteria

1. THE Platform SHALL display queue metrics including job counts by status (active, waiting, completed, failed, delayed) for each queue.
2. WHEN the admin clicks retry on a failed job, THE Platform SHALL send a request to re-enqueue the job and update the UI state.
3. WHEN the admin clicks pause or resume on a queue, THE Platform SHALL send the corresponding control request and reflect the new queue state.

### Requirement 25: Frontend Resilience

**User Story:** As a platform user, I want the frontend to handle network failures gracefully, so that I do not lose data during connectivity issues.

#### Acceptance Criteria

1. WHEN an API request fails due to a network error, THE Platform SHALL retry the request up to 3 times with exponential backoff before displaying an error.
2. THE Platform SHALL implement React error boundaries around page sections so that a component failure does not crash the entire application.
3. WHEN the user is offline and submits an enquiry, THE Platform SHALL queue the submission locally and process it when connectivity is restored.

### Requirement 26: Docker Deployment

**User Story:** As a DevOps engineer, I want containerized deployment, so that the application runs consistently across environments.

#### Acceptance Criteria

1. THE Platform SHALL provide a multi-stage Dockerfile with a builder stage for compilation and a production stage running as a non-root user.
2. THE Platform SHALL provide a Docker Compose configuration including PostgreSQL, Redis, the application, Nginx, and the observability stack with resource limits defined.
3. THE Platform SHALL configure PM2 in cluster mode for the application process with graceful shutdown support.
4. THE Platform SHALL configure Nginx as a reverse proxy with gzip compression, security headers, rate limiting, and SPA fallback for the frontend.

### Requirement 27: SSL and VPS Hardening

**User Story:** As a security engineer, I want the deployment environment to be hardened, so that the attack surface is minimized.

#### Acceptance Criteria

1. THE Platform SHALL provide configuration for Let's Encrypt SSL certificate provisioning with automatic renewal.
2. THE Platform SHALL document VPS hardening steps including SSH key-only authentication, UFW firewall rules allowing only ports 80, 443, and the SSH port, fail2ban configuration, and unattended security updates.

### Requirement 28: CI/CD Pipeline

**User Story:** As a developer, I want an automated CI/CD pipeline, so that code changes are validated and deployed safely.

#### Acceptance Criteria

1. THE Platform SHALL define a GitHub Actions pipeline with sequential gates: lint and SAST, unit tests with 80% minimum coverage, integration and E2E tests, build and security scan, deploy and smoke tests, and load tests.
2. WHEN smoke tests fail after deployment, THE Platform SHALL execute an automated rollback to the previous deployment version.
3. THE Platform SHALL configure Dependabot for automated dependency update pull requests.
4. THE Platform SHALL schedule weekly security scans using Trivy and npm audit.

### Requirement 29: Security Scanning

**User Story:** As a security engineer, I want automated security scanning, so that vulnerabilities are detected before reaching production.

#### Acceptance Criteria

1. THE Platform SHALL integrate eslint-plugin-security for static analysis of JavaScript/TypeScript security patterns.
2. THE Platform SHALL run Trivy container and filesystem scans during the CI build stage, failing the pipeline on HIGH or CRITICAL findings.
3. THE Platform SHALL run OWASP ZAP DAST scans against the staging environment after deployment.
4. THE Platform SHALL run gitleaks to detect secrets in the repository, failing the pipeline on findings.
5. THE Platform SHALL generate a SECURITY_REPORT.md mapping findings to OWASP Top 10 categories after each security scan run.

### Requirement 30: Testing Strategy

**User Story:** As a developer, I want comprehensive automated tests, so that regressions are caught before deployment.

#### Acceptance Criteria

1. THE Platform SHALL provide unit tests with mocked dependencies achieving 80% or greater code coverage for all backend modules.
2. THE Platform SHALL provide integration tests using a real PostgreSQL and Redis instance validating API endpoint behavior end-to-end.
3. THE Platform SHALL provide Playwright E2E tests for critical frontend user journeys including enquiry submission and property browsing.
4. THE Platform SHALL provide k6 load test scenarios (smoke, stress, spike, soak) with defined performance budgets of p95 response time below 500ms and error rate below 1%.
5. THE Platform SHALL provide smoke tests executing 10 critical health and functional checks completing within 30 seconds.

### Requirement 31: GDPR Compliance

**User Story:** As a data subject, I want to exercise my data rights, so that my personal data can be exported or erased on request.

#### Acceptance Criteria

1. WHEN a GET request is received at /api/v1/gdpr/export/:email, THE Platform SHALL return all personal data associated with that email in a structured JSON format.
2. WHEN a DELETE request is received at /api/v1/gdpr/erase/:email, THE Platform SHALL permanently delete or anonymize all personal data associated with that email and return a confirmation.
3. THE Audit_Logger SHALL record all GDPR export and erasure operations with the requesting identity and timestamp.

### Requirement 32: Audit Logging

**User Story:** As a compliance officer, I want all data mutations to be audited, so that changes can be traced and reviewed.

#### Acceptance Criteria

1. WHEN an Enquiry or WebhookEvent record is created, updated, or deleted, THE Audit_Logger SHALL record the entity type, entity ID, action, before state, after state, performing identity, and request ID.
2. THE Audit_Logger SHALL write audit records to the AuditLog table within the same database transaction as the mutating operation.
3. THE Platform SHALL retain audit logs for a minimum of 90 days with configurable retention policies.

### Requirement 33: Backpressure and Load Shedding

**User Story:** As a platform operator, I want the system to shed load under extreme pressure, so that it remains responsive for existing connections.

#### Acceptance Criteria

1. WHEN event loop lag exceeds 200ms, THE Platform SHALL begin rejecting new requests with a 503 response and a Retry-After header until lag recovers below 100ms.
2. THE Platform SHALL monitor event loop lag using a 1-second sampling interval and export the measurement as the event_loop_lag_seconds gauge metric.

### Requirement 34: Data Retention and Backup

**User Story:** As a platform operator, I want automated backups and data retention policies, so that data is recoverable and storage is managed.

#### Acceptance Criteria

1. THE Platform SHALL execute automated PostgreSQL backups daily with a retention policy of 30 daily backups, 4 weekly backups, and 3 monthly backups.
2. THE Platform SHALL provide a documented restore procedure that can recover the database to any retained backup point.
3. THE Platform SHALL apply a data retention policy that archives enquiries older than 2 years and deletes anonymized records older than 5 years.

### Requirement 35: API Versioning and Structured Errors

**User Story:** As an API consumer, I want versioned endpoints and consistent error responses, so that I can integrate reliably and handle errors predictably.

#### Acceptance Criteria

1. THE Platform SHALL prefix all API routes with /api/v1/ to support future version evolution without breaking existing integrations.
2. WHEN an error occurs, THE Platform SHALL return a structured JSON error response containing statusCode, error type, message, request_id, and timestamp fields.
3. WHEN a validation error occurs, THE Platform SHALL include a details array in the error response with per-field error messages.

### Requirement 36: Bull Board Admin Dashboard

**User Story:** As a platform admin, I want a web-based queue dashboard, so that I can inspect queue state and manage jobs visually.

#### Acceptance Criteria

1. THE Platform SHALL serve the Bull Board dashboard at /admin/queues displaying all registered BullMQ queues with job counts, recent jobs, and failure details.
2. THE Platform SHALL restrict access to /admin/queues to authenticated admin users.

### Requirement 37: SLO Definitions and Operational Runbook

**User Story:** As a platform operator, I want defined SLOs and operational procedures, so that the team has clear targets and incident response guidance.

#### Acceptance Criteria

1. THE Platform SHALL define and measure SLOs of 99.5% availability, p95 response latency below 500ms, and error rate below 1% over rolling 30-day windows.
2. THE Platform SHALL provide a RUNBOOK.md documenting incident response procedures for each alert rule, scaling procedures, backup restoration, and common troubleshooting steps.
