import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateUniqueQRValue } from '../utils/qrCodeGenerator';

/**
 * QR Code Label component for items
 * 
 * @param {Object} props
 * @param {number|string} props.itemId - The item ID (for existing items)
 * @param {string} props.itemName - The item name
 * @param {string} props.qrValue - Existing QR code value (optional)
 * @param {function} props.onGenerate - Callback when a new QR code is generated
 * @param {string} props.size - QR code size in pixels (default: 128)
 * @param {string} props.labelFormat - Label format (default: 'standard', other options: 'compact', 'small')
 */
function QRCodeLabel({ itemId, itemName, qrValue, onGenerate, size = 128, labelFormat = 'standard' }) {
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(labelFormat);
  
  // Generate a QR code on initial render if none exists or if existing code doesn't use EPL-IT-STOCK prefix
  useEffect(() => {
    // Always check if a valid QR code already exists before generating a new one
    if (qrValue && qrValue.startsWith('EPL-IT-STOCK')) {
      console.log('Using existing QR code:', qrValue);
      setQrCodeValue(qrValue);
    } else {
      // First look for existing codes in localStorage
      if (itemId) {
        try {
          const storedItem = localStorage.getItem(`item_${itemId}_details`);
          if (storedItem) {
            const parsedItem = JSON.parse(storedItem);
            if (parsedItem.qr_code && parsedItem.qr_code.startsWith('EPL-IT-STOCK')) {
              console.log('Using QR code from localStorage:', parsedItem.qr_code);
              setQrCodeValue(parsedItem.qr_code);
              
              // Call the callback if provided
              if (onGenerate) {
                onGenerate(parsedItem.qr_code);
              }
              return;
            }
            
            // Also check if it's in the EAN code field
            if (parsedItem.ean_code && parsedItem.ean_code.startsWith('EPL-IT-STOCK')) {
              console.log('Using EAN code from localStorage as QR code:', parsedItem.ean_code);
              setQrCodeValue(parsedItem.ean_code);
              
              // Call the callback if provided
              if (onGenerate) {
                onGenerate(parsedItem.ean_code);
              }
              return;
            }
          }
        } catch (err) {
          console.error('Error checking localStorage for QR code:', err);
        }
      }
      
      // If no existing code found, generate a new one
      generateNewQRCode();
    }
  }, [itemId, qrValue]);
  
  // Also update labelFormat when it changes
  useEffect(() => {
    setSelectedFormat(labelFormat);
  }, [labelFormat]);
  
  // Generate a new unique QR code
  const generateNewQRCode = () => {
    const newQRValue = generateUniqueQRValue(itemId);
    setQrCodeValue(newQRValue);
    
    // Call the callback if provided
    if (onGenerate) {
      onGenerate(newQRValue);
    }
  };
  
  // Print the QR code
  const printQRCode = () => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('Please allow pop-ups to print QR codes');
      return;
    }
    
    // Get QR code SVG element
    const qrCodeEl = document.getElementById('qr-code');
    
    // Convert SVG to an image URL
    const svgData = new XMLSerializer().serializeToString(qrCodeEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const imgUrl = URL.createObjectURL(svgBlob);
    
    // Define styles based on the selected label format
    let containerStyles = '';
    let nameStyles = '';
    let qrCodeSize = size;
    let qrValueStyles = '';
    let pageStyles = '';
    
    switch(selectedFormat) {
      case 'compact':
        // Optimized for 17mm x 54mm labels
        containerStyles = `
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 54mm;
          height: 17mm;
          padding: 1mm;
          box-sizing: border-box;
          overflow: hidden;
          margin: 0;
        `;
        nameStyles = `
          font-size: 11px;
          font-weight: bold;
          white-space: normal;
          overflow: hidden;
          max-width: 30mm;
          line-height: 1.2;
        `;
        qrCodeSize = Math.min(size, 60); // Smaller QR code for compact label
        qrValueStyles = `
          font-size: 8px;
          color: #666;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 30mm;
          white-space: nowrap;
        `;
        pageStyles = `
          @page {
            size: 54mm 17mm;
            margin: 0;
          }
        `;
        break;
      
      case 'small':
        // Optimized for very small labels
        containerStyles = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 30mm;
          height: 20mm;
          padding: 1mm;
          box-sizing: border-box;
          overflow: hidden;
          margin: 0;
        `;
        nameStyles = `
          font-size: 6px;
          font-weight: bold;
          margin-top: 1mm;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 28mm;
        `;
        qrCodeSize = Math.min(size, 45); // Very small QR code
        qrValueStyles = `
          display: none; /* Hide QR code value for very small labels */
        `;
        pageStyles = `
          @page {
            size: 30mm 20mm;
            margin: 0;
          }
        `;
        break;
      
      default: // standard
        containerStyles = `
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
          padding: 5mm;
        `;
        nameStyles = `
          font-size: 14px;
          font-weight: bold;
          margin-top: 8px;
          text-align: center;
        `;
        qrValueStyles = `
          font-size: 8px;
          color: #666;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 30mm;
          white-space: nowrap;
        `;
        pageStyles = `
          @page {
            size: auto;
            margin: 10mm;
          }
        `;
        break;
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code for ${itemName || 'Item'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .qr-container {
              ${containerStyles}
            }
            .label-content {
              margin-left: 2mm;
              overflow: hidden;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            .item-name {
              ${nameStyles}
            }
            .qr-value {
              ${qrValueStyles}
            }
            @media print {
              ${pageStyles}
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${imgUrl}" width="${qrCodeSize}" height="${qrCodeSize}" />
            <div class="label-content">
              <div class="item-name">${itemName || 'Item'}</div>
              <div class="qr-value">${qrCodeValue}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };
  
  return (
    <div className="qr-code-container">
      {qrCodeValue ? (
        <>
          <div className="qr-code-display mb-2">
            <QRCodeSVG
              id="qr-code"
              value={qrCodeValue}
              size={size}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="qr-code-value small text-muted mb-2" style={{ wordBreak: 'break-all' }}>
            {qrCodeValue}
          </div>
          <div className="alert alert-info py-2 small">
            <i className="bi bi-info-circle me-1"></i>
            This code will be saved to the EAN field when you update the item.
          </div>
          <div className="mb-3">
            <label className="form-label small mb-1">Label Format</label>
            <div className="d-flex">
            <select 
              className="form-select form-select-sm"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
            >
              <option value="standard">Standard</option>
              <option value="compact">17mm x 54mm (Compact)</option>
              <option value="small">Small (30mm x 20mm)</option>
            </select>
              <div className="ms-2">
                <span className="badge bg-info text-dark ms-1" title="Recommended for standard printer paper">
                  {selectedFormat === 'standard' && <i className="bi bi-check-circle-fill text-success me-1"></i>}
                  Standard
                </span>
                <span className="badge bg-primary text-white ms-1" title="Recommended for label printers">
                  {selectedFormat === 'compact' && <i className="bi bi-check-circle-fill text-success me-1"></i>}
                  Compact
                </span>
                <span className="badge bg-secondary text-white ms-1" title="Very small labels">
                  {selectedFormat === 'small' && <i className="bi bi-check-circle-fill text-success me-1"></i>}
                  Small
                </span>
              </div>
            </div>
          </div>
          <div className="qr-code-actions">
            <button 
              className="btn btn-sm btn-outline-secondary me-2" 
              onClick={generateNewQRCode}
              type="button"
            >
              Generate New QR Code
            </button>
            <button 
              className="btn btn-sm btn-outline-primary" 
              onClick={printQRCode}
              type="button"
            >
              Print
            </button>
          </div>
        </>
      ) : (
        <button 
          className="btn btn-sm btn-primary" 
          onClick={generateNewQRCode}
          type="button"
        >
          Generate QR Code
        </button>
      )}
    </div>
  );
}

export default QRCodeLabel; 