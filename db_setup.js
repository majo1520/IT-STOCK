// Database setup script
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Import the database configuration from the backend
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database setup...');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create item_properties table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS item_properties (
        id SERIAL PRIMARY KEY,
        item_id INTEGER NOT NULL,
        type VARCHAR(100),
        ean_code VARCHAR(100),
        serial_number VARCHAR(100),
        additional_data JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('Created item_properties table');
    
    // Add necessary columns to items table if they don't exist
    const columnsToAdd = [
      { name: 'type', type: 'VARCHAR(100)' },
      { name: 'ean_code', type: 'VARCHAR(100)' },
      { name: 'serial_number', type: 'VARCHAR(100)' },
      { name: 'qr_code', type: 'VARCHAR(100)' },
      { name: 'supplier', type: 'VARCHAR(100)' },
      { name: 'parent_item_id', type: 'INTEGER' },
      { name: 'deleted_at', type: 'TIMESTAMP' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE items ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};
        `);
        console.log(`Added column ${column.name} to items table`);
      } catch (err) {
        console.error(`Error adding column ${column.name}:`, err.message);
      }
    }
    
    // Create foreign key constraint if it doesn't exist
    try {
      // Check if constraint exists
      const constraintCheck = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'item_properties'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'item_properties_item_id_fkey';
      `);
      
      if (constraintCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE item_properties
          ADD CONSTRAINT item_properties_item_id_fkey
          FOREIGN KEY (item_id)
          REFERENCES items(id)
          ON DELETE CASCADE;
        `);
        console.log('Added foreign key constraint to item_properties');
      }
    } catch (err) {
      console.error('Error adding foreign key constraint:', err.message);
    }
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_item_properties_item_id ON item_properties(item_id);
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_items_ean_code ON items(ean_code);
      CREATE INDEX IF NOT EXISTS idx_items_parent_item_id ON items(parent_item_id);
    `);
    
    console.log('Created indexes');
    
    // Create update timestamp function and triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS update_items_timestamp ON items;
      CREATE TRIGGER update_items_timestamp
      BEFORE UPDATE ON items
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_column();
      
      DROP TRIGGER IF EXISTS update_item_properties_timestamp ON item_properties;
      CREATE TRIGGER update_item_properties_timestamp
      BEFORE UPDATE ON item_properties
      FOR EACH ROW
      EXECUTE FUNCTION update_modified_column();
    `);
    
    console.log('Created timestamp triggers');
    
    // Synchronize data between items and item_properties
    console.log('Synchronizing data between tables...');
    
    // Get all items that don't have corresponding properties
    const itemsWithoutProperties = await client.query(`
      SELECT i.id, i.type, i.ean_code, i.serial_number
      FROM items i
      LEFT JOIN item_properties ip ON i.id = ip.item_id
      WHERE ip.id IS NULL;
    `);
    
    // Insert missing properties
    for (const item of itemsWithoutProperties.rows) {
      await client.query(`
        INSERT INTO item_properties (item_id, type, ean_code, serial_number)
        VALUES ($1, $2, $3, $4);
      `, [item.id, item.type, item.ean_code, item.serial_number]);
      console.log(`Created properties for item ${item.id}`);
    }
    
    // Update items with properties data where items data is null
    await client.query(`
      UPDATE items i
      SET 
        type = COALESCE(i.type, ip.type),
        ean_code = COALESCE(i.ean_code, ip.ean_code),
        serial_number = COALESCE(i.serial_number, ip.serial_number)
      FROM item_properties ip
      WHERE i.id = ip.item_id
      AND (i.type IS NULL OR i.ean_code IS NULL OR i.serial_number IS NULL);
    `);
    
    console.log('Updated items with missing data from properties');
    
    // Update properties with items data where properties data is null
    await client.query(`
      UPDATE item_properties ip
      SET 
        type = COALESCE(ip.type, i.type),
        ean_code = COALESCE(ip.ean_code, i.ean_code),
        serial_number = COALESCE(ip.serial_number, i.serial_number)
      FROM items i
      WHERE i.id = ip.item_id
      AND (ip.type IS NULL OR ip.ean_code IS NULL OR ip.serial_number IS NULL);
    `);
    
    console.log('Updated properties with missing data from items');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('Database setup completed successfully');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error setting up database:', err);
  } finally {
    client.release();
    pool.end();
  }
}

setupDatabase().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 