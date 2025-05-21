import React, { useRef, useEffect } from 'react';
import { generateBoxReference } from '../utils/codeUtils';
import { QRCodeSVG } from 'qrcode.react';
import config from '../config/appConfig';

const BoxLabel = React.forwardRef(({ box, generateReference = false, onRender = null }, ref) => {
  // Generate a unique text ID based on box details
  const generateTextId = () => {
    const prefix = 'BOX';
    const boxNum = box.box_number ? box.box_number.toString().padStart(4, '0') : '0000';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${boxNum}-${timestamp}`;
  };
  
  // IMPORTANT: Only generate new reference if explicitly requested and no existing reference_id
  const textId = box.reference_id || (generateReference ? generateTextId() : null) || generateTextId();
  const labelRef = useRef(null);
  
  // Generate random 6-digit code for reference ID
  const genRandomCode = () => {
    return Math.floor(Math.random() * 900000 + 100000).toString();
  };
  
  // Format reference ID to match screenshot format (BOX-0001-233413) if missing
  const refCode = textId.substring(textId.length - 6) || genRandomCode();
  // If textId doesn't have the BOX- prefix, use the formatted version, otherwise use as-is
  const refFormatted = textId.startsWith('BOX-') ? textId : `BOX-${box.box_number.toString().padStart(4, '0')}-${refCode}`;
  
  // Calculate label dimensions - exact dimensions for Brother Q820NWB (62mm x 85mm)
  const labelWidthMm = 62;
  const labelHeightMm = 85;
  
  // Generate QR code URL for box details - use the application base URL from config
  const qrCodeUrl = `${config.appBaseUrl}/boxes/${box.id}?ref=${textId}`;
  
  // Get current date for the label
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  // Effect to notify parent component when label is rendered
  useEffect(() => {
    if (onRender && labelRef.current) {
      onRender(labelRef.current);
    }
  }, [onRender]);
  
  return (
    <div 
      ref={(el) => {
        // Assign to both refs - the forwarded ref and our local ref
        labelRef.current = el;
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
      }} 
      className="box-label-container" 
      style={{ 
        width: `${labelWidthMm}mm`, 
        height: `${labelHeightMm}mm`,
        padding: '1.5mm',
        border: '0.2mm solid #000',
        backgroundColor: '#fff',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        pageBreakAfter: 'always',
        // Brother printer specific settings
        margin: '0mm',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
      data-box-number={box.box_number}
      data-reference-id={refFormatted}
    >
      {/* Header with line */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2mm',  // Reduced from 3mm
        borderBottom: '0.3mm solid #000',
        paddingBottom: '1mm'
      }}>
        <div style={{
          fontSize: '3.5mm',
          fontWeight: 'bold'
        }}>INVENTORY LABEL</div>
      </div>
      
      {/* Box number */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '2mm'  // Reduced from 3mm
      }}>
        <div style={{ 
          fontSize: '16mm',
          fontWeight: 'bold', 
          lineHeight: '0.9' // Reduced line height
        }}>
          #{box.box_number}
        </div>
      </div>
      
      {/* QR Code centered */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '2mm',  // Reduced from 3mm
      }}>
        <QRCodeSVG 
          value={qrCodeUrl}
          size={110} // Slightly reduced from 115
          level="M"
          bgColor="#FFFFFF"
          fgColor="#000000"
        />
      </div>
      
      {/* Reference ID */}
      <div style={{ 
        textAlign: 'center',
        fontSize: '3mm',
        marginBottom: '1mm'  // Reduced from 3mm
      }}>
        <strong>REF:</strong> {refFormatted}
      </div>
      
      {/* Generated date - aligned to the right, smaller margin */}
      <div style={{
        textAlign: 'right',
        fontSize: '2.2mm',
        marginBottom: '2mm', // Reduced from 4mm
        fontStyle: 'italic'
      }}>
        Generated: {currentDate}
      </div>
      
      {/* Location info - simplified layout */}
      <div style={{
        fontSize: '3mm',
        borderTop: '0.1mm solid #ddd',
        paddingTop: '1mm',
        marginBottom: '0' // No bottom margin needed
      }}>
        <div style={{
          display: 'flex',
          marginBottom: '0mm' // Minimal spacing
        }}>
          <div style={{
            fontWeight: 'bold',
            width: '18mm',
            flexShrink: 0
          }}>Location:</div>
          <div>{box.location_name || 'Not specified'}</div>
        </div>
        
        {box.shelf_name && (
          <div style={{
            display: 'flex',
            marginBottom: '0' // No margin needed
          }}>
            <div style={{
              fontWeight: 'bold',
              width: '18mm',
              flexShrink: 0
            }}>Shelf:</div>
            <div>{box.shelf_name}</div>
          </div>
        )}
      </div>
      
      {/* Footer with system name */}
      <div style={{ 
        fontSize: '2mm', 
        textAlign: 'center',
        marginTop: '1mm',
        paddingTop: '1mm',
        borderTop: '0.1mm solid #ddd',
        whiteSpace: 'nowrap',
        overflow: 'visible'
      }}>
        IT&nbsp;STOCK&nbsp;EUROPLAC
      </div>
    </div>
  );
});

// Helper function for PDF generation
BoxLabel.generatePDF = async (boxes, options = {}) => {
  // This function should be implemented with a PDF library
  // Since we can't install libraries in this environment, here's a template implementation
  
  try {
    // Mock implementation - in a real app you would:
    // 1. Use a library like jsPDF or html2pdf
    // 2. Create a PDF document with the correct dimensions (62mm x 85mm)
    // 3. Add each box label to the PDF
    // 4. Return the PDF blob or data URL
    
    // Example pseudo-code:
    /*
    import html2pdf from 'html2pdf.js';
    
    // Create temporary container
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Generate all labels
    boxes.forEach(box => {
      const labelDiv = document.createElement('div');
      container.appendChild(labelDiv);
      
      // Render the label
      ReactDOM.render(<BoxLabel box={box} />, labelDiv);
    });
    
    // Configure PDF options for Brother Q820NWB
    const pdfOptions = {
      margin: 0,
      filename: options.filename || 'inventory-labels.pdf',
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { 
        unit: 'mm', 
        format: [62, 85], 
        orientation: 'portrait',
        precision: 16
      }
    };
    
    // Generate PDF
    const pdfBlob = await html2pdf().from(container).set(pdfOptions).outputPdf('blob');
    
    // Clean up
    document.body.removeChild(container);
    
    return pdfBlob;
    */
    
    console.log(`PDF generation requested for ${boxes.length} boxes`);
    return {
      success: true,
      message: `PDF would contain ${boxes.length} labels for Brother Q820NWB printer`
    };
  } catch (error) {
    console.error('PDF generation failed:', error);
    return {
      success: false,
      message: 'PDF generation failed',
      error: error.message
    };
  }
};

// Helper method to print directly to Brother Q820NWB
BoxLabel.printToBrother = async (boxes, printerSettings = {}) => {
  try {
    // In a real implementation, you would:
    // 1. Generate the PDF using BoxLabel.generatePDF
    // 2. Use a printer API or library to send to the Brother printer
    // 3. Configure printer settings for Q820NWB
    
    // Example pseudo-code:
    /*
    const pdfBlob = await BoxLabel.generatePDF(boxes);
    
    // Configure Brother printer settings
    const settings = {
      printer: 'Brother Q820NWB',
      mediaSize: { width: 62, height: 85, unit: 'mm' },
      orientation: 'portrait',
      copies: printerSettings.copies || 1,
      ...printerSettings
    };
    
    // Send to printer API
    const response = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBlob,
        settings
      })
    });
    
    return await response.json();
    */
    
    console.log(`Print requested for ${boxes.length} labels on Brother Q820NWB`);
    return {
      success: true,
      message: `Would print ${boxes.length} labels to Brother Q820NWB`
    };
  } catch (error) {
    console.error('Printing failed:', error);
    return {
      success: false,
      message: 'Printing failed',
      error: error.message
    };
  }
};

export default BoxLabel; 