const express = require('express');
const router = express.Router();
const itemController = require('../controllers/items');
const { authenticateToken, authorize } = require('../middleware/auth');
const db = require('../db');

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

/**
 * @route PUT /api/items/:id/codes
 * @description Update EAN and QR codes for an existing item
 * @access Private
 */
router.put('/:id/codes', async (req, res) => {
  try {
    const { id } = req.params;
    const { ean_code, qr_code, reference_id } = req.body;
    
    // Validate that at least one code is provided
    if (!ean_code && !qr_code && !reference_id) {
      return res.status(400).json({ message: 'At least one code must be provided' });
    }
    
    // Build update fields object with only provided values
    const updateFields = {};
    if (ean_code) updateFields.ean_code = ean_code;
    if (qr_code) updateFields.qr_code = qr_code;
    if (reference_id) updateFields.reference_id = reference_id;
    
    // If qr_code is provided but reference_id is not, use qr_code as reference_id
    if (qr_code && !reference_id) updateFields.reference_id = qr_code;
    
    // Check if item exists
    const itemExists = await db.query(
      'SELECT id FROM items WHERE id = $1',
      [id]
    );
    
    if (itemExists.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    // Update the item's codes
    const updateQuery = `
      UPDATE items 
      SET ${Object.keys(updateFields).map((field, i) => `${field} = $${i + 1}`).join(', ')},
          updated_at = NOW()
      WHERE id = $${Object.keys(updateFields).length + 1}
      RETURNING id, name, ean_code, qr_code, reference_id
    `;
    
    const values = [...Object.values(updateFields), id];
    const result = await db.query(updateQuery, values);
    
    // Create an audit trail entry
    await db.query(
      'INSERT INTO item_history (item_id, action, data, user_id) VALUES ($1, $2, $3, $4)',
      [id, 'UPDATE_CODES', JSON.stringify(updateFields), req.user?.id || null]
    );
    
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating item codes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 