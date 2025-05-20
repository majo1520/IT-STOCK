const fs = require('fs');
const path = require('path');

// Path to our SQL file
const sqlFilePath = path.join(__dirname, '..', 'item_view_setup.sql');

/**
 * Apply migration
 */
async function up(pool) {
  console.log('Running migration: Add item materialized view');
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Create a function to refresh the materialized view concurrently to avoid locks
    await client.query(`
      -- Create a function to allow concurrent refresh  
      CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
      RETURNS void AS $$
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Read and execute the SQL file that sets up the materialized view
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await client.query(sql);
    
    // Add an entry to the migrations table
    await client.query(`
      INSERT INTO migrations (name, applied_at)
      VALUES ('004_add_item_materialized_view', NOW())
    `);
    
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Revert migration
 */
async function down(pool) {
  console.log('Reverting migration: Add item materialized view');
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Drop all triggers
    await client.query(`
      DROP TRIGGER IF EXISTS refresh_items_view_items_trigger ON items;
      DROP TRIGGER IF EXISTS refresh_items_view_properties_trigger ON item_properties;
      DROP TRIGGER IF EXISTS refresh_items_view_boxes_trigger ON boxes;
      DROP TRIGGER IF EXISTS refresh_items_view_locations_trigger ON locations;
    `);
    
    // Drop the refresh function
    await client.query(`
      DROP FUNCTION IF EXISTS refresh_items_complete_view();
      DROP FUNCTION IF EXISTS refresh_materialized_view(text);
    `);
    
    // Drop the indexes
    await client.query(`
      DROP INDEX IF EXISTS items_complete_view_id_idx;
      DROP INDEX IF EXISTS items_complete_view_box_id_idx;
      DROP INDEX IF EXISTS items_complete_view_name_idx;
      DROP INDEX IF EXISTS items_complete_view_type_idx;
    `);
    
    // Drop the materialized view
    await client.query(`DROP MATERIALIZED VIEW IF EXISTS items_complete_view;`);
    
    // Remove the migration record
    await client.query(`
      DELETE FROM migrations WHERE name = '004_add_item_materialized_view'
    `);
    
    await client.query('COMMIT');
    console.log('Migration reverted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Revert migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down }; 