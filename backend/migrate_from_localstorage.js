#!/usr/bin/env node

/**
 * Script to migrate data from localStorage to PostgreSQL
 * 
 * Usage:
 *   1. Export your localStorage data from the browser:
 *      a. Open the browser console in your ReactStock app
 *      b. Run this command to export all localStorage data:
 *         copy(JSON.stringify(Object.keys(localStorage).reduce((obj, key) => {
 *           obj[key] = localStorage.getItem(key);
 *           return obj;
 *         }, {})))
 *      c. Paste the result into a file named 'localstorage_export.json'
 *   2. Run this script: node migrate_from_localstorage.js
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

async function migrateLocalStorageData() {
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
      // Start a transaction
      await client.query('BEGIN');

      // Create a set of items we need to create
      const itemsToCreate = new Set();
      
      // Extract item IDs from transactions
      if (localStorageData.itemTransactions) {
        const transactions = JSON.parse(localStorageData.itemTransactions);
        transactions.forEach(transaction => {
          if (transaction.item_id) {
            itemsToCreate.add(transaction.item_id);
          }
          if (transaction.related_item_id) {
            itemsToCreate.add(transaction.related_item_id);
          }
        });
      }
      
      // Extract item IDs from item properties
      const itemPropertyPatterns = Object.keys(localStorageData).filter(key => key.startsWith('item_') && key.endsWith('_details'));
      itemPropertyPatterns.forEach(key => {
        const itemId = key.replace('item_', '').replace('_details', '');
        itemsToCreate.add(parseInt(itemId));
      });
      
      console.log(`Found ${itemsToCreate.size} items to create`);
      
      // Create placeholder items
      for (const itemId of itemsToCreate) {
        try {
          // Check if item already exists
          const itemCheck = await client.query('SELECT id FROM items WHERE id = $1', [itemId]);
          if (itemCheck.rows.length === 0) {
            // Get item properties if available
            const propertyKey = `item_${itemId}_details`;
            let name = `Item #${itemId}`;
            let type = null;
            let ean_code = null;
            let serial_number = null;
            let parent_item_id = null;
            
            if (localStorageData[propertyKey]) {
              const propertyData = JSON.parse(localStorageData[propertyKey]);
              type = propertyData.type;
              ean_code = propertyData.ean_code;
              serial_number = propertyData.serial_number;
              parent_item_id = propertyData.parent_item_id;
            }
            
            // Find item name in transactions
            if (localStorageData.itemTransactions) {
              const transactions = JSON.parse(localStorageData.itemTransactions);
              const transaction = transactions.find(t => t.item_id === itemId);
              if (transaction && transaction.item_name) {
                name = transaction.item_name;
              }
            }
            
            // Create placeholder item
            await client.query(`
              INSERT INTO items (id, name, type, ean_code, serial_number, parent_item_id, quantity)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [itemId, name, type, ean_code, serial_number, parent_item_id, 0]);
            
            console.log(`Created placeholder item: ${name} (ID: ${itemId})`);
          }
        } catch (err) {
          console.warn(`Warning: Could not create placeholder item ${itemId}:`, err.message);
        }
      }

      // 1. Migrate item transactions
      if (localStorageData.itemTransactions) {
        const transactions = JSON.parse(localStorageData.itemTransactions);
        console.log(`Found ${transactions.length} item transactions to migrate`);

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
          } catch (err) {
            console.warn(`Warning: Could not migrate transaction for item ${transaction.item_id}:`, err.message);
          }
        }

        console.log(`Successfully migrated item transactions`);
      }

      // 2. Migrate item properties
      const itemPropertyKeys = Object.keys(localStorageData).filter(key => key.startsWith('item_') && key.endsWith('_details'));
      console.log(`Found ${itemPropertyKeys.length} item property records to migrate`);

      for (const key of itemPropertyKeys) {
        try {
          const itemId = key.replace('item_', '').replace('_details', '');
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

          // Insert or update item_properties
          const propertyCheck = await client.query('SELECT id FROM item_properties WHERE item_id = $1', [itemId]);
          
          if (propertyCheck.rows.length === 0) {
            // Insert new property record
            await client.query(`
              INSERT INTO item_properties (
                item_id,
                type,
                ean_code,
                serial_number,
                additional_data
              ) VALUES ($1, $2, $3, $4, $5)
            `, [itemId, type, ean_code, serial_number, JSON.stringify(additionalData)]);
          } else {
            // Update existing property record
            await client.query(`
              UPDATE item_properties
              SET
                type = COALESCE($1, type),
                ean_code = COALESCE($2, ean_code),
                serial_number = COALESCE($3, serial_number),
                additional_data = $4,
                updated_at = NOW()
              WHERE item_id = $5
            `, [type, ean_code, serial_number, JSON.stringify(additionalData), itemId]);
          }
        } catch (err) {
          console.warn(`Warning: Could not migrate properties for key ${key}:`, err.message);
        }
      }

      console.log(`Successfully migrated ${itemPropertyKeys.length} item property records`);

      // 3. Migrate customers
      if (localStorageData.customers) {
        try {
          const customers = JSON.parse(localStorageData.customers);
          console.log(`Found ${customers.length} customers to migrate`);

          for (const customer of customers) {
            try {
              // Check if customer already exists
              const customerCheck = await client.query('SELECT id FROM customers WHERE name = $1', [customer.name]);
              
              if (customerCheck.rows.length === 0) {
                // Insert new customer
                await client.query(`
                  INSERT INTO customers (
                    name,
                    contact_person,
                    email,
                    phone,
                    address,
                    group_name,
                    notes,
                    role_id
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                  customer.name,
                  customer.contact_person,
                  customer.email,
                  customer.phone,
                  customer.address,
                  customer.group_name,
                  customer.notes,
                  customer.role_id
                ]);
              } else {
                // Update existing customer
                await client.query(`
                  UPDATE customers
                  SET
                    contact_person = COALESCE($1, contact_person),
                    email = COALESCE($2, email),
                    phone = COALESCE($3, phone),
                    address = COALESCE($4, address),
                    group_name = COALESCE($5, group_name),
                    notes = COALESCE($6, notes),
                    role_id = COALESCE($7, role_id),
                    updated_at = NOW()
                  WHERE id = $8
                `, [
                  customer.contact_person,
                  customer.email,
                  customer.phone,
                  customer.address,
                  customer.group_name,
                  customer.notes,
                  customer.role_id,
                  customerCheck.rows[0].id
                ]);
              }
            } catch (err) {
              console.warn(`Warning: Could not migrate customer ${customer.name}:`, err.message);
            }
          }

          console.log(`Successfully migrated ${customers.length} customers`);
        } catch (err) {
          console.warn('Warning: Could not migrate customers:', err.message);
        }
      }

      // 4. Migrate roles
      if (localStorageData.roles) {
        try {
          const roles = JSON.parse(localStorageData.roles);
          console.log(`Found ${roles.length} roles to migrate`);

          for (const role of roles) {
            try {
              // Check if role already exists
              const roleCheck = await client.query('SELECT id FROM roles WHERE name = $1', [role.name]);
              
              if (roleCheck.rows.length === 0) {
                // Insert new role
                await client.query(`
                  INSERT INTO roles (
                    name,
                    description,
                    color
                  ) VALUES ($1, $2, $3)
                `, [
                  role.name,
                  role.description,
                  role.color
                ]);
              } else {
                // Update existing role
                await client.query(`
                  UPDATE roles
                  SET
                    description = COALESCE($1, description),
                    color = COALESCE($2, color),
                    updated_at = NOW()
                  WHERE id = $3
                `, [
                  role.description,
                  role.color,
                  roleCheck.rows[0].id
                ]);
              }
            } catch (err) {
              console.warn(`Warning: Could not migrate role ${role.name}:`, err.message);
            }
          }

          console.log(`Successfully migrated ${roles.length} roles`);
        } catch (err) {
          console.warn('Warning: Could not migrate roles:', err.message);
        }
      }

      // 5. Migrate removal reasons
      if (localStorageData.removalReasons) {
        try {
          const reasons = JSON.parse(localStorageData.removalReasons);
          console.log(`Found ${reasons.length} removal reasons to migrate`);

          // Create removal_reasons table if it doesn't exist
          await client.query(`
            CREATE TABLE IF NOT EXISTS removal_reasons (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              description TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Create trigger for updated_at column if it doesn't exist
          await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            
            DROP TRIGGER IF EXISTS update_removal_reasons_updated_at ON removal_reasons;
            
            CREATE TRIGGER update_removal_reasons_updated_at
                BEFORE UPDATE ON removal_reasons
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
          `);

          for (const reason of reasons) {
            try {
              // Check if reason already exists
              const reasonCheck = await client.query('SELECT id FROM removal_reasons WHERE name = $1', [reason.name]);
              
              if (reasonCheck.rows.length === 0) {
                // Insert new reason
                await client.query(`
                  INSERT INTO removal_reasons (
                    name,
                    description
                  ) VALUES ($1, $2)
                `, [
                  reason.name,
                  reason.description
                ]);
              } else {
                // Update existing reason
                await client.query(`
                  UPDATE removal_reasons
                  SET
                    description = COALESCE($1, description),
                    updated_at = NOW()
                  WHERE id = $2
                `, [
                  reason.description,
                  reasonCheck.rows[0].id
                ]);
              }
            } catch (err) {
              console.warn(`Warning: Could not migrate removal reason ${reason.name}:`, err.message);
            }
          }

          console.log(`Successfully migrated ${reasons.length} removal reasons`);
        } catch (err) {
          console.warn('Warning: Could not migrate removal reasons:', err.message);
        }
      }

      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully');

    } catch (error) {
      // Rollback the transaction in case of error
      await client.query('ROLLBACK');
      console.error('Error during migration:', error);
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

// Run the migration
migrateLocalStorageData().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 