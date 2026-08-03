/**
 * Application-wide timeout constants (in milliseconds).
 *
 * These values configure timeouts for database queries, external service calls,
 * internal health probes, and shutdown operations.
 */

/** Default timeout for standard CRUD database queries. */
export const DB_QUERY_TIMEOUT = 5_000;

/** Timeout for complex/report/GDPR export database queries. */
export const DB_COMPLEX_TIMEOUT = 30_000;

/** Timeout for Redis cache get/set and rate limit operations. */
export const REDIS_TIMEOUT = 2_000;

/** Timeout for WordPress GraphQL calls (via circuit breaker). */
export const WP_TIMEOUT = 5_000;

/** Timeout for SMTP email sending (via circuit breaker). */
export const SMTP_TIMEOUT = 10_000;

/** Timeout for CRM webhook delivery (via circuit breaker). */
export const CRM_TIMEOUT = 10_000;

/** Timeout for internal HTTP health probes. */
export const HEALTH_TIMEOUT = 3_000;

/** Timeout for Prisma interactive transactions. */
export const TRANSACTION_TIMEOUT = 10_000;

/** Timeout for HTTP requests through Nginx proxy (proxy_read_timeout). */
export const HTTP_TIMEOUT = 30_000;

/** Duration to wait for in-flight requests/jobs to drain during graceful shutdown. */
export const SHUTDOWN_DRAIN_MS = 30_000;
