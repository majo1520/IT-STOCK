const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Record a new item transaction
 */
const recordTransaction = async (req, res) => {
  try {
    // Check if item_transactions table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'item_transactions'
      )
    `);
    
    if (!tableCheckResult.rows[0].exists) {
      // Create the table if it doesn't exist
      await pool.query(`
        CREATE TABLE item_transactions (
          id SERIAL PRIMARY KEY,
          item_id INTEGER,
          item_name VARCHAR(255) NOT NULL,
          transaction_type VARCHAR(50) NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          previous_quantity INTEGER,
          new_quantity INTEGER,
          details TEXT,
          box_id VARCHAR(50),
          previous_box_id VARCHAR(50),
          new_box_id VARCHAR(50),
          customer_id VARCHAR(50),
          supplier VARCHAR(255),
          related_item_id INTEGER,
          related_item_name VARCHAR(255),
          created_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_deletion BOOLEAN DEFAULT FALSE
        )
      `);
      
      // Create indices
      await pool.query('CREATE INDEX idx_item_transactions_item_id ON item_transactions(item_id)');
      await pool.query('CREATE INDEX idx_item_transactions_transaction_type ON item_transactions(transaction_type)');
      await pool.query('CREATE INDEX idx_item_transactions_created_at ON item_transactions(created_at)');
      
      logger.info('Created item_transactions table');
    } else {
      // Check if is_deletion column exists, add it if not
      const columnCheckResult = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'item_transactions'
          AND column_name = 'is_deletion'
        )
      `);
      
      if (!columnCheckResult.rows[0].exists) {
        // Add the is_deletion column
        await pool.query(`
          ALTER TABLE item_transactions 
          ADD COLUMN is_deletion BOOLEAN DEFAULT FALSE
        `);
        
        logger.info('Added is_deletion column to item_transactions table');
      }
    }
    
    const {
      item_id,
      item_name,
      type,
      quantity,
      previous_quantity,
      new_quantity,
      details,
      box_id,
      previous_box_id,
      new_box_id,
      transaction_type,
      reason,
      customer_id,
      supplier,
      related_item_id,
      related_item_name,
      created_at,
      is_deletion
    } = req.body;
    
    // Get the username from the authenticated user
    const created_by = req.user ? req.user.username : 'system';
    
    // Use transaction_type if provided, otherwise use type
    const effectiveTransactionType = transaction_type || type;
    
    if (!effectiveTransactionType) {
      logger.warn('Missing transaction type in request', { body: req.body });
      return res.status(400).json({ 
        error: 'Missing transaction type', 
        details: 'Either "type" or "transaction_type" field is required' 
      });
    }
    
    // Check if this is a deletion transaction - either from the is_deletion flag
    // or by checking the transaction type string
    const isDeletion = is_deletion || 
      (effectiveTransactionType && (
        effectiveTransactionType.toLowerCase().includes('delete') ||
        type?.toLowerCase().includes('delete')
      ));
    
    // If it's a deletion transaction, we may not be able to enforce the foreign key constraint
    // since the item might have been deleted
    let result;
    
    if (isDeletion) {
      // For deletion transactions, we'll insert directly without the foreign key constraint
      result = await pool.query(
        `INSERT INTO item_transactions (
          item_id, item_name, transaction_type, quantity, previous_quantity, new_quantity, 
          details, box_id, previous_box_id, new_box_id, 
          customer_id, supplier, related_item_id, related_item_name, created_by, created_at,
          is_deletion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
        [
          item_id, 
          item_name, 
          effectiveTransactionType, 
          quantity, 
          previous_quantity, 
          new_quantity, 
          details, 
          box_id, 
          previous_box_id, 
          new_box_id, 
          customer_id, 
          supplier, 
          related_item_id, 
          related_item_name, 
          created_by,
          created_at || new Date(),
          true // Always set is_deletion to true for these transactions
        ]
      );
    } else {
      // For non-deletion transactions, use the standard query
      result = await pool.query(
        `INSERT INTO item_transactions (
          item_id, item_name, transaction_type, quantity, previous_quantity, new_quantity, 
          details, box_id, previous_box_id, new_box_id, 
          customer_id, supplier, related_item_id, related_item_name, created_by, created_at,
          is_deletion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
        [
          item_id, 
          item_name, 
          effectiveTransactionType, 
          quantity, 
          previous_quantity, 
          new_quantity, 
          details, 
          box_id, 
          previous_box_id, 
          new_box_id, 
          customer_id, 
          supplier, 
          related_item_id, 
          related_item_name, 
          created_by,
          created_at || new Date(),
          isDeletion
        ]
      );
    }
    
    logger.info(`Transaction recorded for item ${item_id}`, { 
      transaction_id: result.rows[0].id,
      item_id,
      type: effectiveTransactionType,
      is_deletion: isDeletion
    });
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Error recording item transaction:', { 
      error: err.message, 
      stack: err.stack,
      body: req.body 
    });
    res.status(500).json({ error: 'Failed to record transaction', details: err.message });
  }
};

