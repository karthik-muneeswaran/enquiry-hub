# Operational Runbook

This document provides incident response procedures for each alert rule, scaling guidance, backup restoration, and rollback steps.

---

## Alert Response Procedures

### High Error Rate

**Alert:** `HighErrorRate` — 5xx error rate > 5% for 5 minutes

**Symptoms:** Increasing 5xx responses, users reporting failures

**Diagnosis:**
1. Check Grafana API Performance dashboard for affected endpoints
2. Check application logs: `docker compose logs app --tail=200 | grep ERROR`
3. Verify database connectivity: `docker compose exec postgres pg_isready`
4. Verify Redis connectivity: `docker compose exec redis redis-cli ping`
5. Check event loop lag gauge for load shedding activation
6. Review recent deployments for regressions

**Resolution:**
- If DB connection errors → check pool exhaustion (see below)
- If Redis errors → check Redis memory and connectivity
- If external service errors → check circuit breaker state in logs
- If after deploy → execute rollback procedure (below)
- If load-related → scale workers or enable aggressive load shedding

---

### High Latency

**Alert:** `HighLatency` — p95 > 2s for 5 minutes

**Symptoms:** Slow API responses, frontend timeout errors

**Diagnosis:**
1. Check `db_query_duration_seconds` histogram for slow queries
2. Check `event_loop_lag_seconds` gauge
3. Inspect Redis response times via Grafana
4. Look for N+1 queries in trace waterfall (Tempo)
5. Check queue depth — backpressure from overloaded workers

**Resolution:**
- Slow queries → identify via Prisma slow query logs (>500ms), add indexes
- Event loop lag → scale PM2 instances or reduce concurrent work
- Redis latency → check memory pressure, eviction rates
- Queue backlog → increase worker concurrency or pause non-critical queues

---

### DLQ Growing

**Alert:** `DLQGrowing` — Failed job count > 10 for 2 minutes

**Symptoms:** Jobs not being processed, downstream effects (emails not sent, CRM out of sync)

**Diagnosis:**
1. Open Bull Board at `/admin/queues`
2. Inspect failed job error messages
3. Check if external service (SMTP, CRM) is down
4. Verify circuit breaker states in application logs

**Resolution:**
- If external service down → wait for recovery, jobs will auto-retry on DLQ replay
- If invalid data → fix data, then bulk retry: `POST /admin/queues/:name/retry/:jobId`
- If persistent failure → check for code bugs in processor logic
- Bulk retry all DLQ jobs after fix:
  ```bash
  curl -X POST http://localhost:3000/admin/queues/email-queue/retry/all
  ```

---

### DB Connection Exhaustion

**Alert:** `DBConnectionExhaustion` — Active connections > 80% of pool max

**Symptoms:** 503 errors, health check failing for DB

**Diagnosis:**
1. Check active connections: `docker compose exec postgres psql -c "SELECT count(*) FROM pg_stat_activity;"`
2. Look for long-running queries: `SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;`
3. Check if transaction timeouts are being hit

**Resolution:**
- Kill long-running queries: `SELECT pg_terminate_backend(pid);`
- Restart application to reset pool: `docker compose restart app`
- Increase pool size in DATABASE_URL (add `?connection_limit=20`)
- Investigate and fix queries holding connections open

---

### Redis Memory High

**Alert:** `RedisMemoryHigh` — Memory > 80% of maxmemory

**Symptoms:** Increased evictions, cache misses, potential slowdown

**Diagnosis:**
1. Check big keys: `docker compose exec redis redis-cli --bigkeys`
2. Check memory info: `docker compose exec redis redis-cli INFO memory`
3. Review key count by pattern: `redis-cli --scan --pattern 'property:*' | wc -l`

**Resolution:**
- Clean completed queue jobs: `POST /admin/queues/:name/clean`
- Flush stale cache keys: `redis-cli --scan --pattern 'property:*' | xargs redis-cli DEL`
- Increase maxmemory in docker-compose.prod.yml
- The `allkeys-lru` policy will auto-evict, but latency may increase

---

### Event Loop Lag

**Alert:** `EventLoopLag` — Lag > 500ms for 1 minute

**Symptoms:** Load shedding active (503 responses), slow processing

**Diagnosis:**
1. Check CPU usage per container in System Health dashboard
2. Look for synchronous operations in traces (Tempo)
3. Check if GC pauses are excessive
4. Review queue worker concurrency settings

