-- Create a table to store additional item properties that are currently in localStorage
CREATE TABLE IF NOT EXISTS item_properties (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  type VARCHAR(100),
  ean_code VARCHAR(100),
  serial_number VARCHAR(100),
  additional_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index to ensure only one property record per item
CREATE UNIQUE INDEX idx_item_properties_item_id ON item_properties(item_id);

-- Create index for searching by EAN code
CREATE INDEX idx_item_properties_ean_code ON item_properties(ean_code);

-- Create index for searching by serial number
CREATE INDEX idx_item_properties_serial_number ON item_properties(serial_number);

-- Create trigger to update the updated_at timestamp
CREATE TRIGGER update_item_properties_updated_at
  BEFORE UPDATE ON item_properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add a comment explaining the purpose of this table
COMMENT ON TABLE item_properties IS 'Stores additional item properties that were previously stored in localStorage';

-- Modify the items table to add columns for commonly used properties
ALTER TABLE items ADD COLUMN IF NOT EXISTS type VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS ean_code VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_ean_code ON items(ean_code);
CREATE INDEX IF NOT EXISTS idx_items_serial_number ON items(serial_number); 