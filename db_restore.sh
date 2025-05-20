#!/bin/bash
# ReactStock Database Restore Script
# This script restores a database from a backup file

# Configuration
DB_NAME="reactstock"
DB_USER="postgres"
BACKUP_DIR="backups"
LOG_FILE="${BACKUP_DIR}/restore_log.txt"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_YELLOW="\033[0;33m"
COLOR_RESET="\033[0m"

# Log function
log() {
    echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$LOG_FILE"
}

print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${COLOR_RESET}" | tee -a "$LOG_FILE"
}

# Function to list available backups
list_backups() {
    echo "Available backups:"
    
    # Check if backup directory exists and has files
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR)" ]; then
        print_color "$COLOR_RED" "No backups found in $BACKUP_DIR directory."
        exit 1
    fi
    
    # List backups with numbering
    i=1
    for backup in $(ls -t $BACKUP_DIR/*.{sql,dump,dir,tar} 2>/dev/null); do
        size=$(du -h "$backup" | cut -f1)
        created=$(stat -c "%y" "$backup" | cut -d. -f1)
        echo "[$i] $(basename $backup) (Size: $size, Created: $created)"
        i=$((i+1))
    done
}

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_color "$COLOR_RED" "ERROR: PostgreSQL is not installed or not in the PATH"
    exit 1
fi

# Ensure backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    print_color "$COLOR_RED" "ERROR: Backup directory '$BACKUP_DIR' does not exist."
    exit 1
fi

log "==== Starting ReactStock Database Restore ===="

# List available backups
list_backups

# Prompt user to select a backup
echo ""
echo "Enter the number of the backup to restore or the full path to a backup file:"
read -r selection

# Determine the backup file
if [[ "$selection" =~ ^[0-9]+$ ]]; then
    # User entered a number, select from the list
    i=1
    for backup in $(ls -t $BACKUP_DIR/*.{sql,dump,dir,tar} 2>/dev/null); do
        if [ "$i" -eq "$selection" ]; then
            BACKUP_FILE="$backup"
            break
        fi
        i=$((i+1))
    done
    
    if [ -z "$BACKUP_FILE" ]; then
        print_color "$COLOR_RED" "ERROR: Invalid selection number."
        exit 1
    fi
else
    # User entered a path
    BACKUP_FILE="$selection"
    if [ ! -f "$BACKUP_FILE" ] && [ ! -d "$BACKUP_FILE" ]; then
        print_color "$COLOR_RED" "ERROR: Backup file/directory '$BACKUP_FILE' does not exist."
        exit 1
    fi
fi

log "Selected backup: $BACKUP_FILE"

# Determine backup format
if [ -d "$BACKUP_FILE" ]; then
    FORMAT="directory"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    FORMAT="plain"
elif [[ "$BACKUP_FILE" == *.dump ]]; then
    FORMAT="custom"
elif [[ "$BACKUP_FILE" == *.tar ]]; then
    FORMAT="tar"
else
    print_color "$COLOR_RED" "ERROR: Cannot determine backup format from file extension."
    exit 1
fi

log "Backup format detected: $FORMAT"

# Check if database exists
DB_EXISTS=false
if psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    DB_EXISTS=true
    print_color "$COLOR_YELLOW" "WARNING: Database '$DB_NAME' already exists."
    echo "Do you want to drop and recreate it? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log "Dropping existing database..."
        dropdb -U $DB_USER $DB_NAME
        if [ $? -ne 0 ]; then
            print_color "$COLOR_RED" "ERROR: Failed to drop existing database."
            exit 1
        fi
        
        log "Creating fresh database..."
        createdb -U $DB_USER $DB_NAME
        if [ $? -ne 0 ]; then
            print_color "$COLOR_RED" "ERROR: Failed to create fresh database."
            exit 1
        fi
    else
        print_color "$COLOR_YELLOW" "WARNING: Restoration will attempt to restore over the existing database."
        echo "This may fail if there are conflicts. Continue? (y/n)"
        read -r continue_response
        if [[ ! "$continue_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            print_color "$COLOR_YELLOW" "Restore operation cancelled by user."
            exit 0
        fi
    fi
else
    log "Creating database '$DB_NAME'..."
    createdb -U $DB_USER $DB_NAME
    if [ $? -ne 0 ]; then
        print_color "$COLOR_RED" "ERROR: Failed to create database."
        exit 1
    fi
fi

# Restore the database
log "Restoring database from backup..."
echo "This may take a while depending on the size of the backup..."

case "$FORMAT" in
    "plain")
        psql -U $DB_USER -d $DB_NAME -f "$BACKUP_FILE"
        ;;
    "custom"|"tar")
        pg_restore -U $DB_USER -d $DB_NAME "$BACKUP_FILE"
        ;;
    "directory")
        pg_restore -U $DB_USER -d $DB_NAME -D "$BACKUP_FILE"
        ;;
esac

# Check restoration result
if [ $? -ne 0 ]; then
    print_color "$COLOR_YELLOW" "WARNING: Restore completed with some errors."
    echo "Some errors during restore are normal due to constraints or existing objects."
    echo "Would you like to see the database tables to verify the restore? (y/n)"
    read -r verify_response
    if [[ "$verify_response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Tables in $DB_NAME database:"
        psql -U $DB_USER -d $DB_NAME -c "\dt"
    fi
else
    print_color "$COLOR_GREEN" "Restore completed successfully."
fi

# Display key tables and their counts
echo "Verifying key tables:"
tables=("users" "items" "boxes" "locations" "shelves")
for table in "${tables[@]}"; do
    count=$(psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d '[:space:]')
    if [ -n "$count" ]; then
        print_color "$COLOR_GREEN" "Table $table: $count rows"
    else
        print_color "$COLOR_RED" "Table $table not found or error counting rows"
    fi
done

log "==== Database Restore Complete ===="
print_color "$COLOR_GREEN" "ReactStock database has been restored from $BACKUP_FILE"

exit 0 