const express = require('express');
const router = express.Router();
const removalReasonController = require('../controllers/removal-reasons');
const { authenticateToken } = require('../middleware/auth');

// GET all removal reasons
router.get('/', removalReasonController.getAllRemovalReasons);

// GET single removal reason
router.get('/:id', removalReasonController.getRemovalReasonById);

// CREATE new removal reason
router.post('/', removalReasonController.createRemovalReason);

// UPDATE removal reason
router.put('/:id', removalReasonController.updateRemovalReason);

// DELETE removal reason
router.delete('/:id', removalReasonController.deleteRemovalReason);

module.exports = router; 