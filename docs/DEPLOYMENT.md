# Deployment Guide

This document covers VPS setup, Docker deployment, SSL provisioning, and environment variable configuration.

---

## Prerequisites

- DigitalOcean Droplet (or equivalent VPS): 2 vCPUs / 4 GB RAM / 80 GB SSD
- Ubuntu 24.04 LTS x64
- Domain name pointing to VPS IP
- SSH access with key-based authentication

---

## VPS Initial Setup

### 1. Harden the Server

Run the hardening script on a fresh VPS:

```bash
scp scripts/harden-vps.sh root@your-server:/tmp/
ssh root@your-server 'bash /tmp/harden-vps.sh'
```

This script:
- Creates a non-root `deploy` user
- Changes SSH port to 2222, disables root login and password auth
- Configures UFW (allows ports 80, 443, 2222 only)
- Installs fail2ban (bans after 3 failed SSH attempts)
- Enables unattended-upgrades for security patches
- Applies kernel sysctl hardening

### 2. Install Docker

```bash
ssh -p 2222 deploy@your-server

# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Verify
docker compose version
```

### 3. Clone Repository

```bash
cd /opt
sudo mkdir enquiry-platform && sudo chown deploy:deploy enquiry-platform
git clone <repo-url> enquiry-platform
cd enquiry-platform
```

---

## Environment Configuration

### Backend Environment Variables

Copy the production template to `.env` on the server:

```bash
cp backend/.env.prod backend/.env
```

Then edit `backend/.env` and replace all `CHANGE_ME` placeholders with real values:

```bash
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://enquiry_user:STRONG_PASSWORD@postgres:5432/enquiry_platform?schema=public

# Redis
REDIS_URL=redis://redis:6379

# Swagger (disabled in production)
SWAGGER_ENABLED=false

# Logging
LOG_LEVEL=info

# Security
HMAC_SECRET=<generate: openssl rand -hex 32>
API_KEYS=<generate: openssl rand -hex 16>,<second-key>

# SMTP
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASS=<smtp-password>

# External Services
CRM_WEBHOOK_URL=https://your-crm.com/api/webhook
WORDPRESS_GRAPHQL_URL=http://wordpress:80/graphql

# CORS
CORS_ORIGINS=https://enquiry-hub.karthikmuneeswaran.com

# Rate Limiting
RATE_LIMIT_ENABLED=true
```

### Frontend Environment Variables

Copy the production template to `.env` on the server:

```bash
cp frontend/.env.prod frontend/.env
```

Then edit `frontend/.env`:

```bash
VITE_API_BASE_URL=https://enquiry-hub-backend.karthikmuneeswaran.com/api/v1
VITE_GRAPHQL_URL=https://enquiry-hub-backend.karthikmuneeswaran.com/graphql
```

---

## SSL Certificate Setup

### Let's Encrypt with Certbot

```bash
# Run the SSL setup script
./scripts/setup-ssl.sh yourdomain.com

# Or manually:
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured via systemd timer
sudo systemctl status certbot.timer
```

Certificates are stored at `/etc/letsencrypt/live/yourdomain.com/` and mounted into the Nginx container as read-only.

---

## Docker Deployment

### Build and Deploy

```bash
cd /opt/enquiry-platform

# Build frontend
cd frontend && npm ci && npm run build && cd ..

# Start all services with production overlay
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Verify health
curl http://localhost:3000/health/ready
```

### Service Architecture

| Service | Port | Description |
|---------|------|-------------|
| app | 3000 (internal) | NestJS backend (PM2 cluster mode) |
| postgres | 5432 (internal) | PostgreSQL 15 |
| redis | 6379 (internal) | Redis 7 (cache + queues) |
| nginx | 80, 443 | Reverse proxy, SSL termination, static files |
| wordpress | 8080 (internal) | WordPress + WPGraphQL |
| prometheus | 9090 (internal) | Metrics collection |
| grafana | 3001 (internal) | Dashboards (access via Nginx) |
| loki | 3100 (internal) | Log aggregation |
| tempo | 4318 (internal) | Distributed tracing |

### Resource Limits (Production)

| Service | Memory Limit | CPU Limit |
|---------|-------------|-----------|
| app | 1GB | 2 CPUs |
| postgres | 512MB | 1 CPU |
| redis | 300MB | 0.5 CPU |
| nginx | 128MB | 0.5 CPU |
| wordpress | 512MB | 1 CPU |
| prometheus | 256MB | 0.5 CPU |
| grafana | 256MB | 0.5 CPU |

---

## Deployment Process

### Standard Deployment

```bash
# 1. Save current image tag for rollback
docker compose images app --format json | jq -r '.[0].Tag' > .previous-image

# 2. Pull latest code
git pull origin main

# 3. Rebuild frontend
cd frontend && npm ci && npm run build && cd ..

# 4. Rebuild and restart app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --no-deps backend

# 5. Run migrations
docker compose exec backend npx prisma migrate deploy

# 6. Run smoke tests
SMOKE_BASE_URL=https://yourdomain.com npm run test:smoke --prefix backend

# 7. If smoke tests fail, rollback
# docker compose up -d --no-deps backend  (uses .previous-image)
```

### Zero-Downtime Restart

PM2 cluster mode with `reload` ensures new workers start before old ones stop:

```bash
docker compose exec backend npx pm2 reload ecosystem.config.js
```

---

## Backup Configuration

### Automated Daily Backups

Add to crontab (`crontab -e`):

```cron
0 2 * * * /opt/enquiry-platform/scripts/backup.sh >> /var/log/backup.log 2>&1
```

Backups are stored in `/backups/postgres/` with retention:
- 7 daily backups
- 4 weekly backups
- 3 monthly backups

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore

```bash
./scripts/restore.sh /backups/postgres/full_YYYYMMDD_HHMMSS.sql.gz
```

---

## Monitoring Access

- **Grafana:** `https://yourdomain.com:3001` (or proxy through Nginx)
- **Prometheus:** Internal only (port 9090)
- **Bull Board:** `https://yourdomain.com/admin/queues` (admin auth required)
- **Swagger:** `https://yourdomain.com/api/docs` (disabled in production by default)

---

## Troubleshooting

### View Logs

```bash
# All services
docker compose logs -f --tail=100

# Specific service
docker compose logs backend --tail=200
docker compose logs postgres --tail=50

# Filter for errors
docker compose logs backend 2>&1 | grep -i error
```

### Restart Services

```bash
# Restart single service
docker compose restart backend

# Full stack restart
docker compose down && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Check Service Health

```bash
# Application
curl -s http://localhost:3000/health/ready | jq .

# PostgreSQL
docker compose exec postgres pg_isready

# Redis
docker compose exec redis redis-cli ping
```