**Resolution:**
- Scale PM2 instances: update `ecosystem.config.js` instances count
- Reduce concurrent queue processing
- Identify and optimize CPU-bound code paths
- If sustained → upgrade VPS (more CPU cores)

---

### Container Restart

**Alert:** `ContainerRestart` — Any container restarted

**Symptoms:** Brief service interruption, potential data inconsistency

**Diagnosis:**
1. Check container logs: `docker compose logs <service> --tail=50`
2. Check for OOM kills: `docker inspect <container> | grep OOMKilled`
3. Review system memory: `free -h`
4. Check Docker events: `docker events --since 10m`

**Resolution:**
- If OOM → increase memory limits in docker-compose.prod.yml
- If crash loop → check application logs for startup errors
- If health check failure → verify dependencies are reachable
- If unknown → monitor for recurrence, check kernel logs (`dmesg`)

---

### Disk Space High

**Alert:** `DiskSpaceHigh` — Filesystem > 85% full

**Symptoms:** Write failures, backup failures, log rotation issues

**Diagnosis:**
1. Check disk usage: `df -h`
2. Check Docker disk: `docker system df`
3. Find large files: `du -sh /var/lib/docker/* | sort -rh | head -10`

**Resolution:**
- Prune Docker: `docker system prune -a --volumes` (caution: removes unused volumes)
- Rotate logs: `logrotate -f /etc/logrotate.d/docker-containers`
- Clean old backups beyond retention policy
- Run VACUUM FULL on PostgreSQL if bloated: `docker compose exec postgres psql -c "VACUUM FULL;"`
- Remove old Docker images: `docker image prune -a --filter "until=168h"`

---

## Scaling Procedures

### Vertical Scaling (Upgrade VPS)

1. Snapshot current VPS
2. Resize to larger instance (more CPU/RAM)
3. Verify all services start correctly
4. Run smoke tests

### Horizontal Scaling (PM2 Workers)

1. Edit `backend/ecosystem.config.js`:
   ```javascript
   instances: 4,  // or 'max' for all CPUs
   ```
2. Restart app: `docker compose restart app`
3. Verify health: `curl http://localhost:3000/health/ready`

### Queue Worker Scaling

- Increase concurrency in BullMQ worker options
- Add dedicated worker containers in docker-compose for heavy queues

---

## Backup Restoration

### Full Database Restore

```bash
# 1. Stop the application
docker compose stop app

# 2. List available backups
ls -la /backups/postgres/

# 3. Restore from backup
./scripts/restore.sh /backups/postgres/full_20250101_020000.sql.gz

# 4. Run any pending migrations
docker compose exec app npx prisma migrate deploy

# 5. Restart the application
docker compose start app

# 6. Verify
curl http://localhost:3000/health/ready
```

### Point-in-Time Recovery

Redis uses AOF persistence. If Redis data is lost:
1. Stop Redis: `docker compose stop redis`
2. Restore appendonly.aof from backup
3. Start Redis: `docker compose start redis`

---

## Rollback Procedure

### Application Rollback

```bash
# 1. SSH to VPS
ssh -p 2222 deploy@your-server

# 2. Navigate to project
cd /opt/enquiry-platform

# 3. Check previous image tag
cat .previous-image

# 4. Rollback to previous image
docker compose up -d --no-deps app

# 5. Verify health
curl http://localhost:3000/health/ready

# 6. Run smoke tests
SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke --prefix backend
```

### Database Migration Rollback

If a migration caused issues:
1. Identify the last good migration
2. Restore database from pre-deployment backup
3. Deploy previous application version
4. Investigate and fix migration before re-deploying

---

## Common Troubleshooting

### Application Won't Start

1. Check logs: `docker compose logs app --tail=100`
2. Verify env vars are set: `docker compose config`
3. Check DB connectivity from app container
4. Ensure migrations are applied: `docker compose exec app npx prisma migrate deploy`

### Queues Not Processing

1. Verify Redis is running: `docker compose exec redis redis-cli ping`
2. Check queue state in Bull Board: `/admin/queues`
3. Check if queues are paused: look for PAUSED state
4. Resume if paused: `POST /admin/queues/:name/resume`

### Frontend Not Loading

1. Check Nginx logs: `docker compose logs nginx --tail=50`
2. Verify frontend build exists: `ls frontend/dist/index.html`
3. Check Nginx config syntax: `docker compose exec nginx nginx -t`
4. Verify upstream health: `curl http://app:3000/health/live`
