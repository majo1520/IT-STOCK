const { pool } = require('../../config/database');

// GET all groups
const getAllGroups = async (req, res) => {
    try {
        // Check if groups table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'groups'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return default groups if table doesn't exist
            const defaultGroups = [
                { id: 1, name: 'Electronics', description: 'Electronic components and devices' },
                { id: 2, name: 'Office Supplies', description: 'Stationery and office equipment' },
                { id: 3, name: 'Hardware', description: 'Tools and construction materials' },
                { id: 4, name: 'Software', description: 'Software licenses and subscriptions' },
                { id: 5, name: 'Furniture', description: 'Office furniture and fixtures' }
            ];
            return res.json(defaultGroups);
        }

        const result = await pool.query('SELECT * FROM groups ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching groups:', err);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

// GET single group
const getGroupById = async (req, res) => {
    try {
        // Check if groups table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'groups'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            const defaultGroups = [
                { id: 1, name: 'Electronics', description: 'Electronic components and devices' },
                { id: 2, name: 'Office Supplies', description: 'Stationery and office equipment' },
                { id: 3, name: 'Hardware', description: 'Tools and construction materials' },
                { id: 4, name: 'Software', description: 'Software licenses and subscriptions' },
                { id: 5, name: 'Furniture', description: 'Office furniture and fixtures' }
            ];
            
            const groupId = parseInt(req.params.id);
            const group = defaultGroups.find(g => g.id === groupId);
            
            if (!group) {
                return res.status(404).json({ error: 'Group not found' });
            }
            
            return res.json(group);
        }

        const groupId = req.params.id;
        const result = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching group:', err);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
};

// CREATE new group
const createGroup = async (req, res) => {
    try {
        // Check if groups table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'groups'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Create the table if it doesn't exist
            await pool.query(`
                CREATE TABLE groups (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_groups_name ON groups(name)');
            
            console.log('Created groups table');
        }

        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }
        
        const result = await pool.query(
            'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating group:', err);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

// UPDATE group
const updateGroup = async (req, res) => {
    try {
        // Check if groups table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'groups'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Groups table does not exist' });
        }

        const groupId = req.params.id;
        const { name, description } = req.body;
        
        // Check if group exists
        const checkResult = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Update group
        const result = await pool.query(
            'UPDATE groups SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [
                name || checkResult.rows[0].name,
                description !== undefined ? description : checkResult.rows[0].description,
                groupId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating group:', err);
        res.status(500).json({ error: 'Failed to update group' });
    }
};

// DELETE group
const deleteGroup = async (req, res) => {
    try {
        // Check if groups table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'groups'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Groups table does not exist' });
        }

        const groupId = req.params.id;
        
        // Check if group exists
        const checkResult = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if group is used by any items
        const itemsResult = await pool.query('SELECT COUNT(*) FROM items WHERE group_id = $1', [groupId]);
        if (parseInt(itemsResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete group that is used by items',
                count: parseInt(itemsResult.rows[0].count)
            });
        }
        
        // Delete group
        await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
        
        res.json({ message: 'Group deleted successfully' });
    } catch (err) {
        console.error('Error deleting group:', err);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};

module.exports = {
    getAllGroups,
    getGroupById,
    createGroup,
    updateGroup,
    deleteGroup
}; 