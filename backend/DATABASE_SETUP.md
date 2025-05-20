# ReactStock Database Fix Guide

This guide explains how to fix the issue where item details aren't displayed correctly in the items list after changes.

## Solution Overview

We've implemented two solutions:

1. **Fallback System (Already Implemented)**: The code now has fallback mechanisms to continue working even if the materialized view isn't set up.

2. **Materialized View System**: A PostgreSQL materialized view that provides a single source of truth for item data.

## Option 1: Simple Setup (Recommended)

We've created a script that will automatically set up the materialized view:

```bash
# Navigate to the backend directory
cd reactstock/backend

# Install any missing dependencies
npm install pg fs path

# Run the setup script
node setup_view.js
```

The script will:
- Connect to your PostgreSQL database
- Fix any inconsistencies between `items` and `item_properties` tables
- Create the materialized view and necessary triggers
- Set up indexes for faster queries

## Option 2: Manual Setup

If you prefer to run the SQL manually:

```bash
# Navigate to the backend directory
cd reactstock/backend

# Run the SQL script directly
psql -U your_postgres_user -d your_database_name -f src/database/safe_view_setup.sql
```

Replace `your_postgres_user` and `your_database_name` with your actual PostgreSQL credentials.

## Verifying the Setup

After running either setup method, you can verify that the materialized view was created by:

```bash
psql -U your_postgres_user -d your_database_name -c "SELECT COUNT(*) FROM items_complete_view;"
```

This should return the number of items in your database.

## Troubleshooting

### If the Setup Script Fails

If the setup script fails, the application will continue to work using the fallback system. The fallback system:

1. First tries to use the materialized view
2. If that fails, falls back to the original complex join queries
3. Ensures data consistency even without the materialized view

### Common Issues

1. **Database Connection**: Ensure your PostgreSQL credentials are correct. You can set them as environment variables:
   ```
   DB_USER=your_user DB_PASSWORD=your_password DB_NAME=your_database node setup_view.js
   ```

2. **Permissions**: Ensure your database user has permissions to create materialized views and triggers.

3. **Database Schema**: If your database schema is significantly different, you may need to adapt the SQL script.

## Benefits of This Solution

1. **Data Consistency**: Item details will now be consistently displayed after changes.
2. **Performance**: Queries are faster with indexed materialized views.
3. **Resilience**: The fallback system ensures the application works even without the view.
4. **Automatic Updates**: Triggers automatically refresh the view when data changes. 