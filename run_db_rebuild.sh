#!/bin/bash

# Script to run the database rebuild and restart the application
echo "==== Starting ReactStock Database Rebuild ===="

# Navigate to the project directory
cd "$(dirname "$0")"

# Make a database backup first
echo "1. Creating database backup..."
pg_dump -h localhost -U postgres -d reactstock -f ./backup_before_rebuild.sql

# Display backup success
if [ $? -eq 0 ]; then
  echo "✅ Database backup created: ./backup_before_rebuild.sql"
else
  echo "❌ Backup failed. Aborting rebuild for safety."
  exit 1
fi

# Stop the application 
echo "2. Stopping application..."
pm2 stop all

# Run the database rebuild script
echo "3. Running database rebuild..."
node rebuild_database.js

# Check if the rebuild was successful
if [ $? -eq 0 ]; then
  echo "✅ Database rebuild completed successfully"
else
  echo "❌ Database rebuild failed. Restoring from backup..."
  psql -h localhost -U postgres -d reactstock -f ./backup_before_rebuild.sql
  
  if [ $? -eq 0 ]; then
    echo "✅ Database restored from backup"
  else
    echo "❌ Database restore failed. Manual intervention required!"
    exit 1
  fi
fi

# Restart the application
echo "4. Restarting application..."
pm2 restart all

echo "==== ReactStock Database Rebuild Complete ===="
echo "You can now access the application again." 