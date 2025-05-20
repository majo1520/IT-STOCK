const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const transactions = require('../controllers/transactions');

// Get all transactions (with optional filters)
router.get('/', authenticateToken, transactions.getAllTransactions);

// Get transactions for a specific customer
router.get('/customer/:id', authenticateToken, transactions.getCustomerTransactions);

module.exports = router; 