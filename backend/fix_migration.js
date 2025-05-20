#!/usr/bin/env node

/**
 * Script to fix the migration by adding missing data to item_transactions and item_properties tables
 * 
 * Usage:
 *   node fix_migration.js
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

async function fixMigration() {
  try {
    // Read the exported localStorage data
    const localStorageFile = path.join(__dirname, 'localstorage_export.json');
    if (!fs.existsSync(localStorageFile)) {
      console.error('Error: localstorage_export.json file not found. Please export your localStorage data first.');
      process.exit(1);
    }

    const localStorageData = JSON.parse(fs.readFileSync(localStorageFile, 'utf8'));
    console.log('Successfully loaded localStorage data');

    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    try {
      // 1. Fix item_transactions
      if (localStorageData.itemTransactions) {
        const transactions = JSON.parse(localStorageData.itemTransactions);
        console.log(`Found ${transactions.length} item transactions to migrate`);

        // Check if item_transactions table exists and has data
        const transactionsCountResult = await client.query('SELECT COUNT(*) FROM item_transactions');
        const transactionsCount = parseInt(transactionsCountResult.rows[0].count);
        
        if (transactionsCount === 0) {
          console.log('No item transactions found in database, migrating from localStorage');
          
          // Start a transaction
          await client.query('BEGIN');
          
          // Create placeholder items if needed
          const itemsToCreate = new Set();
          transactions.forEach(transaction => {
            if (transaction.item_id) {
              itemsToCreate.add(transaction.item_id);
            }
            if (transaction.related_item_id) {
              itemsToCreate.add(transaction.related_item_id);
            }
          });
          
          // Check which items already exist
          const existingItemsResult = await client.query('SELECT id FROM items');
          const existingItemIds = new Set(existingItemsResult.rows.map(row => row.id));
          
          // Create missing items
          for (const itemId of itemsToCreate) {
            if (!existingItemIds.has(itemId)) {
              // Find item name in transactions
              const transaction = transactions.find(t => t.item_id === itemId);
              const name = transaction && transaction.item_name ? transaction.item_name : `Item #${itemId}`;
              
              // Create placeholder item
              await client.query(`
                INSERT INTO items (id, name, quantity)
                VALUES ($1, $2, $3)
              `, [itemId, name, 0]);
              
              console.log(`Created placeholder item: ${name} (ID: ${itemId})`);
            }
          }
          
          // Insert transactions
          let successCount = 0;
          for (const transaction of transactions) {
            try {
              // Map localStorage transaction fields to database fields
              const {
                item_id,
                item_name,
                type,
                quantity,
                previous_quantity,
                new_quantity,
                box_id,
                previous_box_id,
                new_box_id,
                related_item_id,
                related_item_name,
                customer_id,
                supplier,
                details: notes,
                created_at,
                created_by,
                transaction_type,
                metadata
              } = transaction;

              // Insert into item_transactions table
              await client.query(`
                INSERT INTO item_transactions (
                  item_id, 
                  item_name,
                  transaction_type, 
                  quantity, 
                  previous_quantity, 
                  new_quantity, 
                  box_id, 
                  previous_box_id, 
                  new_box_id, 
                  related_item_id, 
                  related_item_name, 
                  customer_id, 
                  supplier, 
                  notes, 
                  created_by, 
                  created_at,
                  metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
              `, [
                item_id,
                item_name,
                transaction_type || (type === 'in' ? 'STOCK_IN' : type === 'out' ? 'STOCK_OUT' : 'UNKNOWN'),
                quantity || 0,
                previous_quantity,
                new_quantity,
                box_id,
                previous_box_id,
                new_box_id,
                related_item_id,
                related_item_name,
                customer_id,
                supplier,
                notes,
                created_by || 'system',
                created_at || new Date().toISOString(),
                metadata ? JSON.stringify(metadata) : null
              ]);
              
              successCount++;
            } catch (err) {
              console.warn(`Warning: Could not migrate transaction for item ${transaction.item_id}:`, err.message);
            }
          }
          
          await client.query('COMMIT');
          console.log(`Successfully migrated ${successCount} out of ${transactions.length} item transactions`);
        } else {
          console.log(`Found ${transactionsCount} existing item transactions in database, skipping migration`);
        }
      }

      // 2. Fix item_properties
      const itemPropertyKeys = Object.keys(localStorageData).filter(key => key.startsWith('item_') && key.endsWith('_details'));
      if (itemPropertyKeys.length > 0) {
        console.log(`Found ${itemPropertyKeys.length} item property records to migrate`);
        
        // Check if item_properties table exists and has data
        const propertiesCountResult = await client.query('SELECT COUNT(*) FROM item_properties');
        const propertiesCount = parseInt(propertiesCountResult.rows[0].count);
        
        if (propertiesCount === 0) {
          console.log('No item properties found in database, migrating from localStorage');
          
          // Start a transaction
          await client.query('BEGIN');
          
          // Insert properties
          let successCount = 0;
          for (const key of itemPropertyKeys) {
            try {
              const itemId = parseInt(key.replace('item_', '').replace('_details', ''));
              const propertyData = JSON.parse(localStorageData[key]);

              // Check if the item exists
              const itemCheck = await client.query('SELECT id FROM items WHERE id = $1', [itemId]);
              if (itemCheck.rows.length === 0) {
                console.log(`Skipping properties for item ${itemId} as it does not exist in the database`);
                continue;
              }

              // Extract properties
              const { type, ean_code, serial_number, parent_item_id, ...additionalData } = propertyData;

              // Update the items table with common properties
              await client.query(`
                UPDATE items
                SET
                  type = COALESCE($1, type),
                  ean_code = COALESCE($2, ean_code),
                  serial_number = COALESCE($3, serial_number),
                  parent_item_id = COALESCE($4, parent_item_id)
                WHERE id = $5
              `, [type, ean_code, serial_number, parent_item_id, itemId]);

              // Insert item_properties
              await client.query(`
                INSERT INTO item_properties (
                  item_id,
                  type,
                  ean_code,
                  serial_number,
                  additional_data
                ) VALUES ($1, $2, $3, $4, $5)
              `, [itemId, type, ean_code, serial_number, JSON.stringify(additionalData)]);
              
              successCount++;
            } catch (err) {
              console.warn(`Warning: Could not migrate properties for key ${key}:`, err.message);
            }
          }
          
          await client.query('COMMIT');
          console.log(`Successfully migrated ${successCount} out of ${itemPropertyKeys.length} item property records`);
        } else {
          console.log(`Found ${propertiesCount} existing item properties in database, skipping migration`);
        }
      }

      console.log('Migration fix completed successfully');

    } catch (error) {
      // Rollback the transaction in case of error
      await client.query('ROLLBACK');
      console.error('Error during migration fix:', error);
      process.exit(1);
    } finally {
      // Release the client back to the pool
      client.release();
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the migration fix
fixMigration().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 