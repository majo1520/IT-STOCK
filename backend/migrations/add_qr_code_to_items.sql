-- Add qr_code column to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255);

-- Add comment explaining the purpose of the column
COMMENT ON COLUMN items.qr_code IS 'Unique QR code identifier for the item';
 
-- Create index for faster lookups by QR code
CREATE INDEX IF NOT EXISTS idx_items_qr_code ON items(qr_code); 