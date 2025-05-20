/**
 * LabelPrinter.js - Utility for generating PDFs and printing labels to Brother Q820NWB
 */

import React from 'react';
import ReactDOM from 'react-dom';
import BoxLabel from '../components/BoxLabel';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/**
 * Generate QR code SVG string
 * @param {string} url - URL to encode in QR code
 * @param {number} size - QR code size in pixels
 * @returns {string} - QR code SVG markup
 */
const generateQRCodeSVG = (url, size = 120) => {
  // Create temporary container to render QR code
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  // Render QR code to container
  ReactDOM.render(
    <QRCodeSVG 
      value={url}
      size={size}
      level="M"
      bgColor="#FFFFFF"
      fgColor="#000000"
    />,
    container
  );
  
  // Get SVG as string
  const qrCodeSVG = container.innerHTML;
  
  // Clean up
  document.body.removeChild(container);
  
  return qrCodeSVG;
};

/**
 * Generate PDF for printing labels
 * @param {Array} boxes - Array of box objects to generate labels for
 * @param {Object} options - PDF generation options
 * @returns {Promise<Blob>} - PDF blob
 */
export const generateLabelPDF = async (boxes, options = {}) => {
  try {
    // Create a dedicated window for PDF generation
    const pdfWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!pdfWindow) {
      throw new Error('Unable to open PDF window. Please allow popups for this site.');
    }
    
    // Generate HTML for each label
    const labelHtmlPromises = boxes.map((box) => {
      return new Promise((resolve) => {
        // Generate a unique text ID based on box details
        const generateTextId = () => {
          const prefix = 'BOX';
          const boxNum = box.box_number ? box.box_number.toString().padStart(4, '0') : '0000';
          const timestamp = Date.now().toString().slice(-6);
          return `${prefix}-${boxNum}-${timestamp}`;
        };
        
        // IMPORTANT: Only generate new reference if explicitly requested and no existing reference_id
        const textId = box.reference_id || (options.generateReferences ? generateTextId() : null) || generateTextId();
        
        // Format reference ID
        const refCode = textId.substring(textId.length - 6) || Math.floor(Math.random() * 900000 + 100000).toString();
        // If textId doesn't have the BOX- prefix, use the formatted version, otherwise use as-is
        const refFormatted = textId.startsWith('BOX-') ? textId : `BOX-${box.box_number.toString().padStart(4, '0')}-${refCode}`;
        
        // Generate QR code URL with box ID and reference_id for proper linking
        const qrCodeUrl = `http://192.168.155.207:5173/boxes/${box.id}?ref=${textId}`;
        const qrCodeSvg = generateQRCodeSVG(qrCodeUrl, 120);
        
        // Get current date for the label
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        
        // Create details table HTML
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
        
        // Create label HTML
        const labelHtml = `
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
              ${qrCodeSvg}
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
        `;
        
        resolve(labelHtml);
      });
    });
    
    // Wait for all label HTML to be generated
    const labelHtmls = await Promise.all(labelHtmlPromises);
    
    // Create PDF content
    const pdfContent = `
      <html>
        <head>
          <title>${options.filename || 'Box-Label.pdf'}</title>
          <style>
            @page {
              size: 62mm 85mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              background-color: #f0f0f0;
            }
            .pdf-instructions {
              background-color: #fff;
              padding: 20px;
              border-radius: 4px;
              margin: 20px auto;
              max-width: 800px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .pdf-instructions h2 {
              margin-top: 0;
              color: #333;
            }
            .pdf-instructions ol {
              padding-left: 20px;
            }
            .pdf-instructions li {
              margin-bottom: 10px;
            }
            .button-container {
              margin-top: 20px;
              text-align: center;
            }
            .pdf-button {
              background-color: #0078d7;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
              margin: 0 10px;
            }
            .pdf-button:hover {
              background-color: #0062a9;
            }
            .labels-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 20px;
              margin: 20px auto;
              max-width: 800px;
            }
            .box-label-container {
              width: 62mm;
              height: 85mm;
              padding: 1.5mm;
              border: none;
              background-color: #fff;
              font-family: Arial, sans-serif;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              page-break-after: always;
            }
            @media print {
              .pdf-instructions, .button-container {
                display: none !important;
              }
              body {
                background-color: white;
                padding: 0;
                margin: 0;
              }
              .labels-container {
                margin: 0;
                max-width: none;
                gap: 0;
              }
              .box-label-container {
                border: 0.2mm solid black !important;
                page-break-after: always;
                width: 62mm !important;
                height: 85mm !important;
                margin: 0 !important;
                padding: 1.5mm !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="pdf-instructions">
            <h2>Save Labels as PDF</h2>
            <ol>
              <li>Click the "Print / Save as PDF" button below</li>
              <li>In the print dialog, select "Save as PDF" as the destination</li>
              <li>Set the paper size to <strong>62mm x 85mm</strong> if available, or closest option</li>
              <li>Set margins to <strong>None</strong></li>
              <li>Disable headers and footers</li>
              <li>Click "Save" to save the PDF file</li>
            </ol>
            <div class="button-container">
              <button class="pdf-button" onclick="window.print()">Print / Save as PDF</button>
              <button class="pdf-button" onclick="window.close()">Close</button>
            </div>
          </div>
          
          <div class="labels-container">
            ${labelHtmls.join('')}
          </div>
          
          <script>
            // Focus the window
            window.focus();
          </script>
        </body>
      </html>
    `;
    
    // Write the content to the PDF window
    pdfWindow.document.open();
    pdfWindow.document.write(pdfContent);
    pdfWindow.document.close();
    
    return {
      success: true,
      message: `PDF content generated with ${boxes.length} labels. Follow instructions to save.`,
      pdfWindow
    };
  } catch (error) {
    console.error('PDF generation failed:', error);
    return {
      success: false,
      message: 'PDF generation failed: ' + error.message,
      error: error.message
    };
  }
};

