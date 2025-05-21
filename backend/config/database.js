const { Pool } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

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
  logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack });
  // Optionally implement notification system here (e.g., email alerts)
});

// Helper function to get a client with error handling
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Override client.query to add logging
  client.query = (...args) => {
    const [text, params] = args;
    logger.sql.logQuery(text, params);
    
    const start = Date.now();
    const result = query.apply(client, args);
    
    // For promise-based usage
    if (result && typeof result.then === 'function') {
      return result.then(res => {
        const duration = Date.now() - start;
        if (duration > 1000) { // Log slow queries regardless of settings
          logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
        }
        logger.sql.logQueryResults(res);
        return res;
      }).catch(err => {
        logger.error(`Query error: ${err.message}`, { query: text, params, error: err.stack });
        throw err;
      });
    }
    
    return result;
  };

  // Override client.release to prevent connection leaks
  client.release = () => {
    release.apply(client);
  };

  return client;
};

// Enhanced query function with logging
const query = async (text, params) => {
  logger.sql.logQuery(text, params);
  
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) { // Log slow queries regardless of settings
      logger.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    }
    
    logger.sql.logQueryResults(res);
    return res;
  } catch (err) {
    logger.error(`Query error: ${err.message}`, { query: text, params: params, error: err.stack });
    throw err;
  }
};

module.exports = {
  pool,
  getClient,
  query
}; 