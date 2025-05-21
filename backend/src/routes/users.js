const express = require('express');
const router = express.Router();
const userController = require('../controllers/users');
const { authenticateToken, authorize } = require('../middleware/auth');

// GET all users - Admin only
router.get('/', authenticateToken, authorize(['admin']), userController.getAllUsers);

// GET user by ID - Admin only
router.get('/:id', authenticateToken, authorize(['admin']), userController.getUserById);

// CREATE user - Admin only
router.post('/', authenticateToken, authorize(['admin']), userController.createUser);

// UPDATE user - Admin only
router.put('/:id', authenticateToken, authorize(['admin']), userController.updateUser);

// DELETE user - Admin only
router.delete('/:id', authenticateToken, authorize(['admin']), userController.deleteUser);

// RESET user password - Admin only
router.post('/:id/reset-password', authenticateToken, authorize(['admin']), userController.resetPassword);

module.exports = router; 