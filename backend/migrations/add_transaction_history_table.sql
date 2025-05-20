-- Create a comprehensive transaction history table to replace localStorage-based transaction tracking
CREATE TABLE IF NOT EXISTS item_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
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
  created_by VARCHAR(100),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_item_transactions_item_id ON item_transactions(item_id);
CREATE INDEX idx_item_transactions_box_id ON item_transactions(box_id);
CREATE INDEX idx_item_transactions_transaction_type ON item_transactions(transaction_type);
CREATE INDEX idx_item_transactions_created_at ON item_transactions(created_at);
CREATE INDEX idx_item_transactions_customer_id ON item_transactions(customer_id);

-- Add a trigger to automatically update the item_name field when a new transaction is added
CREATE OR REPLACE FUNCTION set_transaction_item_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_id IS NOT NULL AND NEW.item_name IS NULL THEN
    SELECT name INTO NEW.item_name FROM items WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_item_transaction_name
  BEFORE INSERT ON item_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_transaction_item_name();

-- Add a column to store additional metadata as JSON
ALTER TABLE item_transactions ADD COLUMN metadata JSONB;

-- Add a comment explaining the purpose of this table
COMMENT ON TABLE item_transactions IS 'Stores all item transaction history, replacing localStorage implementation'; 