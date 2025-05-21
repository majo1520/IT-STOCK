const { pool } = require('../../config/database');

// GET all removal reasons
const getAllRemovalReasons = async (req, res) => {
    try {
        // Check if removal_reasons table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'removal_reasons'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return default reasons if table doesn't exist
            const defaultReasons = [
                { id: 1, name: 'CONSUMED', description: 'Item was consumed or used up' },
                { id: 2, name: 'DAMAGED', description: 'Item was damaged and cannot be used' },
                { id: 3, name: 'EXPIRED', description: 'Item has expired' },
                { id: 4, name: 'SOLD', description: 'Item was sold to a customer' },
                { id: 5, name: 'RETURNED', description: 'Item was returned to supplier' },
                { id: 6, name: 'LOST', description: 'Item was lost' },
                { id: 7, name: 'OTHER', description: 'Other reason' }
            ];
            return res.json(defaultReasons);
        }

        const result = await pool.query('SELECT * FROM removal_reasons ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching removal reasons:', err);
        res.status(500).json({ error: 'Failed to fetch removal reasons' });
    }
};

// GET single removal reason
const getRemovalReasonById = async (req, res) => {
    try {
        // Check if removal_reasons table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'removal_reasons'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            const defaultReasons = [
                { id: 1, name: 'CONSUMED', description: 'Item was consumed or used up' },
                { id: 2, name: 'DAMAGED', description: 'Item was damaged and cannot be used' },
                { id: 3, name: 'EXPIRED', description: 'Item has expired' },
                { id: 4, name: 'SOLD', description: 'Item was sold to a customer' },
                { id: 5, name: 'RETURNED', description: 'Item was returned to supplier' },
                { id: 6, name: 'LOST', description: 'Item was lost' },
                { id: 7, name: 'OTHER', description: 'Other reason' }
            ];
            
            const reasonId = parseInt(req.params.id);
            const reason = defaultReasons.find(r => r.id === reasonId);
            
            if (!reason) {
                return res.status(404).json({ error: 'Removal reason not found' });
            }
            
            return res.json(reason);
        }

        const reasonId = req.params.id;
        const result = await pool.query('SELECT * FROM removal_reasons WHERE id = $1', [reasonId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Removal reason not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching removal reason:', err);
        res.status(500).json({ error: 'Failed to fetch removal reason' });
    }
};

