import React, { useState } from 'react';
import { refreshItemsView, backupDatabase, getBackupsList, restoreDatabase } from '../services/api';
import codeSyncService from '../services/codeSync';

function DatabaseTools({ showToast }) {
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [showBackups, setShowBackups] = useState(false);
  
  const handleRefreshViews = async () => {
    setRefreshLoading(true);
    try {
      await refreshItemsView();
      showToast('Database views refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing views:', error);
      showToast(`Error refreshing views: ${error.message}`, 'danger');
    } finally {
      setRefreshLoading(false);
    }
  };
  
  const handleBackupDatabase = async () => {
    setBackupLoading(true);
    try {
      await backupDatabase();
      showToast('Database backup created successfully', 'success');
    } catch (error) {
      console.error('Error backing up database:', error);
      showToast(`Error backing up database: ${error.message}`, 'danger');
    } finally {
      setBackupLoading(false);
    }
  };
  
  const loadBackups = async () => {
    try {
      const response = await getBackupsList();
      setBackups(response.data || []);
      setShowBackups(true);
    } catch (error) {
      console.error('Error loading backups:', error);
      showToast(`Error loading backups: ${error.message}`, 'danger');
    }
  };
  
  const handleRestoreDatabase = async (backupFile) => {
    if (!window.confirm(`Are you sure you want to restore the database from ${backupFile}? This will overwrite current data.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await restoreDatabase(backupFile);
      showToast('Database restored successfully. Please refresh the page.', 'success');
    } catch (error) {
      console.error('Error restoring database:', error);
      showToast(`Error restoring database: ${error.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="db-tools-container">
      <h2 className="mb-4">Database Tools</h2>
      
      <div className="card mb-4">
        <div className="card-header bg-info text-white">
          <h5 className="card-title mb-0">Database Maintenance</h5>
        </div>
        <div className="card-body">
          <p className="card-text">
            Refresh materialized views to ensure reports and queries have the latest data.
          </p>
          
          <button 
            className="btn btn-info me-2"
            onClick={handleRefreshViews}
            disabled={refreshLoading}
          >
            {refreshLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Refreshing...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-clockwise me-2"></i>
                Refresh Views
              </>
            )}
          </button>
          
          <button 
            className="btn btn-warning me-2"
            onClick={handleBackupDatabase}
            disabled={backupLoading}
          >
            {backupLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Backing up...
              </>
            ) : (
              <>
                <i className="bi bi-download me-2"></i>
                Backup Database
              </>
            )}
          </button>
          
          <button 
            className="btn btn-outline-secondary"
            onClick={loadBackups}
          >
            <i className="bi bi-list me-2"></i>
            View Backups
          </button>
        </div>
      </div>
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h5 className="card-title mb-0">EAN/QR Code Management</h5>
        </div>
        <div className="card-body">
          <p className="card-text">
            Synchronize EAN and QR codes between browsers and the database. This ensures all codes 
            are properly stored in the database for long-term reliability.
          </p>

          <button 
            className="btn btn-primary"
            onClick={async () => {
              setLoading(true);
              try {
                const syncedItems = await codeSyncService.syncAllItemCodes();
                showToast(`Successfully synchronized ${syncedItems.length} items with the database`, 'success');
              } catch (error) {
                console.error('Error during synchronization:', error);
                showToast(`Error during synchronization: ${error.message}`, 'danger');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Synchronizing...
              </>
            ) : (
              <>
                <i className="bi bi-arrow-repeat me-2"></i>
                Synchronize EAN/QR Codes
              </>
            )}
          </button>
        </div>
      </div>
      
      {showBackups && (
        <div className="card mb-4">
          <div className="card-header bg-secondary text-white">
            <h5 className="card-title mb-0">
              Backups
              <button 
                className="btn btn-sm btn-outline-light float-end"
                onClick={() => setShowBackups(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </h5>
          </div>
          <div className="card-body">
            {backups.length === 0 ? (
              <p>No backups found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <tr key={backup.name}>
                        <td>{backup.name}</td>
                        <td>{Math.round(backup.size / 1024)} KB</td>
                        <td>{new Date(backup.created).toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-warning me-2"
                            onClick={() => handleRestoreDatabase(backup.name)}
                            disabled={loading}
                          >
                            <i className="bi bi-cloud-upload me-1"></i>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatabaseTools; 