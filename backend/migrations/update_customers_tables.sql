-- Add role_id column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL;

-- Create customer_transactions table to track item consumption by customers
CREATE TABLE IF NOT EXISTS customer_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  item_name VARCHAR(255),
  quantity INTEGER NOT NULL DEFAULT 1,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_by VARCHAR(100),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) DEFAULT 'CONSUMPTION'
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

CREATE TRIGGER set_customer_transaction_item_name
  BEFORE INSERT ON customer_transactions
  FOR EACH ROW
  EXECUTE FUNCTION set_customer_transaction_item_name();

-- Create roles table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6c757d',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for updated_at column
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (name, description, color) VALUES
  ('Customer', 'Regular customer', '#0d6efd'),
  ('VIP', 'Very important customer', '#dc3545'),
  ('Partner', 'Business partner', '#198754'),
  ('Supplier', 'Product supplier', '#fd7e14'),
  ('Internal', 'Internal department', '#6f42c1')
ON CONFLICT DO NOTHING;

-- Add a comment explaining the purpose of these changes
COMMENT ON TABLE customer_transactions IS 'Stores customer item consumption history, replacing localStorage implementation';
COMMENT ON COLUMN customers.role_id IS 'References the role assigned to this customer'; 