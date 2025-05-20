#!/bin/bash

# ReactStock Database Setup Script
# This script initializes the PostgreSQL database for the ReactStock application

# Configuration
DB_NAME="reactstock"
DB_USER="postgres"
SQL_FILE="setup.sql"

echo "===== ReactStock Database Setup ====="
echo "Setting up database: $DB_NAME"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "Error: PostgreSQL is not installed or not in the PATH"
    echo "Please install PostgreSQL and try again"
    exit 1
fi

# Create database if it doesn't exist
echo "Creating database if it doesn't exist..."
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8' TEMPLATE template0;" || echo "Database already exists or couldn't be created (this is okay if it exists)"

# Run the SQL setup file
echo "Running SQL setup script..."
psql -U $DB_USER -d $DB_NAME -f $SQL_FILE

if [ $? -eq 0 ]; then
    echo "===== Database setup completed successfully ====="
    echo "ReactStock database is now ready to use!"
else
    echo "Error: Database setup failed"
    exit 1
fi

# Optional: Create a default admin user (already in the SQL script, but can be added here as well)
# echo "Creating default admin user..."
# psql -U $DB_USER -d $DB_NAME -c "INSERT INTO users (username, password, email, role) VALUES ('admin', '\$2b\$10\$LPm39.tHuxLnN1zAYssnXu3LDz09v4e1sYGkKP9Gwrb39u7uKMwoa', 'admin@reactstock.com', 'admin') ON CONFLICT (username) DO NOTHING;"

echo "Default login: admin / adminpass"
echo ""
echo "Note: For security reasons, please change the default password after first login." 