const { pool } = require('../../config/database');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '../../backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

/**
 * Backup the entire database
 */
const backupDatabase = async (req, res) => {
  try {
    // Get database connection info from environment variables or config
    const dbName = process.env.PGDATABASE;
    const dbUser = process.env.PGUSER;
    const dbHost = process.env.PGHOST;
    const dbPort = process.env.PGPORT || '5432';

    if (!dbName || !dbUser || !dbHost) {
      return res.status(500).json({ error: 'Database configuration is incomplete' });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-${timestamp}.sql`;
    const backupPath = path.join(backupsDir, backupFilename);

    // Run pg_dump command
    const command = `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -F p -b -v -f "${backupPath}" ${dbName}`;
    
    console.log('Executing backup command:', command);
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && stderr.includes('error')) {
      console.error('Backup error:', stderr);
      return res.status(500).json({ error: 'Database backup failed', details: stderr });
    }
    
    // Check if file was created
    if (!fs.existsSync(backupPath)) {
      return res.status(500).json({ error: 'Backup file was not created' });
    }
    
    // Get file size
    const stats = fs.statSync(backupPath);
    const fileSizeInBytes = stats.size;
    const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Database backup completed successfully',
      filename: backupFilename,
      path: backupPath,
      size: fileSizeInMB + ' MB',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error during database backup:', err);
    return res.status(500).json({ error: 'Database backup failed', details: err.message });
  }
};

/**
 * Get a list of available backup files
 */
const getBackupsList = async (req, res) => {
  try {
    if (!fs.existsSync(backupsDir)) {
      return res.status(200).json({ backups: [] });
    }
    
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          path: filePath,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          created: stats.birthtime || stats.mtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // Sort by date, newest first
    
    return res.status(200).json({ backups: backupFiles });
  } catch (err) {
    console.error('Error getting backups list:', err);
    return res.status(500).json({ error: 'Failed to get backups list', details: err.message });
  }
};

/**
 * Download a specific backup file
 */
const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    
    // Ensure the filename doesn't contain path traversal characters
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Get file stats to set Content-Length header
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('Error streaming backup file:', err);
      // Only send error if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming backup file' });
      } else {
        res.end();
      }
    });
    
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error downloading backup:', err);
    return res.status(500).json({ error: 'Failed to download backup', details: err.message });
  }
};

/**
 * Restore database from a backup file
 */
const restoreDatabase = async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    
    // Ensure the filename doesn't contain path traversal characters
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Get database connection info from environment variables or config
    const dbName = process.env.PGDATABASE;
    const dbUser = process.env.PGUSER;
    const dbHost = process.env.PGHOST || 'localhost';
    const dbPort = process.env.PGPORT || 5432;
    
    // First, drop all existing database objects
    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');
      
      console.log('Dropping existing database objects...');
      
      // Disable triggers to avoid constraint errors during cleanup
      await client.query('SET session_replication_role = replica;');
      
      // Drop all triggers
      const triggerResult = await client.query(`
        SELECT 
          tgname AS trigger_name,
          relname AS table_name,
          nspname AS schema_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE NOT t.tgisinternal
          AND nspname = 'public'
      `);
      
      for (const trigger of triggerResult.rows) {
        try {
          await client.query(`DROP TRIGGER IF EXISTS "${trigger.trigger_name}" ON "${trigger.schema_name}"."${trigger.table_name}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping trigger ${trigger.trigger_name}: ${err.message}`);
        }
      }
      
      // Drop all views
      const viewResult = await client.query(`
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
      `);
      
      for (const view of viewResult.rows) {
        try {
          await client.query(`DROP VIEW IF EXISTS "${view.table_name}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping view ${view.table_name}: ${err.message}`);
        }
      }
      
      // Drop all tables
      const tableResult = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `);
      
      for (const table of tableResult.rows) {
        try {
          await client.query(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping table ${table.tablename}: ${err.message}`);
        }
      }
      
      // Drop all functions
      const functionResult = await client.query(`
        SELECT ns.nspname AS schema_name, p.proname AS function_name
        FROM pg_proc p
        JOIN pg_namespace ns ON p.pronamespace = ns.oid
        WHERE ns.nspname = 'public'
      `);
      
      for (const func of functionResult.rows) {
        try {
          await client.query(`DROP FUNCTION IF EXISTS "${func.schema_name}"."${func.function_name}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping function ${func.function_name}: ${err.message}`);
        }
      }
      
      // Drop all types
      const typeResult = await client.query(`
        SELECT t.typname AS type_name
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.typtype = 'e' -- enum types
      `);
      
      for (const type of typeResult.rows) {
        try {
          await client.query(`DROP TYPE IF EXISTS "${type.type_name}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping type ${type.type_name}: ${err.message}`);
        }
      }
      
      // Reset sequences
      const sequenceResult = await client.query(`
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
      `);
      
      for (const sequence of sequenceResult.rows) {
        try {
          await client.query(`DROP SEQUENCE IF EXISTS "${sequence.sequence_name}" CASCADE`);
        } catch (err) {
          console.log(`Error dropping sequence ${sequence.sequence_name}: ${err.message}`);
        }
      }
      
      // Re-enable triggers
      await client.query('SET session_replication_role = DEFAULT;');
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Database cleaned up successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error cleaning up database:', err);
      throw err;
    } finally {
      client.release();
    }
    
    // Execute the restore command
    console.log(`Executing restore command: psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${filePath}"`);
    const { stdout, stderr } = await execPromise(`psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${filePath}"`);
    
    if (stderr && stderr.includes('ERROR')) {
      console.error('Restore error:', stderr);
      return res.status(500).json({ error: 'Failed to restore database', details: stderr });
    }
    
    console.log('Database restored successfully');
    return res.json({ message: 'Database restored successfully' });
  } catch (err) {
    console.error('Error restoring database:', err);
    return res.status(500).json({ error: 'Failed to restore database', details: err.message });
  }
};

