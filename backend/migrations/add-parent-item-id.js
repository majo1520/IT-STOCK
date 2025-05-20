/**
 * Migration script to add parent_item_id column to the items table
 * This script checks if the column exists before adding it
 */

const { pool } = require('../config/database');

async function addParentItemIdColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Starting migration: Add parent_item_id column to items table');
    
    // Check if parent_item_id column already exists
    const checkColumnResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'parent_item_id'
      ) as column_exists
    `);
    
    const parentItemIdExists = checkColumnResult.rows[0].column_exists;
    console.log('Parent item ID column exists:', parentItemIdExists);
    
    if (!parentItemIdExists) {
      console.log('Adding parent_item_id column to items table...');
      
      // Begin transaction
      await client.query('BEGIN');
      
      // Add parent_item_id column
      await client.query(`
        ALTER TABLE items ADD COLUMN parent_item_id INTEGER;
      `);
      
      // Add foreign key constraint
      await client.query(`
        ALTER TABLE items ADD CONSTRAINT fk_parent_item
          FOREIGN KEY (parent_item_id) 
          REFERENCES items (id)
          ON DELETE SET NULL;
      `);
      
      // Add index to improve query performance
      await client.query(`
        CREATE INDEX idx_items_parent_item_id ON items (parent_item_id);
      `);
      
      // Add column comment
      await client.query(`
        COMMENT ON COLUMN items.parent_item_id IS 'References the parent item ID for hierarchical relationships';
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log('Successfully added parent_item_id column!');
    } else {
      console.log('parent_item_id column already exists, no changes needed.');
    }
    
    // Migrate data from localStorage if needed
    console.log('Checking for existing parent-child relationships in the database...');
    
    // Get all items
    const itemsResult = await client.query('SELECT id, parent_item_id FROM items');
    console.log(`Found ${itemsResult.rows.length} items in the database.`);
    
    // Check if there are any parent-child relationships already defined
    const itemsWithParents = itemsResult.rows.filter(item => item.parent_item_id !== null);
    console.log(`Found ${itemsWithParents.length} items with parent-child relationships already defined.`);
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  addParentItemIdColumn()
    .then(() => {
      console.log('Migration completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { addParentItemIdColumn }; 