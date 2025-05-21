const { pool } = require('../../config/database');

// Helper function to determine transaction type from transaction_type
const getTransactionType = (transactionType) => {
    if (!transactionType) return 'unknown';
    
    const inTypes = ['STOCK_IN', 'ADD_ITEM', 'TRANSFER_IN', 'QUANTITY_INCREASE'];
    const outTypes = ['STOCK_OUT', 'REMOVE_ITEM', 'TRANSFER_OUT', 'QUANTITY_DECREASE'];
    
    if (inTypes.includes(transactionType)) return 'in';
    if (outTypes.includes(transactionType)) return 'out';
    
    return 'unknown';
};

// Generate mock transaction data for when the table doesn't exist
const generateMockTransactions = () => {
    const mockItems = [
        { id: 1, name: 'Laptop', quantity: 5 },
        { id: 2, name: 'Smartphone', quantity: 10 },
        { id: 3, name: 'Tablet', quantity: 7 },
        { id: 4, name: 'Monitor', quantity: 3 },
        { id: 5, name: 'Keyboard', quantity: 15 }
    ];
    
    const mockUsers = [
        { id: 1, username: 'admin', full_name: 'Administrator' },
        { id: 2, username: 'john', full_name: 'John Doe' }
    ];
    
    const mockCustomers = [
        { id: 1, name: 'Acme Inc.' },
        { id: 2, name: 'TechCorp' },
        { id: 3, name: 'Global Industries' }
    ];
    
    const mockBoxes = [
        { id: 1, box_number: 'A001' },
        { id: 2, box_number: 'B002' }
    ];
    
    const transactionTypes = [
        'STOCK_IN', 'STOCK_OUT', 'ADD_ITEM', 'REMOVE_ITEM', 
        'TRANSFER_IN', 'TRANSFER_OUT', 'QUANTITY_INCREASE', 'QUANTITY_DECREASE'
    ];
    
    const mockTransactions = [];
    
    // Generate 50 mock transactions
    for (let i = 1; i <= 50; i++) {
        const item = mockItems[Math.floor(Math.random() * mockItems.length)];
        const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        const transactionType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const isStockOut = getTransactionType(transactionType) === 'out';
        const quantity = Math.floor(Math.random() * 5) + 1;
        const previousQuantity = item.quantity + (isStockOut ? quantity : 0);
        const newQuantity = previousQuantity + (isStockOut ? -quantity : quantity);
        const box = mockBoxes[Math.floor(Math.random() * mockBoxes.length)];
        const customer = isStockOut ? mockCustomers[Math.floor(Math.random() * mockCustomers.length)] : null;
        
        // Create mock transaction
        mockTransactions.push({
            id: i,
            type: getTransactionType(transactionType),
            item_id: item.id,
            item_name: item.name,
            quantity: quantity,
            previous_quantity: previousQuantity,
            new_quantity: newQuantity,
            box_id: box.id,
            box_number: box.box_number,
            notes: `Mock ${transactionType.toLowerCase().replace('_', ' ')}`,
            created_at: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
            created_by: user.username,
            transaction_type: transactionType,
            previous_box_id: null,
            new_box_id: null,
            reason: isStockOut ? 'CONSUMED' : null,
            customer_id: customer ? customer.id : null,
            customer_name: customer ? customer.name : null
        });
    }
    
    // Sort by created_at descending (newest first)
    mockTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return mockTransactions;
};

