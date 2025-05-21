# ReactStock Migration Guide

This guide will help you migrate your ReactStock application data from browser localStorage to PostgreSQL database.

## Migration Scripts

The following scripts are available to help with the migration process:

1. `export_localstorage.js` - Provides instructions for exporting localStorage data from the browser
2. `run_migrations.js` - Runs SQL migrations to set up the database schema
3. `migrate_from_localstorage.js` - Migrates data from localStorage to PostgreSQL
4. `fix_migration.js` - Fixes any issues with the migration (if needed)
5. `verify_migration.js` - Verifies the migration by counting records
6. `check_database.js` - Checks the database schema and tables
7. `check_data.js` - Checks the data in the tables
8. `migrate.js` - Runs the entire migration process

## Migration Process

### Step 1: Export localStorage Data

First, you need to export your localStorage data from the browser:

```bash
node export_localstorage.js
```

This will show instructions on how to export your localStorage data. Follow these instructions to create a `localstorage_export.json` file in this directory.

### Step 2: Run the Migration

Once you have created the `localstorage_export.json` file, run the migration process:

```bash
node migrate.js
```

This script will:
1. Run database migrations to create necessary tables
2. Migrate your localStorage data to PostgreSQL
3. Verify the migration by counting records in each table

### Step 3: Fix the Migration (if needed)

If the migration was not successful, you can run the fix script:

```bash
node fix_migration.js
```

This will attempt to fix any issues with the migration.

### Step 4: Verify the Migration

To verify that the migration was successful:

```bash
node check_data.js
```

This will show the data in each table.

## Troubleshooting

If you encounter any issues during the migration process:

1. Check that your PostgreSQL database is running and accessible
2. Verify that your `.env` file contains the correct database credentials
3. Make sure your `localstorage_export.json` file is valid JSON
4. Run the `check_database.js` script to check the database schema
5. Run the `fix_migration.js` script to fix any issues with the migration

## Migration Results

After a successful migration, you should see:
- Items migrated to the `items` table
- Item transactions migrated to the `item_transactions` table
- Item properties migrated to the `item_properties` table
- Customers migrated to the `customers` table
- Roles migrated to the `roles` table

## After Migration

After successful migration, your ReactStock application will automatically use the PostgreSQL database for data storage. localStorage will only be used as a fallback if the database is unavailable. 