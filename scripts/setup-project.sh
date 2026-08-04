#!/bin/bash
# =============================================================================
# Project Setup Script
# Clones the repo, generates secrets, and creates .env files.
# Run as the deploy user AFTER install-deps.sh has completed.
#
# Usage: bash scripts/setup-project.sh
# =============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-}"
PROJECT_DIR="/opt/enquiry-platform"

echo "=========================================="
echo " Project Setup"
echo "=========================================="
echo ""

# ─── 1. GitHub Authentication ───
echo "[1/5] Setting up GitHub authentication..."

if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  echo "  GitHub SSH auth already working."
else
  echo "  Generating deploy key for GitHub..."
  
  if [ ! -f ~/.ssh/github_deploy ]; then
    ssh-keygen -t ed25519 -C "deploy@enquiry-platform" -f ~/.ssh/github_deploy -N ""
  fi

  # Configure SSH to use this key for GitHub
  if ! grep -q "github.com" ~/.ssh/config 2>/dev/null; then
    cat >> ~/.ssh/config <<EOF

Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy
    StrictHostKeyChecking accept-new
EOF
    chmod 600 ~/.ssh/config
  fi

  echo ""
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ACTION REQUIRED: Add this deploy key to your GitHub repo"
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Go to: GitHub → Repo → Settings → Deploy Keys → Add"
  echo "  Title: enquiry-platform-vps"
  echo "  Key:"
  echo ""
  cat ~/.ssh/github_deploy.pub
  echo ""
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  read -p "  Press ENTER after adding the key to GitHub..."

  # Test connection
  if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "  GitHub SSH auth verified!"
  else
    echo "  WARNING: GitHub auth test didn't confirm. Proceeding anyway..."
  fi
fi

# ─── 2. Clone Repository ───
echo "[2/5] Cloning repository..."

if [ -d "$PROJECT_DIR/.git" ]; then
  echo "  Repository already cloned. Pulling latest..."
  cd "$PROJECT_DIR"
  git pull origin main
else
  sudo mkdir -p "$PROJECT_DIR"
  sudo chown deploy:deploy "$PROJECT_DIR"

  if [ -z "$REPO_URL" ]; then
    read -p "  Enter GitHub repo SSH URL (git@github.com:user/repo.git): " REPO_URL
  fi

  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
fi

echo "  Repository ready at $PROJECT_DIR"

# ─── 3. Generate Secrets ───
echo "[3/5] Generating production secrets..."

HMAC_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 16)
ADMIN_API_KEY=$(openssl rand -hex 24)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
WP_DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
WP_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)
GRAFANA_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)

echo "  Secrets generated."

# ─── 4. Create Backend .env ───
echo "[4/5] Creating backend/.env..."

cd "$PROJECT_DIR"

if [ -f backend/.env ]; then
  echo "  backend/.env already exists. Skipping (delete it first to regenerate)."
else
  cp backend/.env.prod backend/.env

  # Replace placeholders with generated secrets
  sed -i "s|CHANGE_ME_STRONG_PASSWORD|$DB_PASSWORD|g" backend/.env
  sed -i "s|CHANGE_ME_WP_DB_PASSWORD|$WP_DB_PASSWORD|g" backend/.env
  sed -i "s|CHANGE_ME_MYSQL_ROOT|$MYSQL_ROOT_PASSWORD|g" backend/.env
  sed -i "s|CHANGE_ME_WP_ADMIN|$WP_ADMIN_PASSWORD|g" backend/.env
  sed -i "s|CHANGE_ME_GRAFANA_PASS|$GRAFANA_PASSWORD|g" backend/.env
  sed -i "s|CHANGE_ME_GENERATE_WITH_openssl_rand_hex_32|$HMAC_SECRET|g" backend/.env
  sed -i "s|CHANGE_ME_GENERATE_WITH_openssl_rand_hex_16|$API_KEY|g" backend/.env
  sed -i "s|CHANGE_ME_GENERATE_WITH_openssl_rand_hex_24|$ADMIN_API_KEY|g" backend/.env

  echo "  backend/.env created with generated secrets."
fi

# ─── 5. Create Frontend .env ───
echo "[5/5] Creating frontend/.env..."

if [ -f frontend/.env ]; then
  echo "  frontend/.env already exists. Skipping (delete it first to regenerate)."
else
  cp frontend/.env.prod frontend/.env

  # Replace admin API key placeholder
  sed -i "s|CHANGE_ME_SAME_AS_BACKEND_ADMIN_API_KEY|$ADMIN_API_KEY|g" frontend/.env

  echo "  frontend/.env created."
fi

# ─── Summary ───
echo ""
echo "=========================================="
echo " Project Setup Complete!"
echo "=========================================="
echo ""
echo " Project: $PROJECT_DIR"
echo ""
echo " Generated Credentials (SAVE THESE):"
echo " ─────────────────────────────────────"
echo "   DB Password:       $DB_PASSWORD"
echo "   HMAC Secret:       $HMAC_SECRET"
echo "   API Key:           $API_KEY"
echo "   Admin API Key:     $ADMIN_API_KEY"
echo "   WP DB Password:    $WP_DB_PASSWORD"
echo "   MySQL Root Pass:   $MYSQL_ROOT_PASSWORD"
echo "   WP Admin Password: $WP_ADMIN_PASSWORD"
echo "   Grafana Password:  $GRAFANA_PASSWORD"
echo " ─────────────────────────────────────"
echo ""
echo " NEXT: Review backend/.env for SMTP and CRM settings, then run:"
echo "   cd $PROJECT_DIR"
echo "   nano backend/.env   # Update SMTP_HOST, SMTP_PASS, CRM_WEBHOOK_URL"
echo "   chmod +x scripts/deploy-production.sh"
echo "   sudo ./scripts/deploy-production.sh"
echo ""
