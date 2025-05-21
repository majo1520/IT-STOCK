const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const itemTransactionsController = require('../controllers/item-transactions');

// Record a new transaction
router.post('/', authenticateToken, itemTransactionsController.recordTransaction);

// Get transactions for a specific item
router.get('/item/:id', authenticateToken, itemTransactionsController.getItemTransactions);

// Get all transactions with optional filters
router.get('/', authenticateToken, itemTransactionsController.getAllTransactions);

// Get transactions for a specific customer
router.get('/customer/:id', authenticateToken, itemTransactionsController.getCustomerTransactions);

module.exports = router; 