// CREATE new removal reason
const createRemovalReason = async (req, res) => {
    try {
        // Check if removal_reasons table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'removal_reasons'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Create the table if it doesn't exist
            await pool.query(`
                CREATE TABLE removal_reasons (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_removal_reasons_name ON removal_reasons(name)');
            
            console.log('Created removal_reasons table');
        }

        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Removal reason name is required' });
        }
        
        const result = await pool.query(
            'INSERT INTO removal_reasons (name, description) VALUES ($1, $2) RETURNING *',
            [name, description || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating removal reason:', err);
        res.status(500).json({ error: 'Failed to create removal reason' });
    }
};

// UPDATE removal reason
const updateRemovalReason = async (req, res) => {
    try {
        // Check if removal_reasons table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'removal_reasons'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Handle default reasons if table doesn't exist
            const defaultReasons = [
                { id: 1, name: 'CONSUMED', description: 'Item was consumed or used up' },
                { id: 2, name: 'DAMAGED', description: 'Item was damaged and cannot be used' },
                { id: 3, name: 'EXPIRED', description: 'Item has expired' },
                { id: 4, name: 'SOLD', description: 'Item was sold to a customer' },
                { id: 5, name: 'RETURNED', description: 'Item was returned to supplier' },
                { id: 6, name: 'LOST', description: 'Item was lost' },
                { id: 7, name: 'OTHER', description: 'Other reason' }
            ];
            
            // Find the reason in the default list
            const reasonId = parseInt(req.params.id);
            const reasonIndex = defaultReasons.findIndex(r => r.id === reasonId);
            
            if (reasonIndex === -1) {
                return res.status(404).json({ error: 'Removal reason not found' });
            }
            
            // Update the reason in memory
            const { name, description } = req.body;
            defaultReasons[reasonIndex] = {
                ...defaultReasons[reasonIndex],
                name: name || defaultReasons[reasonIndex].name,
                description: description !== undefined ? description : defaultReasons[reasonIndex].description
            };
            
            // Create the table with the updated default reasons
            await pool.query(`
                CREATE TABLE removal_reasons (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_removal_reasons_name ON removal_reasons(name)');
            
            // Insert all default reasons including the updated one
            for (const reason of defaultReasons) {
                await pool.query(
                    'INSERT INTO removal_reasons (id, name, description) VALUES ($1, $2, $3)',
                    [reason.id, reason.name, reason.description]
                );
            }
            
            // Reset the sequence to avoid conflicts
            await pool.query(`SELECT setval('removal_reasons_id_seq', (SELECT MAX(id) FROM removal_reasons))`);
            
            console.log('Created removal_reasons table with default values');
            return res.json(defaultReasons[reasonIndex]);
        }

        const reasonId = req.params.id;
        const { name, description } = req.body;
        
        // Check if removal reason exists
        const checkResult = await pool.query('SELECT * FROM removal_reasons WHERE id = $1', [reasonId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Removal reason not found' });
        }
        
        // Update removal reason
        const result = await pool.query(
            'UPDATE removal_reasons SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [
                name || checkResult.rows[0].name,
                description !== undefined ? description : checkResult.rows[0].description,
                reasonId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating removal reason:', err);
        res.status(500).json({ error: 'Failed to update removal reason' });
    }
};

// DELETE removal reason
const deleteRemovalReason = async (req, res) => {
    try {
        // Check if removal_reasons table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'removal_reasons'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Handle default reasons if table doesn't exist
            const defaultReasons = [
                { id: 1, name: 'CONSUMED', description: 'Item was consumed or used up' },
                { id: 2, name: 'DAMAGED', description: 'Item was damaged and cannot be used' },
                { id: 3, name: 'EXPIRED', description: 'Item has expired' },
                { id: 4, name: 'SOLD', description: 'Item was sold to a customer' },
                { id: 5, name: 'RETURNED', description: 'Item was returned to supplier' },
                { id: 6, name: 'LOST', description: 'Item was lost' },
                { id: 7, name: 'OTHER', description: 'Other reason' }
            ];
            
            // Find the reason in the default list
            const reasonId = parseInt(req.params.id);
            const reasonIndex = defaultReasons.findIndex(r => r.id === reasonId);
            
            if (reasonIndex === -1) {
                return res.status(404).json({ error: 'Removal reason not found' });
            }
            
            // Create the table with the default reasons except the one to delete
            await pool.query(`
                CREATE TABLE removal_reasons (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_removal_reasons_name ON removal_reasons(name)');
            
            // Insert all default reasons except the one to delete
            for (const reason of defaultReasons) {
                if (reason.id !== reasonId) {
                    await pool.query(
                        'INSERT INTO removal_reasons (id, name, description) VALUES ($1, $2, $3)',
                        [reason.id, reason.name, reason.description]
                    );
                }
            }
            
            // Reset the sequence to avoid conflicts
            await pool.query(`SELECT setval('removal_reasons_id_seq', (SELECT MAX(id) FROM removal_reasons))`);
            
            console.log('Created removal_reasons table with default values (minus deleted reason)');
            return res.json({ message: 'Removal reason deleted successfully' });
        }

        const reasonId = req.params.id;
        
        // Check if removal reason exists
        const checkResult = await pool.query('SELECT * FROM removal_reasons WHERE id = $1', [reasonId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Removal reason not found' });
        }
        
        // Delete removal reason
        await pool.query('DELETE FROM removal_reasons WHERE id = $1', [reasonId]);
        
        res.json({ message: 'Removal reason deleted successfully' });
    } catch (err) {
        console.error('Error deleting removal reason:', err);
        res.status(500).json({ error: 'Failed to delete removal reason' });
    }
};

module.exports = {
    getAllRemovalReasons,
    getRemovalReasonById,
    createRemovalReason,
    updateRemovalReason,
    deleteRemovalReason
}; 