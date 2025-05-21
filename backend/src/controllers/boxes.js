const { pool } = require('../../config/database');

// GET all boxes
const getAllBoxes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, 
                   l.name as location_name,
                   l.color as location_color,
                   s.name as shelf_name 
            FROM boxes b
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN shelves s ON b.shelf_id = s.id
            ORDER BY b.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching boxes:', err);
        res.status(500).json({ error: 'Failed to fetch boxes' });
    }
};

// GET single box with its transactions
const getBoxById = async (req, res) => {
    try {
        const boxId = req.params.id;
        
        // Handle the special case where boxId might be 'new'
        if (boxId === 'new') {
            return res.status(400).json({ error: 'Invalid box ID' });
        }
        
        // Get box details with location and shelf information
        const boxResult = await pool.query(`
            SELECT b.*, 
                   l.name as location_name,
                   l.color as location_color,
                   s.name as shelf_name 
            FROM boxes b
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN shelves s ON b.shelf_id = s.id
            WHERE b.id = $1
        `, [boxId]);
        
        if (boxResult.rows.length === 0) {
            return res.status(404).json({ error: 'Box not found' });
        }

        // Get box transactions with user information
        const transactionsResult = await pool.query(
            `SELECT t.*, u.username AS user_username, u.full_name AS user_full_name, i.name AS item_name
             FROM transactions t
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN items i ON t.item_id = i.id
             WHERE t.box_id = $1 
             ORDER BY t.created_at DESC`,
            [boxId]
        );

        const response = {
            ...boxResult.rows[0],
            transactions: transactionsResult.rows
        };

        res.json(response);
    } catch (err) {
        console.error('Error fetching box details:', err);
        res.status(500).json({ error: 'Failed to fetch box details' });
    }
};

// CREATE new box
const createBox = async (req, res) => {
    const client = await pool.connect();
    try {
        const { box_number, description, serial_number, shelf_id, location_id, created_by } = req.body;
        
        // Ensure shelf_id and location_id are properly handled when they're null or empty
        const sanitizedShelfId = shelf_id === '' || shelf_id === null ? null : shelf_id;
        const sanitizedLocationId = location_id === '' || location_id === null ? null : location_id;
        
        // Generate a unique reference ID for the box
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const uniqueSuffix = timestamp.substring(timestamp.length - 6);
        const reference_id = `BOX-${box_number.toString().padStart(4, '0')}-${uniqueSuffix}`;
        
        await client.query('BEGIN');

        // Insert box with reference_id
        const boxResult = await client.query(
            'INSERT INTO boxes (box_number, description, serial_number, shelf_id, location_id, created_by, reference_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [box_number, description, serial_number, sanitizedShelfId, sanitizedLocationId, created_by || req.user.username, reference_id]
        );

        // Record transaction
        await client.query(
            'INSERT INTO transactions (box_id, transaction_type, notes, created_by, user_id) VALUES ($1, $2, $3, $4, $5)',
            [boxResult.rows[0].id, 'CREATE', 'Initial box creation', req.user.username, req.user.id]
        );

        await client.query('COMMIT');
        res.status(201).json(boxResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating box:', err);
        res.status(500).json({ error: 'Failed to create box' });
    } finally {
        client.release();
    }
};

// UPDATE box
const updateBox = async (req, res) => {
    const client = await pool.connect();
    try {
        const boxId = req.params.id;
        const { box_number, description, serial_number, shelf_id, location_id } = req.body;

        // Ensure shelf_id and location_id are properly handled when they're null or empty
        const sanitizedShelfId = shelf_id === '' || shelf_id === null ? null : shelf_id;
        const sanitizedLocationId = location_id === '' || location_id === null ? null : location_id;

        await client.query('BEGIN');

        // Get current box state
        const currentBox = await client.query('SELECT * FROM boxes WHERE id = $1', [boxId]);
        if (currentBox.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Box not found' });
        }

        // Update box
        const result = await client.query(
            'UPDATE boxes SET box_number = $1, description = $2, serial_number = $3, shelf_id = $4, location_id = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
            [box_number, description, serial_number, sanitizedShelfId, sanitizedLocationId, boxId]
        );

        // Record transaction
        await client.query(
            'INSERT INTO transactions (box_id, transaction_type, notes, created_by, user_id) VALUES ($1, $2, $3, $4, $5)',
            [
                boxId,
                'UPDATE',
                'Box information updated',
                req.user.username,
                req.user.id
            ]
        );

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating box:', err);
        res.status(500).json({ error: 'Failed to update box' });
    } finally {
        client.release();
    }
};

// DELETE box
const deleteBox = async (req, res) => {
    const client = await pool.connect();
    try {
        const boxId = req.params.id;

        await client.query('BEGIN');

        // Check if box exists
        const box = await client.query('SELECT * FROM boxes WHERE id = $1', [boxId]);
        if (box.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Box not found' });
        }

        // Delete box (this will cascade delete transactions due to FK constraint)
        await client.query('DELETE FROM boxes WHERE id = $1', [boxId]);

        await client.query('COMMIT');
        res.json({ message: 'Box deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting box:', err);
        res.status(500).json({ error: 'Failed to delete box' });
    } finally {
        client.release();
    }
};

// GET box transactions
const getBoxTransactions = async (req, res) => {
    try {
        const boxId = req.params.id;
        const result = await pool.query(
            `SELECT t.*, u.username AS user_username, u.full_name AS user_full_name, i.name AS item_name
             FROM transactions t
             LEFT JOIN users u ON t.user_id = u.id
             LEFT JOIN items i ON t.item_id = i.id
             WHERE t.box_id = $1 
             ORDER BY t.created_at DESC`,
            [boxId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// GET box items - public endpoint
const getBoxItems = async (req, res) => {
    try {
        const boxId = req.params.boxId;
        
        // Validate box ID
        if (!boxId || boxId === 'null' || boxId === 'undefined' || boxId === 'new') {
            return res.status(400).json({ error: 'Invalid box ID' });
        }
        
        // Query to get items with box details
        const query = `
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
            WHERE i.box_id = $1
            ORDER BY i.name ASC
        `;
        
        const result = await pool.query(query, [boxId]);
        console.log(`Found ${result.rows.length} items for box ${boxId} (public endpoint)`);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching box items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};

// GET box details - public endpoint
const getBoxDetails = async (req, res) => {
    try {
        const boxId = req.params.id;
        
        // Get box details with location and shelf information
        const boxResult = await pool.query(`
            SELECT b.id, 
                   b.box_number,
                   b.description,
                   b.serial_number,
                   b.reference_id,
                   b.created_at,
                   l.name as location_name,
                   l.color as location_color,
                   s.name as shelf_name 
            FROM boxes b
            LEFT JOIN locations l ON b.location_id = l.id
            LEFT JOIN shelves s ON b.shelf_id = s.id
            WHERE b.id = $1
        `, [boxId]);
        
        if (boxResult.rows.length === 0) {
            return res.status(404).json({ error: 'Box not found' });
        }

        res.json(boxResult.rows[0]);
    } catch (err) {
        console.error('Error fetching box details:', err);
        res.status(500).json({ error: 'Failed to fetch box details' });
    }
};

module.exports = {
    getAllBoxes,
    getBoxById,
    createBox,
    updateBox,
    deleteBox,
    getBoxTransactions,
    getBoxItems,
    getBoxDetails
}; 