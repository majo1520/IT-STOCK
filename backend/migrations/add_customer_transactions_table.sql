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