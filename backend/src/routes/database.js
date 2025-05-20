const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const databaseController = require('../controllers/database');
const { authorize } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store files temporarily in the system's temp directory
    cb(null, require('os').tmpdir());
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only .sql files
    if (path.extname(file.originalname) !== '.sql') {
      return cb(new Error('Only .sql files are allowed'));
    }
    cb(null, true);
  }
});

// Backup database - admin only
router.post('/backup', authenticateToken, databaseController.backupDatabase);

// Get list of backups - admin only
router.get('/backups', authenticateToken, databaseController.getBackupsList);

// Download a backup file - admin only
router.get('/backups/:filename', authenticateToken, databaseController.downloadBackup);

// Restore database from backup - admin only
router.post('/restore', authenticateToken, databaseController.restoreDatabase);

// Upload a backup file - admin only
router.post('/upload', authenticateToken, upload.single('backupFile'), databaseController.uploadBackup);

// Delete a backup file - admin only
router.delete('/backups/:filename', authenticateToken, databaseController.deleteBackup);

// Add a new route to refresh the materialized view
router.post('/refresh-view', authenticateToken, authorize(['admin']), databaseController.refreshMaterializedView);

module.exports = router; 