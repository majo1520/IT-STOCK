-- Add item_id column to transactions table
ALTER TABLE transactions ADD COLUMN item_id INTEGER REFERENCES items(id) ON DELETE SET NULL; 