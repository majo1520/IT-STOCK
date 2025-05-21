const { pool } = require('../../config/database');

// GET all locations
const getAllLocations = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching locations:', err);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
};

// GET single location
const getLocationById = async (req, res) => {
    try {
        const locationId = req.params.id;
        const result = await pool.query('SELECT * FROM locations WHERE id = $1', [locationId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching location:', err);
        res.status(500).json({ error: 'Failed to fetch location' });
    }
};

// CREATE new location
const createLocation = async (req, res) => {
    try {
        const { name, description, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Location name is required' });
        }
        
        const result = await pool.query(
            'INSERT INTO locations (name, description, color) VALUES ($1, $2, $3) RETURNING *',
            [name, description || null, color || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating location:', err);
        res.status(500).json({ error: 'Failed to create location' });
    }
};

// UPDATE location
const updateLocation = async (req, res) => {
    try {
        const locationId = req.params.id;
        const { name, description, color } = req.body;
        
        // Check if location exists
        const checkResult = await pool.query('SELECT * FROM locations WHERE id = $1', [locationId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        // Update location
        const result = await pool.query(
            'UPDATE locations SET name = $1, description = $2, color = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [
                name || checkResult.rows[0].name,
                description !== undefined ? description : checkResult.rows[0].description,
                color || checkResult.rows[0].color,
                locationId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating location:', err);
        res.status(500).json({ error: 'Failed to update location' });
    }
};

// DELETE location
const deleteLocation = async (req, res) => {
    try {
        const locationId = req.params.id;
        
        // Check if location exists
        const checkResult = await pool.query('SELECT * FROM locations WHERE id = $1', [locationId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }
        
        // Check if location is used by any boxes
        const boxesResult = await pool.query('SELECT COUNT(*) FROM boxes WHERE location_id = $1', [locationId]);
        if (parseInt(boxesResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete location that is used by boxes',
                count: parseInt(boxesResult.rows[0].count)
            });
        }
        
        // Delete location
        await pool.query('DELETE FROM locations WHERE id = $1', [locationId]);
        
        res.json({ message: 'Location deleted successfully' });
    } catch (err) {
        console.error('Error deleting location:', err);
        res.status(500).json({ error: 'Failed to delete location' });
    }
};

module.exports = {
    getAllLocations,
    getLocationById,
    createLocation,
    updateLocation,
    deleteLocation
}; 