import React, { useState, useEffect } from 'react';
import { generateItemLabelsPDF, printToLabelPrinter, openItemLabelPrintDialog, saveItemLabelAsPDF } from '../utils/LabelPrinter';
import QRCodeLabel from './QRCodeLabel';

/**
 * ItemLabelPrinting component - Provides UI for printing item QR code labels
 */
const ItemLabelPrinting = ({ items = [], onClose }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [message, setMessage] = useState('');
  const [copies, setCopies] = useState(1);
  const [generateReferences, setGenerateReferences] = useState(false);
  const [labelFormat, setLabelFormat] = useState('compact');
  const [showQRValue, setShowQRValue] = useState(true);
  const [showBorders, setShowBorders] = useState(false);
  
  // Set default selection
  useEffect(() => {
    if (items.length > 0 && selectedItems.length === 0) {
      setSelectedItems(items.slice(0, Math.min(10, items.length)));
    }
  }, [items]);
  
  // Toggle item selection
  const toggleItemSelection = (item) => {
    if (selectedItems.some(i => i.id === item.id)) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };
  
  // Select all items
  const selectAllItems = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...items]);
    }
  };
  
  // Generate PDF
  const handleGeneratePDF = async () => {
    if (selectedItems.length === 0) {
      setMessage('Please select at least one item');
      return;
    }
    
    setIsGeneratingPDF(true);
    setMessage('Generating PDF...');
    
    try {
      // If generateReferences is true, ensure all selected items have a QR code
      const itemsToProcess = [...selectedItems];
      
      if (generateReferences) {
        // Ensure all items have a reference code
        itemsToProcess.forEach(item => {
          if (!item.qr_code) {
            // Generate a new unique reference code
            item.qr_code = `EPL-IT-STOCK-${item.id}-${Date.now().toString(36)}`;
          }
        });
      }
      
      const result = await generateItemLabelsPDF(itemsToProcess, {
        labelFormat,
        showQRValue,
        showBorders,
        filename: 'item-qr-labels.pdf'
      });
      
      if (result.success) {
        setMessage(`PDF generated successfully with ${selectedItems.length} labels`);
      } else {
        setMessage(`Error generating PDF: ${result.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  // Save single label as PDF
  const handleSaveSingleLabelAsPDF = async (item) => {
    setIsGeneratingPDF(true);
    setMessage('Generating PDF...');
    
    try {
      // Make a copy to avoid modifying the original
      const itemToSave = { ...item };
      
      // If generateReferences is true and item doesn't have a QR code, generate one
      if (generateReferences && !itemToSave.qr_code) {
        itemToSave.qr_code = `EPL-IT-STOCK-${item.id}-${Date.now().toString(36)}`;
      }
      
      const result = await saveItemLabelAsPDF(itemToSave, {
        labelFormat,
        showQRValue,
        showBorders,
        filename: `item-${item.id}-qrcode.pdf`
      });
      
      if (result.success) {
        setMessage(`PDF generated successfully for ${item.name || 'Item #' + item.id}`);
      } else {
        setMessage(`Error generating PDF: ${result.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  // Print to label printer
  const handlePrintToLabelPrinter = async () => {
    if (selectedItems.length === 0) {
      setMessage('Please select at least one item');
      return;
    }
    
    setIsPrinting(true);
    setMessage('Sending to printer...');
    
    try {
      // Make copies to avoid modifying originals
      const itemsToProcess = selectedItems.map(item => {
        const itemCopy = { ...item };
        
        // If generateReferences is true and item doesn't have QR code, generate one
        if (generateReferences && !itemCopy.qr_code) {
          itemCopy.qr_code = `EPL-IT-STOCK-${item.id}-${Date.now().toString(36)}`;
        }
        
        return itemCopy;
      });
      
      const result = await printToLabelPrinter(itemsToProcess, {
        labelFormat,
        showQRValue,
        showBorders,
        copies
      });
      
      if (result.success) {
        setMessage(`Printed ${selectedItems.length} labels to printer`);
      } else {
        setMessage(`Error printing: ${result.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };
  
  // Open print dialog
  const handleOpenPrintDialog = async () => {
    if (selectedItems.length === 0) {
      setMessage('Please select at least one item');
      return;
    }
    
    setIsPrinting(true);
    setMessage('Opening print dialog...');
    
    try {
      // Make copies to avoid modifying originals
      const itemsToProcess = selectedItems.map(item => {
        const itemCopy = { ...item };
        
        // If generateReferences is true and item doesn't have QR code, generate one
        if (generateReferences && !itemCopy.qr_code) {
          itemCopy.qr_code = `EPL-IT-STOCK-${item.id}-${Date.now().toString(36)}`;
        }
        
        return itemCopy;
      });
      
      const result = await openItemLabelPrintDialog(itemsToProcess, {
        labelFormat,
        showQRValue,
        showBorders
      });
      
      if (result && result.success) {
        setMessage('Print dialog opened');
      } else {
        setMessage('Failed to open print dialog');
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsPrinting(false);
    }
  };
  
  // Preview selected label
  const renderPreview = () => {
    if (selectedItems.length === 0) {
      return <div className="empty-preview">Select an item to preview label</div>;
    }
    
    const selectedItem = selectedItems[0];
    
    return (
      <div className="label-preview">
        <h5>Label Preview</h5>
        <div className="preview-container bg-light rounded border p-3 d-flex flex-column align-items-center" style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}>
          <QRCodeLabel 
            itemId={selectedItem.id}
            itemName={selectedItem.name}
            qrValue={selectedItem.qr_code || selectedItem.ean_code}
            size={128}
            labelFormat={labelFormat}
          />
        </div>
        <div className="text-center mt-3">
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={() => handleSaveSingleLabelAsPDF(selectedItem)}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? 'Generating...' : 'Save as PDF'}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="item-label-printing-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Print QR Code Labels</h4>
        {onClose && (
          <button 
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
          >
            <i className="bi bi-x"></i> Close
          </button>
        )}
      </div>
      <p>Select items to print QR code labels for</p>
      
      <div className="box-selection mb-4">
        <div className="selection-header d-flex justify-content-between align-items-center mb-2">
          <button 
            onClick={selectAllItems} 
            className="btn btn-sm btn-outline-primary"
          >
            {selectedItems.length === items.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="badge bg-info">{selectedItems.length} of {items.length} items selected</span>
        </div>
        
        <div className="items-list border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {items.map(item => (
            <div 
              key={item.id} 
              className={`item-list-row d-flex align-items-center p-2 border-bottom ${selectedItems.some(i => i.id === item.id) ? 'bg-light' : ''}`}
              onClick={() => toggleItemSelection(item)}
              style={{ cursor: 'pointer' }}
            >
              <div className="form-check me-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selectedItems.some(i => i.id === item.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleItemSelection(item);
                  }}
                />
              </div>
              <div className="flex-grow-1">
                <div className="fw-medium">{item.name || `Item #${item.id}`}</div>
                <div className="small">
                  {item.type && <span className="badge bg-secondary me-2">{item.type}</span>}
                  {item.qr_code && (
                    <span className="badge bg-info text-dark me-2" title={item.qr_code}>
                      <i className="bi bi-qr-code me-1"></i>
                      Has QR Code
                    </span>
                  )}
                  {!item.qr_code && item.ean_code && (
                    <span className="badge bg-success text-white me-2" title={item.ean_code}>
                      <i className="bi bi-upc-scan me-1"></i>
                      Has EAN Code
                    </span>
                  )}
                  {!item.qr_code && !item.ean_code && generateReferences && (
                    <span className="badge bg-warning text-dark">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Needs QR Code
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="p-3 text-center text-muted">No items available</div>
          )}
        </div>
      </div>
      
      <div className="row">
        <div className="col-md-6">
          <div className="print-options card mb-4">
            <div className="card-header bg-light">
              <h5 className="card-title mb-0 text-dark">Print Options</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="generate-references"
                    checked={generateReferences}
                    onChange={() => setGenerateReferences(!generateReferences)}
                  />
                  <label className="form-check-label" htmlFor="generate-references">
                    Generate new QR codes for items without one
                  </label>
                </div>
                
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="show-qr-value"
                    checked={showQRValue}
                    onChange={() => setShowQRValue(!showQRValue)}
                  />
                  <label className="form-check-label" htmlFor="show-qr-value">
                    Show QR code value on labels
                  </label>
                </div>
                
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="show-borders"
                    checked={showBorders}
                    onChange={() => setShowBorders(!showBorders)}
                  />
                  <label className="form-check-label" htmlFor="show-borders">
                    Show borders on labels
                  </label>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label">Label Format</label>
                <select 
                  className="form-select form-select-sm"
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value)}
                >
                  <option value="compact">Compact (17mm x 54mm)</option>
                  <option value="standard">Standard (60mm x 30mm)</option>
                  <option value="small">Small (30mm x 20mm)</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">
                  Copies per item:
                </label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          </div>
          
          <div className="print-actions card mb-4">
            <div className="card-header bg-light">
              <h5 className="card-title mb-0 text-dark">Print Actions</h5>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-primary"
                  onClick={handleGeneratePDF} 
                  disabled={isGeneratingPDF || selectedItems.length === 0}
                >
                  <i className="bi bi-file-pdf me-1"></i>
                  {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
                </button>
                
                <button 
                  className="btn btn-success"
                  onClick={handleOpenPrintDialog} 
                  disabled={isPrinting || selectedItems.length === 0}
                >
                  <i className="bi bi-printer me-1"></i>
                  PRINT
                </button>
              </div>
            </div>
          </div>
          
          {message && (
            <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
              {message}
            </div>
          )}
        </div>
        
        <div className="col-md-6">
          <div className="preview-section card">
            <div className="card-header bg-light">
              <h5 className="card-title mb-0">Preview</h5>
            </div>
            <div className="card-body">
              {renderPreview()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemLabelPrinting; 