/**
 * Get transactions for a specific item
 */
const getItemTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item_transactions table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'item_transactions'
      )
    `);
    
    if (!tableCheckResult.rows[0].exists) {
      return res.json([]);
    }
    
    const result = await pool.query(
      'SELECT * FROM item_transactions WHERE item_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    res.json(result.rows);
  } catch (err) {
    logger.error('Error fetching item transactions:', { 
      error: err.message, 
      stack: err.stack,
      item_id: req.params.id 
    });
    res.status(500).json({ error: 'Failed to fetch item transactions', details: err.message });
  }
};

/**
 * Get all transactions with optional filters
 */
const getAllTransactions = async (req, res) => {
  try {
    // Check if item_transactions table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'item_transactions'
      )
    `);
    
    if (!tableCheckResult.rows[0].exists) {
      return res.json([]);
    }
    
    const { 
      item_id, 
      type, 
      transaction_type, 
      box_id, 
      start_date, 
      end_date, 
      customer_id,
      include_deleted = 'true', // Default to including deleted items' transactions
      limit = 100,
      offset = 0,
      is_deletion,
      direct_filter // New parameter for direct SQL filtering
    } = req.query;
    
    // Add explicit logging to help diagnose the issue
    console.log('Transaction filter request params:', { 
      item_id, 
      type, 
      transaction_type, 
      box_id, 
      is_deletion,
      direct_filter
    });
    
    let query = 'SELECT * FROM item_transactions';
    const queryParams = [];
    const conditions = [];
    
    if (item_id) {
      conditions.push(`item_id = $${queryParams.length + 1}`);
      queryParams.push(item_id);
    }
    
    // Special handling for is_deletion flag
    if (is_deletion === 'true') {
      conditions.push(`is_deletion = true`);
      console.log('Adding is_deletion = true filter condition');
    }
    
    // Handle direct_filter if provided (for complex conditions)
    if (direct_filter) {
      conditions.push(`(${direct_filter})`);
      console.log(`Adding direct filter condition: ${direct_filter}`);
    }
    
    // Handle special 'delete' filter type
    if (type === 'delete' || transaction_type === 'delete') {
      // Important: This is the primary fix - use a more comprehensive condition for deletions
      conditions.push(`(
        transaction_type ILIKE '%DELETE%' OR 
        is_deletion = true
      )`);
      
      console.log('Applied DELETE filter condition');
    } 
    // Regular transaction type filtering
    else if (type) {
      // Handle different types of "in" transactions
      if (type === 'in') {
        conditions.push(`(
          transaction_type = 'STOCK_IN' OR 
          transaction_type = 'NEW_ITEM' OR
          transaction_type ILIKE '%IN%' OR
          transaction_type ILIKE '%ADD%'
        )`);
      }
      // Handle different types of "out" transactions
      else if (type === 'out') {
        conditions.push(`(
          transaction_type = 'STOCK_OUT' OR
          transaction_type ILIKE '%OUT%' OR
          transaction_type ILIKE '%REMOVE%'
        )`);
      }
      // For other types, use substring matching
      else {
        conditions.push(`(transaction_type ILIKE '%${type}%')`);
      }
    } else if (transaction_type) {
      // Handle case when transaction_type is an array
      if (Array.isArray(transaction_type)) {
        const placeholders = transaction_type.map((_, i) => `$${queryParams.length + i + 1}`).join(', ');
        conditions.push(`transaction_type IN (${placeholders})`);
        queryParams.push(...transaction_type);
      } else {
        conditions.push(`(transaction_type = $${queryParams.length + 1} OR transaction_type ILIKE $${queryParams.length + 2})`);
        queryParams.push(transaction_type);
        queryParams.push(`%${transaction_type}%`);
      }
    }
    
    if (box_id) {
      conditions.push(`box_id = $${queryParams.length + 1}`);
      queryParams.push(box_id);
    }
    
    if (customer_id) {
      conditions.push(`customer_id = $${queryParams.length + 1}`);
      queryParams.push(customer_id);
    }
    
    if (start_date) {
      conditions.push(`created_at >= $${queryParams.length + 1}`);
      queryParams.push(start_date);
    }
    
    if (end_date) {
      conditions.push(`created_at <= $${queryParams.length + 1}`);
      queryParams.push(end_date);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    // Add limit and offset
    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit);
    queryParams.push(offset);
    
    console.log('Executing transactions query:', { query, params: queryParams });
    
    const result = await pool.query(query, queryParams);
    
    console.log(`Found ${result.rows.length} transactions`);
    
    // When returning data, clearly mark deletion transactions
    const formattedResults = result.rows.map(transaction => {
      // Improved check if this is a deletion transaction
      const isDeletion = 
        transaction.is_deletion === true || 
        (transaction.transaction_type && (
          transaction.transaction_type.toLowerCase().includes('delete')
        ));
      
      return {
        ...transaction,
        is_deletion: isDeletion,
        type: isDeletion ? 'delete' : (transaction.type || getTransactionTypeFromString(transaction.transaction_type))
      };
    });
    
    res.json(formattedResults);
  } catch (err) {
    console.error('Error fetching transactions:', { 
      error: err.message, 
      stack: err.stack,
      query: req.query
    });
    res.status(500).json({ error: 'Failed to fetch transactions', details: err.message });
  }
};