/**
 * Upload a backup file
 */
const uploadBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { originalname, path: tempPath, size } = req.file;
    
    // Ensure it's an SQL file
    if (!originalname.endsWith('.sql')) {
      // Delete the temporary file
      fs.unlinkSync(tempPath);
      return res.status(400).json({ error: 'Only SQL files are allowed' });
    }
    
    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newFilename = `uploaded-${timestamp}-${originalname}`;
    const newPath = path.join(backupsDir, newFilename);
    
    // Move the file from temp location to backups directory
    fs.renameSync(tempPath, newPath);
    
    return res.status(200).json({
      success: true,
      message: 'Backup file uploaded successfully',
      filename: newFilename,
      size: (size / (1024 * 1024)).toFixed(2) + ' MB',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error uploading backup file:', err);
    return res.status(500).json({ error: 'Failed to upload backup file', details: err.message });
  }
};

/**
 * Delete a backup file
 */
const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Backup filename is required' });
    }
    
    // Ensure the filename doesn't contain path traversal characters
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    return res.status(200).json({
      success: true,
      message: 'Backup file deleted successfully',
      filename
    });
  } catch (err) {
    console.error('Error deleting backup file:', err);
    return res.status(500).json({ error: 'Failed to delete backup file', details: err.message });
  }
};

