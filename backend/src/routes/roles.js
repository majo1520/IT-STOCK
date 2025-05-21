const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roles');
const { authenticateToken, authorize } = require('../middleware/auth');

// GET all roles
router.get('/', roleController.getAllRoles);

// GET single role
router.get('/:id', authenticateToken, roleController.getRoleById);

// CREATE new role - Admin only
router.post('/', authenticateToken, authorize(['admin']), roleController.createRole);

// UPDATE role - Admin only
router.put('/:id', authenticateToken, authorize(['admin']), roleController.updateRole);

// DELETE role - Admin only
router.delete('/:id', authenticateToken, authorize(['admin']), roleController.deleteRole);

module.exports = router; 