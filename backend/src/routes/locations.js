const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locations');
const { authenticateToken } = require('../middleware/auth');

// GET all locations
router.get('/', locationController.getAllLocations);

// GET single location
router.get('/:id', authenticateToken, locationController.getLocationById);

// CREATE new location
router.post('/', authenticateToken, locationController.createLocation);

// UPDATE location
router.put('/:id', authenticateToken, locationController.updateLocation);

// DELETE location
router.delete('/:id', authenticateToken, locationController.deleteLocation);

module.exports = router; 