const { pool } = require('../../config/database');

// Add this helper function at the top of the file, after imports
const refreshMaterializedView = async (client) => {
    try {
        console.log('Refreshing items_complete_view materialized view');
        await client.query('REFRESH MATERIALIZED VIEW items_complete_view');
        console.log('Successfully refreshed materialized view');
        return true;
    } catch (error) {
        console.error('Error refreshing materialized view:', error.message);
        return false;
    }
};

// Helper function to process items and handle duplicates
const processDuplicateItemNames = (items) => {
    // First, identify items with duplicate names
    const nameCount = {};
    const itemsByName = {};
    
    // Count occurrences of each name
    items.forEach(item => {
        if (item.name) {
            nameCount[item.name] = (nameCount[item.name] || 0) + 1;
            
            if (!itemsByName[item.name]) {
                itemsByName[item.name] = [];
            }
            itemsByName[item.name].push(item);
        }
    });
    
    // Process items with duplicate names
    Object.entries(nameCount).forEach(([name, count]) => {
        if (count > 1) {
            console.log(`Found ${count} items with the same name: "${name}"`);
            
            // Sort duplicate items by ID (typically creation order)
            const duplicates = itemsByName[name].sort((a, b) => a.id - b.id);
            
            // Update item names to include distinguishing info
            duplicates.forEach((item, index) => {
                // Add suffix with box number or ID if needed
                if (index > 0) {
                    // If the item has a box, include box number in the display name
                    if (item.box_id && item.box_number) {
                        item.display_name = `${item.name} (Box ${item.box_number})`;
                    } else {
                        // Otherwise use the item ID
                        item.display_name = `${item.name} (ID: ${item.id})`;
                    }
                } else {
                    // First occurrence just uses original name as display_name
                    item.display_name = item.name;
                }
            });
        }
        // For non-duplicates, don't set display_name at all
    });
    
    return items;
};

