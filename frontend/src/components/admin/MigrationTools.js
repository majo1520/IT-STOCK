import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Alert, ProgressBar, ListGroup, Tabs, Tab, Table, Form, Spinner } from 'react-bootstrap';
import { migrateParentChildRelationships, clearLocalStorageAfterMigration } from '../../services/migrate-parent-relationships';
import { backupDatabase, getBackupsList, downloadBackup, restoreDatabase, uploadBackup, deleteBackup } from '../../services/api';

/**
 * Component that provides tools for data migration and database management
 */
function MigrationTools() {
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearingComplete, setClearingComplete] = useState(false);
  
  // Database backup and restore states
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [progress, setProgress] = useState('');
  
  useEffect(() => {
    // Fetch list of backups when component mounts
    fetchBackups();
  }, []);
  
  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await getBackupsList();
      setBackups(response.data.backups || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching backups:', err);
      setError('Failed to fetch database backups. Please check server logs.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMigrateParentRelationships = async () => {
    if (migrating) return;
    
    setMigrating(true);
    setMigrationResult(null);
    
    try {
      const result = await migrateParentChildRelationships();
      setMigrationResult(result);
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResult({
        success: false,
        migrated: 0,
        errors: [{ error: error.message || 'Unknown error occurred' }]
      });
    } finally {
      setMigrating(false);
    }
  };
  
  const handleClearLocalStorage = () => {
    if (clearing) return;
    
    setClearing(true);
    setClearingComplete(false);
    
    try {
      clearLocalStorageAfterMigration();
      setClearingComplete(true);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    } finally {
      setClearing(false);
    }
  };
  
  const handleBackupDatabase = async () => {
    try {
      setBackupInProgress(true);
      setError(null);
      setSuccess(null);
      
      const response = await backupDatabase();
      
      setSuccess(`Database backup created successfully: ${response.data.filename} (${response.data.size})`);
      fetchBackups(); // Refresh the list of backups
    } catch (err) {
      console.error('Backup error:', err);
      setError('Failed to backup database. Please check server logs.');
    } finally {
      setBackupInProgress(false);
    }
  };
  
  const handleDownloadBackup = (filename) => {
    downloadBackup(filename);
  };
  
  const handleRestoreDatabase = async () => {
    if (!selectedBackup) {
      setError('Please select a backup file to restore');
      return;
    }
    
    if (!window.confirm(
      `WARNING: This will completely overwrite your current database!\\n\\n` +
      `All existing data will be DELETED and replaced with data from the backup: ${selectedBackup}\\n\\n` +
      `This process will:
      1. Drop all existing tables, views, functions, and data
      2. Restore the database from the backup file
      3. Restart any active connections\\n\\n` +
      `This action CANNOT be undone. Are you absolutely sure you want to continue?`
    )) {
      return;
    }
    
    try {
      setRestoreInProgress(true);
      setError(null);
      setSuccess(null);
      setProgress('Preparing to restore database...');
      
      await restoreDatabase(selectedBackup);
      
      setSuccess('Database restored successfully! You should refresh the application to see the changes.');
      setProgress('');
      
      // Suggest refreshing the page
      if (window.confirm('Database restore completed successfully. Would you like to refresh the application now?')) {
        window.location.reload();
      }
    } catch (err) {
      console.error('Restore error:', err);
      setError(`Failed to restore database: ${err.response?.data?.error || err.message}`);
      setProgress('');
    } finally {
      setRestoreInProgress(false);
    }
  };
  
  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete the backup: ${filename}?`)) {
      return;
    }
    
    try {
      await deleteBackup(filename);
      setSuccess(`Backup ${filename} deleted successfully`);
      fetchBackups(); // Refresh the list of backups
      
      if (selectedBackup === filename) {
        setSelectedBackup(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete backup. Please check server logs.');
    }
  };
  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && !file.name.endsWith('.sql')) {
      setError('Only SQL files are allowed');
      event.target.value = '';
      return;
    }
  };
  
  const handleFileUpload = async (event) => {
    event.preventDefault();
    
    const file = fileInputRef.current.files[0];
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    try {
      setUploadInProgress(true);
      setError(null);
      setSuccess(null);
      
      await uploadBackup(file);
      
      setSuccess(`Backup file ${file.name} uploaded successfully`);
      fetchBackups(); // Refresh the list of backups
      
      // Clear the file input
      fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload backup file. Please check server logs.');
    } finally {
      setUploadInProgress(false);
    }
  };
  
  return (
    <Tabs defaultActiveKey="migration" className="mb-4">
      <Tab eventKey="migration" title="Data Migration">
        <Card className="mb-4">
          <Card.Header className="bg-primary text-white">
            <i className="bi bi-tools me-2"></i>
            Migration Tools
          </Card.Header>
          <Card.Body>
            <div className="mb-4">
              <h5>Parent-Child Relationship Migration</h5>
              <p className="text-muted">
                Migrate parent-child relationships from localStorage to the PostgreSQL database.
                This ensures all hierarchical data is properly stored in the database.
              </p>
              
              {migrationResult && (
                <Alert variant={migrationResult.success ? 'success' : 'danger'} className="mb-3">
                  <Alert.Heading>
                    {migrationResult.success ? 'Migration Successful' : 'Migration Failed'}
                  </Alert.Heading>
                  <p>
                    Successfully migrated {migrationResult.migrated} item relationships to the database.
                    {migrationResult.errors.length > 0 && (
                      <span> Encountered {migrationResult.errors.length} errors.</span>
                    )}
                  </p>
                  
                  {migrationResult.errors.length > 0 && (
                    <ListGroup variant="flush" className="mt-2 mb-2">
                      {migrationResult.errors.map((error, index) => (
                        <ListGroup.Item key={index} variant="danger">
                          {error.itemId ? `Item ID ${error.itemId}: ` : ''}{error.error}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </Alert>
              )}
              
              {migrating && (
                <div className="mb-3">
                  <ProgressBar animated now={100} label="Migrating..." />
                </div>
              )}
              
              <Button 
                variant="primary" 
                onClick={handleMigrateParentRelationships}
                disabled={migrating}
              >
                {migrating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Migrating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-2"></i>
                    Migrate Parent Relationships
                  </>
                )}
              </Button>
            </div>
            
            <hr />
            
            <div>
              <h5>Clear localStorage Data</h5>
              <p className="text-muted">
                After successful migration, you can clear the item data from localStorage to ensure
                the application uses database data only.
              </p>
              
              {clearingComplete && (
                <Alert variant="success" className="mb-3">
                  Successfully cleared item data from localStorage.
                </Alert>
              )}
              
              <Button 
                variant="warning" 
                onClick={handleClearLocalStorage}
                disabled={clearing}
              >
                {clearing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Clearing...
                  </>
                ) : (
                  <>
                    <i className="bi bi-trash me-2"></i>
                    Clear localStorage Data
                  </>
                )}
              </Button>
            </div>
          </Card.Body>
        </Card>
      </Tab>
      
      <Tab eventKey="database" title="Database Backup/Restore">
        <Card className="mb-4">
          <Card.Header className="bg-primary text-white">
            <i className="bi bi-database me-2"></i>
            Database Backup and Restore
          </Card.Header>
          <Card.Body>
            {error && (
              <Alert variant="danger" onClose={() => setError(null)} dismissible>
                <Alert.Heading>Error</Alert.Heading>
                <p>{error}</p>
              </Alert>
            )}
            
            {success && (
              <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
                <Alert.Heading>Success</Alert.Heading>
                <p>{success}</p>
              </Alert>
            )}
            
            <div className="mb-4">
              <h5>Create Database Backup</h5>
              <p className="text-muted">
                Create a complete backup of your database. The backup file will be stored on the server
                and can be downloaded or used for restoration later.
              </p>
              
              <Button 
                variant="primary" 
                onClick={handleBackupDatabase}
                disabled={backupInProgress}
              >
                {backupInProgress ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-2"></i>
                    Create Database Backup
                  </>
                )}
              </Button>
            </div>
            
            <hr />
            
            <div className="mb-4">
              <h5>Upload Backup File</h5>
              <p className="text-muted">
                Upload a database backup file (.sql) to the server for later restoration.
              </p>
              
              <Form onSubmit={handleFileUpload}>
                <Form.Group controlId="backupFile" className="mb-3">
                  <Form.Control 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".sql"
                    disabled={uploadInProgress}
                  />
                  <Form.Text className="text-muted">
                    Only .sql files are allowed. Maximum size: 50MB.
                  </Form.Text>
                </Form.Group>
                
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={uploadInProgress}
                >
                  {uploadInProgress ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      Upload Backup
                    </>
                  )}
                </Button>
              </Form>
            </div>
            
            <hr />
            
            <div className="mb-4">
              <h5>Restore Database</h5>
              <p className="text-muted">
                Restore your database from a previously created backup. This will overwrite your current database.
              </p>
              
              <Form.Group controlId="backupSelect" className="mb-3">
                <Form.Label>Select Backup File</Form.Label>
                <Form.Select 
                  value={selectedBackup || ''}
                  onChange={(e) => setSelectedBackup(e.target.value)}
                  disabled={restoreInProgress}
                >
                  <option value="">-- Select a backup file --</option>
                  {backups.map((backup) => (
                    <option key={backup.filename} value={backup.filename}>
                      {backup.filename} ({backup.size}) - {new Date(backup.created).toLocaleString()}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              
              <Button 
                variant="danger" 
                onClick={handleRestoreDatabase}
                disabled={!selectedBackup || restoreInProgress}
              >
                {restoreInProgress ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Restoring...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-counterclockwise me-2"></i>
                    Restore Database
                  </>
                )}
              </Button>
            </div>
            
            <hr />
            
            <div>
              <h5>Available Backups</h5>
              
              {loading ? (
                <div className="text-center my-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : backups.length === 0 ? (
                <Alert variant="info">
                  No backup files found. Create a backup first.
                </Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.filename}>
                        <td>{backup.filename}</td>
                        <td>{backup.size}</td>
                        <td>{new Date(backup.created).toLocaleString()}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-2"
                            onClick={() => handleDownloadBackup(backup.filename)}
                          >
                            <i className="bi bi-download"></i> Download
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleDeleteBackup(backup.filename)}
                          >
                            <i className="bi bi-trash"></i> Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              
              <Button 
                variant="outline-secondary" 
                onClick={fetchBackups}
                disabled={loading}
              >
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh List
              </Button>
            </div>
            
            {restoreInProgress && (
              <div className="text-center my-3">
                <Spinner animation="border" role="status" className="me-2" />
                <span>{progress || 'Restoring database...'}</span>
              </div>
            )}
          </Card.Body>
        </Card>
      </Tab>
    </Tabs>
  );
}

export default MigrationTools; 