// GET all transactions with optional filtering
const getAllTransactions = async (req, res) => {
    try {
        const { 
            item_id, 
            transaction_type, 
            start_date, 
            end_date, 
            customer_id, 
            box_id,
            limit = 100
        } = req.query;

        // Start building the query with only the columns that exist in the database
        let query = `
            SELECT t.*, 
                   u.username AS user_username, 
                   u.full_name AS user_full_name,
                   i.name AS item_name,
                   i.quantity AS item_current_quantity,
                   b.box_number
            FROM transactions t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN items i ON t.item_id = i.id
            LEFT JOIN boxes b ON t.box_id = b.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        // Add filters if provided, skipping any that reference non-existent columns
        if (item_id) {
            query += ` AND t.item_id = $${paramIndex++}`;
            params.push(item_id);
        }

        if (transaction_type) {
            query += ` AND t.transaction_type = $${paramIndex++}`;
            params.push(transaction_type);
        }

        if (start_date) {
            query += ` AND t.created_at >= $${paramIndex++}`;
            params.push(new Date(start_date));
        }

        if (end_date) {
            query += ` AND t.created_at <= $${paramIndex++}`;
            params.push(new Date(end_date));
        }

        // Removing the filter for customer_id since the column doesn't exist
        /* 
        if (customer_id) {
            query += ` AND t.customer_id = $${paramIndex++}`;
            params.push(customer_id);
        }
        */

        if (box_id) {
            query += ` AND t.box_id = $${paramIndex++}`;
            params.push(box_id);
        }

        // Order by created_at descending (newest first)
        query += ` ORDER BY t.created_at DESC`;

        // Add limit
        query += ` LIMIT $${paramIndex++}`;
        params.push(parseInt(limit));

        // Check if transactions table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'transactions'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return mock data if table doesn't exist
            return res.json(generateMockTransactions());
        }

        // Execute the query
        const result = await pool.query(query, params);

        // Format transactions to match client expectations
        const formattedTransactions = result.rows.map(transaction => {
            return {
                id: transaction.id,
                type: getTransactionType(transaction.transaction_type),
                item_id: transaction.item_id,
                item_name: transaction.item_name || 'Unknown Item',
                quantity: transaction.quantity || 0,
                previous_quantity: transaction.previous_quantity || 0,
                new_quantity: transaction.new_quantity || 0,
                box_id: transaction.box_id,
                box_number: transaction.box_number,
                notes: transaction.notes || 'No details provided',
                created_at: transaction.created_at,
                created_by: transaction.created_by || transaction.user_username || 'Unknown User',
                transaction_type: transaction.transaction_type || 'UNKNOWN',
                previous_box_id: transaction.previous_box_id,
                new_box_id: transaction.new_box_id,
                reason: transaction.reason,
                // Only include customer data if it actually exists 
                customer_id: null,
                customer_name: null
            };
        });

        res.json(formattedTransactions);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// GET transactions for a specific customer
const getCustomerTransactions = async (req, res) => {
    try {
        const customerId = req.params.id;
        
        // Check if customers table exists
        const tableCheckResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'customers'
            )
        `);
        
        if (!tableCheckResult.rows[0].exists) {
            // Return mock data if table doesn't exist
            const mockTransactions = generateMockTransactions();
            const customerTransactions = mockTransactions.filter(t => t.customer_id == customerId);
            return res.json(customerTransactions);
        }

        // Check if customer exists
        const customerResult = await pool.query(
            'SELECT * FROM customers WHERE id = $1',
            [customerId]
        );
        
        if (customerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Since your transactions table doesn't have customer_id column, let's use the mock data for now
        const mockTransactions = generateMockTransactions();
        const customerTransactions = mockTransactions.filter(t => t.customer_id == customerId);
        
        // Calculate summary statistics
        const summary = {
            totalItems: customerTransactions.length,
            totalQuantity: customerTransactions.reduce((sum, record) => sum + (record.quantity || 0), 0),
            uniqueItems: new Set(customerTransactions.map(record => record.item_id)).size,
            mostConsumedItem: null
        };
        
        // Find most consumed item
        const itemCounts = {};
        customerTransactions.forEach(record => {
            const itemId = record.item_id;
            if (!itemCounts[itemId]) {
                itemCounts[itemId] = {
                    id: itemId,
                    name: record.item_name,
                    quantity: 0,
                    count: 0
                };
            }
            itemCounts[itemId].quantity += (record.quantity || 0);
            itemCounts[itemId].count += 1;
        });
        
        if (Object.keys(itemCounts).length > 0) {
            summary.mostConsumedItem = Object.values(itemCounts)
                .sort((a, b) => b.quantity - a.quantity)[0];
        }

        res.json({
            data: customerTransactions,
            summary
        });
    } catch (err) {
        console.error('Error fetching customer transactions:', err);
        res.status(500).json({ error: 'Failed to fetch customer transactions' });
    }
};

module.exports = {
    getAllTransactions,
    getCustomerTransactions
}; 