#!/usr/bin/env node

/**
 * Script to run all SQL migrations in the migrations folder
 * 
 * Usage:
 *   node run_migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function runMigrations() {
  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    try {
      // Create migrations table if it doesn't exist
      await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure migrations run in alphabetical order

      console.log(`Found ${migrationFiles.length} migration files`);
    
      // Check which migrations have already been executed
      const executedMigrations = await client.query('SELECT name FROM migrations');
      const executedMigrationNames = executedMigrations.rows.map(row => row.name);
    
      // Execute migrations that haven't been run yet
    for (const file of migrationFiles) {
        if (executedMigrationNames.includes(file)) {
          console.log(`Migration ${file} already executed, skipping`);
        continue;
      }
      
        console.log(`Executing migration: ${file}`);
        
        // Read migration file
        const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        // Execute migration in a transaction
        await client.query('BEGIN');
        try {
          await client.query(migration);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`Migration ${file} executed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          
          // Check if error is due to duplicate column or trigger
          if (error.code === '42701' || // duplicate column error code
              error.code === '42710' || // duplicate trigger error code
              error.code === '42P07') { // duplicate table error code
            console.log(`Migration ${file} skipped: object already exists (${error.code})`);
            
            // Mark the migration as executed anyway so we don't try it again
            await client.query('BEGIN');
            await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
    } else {
            console.error(`Error executing migration ${file}:`, error);
            throw error;
          }
        }
      }

      console.log('All migrations executed successfully');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migrations
runMigrations().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 