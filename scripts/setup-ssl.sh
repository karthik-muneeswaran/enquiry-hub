#!/bin/bash
# Let's Encrypt SSL Certificate Provisioning with Auto-Renewal
# Usage: ./setup-ssl.sh <domain> [email]
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain> [email]"
  echo "Example: $0 yourdomain.com admin@yourdomain.com"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@$DOMAIN"
  echo "No email provided, using: $EMAIL"
fi

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run as root."
  exit 1
fi

echo "=========================================="
echo " Let's Encrypt SSL Setup"
echo " Domain: $DOMAIN"
echo " Email:  $EMAIL"
echo "=========================================="

# ─── 1. Install Certbot ───
echo "[1/4] Installing Certbot..."
apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx

# ─── 2. Obtain Certificate ───
echo "[2/4] Obtaining SSL certificate for $DOMAIN..."
certbot certonly \
  --nginx \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --domain "$DOMAIN" \
  --domain "www.$DOMAIN"

echo "  Certificate obtained successfully."
echo "  Fullchain: /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  Private key: /etc/letsencrypt/live/$DOMAIN/privkey.pem"

# ─── 3. Configure Auto-Renewal ───
echo "[3/4] Configuring auto-renewal..."

# Create a renewal hook to reload Nginx after renewal
mkdir -p /etc/letsencrypt/renewal-hooks/post
cat > /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh <<'EOF'
#!/bin/bash
# Reload Nginx after certificate renewal
nginx -t && systemctl reload nginx
EOF
chmod +x /etc/letsencrypt/renewal-hooks/post/reload-nginx.sh

# Set up systemd timer for renewal (runs twice daily)
cat > /etc/systemd/system/certbot-renewal.timer <<EOF
[Unit]
Description=Certbot renewal timer

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/certbot-renewal.service <<EOF
[Unit]
Description=Certbot renewal service
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet
EOF

systemctl daemon-reload
systemctl enable certbot-renewal.timer
systemctl start certbot-renewal.timer

echo "  Auto-renewal configured (runs twice daily via systemd timer)."

# ─── 4. Verify ───
echo "[4/4] Verifying certificate and renewal..."
certbot certificates --domain "$DOMAIN"

# Test renewal (dry-run)
certbot renew --dry-run --quiet && echo "  Dry-run renewal: OK" || echo "  WARNING: Dry-run renewal failed."

echo ""
echo "=========================================="
echo " SSL Setup Complete!"
echo "=========================================="
echo ""
echo " Certificate paths (for Nginx config):"
echo "   ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;"
echo "   ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;"
echo ""
echo " Auto-renewal is active. Certificates renew automatically before expiry."
echo " Nginx will be reloaded after each renewal."
