const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const { authenticateToken, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorize(['admin'])); // Only allow users with admin role

// Get system information
router.get('/system-info', adminController.getSystemInfo);

module.exports = router; 