// Refresh materialized view
const refreshMaterializedView = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('Manually refreshing items_complete_view materialized view');
        
        // Get any force flag from the request
        const force = req.body.force === true;
        if (force) {
            console.log('Force refresh requested - will rebuild view if necessary');
        }
        
        // Start a transaction
        await client.query('BEGIN');
        
        // Don't try to lock the materialized view - it's not supported
        
        const startTime = Date.now();
        
        // Use CONCURRENTLY if possible to allow concurrent queries during refresh
        try {
            // Try with CONCURRENTLY first - faster for users but requires unique index
            await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY items_complete_view');
            console.log('Refreshed view with CONCURRENTLY option');
        } catch (concurrentError) {
            console.log('CONCURRENTLY refresh failed, falling back to standard refresh:', concurrentError.message);
            // If CONCURRENTLY fails, fall back to standard refresh
            await client.query('REFRESH MATERIALIZED VIEW items_complete_view');
        }
        
        const endTime = Date.now();
        
        console.log(`Materialized view refreshed in ${endTime - startTime}ms`);
        
        // Count items for verification
        const countResult = await client.query('SELECT COUNT(*) FROM items_complete_view');
        const itemCount = countResult.rows[0].count;
        
        // Examine item data to verify view integrity
        const sampleResult = await client.query('SELECT id, name, updated_at FROM items_complete_view LIMIT 5');
        
        await client.query('COMMIT');
        
        console.log(`Successfully refreshed materialized view - contains ${itemCount} items`);
        console.log(`Sample of refreshed data:`, sampleResult.rows);
        
        // Send WebSocket notification to clients - use multiple notification types for redundancy
        try {
            if (req.app.get('websocketServer')) {
                const wss = req.app.get('websocketServer');
                
                // Generate a timestamp for all notifications
                const timestamp = new Date().toISOString();
                
                // Array of messages to send for more robust notification
                const messages = [
                    // Type 1: Standard refresh notification
                    {
                        type: 'refresh_needed',
                        tableType: 'items',
                        timestamp: timestamp
                    },
                    // Type 2: Direct client refresh request
                    {
                        type: 'client_refresh_request',
                        tableType: 'items',
                        timestamp: timestamp
                    },
                    // Type 3: Generic item update event
                    {
                        type: 'item_update',
                        action: 'update',
                        timestamp: timestamp
                    }
                ];
                
                // Send all message types to each client
                wss.clients.forEach(client => {
                    if (client.readyState === 1) { // OPEN
                        messages.forEach(message => {
                            client.send(JSON.stringify(message));
                        });
                    }
                });
                
                console.log('Sent multiple WebSocket notifications to all clients about view refresh');
            }
        } catch (wsError) {
            console.error('Error sending WebSocket notification:', wsError);
        }
        
        res.json({ 
            success: true, 
            message: 'Materialized view refreshed successfully',
            itemCount,
            refreshTime: `${endTime - startTime}ms`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error refreshing materialized view:', err);
        
        // Attempt to rebuild the view if refresh fails OR if force=true
        try {
            const force = req.body.force === true;
            console.log(`Attempting to rebuild materialized view from scratch... (Force=${force})`);
            
            // Check if the view exists
            const viewCheck = await client.query(`
                SELECT COUNT(*) FROM pg_matviews 
                WHERE matviewname = 'items_complete_view'
            `);
            
            if (parseInt(viewCheck.rows[0].count) > 0) {
                console.log('Dropping and recreating materialized view...');
                await client.query('BEGIN');
                await client.query('DROP MATERIALIZED VIEW IF EXISTS items_complete_view');
                
                // Recreate the view with the most current definition
                await client.query(`
                    CREATE MATERIALIZED VIEW items_complete_view AS
                    SELECT 
                        i.id,
                        i.name,
                        i.description,
                        i.quantity,
                        i.box_id,
                        i.created_at,
                        i.updated_at,
                        i.supplier,
                        i.parent_item_id,
                        i.deleted_at,
                        i.qr_code,
                        i.notes,
                        i.additional_data,
                        i.last_transaction_at,
                        i.last_transaction_type,
                        COALESCE(i.type, ip.type) as type,
                        COALESCE(i.ean_code, ip.ean_code) as ean_code,
                        COALESCE(i.serial_number, ip.serial_number) as serial_number,
                        b.box_number,
                        b.description as box_description,
                        l.name as location_name,
                        l.color as location_color,
                        s.name as shelf_name,
                        p.name as parent_name
                    FROM items i
                    LEFT JOIN boxes b ON i.box_id = b.id
                    LEFT JOIN locations l ON b.location_id = l.id
                    LEFT JOIN shelves s ON b.shelf_id = s.id
                    LEFT JOIN items p ON i.parent_item_id = p.id
                    LEFT JOIN item_properties ip ON i.id = ip.item_id
                    WHERE i.deleted_at IS NULL
                `);
                
                // Create indexes for efficient querying and to support CONCURRENTLY refresh
                await client.query('CREATE UNIQUE INDEX ON items_complete_view (id)');
                await client.query('CREATE INDEX ON items_complete_view (box_id)');
                await client.query('CREATE INDEX ON items_complete_view (parent_item_id)');
                await client.query('COMMIT');
                
                const countResult = await client.query('SELECT COUNT(*) FROM items_complete_view');
                console.log(`Materialized view rebuilt successfully with ${countResult.rows[0].count} items`);
                
                // Send notifications to all clients about the rebuild
                try {
                    if (req.app.get('websocketServer')) {
                        const wss = req.app.get('websocketServer');
                        const timestamp = new Date().toISOString();
                        
                        // Use all notification types for maximum compatibility
                        const messages = [
                            { type: 'refresh_needed', tableType: 'items', timestamp },
                            { type: 'client_refresh_request', tableType: 'items', timestamp },
                            { type: 'item_update', action: 'update', timestamp }
                        ];
                        
                        wss.clients.forEach(client => {
                            if (client.readyState === 1) { // OPEN
                                messages.forEach(message => {
                                    client.send(JSON.stringify(message));
                                });
                            }
                        });
                        
                        console.log('Sent rebuild notifications to all clients');
                    }
                } catch (wsError) {
                    console.error('Error sending rebuild notifications:', wsError);
                }
                
                // Return success but note that view was rebuilt
                return res.json({ 
                    success: true, 
                    message: 'Materialized view rebuilt successfully',
                    itemCount: countResult.rows[0].count,
                    rebuilt: true
                });
            } else {
                console.log('View does not exist, cannot rebuild');
            }
        } catch (rebuildErr) {
            console.error('Error rebuilding materialized view:', rebuildErr);
            // Continue to return the original error
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to refresh materialized view',
            message: err.message
        });
    } finally {
        client.release();
    }
};

module.exports = {
  backupDatabase,
  getBackupsList,
  downloadBackup,
  restoreDatabase,
  uploadBackup,
  deleteBackup,
  refreshMaterializedView
}; 