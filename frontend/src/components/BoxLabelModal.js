import React, { useRef, useState } from 'react';
import BoxLabel from './BoxLabel';
import { saveBoxLabelAsPDF } from '../utils/LabelPrinter';
import { QRCodeSVG } from 'qrcode.react';

function BoxLabelModal({ show, handleClose, box, generateReference = false }) {
  const labelRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pdfWindowOpened, setPdfWindowOpened] = useState(false);
  
  // Code128 calculation functions
  const getCode128B = () => {
    // Full Code128B character set
    const patterns = {
      ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
      '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
      '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
      ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
      '0': '10011101100', '1': '10011100110', '2': '11001110010', '3': '11001011100',
      '4': '11001001110', '5': '11011100100', '6': '11001110100', '7': '11101101110',
      '8': '11101001100', '9': '11100101100', ':': '11100100110', ';': '11101100100',
      '<': '11100110100', '=': '11100110010', '>': '11011011000', '?': '11011000110',
      '@': '11000110110', 'A': '10100011000', 'B': '10001011000', 'C': '10001000110',
      'D': '10110001000', 'E': '10001101000', 'F': '10001100010', 'G': '11010001000',
      'H': '11000101000', 'I': '11000100010', 'J': '10110111000', 'K': '10110001110',
      'L': '10001101110', 'M': '10111011000', 'N': '10111000110', 'O': '10001110110',
      'P': '11101110110', 'Q': '11010001110', 'R': '11000101110', 'S': '11011101000',
      'T': '11011100010', 'U': '11011101110', 'V': '11101011000', 'W': '11101000110',
      'X': '11100010110', 'Y': '11101101000', 'Z': '11101100010', '[': '11100011010',
      '\\': '11101111010', ']': '11001000010', '^': '11110001010', '_': '10100110000',
      '`': '10100001100', 'a': '10010110000', 'b': '10010000110', 'c': '10000101100',
      'd': '10000100110', 'e': '10110010000', 'f': '10110000100', 'g': '10011010000',
      'h': '10011000010', 'i': '10000110100', 'j': '10000110010', 'k': '11000010010',
      'l': '11001010000', 'm': '11110111010', 'n': '11000010100', 'o': '10001111010',
      'p': '10100111100', 'q': '10010111100', 'r': '10010011110', 's': '10111100100',
      't': '10011110100', 'u': '10011110010', 'v': '11110100100', 'w': '11110010100',
      'x': '11110010010', 'y': '11011011110', 'z': '11011110110', '{': '11110110110',
      '|': '10101111000', '}': '10100011110', '~': '10001011110',
      // Control characters
      FNC1: '10100110010', FNC2: '10010110100', FNC3: '10010110010', FNC4: '10110101000',
      // Special pattern codes
      START_B: '11010010000', STOP: '1100011101011'
    };
    return patterns;
  };
  
  // Function to calculate Code128 checksum
  const calculateChecksum = (value) => {
    const patterns = getCode128B();
    let sum = 104; // START B value
    
    for (let i = 0; i < value.length; i++) {
      const char = value.charAt(i);
      // Get character position in the set (0-based position)
      const charIndex = Object.keys(patterns).indexOf(char);
      if (charIndex !== -1) {
        sum += charIndex * (i + 1);
      }
    }
    
    return sum % 103; // Modulo 103
  };
  
  // Generate full Code128B barcode including checksum and control codes
  const generateCode128 = (value) => {
    const patterns = getCode128B();
    
    // Validate input - only use characters in Code128B charset
    const validChars = Object.keys(patterns).filter(k => 
      k.length === 1 && k !== 'START_B' && k !== 'STOP');
    
    // Keep only valid characters
    const sanitizedValue = value.split('')
      .filter(char => validChars.includes(char))
      .join('');
    
    // Start with START_B pattern
    let bits = patterns.START_B;
    
    // Add pattern for each character
    for (let i = 0; i < sanitizedValue.length; i++) {
      const char = sanitizedValue[i];
      if (patterns[char]) {
        bits += patterns[char];
      }
    }
    
    // Calculate and add checksum
    const checksum = calculateChecksum(sanitizedValue);
    const checksumChar = Object.keys(patterns)[checksum];
    if (patterns[checksumChar]) {
      bits += patterns[checksumChar];
    }
    
    // Add STOP pattern
    bits += patterns.STOP;
    
    // Add quiet zone (10 modules on each side)
    const quietZone = '0'.repeat(10);
    bits = quietZone + bits + quietZone;
    
    return bits;
  };
  
  // Generate SVG for Code128 barcode
  const generateBarcodeSVG = (text, width = 200, height = 50) => {
    // Generate binary pattern
    const binaryPattern = generateCode128(text);
    
    // Calculate dimensions
    const moduleWidth = width / binaryPattern.length;
    
    // Create SVG elements
    let rects = [];
    let xPos = 0;
    let inBar = false;
    let barStart = 0;
    
    // Generate rectangles from binary pattern
    for (let i = 0; i < binaryPattern.length; i++) {
      const bit = binaryPattern[i];
      
      if (bit === '1' && !inBar) {
        // Start of a bar
        inBar = true;
        barStart = xPos;
      } else if ((bit === '0' && inBar) || (bit === '1' && i === binaryPattern.length - 1)) {
        // End of a bar (or last position with a '1')
        inBar = false;
        const barWidth = xPos - barStart;
        if (bit === '1' && i === binaryPattern.length - 1) {
          // If we're ending on a '1', add the last module width
          rects.push(`<rect x="${barStart}" y="0" width="${barWidth + moduleWidth}" height="${height}" fill="black" />`);
        } else {
          rects.push(`<rect x="${barStart}" y="0" width="${barWidth}" height="${height}" fill="black" />`);
        }
      }
      
      xPos += moduleWidth;
    }
    
    // Create complete SVG
    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width="${width}" height="${height}" fill="white" />
        ${rects.join('')}
      </svg>
    `;
    
    return svg;
  };

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    
    // Generate a unique text ID based on box details
    const generateTextId = () => {
      const prefix = 'BOX';
      const boxNum = box.box_number ? box.box_number.toString().padStart(4, '0') : '0000';
      const timestamp = Date.now().toString().slice(-6);
      return `${prefix}-${boxNum}-${timestamp}`;
    };
    
    // IMPORTANT: Only generate new reference if explicitly requested and no existing reference_id
    const textId = box.reference_id || (generateReference ? generateTextId() : null) || generateTextId();
    
    // Format reference ID
    const refCode = textId.substring(textId.length - 6) || Math.floor(Math.random() * 900000 + 100000).toString();
    // If textId doesn't have the BOX- prefix, use the formatted version, otherwise use as-is
    const refFormatted = textId.startsWith('BOX-') ? textId : `BOX-${box.box_number.toString().padStart(4, '0')}-${refCode}`;
    
    // Generate QR code URL with box ID and reference_id for proper linking
    const qrCodeUrl = `http://192.168.155.207:5173/boxes/${box.id}?ref=${textId}`;
    
    // Get current date for the label
    const currentDate = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Create location info HTML
    let locationHtml = '';
    
    if (box.location_name) {
      locationHtml += `
        <div style="display: flex; margin-bottom: 0mm;">
          <div style="font-weight: bold; width: 18mm; flex-shrink: 0;">Location:</div>
          <div>${box.location_name}</div>
        </div>
      `;
    }
    
    if (box.shelf_name) {
      locationHtml += `
        <div style="display: flex; margin-bottom: 0;">
          <div style="font-weight: bold; width: 18mm; flex-shrink: 0;">Shelf:</div>
          <div>${box.shelf_name}</div>
        </div>
      `;
    }
    
    // Create the print content with the label and necessary styling
    const printContent = `
      <html>
        <head>
          <title>Box Label - #${box.box_number}</title>
          <style>
            @page {
              size: 62mm 85mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
            }
            .print-container {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .print-instructions {
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f0f0f0;
              border-radius: 4px;
              font-size: 14px;
            }
            .print-instructions ul {
              margin: 0;
              padding-left: 20px;
            }
            .box-label-container {
              width: 62mm;
              height: 85mm;
              padding: 1.5mm;
              border: 0.2mm solid #000;
              background-color: #fff;
              font-family: Arial, sans-serif;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              margin: 0 auto;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                padding: 0;
              }
              .box-label-container {
                border: 0.2mm solid #000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div>
              <div class="print-instructions no-print">
                <h3>Print Instructions</h3>
                <ul>
                  <li>Choose <strong>Label</strong> or <strong>Sticker</strong> paper format if available</li>
                  <li>Set paper size to <strong>62mm x 85mm</strong> or closest available</li>
                  <li>Disable headers and footers in your browser's print settings</li>
                  <li>Disable "Scale to Fit" for actual size printing</li>
                  <li>Press CTRL+P (or Command+P) to print</li>
                </ul>
              </div>
              <div class="box-label-container">
                <div style="text-align: center; margin-bottom: 2mm; border-bottom: 0.3mm solid #000; padding-bottom: 1mm;">
                  <div style="font-size: 3.5mm; font-weight: bold;">INVENTORY LABEL</div>
                </div>
                
                <div style="text-align: center; margin-bottom: 2mm;">
                  <div style="font-size: 16mm; font-weight: bold; line-height: 0.9;">
                    #${box.box_number}
                  </div>
                </div>
                
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 2mm;">
                  <img id="qrcode" style="width: 28mm; height: 28mm;" alt="Box details QR code" />
                </div>
                
                <div style="text-align: center; font-size: 3mm; margin-bottom: 1mm;">
                  <strong>REF:</strong> ${refFormatted}
                </div>
                
                <div style="text-align: right; font-size: 2.2mm; margin-bottom: 2mm; font-style: italic;">
                  Generated: ${currentDate}
                </div>
                
                <div style="font-size: 3mm; border-top: 0.1mm solid #ddd; padding-top: 1mm; margin-bottom: 0;">
                  ${locationHtml}
                </div>
                
                <div style="font-size: 2mm; text-align: center; margin-top: 1mm; padding-top: 1mm; border-top: 0.1mm solid #ddd; white-space: nowrap; overflow: visible;">
                  IT&nbsp;STOCK&nbsp;EUROPLAC
                </div>
              </div>
            </div>
          </div>
          <script>
            // Render QR code when the window loads
            window.onload = function() {
              try {
                // Set QR code image using a QR code service
                const qrContainer = document.getElementById('qrcode');
                const qrCodeUrl = "${qrCodeUrl}";
                
                // Use a public QR code generation service
                qrContainer.src = "https://api.qrserver.com/v1/create-qr-code/?data=" + 
                  encodeURIComponent(qrCodeUrl) + 
                  "&size=120x120&margin=1&format=svg";
                
                // Small delay to ensure content is rendered including QR code
                setTimeout(function() {
                  window.print();
                }, 1000);
              } catch (e) {
                console.error("Error rendering QR code:", e);
                // Still try to print
                setTimeout(function() {
                  window.print();
                }, 500);
              }
            };
          </script>
        </body>
      </html>
    `;
    
    // Write the content to the new window and trigger print
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };
  
  // Handle save as PDF using the LabelPrinter utility
  const handleSaveAsPDF = async () => {
    if (!box) return;
    
    setIsSaving(true);
    setPdfWindowOpened(false);
    setMessage('Generating PDF...');
    
    try {
      const result = await saveBoxLabelAsPDF(box, {
        filename: `Box-${box.box_number}-Label.pdf`,
        generateReferences: generateReference
      });
      
      if (result.success) {
        setPdfWindowOpened(true);
        setMessage('PDF window opened. Please follow the instructions in the new window to save the PDF.');
        
        // Check if window was closed
        const checkWindowInterval = setInterval(() => {
          if (result.pdfWindow && result.pdfWindow.closed) {
            clearInterval(checkWindowInterval);
            setMessage('PDF window closed. If you need to reopen it, click "Save as PDF" again.');
          }
        }, 1000);
      } else {
        setMessage(`Error: ${result.message || 'Failed to generate PDF'}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-tag me-2"></i>
              Box Label - #{box.box_number}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={handleClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-center mb-3">
              <div ref={labelRef} style={{ width: '62mm', border: '1px solid #ddd' }}>
                <BoxLabel box={box} generateReference={generateReference} />
              </div>
            </div>
            
            {message && (
              <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'} mb-3`}>
                {message}
                {pdfWindowOpened && (
                  <div className="mt-2">
                    <small>
                      <strong>Note:</strong> If your browser blocked the popup, please allow popups for this site and try again.
                    </small>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <div className="d-flex gap-2">
              <button 
                type="button" 
                className="btn btn-outline-secondary"
                onClick={handleSaveAsPDF}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-file-pdf me-1"></i>
                    Save as PDF
                  </>
                )}
              </button>
              <button 
                type="button" 
                className="btn btn-outline-primary"
                onClick={handlePrint}
              >
                <i className="bi bi-printer me-1"></i>
                Print Label
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoxLabelModal; 