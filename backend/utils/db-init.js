/**
 * Database Initialization Script
 * 
 * This script runs necessary migrations and initializes the database
 * when the server starts.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('./logger');

// Migration tracking table
const MIGRATIONS_TABLE = 'db_migrations';

// Create migrations table if it doesn't exist
async function ensureMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info(`Migration tracking table ${MIGRATIONS_TABLE} is ready`);
  } catch (err) {
    logger.error('Error creating migrations table:', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC
    `);
    return result.rows.map(row => row.name);
  } catch (err) {
    logger.error('Error getting applied migrations:', { error: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

// Record a migration as applied
async function recordMigration(name) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)
    `, [name]);
    logger.info(`Recorded migration: ${name}`);
  } catch (err) {
    logger.error(`Error recording migration ${name}:`, { error: err.message, stack: err.stack });
    throw err;
  } finally {
    client.release();
  }
}

// Get all migration files
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory does not exist, skipping migrations');
    return [];
  }
  
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort(); // Sort to ensure migrations run in order
  
  return files.map(file => ({
    name: file,
    path: path.join(migrationsDir, file),
    module: require(path.join(migrationsDir, file))
  }));
}

// Run migrations
async function runMigrations() {
  try {
    await ensureMigrationsTable();
    const appliedMigrations = await getAppliedMigrations();
    const migrationFiles = getMigrationFiles();
    
    logger.info(`Found ${migrationFiles.length} migration files`);
    logger.info(`${appliedMigrations.length} migrations have already been applied`);
    
    let migrationsRun = 0;
    
    for (const migration of migrationFiles) {
      if (!appliedMigrations.includes(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        
        if (typeof migration.module.up === 'function') {
          const client = await pool.connect();
          try {
            await migration.module.up(client);
            await recordMigration(migration.name);
            migrationsRun++;
          } catch (err) {
            logger.error(`Error running migration ${migration.name}:`, { error: err.message, stack: err.stack });
            throw err;
          } finally {
            client.release();
          }
        } else {
          logger.warn(`Migration ${migration.name} has no 'up' function, skipping`);
        }
      } else {
        logger.debug(`Migration ${migration.name} already applied, skipping`);
      }
    }
    
    logger.info(`Database initialization complete. Applied ${migrationsRun} new migrations.`);
    return true;
  } catch (err) {
    logger.error('Database initialization failed:', { error: err.message, stack: err.stack });
    return false;
  }
}

module.exports = {
  runMigrations
}; 