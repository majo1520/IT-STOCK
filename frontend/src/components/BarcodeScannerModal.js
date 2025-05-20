import React, { useState } from 'react';
import BarcodeScanner from './BarcodeScanner';

const BarcodeScannerModal = ({ show, onClose, onScan, title = "Scan Barcode" }) => {
  const [scanComplete, setScanComplete] = useState(false);
  
  if (!show) return null;

  // Handle scan result
  const handleScan = (result, decodedResult) => {
    console.log('Scan successful:', result);
    setScanComplete(true);
    
    // Call the parent component's onScan handler
    if (onScan) {
      onScan(result, decodedResult);
    }
    
    // Close the modal after a short delay
    setTimeout(() => {
      onClose();
      // Reset scan complete state after closing
      setTimeout(() => setScanComplete(false), 100);
    }, 300);
  };
  
  // Handle close button
  const handleClose = () => {
    onClose();
    // Reset scan complete state after closing
    setTimeout(() => setScanComplete(false), 100);
  };

  return (
    <div 
      className="modal d-block" 
      tabIndex="-1" 
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 1050 // Ensure it's above other content
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-upc-scan me-2"></i>
              {title}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={handleClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body p-0">
            {scanComplete ? (
              <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Processing...</span>
                </div>
                <p className="mt-3">Processing scan result...</p>
              </div>
            ) : (
              <BarcodeScanner 
                onScan={handleScan}
                onClose={handleClose}
                scannerTitle={title}
              />
            )}
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary w-100" 
              onClick={handleClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal; 