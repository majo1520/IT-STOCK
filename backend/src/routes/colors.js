const express = require('express');
const router = express.Router();
const colorController = require('../controllers/colors');
const { authenticateToken } = require('../middleware/auth');

// GET all colors
router.get('/', colorController.getAllColors);

// GET single color
router.get('/:id', authenticateToken, colorController.getColorById);

// CREATE new color
router.post('/', authenticateToken, colorController.createColor);

// UPDATE color
router.put('/:id', authenticateToken, colorController.updateColor);

// DELETE color
router.delete('/:id', authenticateToken, colorController.deleteColor);

module.exports = router; 