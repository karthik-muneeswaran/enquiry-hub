# Database Schema

PostgreSQL 15 database schema for the Enquiry Backend Platform, managed by Prisma ORM with versioned migrations.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────┐
│                     Enquiry                          │
├─────────────────────────────────────────────────────┤
│ id             UUID (PK)                            │
│ name           VARCHAR(100)                         │
│ email          VARCHAR                              │
│ phone          VARCHAR(20)?                         │
│ propertyId     VARCHAR                              │
│ propertyTitle  VARCHAR(200)                         │
│ message        VARCHAR(2000)                        │
│ source         VARCHAR(50)                          │
│ consentGiven   BOOLEAN                             │
│ status         ENUM (PENDING|PROCESSING|...)        │
│ idempotencyKey VARCHAR? (UNIQUE)                    │
│ createdAt      TIMESTAMPTZ                         │
│ updatedAt      TIMESTAMPTZ                         │
├─────────────────────────────────────────────────────┤
│ IDX: (email, propertyId, createdAt)                 │
│ IDX: (status)                                       │
│ IDX: (createdAt)                                    │
└────────────────────────┬────────────────────────────┘
                         │ 1:N
                         ▼
┌─────────────────────────────────────────────────────┐
│                  WebhookEvent                        │
├─────────────────────────────────────────────────────┤
│ id             UUID (PK)                            │
│ eventId        VARCHAR (UNIQUE)                     │
│ type           VARCHAR                              │
│ source         VARCHAR                              │
│ payload        JSONB                                │
│ status         ENUM (RECEIVED|PROCESSING|...)       │
│ error          TEXT?                                │
│ enquiryId      UUID? (FK → Enquiry.id)             │
│ processedAt    TIMESTAMPTZ?                        │
│ attemptCount   INT (default: 0)                    │
│ createdAt      TIMESTAMPTZ                         │
│ updatedAt      TIMESTAMPTZ                         │
├─────────────────────────────────────────────────────┤
│ IDX: (status)                                       │
│ IDX: (createdAt)                                    │
│ IDX: (enquiryId)                                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    Property                          │
├─────────────────────────────────────────────────────┤
│ id             UUID (PK)                            │
│ wpId           INT (UNIQUE)                         │
│ slug           VARCHAR (UNIQUE)                     │
│ title          VARCHAR                              │
│ content        TEXT?                                │
│ excerpt        TEXT?                                │
│ featuredImage  VARCHAR?                             │
│ propertyType   VARCHAR?                             │
│ price          FLOAT?                              │
│ bedrooms       INT?                                │
│ bathrooms      INT?                                │
│ area           FLOAT?                              │
│ location       VARCHAR?                             │
│ status         VARCHAR (default: "publish")         │
│ cachedAt       TIMESTAMPTZ                         │
│ createdAt      TIMESTAMPTZ                         │
│ updatedAt      TIMESTAMPTZ                         │
├─────────────────────────────────────────────────────┤
│ IDX: (slug) — UNIQUE                               │
│ IDX: (wpId) — UNIQUE                               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                    AuditLog                          │
├─────────────────────────────────────────────────────┤
│ id             UUID (PK)                            │
│ entity         VARCHAR                              │
│ entityId       VARCHAR                              │
│ action         VARCHAR                              │
│ before         JSONB?                               │
│ after          JSONB?                               │
│ performedBy    VARCHAR?                             │
│ requestId      VARCHAR?                             │
│ createdAt      TIMESTAMPTZ                         │
├─────────────────────────────────────────────────────┤
│ IDX: (entity, entityId)                             │
│ IDX: (createdAt)                                    │
│ IDX: (requestId)                                    │
└─────────────────────────────────────────────────────┘
```

---

## Tables

### Enquiry

The core business entity. Stores property enquiries submitted by users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `name` | VARCHAR(100) | NOT NULL | Full name of enquirer |
| `email` | VARCHAR | NOT NULL | Email address (validated format) |
| `phone` | VARCHAR(20) | NULLABLE | Contact phone number |
| `propertyId` | VARCHAR | NOT NULL | Reference to property being enquired about |
| `propertyTitle` | VARCHAR(200) | NOT NULL | Property title snapshot (denormalized) |
| `message` | VARCHAR(2000) | NOT NULL | Enquiry message body |
| `source` | VARCHAR(50) | NOT NULL | Lead source (website, mobile, api) |
| `consentGiven` | BOOLEAN | NOT NULL | GDPR consent flag |
| `status` | ENUM | NOT NULL, default: PENDING | Processing status |
| `idempotencyKey` | VARCHAR | UNIQUE, NULLABLE | Client-provided deduplication key |
| `createdAt` | TIMESTAMPTZ | NOT NULL, auto | Record creation timestamp |
| `updatedAt` | TIMESTAMPTZ | NOT NULL, auto | Last modification timestamp |

**Status enum values:** `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `ARCHIVED`

