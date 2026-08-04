#!/bin/bash
# =============================================================================
# Production Deployment Script
# Deploys the Enquiry Hub Platform with SSL for all subdomains.
# Everything runs in containers — no bare-metal Node.js or PM2 needed.
#
# Subdomains:
#   - enquiry-hub.karthikmuneeswaran.com          (Frontend)
#   - enquiry-hub-backend.karthikmuneeswaran.com   (Backend API)
#   - enquiry-hub-grafana.karthikmuneeswaran.com   (Grafana)
#
# Usage: cd /opt/enquiry-platform && ./scripts/deploy-production.sh
# =============================================================================
set -euo pipefail

DOMAIN_FRONTEND="enquiry-hub.karthikmuneeswaran.com"
DOMAIN_BACKEND="enquiry-hub-backend.karthikmuneeswaran.com"
DOMAIN_GRAFANA="enquiry-hub-grafana.karthikmuneeswaran.com"
EMAIL="admin@karthikmuneeswaran.com"
PROJECT_DIR="/opt/enquiry-platform"

echo "============================================"
echo " Enquiry Hub Platform — Production Deploy"
echo "============================================"
echo ""
echo " Frontend: https://$DOMAIN_FRONTEND"
echo " Backend:  https://$DOMAIN_BACKEND"
echo " Grafana:  https://$DOMAIN_GRAFANA"
echo ""

cd "$PROJECT_DIR"

# --- Pre-flight checks ---
echo "[1/8] Pre-flight checks..."
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker not installed. Run install-deps.sh first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: Docker Compose not installed."; exit 1; }

if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
  echo "ERROR: backend/.env not found."
  echo "Run setup-project.sh first, or manually:"
  echo "  cp backend/.env.prod backend/.env"
  exit 1
fi

if [ ! -f "$PROJECT_DIR/frontend/.env" ]; then
  echo "ERROR: frontend/.env not found."
  echo "Run setup-project.sh first, or manually:"
  echo "  cp frontend/.env.prod frontend/.env"
  exit 1
fi

echo "  All checks passed."

# --- Build Frontend (in container) ---
echo "[2/8] Building frontend (containerized)..."
# Frontend Dockerfile handles: npm ci → tsc → vite build → serve with nginx
# No separate build step needed — docker compose --build does it all.
echo "  Frontend will be built by Docker Compose (multi-stage Dockerfile)."

# --- SSL Certificates ---
echo "[3/8] Checking SSL certificates..."

NEED_CERTS=false
for DOMAIN in $DOMAIN_FRONTEND $DOMAIN_BACKEND $DOMAIN_GRAFANA; do
  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    NEED_CERTS=true
    break
  fi
done

if [ "$NEED_CERTS" = true ]; then
  echo "  Obtaining SSL certificates..."

  # Stop anything on port 80
  docker compose -f docker-compose.yml -f docker-compose.prod.yml stop nginx 2>/dev/null || true

  # Install certbot if not present (only host dependency besides Docker)
  if ! command -v certbot &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq certbot
  fi

  # Get certificates for all three subdomains
  sudo certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN_FRONTEND" \
    -d "$DOMAIN_BACKEND" \
    -d "$DOMAIN_GRAFANA"

  # Certbot may issue a single cert — create symlinks for each domain
  CERT_DIR=""
  for DOMAIN in $DOMAIN_FRONTEND $DOMAIN_BACKEND $DOMAIN_GRAFANA; do
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
      CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
      break
    fi
  done

  if [ -n "$CERT_DIR" ]; then
    for DOMAIN in $DOMAIN_FRONTEND $DOMAIN_BACKEND $DOMAIN_GRAFANA; do
      if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        sudo ln -sf "$CERT_DIR" "/etc/letsencrypt/live/$DOMAIN"
        echo "  Linked cert for $DOMAIN"
      fi
    done
  fi

  # Auto-renewal hook to restart nginx container
  sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
  sudo tee /etc/letsencrypt/renewal-hooks/post/restart-nginx.sh > /dev/null <<EOF
#!/bin/bash
cd $PROJECT_DIR && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
EOF
  sudo chmod +x /etc/letsencrypt/renewal-hooks/post/restart-nginx.sh

  # Enable renewal timer
  sudo systemctl enable certbot.timer 2>/dev/null || true
  sudo systemctl start certbot.timer 2>/dev/null || true

  echo "  SSL certificates obtained and auto-renewal configured."
else
  echo "  SSL certificates already exist."
fi

# --- Create certbot webroot ---
echo "[4/8] Creating certbot webroot..."
sudo mkdir -p /var/www/certbot
echo "  Done."

# --- Start All Containers ---
echo "[5/8] Starting Docker containers..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "  Waiting for services to be healthy..."
sleep 20

# --- Database Migrations (inside container) ---
echo "[6/8] Running database migrations..."
docker compose exec -T backend npx prisma migrate deploy
echo "  Migrations applied."

# --- Health Checks ---
echo "[7/8] Running health checks..."
sleep 5

# Backend health
if curl -sf http://localhost:3000/health/ready > /dev/null 2>&1; then
  echo "  Backend: OK"
else
  echo "  WARNING: Backend health check failed."
  echo "  Check: docker compose logs backend --tail=50"
fi

# Nginx
HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "  Nginx: OK (HTTP $HTTP_CODE)"
else
  echo "  WARNING: Nginx returned HTTP $HTTP_CODE."
  echo "  Check: docker compose logs nginx --tail=50"
fi

# --- Summary ---
echo "[8/8] Deployment complete!"
echo ""
echo "============================================"
echo " DEPLOYMENT SUCCESSFUL"
echo "============================================"
echo ""
echo " Live URLs:"
echo "   Frontend:  https://$DOMAIN_FRONTEND"
echo "   Backend:   https://$DOMAIN_BACKEND/health/ready"
echo "   GraphQL:   https://$DOMAIN_BACKEND/graphql"
echo "   Grafana:   https://$DOMAIN_GRAFANA"
echo "   Queues:    https://$DOMAIN_BACKEND/admin/queues"
echo ""
echo " Containers:"
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo " Useful commands:"
echo "   docker compose logs backend --tail=100 -f"
echo "   docker compose logs nginx --tail=50"
echo "   docker compose exec backend npx pm2 list"
echo "   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend"
echo ""
