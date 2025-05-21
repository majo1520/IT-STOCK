# ReactStock Migration Guide: localStorage to PostgreSQL

This guide will help you migrate your ReactStock application data from browser localStorage to PostgreSQL database.

## Why Migrate?

Using localStorage for data storage has several limitations:
- Data is stored only in the user's browser
- Limited storage capacity (typically 5-10MB)
- No data sharing between users or devices
- Data can be lost when clearing browser cache
- No proper data validation or relationships

PostgreSQL provides:
- Centralized data storage
- Unlimited storage capacity
- Data sharing between users and devices
- Data persistence and backup capabilities
- Data validation and relationships
- Better performance for complex queries

## Migration Process

### Step 1: Run Database Migrations

First, make sure your PostgreSQL database has the latest schema:

```bash
cd reactstock/backend
node run_migrations.js
```

### Step 2: Export localStorage Data

1. Open your ReactStock application in the browser
2. Open the browser developer tools (F12 or Ctrl+Shift+I)
3. Go to the Console tab
4. Run the following command to export all localStorage data:

```javascript
copy(JSON.stringify(Object.keys(localStorage).reduce((obj, key) => {
  obj[key] = localStorage.getItem(key);
  return obj;
}, {})))
```

5. Paste the copied data into a file named `localstorage_export.json` in the `reactstock/backend` directory

### Step 3: Run the Migration Script

```bash
cd reactstock/backend
node migrate_from_localstorage.js
```

This script will:
1. Read the exported localStorage data
2. Connect to your PostgreSQL database
3. Migrate item transactions
4. Migrate item properties
5. Migrate customers
6. Migrate roles
7. Migrate removal reasons

### Step 4: Verify the Migration

After running the migration script, you should verify that all your data has been successfully migrated:

```bash
cd reactstock/backend
node
```

```javascript
// In the Node.js REPL
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool();
const client = await pool.connect();

// Check item transactions
const transactions = await client.query('SELECT COUNT(*) FROM item_transactions');
console.log('Item transactions:', transactions.rows[0].count);

// Check item properties
const properties = await client.query('SELECT COUNT(*) FROM item_properties');
console.log('Item properties:', properties.rows[0].count);

// Check customers
const customers = await client.query('SELECT COUNT(*) FROM customers');
console.log('Customers:', customers.rows[0].count);

// Check roles
const roles = await client.query('SELECT COUNT(*) FROM roles');
console.log('Roles:', roles.rows[0].count);

// Check removal reasons
const reasons = await client.query('SELECT COUNT(*) FROM removal_reasons');
console.log('Removal reasons:', reasons.rows[0].count);

client.release();
pool.end();
```

### Step 5: Update Frontend Configuration

The frontend has been updated to use the PostgreSQL database by default, with localStorage as a fallback if the API calls fail. No additional configuration is needed.

### Step 6: Clear localStorage (Optional)

After confirming that all data has been successfully migrated, you may want to clear the localStorage to avoid any confusion:

```javascript
// In the browser console
localStorage.clear();
```

## Troubleshooting

### Migration Script Errors

If the migration script encounters errors:

1. Check the error message for details
2. Verify that your PostgreSQL database is running and accessible
3. Check that the database schema is up to date
4. Verify that the exported localStorage data is valid JSON

### Data Inconsistencies

If you notice any data inconsistencies after migration:

1. Compare the data in localStorage with the data in PostgreSQL
2. Check for any data type conversion issues
3. Look for any missing or duplicate records

### API Errors

If you encounter API errors after migration:

1. Check the server logs for details
2. Verify that all API endpoints are working correctly
3. Check for any missing or incorrect data in the database

## Need Help?

If you encounter any issues during the migration process, please open an issue on the ReactStock GitHub repository or contact the ReactStock support team. 