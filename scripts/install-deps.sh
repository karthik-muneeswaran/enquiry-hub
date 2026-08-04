#!/bin/bash
# =============================================================================
# Install Production Dependencies
# Run as the deploy user AFTER harden-vps.sh has completed.
# Only installs Docker and Docker Compose — everything else runs in containers.
#
# Usage: bash scripts/install-deps.sh
# =============================================================================
set -euo pipefail

echo "=========================================="
echo " Installing Production Dependencies"
echo "=========================================="
echo ""
echo " All application services run in Docker containers."
echo " No Node.js, PM2, or databases installed on the host."
echo ""

# ─── 1. Docker Engine ───
echo "[1/2] Installing Docker..."
if command -v docker &>/dev/null; then
  echo "  Docker already installed: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "  Docker installed: $(docker --version)"
  echo ""
  echo "  NOTE: Log out and back in for docker group to take effect."
  echo "  Then re-run this script to verify."
  echo ""
  exit 0
fi

# ─── 2. Docker Compose ───
echo "[2/2] Installing Docker Compose..."
if docker compose version &>/dev/null; then
  echo "  Docker Compose already installed: $(docker compose version --short)"
else
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-compose-plugin
  echo "  Docker Compose installed: $(docker compose version --short)"
fi

# ─── Verify ───
echo ""
echo "=========================================="
echo " Dependencies installed!"
echo "=========================================="
echo ""
echo "  Docker:         $(docker --version)"
echo "  Docker Compose: $(docker compose version --short)"
echo ""
echo " Everything else (Node.js, PostgreSQL, Redis, Nginx, PM2)"
echo " runs inside Docker containers. No host-level installs needed."
echo ""
echo " NEXT: Run setup-project.sh to clone the repo and configure env files."
echo ""
