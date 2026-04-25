#!/bin/bash
# ==============================================================================
# Secure Automated PostgreSQL Database Backup Script
# Automatically dumps, compresses, and archives the Dockerized database.
# ==============================================================================

# Define strict bash parameters to fail fast on errors
set -e
set -u
set -o pipefail

# --- Configuration Variables ---
DB_CONTAINER_NAME="brainstorm_postgres"
DB_USER="brainstorm_admin"
DB_NAME="brainstorm_db"

# Destination path on the VPS host system
BACKUP_DIR="/var/backups/brainstorm_db_backups"

# Formatted timestamp for secure versioning (e.g., 20260501_030000)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/brainstorm_backup_${TIMESTAMP}.sql.gz"

# ------------------------------------------------------------------------------
# 1. Directory Initialization & Security
# ------------------------------------------------------------------------------
# Ensure the backup directory exists
mkdir -p "$BACKUP_DIR"

# Lock down permissions immediately so only root can access the encrypted dumps
chmod 700 "$BACKUP_DIR"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Initiating database backup..."

# ------------------------------------------------------------------------------
# 2. Execute Dump & Compression
# ------------------------------------------------------------------------------
# We execute pg_dump seamlessly through the running Docker container, pipe the
# raw SQL stream into gzip for high-ratio compression, and write to the host.
if docker exec "$DB_CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$BACKUP_FILE"; then
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup successful! Saved to: $BACKUP_FILE"
    
    # Secure ownership
    chmod 600 "$BACKUP_FILE"
else
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] CRITICAL ERROR: Backup failed!" >&2
    # Destroy corrupted partial backup file if it exists
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. Retention Policy Management (Prevent disk space exhaustion)
# ------------------------------------------------------------------------------
# Automatically delete backup archives older than 7 days
echo "[$(date +"%Y-%m-%d %H:%M:%S")] Executing retention policy cleanup..."
find "$BACKUP_DIR" -type f -name "brainstorm_backup_*.sql.gz" -mtime +7 -delete

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Process complete."

# ==============================================================================
# HOW TO INSTALL AS CRON JOB (Every day at 03:00 AM)
# ==============================================================================
# Run: sudo crontab -e
# Add the following line to the bottom:
# 0 3 * * * /bin/bash /path/to/project/scripts/backup.sh >> /var/log/brainstorm_backup.log 2>&1