// Helper function to determine transaction type from transaction_type string
const getTransactionTypeFromString = (transactionType) => {
  if (!transactionType) return 'unknown';
  
  const type = transactionType.toLowerCase();
  
  if (type.includes('in') || type.includes('add') || type.includes('create') || type.includes('new')) {
    return 'in';
  }
  if (type.includes('out') || type.includes('remove')) {
    return 'out';
  }
  if (type.includes('transfer')) {
    return 'transfer';
  }
  if (type.includes('delete')) {
    return 'delete';
  }
  if (type.includes('update')) {
    return 'update';
  }
  
  return 'unknown';
};

/**
 * Get transactions for a specific customer
 */
const getCustomerTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item_transactions table exists
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'item_transactions'
      )
    `);
    
    if (!tableCheckResult.rows[0].exists) {
      return res.json({ transactions: [], summary: { totalItems: 0, totalQuantity: 0, uniqueItems: 0 } });
    }
    
    const result = await pool.query(
      'SELECT * FROM item_transactions WHERE customer_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    const transactions = result.rows;
    
    // Calculate summary statistics
    const uniqueItemIds = new Set(transactions.map(t => t.item_id));
    const totalQuantity = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);
    
    // Find most consumed item
    const itemCounts = {};
    transactions.forEach(record => {
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
    
    let mostConsumedItem = null;
    if (Object.keys(itemCounts).length > 0) {
      mostConsumedItem = Object.values(itemCounts)
        .sort((a, b) => b.quantity - a.quantity)[0];
    }
    
    const summary = {
      totalItems: transactions.length,
      totalQuantity,
      uniqueItems: uniqueItemIds.size,
      mostConsumedItem
    };
    
    res.json({ transactions, summary });
  } catch (err) {
    logger.error('Error fetching customer transactions:', { 
      error: err.message, 
      stack: err.stack,
      customer_id: req.params.id 
    });
    res.status(500).json({ error: 'Failed to fetch customer transactions', details: err.message });
  }
};

module.exports = {
  recordTransaction,
  getItemTransactions,
  getAllTransactions,
  getCustomerTransactions
}; 