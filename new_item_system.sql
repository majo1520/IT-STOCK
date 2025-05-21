-- ========================================================
-- OPTIMIZED POSTGRESQL ITEM SYSTEM FOR PRODUCTION
-- ========================================================

-- Create custom types for better data integrity and validation
CREATE TYPE inventory_transaction_type AS ENUM ('in', 'out', 'transfer', 'adjustment');
CREATE TYPE item_status AS ENUM ('active', 'maintenance', 'archived', 'deleted');

-- ========================================================
-- 1. CORE TABLES
-- ========================================================

-- Main items table with essential fields only
CREATE TABLE items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    parent_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    status item_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Clear separation of item properties for extensibility
CREATE TABLE item_properties (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type VARCHAR(100),
    ean_code VARCHAR(100),
    serial_number VARCHAR(100),
    qr_code VARCHAR(100),
    supplier VARCHAR(200),
    purchase_date DATE,
    expiry_date DATE,
    warranty_expiry DATE,
    cost DECIMAL(10,2),
    additional_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item images table for storing multiple images per item
CREATE TABLE item_images (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item tags for better categorization and filtering
CREATE TABLE item_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#cccccc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_tag_relations (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES item_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- ========================================================
-- 2. TRANSACTION TRACKING
-- ========================================================

-- Stock transaction history with robust tracking
CREATE TABLE item_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type inventory_transaction_type NOT NULL,
    quantity INTEGER NOT NULL,
    box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    previous_box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL, 
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    notes TEXT,
    supplier VARCHAR(200),
    reference_code VARCHAR(100),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- More detailed transaction metadata
CREATE TABLE transaction_metadata (
    transaction_id INTEGER PRIMARY KEY REFERENCES item_transactions(id) ON DELETE CASCADE,
    reason_id INTEGER REFERENCES removal_reasons(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100),
    external_reference VARCHAR(200),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}'
);

-- ========================================================
-- 3. AUDIT TRAIL
-- ========================================================

CREATE TABLE item_audit_log (
    id SERIAL PRIMARY KEY, 
    item_id INTEGER NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'restore'
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================
-- 4. INDEXES FOR PERFORMANCE
-- ========================================================

-- Main item indexes
CREATE INDEX idx_items_box_id ON items(box_id);
CREATE INDEX idx_items_parent_item_id ON items(parent_item_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_items_status_deleted_at ON items(status, deleted_at) WHERE deleted_at IS NOT NULL;

-- GIST index for full text search on item name and description
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_items_name_trgm ON items USING gin(name gin_trgm_ops);
CREATE INDEX idx_items_description_trgm ON items USING gin(description gin_trgm_ops);

-- Item properties indexes
CREATE INDEX idx_item_properties_item_id ON item_properties(item_id);
CREATE INDEX idx_item_properties_ean_code ON item_properties(ean_code);
CREATE INDEX idx_item_properties_serial_number ON item_properties(serial_number);
CREATE INDEX idx_item_properties_type ON item_properties(type);
CREATE INDEX idx_item_properties_supplier ON item_properties(supplier);

-- Transaction indexes
CREATE INDEX idx_item_transactions_item_id ON item_transactions(item_id);
CREATE INDEX idx_item_transactions_box_id ON item_transactions(box_id);
CREATE INDEX idx_item_transactions_type ON item_transactions(type);
CREATE INDEX idx_item_transactions_transaction_date ON item_transactions(transaction_date);
CREATE INDEX idx_item_transactions_customer_id ON item_transactions(customer_id);

-- ========================================================
-- 5. VIEWS FOR COMPLEX QUERIES
-- ========================================================

-- View that combines items with their properties
CREATE VIEW items_with_properties AS
SELECT 
    i.*,
    ip.type, 
    ip.ean_code, 
    ip.serial_number, 
    ip.qr_code, 
    ip.supplier,
    ip.purchase_date,
    ip.expiry_date,
    ip.warranty_expiry,
    ip.cost,
    ip.additional_data,
    b.box_number,
    b.description as box_description,
    l.name as location_name,
    s.name as shelf_name,
    p.name as parent_name,
    (SELECT array_agg(t.name) FROM item_tag_relations tr 
     JOIN item_tags t ON tr.tag_id = t.id 
     WHERE tr.item_id = i.id) as tags
FROM 
    items i
LEFT JOIN 
    item_properties ip ON i.id = ip.item_id
LEFT JOIN 
    boxes b ON i.box_id = b.id
LEFT JOIN 
    locations l ON b.location_id = l.id
LEFT JOIN 
    shelves s ON b.shelf_id = s.id
LEFT JOIN 
    items p ON i.parent_item_id = p.id
WHERE 
    i.status != 'deleted' OR i.status IS NULL;

-- Materialized view for reports and dashboards
CREATE MATERIALIZED VIEW items_complete_data AS
WITH item_transactions_summary AS (
    SELECT 
        item_id,
        SUM(CASE WHEN type = 'in' THEN quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN type = 'out' THEN quantity ELSE 0 END) as total_out,
        SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END) as total_adjustments,
        MAX(transaction_date) as last_transaction_date
    FROM 
        item_transactions
    GROUP BY 
        item_id
)
SELECT 
    i.*,
    ip.type, 
    ip.ean_code, 
    ip.serial_number, 
    ip.qr_code,
    ip.supplier,
    ip.purchase_date,
    ip.warranty_expiry,
    ip.cost,
    b.box_number,
    b.description as box_description,
    l.name as location_name,
    s.name as shelf_name,
    p.name as parent_name,
    p.id as parent_id,
    its.total_in,
    its.total_out,
    its.total_adjustments,
    its.last_transaction_date,
    (SELECT COUNT(*) FROM items WHERE parent_item_id = i.id) as subitems_count,
    (SELECT string_agg(t.name, ', ') FROM item_tag_relations tr 
     JOIN item_tags t ON tr.tag_id = t.id 
     WHERE tr.item_id = i.id) as tags
FROM 
    items i
LEFT JOIN 
    item_properties ip ON i.id = ip.item_id
LEFT JOIN 
    boxes b ON i.box_id = b.id
LEFT JOIN 
    locations l ON b.location_id = l.id
LEFT JOIN 
    shelves s ON b.shelf_id = s.id
LEFT JOIN 
    items p ON i.parent_item_id = p.id
LEFT JOIN
    item_transactions_summary its ON i.id = its.item_id
WHERE 
    i.status != 'deleted' OR i.status IS NULL;

-- ========================================================
-- 6. TRIGGERS AND FUNCTIONS
-- ========================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_items_timestamp
BEFORE UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_item_properties_timestamp
BEFORE UPDATE ON item_properties
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Trigger for audit logging
CREATE OR REPLACE FUNCTION log_item_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields JSONB := '{}';
    old_values JSONB := '{}';
    new_values JSONB := '{}';
    user_id INTEGER;
BEGIN
    -- Get current user ID from app context if available
    BEGIN
        user_id := current_setting('app.current_user_id')::INTEGER;
    EXCEPTION
        WHEN OTHERS THEN
            user_id := NULL;
    END;
    
    -- Determine changed fields and values
    IF TG_OP = 'UPDATE' THEN
        IF NEW.name IS DISTINCT FROM OLD.name THEN
            changed_fields := changed_fields || '{"name": true}';
            old_values := old_values || jsonb_build_object('name', OLD.name);
            new_values := new_values || jsonb_build_object('name', NEW.name);
        END IF;
        
        IF NEW.description IS DISTINCT FROM OLD.description THEN
            changed_fields := changed_fields || '{"description": true}';
            old_values := old_values || jsonb_build_object('description', OLD.description);
            new_values := new_values || jsonb_build_object('description', NEW.description);
        END IF;
        
        IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
            changed_fields := changed_fields || '{"quantity": true}';
            old_values := old_values || jsonb_build_object('quantity', OLD.quantity);
            new_values := new_values || jsonb_build_object('quantity', NEW.quantity);
        END IF;
        
        IF NEW.box_id IS DISTINCT FROM OLD.box_id THEN
            changed_fields := changed_fields || '{"box_id": true}';
            old_values := old_values || jsonb_build_object('box_id', OLD.box_id);
            new_values := new_values || jsonb_build_object('box_id', NEW.box_id);
        END IF;
        
        IF NEW.parent_item_id IS DISTINCT FROM OLD.parent_item_id THEN
            changed_fields := changed_fields || '{"parent_item_id": true}';
            old_values := old_values || jsonb_build_object('parent_item_id', OLD.parent_item_id);
            new_values := new_values || jsonb_build_object('parent_item_id', NEW.parent_item_id);
        END IF;
        
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            changed_fields := changed_fields || '{"status": true}';
            old_values := old_values || jsonb_build_object('status', OLD.status);
            new_values := new_values || jsonb_build_object('status', NEW.status);
        END IF;
        
        -- Only record an audit entry if something actually changed
        IF changed_fields != '{}' THEN
            INSERT INTO item_audit_log (
                item_id, 
                user_id, 
                action, 
                changed_fields,
                old_values, 
                new_values, 
                ip_address
            ) VALUES (
                NEW.id,
                user_id,
                'update',
                changed_fields,
                old_values,
                new_values,
                inet_client_addr()
            );
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO item_audit_log (
            item_id, 
            user_id, 
            action, 
            new_values, 
            ip_address
        ) VALUES (
            NEW.id,
            user_id,
            'create',
            jsonb_build_object(
                'name', NEW.name,
                'description', NEW.description,
                'quantity', NEW.quantity,
                'box_id', NEW.box_id,
                'parent_item_id', NEW.parent_item_id,
                'status', NEW.status
            ),
            inet_client_addr()
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO item_audit_log (
            item_id, 
            user_id, 
            action, 
            old_values, 
            ip_address
        ) VALUES (
            OLD.id,
            user_id,
            'delete',
            jsonb_build_object(
                'name', OLD.name,
                'description', OLD.description,
                'quantity', OLD.quantity,
                'box_id', OLD.box_id,
                'parent_item_id', OLD.parent_item_id, 
                'status', OLD.status
            ),
            inet_client_addr()
        );
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers
CREATE TRIGGER items_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH ROW
EXECUTE FUNCTION log_item_changes();

-- Trigger to refresh the materialized view when data changes
CREATE OR REPLACE FUNCTION refresh_items_complete_data()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_data;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_items_complete_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_data();

CREATE TRIGGER refresh_properties_complete_trigger
AFTER INSERT OR UPDATE OR DELETE ON item_properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_data();

-- Function to handle soft deletes
CREATE OR REPLACE FUNCTION soft_delete_item()
RETURNS TRIGGER AS $$
BEGIN
    NEW.status = 'deleted';
    NEW.deleted_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for soft deletes
CREATE TRIGGER soft_delete_items_trigger
BEFORE DELETE ON items
FOR EACH ROW
WHEN (OLD.status != 'deleted')
EXECUTE FUNCTION soft_delete_item();

-- Function to update item quantity based on transactions
CREATE OR REPLACE FUNCTION update_item_quantity_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'in' THEN
        UPDATE items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type = 'out' THEN
        UPDATE items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type = 'adjustment' THEN
        UPDATE items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type = 'transfer' AND NEW.previous_box_id IS NOT NULL AND NEW.box_id IS NOT NULL AND NEW.previous_box_id != NEW.box_id THEN
        -- For transfers, only update the box_id, not the quantity
        UPDATE items SET box_id = NEW.box_id WHERE id = NEW.item_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for transaction-based quantity updates
CREATE TRIGGER update_quantity_on_transaction
AFTER INSERT ON item_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_quantity_from_transaction();

-- ========================================================
-- 7. MIGRATION FUNCTIONS
-- ========================================================

-- Function to migrate data from the old schema to the new one
CREATE OR REPLACE FUNCTION migrate_items_to_new_schema()
RETURNS VOID AS $$
DECLARE
    item_record RECORD;
    new_item_id INTEGER;
BEGIN
    -- Loop through each item in the old table
    FOR item_record IN SELECT * FROM items_old LOOP
        -- Insert into the new items table
        INSERT INTO items (
            id, 
            name, 
            description, 
            quantity, 
            box_id, 
            parent_item_id,
            status,
            created_at,
            updated_at,
            deleted_at
        ) VALUES (
            item_record.id,
            item_record.name,
            item_record.description,
            item_record.quantity,
            item_record.box_id,
            item_record.parent_item_id,
            CASE 
                WHEN item_record.deleted_at IS NOT NULL THEN 'deleted'::item_status 
                ELSE 'active'::item_status
            END,
            item_record.created_at,
            item_record.updated_at,
            item_record.deleted_at
        )
        RETURNING id INTO new_item_id;
        
        -- Insert associated properties
        INSERT INTO item_properties (
            item_id,
            type,
            ean_code,
            serial_number,
            qr_code,
            supplier
        ) VALUES (
            new_item_id,
            item_record.type,
            item_record.ean_code,
            item_record.serial_number,
            item_record.qr_code,
            item_record.supplier
        );
    END LOOP;
    
    -- Handle transactions migration here
    -- Insert code to migrate transaction data...
END;
$$ LANGUAGE plpgsql; 