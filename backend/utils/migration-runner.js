/**
 * Migration Runner
 * 
 * A simple utility to run database migrations in order.
 * This replaces the need for a third-party migration tool.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

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
    console.log(`Migration tracking table ${MIGRATIONS_TABLE} is ready`);
  } catch (err) {
    console.error('Error creating migrations table:', err);
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
    console.error('Error getting applied migrations:', err);
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
    console.log(`Recorded migration: ${name}`);
  } catch (err) {
    console.error(`Error recording migration ${name}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

// Remove a migration record
async function removeMigration(name) {
  const client = await pool.connect();
  try {
    await client.query(`
      DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1
    `, [name]);
    console.log(`Removed migration record: ${name}`);
  } catch (err) {
    console.error(`Error removing migration record ${name}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

// Get all migration files
function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
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
    
    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`${appliedMigrations.length} migrations have already been applied`);
    
    let migrationsRun = 0;
    
    for (const migration of migrationFiles) {
      if (!appliedMigrations.includes(migration.name)) {
        console.log(`Running migration: ${migration.name}`);
        
        if (typeof migration.module.up === 'function') {
          await migration.module.up();
          await recordMigration(migration.name);
          migrationsRun++;
        } else {
          console.warn(`Migration ${migration.name} has no 'up' function, skipping`);
        }
      } else {
        console.log(`Migration ${migration.name} already applied, skipping`);
      }
    }
    
    console.log(`Migration complete. Applied ${migrationsRun} new migrations.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Rollback the last migration
async function rollbackLastMigration() {
  try {
    await ensureMigrationsTable();
    const appliedMigrations = await getAppliedMigrations();
    
    if (appliedMigrations.length === 0) {
      console.log('No migrations to roll back');
      return;
    }
    
    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    const migrationFiles = getMigrationFiles();
    const migrationToRollback = migrationFiles.find(m => m.name === lastMigration);
    
    if (!migrationToRollback) {
      console.error(`Could not find migration file for ${lastMigration}`);
      return;
    }
    
    console.log(`Rolling back migration: ${lastMigration}`);
    
    if (typeof migrationToRollback.module.down === 'function') {
      await migrationToRollback.module.down();
      await removeMigration(lastMigration);
      console.log('Rollback complete');
    } else {
      console.error(`Migration ${lastMigration} has no 'down' function`);
    }
  } catch (err) {
    console.error('Rollback failed:', err);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Create a new migration file
function createMigration(name) {
  if (!name) {
    console.error('Migration name is required');
    process.exit(1);
  }
  
  // Format the name with a timestamp prefix
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').substring(0, 14);
  const fileName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.js`;
  const filePath = path.join(__dirname, '..', 'migrations', fileName);
  
  // Migration file template
  const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

const { pool } = require('../config/database');

// Up migration
exports.up = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Your migration code here
    
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Down migration
exports.down = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Your rollback code here
    
    await client.query('COMMIT');
    console.log('Rollback completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', err);
    throw err;
  } finally {
    client.release();
  }
};
`;

  fs.writeFileSync(filePath, template);
  console.log(`Created migration file: ${filePath}`);
}

// Handle command line arguments
const command = process.argv[2];
const migrationName = process.argv[3];

switch (command) {
  case 'up':
    runMigrations();
    break;
  case 'down':
    rollbackLastMigration();
    break;
  case 'create':
    createMigration(migrationName);
    break;
  default:
    console.log('Usage:');
    console.log('  node migration-runner.js up - Run all pending migrations');
    console.log('  node migration-runner.js down - Rollback the last migration');
    console.log('  node migration-runner.js create <name> - Create a new migration');
    break;
} 