#!/usr/bin/env node

/**
 * Script to run the entire migration process
 * 
 * Usage:
 *   node migrate.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Check if localstorage_export.json exists
const exportFile = path.join(__dirname, 'localstorage_export.json');
if (!fs.existsSync(exportFile)) {
  console.log('\n❌ localstorage_export.json file not found!');
  console.log('\nPlease run the export_localstorage.js script first to get instructions:');
  console.log('node export_localstorage.js');
  process.exit(1);
}

console.log('=== ReactStock Migration Process ===\n');

// Function to run a script and return a promise
function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...\n`);
    
    const scriptProcess = spawn('node', [path.join(__dirname, scriptName)], {
      stdio: 'inherit'
    });
    
    scriptProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} completed successfully`);
        resolve();
      } else {
        console.error(`\n❌ ${scriptName} failed with code ${code}`);
        reject(new Error(`${scriptName} failed with code ${code}`));
      }
    });
    
    scriptProcess.on('error', (err) => {
      console.error(`\n❌ Failed to run ${scriptName}: ${err}`);
      reject(err);
    });
  });
}

// Run the migration process
async function migrate() {
  try {
    // Step 1: Run database migrations
    await runScript('run_migrations.js');
    
    // Step 2: Migrate localStorage data to PostgreSQL
    await runScript('migrate_from_localstorage.js');
    
    // Step 3: Verify migration
    await runScript('verify_migration.js');
    
    console.log('\n🎉 Migration process completed successfully!');
    console.log('\nYour data has been migrated from localStorage to PostgreSQL.');
    console.log('You can now use the application with the database backend.');
    
  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    process.exit(1);
  }
}

migrate(); 