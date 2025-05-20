const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customers');
const itemTransactionsController = require('../controllers/item-transactions');
const { authenticateToken } = require('../middleware/auth');

// GET all customers
router.get('/', customerController.getAllCustomers);

// GET single customer
router.get('/:id', authenticateToken, customerController.getCustomerById);

// CREATE new customer
router.post('/', authenticateToken, customerController.createCustomer);

// UPDATE customer
router.put('/:id', authenticateToken, customerController.updateCustomer);

// DELETE customer
router.delete('/:id', authenticateToken, customerController.deleteCustomer);

// GET customer transactions history
router.get('/:id/transactions', authenticateToken, itemTransactionsController.getCustomerTransactions);

module.exports = router; 