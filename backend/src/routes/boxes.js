const express = require('express');
const router = express.Router();
const boxController = require('../controllers/boxes');
const { authenticateToken } = require('../middleware/auth');

// GET all boxes
router.get('/', authenticateToken, boxController.getAllBoxes);

// GET single box with its transactions
router.get('/:id', authenticateToken, boxController.getBoxById);

// CREATE new box
router.post('/', authenticateToken, boxController.createBox);

// UPDATE box
router.put('/:id', authenticateToken, boxController.updateBox);

// DELETE box
router.delete('/:id', authenticateToken, boxController.deleteBox);

// GET box transactions
router.get('/:id/transactions', authenticateToken, boxController.getBoxTransactions);

// GET box items (public endpoint for use with QR code or reference ID)
router.get('/public/:boxId', boxController.getBoxItems);

// GET box details (public endpoint for use with QR code or reference ID)
router.get('/public/:id/details', boxController.getBoxDetails);

module.exports = router; 