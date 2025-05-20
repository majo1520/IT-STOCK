// Script to completely rebuild the items table and related structures
const { Pool } = require('pg');
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

async function rebuildDatabase() {
  console.log('=== Starting Database Rebuild ===');
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log('1. Backing up existing data...');
    
    // Get all data from existing items table
    const itemsResult = await client.query('SELECT * FROM items');
    const items = itemsResult.rows;
    console.log(`Found ${items.length} items to migrate`);
    
    // Get all data from item_properties table
    const propertiesResult = await client.query('SELECT * FROM item_properties');
    const properties = propertiesResult.rows;
    console.log(`Found ${properties.length} item property records to migrate`);
    
    console.log('2. Dropping existing views and triggers...');
    
    // Drop materialized view if it exists
    await client.query('DROP MATERIALIZED VIEW IF EXISTS items_complete_view CASCADE');
    
    // Drop triggers if they exist
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_insert ON items CASCADE;
      DROP TRIGGER IF EXISTS refresh_items_view_update ON items CASCADE;
      DROP TRIGGER IF EXISTS refresh_items_view_delete ON items CASCADE;
      DROP TRIGGER IF EXISTS refresh_items_view_prop_insert ON item_properties CASCADE;
      DROP TRIGGER IF EXISTS refresh_items_view_prop_update ON item_properties CASCADE;
      DROP TRIGGER IF EXISTS refresh_items_view_prop_delete ON item_properties CASCADE;
    `);
    
    // Drop functions if they exist
    await client.query('DROP FUNCTION IF EXISTS refresh_items_view_func() CASCADE');
    
    console.log('3. Creating new unified items table...');
    
    // Rename old tables to backup
    await client.query('ALTER TABLE IF EXISTS items RENAME TO items_old');
    await client.query('ALTER TABLE IF EXISTS item_properties RENAME TO item_properties_old');
    
    // Create new items table with all fields combined
    await client.query(`
      CREATE TABLE items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity INTEGER DEFAULT 0,
        box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        supplier VARCHAR(255),
        parent_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        type VARCHAR(100),
        ean_code VARCHAR(50),
        serial_number VARCHAR(100),
        qr_code VARCHAR(255),
        additional_data JSONB DEFAULT '{}'::jsonb,
        last_transaction_at TIMESTAMP,
        last_transaction_type VARCHAR(50),
        notes TEXT
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX idx_items_box_id ON items(box_id);
      CREATE INDEX idx_items_parent_item_id ON items(parent_item_id);
      CREATE INDEX idx_items_name ON items(name);
      CREATE INDEX idx_items_type ON items(type);
      CREATE INDEX idx_items_ean_code ON items(ean_code);
      CREATE INDEX idx_items_serial_number ON items(serial_number);
      CREATE INDEX idx_items_deleted_at ON items(deleted_at) WHERE deleted_at IS NOT NULL;
    `);
    
    console.log('4. Migrating data to new table...');
    
    // Migrate data from old tables to new structure
    for (const item of items) {
      // Find corresponding properties
      const itemProps = properties.find(p => p.item_id === item.id) || {};
      
      // Merge data from both tables
      await client.query(`
        INSERT INTO items (
          id, name, description, quantity, box_id, created_at, updated_at, deleted_at,
          supplier, parent_item_id, type, ean_code, serial_number, qr_code, additional_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        item.id,
        item.name,
        item.description,
        item.quantity || 0,
        item.box_id,
        item.created_at,
        item.updated_at,
        item.deleted_at,
        item.supplier,
        item.parent_item_id,
        // Use properties data if available, otherwise use item data
        itemProps.type || item.type,
        itemProps.ean_code || item.ean_code,
        itemProps.serial_number || item.serial_number,
        item.qr_code,
        itemProps.additional_data || '{}'
      ]);
    }
    
    // Reset the sequence to the max ID
    const maxIdResult = await client.query('SELECT MAX(id) FROM items');
    const maxId = maxIdResult.rows[0].max || 0;
    await client.query(`SELECT setval('items_id_seq', ${maxId + 1}, false)`);
    
    console.log('5. Creating materialized view...');
    
    // Create a new materialized view for all item details
    await client.query(`
      CREATE MATERIALIZED VIEW items_complete_view AS
      SELECT 
        i.id,
        i.name,
        i.description,
        i.quantity,
        i.box_id,
        i.created_at,
        i.updated_at,
        i.deleted_at,
        i.supplier,
        i.parent_item_id,
        i.type,
        i.ean_code,
        i.serial_number,
        i.qr_code,
        i.additional_data,
        i.last_transaction_at,
        i.last_transaction_type,
        i.notes,
        b.box_number,
        b.description as box_description,
        l.name as location_name,
        l.color as location_color,
        s.name as shelf_name,
        p.name as parent_name
      FROM items i
      LEFT JOIN boxes b ON i.box_id = b.id
      LEFT JOIN locations l ON b.location_id = l.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      LEFT JOIN items p ON i.parent_item_id = p.id
      WHERE i.deleted_at IS NULL
    `);
    
    // Add indexes to the materialized view
    await client.query(`
      CREATE UNIQUE INDEX ON items_complete_view (id);
      CREATE INDEX ON items_complete_view (box_id);
      CREATE INDEX ON items_complete_view (parent_item_id);
      CREATE INDEX ON items_complete_view (name);
    `);
    
    console.log('6. Creating auto-update triggers...');
    
    // Create triggers for auto-refreshing the view
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_items_view_func()
      RETURNS TRIGGER AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create triggers on the items table
    await client.query(`
      CREATE TRIGGER refresh_items_view_insert
      AFTER INSERT ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
      
      CREATE TRIGGER refresh_items_view_update
      AFTER UPDATE ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
      
      CREATE TRIGGER refresh_items_view_delete
      AFTER DELETE ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    // Create auto-update trigger for updated_at field
    await client.query(`
      CREATE OR REPLACE FUNCTION update_timestamp_func()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER update_items_timestamp
      BEFORE UPDATE ON items
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp_func();
    `);
    
    console.log('7. Creating updated procedures for operations...');
    
    // Create function for stock in
    await client.query(`
      CREATE OR REPLACE FUNCTION stock_in(
        p_item_id INTEGER,
        p_quantity INTEGER,
        p_box_id INTEGER,
        p_notes TEXT DEFAULT NULL,
        p_supplier TEXT DEFAULT NULL
      )
      RETURNS INTEGER AS $$
      DECLARE
        v_item_id INTEGER;
      BEGIN
        -- If item exists, update it
        IF p_item_id IS NOT NULL THEN
          UPDATE items
          SET 
            quantity = quantity + p_quantity,
            box_id = COALESCE(p_box_id, box_id),
            supplier = COALESCE(p_supplier, supplier),
            notes = COALESCE(p_notes, notes),
            last_transaction_at = CURRENT_TIMESTAMP,
            last_transaction_type = 'STOCK_IN'
          WHERE id = p_item_id
          RETURNING id INTO v_item_id;
        END IF;
        
        RETURN v_item_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create function for stock out
    await client.query(`
      CREATE OR REPLACE FUNCTION stock_out(
        p_item_id INTEGER,
        p_quantity INTEGER,
        p_notes TEXT DEFAULT NULL
      )
      RETURNS INTEGER AS $$
      DECLARE
        v_item_id INTEGER;
      BEGIN
        UPDATE items
        SET 
          quantity = GREATEST(0, quantity - p_quantity),
          notes = COALESCE(p_notes, notes),
          last_transaction_at = CURRENT_TIMESTAMP,
          last_transaction_type = 'STOCK_OUT'
        WHERE id = p_item_id
        RETURNING id INTO v_item_id;
        
        RETURN v_item_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create function for transfer
    await client.query(`
      CREATE OR REPLACE FUNCTION transfer_item(
        p_item_id INTEGER,
        p_destination_box_id INTEGER,
        p_notes TEXT DEFAULT NULL
      )
      RETURNS INTEGER AS $$
      DECLARE
        v_item_id INTEGER;
      BEGIN
        UPDATE items
        SET 
          box_id = p_destination_box_id,
          notes = COALESCE(p_notes, notes),
          last_transaction_at = CURRENT_TIMESTAMP,
          last_transaction_type = 'TRANSFER'
        WHERE id = p_item_id
        RETURNING id INTO v_item_id;
        
        RETURN v_item_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Commit all changes
    await client.query('COMMIT');
    
    // Count items in the new table
    const countResult = await client.query('SELECT COUNT(*) FROM items');
    console.log(`✅ Database rebuild successful - ${countResult.rows[0].count} items migrated`);
    
    // List some items to verify
    const sampleItems = await client.query('SELECT id, name, type, quantity, box_id FROM items LIMIT 5');
    console.log('\nSample items from new table:');
    sampleItems.rows.forEach(item => {
      console.log(`ID: ${item.id}, Name: ${item.name}, Type: ${item.type || 'N/A'}, Quantity: ${item.quantity}, Box: ${item.box_id || 'None'}`);
    });
    
    // Get the materialized view count
    const viewCountResult = await client.query('SELECT COUNT(*) FROM items_complete_view');
    console.log(`\nMaterialized view contains ${viewCountResult.rows[0].count} items (excluding deleted items)`);
    
  } catch (error) {
    // Roll back transaction on error
    await client.query('ROLLBACK');
    console.error('Error during database rebuild:', error);
    console.error('Rolling back all changes');
  } finally {
    // Release the client
    client.release();
    await pool.end();
  }
}

// Run the rebuild function
rebuildDatabase(); 