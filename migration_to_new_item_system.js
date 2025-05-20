// Migration script for the new PostgreSQL item system
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import the database configuration
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

// Log file setup
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const logFile = path.join(logDir, `migration_${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
const logger = fs.createWriteStream(logFile, { flags: 'a' });

// Logging helper
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logger.write(logMessage + '\n');
}

// Helper to ask for confirmation
async function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Backup the current database before migration
async function backupDatabase(client) {
  log('Creating database backup before migration...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  const backupFile = path.join(backupDir, `pre_migration_backup_${timestamp}.sql`);
  
  try {
    // Get database name from connection config
    const dbNameResult = await client.query('SELECT current_database()');
    const dbName = dbNameResult.rows[0].current_database;
    
    // Run pg_dump command
    const { exec } = require('child_process');
    
    const pgDumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -F p -b -v -f "${backupFile}" ${dbName}`;
    
    log(`Executing backup command: ${pgDumpCommand}`);
    
    return new Promise((resolve, reject) => {
      exec(pgDumpCommand, (error, stdout, stderr) => {
        if (error) {
          log(`Backup error: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          log(`Backup stderr: ${stderr}`);
        }
        log(`Backup completed successfully: ${backupFile}`);
        resolve(backupFile);
      });
    });
  } catch (err) {
    log(`Error creating backup: ${err.message}`);
    throw err;
  }
}

// Main migration function
async function migrateToNewItemSystem() {
  log('Starting migration to new item system...');
  
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    // Create backup
    const backupFile = await backupDatabase(client);
    log(`Backup created at: ${backupFile}`);
    
    // Confirm proceeding with migration after backup
    const proceedAfterBackup = await confirm('Backup completed. Proceed with migration?');
    if (!proceedAfterBackup) {
      log('Migration aborted by user after backup.');
      await client.query('ROLLBACK');
      return;
    }
    
    // 1. Rename existing tables to _old suffix
    log('Renaming existing tables...');
    await client.query('ALTER TABLE IF EXISTS items RENAME TO items_old');
    await client.query('ALTER TABLE IF EXISTS item_properties RENAME TO item_properties_old');
    
    // 2. Load and execute the new schema
    log('Creating new schema...');
    const schemaFile = path.join(__dirname, 'new_item_system.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');
    
    // Split the schema into separate statements and execute them
    const statements = schema.split(';');
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        try {
          await client.query(trimmedStatement);
        } catch (err) {
          log(`Error executing schema statement: ${err.message}`);
          log(`Statement: ${trimmedStatement}`);
          throw err;
        }
      }
    }
    
    // 3. Migrate data from old tables to new schema
    log('Migrating data from old schema to new schema...');
    
    // Get all items from the old table
    const oldItems = await client.query('SELECT * FROM items_old');
    log(`Found ${oldItems.rows.length} items to migrate.`);
    
    // Get old item properties
    const oldItemProperties = await client.query('SELECT * FROM item_properties_old');
    log(`Found ${oldItemProperties.rows.length} item properties to migrate.`);
    
    // Create a map of item properties for quick lookup
    const itemPropertiesMap = {};
    for (const prop of oldItemProperties.rows) {
      itemPropertiesMap[prop.item_id] = prop;
    }
    
    // Migrate each item
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const item of oldItems.rows) {
      try {
        // Determine item status based on deleted_at
        const status = item.deleted_at ? 'deleted' : 'active';
        
        // Insert into new items table
        const newItemResult = await client.query(`
          INSERT INTO items (
            id, name, description, quantity, box_id, parent_item_id, 
            status, created_at, updated_at, deleted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          item.id, 
          item.name, 
          item.description, 
          item.quantity, 
          item.box_id, 
          item.parent_item_id,
          status,
          item.created_at,
          item.updated_at,
          item.deleted_at
        ]);
        
        const newItemId = newItemResult.rows[0].id;
        
        // Get properties from both the items table and item_properties table
        const properties = itemPropertiesMap[item.id] || {};
        
        // Insert into new item_properties table with merged data
        await client.query(`
          INSERT INTO item_properties (
            item_id, type, ean_code, serial_number, qr_code, supplier, additional_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          newItemId,
          item.type || properties.type,
          item.ean_code || properties.ean_code,
          item.serial_number || properties.serial_number,
          item.qr_code,
          item.supplier,
          properties.additional_data || '{}'
        ]);
        
        migratedCount++;
        if (migratedCount % 100 === 0) {
          log(`Migrated ${migratedCount} items...`);
        }
      } catch (err) {
        log(`Error migrating item ${item.id} (${item.name}): ${err.message}`);
        errorCount++;
      }
    }
    
    log(`Migration completed. Migrated ${migratedCount} items with ${errorCount} errors.`);
    
    // 4. Migrate transactions
    log('Migrating transaction history...');
    
    // Get existing transaction data
    const oldTransactions = await client.query(`
      SELECT * FROM transactions WHERE item_id IS NOT NULL
    `);
    
    log(`Found ${oldTransactions.rows.length} transactions to migrate.`);
    
    let migratedTransactions = 0;
    let transactionErrors = 0;
    
    for (const tx of oldTransactions.rows) {
      try {
        // Determine transaction type
        let transactionType;
        switch(tx.transaction_type) {
          case 'stock_in':
            transactionType = 'in';
            break;
          case 'stock_out':
            transactionType = 'out';
            break;
          case 'transfer':
            transactionType = 'transfer';
            break;
          case 'adjustment':
            transactionType = 'adjustment';
            break;
          default:
            transactionType = tx.transaction_type.includes('in') ? 'in' : 
                             tx.transaction_type.includes('out') ? 'out' : 'adjustment';
        }
        
        // Parse quantity from notes if not available
        let quantity = 1;
        if (tx.notes && tx.notes.includes('quantity')) {
          const match = tx.notes.match(/quantity[:\s]+(\d+)/i);
          if (match && match[1]) {
            quantity = parseInt(match[1], 10);
          }
        }
        
        // Insert into new item_transactions table
        await client.query(`
          INSERT INTO item_transactions (
            item_id, type, quantity, box_id, previous_box_id, 
            user_id, notes, transaction_date, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          tx.item_id,
          transactionType,
          quantity,
          tx.box_id,
          null, // We don't have previous_box_id in old schema
          tx.user_id,
          tx.notes,
          tx.created_at,
          tx.created_at
        ]);
        
        migratedTransactions++;
        
      } catch (err) {
        log(`Error migrating transaction ${tx.id}: ${err.message}`);
        transactionErrors++;
      }
    }
    
    log(`Transaction migration completed. Migrated ${migratedTransactions} transactions with ${transactionErrors} errors.`);
    
    // 5. Refresh materialized view
    log('Refreshing materialized view...');
    await client.query('REFRESH MATERIALIZED VIEW items_complete_data');
    
    // 6. Verify migration
    const newItemCount = await client.query('SELECT COUNT(*) FROM items');
    const newPropertiesCount = await client.query('SELECT COUNT(*) FROM item_properties');
    
    log(`Verification: New schema contains ${newItemCount.rows[0].count} items and ${newPropertiesCount.rows[0].count} property records.`);
    
    // Prompt for commit
    const shouldCommit = await confirm('Migration completed successfully. Commit changes?');
    
    if (shouldCommit) {
      await client.query('COMMIT');
      log('Migration committed successfully!');
      
      // Ask if old tables should be dropped
      const shouldDrop = await confirm('Drop old tables? This cannot be undone!');
      
      if (shouldDrop) {
        log('Dropping old tables...');
        await client.query('BEGIN');
        await client.query('DROP TABLE IF EXISTS items_old CASCADE');
        await client.query('DROP TABLE IF EXISTS item_properties_old CASCADE');
        await client.query('COMMIT');
        log('Old tables dropped successfully.');
      } else {
        log('Old tables preserved.');
      }
    } else {
      await client.query('ROLLBACK');
      log('Migration rolled back by user.');
    }
    
  } catch (err) {
    await client.query('ROLLBACK');
    log(`Migration failed: ${err.message}`);
    console.error(err);
  } finally {
    client.release();
    pool.end();
    logger.end();
  }
}

// Run the migration
migrateToNewItemSystem().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 