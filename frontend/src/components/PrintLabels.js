import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getItems, getItemById, updateItem } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { generateUniqueQRValue } from '../utils/qrCodeGenerator';
import '../styles/labelPrinting.css';

// Function to truncate text to fit on label
const truncateText = (text, maxLength = 20) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Function to format QR code for display
const formatQrCode = (qrCode) => {
  if (!qrCode) return '';
  if (showQrText) {
    return qrCode;
  } else if (showFullCode) {
    return qrCode; // Show the full code
  } else {
    // Extract just the unique part after the prefix
    const parts = qrCode.split('-');
    if (parts.length >= 3) {
      return parts[parts.length - 1]; // Return just the unique identifier
    }
    return qrCode.substring(qrCode.length - 8); // Fallback: last 8 chars
  }
};

// Function to render a single label with consistent vertical centering
const LabelContent = ({ item, qrSize, printCopies, copyIndex, truncateText, formatQrCode, showQrText, showFullCode }) => {
  // Function to format QR code for display
  const formatQrCodeInternal = (qrCode) => {
    if (!qrCode) return '';
    if (showQrText) {
      return qrCode;
    } else if (showFullCode) {
      return qrCode; // Show the full code
    } else {
      // Extract just the unique part after the prefix
      const parts = qrCode.split('-');
      if (parts.length >= 3) {
        return parts[parts.length - 1]; // Return just the unique identifier
      }
      return qrCode.substring(qrCode.length - 8); // Fallback: last 8 chars
    }
  };
  
  return (
    <div className="label-content">
      {/* QR code on left */}
      <div className="qr-code">
        <QRCodeSVG
          value={item.qr_code}
          size={qrSize}
          level="L"
          includeMargin={false}
        />
        {printCopies > 1 && (
          <div className="copy-indicator">{copyIndex}/{printCopies}</div>
        )}
      </div>
      {/* Text content on right - fixed structure for consistent centering */}
      <div className="text-content">
        <div className="label-text-wrapper">
          <div className="item-name">{truncateText(item.name, 25)}</div>
          <div className="item-code">{formatQrCodeInternal(item.qr_code)}</div>
        </div>
      </div>
    </div>
  );
};

