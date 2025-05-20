-- Add created_by column to boxes table
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

-- Update existing boxes to have a default created_by value
UPDATE boxes SET created_by = 'admin' WHERE created_by IS NULL;

-- Create an index on created_by for better performance
CREATE INDEX IF NOT EXISTS idx_boxes_created_by ON boxes(created_by); 