/**
 * Migration: Create Item Transactions Table
 * 
 * This migration creates the item_transactions table if it doesn't exist
 * and adds necessary indexes for performance.
 */

const { pool } = require('../config/database');

// Up migration - creates the table
exports.up = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if the table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'item_transactions'
      ) as table_exists
    `);
    
    if (!tableCheck.rows[0].table_exists) {
      console.log('Creating item_transactions table...');
      
      // First check if update_updated_at_column function exists
      const functionCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc
          WHERE proname = 'update_updated_at_column'
        ) as function_exists
      `);
      
      // Create the update_updated_at_column function if it doesn't exist
      if (!functionCheck.rows[0].function_exists) {
        console.log('Creating update_updated_at_column function...');
        await client.query(`
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `);
      }
      
      await client.query(`
        -- Create item_transactions table to track all item-related transactions
        CREATE TABLE IF NOT EXISTS item_transactions (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL,
          item_name VARCHAR(255),
          transaction_type VARCHAR(50) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          previous_quantity INTEGER,
          new_quantity INTEGER,
          box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
          previous_box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
          new_box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
          related_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
          related_item_name VARCHAR(255),
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          supplier VARCHAR(255),
          notes TEXT,
          details TEXT, -- Add details field as an alias for notes
          created_by VARCHAR(100),
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes for better performance
        CREATE INDEX idx_item_transactions_item_id ON item_transactions(item_id);
        CREATE INDEX idx_item_transactions_box_id ON item_transactions(box_id);
        CREATE INDEX idx_item_transactions_customer_id ON item_transactions(customer_id);
        CREATE INDEX idx_item_transactions_created_at ON item_transactions(created_at);
        CREATE INDEX idx_item_transactions_transaction_type ON item_transactions(transaction_type);
        
        -- Add a trigger to update the updated_at timestamp
        CREATE TRIGGER set_item_transactions_updated_at
        BEFORE UPDATE ON item_transactions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
        
        -- Add a comment explaining the purpose of this table
        COMMENT ON TABLE item_transactions IS 'Stores all item-related transactions';
      `);
      
      console.log('Successfully created item_transactions table!');
    } else {
      console.log('item_transactions table already exists, skipping creation');
      
      // Check if the details column exists and add it if it doesn't
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'item_transactions' AND column_name = 'details'
        ) as column_exists
      `);
      
      if (!columnCheck.rows[0].column_exists) {
        console.log('Adding details column to item_transactions table...');
        await client.query(`
          ALTER TABLE item_transactions ADD COLUMN details TEXT;
        `);
      }
    }
    
    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Down migration - drops the table
exports.down = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Dropping item_transactions table...');
    
    // Drop the trigger first
    await client.query(`
      DROP TRIGGER IF EXISTS set_item_transactions_updated_at ON item_transactions;
    `);
    
    // Then drop the table
    await client.query('DROP TABLE IF EXISTS item_transactions CASCADE');
    
    await client.query('COMMIT');
    console.log('Rollback completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rollback failed:', err);
    throw err;
  } finally {
    client.release();
  }
}; 