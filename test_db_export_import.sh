#!/bin/bash
# ReactStock Database Export and Import Test Script
# Tests the functionality of database backup/restore operations

# Configuration
DB_NAME="reactstock"
DB_USER="postgres"
TEST_DB_NAME="reactstock_test"
EXPORT_FILE="reactstock_db_export.sql"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_RESET="\033[0m"

echo "===== ReactStock Database Export/Import Test ====="
echo "This script will test database export and import operations."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${COLOR_RED}Error: PostgreSQL is not installed or not in the PATH${COLOR_RESET}"
    echo "Please install PostgreSQL and try again"
    exit 1
fi

# Function to print success message
print_success() {
    echo -e "${COLOR_GREEN}✓ $1${COLOR_RESET}"
}

# Function to print error message
print_error() {
    echo -e "${COLOR_RED}✗ $1${COLOR_RESET}"
    exit 1
}

# Check if the source database exists
echo "Checking if source database exists..."
if ! psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    print_error "Source database '$DB_NAME' does not exist. Please run setup_database.sh first."
fi
print_success "Source database '$DB_NAME' exists"

# Export the database
echo "Exporting database to $EXPORT_FILE..."
pg_dump -U $DB_USER -d $DB_NAME -f $EXPORT_FILE
if [ $? -ne 0 ]; then
    print_error "Failed to export database"
fi
print_success "Database exported successfully"

# Check export file size
EXPORT_SIZE=$(du -h $EXPORT_FILE | cut -f1)
echo "Export file size: $EXPORT_SIZE"

# Drop test database if it already exists
echo "Checking if test database already exists..."
if psql -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $TEST_DB_NAME; then
    echo "Dropping existing test database..."
    dropdb -U $DB_USER $TEST_DB_NAME
    if [ $? -ne 0 ]; then
        print_error "Failed to drop existing test database"
    fi
    print_success "Existing test database dropped"
fi

# Create test database
echo "Creating test database..."
createdb -U $DB_USER $TEST_DB_NAME
if [ $? -ne 0 ]; then
    print_error "Failed to create test database"
fi
print_success "Test database created"

# Import database into test database
echo "Importing database into test database..."
psql -U $DB_USER -d $TEST_DB_NAME -f $EXPORT_FILE
if [ $? -ne 0 ]; then
    print_error "Failed to import database"
fi
print_success "Database imported successfully"

# Verify data integrity by checking table counts
echo "Verifying data integrity..."

# Function to get table row count
get_table_count() {
    local db=$1
    local table=$2
    psql -U $DB_USER -d $db -t -c "SELECT COUNT(*) FROM $table;" | tr -d '[:space:]'
}

# Check major tables
tables=("users" "items" "boxes" "locations" "shelves")
for table in "${tables[@]}"; do
    SOURCE_COUNT=$(get_table_count $DB_NAME $table)
    TEST_COUNT=$(get_table_count $TEST_DB_NAME $table)
    
    echo -n "Table $table: "
    if [ "$SOURCE_COUNT" = "$TEST_COUNT" ]; then
        print_success "matched ($SOURCE_COUNT rows)"
    else
        print_error "count mismatch ($SOURCE_COUNT in source, $TEST_COUNT in test)"
    fi
done

# Verify materialized view
echo -n "Materialized view items_complete_view: "
SOURCE_COUNT=$(get_table_count $DB_NAME "items_complete_view")
TEST_COUNT=$(get_table_count $TEST_DB_NAME "items_complete_view")
    
if [ "$SOURCE_COUNT" = "$TEST_COUNT" ]; then
    print_success "matched ($SOURCE_COUNT rows)"
else
    print_error "count mismatch ($SOURCE_COUNT in source, $TEST_COUNT in test)"
fi

# Cleanup
echo "Cleaning up..."
echo "Do you want to drop the test database and remove the export file? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Dropping test database..."
    dropdb -U $DB_USER $TEST_DB_NAME
    if [ $? -ne 0 ]; then
        print_error "Failed to drop test database"
    fi
    print_success "Test database dropped"
    
    echo "Removing export file..."
    rm $EXPORT_FILE
    if [ $? -ne 0 ]; then
        print_error "Failed to remove export file"
    fi
    print_success "Export file removed"
else
    echo "Keeping test database and export file for further inspection"
fi

echo "===== Test completed successfully ====="
echo "The database export and import functions are working correctly."
echo "You can use the following commands for backup and restore operations:"
echo "Backup: pg_dump -U $DB_USER -d $DB_NAME -f backup_filename.sql"
echo "Restore: psql -U $DB_USER -d database_name -f backup_filename.sql" 