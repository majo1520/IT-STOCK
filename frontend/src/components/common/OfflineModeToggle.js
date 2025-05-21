import React from 'react';
import { Form } from 'react-bootstrap';
import { useApi } from '../../contexts/ApiServiceContext';
import { BsCloudCheck, BsCloudSlash } from 'react-icons/bs';

const OfflineModeToggle = () => {
  const { isOfflineEnabled, toggleOfflineMode } = useApi();

  return (
    <div className="d-flex align-items-center">
      <Form.Check
        type="switch"
        id="offline-mode-switch"
        checked={isOfflineEnabled}
        onChange={toggleOfflineMode}
        label=""
        className="me-1"
      />
      <span 
        className="small d-flex align-items-center" 
        style={{ cursor: 'pointer' }}
        onClick={toggleOfflineMode}
      >
        {isOfflineEnabled ? (
          <>
            <BsCloudCheck className="me-1 text-success" />
            <span className="text-success">Offline Ready</span>
          </>
        ) : (
          <>
            <BsCloudSlash className="me-1 text-warning" />
            <span className="text-warning">Online Only</span>
          </>
        )}
      </span>
    </div>
  );
};

export default OfflineModeToggle; 