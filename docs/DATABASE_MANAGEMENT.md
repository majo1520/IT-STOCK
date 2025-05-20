# ReactStock Database Management

This document describes how to manage the ReactStock PostgreSQL database, including setup, backup, restore, and maintenance operations.

## Overview

ReactStock uses PostgreSQL as its database management system. The database schema includes tables for users, items, boxes, locations, transactions, and more. To simplify database management, we've created several utility scripts:

- `setup_database.sh` - Initial database setup
- `test_db_export_import.sh` - Test database export and import
- `db_backup.sh` - Automated database backups
- `db_restore.sh` - Database restoration

## Initial Setup

When setting up ReactStock for the first time, you need to create the database schema:

1. Make sure PostgreSQL is installed and running
2. Run the setup script:

```bash
./setup_database.sh
```

This script will:
1. Create a database named "reactstock"
2. Run the `setup.sql` script which creates all tables, views, functions, and indexes
3. Create a default admin user

## Database Export and Import Testing

To verify that database backup and restoration works correctly, use:

```bash
./test_db_export_import.sh
```

This script performs a complete test of the export/import process:
1. Exports the current "reactstock" database to a SQL file
2. Creates a test database named "reactstock_test"
3. Imports the SQL file into the test database
4. Compares table counts between the original and test databases
5. Optionally cleans up the test database and export file

## Regular Backups

Regular database backups are essential for data safety. The backup script supports multiple PostgreSQL formats:

- **Plain**: Standard SQL dump (human-readable)
- **Custom**: PostgreSQL's custom format (compressed, supports selective restore)
- **Directory**: Directory format (supports parallel restore)
- **Tar**: Tar archive format

To perform a backup:

```bash
./db_backup.sh
```

Backups are stored in the `backups` directory with timestamps in the filename. The script keeps the 7 most recent backups by default (configurable in the script).

### Scheduling Automated Backups

For production systems, it's recommended to schedule regular backups using cron:

```bash
# Edit crontab
crontab -e

# Add a line to run backups daily at 2 AM
0 2 * * * /path/to/reactstock/db_backup.sh
```

## Database Restoration

If you need to restore the database from a backup:

```bash
./db_restore.sh
```

The restore script will:
1. List available backups
2. Let you select a backup file
3. Detect the backup format (plain, custom, directory, or tar)
4. Drop the existing database if requested
5. Restore the database from the backup
6. Verify key tables after restoration

## Database Migration Between Environments

To migrate the database from one environment to another (e.g., from development to production):

1. Create a backup on the source environment:
   ```bash
   ./db_backup.sh
   ```

2. Copy the backup file to the target environment
   ```bash
   scp backups/reactstock_20230525_123456.dump user@target-server:/path/to/reactstock/backups/
   ```

3. On the target environment, restore from the backup:
   ```bash
   ./db_restore.sh
   ```
   
4. Select the copied backup file when prompted

## Best Practices

1. **Regular Backups**: Schedule daily automatic backups
2. **Offsite Storage**: Copy backups to a different physical location or cloud storage
3. **Backup Testing**: Regularly test restoring from backup
4. **Backup Before Upgrades**: Always backup before upgrading ReactStock
5. **Monitor Disk Space**: Ensure there's enough disk space for database and backups
6. **Secure Backups**: Protect backup files as they contain all your data

## Troubleshooting

### Database Connection Issues

If you encounter connection issues:

1. Verify PostgreSQL is running: `ps aux | grep postgres`
2. Check connection parameters in scripts: DB_USER, DB_NAME
3. Verify PostgreSQL authentication settings: `pg_hba.conf`

### Backup/Restore Errors

Common backup/restore errors:

1. **Permission denied**: Run scripts as a user with PostgreSQL access
2. **Space issues**: Ensure enough disk space for backups
3. **Format errors**: Make sure you're using the correct restore method for the backup format

## Additional PostgreSQL Commands

Some useful PostgreSQL commands:

```bash
# Connect to the database
psql -U postgres -d reactstock

# List all tables
\dt

# View database size
SELECT pg_size_pretty(pg_database_size('reactstock'));

# Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'reactstock';

# Vacuum the database (reclaim space and optimize)
VACUUM FULL;
``` 