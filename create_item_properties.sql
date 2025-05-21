CREATE TABLE IF NOT EXISTS item_properties (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type VARCHAR(100),
    ean_code VARCHAR(100),
    serial_number VARCHAR(100),
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_properties_item_id ON item_properties(item_id);

-- Add columns to items table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'type') THEN
        ALTER TABLE items ADD COLUMN type VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'ean_code') THEN
        ALTER TABLE items ADD COLUMN ean_code VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'serial_number') THEN
        ALTER TABLE items ADD COLUMN serial_number VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'qr_code') THEN
        ALTER TABLE items ADD COLUMN qr_code VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'supplier') THEN
        ALTER TABLE items ADD COLUMN supplier VARCHAR(100);
    END IF;
END
$$;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at timestamp on items
DROP TRIGGER IF EXISTS update_items_timestamp ON items;
CREATE TRIGGER update_items_timestamp
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Create a trigger to automatically update the updated_at timestamp on item_properties
DROP TRIGGER IF EXISTS update_item_properties_timestamp ON item_properties;
CREATE TRIGGER update_item_properties_timestamp
BEFORE UPDATE ON item_properties
FOR EACH ROW
EXECUTE FUNCTION update_modified_column(); 