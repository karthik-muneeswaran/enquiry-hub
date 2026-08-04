# Environment Variables

Complete reference of all environment variables used across the backend and frontend applications.

---

## Backend Environment Variables

### Application

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `NODE_ENV` | Yes | `development` | Runtime environment | `production` |
| `PORT` | No | `3000` | HTTP server listen port | `3000` |

### Database (PostgreSQL)

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/enquiry_platform?schema=public` |

### Redis

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `REDIS_URL` | Yes | — | Redis connection URL (used for cache and queues) | `redis://redis:6379` |

### API Documentation

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SWAGGER_ENABLED` | No | `true` | Enable Swagger UI at `/api/docs` | `false` (production) |

### Logging

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `LOG_LEVEL` | No | `info` | Pino log level (fatal, error, warn, info, debug, trace) | `warn` |

### Security — Webhook HMAC

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `HMAC_SECRET` | Yes | — | Secret key for HMAC-SHA256 webhook signature validation | `<openssl rand -hex 32>` |

### Security — API Keys

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `API_KEYS` | Yes | — | Comma-separated list of valid API keys for webhook auth | `key1,key2,key3` |

### SMTP (Email)

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SMTP_HOST` | Yes | — | SMTP server hostname | `smtp.sendgrid.net` |
| `SMTP_PORT` | No | `587` | SMTP server port (587 for STARTTLS, 465 for SSL) | `587` |
| `SMTP_USER` | Yes | — | SMTP authentication username | `apikey` |
| `SMTP_PASS` | Yes | — | SMTP authentication password | `SG.xxxx` |

### External Services

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `CRM_WEBHOOK_URL` | Yes | — | CRM system webhook endpoint for event delivery | `https://crm.example.com/api/webhook` |
| `WORDPRESS_GRAPHQL_URL` | Yes | — | WordPress WPGraphQL endpoint for property data | `https://wp.example.com/graphql` |

### CORS

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `CORS_ORIGINS` | No | `*` (dev) | Comma-separated list of allowed CORS origins | `https://yourdomain.com,https://www.yourdomain.com` |

### Rate Limiting

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `RATE_LIMIT_ENABLED` | No | `true` | Enable/disable rate limiting globally | `true` |

---

## Frontend Environment Variables

All frontend environment variables are prefixed with `VITE_` (required by Vite for client-side exposure).

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `VITE_API_BASE_URL` | Yes | — | Backend REST API base URL | `https://yourdomain.com/api/v1` |
| `VITE_GRAPHQL_URL` | Yes | — | Backend GraphQL endpoint URL | `https://yourdomain.com/graphql` |

---

## Environment Files

| File | Purpose | Committed to Git |
|------|---------|-----------------|
| `backend/.env.example` | Template with all variables (dev defaults) | Yes |
| `backend/.env.prod` | Template with production values (placeholders only) | Yes |
| `backend/.env` | Active env file used by Docker Compose (gitignored) | No |
| `frontend/.env.example` | Template with frontend variables (dev defaults) | Yes |
| `frontend/.env.prod` | Template with production frontend values | Yes |
| `frontend/.env` | Active env file used by Docker Compose (gitignored) | No |

### Strategy

- Both local development and production use `.env` as the source file.
- Docker Compose always reads from `backend/.env` and `frontend/.env`.
- For **local development**: copy `.env.example` → `.env`
- For **production deployment**: copy `.env.prod` → `.env` and fill in real secrets

```bash
# Local development
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Production (on VPS)
cp backend/.env.prod backend/.env
cp frontend/.env.prod frontend/.env
# Then edit and replace CHANGE_ME placeholders with real values
```

---

## Configuration Validation

The backend uses Joi schema validation at startup via `@nestjs/config`. If any required variable is missing or invalid, the application **fails fast** with a clear error message indicating which variable is problematic.

```typescript
// Validated at startup — app won't start with invalid config
ConfigModule.forRoot({
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().required(),
    HMAC_SECRET: Joi.string().min(16).required(),
    API_KEYS: Joi.string().required(),
    // ... all variables validated
  }),
  validationOptions: { abortEarly: false },
});
```

---

## Security Notes

- Never commit `.env` to version control (it contains real secrets)
- `.env.prod` and `.env.example` are safe to commit (they only contain placeholders)
- Use `openssl rand -hex 32` to generate secrets
- Rotate API keys by adding new keys to `API_KEYS` before removing old ones (supports multiple simultaneous keys)
- SMTP credentials should use app-specific passwords where possible
- Database passwords should be strong (min 32 chars, alphanumeric + symbols)
