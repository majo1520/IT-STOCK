# ReactStock Backend

This is the backend API for the ReactStock inventory management system.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the environment example file and update it with your settings:
   ```
   cp env.example .env
   ```
4. Start the server:
   ```
   npm start
   ```

## Database Migrations

The application uses a custom migration system to manage database schema changes. Migrations are automatically run when the server starts.

### Available Migration Commands

- Run all pending migrations:
  ```
  npm run migrate
  ```

- Rollback the last applied migration:
  ```
  npm run migrate:down
  ```

- Create a new migration:
  ```
  npm run migrate:create your_migration_name
  ```

### Migration Files

Migration files are stored in the `migrations` directory and are executed in alphabetical order. Each migration file should export `up` and `down` functions:

```javascript
// Example migration file
const { pool } = require('../config/database');

// Up migration - adds new features
exports.up = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Your migration code here
    await client.query('CREATE TABLE example (id SERIAL PRIMARY KEY, name TEXT)');
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Down migration - reverts changes
exports.down = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Your rollback code here
    await client.query('DROP TABLE IF EXISTS example');
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
```

## Database Connection Pool

The application uses a PostgreSQL connection pool with the following configurable parameters (via environment variables):

- `PG_MAX_CONNECTIONS`: Maximum number of clients in the pool (default: 20)
- `PG_IDLE_TIMEOUT`: How long a client is allowed to remain idle before being closed (default: 30000ms)
- `PG_CONNECTION_TIMEOUT`: How long to wait for a connection (default: 2000ms)
- `PG_MAX_USES`: Close & replace a connection after it has been used this many times (default: 7500)

## API Documentation

API endpoints are organized by resource:

- `/api/auth/*` - Authentication endpoints
- `/api/boxes/*` - Box management
- `/api/items/*` - Item management
- `/api/customers/*` - Customer management
- `/api/users/*` - User management (admin only)
- `/api/locations/*` - Location management
- `/api/shelves/*` - Shelf management
- `/api/colors/*` - Color management
- `/api/groups/*` - Group management
- `/api/roles` - Role information
- `/api/removal-reasons` - Removal reason options 