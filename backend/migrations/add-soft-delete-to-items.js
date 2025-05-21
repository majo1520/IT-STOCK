/**
 * Migration to add soft delete functionality to items table
 */
exports.up = async (client) => {
  try {
    // Add deleted_at column to items table
    await client.query(`
      ALTER TABLE items 
      ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);
    
    // Add index on deleted_at for efficient queries
    await client.query(`
      CREATE INDEX idx_items_deleted_at ON items (deleted_at)
    `);
    
    // Modify existing queries to exclude deleted items by default
    await client.query(`
      CREATE OR REPLACE VIEW active_items AS
      SELECT * FROM items WHERE deleted_at IS NULL
    `);
    
    console.log('Migration successful: Added soft delete functionality to items table');
    return true;
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  }
};

exports.down = async (client) => {
  try {
    // Drop the view first
    await client.query(`DROP VIEW IF EXISTS active_items`);
    
    // Drop the index
    await client.query(`DROP INDEX IF EXISTS idx_items_deleted_at`);
    
    // Remove the deleted_at column
    await client.query(`
      ALTER TABLE items 
      DROP COLUMN IF EXISTS deleted_at
    `);
    
    console.log('Rollback successful: Removed soft delete functionality from items table');
    return true;
  } catch (err) {
    console.error('Rollback failed:', err);
    throw err;
  }
}; 