const { pool } = require('../../config/database');

// GET all customers
const getAllCustomers = async (req, res) => {
    try {
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return default if table doesn't exist
            const defaultCustomers = [
                { id: 1, name: 'Acme Inc.', email: 'contact@acme.com', phone: '123-456-7890', address: '123 Main St', notes: 'Regular client' },
                { id: 2, name: 'TechCorp', email: 'info@techcorp.com', phone: '234-567-8901', address: '456 Tech Ave', notes: 'Needs special handling' },
                { id: 3, name: 'Global Industries', email: 'sales@globalind.com', phone: '345-678-9012', address: '789 Global Blvd', notes: '' },
                { id: 4, name: 'Local Shop', email: 'support@localshop.com', phone: '456-789-0123', address: '321 Local Rd', notes: 'Small orders only' },
                { id: 5, name: 'Mega Distributors', email: 'orders@megadist.com', phone: '567-890-1234', address: '654 Distribution Way', notes: 'Large orders' },
                { id: 6, name: 'Quick Supplies', email: 'help@quicksupplies.com', phone: '678-901-2345', address: '987 Supply St', notes: 'Fast delivery needed' }
            ];
            return res.json(defaultCustomers);
        }

        const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
};

// GET single customer
const getCustomerById = async (req, res) => {
    try {
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Use defaults if table doesn't exist
            const defaultCustomers = [
                { id: 1, name: 'Acme Inc.', email: 'contact@acme.com', phone: '123-456-7890', address: '123 Main St', notes: 'Regular client' },
                { id: 2, name: 'TechCorp', email: 'info@techcorp.com', phone: '234-567-8901', address: '456 Tech Ave', notes: 'Needs special handling' },
                { id: 3, name: 'Global Industries', email: 'sales@globalind.com', phone: '345-678-9012', address: '789 Global Blvd', notes: '' },
                { id: 4, name: 'Local Shop', email: 'support@localshop.com', phone: '456-789-0123', address: '321 Local Rd', notes: 'Small orders only' },
                { id: 5, name: 'Mega Distributors', email: 'orders@megadist.com', phone: '567-890-1234', address: '654 Distribution Way', notes: 'Large orders' },
                { id: 6, name: 'Quick Supplies', email: 'help@quicksupplies.com', phone: '678-901-2345', address: '987 Supply St', notes: 'Fast delivery needed' }
            ];
            
            const customerId = parseInt(req.params.id);
            const customer = defaultCustomers.find(c => c.id === customerId);
            
            if (!customer) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            
            return res.json(customer);
        }

        const customerId = req.params.id;
        const result = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching customer:', err);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
};