// GET all items
const getItems = async (req, res) => {
    const client = await pool.connect();
    try {
        // Extract query parameters
        const { 
            box_id, 
            search, 
            sort = 'id', 
            sort_direction = 'asc',
            parent_id,
            include_deleted = false,
            qr_code = null,
            ean_code = null,
            serial_number = null,
            type = null,
            timestamp = null // Ignore timestamp parameter, but accept it for client compatibility
        } = req.query;
        
        // Log the request for debugging
        console.log('getItems request params:', { 
            box_id, 
            search, 
            sort, 
            sort_direction, 
            parent_id, 
            include_deleted,
            qr_code,
            ean_code,
            serial_number,
            type,
            timestamp 
        });
        
        try {
            // First try to use the materialized view
            let query = `SELECT * FROM items_complete_view WHERE 1=1`;
            
            const queryParams = [];
            let paramIndex = 1;
            
            // Add filters
            if (box_id) {
                query += ` AND box_id = $${paramIndex}`;
                queryParams.push(box_id);
                paramIndex++;
            }
            
            if (parent_id) {
                query += ` AND parent_item_id = $${paramIndex}`;
                queryParams.push(parent_id);
                paramIndex++;
            }
            
            if (qr_code) {
                query += ` AND qr_code = $${paramIndex}`;
                queryParams.push(qr_code);
                paramIndex++;
            }
            
            if (ean_code) {
                query += ` AND ean_code = $${paramIndex}`;
                queryParams.push(ean_code);
                paramIndex++;
            }
            
            if (serial_number) {
                // Use exact match for serial number (equals, not ILIKE)
                query += ` AND serial_number = $${paramIndex}`;
                queryParams.push(serial_number);
                paramIndex++;
            }
            
            // Add type filter
            if (type) {
                query += ` AND type = $${paramIndex}`;
                queryParams.push(type);
                paramIndex++;
            }
            
            if (search) {
                // Check if search is a specific ID search (id:XXX)
                const idMatch = search.match(/^id:(\d+)$/i);
                if (idMatch) {
                    query += ` AND id = $${paramIndex}`;
                    queryParams.push(idMatch[1]);
                    paramIndex++;
                }
                // Check if search is a numeric value (enhanced numeric search)
                else if (/^\d+$/.test(search)) {
                    // Search for the number in multiple fields including name
                    query += ` AND (
                        name ILIKE $${paramIndex} OR
                        name ILIKE $${paramIndex + 1} OR
                        name ~ $${paramIndex + 2} OR
                        id::text = $${paramIndex + 3} OR
                        serial_number = $${paramIndex + 3} OR
                        ean_code = $${paramIndex + 3} OR
                        qr_code = $${paramIndex + 3} OR
                        description ILIKE $${paramIndex + 4}
                    )`;
                    queryParams.push(`%${search}%`); // Partial match for name
                    queryParams.push(`${search}%`); // Match at start of name
                    queryParams.push(`\\m${search}\\M`); // Word boundary match for name using regex
                    queryParams.push(search); // Exact match for ID, serial, etc.
                    queryParams.push(`%${search}%`); // Partial match in description
                    paramIndex += 5;
                }
                // Check if search is a specific reference number search (ref:XXX)
                else if (search.match(/^ref:(.+)$/i)) {
                    const refNumber = search.match(/^ref:(.+)$/i)[1];
                    query += ` AND (
                        serial_number = $${paramIndex} OR
                        ean_code = $${paramIndex} OR
                        qr_code = $${paramIndex}
                    )`;
                    queryParams.push(refNumber);
                    paramIndex++;
                }
                // Otherwise do a regular search with ILIKE
                else {
                    query += ` AND (
                        name ILIKE $${paramIndex} OR
                        description ILIKE $${paramIndex} OR
                        serial_number ILIKE $${paramIndex} OR
                        ean_code ILIKE $${paramIndex} OR
                        type ILIKE $${paramIndex} OR
                        supplier ILIKE $${paramIndex}
                    )`;
                    queryParams.push(`%${search}%`);
                    paramIndex++;
                }
            }
            
            // Add sorting
            const validColumns = ['id', 'name', 'created_at', 'quantity', 'box_id', 'type', 'ean_code', 'serial_number', 'supplier', 'description'];
            const validDirections = ['asc', 'desc'];
            
            const sortColumn = validColumns.includes(sort) ? sort : 'id';
            const direction = validDirections.includes(sort_direction.toLowerCase()) ? sort_direction : 'asc';
            
            query += ` ORDER BY ${sortColumn} ${direction}, id ASC`;
            
            console.log('Items query:', query);
            console.log('Query params:', queryParams);
            
            const result = await client.query(query, queryParams);
            console.log(`Found ${result.rows.length} items`);
            
            // Process items to handle duplicate names
            const processedItems = processDuplicateItemNames(result.rows);
            
            // Return the results directly
            res.json(processedItems);
            
        } catch (viewError) {
            // If the materialized view doesn't exist yet, fall back to the direct table query
            console.error('Error using materialized view, falling back to direct query:', viewError.message);
            
            // Build the query with direct joins to get all item details
            let query = `
                SELECT 
                    i.*,
                    b.box_number,
                    b.description as box_description,
                    l.name as location_name,
                    l.color as location_color,
                    s.name as shelf_name,
                    p.name as parent_name
                FROM items i
                LEFT JOIN boxes b ON i.box_id = b.id
                LEFT JOIN locations l ON b.location_id = l.id
                LEFT JOIN shelves s ON b.shelf_id = s.id
                LEFT JOIN items p ON i.parent_item_id = p.id
                WHERE 1=1
            `;
            
            // Unless specifically requested, exclude deleted items
            if (include_deleted !== 'true') {
                query += ` AND i.deleted_at IS NULL`;
            }
            
            const queryParams = [];
            let paramIndex = 1;
            
            // Add filters
            if (box_id) {
                query += ` AND i.box_id = $${paramIndex}`;
                queryParams.push(box_id);
                paramIndex++;
            }
            
            if (parent_id) {
                query += ` AND i.parent_item_id = $${paramIndex}`;
                queryParams.push(parent_id);
                paramIndex++;
            }
            
            if (qr_code) {
                query += ` AND i.qr_code = $${paramIndex}`;
                queryParams.push(qr_code);
                paramIndex++;
            }
            
            if (ean_code) {
                query += ` AND i.ean_code = $${paramIndex}`;
                queryParams.push(ean_code);
                paramIndex++;
            }
            
            if (serial_number) {
                // Use exact match for serial number (equals, not ILIKE)
                query += ` AND i.serial_number = $${paramIndex}`;
                queryParams.push(serial_number);
                paramIndex++;
            }
            
            // Add type filter
            if (type) {
                query += ` AND i.type = $${paramIndex}`;
                queryParams.push(type);
                paramIndex++;
            }
            
            if (search) {
                // Check if search is a specific ID search (id:XXX)
                const idMatch = search.match(/^id:(\d+)$/i);
                if (idMatch) {
                    query += ` AND i.id = $${paramIndex}`;
                    queryParams.push(idMatch[1]);
                    paramIndex++;
                }
                // Check if search is a numeric value (enhanced numeric search)
                else if (/^\d+$/.test(search)) {
                    // Search for the number in multiple fields including name
                    query += ` AND (
                        i.name ILIKE $${paramIndex} OR
                        i.name ILIKE $${paramIndex + 1} OR
                        i.name ~ $${paramIndex + 2} OR
                        i.id::text = $${paramIndex + 3} OR
                        i.serial_number = $${paramIndex + 3} OR
                        i.ean_code = $${paramIndex + 3} OR
                        i.qr_code = $${paramIndex + 3} OR
                        i.description ILIKE $${paramIndex + 4}
                    )`;
                    queryParams.push(`%${search}%`); // Partial match for name
                    queryParams.push(`${search}%`); // Match at start of name
                    queryParams.push(`\\m${search}\\M`); // Word boundary match for name using regex
                    queryParams.push(search); // Exact match for ID, serial, etc.
                    queryParams.push(`%${search}%`); // Partial match in description
                    paramIndex += 5;
                }
                // Check if search is a specific reference number search (ref:XXX)
                else if (search.match(/^ref:(.+)$/i)) {
                    const refNumber = search.match(/^ref:(.+)$/i)[1];
                    query += ` AND (
                        i.serial_number = $${paramIndex} OR
                        i.ean_code = $${paramIndex} OR
                        i.qr_code = $${paramIndex}
                    )`;
                    queryParams.push(refNumber);
                    paramIndex++;
                }
                // Otherwise do a regular search with ILIKE
                else {
                    query += ` AND (
                        i.name ILIKE $${paramIndex} OR
                        i.description ILIKE $${paramIndex} OR
                        i.serial_number ILIKE $${paramIndex} OR
                        i.ean_code ILIKE $${paramIndex} OR
                        i.type ILIKE $${paramIndex} OR
                        i.supplier ILIKE $${paramIndex}
                    )`;
                    queryParams.push(`%${search}%`);
                    paramIndex++;
                }
            }
            
            // Add sorting
            const validColumns = ['id', 'name', 'created_at', 'quantity', 'box_id', 'type', 'ean_code', 'serial_number', 'supplier', 'description'];
            const validDirections = ['asc', 'desc'];
            
            const sortColumn = validColumns.includes(sort) ? sort : 'id';
            const direction = validDirections.includes(sort_direction.toLowerCase()) ? sort_direction : 'asc';
            
            query += ` ORDER BY ${sortColumn} ${direction}, id ASC`;
            
            console.log('Fallback Items query:', query);
            console.log('Fallback Query params:', queryParams);
            
            const result = await client.query(query, queryParams);
            console.log(`Found ${result.rows.length} items using fallback query`);
            
            // Process items to handle duplicate names
            const processedItems = processDuplicateItemNames(result.rows);
            
            // Return the results directly
            res.json(processedItems);
        }
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    } finally {
        client.release();
    }
};

