-- Add reference_id column to boxes table
ALTER TABLE boxes ADD COLUMN IF NOT EXISTS reference_id VARCHAR(50);

-- Add index for faster lookup by reference_id
CREATE INDEX IF NOT EXISTS idx_boxes_reference_id ON boxes (reference_id);

-- Update existing boxes to have a reference ID (using box number and timestamp)
DO $$
DECLARE
    box_record RECORD;
BEGIN
    FOR box_record IN SELECT id, box_number FROM boxes WHERE reference_id IS NULL LOOP
        UPDATE boxes 
        SET reference_id = 'BOX-' || LPAD(box_record.box_number, 4, '0') || '-' || 
                          SUBSTRING(CAST(EXTRACT(EPOCH FROM NOW()) AS VARCHAR), LENGTH(CAST(EXTRACT(EPOCH FROM NOW()) AS VARCHAR))-5)
        WHERE id = box_record.id;
    END LOOP;
END $$;

-- Comment on the column
COMMENT ON COLUMN boxes.reference_id IS 'Unique reference ID for the box, used for QR codes and labels'; 