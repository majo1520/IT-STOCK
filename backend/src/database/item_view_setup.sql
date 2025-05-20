-- item_view_setup.sql
-- This script sets up a materialized view that combines item data with properties
-- and creates triggers to automatically refresh the view when data changes

-- Create a materialized view that combines all item data
CREATE MATERIALIZED VIEW IF NOT EXISTS items_complete_view AS
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
CREATE INDEX IF NOT EXISTS items_complete_view_id_idx ON items_complete_view(id);
CREATE INDEX IF NOT EXISTS items_complete_view_box_id_idx ON items_complete_view(box_id);
CREATE INDEX IF NOT EXISTS items_complete_view_name_idx ON items_complete_view(name);
CREATE INDEX IF NOT EXISTS items_complete_view_type_idx ON items_complete_view(type);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_items_complete_view()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on all relevant tables to refresh the view
-- Trigger for items table
DROP TRIGGER IF EXISTS refresh_items_view_items_trigger ON items;
CREATE TRIGGER refresh_items_view_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Trigger for item_properties table
DROP TRIGGER IF EXISTS refresh_items_view_properties_trigger ON item_properties;
CREATE TRIGGER refresh_items_view_properties_trigger
AFTER INSERT OR UPDATE OR DELETE ON item_properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Trigger for boxes table (since box data is displayed in the view)
DROP TRIGGER IF EXISTS refresh_items_view_boxes_trigger ON boxes;
CREATE TRIGGER refresh_items_view_boxes_trigger
AFTER UPDATE ON boxes
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Trigger for locations table
DROP TRIGGER IF EXISTS refresh_items_view_locations_trigger ON locations;
CREATE TRIGGER refresh_items_view_locations_trigger
AFTER UPDATE ON locations
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Ensure the materialized view is initially populated
REFRESH MATERIALIZED VIEW items_complete_view; 