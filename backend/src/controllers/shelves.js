const { pool } = require('../../config/database');

// GET all shelves
const getAllShelves = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shelves ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching shelves:', err);
        res.status(500).json({ error: 'Failed to fetch shelves' });
    }
};

// GET single shelf
const getShelfById = async (req, res) => {
    try {
        const shelfId = req.params.id;
        const result = await pool.query('SELECT * FROM shelves WHERE id = $1', [shelfId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shelf not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching shelf:', err);
        res.status(500).json({ error: 'Failed to fetch shelf' });
    }
};

// CREATE new shelf
const createShelf = async (req, res) => {
    try {
        const { name, description, location_id } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Shelf name is required' });
        }
        
        const result = await pool.query(
            'INSERT INTO shelves (name, description, location_id) VALUES ($1, $2, $3) RETURNING *',
            [name, description || null, location_id || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating shelf:', err);
        res.status(500).json({ error: 'Failed to create shelf' });
    }
};

// UPDATE shelf
const updateShelf = async (req, res) => {
    try {
        const shelfId = req.params.id;
        const { name, description, location_id } = req.body;
        
        // Check if shelf exists
        const checkResult = await pool.query('SELECT * FROM shelves WHERE id = $1', [shelfId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shelf not found' });
        }
        
        // Update shelf
        const result = await pool.query(
            'UPDATE shelves SET name = $1, description = $2, location_id = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [
                name || checkResult.rows[0].name,
                description !== undefined ? description : checkResult.rows[0].description,
                location_id !== undefined ? location_id : checkResult.rows[0].location_id,
                shelfId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating shelf:', err);
        res.status(500).json({ error: 'Failed to update shelf' });
    }
};

// DELETE shelf
const deleteShelf = async (req, res) => {
    try {
        const shelfId = req.params.id;
        
        // Check if shelf exists
        const checkResult = await pool.query('SELECT * FROM shelves WHERE id = $1', [shelfId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shelf not found' });
        }
        
        // Check if shelf is used by any boxes
        const boxesResult = await pool.query('SELECT COUNT(*) FROM boxes WHERE shelf_id = $1', [shelfId]);
        if (parseInt(boxesResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete shelf that is used by boxes',
                count: parseInt(boxesResult.rows[0].count)
            });
        }
        
        // Delete shelf
        await pool.query('DELETE FROM shelves WHERE id = $1', [shelfId]);
        
        res.json({ message: 'Shelf deleted successfully' });
    } catch (err) {
        console.error('Error deleting shelf:', err);
        res.status(500).json({ error: 'Failed to delete shelf' });
    }
};

module.exports = {
    getAllShelves,
    getShelfById,
    createShelf,
    updateShelf,
    deleteShelf
}; 