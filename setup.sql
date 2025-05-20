-- ========================================================
-- REACTSTOCK - Complete PostgreSQL Database Setup
-- Version: 1.0.0
-- Created: 2023-05-25
-- ========================================================

-- ========================================================
-- CUSTOM TYPES
-- ========================================================

-- Create enum type for box status
CREATE TYPE box_status AS ENUM ('Available', 'In Use', 'Maintenance', 'Retired');

-- Create enum type for shelf locations
CREATE TYPE shelf_location AS ENUM ('A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4', 'E1', 'E2', 'E3', 'E4', 'F1', 'F2', 'F3', 'F4');

-- Create enum type for box locations
CREATE TYPE box_location AS ENUM ('IT OFFICE', 'IT HOUSE', 'SERVER ROOM', 'FINANCIAL STOCK');

-- Create enum type for transactions and item status
CREATE TYPE inventory_transaction_type AS ENUM ('in', 'out', 'transfer', 'adjustment', 'ADD_ITEM', 'REMOVE_ITEM', 'TRANSFER_IN', 'TRANSFER_OUT', 'CREATE');
CREATE TYPE item_status AS ENUM ('active', 'maintenance', 'archived', 'deleted');

-- ========================================================
-- HELPER FUNCTIONS
-- ========================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========================================================
-- CORE TABLES
-- ========================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shelves table
CREATE TABLE IF NOT EXISTS shelves (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#cccccc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create removal_reasons table
CREATE TABLE IF NOT EXISTS removal_reasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create boxes table
CREATE TABLE IF NOT EXISTS boxes (
    id SERIAL PRIMARY KEY,
    box_number VARCHAR(50) NOT NULL,
    description TEXT,
    serial_number VARCHAR(50),
    status box_status DEFAULT 'Available',
    shelf_id INTEGER REFERENCES shelves(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    qr_code VARCHAR(100),
    ean_code VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Main items table with essential fields
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    parent_item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    supplier VARCHAR(200),
    type VARCHAR(100),
    serial_number VARCHAR(100),
    ean_code VARCHAR(100),
    qr_code VARCHAR(100),
    status item_status NOT NULL DEFAULT 'active',
    notes TEXT,
    additional_data JSONB DEFAULT '{}',
    last_transaction_at TIMESTAMP WITH TIME ZONE,
    last_transaction_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Clear separation of item properties for extensibility
CREATE TABLE IF NOT EXISTS item_properties (
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
CREATE TABLE IF NOT EXISTS item_images (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item tags for better categorization and filtering
CREATE TABLE IF NOT EXISTS item_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#cccccc',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Item tag relations (many-to-many)
CREATE TABLE IF NOT EXISTS item_tag_relations (
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES item_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- Create transactions table to track box and item history
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    box_id INTEGER REFERENCES boxes(id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stock transaction history with robust tracking
CREATE TABLE IF NOT EXISTS item_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type inventory_transaction_type NOT NULL,
    quantity INTEGER NOT NULL,
    box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    previous_box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL, 
    new_box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    notes TEXT,
    supplier VARCHAR(200),
    reference_code VARCHAR(100),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- More detailed transaction metadata
CREATE TABLE IF NOT EXISTS transaction_metadata (
    transaction_id INTEGER PRIMARY KEY REFERENCES item_transactions(id) ON DELETE CASCADE,
    reason_id INTEGER REFERENCES removal_reasons(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100),
    external_reference VARCHAR(200),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}'
);

-- ========================================================
-- AUDIT TRAIL
-- ========================================================

CREATE TABLE IF NOT EXISTS item_audit_log (
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
-- INDEXES FOR PERFORMANCE
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
CREATE INDEX idx_items_description_trgm ON items USING gin(description gin_trgm_ops) WHERE description IS NOT NULL;

-- Item properties indexes
CREATE INDEX idx_item_properties_item_id ON item_properties(item_id);
CREATE INDEX idx_item_properties_ean_code ON item_properties(ean_code);
CREATE INDEX idx_item_properties_serial_number ON item_properties(serial_number);
CREATE INDEX idx_item_properties_type ON item_properties(type);
CREATE INDEX idx_item_properties_supplier ON item_properties(supplier);

-- Box indexes
CREATE INDEX idx_boxes_location_id ON boxes(location_id);
CREATE INDEX idx_boxes_shelf_id ON boxes(shelf_id);
CREATE INDEX idx_boxes_status ON boxes(status);
CREATE INDEX idx_boxes_box_number ON boxes(box_number);

-- Transaction indexes
CREATE INDEX idx_transactions_box_id ON transactions(box_id);
CREATE INDEX idx_transactions_item_id ON transactions(item_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- Item transaction indexes
CREATE INDEX idx_item_transactions_item_id ON item_transactions(item_id);
CREATE INDEX idx_item_transactions_box_id ON item_transactions(box_id);
CREATE INDEX idx_item_transactions_type ON item_transactions(type);
CREATE INDEX idx_item_transactions_transaction_date ON item_transactions(transaction_date);
CREATE INDEX idx_item_transactions_customer_id ON item_transactions(customer_id);

-- ========================================================
-- VIEWS FOR COMPLEX QUERIES
-- ========================================================

-- View that combines items with their properties
CREATE VIEW items_with_properties AS
SELECT 
    i.*,
    ip.purchase_date,
    ip.expiry_date,
    ip.warranty_expiry,
    ip.cost,
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
CREATE MATERIALIZED VIEW items_complete_view AS
WITH item_transactions_summary AS (
    SELECT 
        item_id,
        SUM(CASE WHEN type IN ('in', 'ADD_ITEM') THEN quantity ELSE 0 END) as total_in,
        SUM(CASE WHEN type IN ('out', 'REMOVE_ITEM') THEN quantity ELSE 0 END) as total_out,
        SUM(CASE WHEN type = 'adjustment' THEN quantity ELSE 0 END) as total_adjustments,
        MAX(transaction_date) as last_transaction_date
    FROM 
        item_transactions
    GROUP BY 
        item_id
)
SELECT 
    i.*,
    b.box_number,
    b.description as box_description,
    l.name as location_name,
    l.color as location_color,
    s.name as shelf_name,
    p.name as parent_name,
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
    i.deleted_at IS NULL;

-- ========================================================
-- TRIGGERS AND FUNCTIONS
-- ========================================================

-- Triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boxes_updated_at
    BEFORE UPDATE ON boxes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_item_properties_updated_at
    BEFORE UPDATE ON item_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelves_updated_at
    BEFORE UPDATE ON shelves
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log item changes
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

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_items_complete_view()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh materialized view on data changes
CREATE TRIGGER refresh_items_complete_trigger
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

CREATE TRIGGER refresh_properties_complete_trigger
AFTER INSERT OR UPDATE OR DELETE ON item_properties
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_items_complete_view();

-- Function to handle soft delete
CREATE OR REPLACE FUNCTION soft_delete_item()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE items SET 
        deleted_at = CURRENT_TIMESTAMP,
        status = 'deleted'
    WHERE id = OLD.id;
    RETURN NULL; -- Prevent the actual DELETE
END;
$$ LANGUAGE plpgsql;

-- Trigger for soft delete instead of hard delete
CREATE TRIGGER soft_delete_items_trigger
BEFORE DELETE ON items
FOR EACH ROW
WHEN (OLD.status != 'deleted')
EXECUTE FUNCTION soft_delete_item();

-- Function to update item quantity from transactions
CREATE OR REPLACE FUNCTION update_item_quantity_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('in', 'ADD_ITEM', 'TRANSFER_IN') THEN
        UPDATE items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type IN ('out', 'REMOVE_ITEM', 'TRANSFER_OUT') THEN
        UPDATE items SET quantity = GREATEST(0, quantity - NEW.quantity) WHERE id = NEW.item_id;
    ELSIF NEW.type = 'adjustment' THEN
        UPDATE items SET quantity = NEW.quantity WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update item quantity on transaction
CREATE TRIGGER update_quantity_on_transaction
AFTER INSERT ON item_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_quantity_from_transaction();

-- ========================================================
-- DEFAULT DATA
-- ========================================================

-- Create default admin user (Username: admin, Password: adminpass)
INSERT INTO users (username, password, email, role)
VALUES ('admin', '$2b$10$LPm39.tHuxLnN1zAYssnXu3LDz09v4e1sYGkKP9Gwrb39u7uKMwoa', 'admin@reactstock.com', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create default shelves
INSERT INTO shelves (name, description)
VALUES 
    ('Section A', 'Main storage section A'),
    ('Section B', 'Secondary storage section B'),
    ('Section C', 'Archive storage section C'),
    ('Section D', 'Maintenance storage')
ON CONFLICT DO NOTHING;

-- Create default locations
INSERT INTO locations (name, description, color)
VALUES 
    ('IT Office', 'Main IT department office', '#4287f5'),
    ('Server Room', 'Main server room', '#f54242'),
    ('Warehouse', 'Main warehouse storage', '#42f548'),
    ('Front Office', 'Front office reception area', '#f5c242')
ON CONFLICT DO NOTHING;

-- ========================================================
-- Create index on the materialized view for better performance
-- ========================================================
CREATE UNIQUE INDEX idx_items_complete_view_id ON items_complete_view(id);

-- ========================================================
-- END OF SCRIPT
-- ======================================================== 