const express = require('express');
const router = express.Router();
const itemController = require('../controllers/items');
const { authenticateToken, authorize } = require('../middleware/auth');

// GET all items
router.get('/', authenticateToken, itemController.getItems);

// Get deleted items
router.get('/deleted', authenticateToken, itemController.getDeletedItems);

// GET single item
router.get('/:id', authenticateToken, itemController.getItemById);

// CREATE new item
router.post('/', authenticateToken, itemController.createItem);

// UPDATE item
router.put('/:id', authenticateToken, itemController.updateItem);

// DELETE item
router.delete('/:id', authenticateToken, itemController.deleteItem);

// Item transfer functionality
router.post('/:id/transfer', authenticateToken, itemController.transferItem);

// Get item transaction history
router.get('/:id/transactions', authenticateToken, itemController.getItemTransactions);

// Get item properties
router.get('/:id/properties', authenticateToken, itemController.getItemProperties);

// Create or update item properties
router.post('/:id/properties', authenticateToken, itemController.updateItemProperties);

// Restore a deleted item
router.post('/:id/restore', authenticateToken, itemController.restoreItem);

// Permanently delete an item (admin only)
router.delete('/:id/permanent', authenticateToken, authorize(['admin']), itemController.permanentlyDeleteItem);

// Bulk delete items
router.post('/bulk-delete', authenticateToken, itemController.bulkDeleteItems);

// Bulk permanently delete items (admin only)
router.post('/bulk-permanent-delete', authenticateToken, authorize(['admin']), itemController.bulkPermanentlyDeleteItems);

module.exports = router; 