-- Migration to add a unique reference ID to boxes table
-- This ID will be permanent and never reused, even after box deletion

-- Add a new uuid column with a default value
ALTER TABLE boxes ADD COLUMN reference_uuid UUID NOT NULL DEFAULT gen_random_uuid();

-- Add unique constraint to ensure this ID is never duplicated
ALTER TABLE boxes ADD CONSTRAINT unique_box_reference UNIQUE (reference_uuid);

-- Add a new barcode data column that will store the formatted barcode text
ALTER TABLE boxes ADD COLUMN barcode_data VARCHAR(50);

-- Create a function to generate the barcode data format
CREATE OR REPLACE FUNCTION generate_box_barcode() 
RETURNS TRIGGER AS $$
DECLARE
  location_code VARCHAR;
  shelf_code VARCHAR;
  box_ref VARCHAR;
BEGIN
  -- Get location code (first 2 chars)
  IF NEW.location_id IS NOT NULL THEN
    SELECT SUBSTRING(UPPER(name), 1, 2) INTO location_code FROM locations WHERE id = NEW.location_id;
  ELSE
    location_code := 'XX';
  END IF;

  -- Get shelf code
  IF NEW.shelf_id IS NOT NULL THEN
    SELECT SUBSTRING(UPPER(name), 1, 2) INTO shelf_code FROM shelves WHERE id = NEW.shelf_id;
  ELSE
    shelf_code := 'XX';
  END IF;

  -- Create a short version of the UUID (last 8 chars)
  box_ref := SUBSTRING(NEW.reference_uuid::text, 25, 8);
  
  -- Format: LC-SC-BN-REF where:
  -- LC = Location Code (2 chars)
  -- SC = Shelf Code (2 chars)
  -- BN = Box Number (padded)
  -- REF = Reference UUID (8 chars)
  NEW.barcode_data := location_code || shelf_code || 
                      LPAD(NEW.box_number::text, 4, '0') || 
                      box_ref;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically generate barcode data on insert/update
CREATE TRIGGER generate_box_barcode_trigger
BEFORE INSERT OR UPDATE ON boxes
FOR EACH ROW
EXECUTE FUNCTION generate_box_barcode();

-- Update all existing boxes to have barcode data
UPDATE boxes SET barcode_data = barcode_data;

-- Add a deleted_at column to implement soft deletion
-- This allows us to keep records of deleted boxes while preventing ID reuse
ALTER TABLE boxes ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index on the deleted_at column for better query performance
CREATE INDEX idx_boxes_deleted_at ON boxes (deleted_at);

-- Update queries to filter out deleted boxes
CREATE OR REPLACE FUNCTION soft_delete_box()
RETURNS TRIGGER AS $$
BEGIN
  -- Instead of actually deleting the row, just set the deleted_at timestamp
  UPDATE boxes SET deleted_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  
  -- Add a record to transactions
  INSERT INTO transactions (
    box_id, 
    transaction_type, 
    notes, 
    created_by
  ) VALUES (
    OLD.id, 
    'DELETE_BOX', 
    'Box was deleted. Reference ID ' || OLD.reference_uuid || ' preserved.', 
    CURRENT_USER
  );
  
  -- Prevent the actual deletion
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to handle soft deletion instead of hard deletion
CREATE TRIGGER soft_delete_box_trigger
BEFORE DELETE ON boxes
FOR EACH ROW
EXECUTE FUNCTION soft_delete_box();

-- Add a comment to document the purpose of these changes
COMMENT ON COLUMN boxes.reference_uuid IS 'Permanent unique identifier that will never be reused, even after box deletion';
COMMENT ON COLUMN boxes.barcode_data IS 'Formatted data for Code128 barcode, combining location, shelf, box number and reference';
COMMENT ON COLUMN boxes.deleted_at IS 'Timestamp when box was deleted (null means active box)'; 