function PrintLabels() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [labelFormat, setLabelFormat] = useState('compact'); // Default to 17mm x 54mm format
  const [labelsPerRow, setLabelsPerRow] = useState(1); // Default 1 label per row as requested
  const [labelsPerPage, setLabelsPerPage] = useState(8); // Default 8 labels per page (can fit on A4)
  const [qrSize, setQrSize] = useState(50); // QR size 50px as requested
  const [showOptions, setShowOptions] = useState(true);
  const [fontSizeAdjust, setFontSizeAdjust] = useState(0); // Default font size as requested
  const [printCopies, setPrintCopies] = useState(1); // Number of copies per item
  const [showQrText, setShowQrText] = useState(true); // Show raw QR code text as requested
  const [leftPadding, setLeftPadding] = useState(-2); // Less left padding as requested
  const [showFullCode, setShowFullCode] = useState(true); // Show full QR code value as requested
  const [verticalOffset, setVerticalOffset] = useState(0); // Default vertical offset
  
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchSelectedItems = async () => {
      try {
        setLoading(true);
        
        // Get item IDs from URL params
        const params = new URLSearchParams(location.search);
        const itemIds = params.get('ids')?.split(',').map(id => parseInt(id, 10)) || [];
        
        if (itemIds.length === 0) {
          setError('No items selected for printing.');
          setLoading(false);
          return;
        }
        
        // Fetch details for each item
        const itemsData = [];
        for (const id of itemIds) {
          try {
            const response = await getItemById(id);
            if (response.data) {
              // Check if item has QR code in localStorage
              let qrCode = '';
              try {
                const storedItem = localStorage.getItem(`item_${id}_details`);
                if (storedItem) {
                  const parsedItem = JSON.parse(storedItem);
                  if (parsedItem.qr_code) {
                    qrCode = parsedItem.qr_code;
                  }
                }
              } catch (err) {
                console.error('Error parsing stored item data:', err);
              }
              
              // If no existing QR code or if it doesn't use the correct prefix, generate a new one
              if (!qrCode || !qrCode.startsWith('EPL-IT-STOCK')) {
                qrCode = generateUniqueQRValue(id);
                
                // Save to localStorage
                try {
                  const storedItem = localStorage.getItem(`item_${id}_details`);
                  const parsedItem = storedItem ? JSON.parse(storedItem) : {};
                  localStorage.setItem(`item_${id}_details`, JSON.stringify({
                    ...parsedItem,
                    ...response.data,
                    qr_code: qrCode,
                    ean_code: qrCode, // Store QR code as EAN code
                    updated_at: new Date().toISOString()
                  }));
                } catch (err) {
                  console.error('Error storing item details in localStorage:', err);
                }
                
                // Update the EAN code in the database with the QR code value
                try {
                  await updateItem(id, { 
                    ean_code: qrCode,
                    // Send existing required data to avoid null constraint violation
                    name: response.data.name || 'Unnamed Item',
                    quantity: response.data.quantity || 1
                  });
                } catch (err) {
                  console.error('Error updating item EAN code in database:', err);
                }
              }
              
              itemsData.push({
                ...response.data,
                qr_code: qrCode
              });
            }
          } catch (err) {
            console.error(`Error fetching item ${id}:`, err);
          }
        }
        
        setItems(itemsData);
        setError(null);
      } catch (err) {
        setError('Failed to fetch items. Please try again later.');
        console.error('Error fetching items:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSelectedItems();
  }, [location.search]);
  
  const handlePrint = () => {
    setShowOptions(false);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setShowOptions(true);
      }, 500);
    }, 300);
  };
  
  // Apply dynamic styles based on user settings
  useEffect(() => {
    // Create a style element for dynamic styles
    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-label-styles';
    
    // Set dynamic styles based on component state
    const dynamicStyles = `
      @media print {
        .labels-container {
          grid-template-columns: repeat(${labelsPerRow}, 1fr) !important;
        }
        
        .label-wrapper:nth-child(${labelsPerPage}n) {
          page-break-after: always !important;
        }
        
        .item-name {
          font-size: ${11 + fontSizeAdjust}px !important;
        }
        
        .item-type {
          font-size: ${9 + fontSizeAdjust}px !important;
        }
        
        .item-code {
          font-size: ${9 + fontSizeAdjust}px !important;
        }
        
        .item-serial {
          font-size: ${6 + fontSizeAdjust}px !important;
        }
        
        .qr-code {
          padding-left: ${2 + leftPadding}mm !important;
        }
        
        .text-content {
          padding-left: ${2 + leftPadding}mm !important;
        }
        
        .label-text-wrapper {
          top: calc(50% + ${verticalOffset}mm) !important;
        }
      }
      
      /* Fix for preview */
      .preview-label {
        overflow: hidden !important;
      }
      
      .preview-label .label-content {
        width: 100% !important;
        height: 100% !important;
      }
      
      .preview-label .qr-code {
        width: 17mm !important;
        height: 17mm !important;
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        padding: 0mm !important;
        padding-left: ${2 + leftPadding}mm !important;
        box-sizing: border-box !important;
      }
      
      .preview-label .text-content {
        position: relative !important;
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        padding: 0mm !important;
        padding-left: ${2 + leftPadding}mm !important;
        box-sizing: border-box !important;
        height: 17mm !important;
      }
      
      .preview-label .label-text-wrapper {
        position: absolute !important;
        top: calc(50% + ${verticalOffset}mm) !important;
        transform: translateY(-50%) !important;
        width: 95% !important;
        left: 0 !important;
      }
    `;
    
    styleEl.innerHTML = dynamicStyles;
    
    // Remove any existing dynamic styles
    const existingStyle = document.getElementById('dynamic-label-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Add the new styles
    document.head.appendChild(styleEl);
    
    // Cleanup on component unmount
    return () => {
      const styleToRemove = document.getElementById('dynamic-label-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [labelsPerRow, labelsPerPage, fontSizeAdjust, leftPadding, verticalOffset]);
  
  // Generate the array of items with duplicates based on print copies
  const getItemsWithCopies = () => {
    const result = [];
    items.forEach(item => {
      for (let i = 0; i < printCopies; i++) {
        result.push({
          ...item,
          copyIndex: i + 1
        });
      }
    });
    return result;
  };
  
  if (loading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          {error}
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/items')}
        >
          Back to Items
        </button>
      </div>
    );
  }
  
  // Get the items with copies for printing
  const itemsWithCopies = getItemsWithCopies();
  
  return (
    <div className="print-labels-container">
      {/* Print options - hidden when printing */}
      {showOptions && (
        <div className="container mt-4 print-options">
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h1 className="h5 mb-0">Print QR Code Labels</h1>
            </div>
            <div className="card-body">
              <div className="row mb-3">
                <div className="col-md-3">
                  <label htmlFor="labelFormat" className="form-label">Label Format</label>
                  <select 
                    id="labelFormat"
                    className="form-select"
                    value={labelFormat}
                    onChange={(e) => setLabelFormat(e.target.value)}
                  >
                    <option value="standard">Standard</option>
                    <option value="compact">17mm x 54mm (Compact)</option>
                    <option value="small">Small (30mm x 20mm)</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label htmlFor="labelsPerRow" className="form-label">Labels Per Row</label>
                  <input
                    type="number"
                    id="labelsPerRow"
                    className="form-control"
                    value={labelsPerRow}
                    onChange={(e) => setLabelsPerRow(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    max="4"
                  />
                </div>
                <div className="col-md-3">
                  <label htmlFor="printCopies" className="form-label">Copies per Item</label>
                  <input
                    type="number"
                    id="printCopies"
                    className="form-control"
                    value={printCopies}
                    onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="col-md-3">
                  <label htmlFor="qrSize" className="form-label">QR Code Size (px)</label>
                  <input
                    type="number"
                    id="qrSize"
                    className="form-control"
                    value={qrSize}
                    onChange={(e) => setQrSize(parseInt(e.target.value, 10) || 40)}
                    min="30"
                    max="60"
                  />
                </div>
              </div>
              <div className="row mb-3">
                <div className="col-md-3">
                  <label htmlFor="fontSizeAdjust" className="form-label">Font Size</label>
                  <input
                    type="range"
                    id="fontSizeAdjust"
                    className="form-range"
                    value={fontSizeAdjust}
                    onChange={(e) => setFontSizeAdjust(parseInt(e.target.value, 10))}
                    min="-3"
                    max="3"
                    step="1"
                  />
                  <div className="d-flex justify-content-between">
                    <small>Smaller</small>
                    <small>Default</small>
                    <small>Larger</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <label htmlFor="leftPadding" className="form-label">Left Padding</label>
                  <input
                    type="range"
                    id="leftPadding"
                    className="form-range"
                    value={leftPadding}
                    onChange={(e) => setLeftPadding(parseInt(e.target.value, 10))}
                    min="-2"
                    max="5"
                    step="1"
                  />
                  <div className="d-flex justify-content-between">
                    <small>Less</small>
                    <small>Default</small>
                    <small>More</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <label htmlFor="verticalOffset" className="form-label">Vertical Position</label>
                  <input
                    type="range"
                    id="verticalOffset"
                    className="form-range"
                    value={verticalOffset}
                    onChange={(e) => setVerticalOffset(parseInt(e.target.value, 10))}
                    min="-3"
                    max="3"
                    step="1"
                  />
                  <div className="d-flex justify-content-between">
                    <small>Up</small>
                    <small>Center</small>
                    <small>Down</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-check mt-4">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showFullCode"
                      checked={showFullCode}
                      onChange={(e) => setShowFullCode(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="showFullCode">
                      Show full QR code value
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="showQrText"
                      checked={showQrText}
                      onChange={(e) => setShowQrText(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="showQrText">
                      Show raw QR code text
                    </label>
                  </div>
                </div>
              </div>
              <div className="d-flex justify-content-between">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => navigate('/items')}
                >
                  Back to Items
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handlePrint}
                >
                  <i className="bi bi-printer me-1"></i>
                  Print {items.length} Items ({itemsWithCopies.length} Labels)
                </button>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header bg-light">
              <h2 className="h6 mb-0">Preview</h2>
            </div>
            <div className="card-body">
              <p>Selected {items.length} items for printing ({printCopies} {printCopies === 1 ? 'copy' : 'copies'} each):</p>
              <div className="table-responsive">
                <table className="table table-sm table-bordered">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Name</th>
                      <th>Type</th>
                      <th>QR Code</th>
                      <th>Copies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.type || '-'}</td>
                        <td>
                          <small className="text-muted">
                            {item.qr_code ? (
                              <code>{item.qr_code.substring(0, 12)}...</code>
                            ) : (
                              'Will be generated'
                            )}
                          </small>
                        </td>
                        <td>{printCopies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Preview of a label */}
              <div className="label-preview">
                <h6>Label Preview (Actual Size)</h6>
                <div className="preview-label">
                  <LabelContent 
                    item={{
                      name: items[0]?.name || 'EPSON 112 BLACK',
                      qr_code: items[0]?.qr_code || 'EPL-IT-STOCK-15-56NO'
                    }}
                    qrSize={qrSize}
                    printCopies={printCopies}
                    copyIndex={1}
                    truncateText={truncateText}
                    formatQrCode={formatQrCode}
                    showQrText={showQrText}
                    showFullCode={showFullCode}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Print layout - optimized for 17x54mm labels */}
      <div className="print-layout">
        <div className="labels-container">
          {itemsWithCopies.map((item, index) => (
            <div key={`${item.id}-${item.copyIndex}`} className="label-wrapper">
              <LabelContent 
                item={item}
                qrSize={qrSize}
                printCopies={printCopies}
                copyIndex={item.copyIndex}
                truncateText={truncateText}
                formatQrCode={formatQrCode}
                showQrText={showQrText}
                showFullCode={showFullCode}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PrintLabels; 