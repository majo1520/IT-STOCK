const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const boxRoutes = require('./boxes');
const itemRoutes = require('./items');
const locationRoutes = require('./locations');
const shelfRoutes = require('./shelves');
const colorRoutes = require('./colors');
const removalReasonRoutes = require('./removal-reasons');
const customerRoutes = require('./customers');
const roleRoutes = require('./roles');
const groupRoutes = require('./groups');
const transactionRoutes = require('./transactions');
const databaseRoutes = require('./database');
const itemTransactionsRoutes = require('./item-transactions');
const adminRoutes = require('./admin');
// Import other route modules as needed

// Health check endpoint - no auth required
router.get('/health-check', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    serverTime: new Date().toLocaleTimeString()
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/boxes', boxRoutes);
router.use('/items/transactions', itemTransactionsRoutes);
router.use('/items', itemRoutes);
router.use('/locations', locationRoutes);
router.use('/shelves', shelfRoutes);
router.use('/colors', colorRoutes);
router.use('/removal-reasons', removalReasonRoutes);
router.use('/customers', customerRoutes);
router.use('/roles', roleRoutes);
router.use('/groups', groupRoutes);
router.use('/transactions', transactionRoutes);
router.use('/database', databaseRoutes);
router.use('/admin', adminRoutes);
// Add other route modules as needed

// Root route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

module.exports = router; 