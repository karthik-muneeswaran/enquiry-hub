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
echo "[3/4] Generating production secrets..."

HMAC_SECRET=$(openssl rand -hex 32)
API_KEY=$(openssl rand -hex 16)
ADMIN_API_KEY=$(openssl rand -hex 24)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
WP_DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
WP_ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)
GRAFANA_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)

echo "  Secrets generated."

# ─── 4. Print secrets ───
echo "[4/4] Done!"
echo ""
echo "=========================================="
echo " Project Setup Complete!"
echo "=========================================="
echo ""
echo " Project: $PROJECT_DIR"
echo ""
echo " Generated Credentials (use these in your .env files):"
echo " ─────────────────────────────────────"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo "   HMAC_SECRET=$HMAC_SECRET"
echo "   API_KEY=$API_KEY"
echo "   ADMIN_API_KEY=$ADMIN_API_KEY"
echo "   WP_DB_PASSWORD=$WP_DB_PASSWORD"
echo "   MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"
echo "   WP_ADMIN_PASSWORD=$WP_ADMIN_PASSWORD"
echo "   GRAFANA_PASSWORD=$GRAFANA_PASSWORD"
echo " ─────────────────────────────────────"
echo ""
echo " NEXT:"
echo "   1. Copy these values into your local backend/.env.prod"
echo "   2. Paste the final .env content on the server:"
echo "      cat > /opt/enquiry-platform/backend/.env << 'EOF'"
echo "      <paste your .env content here>"
echo "      EOF"
echo "   3. Same for frontend/.env"
echo "   4. Run: chmod +x scripts/deploy-production.sh && ./scripts/deploy-production.sh"
echo ""
