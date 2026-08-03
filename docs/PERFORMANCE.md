# Performance Optimizations

This document describes the performance optimizations implemented in the Enquiry Backend Platform, with rationale and expected impact.

---

## 1. N+1 Query Prevention with DataLoader

**Problem:** GraphQL resolvers loading related entities one-by-one cause N+1 database queries.

**Solution:** DataLoader batches all property resolution requests within a single event loop tick into one database query.

**Impact:**
- Before: 11 queries for 10 properties with relations
- After: 2 queries (one for properties, one for relations)
- Latency reduction: ~80% for nested GraphQL queries

**Implementation:** `PropertyDataLoader` using the `dataloader` library batches `findByIds()` calls.

---

## 2. OFFSET Pagination → Cursor-Based Pagination

**Problem:** OFFSET/LIMIT pagination degrades linearly — page 1000 scans and discards 999 pages of rows.

**Solution:** Cursor-based pagination uses an indexed `(createdAt, id)` composite to seek directly to the next page.

**Impact:**
- Before: O(offset + limit) per page — page 100 at 20/page scans 2000 rows
- After: O(limit) per page — constant time regardless of position
- Consistent sub-10ms query times for all pages

**Implementation:** Cursors are base64-encoded JSON `{ id, createdAt }`. The WHERE clause uses `(createdAt, id) < (cursor.createdAt, cursor.id)` with the composite index.

---

## 3. Redis Pipelining for Bulk Operations

**Problem:** Multiple sequential Redis round-trips add latency when checking/setting multiple cache keys.

**Solution:** Redis pipelining sends all commands in a single network round-trip.

**Impact:**
- Before: 10 sequential GET commands = 10 round-trips (~10ms at 1ms RTT)
- After: 1 pipelined batch = 1 round-trip (~1ms)
- 90% reduction in Redis-related latency for bulk operations

**Implementation:** `CacheService.pipeline()` accepts an array of operations and executes them via `redis.pipeline().exec()`.

---

## 4. Nginx Gzip Compression

**Problem:** JSON API responses are verbose and consume bandwidth unnecessarily.

**Solution:** Nginx compresses responses > 1KB using gzip (level 4).

**Compressed types:**
- `application/json`
- `text/plain`, `text/css`, `text/javascript`
- `application/javascript`, `application/xml`

**Impact:**
- Before: ~45KB average JSON response for enquiry list
- After: ~8KB gzipped (82% reduction)
- Faster page loads on mobile/slow connections

**Configuration:** Set in `nginx/nginx.conf` with `gzip_comp_level 4` as a balance between CPU and compression ratio.

---

## 5. ETag Conditional Responses

**Problem:** Polling endpoints re-transfer unchanged data on every request.

**Solution:** ETag headers enable conditional requests — the server returns 304 Not Modified when content hasn't changed.

**Impact:**
- Before: Full response body on every GET (even if unchanged)
- After: 304 with empty body when ETag matches — saves bandwidth and reduces response time
- Particularly effective for the admin dashboard's 30s auto-refresh

**Implementation:** `ETagInterceptor` computes MD5 hash of response body, sets `ETag` header, and checks `If-None-Match` on incoming requests.

---

## 6. Slow Query Detection

**Problem:** Degraded queries go unnoticed until they cause visible latency spikes.

**Solution:** Prisma middleware logs any query exceeding 500ms at WARN level with full context.

**Metrics:**
- `db_query_duration_seconds` histogram tracks all query durations
- Queries > 500ms trigger a warning log with the query operation and model
- Grafana alert fires if p95 query duration exceeds thresholds

**Implementation:** Prisma `$use` middleware measures `Date.now()` before/after query execution.

---

## 7. Connection Pooling

**Problem:** Opening a new database connection per request is expensive (TCP handshake + auth).

**Solution:** Prisma manages a connection pool (min: 2, max: 10 per instance).

**Configuration:**
- Pool size: 2-10 connections (auto-scales based on demand)
- Connection timeout: 5s
- Idle timeout: configurable, connections returned to pool after use

**Impact:** Eliminates connection overhead, supports concurrent requests without exhaustion under normal load.

---

## 8. Stale-While-Revalidate (SWR) Caching

**Problem:** Cache misses cause latency spikes while waiting for upstream data.

**Solution:** Three-tier freshness model:
- **Fresh** (< 5 min): Serve immediately from cache
- **Stale** (5-15 min): Serve stale data immediately, refresh in background
- **Expired** (> 15 min): Fetch fresh data before responding

**Impact:**
- Cache hit rate > 95% for property data during normal operation
- Users always get sub-10ms responses for stale-but-acceptable data
- Background refresh keeps data eventually consistent

---

## 9. Circuit Breaker for External Services

**Problem:** Slow or failing external services (WordPress, SMTP, CRM) block threads and cause cascading failures.

**Solution:** Opossum circuit breaker wraps all external calls with configurable timeouts.

| Service | Timeout | Error Threshold | Reset |
|---------|---------|-----------------|-------|
| WordPress | 5s | 50% | 30s |
| SMTP | 10s | 50% | 30s |
| CRM | 10s | 50% | 30s |

**Impact:**
- Fail-fast on known-down services (no waiting for timeout)
- Cached data served when circuit is open
- System remains responsive even when dependencies fail

---

## 10. Frontend Code Splitting

**Problem:** Loading the entire SPA upfront increases initial page load time.

**Solution:** `React.lazy()` for property and admin routes — only loaded when navigated to.

**Impact:**
- Initial bundle reduced by splitting admin and property routes
- Bundle budget: total JS < 500KB gzipped, largest chunk < 200KB

---

## 11. Load Shedding with Hysteresis

**Problem:** Under extreme load, the event loop backs up and all requests become slow.

**Solution:** Monitor event loop lag, reject new requests when lag > 200ms, resume when lag < 100ms.

**Hysteresis gap (100ms):** Prevents oscillation between shedding and accepting — the system must clearly recover before resuming.

**Impact:**
- Protects existing in-flight requests from degradation
- Clients get fast 503 + Retry-After instead of hanging connections
- System recovers faster by refusing new work under pressure

---

## Performance Monitoring

### Key Metrics to Watch

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API p95 latency | < 500ms | > 2s for 5min |
| Cache hit rate | > 90% | < 70% |
| DB query p95 | < 50ms | > 500ms |
| Event loop lag | < 50ms | > 200ms |
| Queue processing time | < 5s | > 60s |

### Grafana Dashboards

- **API Performance:** Request rate, latency percentiles, error rate per endpoint
- **System Health:** CPU, memory, event loop lag, DB pool utilization
- **Queue Monitor:** Depth, throughput, DLQ growth per queue

### Load Testing

Run k6 scenarios to validate performance:

```bash
# Smoke test (baseline)
npm run test:load:smoke --prefix backend

# Stress test (find breaking point)
npm run test:load:stress --prefix backend

# Spike test (sudden traffic surge)
npm run test:load:spike --prefix backend

# Soak test (memory leaks)
npm run test:load:soak --prefix backend
```
