#!/bin/bash
# ReactStock Database Backup Script
# This script creates a database backup and manages backup retention

# Configuration
DB_NAME="reactstock"
DB_USER="postgres"
BACKUP_DIR="backups"
MAX_BACKUPS=7  # Number of backups to keep
BACKUP_FORMAT="custom"  # Options: plain, custom, directory, or tar
DATE_FORMAT=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE_FORMAT}.pg_dump"
LOG_FILE="${BACKUP_DIR}/backup_log.txt"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Log function
log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$LOG_FILE"
}

log "==== Starting ReactStock Database Backup ===="
log "Database: $DB_NAME"
log "Output File: $BACKUP_FILE"

# Check if PostgreSQL is installed
if ! command -v pg_dump &> /dev/null; then
    log "ERROR: PostgreSQL is not installed or not in the PATH"
    exit 1
fi

# Check if database exists
if ! psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    log "ERROR: Database '$DB_NAME' does not exist."
    exit 1
fi

# Create backup based on format
case "$BACKUP_FORMAT" in
    "plain")
        log "Creating plain text SQL backup..."
        pg_dump -U $DB_USER -d $DB_NAME -f "${BACKUP_FILE}.sql"
        BACKUP_FILE="${BACKUP_FILE}.sql"
        ;;
    "custom")
        log "Creating custom format backup..."
        pg_dump -U $DB_USER -d $DB_NAME -Fc -f "${BACKUP_FILE}.dump"
        BACKUP_FILE="${BACKUP_FILE}.dump"
        ;;
    "directory")
        log "Creating directory format backup..."
        pg_dump -U $DB_USER -d $DB_NAME -Fd -f "${BACKUP_FILE}.dir"
        BACKUP_FILE="${BACKUP_FILE}.dir"
        ;;
    "tar")
        log "Creating tar format backup..."
        pg_dump -U $DB_USER -d $DB_NAME -Ft -f "${BACKUP_FILE}.tar"
        BACKUP_FILE="${BACKUP_FILE}.tar"
        ;;
    *)
        log "ERROR: Invalid backup format specified. Using custom format."
        pg_dump -U $DB_USER -d $DB_NAME -Fc -f "${BACKUP_FILE}.dump"
        BACKUP_FILE="${BACKUP_FILE}.dump"
        ;;
esac

# Check if backup was successful
if [ $? -ne 0 ]; then
    log "ERROR: Database backup failed."
    exit 1
fi

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup created successfully (Size: $BACKUP_SIZE)"

# Delete old backups if MAX_BACKUPS is exceeded
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.$BACKUP_FORMAT 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    log "Removing old backups to maintain maximum of $MAX_BACKUPS backups..."
    ls -t "$BACKUP_DIR"/*.$BACKUP_FORMAT | tail -n +$(($MAX_BACKUPS + 1)) | xargs rm -f
    log "Old backups removed."
fi

log "Backup job completed successfully."
log "To restore this backup, use the following command:"

# Print restore command based on format
case "$BACKUP_FORMAT" in
    "plain")
        log "psql -U $DB_USER -d $DB_NAME -f $BACKUP_FILE"
        ;;
    "custom")
        log "pg_restore -U $DB_USER -d $DB_NAME $BACKUP_FILE"
        ;;
    "directory")
        log "pg_restore -U $DB_USER -d $DB_NAME -D $BACKUP_FILE"
        ;;
    "tar")
        log "pg_restore -U $DB_USER -d $DB_NAME $BACKUP_FILE"
        ;;
esac

log "==== Backup Complete ===="

# Print summary to console
echo "Backup completed successfully."
echo "Backup file: $BACKUP_FILE (Size: $BACKUP_SIZE)"
echo "Backup log: $LOG_FILE"

exit 0 