---

### WebhookEvent

Stores incoming CRM webhook events with processing status for reliable delivery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Internal identifier |
| `eventId` | VARCHAR | UNIQUE, NOT NULL | External event ID for deduplication |
| `type` | VARCHAR | NOT NULL | Event type (e.g., enquiry.status_changed) |
| `source` | VARCHAR | NOT NULL | Source system (e.g., salesforce) |
| `payload` | JSONB | NOT NULL | Full event payload |
| `status` | ENUM | NOT NULL, default: RECEIVED | Processing status |
| `error` | TEXT | NULLABLE | Error message if processing failed |
| `enquiryId` | UUID | FK → Enquiry.id, NULLABLE | Associated enquiry |
| `processedAt` | TIMESTAMPTZ | NULLABLE | When processing completed |
| `attemptCount` | INT | NOT NULL, default: 0 | Number of processing attempts |
| `createdAt` | TIMESTAMPTZ | NOT NULL, auto | Record creation timestamp |
| `updatedAt` | TIMESTAMPTZ | NOT NULL, auto | Last modification timestamp |

**Status enum values:** `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`, `DEAD_LETTER`

---

### Property

Cache of property data fetched from WordPress via WPGraphQL. Used to serve fast API responses without hitting WordPress on every request.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Internal identifier |
| `wpId` | INT | UNIQUE, NOT NULL | WordPress post ID |
| `slug` | VARCHAR | UNIQUE, NOT NULL | URL-friendly slug |
| `title` | VARCHAR | NOT NULL | Property title |
| `content` | TEXT | NULLABLE | Full HTML content |
| `excerpt` | TEXT | NULLABLE | Short description |
| `featuredImage` | VARCHAR | NULLABLE | Image URL |
| `propertyType` | VARCHAR | NULLABLE | Property category |
| `price` | FLOAT | NULLABLE | Listing price |
| `bedrooms` | INT | NULLABLE | Number of bedrooms |
| `bathrooms` | INT | NULLABLE | Number of bathrooms |
| `area` | FLOAT | NULLABLE | Area in square metres |
| `location` | VARCHAR | NULLABLE | Location/suburb |
| `status` | VARCHAR | NOT NULL, default: "publish" | WordPress post status |
| `cachedAt` | TIMESTAMPTZ | NOT NULL, auto | When this cache entry was last refreshed |
| `createdAt` | TIMESTAMPTZ | NOT NULL, auto | Record creation timestamp |
| `updatedAt` | TIMESTAMPTZ | NOT NULL, auto | Last modification timestamp |

---

### AuditLog

Immutable append-only log of all state changes for compliance and debugging.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Log entry identifier |
| `entity` | VARCHAR | NOT NULL | Entity type (e.g., "Enquiry", "WebhookEvent") |
| `entityId` | VARCHAR | NOT NULL | ID of the affected entity |
| `action` | VARCHAR | NOT NULL | Action performed (CREATE, UPDATE, DELETE) |
| `before` | JSONB | NULLABLE | State before the change |
| `after` | JSONB | NULLABLE | State after the change |
| `performedBy` | VARCHAR | NULLABLE | Who performed the action |
| `requestId` | VARCHAR | NULLABLE | Correlation ID for request tracing |
| `createdAt` | TIMESTAMPTZ | NOT NULL, auto | When the action occurred |

---