// CREATE new customer
const createCustomer = async (req, res) => {
    try {
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Create the table if it doesn't exist
            await pool.query(`
                CREATE TABLE customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    contact_person VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(50),
                    address TEXT,
                    notes TEXT,
                    group_name VARCHAR(100),
                    role_id VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indices
            await pool.query('CREATE INDEX idx_customers_name ON customers(name)');
            
            console.log('Created customers table with extended fields');
        } else {
            // Check if the table has the required columns
            const columnCheckResult = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'customers' AND table_schema = 'public'
            `);
            
            const columns = columnCheckResult.rows.map(row => row.column_name);
            console.log('Available columns for create:', columns);
            
            // Add missing columns if needed
            let columnsAdded = false;
            
            if (!columns.includes('contact_person')) {
                await pool.query('ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255)');
                console.log('Added contact_person column to customers table');
                columnsAdded = true;
            }
            
            if (!columns.includes('group_name')) {
                await pool.query('ALTER TABLE customers ADD COLUMN group_name VARCHAR(100)');
                console.log('Added group_name column to customers table');
                columnsAdded = true;
            }
            
            if (!columns.includes('role_id')) {
                await pool.query('ALTER TABLE customers ADD COLUMN role_id VARCHAR(50)');
                console.log('Added role_id column to customers table');
                columnsAdded = true;
            }
            
            // If columns were added, refresh the list of columns
            if (columnsAdded) {
                const refreshColumnResult = await pool.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'customers' AND table_schema = 'public'
                `);
                const refreshedColumns = refreshColumnResult.rows.map(row => row.column_name);
                console.log('Refreshed columns for create:', refreshedColumns);
            }
        }

        const { name, contact_person, email, phone, address, notes, group_name, role_id } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Customer name is required' });
        }
        
        // Check which columns exist in the table
        const columnCheckResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customers' AND table_schema = 'public'
        `);
        
        const columns = columnCheckResult.rows.map(row => row.column_name);
        
        // Build the SQL query dynamically based on available columns
        let insertFields = ['name'];
        let placeholders = ['$1'];
        let queryParams = [name];
        let paramIndex = 2;
        
        // Add other fields only if the columns exist
        if (columns.includes('contact_person')) {
            insertFields.push('contact_person');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(contact_person || null);
        }
        
        if (columns.includes('email')) {
            insertFields.push('email');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(email || null);
        }
        
        if (columns.includes('phone')) {
            insertFields.push('phone');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(phone || null);
        }
        
        if (columns.includes('address')) {
            insertFields.push('address');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(address || null);
        }
        
        if (columns.includes('notes')) {
            insertFields.push('notes');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(notes || null);
        }
        
        if (columns.includes('group_name')) {
            insertFields.push('group_name');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(group_name || null);
        }
        
        if (columns.includes('role_id')) {
            insertFields.push('role_id');
            placeholders.push(`$${paramIndex++}`);
            queryParams.push(role_id || null);
        }
        
        // Build the final query
        const insertQuery = `
            INSERT INTO customers (${insertFields.join(', ')}) 
            VALUES (${placeholders.join(', ')}) 
            RETURNING *
        `;
        
        console.log('Insert query:', insertQuery);
        console.log('Query parameters:', queryParams);
        
        // Execute the query
        const result = await pool.query(insertQuery, queryParams);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating customer:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
};

// UPDATE customer
const updateCustomer = async (req, res) => {
    try {
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Customers table does not exist' });
        }

        const customerId = req.params.id;
        const { name, contact_person, email, phone, address, notes, group_name, role_id } = req.body;
        
        console.log('Updating customer:', customerId, 'with data:', req.body);
        
        // Check if customer exists
        const checkResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Check which columns exist in the table
        const columnCheckResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customers' AND table_schema = 'public'
        `);
        
        const columns = columnCheckResult.rows.map(row => row.column_name);
        console.log('Available columns:', columns);
        
        // Add missing columns if needed
        let columnsAdded = false;
        
        if (!columns.includes('contact_person')) {
            await pool.query('ALTER TABLE customers ADD COLUMN contact_person VARCHAR(255)');
            console.log('Added contact_person column to customers table');
            columnsAdded = true;
        }
        
        if (!columns.includes('group_name')) {
            await pool.query('ALTER TABLE customers ADD COLUMN group_name VARCHAR(100)');
            console.log('Added group_name column to customers table');
            columnsAdded = true;
        }
        
        if (!columns.includes('role_id')) {
            await pool.query('ALTER TABLE customers ADD COLUMN role_id VARCHAR(50)');
            console.log('Added role_id column to customers table');
            columnsAdded = true;
        }
        
        // If columns were added, refresh the list of columns
        if (columnsAdded) {
            const refreshColumnResult = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'customers' AND table_schema = 'public'
            `);
            const refreshedColumns = refreshColumnResult.rows.map(row => row.column_name);
            console.log('Refreshed columns:', refreshedColumns);
        }
        
        // Build the SQL query dynamically based on available columns
        let updateFields = [];
        let queryParams = [];
        let paramIndex = 1;
        
        // Always include name as it's required
        updateFields.push(`name = $${paramIndex++}`);
        queryParams.push(name || checkResult.rows[0].name);
        
        // Add other fields only if the columns exist
        if (columns.includes('contact_person')) {
            updateFields.push(`contact_person = $${paramIndex++}`);
            queryParams.push(contact_person !== undefined ? contact_person : checkResult.rows[0].contact_person);
        }
        
        if (columns.includes('email')) {
            updateFields.push(`email = $${paramIndex++}`);
            queryParams.push(email !== undefined ? email : checkResult.rows[0].email);
        }
        
        if (columns.includes('phone')) {
            updateFields.push(`phone = $${paramIndex++}`);
            queryParams.push(phone !== undefined ? phone : checkResult.rows[0].phone);
        }
        
        if (columns.includes('address')) {
            updateFields.push(`address = $${paramIndex++}`);
            queryParams.push(address !== undefined ? address : checkResult.rows[0].address);
        }
        
        if (columns.includes('notes')) {
            updateFields.push(`notes = $${paramIndex++}`);
            queryParams.push(notes !== undefined ? notes : checkResult.rows[0].notes);
        }
        
        if (columns.includes('group_name')) {
            updateFields.push(`group_name = $${paramIndex++}`);
            queryParams.push(group_name !== undefined ? group_name : checkResult.rows[0].group_name);
        }
        
        if (columns.includes('role_id')) {
            updateFields.push(`role_id = $${paramIndex++}`);
            queryParams.push(role_id !== undefined ? role_id : checkResult.rows[0].role_id);
        }
        
        updateFields.push(`updated_at = NOW()`);
        
        // Add the customer ID as the last parameter
        queryParams.push(customerId);
        
        // Build the final query
        const updateQuery = `
            UPDATE customers SET 
                ${updateFields.join(', ')} 
            WHERE id = $${paramIndex} 
            RETURNING *
        `;
        
        console.log('Update query:', updateQuery);
        console.log('Query parameters:', queryParams);
        
        // Execute the query
        const result = await pool.query(updateQuery, queryParams);
        
        console.log('Customer updated successfully:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating customer:', err);
        res.status(500).json({ error: 'Failed to update customer' });
    }
};

// DELETE customer
const deleteCustomer = async (req, res) => {
    try {
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            return res.status(404).json({ error: 'Customers table does not exist' });
        }

        const customerId = req.params.id;
        
        // Check if customer exists
        const checkResult = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Delete customer
        await pool.query('DELETE FROM customers WHERE id = $1', [customerId]);
        
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Error deleting customer:', err);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer
}; 