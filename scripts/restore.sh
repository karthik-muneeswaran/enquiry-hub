#!/bin/bash
# PostgreSQL Restore Script
# Usage: ./restore.sh <backup_file.sql.gz>
set -euo pipefail

# Configuration (override via environment variables)
DB_HOST="${DB_HOST:-postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-enquiry_platform}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Example: $0 /backups/postgres/daily_20250101_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date -Iseconds)] Starting database restore from: $BACKUP_FILE"
echo "WARNING: This will overwrite the current database '$DB_NAME'."
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

# Drop and recreate the database to ensure a clean restore
echo "[$(date -Iseconds)] Dropping and recreating database '$DB_NAME'..."
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

# Restore from compressed backup
echo "[$(date -Iseconds)] Restoring data..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME"

echo "[$(date -Iseconds)] Database restore completed successfully."