## Index Strategy

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| Enquiry | Composite | `(email, propertyId, createdAt)` | Duplicate detection within time window |
| Enquiry | Single | `(status)` | Filter by processing status |
| Enquiry | Single | `(createdAt)` | Cursor-based pagination (primary sort) |
| Enquiry | Unique | `(idempotencyKey)` | Idempotent submission enforcement |
| WebhookEvent | Unique | `(eventId)` | Event deduplication |
| WebhookEvent | Single | `(status)` | Filter by processing status (DLQ queries) |
| WebhookEvent | Single | `(createdAt)` | Cursor-based pagination |
| WebhookEvent | Single | `(enquiryId)` | Lookup events by associated enquiry |
| Property | Unique | `(wpId)` | WordPress ID lookup (cache refresh) |
| Property | Unique | `(slug)` | URL-based property lookup |
| AuditLog | Composite | `(entity, entityId)` | Lookup audit trail for specific entity |
| AuditLog | Single | `(createdAt)` | Time-based pagination and retention |
| AuditLog | Single | `(requestId)` | Correlate logs with API requests |

### Index Design Rationale

1. **Duplicate detection index** `(email, propertyId, createdAt)`: Supports the query "has this email already enquired about this property in the last 10 minutes?" — a single index scan rather than a full table scan.

2. **Cursor pagination** uses `(createdAt, id)` ordering. The `createdAt` index enables O(1) seeks to any page position regardless of how deep into the dataset (vs. OFFSET which is O(n)).

3. **Unique constraints** on `idempotencyKey` and `eventId` provide database-level deduplication as a last line of defence, even if application-level checks fail due to race conditions.

4. **JSONB columns** (`payload`, `before`, `after`) are intentionally not indexed — they store variable-structure data that's read but not queried against.

---

## Relationships

```
Enquiry (1) ──── (N) WebhookEvent
   │                    │
   └── enquiryId FK ────┘
```

- **Enquiry → WebhookEvent**: One-to-many. An enquiry can have multiple webhook events (status changes, CRM syncs). The relationship is optional (`enquiryId` is nullable) since webhook events may arrive before being matched to an enquiry.

- **Property**: Standalone table — acts as a read-through cache from WordPress. No foreign key relationships to avoid coupling the CMS cache with business entities.

- **AuditLog**: Standalone table — uses polymorphic `entity` + `entityId` pattern to track changes across all tables without foreign key constraints (enables tracking any entity type).

---

## Migrations

Managed by Prisma Migrate. Migration files are in `backend/prisma/migrations/`:

| Migration | Description |
|-----------|-------------|
| `20240101000001_create_enquiries_table` | Initial enquiry table with indexes |
| `20240101000002_create_webhook_events_table` | Webhook events with FK to enquiry |
| `20240101000003_create_properties_table` | Property cache table |
| `20240101000004_create_audit_logs_table` | Audit log table |

### Running Migrations

```bash
# Apply pending migrations (production)
npx prisma migrate deploy

# Create new migration (development)
npx prisma migrate dev --name <migration_name>

# Reset database (development only — destroys data)
npx prisma migrate reset
```

---

## Query Optimisation Patterns

### Cursor-Based Pagination

```sql
-- First page
SELECT * FROM "Enquiry"
ORDER BY "createdAt" DESC, "id" DESC
LIMIT 20;

-- Next page (using cursor from previous response)
SELECT * FROM "Enquiry"
WHERE ("createdAt", "id") < ('2025-07-01T10:00:00Z', 'uuid-here')
ORDER BY "createdAt" DESC, "id" DESC
LIMIT 20;
```

### Duplicate Detection

```sql
-- Check for duplicate enquiry (same email + property within 10 min)
SELECT EXISTS(
  SELECT 1 FROM "Enquiry"
  WHERE email = $1
    AND "propertyId" = $2
    AND "createdAt" > NOW() - INTERVAL '10 minutes'
);
```

### Efficient Count with Filter

```sql
-- Count with status filter (uses status index)
SELECT COUNT(*) FROM "Enquiry" WHERE status = 'PENDING';
```

---

## Data Retention

| Table | Retention | Strategy |
|-------|-----------|----------|
| Enquiry | Indefinite | Archived status for old records |
| WebhookEvent | 90 days | Cron job to purge PROCESSED events older than 90d |
| Property | Indefinite | Cache refreshed via SWR pattern |
| AuditLog | 1 year | Periodic archival to cold storage |

---

## Prisma Schema Source

The authoritative schema definition is at `backend/prisma/schema.prisma`. All table structures, relationships, and indexes are defined there and applied via Prisma Migrate.
