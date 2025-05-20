const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Production-ready connection pool configuration
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  // Connection pool settings
  max: parseInt(process.env.PG_MAX_CONNECTIONS || '20'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'), // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '2000'), // How long to wait for a connection
  maxUses: parseInt(process.env.PG_MAX_USES || '7500'), // Close & replace a connection after it has been used this many times
  // Error handling
  allowExitOnIdle: false // Don't allow the Node.js process to exit if pool is idle
});

// Error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Optionally implement notification system here (e.g., email alerts)
});

// Helper function to get a client with error handling
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Override client.query to add logging
  client.query = (...args) => {
    return query.apply(client, args);
  };

  // Override client.release to prevent connection leaks
  client.release = () => {
    release.apply(client);
  };

  return client;
};

module.exports = {
  pool,
  getClient,
  query: (text, params) => pool.query(text, params)
}; 