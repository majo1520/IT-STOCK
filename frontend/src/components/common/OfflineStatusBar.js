import React, { useState, useEffect } from 'react';
import { Alert, Badge, Button } from 'react-bootstrap';
import { BsCloudCheck, BsCloudSlash, BsArrowRepeat, BsExclamationTriangle } from 'react-icons/bs';
import networkStatus from '../../services/network-status';
import syncService from '../../services/sync-service';
import offlineStore from '../../services/offline-store';

const OfflineStatusBar = () => {
  const [isOnline, setIsOnline] = useState(networkStatus.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [syncErrors, setSyncErrors] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = networkStatus.addListener((online) => {
      setIsOnline(online);
    });

    // Periodically check sync status
    const intervalId = setInterval(async () => {
      const status = syncService.getSyncStatus();
      setIsSyncing(status.isSyncing);
      setSyncErrors(status.errors);

      // Get pending operations count
      const pendingOps = await offlineStore.getPendingOperations();
      setPendingOperations(pendingOps.length);
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  // Don't show anything if online and no pending operations
  if (isOnline && pendingOperations === 0 && syncErrors.length === 0) {
    return null;
  }

  const handleSync = () => {
    syncService.forceSync();
  };

  return (
    <div className="offline-status-container" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 1050, padding: '10px', maxWidth: '400px' }}>
      {!isOnline && (
        <Alert variant="warning" className="mb-1 d-flex align-items-center">
          <BsCloudSlash className="me-2" />
          <span className="flex-grow-1">You are working offline</span>
          {pendingOperations > 0 && (
            <Badge bg="primary" className="ms-2">
              {pendingOperations} pending
            </Badge>
          )}
        </Alert>
      )}

      {isOnline && pendingOperations > 0 && (
        <Alert variant="info" className="mb-1 d-flex align-items-center">
          {isSyncing ? (
            <>
              <BsArrowRepeat className="me-2 spin" />
              <span className="flex-grow-1">Syncing {pendingOperations} operations...</span>
            </>
          ) : (
            <>
              <BsCloudCheck className="me-2" />
              <span className="flex-grow-1">Online with {pendingOperations} pending operations</span>
              <Button size="sm" variant="outline-primary" onClick={handleSync} className="ms-2">
                Sync now
              </Button>
            </>
          )}
        </Alert>
      )}

      {syncErrors.length > 0 && (
        <Alert variant="danger" className="mb-1">
          <div className="d-flex align-items-center">
            <BsExclamationTriangle className="me-2" />
            <span className="flex-grow-1">
              {syncErrors.length} error{syncErrors.length !== 1 ? 's' : ''} during sync
            </span>
            <Button 
              size="sm" 
              variant="outline-danger" 
              onClick={() => setShowDetails(!showDetails)}
              className="ms-2"
            >
              {showDetails ? 'Hide' : 'Show'} details
            </Button>
          </div>
          
          {showDetails && (
            <div className="mt-2 small" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {syncErrors.map((error, index) => (
                <div key={index} className="border-top pt-1 mt-1">
                  <div>
                    <strong>Operation:</strong> {error.operationType || 'Unknown'}
                  </div>
                  <div>{error.message}</div>
                  <div className="text-muted">
                    Retries: {error.retries || 0}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Alert>
      )}

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default OfflineStatusBar; 