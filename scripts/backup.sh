#!/bin/bash
# PostgreSQL Automated Backup Script
# Retention policy: 7 daily, 4 weekly, 3 monthly
set -euo pipefail

# Configuration (override via environment variables)
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-enquiry_platform}"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting PostgreSQL backup..."

# Full compressed dump
BACKUP_FILE="$BACKUP_DIR/daily_${TIMESTAMP}.sql.gz"
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date -Iseconds)] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Weekly backup (every Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  cp "$BACKUP_FILE" "$BACKUP_DIR/weekly_${TIMESTAMP}.sql.gz"
  echo "[$(date -Iseconds)] Weekly backup saved."
fi

# Monthly backup (1st of the month)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
  cp "$BACKUP_FILE" "$BACKUP_DIR/monthly_${TIMESTAMP}.sql.gz"
  echo "[$(date -Iseconds)] Monthly backup saved."
fi

# Retention: 7 daily, 4 weekly (30 days), 3 monthly (90 days)
find "$BACKUP_DIR" -name "daily_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "weekly_*.sql.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "monthly_*.sql.gz" -mtime +90 -delete

echo "[$(date -Iseconds)] Retention policy applied. Backup completed successfully."
