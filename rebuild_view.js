// Script to completely rebuild the items_complete_view materialized view
const { Pool } = require('pg');
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

async function rebuildView() {
  console.log('=== Rebuilding Materialized View ===');
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log('Dropping existing materialized view...');
    await client.query('DROP MATERIALIZED VIEW IF EXISTS items_complete_view');
    
    console.log('Creating new materialized view...');
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
        i.supplier,
        i.parent_item_id,
        i.deleted_at,
        i.qr_code,
        COALESCE(i.type, ip.type) as type,
        COALESCE(i.ean_code, ip.ean_code) as ean_code,
        COALESCE(i.serial_number, ip.serial_number) as serial_number,
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
      LEFT JOIN item_properties ip ON i.id = ip.item_id
      WHERE i.deleted_at IS NULL
    `);
    
    console.log('Creating indexes on materialized view...');
    await client.query('CREATE UNIQUE INDEX ON items_complete_view (id)');
    await client.query('CREATE INDEX ON items_complete_view (box_id)');
    await client.query('CREATE INDEX ON items_complete_view (parent_item_id)');
    await client.query('CREATE INDEX ON items_complete_view (name)');
    
    // Create triggers to refresh view on changes
    console.log('Creating trigger functions...');
    
    // Drop the function if it exists
    await client.query(`
      DROP FUNCTION IF EXISTS refresh_items_view_func() CASCADE;
    `);
    
    // Create function to refresh view
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_items_view_func()
      RETURNS TRIGGER AS $$
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create triggers on items table
    console.log('Creating triggers on items table...');
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_insert ON items;
      CREATE TRIGGER refresh_items_view_insert
      AFTER INSERT ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_update ON items;
      CREATE TRIGGER refresh_items_view_update
      AFTER UPDATE ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_delete ON items;
      CREATE TRIGGER refresh_items_view_delete
      AFTER DELETE ON items
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    // Add similar triggers on item_properties table
    console.log('Creating triggers on item_properties table...');
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_prop_insert ON item_properties;
      CREATE TRIGGER refresh_items_view_prop_insert
      AFTER INSERT ON item_properties
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_prop_update ON item_properties;
      CREATE TRIGGER refresh_items_view_prop_update
      AFTER UPDATE ON item_properties
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_prop_delete ON item_properties;
      CREATE TRIGGER refresh_items_view_prop_delete
      AFTER DELETE ON item_properties
      FOR EACH STATEMENT
      EXECUTE FUNCTION refresh_items_view_func();
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Get current item count to verify the view is working
    const result = await client.query('SELECT COUNT(*) FROM items_complete_view');
    console.log(`✅ View rebuilt successfully - contains ${result.rows[0].count} items`);
    
    // List 5 most recently updated items
    const recentItems = await client.query(`
      SELECT id, name, updated_at, box_id, quantity 
      FROM items_complete_view 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    
    console.log('\nRecently updated items:');
    if (recentItems.rows.length > 0) {
      recentItems.rows.forEach(item => {
        console.log(`ID: ${item.id}, Name: ${item.name}, Updated: ${item.updated_at}, Box: ${item.box_id}, Qty: ${item.quantity}`);
      });
    } else {
      console.log('No items found');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rebuilding view:', error);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the function
rebuildView(); 