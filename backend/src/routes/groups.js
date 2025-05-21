const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groups');
const { authenticateToken } = require('../middleware/auth');

// GET all groups
router.get('/', groupController.getAllGroups);

// GET single group
router.get('/:id', authenticateToken, groupController.getGroupById);

// CREATE new group
router.post('/', authenticateToken, groupController.createGroup);

// UPDATE group
router.put('/:id', authenticateToken, groupController.updateGroup);

// DELETE group
router.delete('/:id', authenticateToken, groupController.deleteGroup);

module.exports = router; 