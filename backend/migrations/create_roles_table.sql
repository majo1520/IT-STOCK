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
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
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

-- Add a comment explaining the purpose of this table
COMMENT ON TABLE roles IS 'Stores customer and user roles with their display colors'; 