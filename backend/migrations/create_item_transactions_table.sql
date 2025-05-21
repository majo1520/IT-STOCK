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