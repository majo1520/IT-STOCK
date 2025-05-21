const { pool } = require('../../config/database');

// GET all colors
const getAllColors = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM colors ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching colors:', err);
        res.status(500).json({ error: 'Failed to fetch colors' });
    }
};

// GET single color
const getColorById = async (req, res) => {
    try {
        const colorId = req.params.id;
        const result = await pool.query('SELECT * FROM colors WHERE id = $1', [colorId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Color not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching color:', err);
        res.status(500).json({ error: 'Failed to fetch color' });
    }
};

// CREATE new color
const createColor = async (req, res) => {
    try {
        const { name, value, description } = req.body;
        
        if (!name || !value) {
            return res.status(400).json({ error: 'Color name and value are required' });
        }
        
        const result = await pool.query(
            'INSERT INTO colors (name, value, description) VALUES ($1, $2, $3) RETURNING *',
            [name, value, description || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating color:', err);
        res.status(500).json({ error: 'Failed to create color' });
    }
};

// UPDATE color
const updateColor = async (req, res) => {
    try {
        const colorId = req.params.id;
        const { name, value, description } = req.body;
        
        // Check if color exists
        const checkResult = await pool.query('SELECT * FROM colors WHERE id = $1', [colorId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Color not found' });
        }
        
        // Update color
        const result = await pool.query(
            'UPDATE colors SET name = $1, value = $2, description = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [
                name || checkResult.rows[0].name,
                value || checkResult.rows[0].value,
                description !== undefined ? description : checkResult.rows[0].description,
                colorId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating color:', err);
        res.status(500).json({ error: 'Failed to update color' });
    }
};

// DELETE color
const deleteColor = async (req, res) => {
    try {
        const colorId = req.params.id;
        
        // Check if color exists
        const checkResult = await pool.query('SELECT * FROM colors WHERE id = $1', [colorId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Color not found' });
        }
        
        // Check if color is used by locations
        const locationsResult = await pool.query('SELECT COUNT(*) FROM locations WHERE color = $1', [colorId]);
        if (parseInt(locationsResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete color that is used by locations',
                count: parseInt(locationsResult.rows[0].count)
            });
        }
        
        // Delete color
        await pool.query('DELETE FROM colors WHERE id = $1', [colorId]);
        
        res.json({ message: 'Color deleted successfully' });
    } catch (err) {
        console.error('Error deleting color:', err);
        res.status(500).json({ error: 'Failed to delete color' });
    }
};

module.exports = {
    getAllColors,
    getColorById,
    createColor,
    updateColor,
    deleteColor
}; 