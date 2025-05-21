import React, { useState } from 'react';
import { generateLabelPDF, printToBrotherQ820NWB, openPrintDialog, saveBoxLabelAsPDF } from '../utils/LabelPrinter';
import BoxLabel from './BoxLabel';

/**
 * LabelPrinting component - Provides UI for printing box labels
 */
const LabelPrinting = ({ boxes = [] }) => {
  const [selectedBoxes, setSelectedBoxes] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [message, setMessage] = useState('');
  const [copies, setCopies] = useState(1);
  const [generateReferences, setGenerateReferences] = useState(false);
  
  // Toggle box selection
  const toggleBoxSelection = (box) => {
    if (selectedBoxes.some(b => b.id === box.id)) {
      setSelectedBoxes(selectedBoxes.filter(b => b.id !== box.id));
    } else {
      setSelectedBoxes([...selectedBoxes, box]);
    }
  };
  
  // Select all boxes
  const selectAllBoxes = () => {
    if (selectedBoxes.length === boxes.length) {
      setSelectedBoxes([]);
    } else {
      setSelectedBoxes([...boxes]);
    }
  };
  
  // Generate PDF
  const handleGeneratePDF = async () => {
    if (selectedBoxes.length === 0) {
      setMessage('Please select at least one box');
      return;
    }
    
    setIsGeneratingPDF(true);
    setMessage('Generating PDF...');
    
    try {
      const result = await generateLabelPDF(selectedBoxes, {
        generateReferences,
        filename: 'inventory-labels.pdf'
      });
      
      if (result.success) {
        setMessage(`PDF generated successfully with ${selectedBoxes.length} labels`);
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
  const handleSaveSingleLabelAsPDF = async (box) => {
    setIsGeneratingPDF(true);
    setMessage('Generating PDF...');
    
    try {
      const result = await saveBoxLabelAsPDF(box, {
        generateReferences,
        filename: `box-${box.box_number}-label.pdf`
      });
      
      if (result.success) {
        setMessage(`PDF generated successfully for Box #${box.box_number}`);
      } else {
        setMessage(`Error generating PDF: ${result.message}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };
  
  // Print to Brother Q820NWB
  const handlePrintToBrother = async () => {
    if (selectedBoxes.length === 0) {
      setMessage('Please select at least one box');
      return;
    }
    
    setIsPrinting(true);
    setMessage('Sending to printer...');
    
    try {
      const result = await printToBrotherQ820NWB(selectedBoxes, {
        generateReferences,
        copies
      });
      
      if (result.success) {
        setMessage(`Printed ${selectedBoxes.length} labels to Brother Q820NWB`);
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
    if (selectedBoxes.length === 0) {
      setMessage('Please select at least one box');
      return;
    }
    
    setIsPrinting(true);
    setMessage('Opening print dialog...');
    
    try {
      const result = await openPrintDialog(selectedBoxes);
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
    if (selectedBoxes.length === 0) {
      return <div className="empty-preview">Select a box to preview label</div>;
    }
    
    const selectedBox = selectedBoxes[0];
    
    return (
      <div className="label-preview">
        <h3>Label Preview</h3>
        <div className="preview-container" style={{ width: '62mm', margin: '0 auto' }}>
          <BoxLabel box={selectedBox} generateReference={generateReferences} />
        </div>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button 
            onClick={() => handleSaveSingleLabelAsPDF(selectedBox)}
            disabled={isGeneratingPDF}
            style={{ padding: '6px 12px' }}
          >
            {isGeneratingPDF ? 'Generating...' : 'Save as PDF'}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="label-printing-container">
      <h2>Print Inventory Labels</h2>
      <p>Select boxes to print labels for</p>
      
      <div className="box-selection">
        <div className="selection-header">
          <button 
            onClick={selectAllBoxes} 
            className="select-all-button"
          >
            {selectedBoxes.length === boxes.length ? 'Deselect All' : 'Select All'}
          </button>
          <span>{selectedBoxes.length} of {boxes.length} boxes selected</span>
        </div>
        
        <div className="box-list" style={{ maxHeight: '300px', overflowY: 'auto', margin: '10px 0' }}>
          {boxes.map(box => (
            <div 
              key={box.id} 
              className={`box-item ${selectedBoxes.some(b => b.id === box.id) ? 'selected' : ''}`}
              onClick={() => toggleBoxSelection(box)}
              style={{
                padding: '8px',
                border: '1px solid #ddd',
                marginBottom: '4px',
                cursor: 'pointer',
                backgroundColor: selectedBoxes.some(b => b.id === box.id) ? '#f0f7ff' : 'white'
              }}
            >
              <div>Box #{box.box_number}</div>
              <div>{box.location_name} {box.shelf_name ? `- ${box.shelf_name}` : ''}</div>
              {box.description && <div>{box.description}</div>}
            </div>
          ))}
          
          {boxes.length === 0 && (
            <div className="no-boxes">No boxes available</div>
          )}
        </div>
      </div>
      
      <div className="print-options" style={{ margin: '20px 0' }}>
        <h3>Print Options</h3>
        
        <div className="option-row" style={{ margin: '10px 0' }}>
          <label>
            <input
              type="checkbox"
              checked={generateReferences}
              onChange={() => setGenerateReferences(!generateReferences)}
            />
            Generate new reference IDs
          </label>
        </div>
        
        <div className="option-row" style={{ margin: '10px 0' }}>
          <label>
            Copies:
            <input
              type="number"
              min="1"
              max="100"
              value={copies}
              onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
              style={{ marginLeft: '10px', width: '60px' }}
            />
          </label>
        </div>
      </div>
      
      <div className="print-actions" style={{ display: 'flex', gap: '10px', margin: '20px 0' }}>
        <button 
          onClick={handleGeneratePDF} 
          disabled={isGeneratingPDF || selectedBoxes.length === 0}
          style={{ padding: '8px 16px' }}
        >
          {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
        </button>
        
        <button 
          onClick={handlePrintToBrother} 
          disabled={isPrinting || selectedBoxes.length === 0}
          style={{ padding: '8px 16px' }}
        >
          {isPrinting ? 'Printing...' : 'Print to Brother Q820NWB'}
        </button>
        
        <button 
          onClick={handleOpenPrintDialog} 
          disabled={isPrinting || selectedBoxes.length === 0}
          style={{ padding: '8px 16px' }}
        >
          Print (Browser)
        </button>
      </div>
      
      {message && (
        <div className="message" style={{ 
          padding: '10px', 
          margin: '10px 0', 
          backgroundColor: message.includes('Error') ? '#ffebee' : '#e8f5e9',
          border: `1px solid ${message.includes('Error') ? '#ffcdd2' : '#c8e6c9'}`
        }}>
          {message}
        </div>
      )}
      
      <div className="preview-section" style={{ marginTop: '30px' }}>
        {renderPreview()}
      </div>
    </div>
  );
};

export default LabelPrinting; 