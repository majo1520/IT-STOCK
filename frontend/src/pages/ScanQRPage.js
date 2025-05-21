import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getItems, getItemById, updateItem } from '../services/api';
import { extractItemIdFromQR, isValidQRFormat } from '../utils/qrCodeGenerator';

function ScanQRPage() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [itemData, setItemData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  
  // Initialize QR scanner
  useEffect(() => {
    let scanner;
    
    const initializeScanner = () => {
      if (scannerInitialized) return;
      
      // Create scanner config
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      };
      
      // Create scanner instance
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        config,
        false // verbose mode
      );
      
      // Define success and error callbacks
      const onScanSuccess = (decodedText, decodedResult) => {
        console.log(`QR Code detected: ${decodedText}`, decodedResult);
        
        // Stop scanner after successful scan
        scanner.clear();
        
        // Set scan result
        setScanResult(decodedText);
        setScanning(false);
        
        // Process the scanned QR code
        processQRCode(decodedText);
      };
      
      const onScanError = (error) => {
        // Errors are handled automatically by the scanner UI
        console.warn(`QR scan error: ${error}`);
      };
      
      // Start scanner
      scanner.render(onScanSuccess, onScanError);
      setScannerInitialized(true);
    };
    
    if (scanning && !scannerInitialized) {
      initializeScanner();
    }
    
    // Cleanup scanner on component unmount
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanning, scannerInitialized]);
  
  // Process scanned QR code
  const processQRCode = async (qrValue) => {
    // Reset states
    setError(null);
    setItemData(null);
    setLoading(true);
    
    // Validate QR code format
    if (!isValidQRFormat(qrValue)) {
      setError("Invalid QR code format. Expected format: EPL-IT-STOCK-{itemId}-{random}");
      setLoading(false);
      return;
    }
    
    // Extract item ID from QR code
    const itemId = extractItemIdFromQR(qrValue);
    
    if (!itemId) {
      setError("Could not extract item ID from QR code.");
      setLoading(false);
      return;
    }
    
    try {
      // Fetch item details
      const response = await getItemById(itemId);
      
      if (response.data) {
        setItemData(response.data);
        
        // Store QR code in the item's EAN field
        try {
          await updateItem(itemId, { ean_code: qrValue });
          
          // Also update localStorage
          const storedItem = localStorage.getItem(`item_${itemId}_details`);
          const parsedItem = storedItem ? JSON.parse(storedItem) : {};
          
          localStorage.setItem(`item_${itemId}_details`, JSON.stringify({
            ...parsedItem,
            ...response.data,
            qr_code: qrValue,
            ean_code: qrValue, // Ensure EAN field is also updated
            updated_at: new Date().toISOString()
          }));
          
          setSuccess(true);
        } catch (err) {
          console.error("Error updating item with QR code:", err);
          setError("Found item but failed to save QR code to database.");
        }
      } else {
        setError("Item not found in the database.");
      }
    } catch (err) {
      console.error("Error fetching item details:", err);
      setError("Error fetching item details. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Start/stop scanning
  const toggleScanning = () => {
    if (scanning) {
      // If already scanning, just update state (scanner cleanup in useEffect)
      setScanning(false);
      setScanResult(null);
    } else {
      // Start scanning
      setScanning(true);
      setScanResult(null);
      setItemData(null);
      setError(null);
      setSuccess(false);
    }
  };
  
  // View item details
  const viewItem = () => {
    if (itemData && itemData.id) {
      navigate(`/items/${itemData.id}`);
    }
  };
  
  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h1 className="h5 mb-0">Scan QR Code</h1>
          <button 
            className="btn btn-sm btn-outline-light" 
            onClick={() => navigate('/items')}
          >
            Back to Items
          </button>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <p className="lead">
              {scanning 
                ? "Position QR code in the scanner" 
                : "Scan an item's QR code to quickly view or update it"}
            </p>
            
            {error && (
              <div className="alert alert-danger py-2">
                {error}
              </div>
            )}
            
            {success && !error && (
              <div className="alert alert-success py-2">
                QR code successfully saved to item record.
              </div>
            )}
            
            <div className="d-grid gap-2">
              <button 
                className={`btn ${scanning ? 'btn-danger' : 'btn-primary'}`}
                onClick={toggleScanning}
              >
                {scanning ? (
                  <>
                    <i className="bi bi-stop-circle me-1"></i>
                    Stop Scanning
                  </>
                ) : (
                  <>
                    <i className="bi bi-camera me-1"></i>
                    Start Scanning
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* QR Scanner Container */}
          {scanning && (
            <div className="mb-4">
              <div id="qr-reader" style={{ width: '100%' }}></div>
            </div>
          )}
          
          {/* Scan Result */}
          {scanResult && !loading && (
            <div className="mt-3">
              <div className="card bg-light">
                <div className="card-header">
                  <h5 className="mb-0">Scan Result</h5>
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <strong>QR Code:</strong>
                    <pre className="mt-1 p-2 border rounded bg-white" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {scanResult}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Item Details */}
          {itemData && !loading && (
            <div className="mt-3">
              <div className="card">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">Item Found</h5>
                </div>
                <div className="card-body">
                  <h5>{itemData.name}</h5>
                  <div className="mb-2">
                    <span className="badge bg-primary me-2">Quantity: {itemData.quantity}</span>
                    {itemData.type && (
                      <span className="badge bg-secondary me-2">{itemData.type}</span>
                    )}
                    {itemData.box_id && (
                      <span className="badge bg-info text-dark">Box: #{itemData.box_number || itemData.box_id}</span>
                    )}
                  </div>
                  {itemData.description && (
                    <p className="card-text">{itemData.description}</p>
                  )}
                  <div className="d-grid gap-2 mt-3">
                    <button 
                      className="btn btn-primary"
                      onClick={viewItem}
                    >
                      View Item Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading Indicator */}
          {loading && (
            <div className="d-flex justify-content-center my-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScanQRPage; 