// GET single item
const getItemById = async (req, res) => {
    try {
        const itemId = req.params.id;
        
        const result = await pool.query(`
            SELECT i.*,
                   b.box_number,
                   b.description as box_description,
                   b.serial_number as box_serial_number,
                   l.name as location_name,
                   l.color as location_color,
                   s.name as shelf_name
            FROM items i
            LEFT JOIN boxes b ON i.box_id = b.id
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN shelves s ON b.shelf_id = s.id
            WHERE i.id = $1
        `, [itemId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching item details:', err);
        res.status(500).json({ error: 'Failed to fetch item details' });
    }
};

// CREATE new item
const createItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { 
            name, 
            description, 
            quantity, 
            box_id, 
            supplier, 
            type, 
            serial_number, 
            parent_item_id, 
            ean_code, 
            qr_code
        } = req.body;
        
        console.log('Create item request:', req.body);
        console.log('Type value received:', type);
        console.log('Supplier value received:', supplier);
        
        // Check for column existence in the database schema
        let hasNotesColumn = false;
        let hasAdditionalDataColumn = false;
        
        try {
            const columnCheckResult = await client.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'items' AND column_name IN ('notes', 'additional_data')
            `);
            
            const columns = columnCheckResult.rows.map(row => row.column_name);
            hasNotesColumn = columns.includes('notes');
            hasAdditionalDataColumn = columns.includes('additional_data');
            
            console.log('Column check results:', { hasNotesColumn, hasAdditionalDataColumn });
        } catch (err) {
            console.error('Error checking for columns:', err);
            // If we can't check, assume they don't exist
            hasNotesColumn = false;
            hasAdditionalDataColumn = false;
        }
        
        await client.query('BEGIN');
        
        // Build query and values dynamically based on column existence
        let columnNames = [
            'name', 
            'description', 
            'quantity', 
            'box_id', 
            'supplier', 
            'type', 
            'serial_number', 
            'parent_item_id',
            'ean_code',
            'qr_code',
            'last_transaction_at',
            'last_transaction_type'
        ];
        
        let placeholders = [];
        let values = [
            name, 
            description || null, 
            quantity || 0, 
            box_id || null, 
            supplier || null, 
            type || null, 
            serial_number || null, 
            parent_item_id || null,
            ean_code || null,
            qr_code || null,
            new Date(),
            'CREATE'
        ];
        
        // Add notes if the column exists
        if (hasNotesColumn) {
            columnNames.push('notes');
            values.push(req.body.notes || null);
        }
        
        // Add additional_data if the column exists
        if (hasAdditionalDataColumn) {
            columnNames.push('additional_data');
            values.push(req.body.additional_data ? JSON.stringify(req.body.additional_data) : '{}');
        }
        
        // Generate placeholders ($1, $2, etc.)
        for (let i = 1; i <= values.length; i++) {
            placeholders.push(`$${i}`);
        }
        
        // Construct the final query
        const insertQuery = `
            INSERT INTO items (${columnNames.join(', ')}) 
            VALUES (${placeholders.join(', ')}) 
            RETURNING *
        `;
        
        console.log('Insert query:', insertQuery);
        console.log('Insert values:', values);
        
        const result = await client.query(insertQuery, values);
        const newItemId = result.rows[0].id;

        // Record the 'add item' transaction if a box was specified
        if (box_id) {
            await client.query(
                'INSERT INTO transactions (box_id, item_id, user_id, transaction_type, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
                [box_id, newItemId, req.user?.id || null, 'ADD_ITEM', `New item '${name}' added to box`, req.user?.username || 'system']
            );
        }
        
        await client.query('COMMIT');
        
        // Refresh the materialized view to ensure changes are visible immediately
        await refreshMaterializedView(client);
        
        // Get the updated item data
        let createdItem;
        try {
            // Try to use the materialized view
            const fullItemResult = await client.query(`
                SELECT * FROM items_complete_view WHERE id = $1
            `, [newItemId]);
            
            if (fullItemResult.rows.length > 0) {
                createdItem = fullItemResult.rows[0];
                console.log('Created new item from view:', createdItem);
            }
        } catch (viewError) {
            console.error('Error using materialized view, falling back to direct query:', viewError.message);
            
            // Fallback to direct query
            const fullItemResult = await client.query(`
                SELECT i.*,
                       b.box_number,
                       b.description as box_description,
                       l.name as location_name,
                       s.name as shelf_name,
                       p.name as parent_name
                FROM items i
                LEFT JOIN boxes b ON i.box_id = b.id
                LEFT JOIN locations l ON b.location_id = l.id
                LEFT JOIN shelves s ON b.shelf_id = s.id
                LEFT JOIN items p ON i.parent_item_id = p.id
                WHERE i.id = $1
            `, [newItemId]);
            
            createdItem = fullItemResult.rows[0];
            console.log('Created item from direct query:', createdItem);
        }
        
        // Notify all connected clients about the new item
        if (global.wsServer) {
            global.wsServer.notifyItemChange('create', createdItem);
        }
        
        res.status(201).json(createdItem);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating item:', err);
        res.status(500).json({ error: 'Failed to create item: ' + err.message });
    } finally {
        client.release();
    }
};

// UPDATE item
const updateItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.id;
        const { 
            name, 
            description, 
            quantity, 
            box_id, 
            supplier, 
            type, 
            serial_number, 
            parent_item_id, 
            qr_code, 
            ean_code,
            notes,
            additional_data
        } = req.body;

        // Debug log the request
        console.log('Update item request for ID:', itemId);
        console.log('Request body:', req.body);

        await client.query('BEGIN');
        
        // Check if item exists
        const checkResult = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const oldItem = checkResult.rows[0];
        const oldBoxId = oldItem.box_id;

        // Build the update query dynamically
        let updateFields = [];
        let values = [];
        let paramCounter = 1;
        
        // Add each field that might be updated
        if (name !== undefined) {
            updateFields.push(`name = $${paramCounter++}`);
            values.push(name);
        }
        
        if (description !== undefined) {
            updateFields.push(`description = $${paramCounter++}`);
            values.push(description === '' ? null : description);
        }
        
        if (quantity !== undefined) {
            updateFields.push(`quantity = $${paramCounter++}`);
            values.push(quantity || 0);
        }
        
        if (box_id !== undefined) {
            updateFields.push(`box_id = $${paramCounter++}`);
            values.push(box_id === '' ? null : box_id);
        }
        
        if (supplier !== undefined) {
            updateFields.push(`supplier = $${paramCounter++}`);
            values.push(supplier === '' ? null : supplier);
        }
        
        if (type !== undefined) {
            updateFields.push(`type = $${paramCounter++}`);
            values.push(type === '' ? null : type);
        }
        
        if (serial_number !== undefined) {
            updateFields.push(`serial_number = $${paramCounter++}`);
            values.push(serial_number === '' ? null : serial_number);
        }
        
        if (parent_item_id !== undefined) {
            updateFields.push(`parent_item_id = $${paramCounter++}`);
            values.push(parent_item_id === '' ? null : parent_item_id);
        }
        
        if (qr_code !== undefined) {
            updateFields.push(`qr_code = $${paramCounter++}`);
            values.push(qr_code === '' ? null : qr_code);
        }
        
        if (ean_code !== undefined) {
            updateFields.push(`ean_code = $${paramCounter++}`);
            values.push(ean_code === '' ? null : ean_code);
        }
        
        if (notes !== undefined) {
            updateFields.push(`notes = $${paramCounter++}`);
            values.push(notes === '' ? null : notes);
        }
        
        if (additional_data !== undefined) {
            updateFields.push(`additional_data = $${paramCounter++}`);
            values.push(additional_data ? JSON.stringify(additional_data) : '{}');
        }
        
        // Add last_transaction info
        updateFields.push(`last_transaction_at = $${paramCounter++}`);
        values.push(new Date());
        
        updateFields.push(`last_transaction_type = $${paramCounter++}`);
        values.push('UPDATE');
        
        // If there are no fields to update, return the existing item
        if (updateFields.length === 0) {
            await client.query('ROLLBACK');
            return res.json(oldItem);
        }
        
        // Add the item ID as the last parameter
        values.push(itemId);
        
        const updateQuery = `
            UPDATE items 
            SET ${updateFields.join(', ')} 
            WHERE id = $${paramCounter} 
            RETURNING *
        `;
        
        console.log('Update query:', updateQuery);
        console.log('Update values:', values);
        
        // Execute the update query
        const result = await client.query(updateQuery, values);
        
        console.log('Update result:', result.rows[0]);
        
        // Record transaction if box has changed
        if (oldBoxId !== box_id && box_id !== undefined) {
            // If old box exists, record removal transaction
            if (oldBoxId) {
                await client.query(
                    'INSERT INTO transactions (box_id, item_id, user_id, transaction_type, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
                    [oldBoxId, itemId, req.user?.id || null, 'REMOVE_ITEM', `Item '${name || oldItem.name}' removed from box`, req.user?.username || 'system']
                );
            }
            
            // If new box exists, record addition transaction
            if (box_id) {
                await client.query(
                    'INSERT INTO transactions (box_id, item_id, user_id, transaction_type, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
                    [box_id, itemId, req.user?.id || null, 'ADD_ITEM', `Item '${name || oldItem.name}' added to box`, req.user?.username || 'system']
                );
            }
        }
        
        await client.query('COMMIT');
        
        // Refresh the materialized view to ensure changes are visible immediately
        await refreshMaterializedView(client);
        
        // Get the updated item data
        let updatedItem;
        try {
            // Try to use the materialized view
            const fullItemResult = await client.query(`
                SELECT * FROM items_complete_view WHERE id = $1
            `, [itemId]);
            
            if (fullItemResult.rows.length > 0) {
                updatedItem = fullItemResult.rows[0];
                console.log('Final response item from view:', updatedItem);
            }
        } catch (viewError) {
            console.error('Error using materialized view, falling back to direct query:', viewError.message);
            
            // Fallback to direct query
            const fullItemResult = await client.query(`
                SELECT i.*,
                       b.box_number,
                       b.description as box_description,
                       l.name as location_name,
                       s.name as shelf_name,
                       p.name as parent_name
                FROM items i
                LEFT JOIN boxes b ON i.box_id = b.id
                LEFT JOIN locations l ON b.location_id = l.id
                LEFT JOIN shelves s ON b.shelf_id = s.id
                LEFT JOIN items p ON i.parent_item_id = p.id
                WHERE i.id = $1
            `, [itemId]);
            
            updatedItem = fullItemResult.rows[0];
            console.log('Final response item from direct query:', updatedItem);
        }
        
        // Notify all connected clients about the updated item
        if (global.wsServer) {
            global.wsServer.notifyItemChange('update', updatedItem);
        }
        
        res.json(updatedItem);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating item:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ error: 'Failed to update item' });
    } finally {
        client.release();
    }
};

/**
 * Delete an item (soft delete)
 */
const deleteItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        // Check if item exists
        const checkResult = await client.query(
            'SELECT * FROM items WHERE id = $1',
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const originalItem = checkResult.rows[0];
        
        // Perform soft delete by setting deleted_at timestamp
        const result = await client.query(
            'UPDATE items SET deleted_at = NOW() WHERE id = $1 RETURNING *',
            [id]
        );
        
        await client.query('COMMIT');
        
        // Refresh the materialized view to ensure changes are visible immediately
        await refreshMaterializedView(client);
        
        // Notify all connected clients about the deleted item
        if (global.wsServer) {
            global.wsServer.notifyItemChange('delete', result.rows[0]);
        }
        
        res.json({ message: 'Item deleted successfully', item: result.rows[0] });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: 'Failed to delete item' });
    } finally {
        client.release();
    }
};

/**
 * Bulk delete items (soft delete)
 */
const bulkDeleteItems = async (req, res) => {
    const client = await pool.connect();
    try {
        const { item_ids } = req.body;
        
        if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
            return res.status(400).json({ error: 'Item IDs must be provided as an array' });
        }
        
        await client.query('BEGIN');
        
        // Perform soft delete by setting deleted_at timestamp
        const result = await client.query(
            'UPDATE items SET deleted_at = NOW() WHERE id = ANY($1::int[]) RETURNING *',
            [item_ids]
        );
        
        console.log(`Soft deleted ${result.rowCount} items`);
        
        // Commit transaction
        await client.query('COMMIT');
        
        // Refresh the materialized view to ensure changes are visible immediately
        await refreshMaterializedView(client);
        
        // Notify all connected clients about the deleted items
        if (global.wsServer) {
            global.wsServer.notifyItemChange('bulkDelete', result.rows);
        }
        
        res.json({ 
            message: `${result.rowCount} items deleted successfully`, 
            items: result.rows 
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error bulk deleting items:', err);
        res.status(500).json({ error: 'Failed to delete items' });
    } finally {
        client.release();
    }
};

/**
 * Permanently delete an item (for admin use only)
 */
const permanentlyDeleteItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        // Check if item exists
        const checkResult = await client.query(
            'SELECT * FROM items WHERE id = $1',
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        // Delete item properties first (foreign key constraint)
        await client.query(
            'DELETE FROM item_properties WHERE item_id = $1',
            [id]
        );
        
        // Then delete the item
        const result = await client.query(
            'DELETE FROM items WHERE id = $1',
            [id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ message: 'Item permanently deleted' });
    } catch (err) {
        console.error('Error permanently deleting item:', err);
        res.status(500).json({ error: 'Failed to permanently delete item' });
    } finally {
        client.release();
    }
};

/**
 * Bulk permanently delete items (for admin use only)
 */
const bulkPermanentlyDeleteItems = async (req, res) => {
    const client = await pool.connect();
    try {
        const { item_ids } = req.body;
        
        if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
            return res.status(400).json({ error: 'Item IDs must be provided as an array' });
        }
        
        await client.query('BEGIN');
        
        // Log the items being deleted
        console.log(`Permanently deleting ${item_ids.length} items:`, item_ids);
        
        // Delete item properties first (foreign key constraint)
        const propertiesResult = await client.query(
            'DELETE FROM item_properties WHERE item_id = ANY($1::int[]) RETURNING item_id',
            [item_ids]
        );
        
        console.log(`Deleted ${propertiesResult.rowCount} item properties`);
        
        // Then delete the items
        const result = await client.query(
            'DELETE FROM items WHERE id = ANY($1::int[]) RETURNING id',
            [item_ids]
        );
        
        console.log(`Permanently deleted ${result.rowCount} items`);
        
        await client.query('COMMIT');
        
        res.json({ 
            message: `${result.rowCount} items permanently deleted`, 
            deleted_ids: result.rows.map(row => row.id)
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error bulk permanently deleting items:', err);
        res.status(500).json({ error: 'Failed to permanently delete items' });
    } finally {
        client.release();
    }
};

/**
 * Restore a soft-deleted item
 */
const restoreItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        await client.query('BEGIN');
        
        // Check if item exists and is deleted
        const checkResult = await client.query(
            'SELECT * FROM items WHERE id = $1 AND deleted_at IS NOT NULL',
            [id]
        );
        
        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Deleted item not found' });
        }
        
        // Restore the item by clearing the deleted_at timestamp
        const result = await client.query(
            'UPDATE items SET deleted_at = NULL WHERE id = $1 RETURNING *',
            [id]
        );
        
        // Commit the transaction
        await client.query('COMMIT');
        
        // Refresh the materialized view to ensure changes are visible immediately
        await refreshMaterializedView(client);
        
        // Notify all connected clients about the restored item
        if (global.wsServer) {
            global.wsServer.notifyItemChange('restore', result.rows[0]);
        }
        
        res.json({ 
            message: 'Item restored successfully', 
            item: result.rows[0] 
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error restoring item:', err);
        res.status(500).json({ error: 'Failed to restore item' });
    } finally {
        client.release();
    }
};

/**
 * Get deleted items
 */
const getDeletedItems = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT i.*, ip.type, ip.ean_code, ip.serial_number FROM items i ' +
            'LEFT JOIN item_properties ip ON i.id = ip.item_id ' +
            'WHERE i.deleted_at IS NOT NULL ' +
            'ORDER BY i.deleted_at DESC'
        );
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching deleted items:', err);
        res.status(500).json({ error: 'Failed to fetch deleted items' });
    } finally {
        client.release();
    }
};

// Item transfer functionality
const transferItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const itemId = req.params.id;
        const { source_box_id, destination_box_id, notes } = req.body;
        
        await client.query('BEGIN');
        
        // Get current item data
        const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [itemId]);
        if (itemResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const item = itemResult.rows[0];
        
        // Check if destination box exists
        if (destination_box_id) {
            const boxResult = await client.query('SELECT * FROM boxes WHERE id = $1', [destination_box_id]);
            if (boxResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Destination box not found' });
            }
        }
        
        // Update item's box_id
        await client.query(
            'UPDATE items SET box_id = $1 WHERE id = $2',
            [destination_box_id, itemId]
        );
        
        // Record transaction for source box if it exists
        if (source_box_id) {
            await client.query(
                'INSERT INTO transactions (box_id, item_id, user_id, transaction_type, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    source_box_id,
                    itemId,
                    req.user.id,
                    'TRANSFER_OUT',
                    notes || `Item '${item.name}' transferred out`,
                    req.user.username
                ]
            );
        }
        
        // Record transaction for destination box
        await client.query(
            'INSERT INTO transactions (box_id, item_id, user_id, transaction_type, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
            [
                destination_box_id,
                itemId,
                req.user.id,
                'TRANSFER_IN',
                notes || `Item '${item.name}' transferred in`,
                req.user.username
            ]
        );
        
        await client.query('COMMIT');
        
        res.json({
            message: 'Item transferred successfully',
            item_id: itemId,
            source_box_id: source_box_id,
            destination_box_id: destination_box_id
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error transferring item:', err);
        res.status(500).json({ error: 'Failed to transfer item' });
    } finally {
        client.release();
    }
};

// Get item transaction history
const getItemTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await pool.connect();
        
        const result = await client.query(`
            SELECT 
                it.*,
                u.username as user_name,
                b1.box_number as box_number,
                b2.box_number as previous_box_number,
                b3.box_number as new_box_number,
                c.name as customer_name
            FROM 
                item_transactions it
            LEFT JOIN 
                users u ON it.user_id = u.id
            LEFT JOIN 
                boxes b1 ON it.box_id = b1.id
            LEFT JOIN 
                boxes b2 ON it.previous_box_id = b2.id
            LEFT JOIN 
                boxes b3 ON it.new_box_id = b3.id
            LEFT JOIN 
                customers c ON it.customer_id = c.id
            WHERE 
                it.item_id = $1
            ORDER BY 
                it.created_at DESC
        `, [id]);
        
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching item transactions:', err);
        res.status(500).json({ error: 'Failed to fetch item transactions' });
    }
};

// Get item properties
const getItemProperties = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await pool.connect();
        
        const result = await client.query(`
            SELECT * FROM item_properties WHERE item_id = $1
        `, [id]);
        
        client.release();
        
        if (result.rows.length === 0) {
            return res.json({
                item_id: parseInt(id),
                type: null,
                ean_code: null,
                serial_number: null,
                additional_data: {}
            });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching item properties:', err);
        res.status(500).json({ error: 'Failed to fetch item properties' });
    }
};

// Create or update item properties
const updateItemProperties = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { type, ean_code, serial_number, additional_data } = req.body;
        
        console.log('Updating item properties for ID:', id);
        console.log('Properties data received:', { type, ean_code, serial_number });
        
        await client.query('BEGIN');
        
        // Check if properties already exist for this item
        const checkResult = await client.query(`
            SELECT id FROM item_properties WHERE item_id = $1
        `, [id]);
        
        let result;
        if (checkResult.rows.length > 0) {
            // Update existing properties
            result = await client.query(`
                UPDATE item_properties 
                SET 
                    type = $1,
                    ean_code = $2,
                    serial_number = $3,
                    additional_data = $4,
                    updated_at = NOW()
                WHERE item_id = $5
                RETURNING *
            `, [type, ean_code, serial_number, additional_data ? JSON.stringify(additional_data) : null, id]);
        } else {
            // Insert new properties
            result = await client.query(`
                INSERT INTO item_properties (
                    item_id, 
                    type, 
                    ean_code, 
                    serial_number, 
                    additional_data
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [id, type, ean_code, serial_number, additional_data ? JSON.stringify(additional_data) : null]);
        }
        
        // Also update the main items table for commonly used properties
        await client.query(`
            UPDATE items
            SET
                type = $1,
                ean_code = $2,
                serial_number = $3
            WHERE id = $4
        `, [type, ean_code, serial_number, id]);
        
        // Log the update for debugging
        console.log('Updated item properties in both tables:', {
            id,
            type,
            ean_code,
            serial_number
        });
        
        await client.query('COMMIT');
        
        try {
            // Try to use the materialized view to get consistent data
            const updatedItemResult = await client.query(`
                SELECT * FROM items_complete_view WHERE id = $1
            `, [id]);
            
            if (updatedItemResult.rows.length > 0) {
                console.log('Updated item properties from view:', updatedItemResult.rows[0]);
                res.json(updatedItemResult.rows[0]);
                return;
            }
        } catch (viewError) {
            console.error('Error using materialized view, falling back to properties data:', viewError.message);
            // Continue to fallback if the view doesn't exist
        }
        
        // Fallback to the properties data if view doesn't exist
        console.log('Returning updated properties:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating item properties:', err);
        res.status(500).json({ error: 'Failed to update item properties' });
    } finally {
        client.release();
    }
};

module.exports = {
    getItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    permanentlyDeleteItem,
    bulkPermanentlyDeleteItems,
    restoreItem,
    getDeletedItems,
    transferItem,
    getItemTransactions,
    getItemProperties,
    updateItemProperties
}; 