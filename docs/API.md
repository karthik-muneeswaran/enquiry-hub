# API Documentation

The Enquiry Backend Platform exposes a REST API and a GraphQL endpoint, both documented via auto-generated specifications.

---

## Swagger UI (Interactive)

**URL:** `/api/docs`

The Swagger UI provides an interactive interface to explore and test all REST API endpoints. It includes request/response schemas, example payloads, and authentication support.

> Note: Swagger UI is gated by the `SWAGGER_ENABLED` environment variable. It is enabled by default in development and disabled in production.

---

## OpenAPI Specification (Machine-Readable)

Export the full OpenAPI 3.0 specification for code generation, external tooling, or documentation systems:

| Format | URL |
|--------|-----|
| JSON | `/api/docs-json` |
| YAML | `/api/docs-yaml` |

These endpoints are available whenever Swagger is enabled.

### Use Cases

- Generate TypeScript client types with `openapi-typescript-codegen`
- Import into Postman or Insomnia for testing
- Feed into API gateway or contract testing tools

---

## REST API Endpoints

### Enquiry

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| POST | `/api/v1/enquiry` | Create a new enquiry | 10/min per IP |
| GET | `/api/v1/enquiry/:id` | Get enquiry by ID | 100/min per IP |
| GET | `/api/v1/enquiries` | List enquiries (paginated) | 60/min per IP |

### Webhook

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| POST | `/api/v1/webhook/crm` | Receive CRM webhook event | 200/min per API key |
| GET | `/api/v1/webhook/events` | List webhook events (paginated) | 60/min per IP |

### Audit

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/api/v1/audit` | List audit logs (paginated) | 30/min per IP |

### GDPR

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/api/v1/gdpr/export/:email` | Export user data | 5/min per IP |
| DELETE | `/api/v1/gdpr/erase/:email` | Erase user data | 3/min per IP |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness probe (always 200) |
| GET | `/health/ready` | Readiness probe (checks dependencies) |

### Admin

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/admin/queues/stats` | Queue statistics | 60/min per IP |
| GET | `/admin/queues/dlq` | List dead-letter jobs (paginated) | 60/min per IP |
| POST | `/admin/queues/:name/retry/:jobId` | Retry a failed job | 30/min per IP |
| POST | `/admin/queues/:name/pause` | Pause a queue | 30/min per IP |
| POST | `/admin/queues/:name/resume` | Resume a queue | 30/min per IP |

---

## GraphQL Endpoint

**URL:** `/graphql`  
**Rate Limit:** 120/min per IP

### Queries

```graphql
# List properties with pagination, search, and sorting
query {
  properties(first: 20, after: "cursor", search: "sydney", sortBy: TITLE, sortDir: ASC) {
    edges {
      node {
        id
        title
        slug
        excerpt
        imageUrl
        cachedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Get single property
query {
  property(slug: "3-bed-apartment-sydney") {
    id
    title
    slug
    content
    excerpt
    imageUrl
    cachedAt
  }
}
```

---

## Authentication

### API Key (Webhooks)

Webhook endpoints require the `X-API-Key` header:

```
X-API-Key: your-api-key
```

### HMAC Signature (Webhooks)

Webhook requests must include an HMAC-SHA256 signature:

```
X-Webhook-Signature: sha256=<hex-encoded-hmac>
X-Webhook-Event-Id: <unique-event-id>
```

Compute the signature: `HMAC-SHA256(secret, request_body)`

---

## Response Format

All responses follow a consistent envelope:

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "pagination": {
      "nextCursor": "...",
      "previousCursor": null,
      "hasMore": true,
      "totalCount": 142,
      "limit": 20
    }
  },
  "request_id": "req_abc123",
  "timestamp": "2025-07-01T10:30:00.123Z"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "must be a valid email address", "constraint": "isEmail" }
    ]
  },
  "request_id": "req_def456",
  "timestamp": "2025-07-01T10:31:00.456Z"
}
```

---

## Rate Limit Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 55
X-RateLimit-Reset: 1719835860
```

When rate limited, a `429` response includes a `Retry-After` header (seconds until reset).
