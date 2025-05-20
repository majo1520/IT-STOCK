/**
 * Migration: Create Customer Transactions Table
 * 
 * This migration creates the customer_transactions table if it doesn't exist
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
        WHERE table_name = 'customer_transactions'
      ) as table_exists
    `);
    
    if (!tableCheck.rows[0].table_exists) {
      console.log('Creating customer_transactions table...');
      
      await client.query(`
        -- Create customer transactions table to track item consumption by customers
        CREATE TABLE IF NOT EXISTS customer_transactions (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
          item_name VARCHAR(255),
          quantity INTEGER NOT NULL DEFAULT 1,
          notes TEXT,
          transaction_type VARCHAR(50) DEFAULT 'CONSUMPTION',
          transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100),
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        
        -- Create indexes for better performance
        CREATE INDEX idx_customer_transactions_customer_id ON customer_transactions(customer_id);
        CREATE INDEX idx_customer_transactions_item_id ON customer_transactions(item_id);
        CREATE INDEX idx_customer_transactions_transaction_date ON customer_transactions(transaction_date);
        
        -- Add a trigger to automatically update the item_name field when a new transaction is added
        CREATE OR REPLACE FUNCTION set_customer_transaction_item_name()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.item_id IS NOT NULL AND NEW.item_name IS NULL THEN
            SELECT name INTO NEW.item_name FROM items WHERE id = NEW.item_id;
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER set_customer_transaction_name
          BEFORE INSERT ON customer_transactions
          FOR EACH ROW
          EXECUTE FUNCTION set_customer_transaction_item_name();
        
        -- Add a comment explaining the purpose of this table
        COMMENT ON TABLE customer_transactions IS 'Stores all customer consumption transactions';
      `);
      
      console.log('Successfully created customer_transactions table!');
    } else {
      console.log('customer_transactions table already exists, skipping creation');
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
    
    console.log('Dropping customer_transactions table...');
    
    // Drop the trigger and function first
    await client.query(`
      DROP TRIGGER IF EXISTS set_customer_transaction_name ON customer_transactions;
      DROP FUNCTION IF EXISTS set_customer_transaction_item_name();
    `);
    
    // Then drop the table
    await client.query('DROP TABLE IF EXISTS customer_transactions CASCADE');
    
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