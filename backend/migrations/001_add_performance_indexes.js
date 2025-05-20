/**
 * Migration: Add Performance Indexes
 * 
 * This migration adds additional indexes to improve query performance
 * for frequently accessed tables and columns.
 */

const { pool } = require('../config/database');

// Up migration - adds indexes
exports.up = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Items table indexes
    console.log('Adding indexes to items table...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_supplier ON items(supplier)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at)');
    
    // Boxes table indexes
    console.log('Adding indexes to boxes table...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_boxes_box_number ON boxes(box_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_boxes_reference_id ON boxes(reference_id)');
    
    // Transactions table indexes
    console.log('Adding indexes to transactions table...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
    
    // Customer transactions table indexes
    console.log('Adding indexes to customer_transactions table...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_transactions_transaction_date ON customer_transactions(transaction_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_transactions_transaction_type ON customer_transactions(transaction_type)');
    
    // Item transactions table indexes
    console.log('Adding indexes to item_transactions table...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_item_transactions_transaction_type ON item_transactions(transaction_type)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_item_transactions_user_id ON item_transactions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_item_transactions_supplier ON item_transactions(supplier)');
    
    // Add composite indexes for common query patterns
    console.log('Adding composite indexes for common query patterns...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_box_id_name ON items(box_id, name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_box_id_created_at ON transactions(box_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_item_transactions_item_id_created_at ON item_transactions(item_id, created_at DESC)');
    
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

// Down migration - removes indexes
exports.down = async function() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Items table indexes
    console.log('Removing indexes from items table...');
    await client.query('DROP INDEX IF EXISTS idx_items_name');
    await client.query('DROP INDEX IF EXISTS idx_items_type');
    await client.query('DROP INDEX IF EXISTS idx_items_supplier');
    await client.query('DROP INDEX IF EXISTS idx_items_created_at');
    
    // Boxes table indexes
    console.log('Removing indexes from boxes table...');
    await client.query('DROP INDEX IF EXISTS idx_boxes_box_number');
    await client.query('DROP INDEX IF EXISTS idx_boxes_reference_id');
    
    // Transactions table indexes
    console.log('Removing indexes from transactions table...');
    await client.query('DROP INDEX IF EXISTS idx_transactions_transaction_type');
    await client.query('DROP INDEX IF EXISTS idx_transactions_user_id');
    
    // Customer transactions table indexes
    console.log('Removing indexes from customer_transactions table...');
    await client.query('DROP INDEX IF EXISTS idx_customer_transactions_transaction_date');
    await client.query('DROP INDEX IF EXISTS idx_customer_transactions_transaction_type');
    
    // Item transactions table indexes
    console.log('Removing indexes from item_transactions table...');
    await client.query('DROP INDEX IF EXISTS idx_item_transactions_transaction_type');
    await client.query('DROP INDEX IF EXISTS idx_item_transactions_user_id');
    await client.query('DROP INDEX IF EXISTS idx_item_transactions_supplier');
    
    // Remove composite indexes
    console.log('Removing composite indexes...');
    await client.query('DROP INDEX IF EXISTS idx_items_box_id_name');
    await client.query('DROP INDEX IF EXISTS idx_transactions_box_id_created_at');
    await client.query('DROP INDEX IF EXISTS idx_item_transactions_item_id_created_at');
    
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