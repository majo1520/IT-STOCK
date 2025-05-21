const { pool } = require('../../config/database');

// GET all roles
const getAllRoles = async (req, res) => {
    try {
        // Check if roles table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return default roles if table doesn't exist
            const defaultRoles = [
                { id: 1, name: 'admin', description: 'Administrator with full access' },
                { id: 2, name: 'manager', description: 'Manager with partial access' },
                { id: 3, name: 'user', description: 'Regular user with limited access' },
                { id: 4, name: 'guest', description: 'Guest user with read-only access' },
                { id: 5, name: 'warehouse', description: 'Warehouse staff with inventory access' },
                { id: 6, name: 'support', description: 'Support staff with customer service access' }
            ];
            return res.json(defaultRoles);
        }

        const result = await pool.query('SELECT * FROM roles ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching roles:', err);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};

// GET single role
const getRoleById = async (req, res) => {
    try {
        // Check if roles table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            const defaultRoles = [
                { id: 1, name: 'admin', description: 'Administrator with full access' },
                { id: 2, name: 'manager', description: 'Manager with partial access' },
                { id: 3, name: 'user', description: 'Regular user with limited access' },
                { id: 4, name: 'guest', description: 'Guest user with read-only access' },
                { id: 5, name: 'warehouse', description: 'Warehouse staff with inventory access' },
                { id: 6, name: 'support', description: 'Support staff with customer service access' }
            ];
            
            const roleId = parseInt(req.params.id);
            const role = defaultRoles.find(r => r.id === roleId);
            
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            
            return res.json(role);
        }

        const roleId = req.params.id;
        const result = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching role:', err);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
};

// CREATE new role
const createRole = async (req, res) => {
    try {
        // Check if roles table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Create the table if it doesn't exist
            await pool.query(`
                CREATE TABLE roles (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    description TEXT,
                    permissions JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_roles_name ON roles(name)');
            
            console.log('Created roles table');
            
            // Insert default roles
            await pool.query(`
                INSERT INTO roles (name, description, permissions)
                VALUES 
                ('admin', 'Administrator with full access', '{"all": true}'),
                ('manager', 'Manager with partial access', '{"boxes": true, "items": true, "users": true}'),
                ('user', 'Regular user with limited access', '{"boxes": {"read": true}, "items": {"read": true}}')
            `);
        }

        const { name, description, permissions } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Role name is required' });
        }
        
        // Check if role with the same name already exists
        const checkResult = await pool.query('SELECT * FROM roles WHERE name = $1', [name]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'A role with this name already exists' });
        }
        
        const result = await pool.query(
            'INSERT INTO roles (name, description, permissions) VALUES ($1, $2, $3) RETURNING *',
            [name, description || null, permissions ? JSON.stringify(permissions) : '{}']
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating role:', err);
        res.status(500).json({ error: 'Failed to create role' });
    }
};

// UPDATE role
const updateRole = async (req, res) => {
    try {
        // Check if roles table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Roles table does not exist' });
        }

        const roleId = req.params.id;
        const { name, description, permissions } = req.body;
        
        // Check if role exists
        const checkResult = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        
        // Check if updating to a name that already exists
        if (name && name !== checkResult.rows[0].name) {
            const nameCheckResult = await pool.query('SELECT * FROM roles WHERE name = $1 AND id != $2', [name, roleId]);
            if (nameCheckResult.rows.length > 0) {
                return res.status(400).json({ error: 'A role with this name already exists' });
            }
        }
        
        // Update role
        const result = await pool.query(
            'UPDATE roles SET name = $1, description = $2, permissions = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
            [
                name || checkResult.rows[0].name,
                description !== undefined ? description : checkResult.rows[0].description,
                permissions ? JSON.stringify(permissions) : checkResult.rows[0].permissions,
                roleId
            ]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating role:', err);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

// DELETE role
const deleteRole = async (req, res) => {
    try {
        // Check if roles table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'roles'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Roles table does not exist' });
        }

        const roleId = req.params.id;
        
        // Check if role exists
        const checkResult = await pool.query('SELECT * FROM roles WHERE id = $1', [roleId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }
        
        // Check if role is being used by any users
        const usersResult = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', [checkResult.rows[0].name]);
        if (parseInt(usersResult.rows[0].count) > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete role that is assigned to users',
                count: parseInt(usersResult.rows[0].count)
            });
        }
        
        // Delete role
        await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
        
        res.json({ message: 'Role deleted successfully' });
    } catch (err) {
        console.error('Error deleting role:', err);
        res.status(500).json({ error: 'Failed to delete role' });
    }
};

module.exports = {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole
}; 