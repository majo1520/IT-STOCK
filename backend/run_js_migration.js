#!/usr/bin/env node

/**
 * Script to run JavaScript migrations
 * 
 * Usage:
 *   node run_js_migration.js [migration_file.js]
 *   
 * Example:
 *   node run_js_migration.js 004_add_last_transaction_columns.js
 */

const fs = require('fs');
const path = require('path');

async function runJsMigration() {
  try {
    const migrationFileName = process.argv[2];
    
    if (!migrationFileName) {
      console.error('Error: Migration file name not provided');
      console.log('Usage: node run_js_migration.js [migration_file.js]');
      console.log('Example: node run_js_migration.js 004_add_last_transaction_columns.js');
      process.exit(1);
    }
    
    const migrationPath = path.join(__dirname, 'migrations', migrationFileName);
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Error: Migration file ${migrationFileName} not found`);
      process.exit(1);
    }
    
    console.log(`Running JavaScript migration: ${migrationFileName}`);
    
    // Import the migration file
    const migration = require(migrationPath);
    
    if (typeof migration.up !== 'function') {
      console.error('Error: Migration file does not export an "up" function');
      process.exit(1);
    }
    
    // Run the migration
    await migration.up();
    
    console.log(`Migration ${migrationFileName} completed successfully`);
    
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

// Run the migration
runJsMigration().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 