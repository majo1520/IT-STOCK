-- Add parent_item_id column to items table for parent-child relationships
ALTER TABLE items ADD COLUMN parent_item_id INTEGER;

-- Add foreign key constraint 
ALTER TABLE items ADD CONSTRAINT fk_parent_item
    FOREIGN KEY (parent_item_id) 
    REFERENCES items (id)
    ON DELETE SET NULL;

-- Add index to improve query performance
CREATE INDEX idx_items_parent_item_id ON items (parent_item_id);

COMMENT ON COLUMN items.parent_item_id IS 'References the parent item ID for hierarchical relationships'; 