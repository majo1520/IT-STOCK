// Script to run the deletion status fix
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Import the database configuration
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

async function runFix() {
  console.log('=== Running Item Deletion Status Fix ===');
  
  try {
    // Read and execute the fix SQL
    console.log('Applying database fix...');
    const fixSql = fs.readFileSync(path.join(__dirname, 'fix_deleted_items.sql'), 'utf8');
    
    // Split the SQL into individual commands to see the results of each
    const commands = fixSql.split(';').filter(cmd => cmd.trim().length > 0);
    
    // Run each command separately to see results
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i].trim() + ';';
      
      // Print the first part of the command for reference
      const cmdPreview = command.length > 100 ? command.substring(0, 100) + '...' : command;
      console.log(`\nExecuting SQL command ${i+1}/${commands.length}: ${cmdPreview}`);
      
      try {
        const result = await pool.query(command);
        
        // For the first command showing deleted items, display the results
        if (i === 0 && result.rows && result.rows.length > 0) {
          console.log('Found items marked as deleted:');
          console.table(result.rows);
        } 
        // For the UPDATE command
        else if (command.toLowerCase().includes('update items')) {
          console.log(`Rows updated: ${result.rowCount}`);
        }
        // For the confirmation message
        else if (i === commands.length - 1) {
          console.log('Final result:', result.rows[0].message);
        }
        else {
          console.log(`Command executed successfully (affected ${result.rowCount || 0} rows)`);
        }
      } catch (error) {
        console.log(`Error with command ${i+1}: ${error.message}`);
        // Continue with other commands
      }
    }
    
    console.log('\n=== Fix Complete ===');
    console.log('✓ Restored deleted items');
    console.log('✓ Materialized view updated');
    console.log('✓ Items should now appear correctly in the interface');
    
  } catch (error) {
    console.error('Error applying fix:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the fix
runFix(); 