import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BarcodeScanner from './BarcodeScanner';
import { getBoxes, getItems } from '../services/api';

const QuickScanButton = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [scannedItem, setScannedItem] = useState(null);
  const [scannedBox, setScannedBox] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Fetch reference data when component mounts
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const [boxesResponse, itemsResponse] = await Promise.all([
          getBoxes(),
          getItems()
        ]);
        
        setBoxes(boxesResponse.data || []);
        setItems(itemsResponse.data || []);
      } catch (err) {
        console.error('Error fetching reference data:', err);
      }
    };
    
    fetchReferenceData();
  }, []);

  const handleScan = async (code) => {
    console.log('Quick scan result:', code);
    setScannedCode(code);
    setLoading(true);
    setError('');
    
    try {
      // Check if it's a box barcode
      const boxMatch = code.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
      if (boxMatch) {
        const boxNumber = boxMatch[1].replace(/^0+/, ''); // Remove leading zeros
        
        // Find the box with this number
        const matchedBox = boxes.find(box => 
          box.box_number === boxNumber || 
          box.box_number.endsWith(boxNumber)
        );
        
        if (matchedBox) {
          setScannedBox(matchedBox);
          
          // Fetch items for this box
          navigate(`/scan-stock?box_id=${matchedBox.id}&tab=items`);
          setShowScanner(false);
          return;
        }
      }
      
      // Check if it's an item barcode (EAN code)
      const matchedItem = items.find(item => item.ean_code === code);
      if (matchedItem) {
        setScannedItem(matchedItem);
        setShowActionMenu(true);
        return;
      }
      
      // If no match found
      setError(`No box or item found for scan value: ${code}`);
      setTimeout(() => {
        setShowScanner(false);
        setError('');
      }, 3000);
    } catch (err) {
      console.error('Error processing scan:', err);
      setError('Failed to process scan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStockIn = () => {
    setShowActionMenu(false);
    setShowScanner(false);
    
    if (scannedItem) {
      navigate(`/stock?action=stock-in&item_id=${scannedItem.id}&box_id=${scannedItem.box_id || ''}`);
    }
  };

  const handleStockOut = () => {
    setShowActionMenu(false);
    setShowScanner(false);
    
    if (scannedItem) {
      navigate(`/stock?action=stock-out&item_id=${scannedItem.id}&box_id=${scannedItem.box_id || ''}`);
    }
  };

  const handleViewHistory = () => {
    setShowActionMenu(false);
    setShowScanner(false);
    
    if (scannedItem) {
      navigate(`/scan-stock?item_id=${scannedItem.id}&tab=transactions`);
    }
  };

  return (
    <>
      {/* Floating action button */}
      <button 
        className="btn btn-primary rounded-circle position-fixed"
        style={{
          bottom: '20px',
          right: '20px',
          width: '60px',
          height: '60px',
          fontSize: '24px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          zIndex: 1030
        }}
        onClick={() => setShowScanner(true)}
        title="Scan Box or Item"
      >
        <i className="bi bi-upc-scan"></i>
      </button>
      
      {/* Scanner modal */}
      {showScanner && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Quick Scan</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowScanner(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger mb-3">{error}</div>
                )}
                
                {loading ? (
                  <div className="text-center my-3">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Processing scan...</span>
                    </div>
                    <p className="mt-2">Processing scan...</p>
                  </div>
                ) : (
                  <BarcodeScanner 
                    onScan={handleScan} 
                    onClose={() => setShowScanner(false)}
                    scannerTitle="Scan Box or Item Barcode"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Action menu modal */}
      {showActionMenu && scannedItem && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1040 }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Item Actions</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowActionMenu(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <div className="card mb-3">
                  <div className="card-body">
                    <h5 className="card-title">{scannedItem.name}</h5>
                    {scannedItem.serial_number && (
                      <h6 className="card-subtitle mb-2 text-muted">SN: {scannedItem.serial_number}</h6>
                    )}
                    <p className="card-text">
                      {scannedItem.description || 'No description'}
                    </p>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="badge bg-primary">Qty: {scannedItem.quantity}</span>
                      {scannedItem.box_id && (
                        <span className="badge bg-secondary">
                          Box: {boxes.find(b => b.id === parseInt(scannedItem.box_id))?.box_number || scannedItem.box_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="d-grid gap-2">
                  <button 
                    className="btn btn-success"
                    onClick={handleStockIn}
                  >
                    <i className="bi bi-box-arrow-in-down me-2"></i>
                    Stock In
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={handleStockOut}
                  >
                    <i className="bi bi-box-arrow-up-right me-2"></i>
                    Stock Out
                  </button>
                  <button 
                    className="btn btn-info"
                    onClick={handleViewHistory}
                  >
                    <i className="bi bi-clock-history me-2"></i>
                    View Transaction History
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickScanButton; 