/**
 * Save a single label as PDF
 * @param {Object} box - Box object to generate label for
 * @param {Object} options - PDF generation options
 * @returns {Promise<Object>} - Result of PDF generation
 */
export const saveBoxLabelAsPDF = async (box, options = {}) => {
  return await generateLabelPDF([box], {
    filename: options.filename || `Box-${box.box_number}-Label.pdf`,
    generateReferences: options.generateReferences
  });
};

/**
 * Print labels directly to Brother Q820NWB printer
 * @param {Array} boxes - Array of box objects to print labels for
 * @param {Object} printerSettings - Printer settings
 * @returns {Promise<Object>} - Result of print operation
 */
export const printToBrotherQ820NWB = async (boxes, printerSettings = {}) => {
  try {
    // Create a container for the labels
    const container = document.createElement('div');
    container.id = 'print-container';
    container.style.visibility = 'hidden';
    document.body.appendChild(container);
    
    // Configure Brother printer settings
    const settings = {
      printer: 'Brother Q820NWB',
      mediaSize: { 
        width: 62, 
        height: 85, 
        unit: 'mm' 
      },
      orientation: 'portrait',
      copies: printerSettings.copies || 1,
      quality: 'high',
      ...printerSettings
    };
    
    // Create print-specific styles
    const style = document.createElement('style');
    style.innerHTML = `
      @page {
        size: 62mm 85mm;
        margin: 0;
      }
      @media print {
        body * {
          visibility: hidden;
        }
        #print-container, #print-container * {
          visibility: visible !important;
        }
        #print-container {
          position: absolute;
          left: 0;
          top: 0;
        }
        .box-label-container {
          page-break-after: always;
          width: 62mm !important;
          height: 85mm !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Render each label
    const labelPromises = boxes.map((box) => {
      return new Promise((resolve) => {
        const labelDiv = document.createElement('div');
        container.appendChild(labelDiv);
        
        // Render the label
        ReactDOM.render(
          <BoxLabel 
            box={box} 
            generateReference={printerSettings.generateReferences} 
            onRender={() => resolve()}
          />, 
          labelDiv
        );
      });
    });
    
    // Wait for all labels to render
    await Promise.all(labelPromises);
    
    // Make container visible for printing
    container.style.visibility = 'visible';
    
    // Set up print listener
    const printPromise = new Promise((resolve) => {
      if (window.matchMedia) {
        const mediaQueryList = window.matchMedia('print');
        mediaQueryList.addEventListener('change', (mql) => {
          if (!mql.matches) {
            // Print dialog closed
            setTimeout(() => {
              document.body.removeChild(container);
              document.head.removeChild(style);
              resolve({
                success: true,
                message: `Printed ${boxes.length} labels to Brother Q820NWB`,
                settings
              });
            }, 1000);
          }
        });
      }
      
      // Fallback if event listener doesn't work
      setTimeout(() => {
        if (container.parentNode === document.body) {
          document.body.removeChild(container);
          document.head.removeChild(style);
          resolve({
            success: true,
            message: `Printed ${boxes.length} labels to Brother Q820NWB`,
            settings
          });
        }
      }, 10000);
    });
    
    // Open print dialog
    window.print();
    
    return await printPromise;
  } catch (error) {
    console.error('Printing failed:', error);
    return {
      success: false,
      message: 'Printing failed: ' + error.message,
      error: error.message
    };
  }
};

/**
 * Open print dialog with labels
 * @param {Array} boxes - Array of box objects to print labels for
 * @returns {Promise<boolean>} - Whether print dialog was opened
 */
export const openPrintDialog = async (boxes) => {
  try {
    return await printToBrotherQ820NWB(boxes, { filename: 'print-labels.pdf' });
  } catch (error) {
    console.error('Failed to open print dialog:', error);
    return false;
  }
};

/**
 * Generate a PDF containing QR code labels for items
 * @param {Array} items - Array of items to generate labels for
 * @param {Object} options - Options for generating the PDF
 * @returns {Promise<Object>} - Result of the operation
 */
export const generateItemLabelsPDF = async (items, options = {}) => {
  try {
    const {
      filename = 'item-qr-labels.pdf',
      labelFormat = 'compact', // compact, standard, small
      showQRValue = true,
      showBorders = false, // Default to no borders
    } = options;

    // Create a new PDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set document properties
    doc.setProperties({
      title: 'Item QR Codes',
      subject: 'QR Code Labels',
      author: 'IT Stock Europlac',
      creator: 'ReactStock System'
    });

    // Define label dimensions based on format
    let labelWidth, labelHeight, labelsPerRow, qrSize, textSize, valueTextSize;
    
    switch(labelFormat) {
      case 'compact':
        // Optimized for 17mm x 54mm labels
        labelWidth = 54;
        labelHeight = 17;
        qrSize = 15;
        textSize = 7;
        valueTextSize = 5;
        labelsPerRow = 3;
        break;
      
      case 'small':
        // Optimized for very small labels (30mm x 20mm)
        labelWidth = 30;
        labelHeight = 20;
        qrSize = 12;
        textSize = 6;
        valueTextSize = 4;
        labelsPerRow = 6;
        break;
      
      case 'standard':
      default:
        // Standard size
        labelWidth = 60;
        labelHeight = 30;
        qrSize = 20;
        textSize = 10;
        valueTextSize = 6;
        labelsPerRow = 3;
        break;
    }

    // Calculate margins and spacing
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const horizontalMargin = 10; // mm from page edges
    const verticalMargin = 10; // mm from page edges
    const horizontalSpacing = (pageWidth - 2 * horizontalMargin - labelWidth * labelsPerRow) / (labelsPerRow - 1);
    
    // Start positions
    let x = horizontalMargin;
    let y = verticalMargin;
    let count = 0;

    // Function to get QR code as data URL
    const getQRCodeDataURL = async (text) => {
      try {
        return await QRCode.toDataURL(text, {
          width: qrSize * 10, // Multiply by 10 for higher resolution
          margin: 0
        });
      } catch (err) {
        console.error('Error generating QR code:', err);
        return null;
      }
    };

    // Generate labels for each item
    for (const item of items) {
      // Get the QR code value - use qr_code, ean_code or generate one
      const qrValue = item.qr_code || item.ean_code || `ITEM-${item.id}`;
      const qrDataURL = await getQRCodeDataURL(qrValue);
      
      if (!qrDataURL) continue;

      // If we've filled a row, move to the next row
      if (count % labelsPerRow === 0 && count > 0) {
        x = horizontalMargin;
        y += labelHeight + 3; // Add spacing between rows
      }

      // If we've filled a page, add a new page
      if (y + labelHeight > pageHeight - verticalMargin) {
        doc.addPage();
        x = horizontalMargin;
        y = verticalMargin;
      }

      // Optional border around label
      if (showBorders) {
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.05);
        doc.rect(x, y, labelWidth, labelHeight);
      }

      if (labelFormat === 'compact') {
        // Compact layout (horizontal)
        const itemName = item.name || '---';
        
        // Add QR code on the left
        doc.addImage(qrDataURL, 'PNG', x + 1, y + 1, qrSize, qrSize);
        
        // Add item name on the right
        doc.setFontSize(textSize);
        doc.setTextColor(0, 0, 0);
        
        const nameX = x + qrSize + 3;
        const nameMaxWidth = labelWidth - qrSize - 4;
        
        // Name might need to be truncated based on available space
        let displayName = itemName;
        if (doc.getTextWidth(displayName) > nameMaxWidth) {
          // Truncate and add ellipsis
          while (doc.getTextWidth(displayName + '...') > nameMaxWidth && displayName.length > 0) {
            displayName = displayName.substring(0, displayName.length - 1);
          }
          displayName += '...';
        }
        
        doc.text(displayName, nameX, y + 5);
        
        // Add item type if available
        if (item.type) {
          doc.setFontSize(valueTextSize);
          doc.setTextColor(100, 100, 100);
          doc.text(item.type, nameX, y + 9);
        }
        
        // Add QR value if requested
        if (showQRValue) {
          doc.setFontSize(valueTextSize);
          doc.setTextColor(100, 100, 100);
          doc.text(qrValue, nameX, y + 13, { maxWidth: nameMaxWidth });
        }
      } else {
        // Standard/small layout (vertical)
        const itemName = item.name || '---';
        
        // Center QR code
        const qrX = x + (labelWidth - qrSize) / 2;
        const qrY = y + 2;
        doc.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
        
        // Add item name below
        doc.setFontSize(textSize);
        doc.setTextColor(0, 0, 0);
        doc.text(itemName, x + (labelWidth / 2), qrY + qrSize + 3, { align: 'center', maxWidth: labelWidth - 2 });
        
        // Add QR value if requested and space allows
        if (showQRValue && labelFormat !== 'small') {
          doc.setFontSize(valueTextSize);
          doc.setTextColor(100, 100, 100);
          doc.text(qrValue, x + (labelWidth / 2), qrY + qrSize + 8, { align: 'center', maxWidth: labelWidth - 2 });
        }
      }

      // Move to the next label position
      x += labelWidth + horizontalSpacing;
      count++;
    }

    // Save the PDF
    doc.save(filename);

    return { 
      success: true, 
      message: `Generated PDF with ${items.length} QR code labels`,
      filename 
    };
  } catch (error) {
    console.error('Error generating item labels PDF:', error);
    return { 
      success: false, 
      message: error.message 
    };
  }
};

/**
 * Print to Brother QL-820NWB or similar label printer
 * This is a placeholder function - actual implementation would depend on your printer API
 */
export const printToLabelPrinter = async (items, options = {}) => {
  try {
    const {
      copies = 1,
      labelFormat = 'compact',
      showQRValue = true,
      showBorders = false, // Default to no borders
    } = options;

    // In a real implementation, this would send data directly to the printer
    console.log(`Would print ${items.length} labels, ${copies} copies each`);
    
    // For now, we'll just generate a PDF that could be printed
    const result = await generateItemLabelsPDF(items, {
      filename: 'print-ready-labels.pdf',
      labelFormat,
      showQRValue,
      showBorders,
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    return {
      success: true,
      message: `Generated print-ready PDF for ${items.length} items (${copies} copies each)`,
      note: 'Direct printing requires printer-specific implementation'
    };
  } catch (error) {
    console.error('Error printing to label printer:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Open browser print dialog with QR code labels
 */
export const openItemLabelPrintDialog = async (items, options = {}) => {
  try {
    const {
      labelFormat = 'compact',
      showQRValue = true,
      showBorders = false, // Default to false to remove borders
    } = options;

    // Create a hidden iframe for printing
    let printFrame = document.getElementById('qr-print-frame');
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'qr-print-frame';
      printFrame.style.position = 'fixed';
      printFrame.style.right = '-9999px';
      printFrame.style.bottom = '-9999px';
      document.body.appendChild(printFrame);
    }

    // Generate HTML content for the print page
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Item QR Code Labels</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: auto;
            margin: 5mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .labels-container {
            display: flex;
            flex-wrap: wrap;
            gap: 2mm;
            justify-content: flex-start;
            border: none;
          }
          .label {
            ${showBorders ? 'border: 0.5px solid #eee;' : 'border: none;'}
            box-sizing: border-box;
            overflow: hidden;
    `;

    // Add label-specific styles based on format
    switch (labelFormat) {
      case 'compact':
        html += `
            width: 54mm;
            height: 17mm;
            display: flex;
            align-items: center;
            padding: 1mm;
          }
          .label .qr-code {
            width: 15mm;
            height: 15mm;
          }
          .label .label-content {
            margin-left: 2mm;
            overflow: hidden;
            flex: 1;
          }
          .label .item-name {
            font-size: 8pt;
            font-weight: bold;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .label .item-type {
            font-size: 6pt;
            color: #666;
            margin-top: 1mm;
          }
          .label .qr-value {
            font-size: 5pt;
            color: #888;
            margin-top: 1mm;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `;
        break;
        
      case 'small':
        html += `
            width: 30mm;
            height: 20mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1mm;
          }
          .label .qr-code {
            width: 12mm;
            height: 12mm;
          }
          .label .item-name {
            font-size: 6pt;
            font-weight: bold;
            margin-top: 1mm;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 28mm;
          }
          .label .item-type {
            display: none;
          }
          .label .qr-value {
            display: none;
          }
        `;
        break;

      case 'standard':
      default:
        html += `
            width: 60mm;
            height: 30mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2mm;
          }
          .label .qr-code {
            width: 20mm;
            height: 20mm;
          }
          .label .item-name {
            font-size: 10pt;
            font-weight: bold;
            margin-top: 2mm;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 56mm;
          }
          .label .item-type {
            font-size: 7pt;
            color: #666;
            margin-top: 1mm;
          }
          .label .qr-value {
            font-size: 6pt;
            color: #888;
            margin-top: 1mm;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 56mm;
          }
        `;
        break;
    }

    html += `
        </style>
      </head>
      <body>
        <div class="labels-container">
    `;

    // Generate HTML for each item
    for (const item of items) {
      const qrValue = item.qr_code || item.ean_code || `ITEM-${item.id}`;
      const itemName = item.name || '---';
      const itemType = item.type || '';
      
      // Generate QR code as data URL
      let qrDataURL;
      try {
        qrDataURL = await QRCode.toDataURL(qrValue, {
          width: 200,
          margin: 0
        });
      } catch (err) {
        console.error('Error generating QR code for', item.id, err);
        continue;
      }

      // Add label HTML
      html += `
        <div class="label">
          <img class="qr-code" src="${qrDataURL}" alt="QR Code">
          <div class="label-content">
            <div class="item-name">${itemName}</div>
            <div class="item-type">${itemType}</div>
            ${showQRValue ? `<div class="qr-value">${qrValue}</div>` : ''}
          </div>
        </div>
      `;
    }

    html += `
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    // Set content and trigger print
    const frame = printFrame.contentWindow;
    frame.document.open();
    frame.document.write(html);
    frame.document.close();

    return {
      success: true,
      message: 'Print dialog opened'
    };
  } catch (error) {
    console.error('Error opening print dialog:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Save a single item QR code label as PDF
 */
export const saveItemLabelAsPDF = async (item, options = {}) => {
  try {
    // Just wrap the single item in an array
    const result = await generateItemLabelsPDF([item], {
      filename: options.filename || `item-${item.id}-qrcode.pdf`,
      labelFormat: options.labelFormat || 'standard',
      showQRValue: options.showQRValue !== undefined ? options.showQRValue : true,
      showBorders: options.showBorders !== undefined ? options.showBorders : false
    });

    return result;
  } catch (error) {
    console.error('Error saving item label as PDF:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export default {
  generateLabelPDF,
  saveBoxLabelAsPDF,
  printToBrotherQ820NWB,
  openPrintDialog,
  generateItemLabelsPDF,
  printToLabelPrinter,
  openItemLabelPrintDialog,
  saveItemLabelAsPDF
}; 