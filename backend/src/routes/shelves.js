const express = require('express');
const router = express.Router();
const shelfController = require('../controllers/shelves');
const { authenticateToken } = require('../middleware/auth');

// GET all shelves
router.get('/', shelfController.getAllShelves);

// GET single shelf
router.get('/:id', authenticateToken, shelfController.getShelfById);

// CREATE new shelf
router.post('/', authenticateToken, shelfController.createShelf);

// UPDATE shelf
router.put('/:id', authenticateToken, shelfController.updateShelf);

// DELETE shelf
router.delete('/:id', authenticateToken, shelfController.deleteShelf);

module.exports = router; 