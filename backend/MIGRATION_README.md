# ReactStock Migration: localStorage to PostgreSQL

This directory contains scripts to help you migrate your ReactStock data from browser localStorage to a PostgreSQL database.

## Prerequisites

1. Node.js installed
2. PostgreSQL database set up
3. Environment variables configured in `.env` file:
   - `PGUSER`: PostgreSQL username
   - `PGHOST`: PostgreSQL host
   - `PGDATABASE`: PostgreSQL database name
   - `PGPASSWORD`: PostgreSQL password
   - `PGPORT`: PostgreSQL port (default: 5432)

## Migration Steps

### 1. Export localStorage Data

First, you need to export your localStorage data from the browser:

```bash
node export_localstorage.js
```

This will show instructions on how to export your localStorage data. Follow these instructions to create a `localstorage_export.json` file in this directory.

### 2. Run the Migration

Once you have created the `localstorage_export.json` file, run the migration process:

```bash
node migrate.js
```

This script will:
1. Run database migrations to create necessary tables
2. Migrate your localStorage data to PostgreSQL
3. Verify the migration by counting records in each table

### 3. Verify the Migration

If you want to verify the migration separately:

```bash
node verify_migration.js
```

This will show counts of records in each table.

## Individual Scripts

- `export_localstorage.js`: Shows instructions for exporting localStorage data
- `run_migrations.js`: Runs SQL migrations to set up the database schema
- `migrate_from_localstorage.js`: Migrates data from localStorage to PostgreSQL
- `verify_migration.js`: Verifies the migration by counting records
- `migrate.js`: Runs the entire migration process

## Troubleshooting

If you encounter any issues during migration:

1. Check that your PostgreSQL database is running and accessible
2. Verify that your `.env` file contains correct database credentials
3. Make sure your `localstorage_export.json` file is valid JSON
4. Check the console output for specific error messages

## After Migration

After successful migration, your ReactStock application will automatically use the PostgreSQL database for data storage. localStorage will only be used as a fallback if the database is unavailable. 