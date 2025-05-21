-- Safe Item View Setup SQL
-- This script provides a safer way to set up the materialized view
-- with proper checks and error handling

-- Start a transaction so we can roll back if anything fails
BEGIN;

-- Check if the tables we need exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'items') THEN
        RAISE EXCEPTION 'The items table does not exist';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'item_properties') THEN
        RAISE EXCEPTION 'The item_properties table does not exist';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boxes') THEN
        RAISE EXCEPTION 'The boxes table does not exist';
    END IF;
END $$;

-- Fix any inconsistencies between items and item_properties tables

-- First identify items that don't have corresponding item_properties
INSERT INTO item_properties (item_id, type, ean_code, serial_number, created_at, updated_at)
SELECT 
    i.id, 
    i.type, 
    i.ean_code, 
    i.serial_number, 
    NOW(), 
    NOW()
FROM 
    items i
LEFT JOIN 
    item_properties ip ON i.id = ip.item_id
WHERE 
    ip.item_id IS NULL
    AND i.deleted_at IS NULL;

-- Update item_properties where items table has more recent or different data
UPDATE item_properties ip
SET 
    type = CASE 
        WHEN i.type IS NOT NULL AND (ip.type IS NULL OR ip.type != i.type) THEN i.type
        ELSE ip.type 
    END,
    ean_code = CASE 
        WHEN i.ean_code IS NOT NULL AND (ip.ean_code IS NULL OR ip.ean_code != i.ean_code) THEN i.ean_code
        ELSE ip.ean_code 
    END,
    serial_number = CASE 
        WHEN i.serial_number IS NOT NULL AND (ip.serial_number IS NULL OR ip.serial_number != i.serial_number) THEN i.serial_number
        ELSE ip.serial_number 
    END,
    updated_at = NOW()
FROM 
    items i
WHERE 
    ip.item_id = i.id
    AND (
        (i.type IS NOT NULL AND (ip.type IS NULL OR ip.type != i.type))
        OR (i.ean_code IS NOT NULL AND (ip.ean_code IS NULL OR ip.ean_code != i.ean_code))
        OR (i.serial_number IS NOT NULL AND (ip.serial_number IS NULL OR ip.serial_number != i.serial_number))
    );

-- Update items where item_properties has more complete data
UPDATE items i
SET 
    type = CASE 
        WHEN ip.type IS NOT NULL AND (i.type IS NULL OR i.type != ip.type) THEN ip.type
        ELSE i.type 
    END,
    ean_code = CASE 
        WHEN ip.ean_code IS NOT NULL AND (i.ean_code IS NULL OR i.ean_code != ip.ean_code) THEN ip.ean_code
        ELSE i.ean_code 
    END,
    serial_number = CASE 
        WHEN ip.serial_number IS NOT NULL AND (i.serial_number IS NULL OR i.serial_number != ip.serial_number) THEN ip.serial_number
        ELSE i.serial_number 
    END,
    updated_at = NOW()
FROM 
    item_properties ip
WHERE 
    i.id = ip.item_id
    AND (
        (ip.type IS NOT NULL AND (i.type IS NULL OR i.type != ip.type))
        OR (ip.ean_code IS NOT NULL AND (i.ean_code IS NULL OR i.ean_code != ip.ean_code))
        OR (ip.serial_number IS NOT NULL AND (i.serial_number IS NULL OR i.serial_number != ip.serial_number))
    );

-- Drop the view if it already exists
DROP MATERIALIZED VIEW IF EXISTS items_complete_view;

-- Create a materialized view that combines all item data
CREATE MATERIALIZED VIEW items_complete_view AS
WITH item_data AS (
    SELECT i.*,
           b.box_number,
           b.description as box_description,
           l.name as location_name,
           l.color as location_color,
           s.name as shelf_name,
           p.name as parent_name,
           ip.type as property_type,
           ip.ean_code as property_ean_code,
           ip.serial_number as property_serial_number,
           ip.additional_data as property_additional_data
    FROM items i
    LEFT JOIN boxes b ON i.box_id = b.id
    LEFT JOIN locations l ON b.location_id = l.id
    LEFT JOIN shelves s ON b.shelf_id = s.id
    LEFT JOIN items p ON i.parent_item_id = p.id
    LEFT JOIN item_properties ip ON i.id = ip.item_id
    WHERE i.deleted_at IS NULL
)
SELECT 
    id, name, description, quantity, box_id, created_at, updated_at,
    supplier, parent_item_id, deleted_at, box_number, box_description,
    location_name, location_color, shelf_name, parent_name,
    COALESCE(type, property_type) as type,
    COALESCE(ean_code, property_ean_code) as ean_code,
    COALESCE(serial_number, property_serial_number) as serial_number,
    qr_code, property_additional_data
FROM item_data;

-- Create index on the materialized view for better performance
CREATE INDEX items_complete_view_id_idx ON items_complete_view(id);
CREATE INDEX items_complete_view_box_id_idx ON items_complete_view(box_id);
CREATE INDEX items_complete_view_name_idx ON items_complete_view(name);
CREATE INDEX items_complete_view_type_idx ON items_complete_view(type);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_items_complete_view()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't make the trigger fail
        RAISE WARNING 'Failed to refresh items_complete_view: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to allow concurrent refresh
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
RETURNS void AS $$
BEGIN
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name);
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to refresh %: %', view_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on all relevant tables to refresh the view
-- Drop existing triggers first
DROP TRIGGER IF EXISTS refresh_items_view_items_trigger ON items;
DROP TRIGGER IF EXISTS refresh_items_view_properties_trigger ON item_properties;
DROP TRIGGER IF EXISTS refresh_items_view_boxes_trigger ON boxes;
DROP TRIGGER IF EXISTS refresh_items_view_locations_trigger ON locations;

-- Create new triggers
CREATE TRIGGER refresh_items_view_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

CREATE TRIGGER refresh_items_view_properties_trigger
AFTER INSERT OR UPDATE OR DELETE ON item_properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

CREATE TRIGGER refresh_items_view_boxes_trigger
AFTER UPDATE ON boxes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

CREATE TRIGGER refresh_items_view_locations_trigger
AFTER UPDATE ON locations
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Ensure the materialized view is initially populated
REFRESH MATERIALIZED VIEW items_complete_view;

-- Log success message
DO $$
BEGIN
    RAISE NOTICE 'Materialized view setup completed successfully';
END $$;

-- Commit the transaction
COMMIT; 