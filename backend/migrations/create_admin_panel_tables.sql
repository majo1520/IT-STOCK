-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create colors table
CREATE TABLE IF NOT EXISTS colors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  hex_code VARCHAR(7) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shelves table
CREATE TABLE IF NOT EXISTS shelves (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  color_id INTEGER REFERENCES colors(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update boxes table to use the new tables
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_shelf_check;
ALTER TABLE boxes DROP CONSTRAINT IF EXISTS boxes_location_check;
ALTER TABLE boxes DROP COLUMN IF EXISTS shelf;
ALTER TABLE boxes DROP COLUMN IF EXISTS location;

-- Add new foreign key columns
ALTER TABLE boxes ADD COLUMN shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL;
ALTER TABLE boxes ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_colors_name ON colors(name);
CREATE INDEX IF NOT EXISTS idx_shelves_name ON shelves(name);
CREATE INDEX IF NOT EXISTS idx_shelves_location_id ON shelves(location_id);
CREATE INDEX IF NOT EXISTS idx_shelves_color_id ON shelves(color_id);
CREATE INDEX IF NOT EXISTS idx_boxes_shelf_id ON boxes(shelf_id);
CREATE INDEX IF NOT EXISTS idx_boxes_location_id ON boxes(location_id);

-- Insert default colors
INSERT INTO colors (name, hex_code) VALUES 
  ('Red', '#FF0000'),
  ('Green', '#00FF00'),
  ('Blue', '#0000FF'),
  ('Yellow', '#FFFF00'),
  ('Purple', '#800080'),
  ('Orange', '#FFA500'),
  ('Black', '#000000'),
  ('White', '#FFFFFF'),
  ('Gray', '#808080')
ON CONFLICT (name) DO NOTHING;

-- Insert default locations from existing enum
INSERT INTO locations (name, description, color)
VALUES 
  ('IT OFFICE', 'IT department main office', '#4287f5'),
  ('IT HOUSE', 'External IT storage facility', '#42f5a7'),
  ('SERVER ROOM', 'Main server room', '#f54242'),
  ('FINANCIAL STOCK', 'Financial department storage', '#f5d142')
ON CONFLICT (name) DO NOTHING;

-- Create triggers for updated_at columns
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colors_updated_at
  BEFORE UPDATE ON colors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_shelves_updated_at
  BEFORE UPDATE ON shelves
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 