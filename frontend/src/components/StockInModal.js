import React, { useState, useEffect, useRef } from 'react';
import { getItems, getBoxes, stockIn, getBoxById } from '../services/api';
import api from '../services/api'; // Import the full API service
import BarcodeScannerModal from './BarcodeScannerModal';
import webSocketService from '../services/webSocketService';
import { QRCodeSVG } from 'qrcode.react'; // Import QRCodeSVG component
import { generateUniqueQRValue, isValidQRFormat } from '../utils/qrCodeGenerator'; // Import QR code generator
import codeSyncService from '../services/codeSync'; // Import code sync service

function StockInModal({ 
  show, 
  handleClose, 
  onSuccess, 
  preselectedItemId = null, 
  preselectedBoxId = null, 
  newItemMode = false 
}) {
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form states
  const [itemType, setItemType] = useState(newItemMode ? 'new' : 'existing'); // 'existing' or 'new'
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [boxId, setBoxId] = useState('');
  const [notes, setNotes] = useState('');
  const [supplier, setSupplier] = useState('');
  
  // Box scanning functionality
  const [boxScanInput, setBoxScanInput] = useState('');
  const [scannedBoxId, setScannedBoxId] = useState(null);
  const [scannedBoxNumber, setScannedBoxNumber] = useState('');
  
  // New item fields
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemTypeValue, setItemTypeValue] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [isSubitem, setIsSubitem] = useState(false);
  const [parentItemId, setParentItemId] = useState('');
  const [eanCode, setEanCode] = useState('');
  const [generatedReferenceCode, setGeneratedReferenceCode] = useState('');
  const [labelFormat, setLabelFormat] = useState('compact');
  
  // Search filter for existing items
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  // State for form data
  const [formData, setFormData] = useState({
    item_id: preselectedItemId || '',
    item_name: '',
    description: '',
    type: '',
    serial_number: '',
    quantity: 1,
    box_id: preselectedBoxId || '',
    notes: '',
    supplier: ''
  });

  // Add state for barcode scanner
  const [showBoxScanner, setShowBoxScanner] = useState(false);
  const [showEanScanner, setShowEanScanner] = useState(false);
  const [showSerialScanner, setShowSerialScanner] = useState(false);
  
  // Ref for search item input field
  const searchItemRef = useRef(null);

  // Generate a random reference code for items
  const generateReferenceCode = () => {
    // If we're in existing item mode, check if the selected item already has a QR code or EAN
    if (itemType === 'existing' && selectedItemId) {
      const selectedItem = getSelectedItem();
      if (selectedItem) {
        let existingQRFound = false;
        
        // Check all possible fields that might contain a QR code
        // 1. Check EAN code field
        const existingEan = getItemEanCode(selectedItem);
        if (existingEan && isValidQRFormat(existingEan)) {
          console.log('Reusing existing QR code from EAN field:', existingEan);
          setGeneratedReferenceCode(existingEan);
          return existingEan;
        }
        
        // 2. Check reference_id field
        if (selectedItem.reference_id && isValidQRFormat(selectedItem.reference_id)) {
          console.log('Reusing existing QR code from reference_id field:', selectedItem.reference_id);
          setGeneratedReferenceCode(selectedItem.reference_id);
          return selectedItem.reference_id;
        }
        
        // 3. Check qr_code field
        if (selectedItem.qr_code && isValidQRFormat(selectedItem.qr_code)) {
          console.log('Reusing existing QR code from qr_code field:', selectedItem.qr_code);
          setGeneratedReferenceCode(selectedItem.qr_code);
          return selectedItem.qr_code;
        }
        
        // 4. Check localStorage for any stored QR code for this item
        try {
          const storedItem = localStorage.getItem(`item_${selectedItem.id}_details`);
          if (storedItem) {
            const parsedItem = JSON.parse(storedItem);
            if (parsedItem.qr_code && isValidQRFormat(parsedItem.qr_code)) {
              console.log('Reusing existing QR code from localStorage:', parsedItem.qr_code);
              setGeneratedReferenceCode(parsedItem.qr_code);
              return parsedItem.qr_code;
            }
          }
        } catch (err) {
          console.error('Error reading QR code from localStorage:', err);
        }
      }
    }
    
    // If we get here, no existing QR code was found, so generate a new one
    console.log('Generating new QR code');
    const newCode = generateUniqueQRValue(itemType === 'existing' ? selectedItemId : null);
    setGeneratedReferenceCode(newCode);
    
    // If we're working with an existing item, save the new code to both localStorage and database
    if (itemType === 'existing' && selectedItemId) {
      console.log('Syncing new QR code to database for item:', selectedItemId);
      codeSyncService.storeItemCode(selectedItemId, newCode, newCode)
        .then(() => {
          console.log('New QR code successfully synced to database');
        })
        .catch(err => {
          console.error('Failed to sync new QR code to database:', err);
        });
    }
    
    return newCode;
  };
  
  // Print QR code
  const printQRCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print QR codes');
      return;
    }
    
    // Get QR code element
    const qrCodeEl = document.getElementById('item-qr-code');
    if (!qrCodeEl) {
      alert('QR code element not found');
      return;
    }
    
    // Convert SVG to image URL
    const svgData = new XMLSerializer().serializeToString(qrCodeEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const imgUrl = URL.createObjectURL(svgBlob);
    
    // Create HTML with the image
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code for ${itemName || 'New Item'}</title>
          <style>
            body { font-family: Arial; margin: 0; padding: 10mm; text-align: center; }
            .qr-container { display: inline-block; margin: 0 auto; }
            .item-name { font-size: 14px; font-weight: bold; margin-top: 8px; }
            .qr-value { font-size: 10px; color: #666; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${imgUrl}" width="180" height="180" />
            <div class="item-name">${itemName || 'New Item'}</div>
            <div class="qr-value">${generatedReferenceCode}</div>
          </div>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Method to ensure clean exit from the modal
  const safeClose = () => {
    // Reset form and state before closing
    setError(null);
    setSubmitting(false);
    
    // Call the parent component's close handler
    if (typeof handleClose === 'function') {
      handleClose();
    }
  };

  // Effect to initialize the form when the modal is shown
  useEffect(() => {
    if (show) {
      fetchBoxes();
      fetchItems();
      resetForm();
      
      // Set item type based on newItemMode prop
      // If newItemMode is true, show "New Item" tab, otherwise show "Existing Item" tab
      setItemType(newItemMode ? 'new' : 'existing');
      
      // Check for existing QR code when modal opens
      const checkForExistingQRCode = async () => {
        // If we're in existing item mode and have a preselected item
        if (!newItemMode && preselectedItemId) {
          // Wait a moment to ensure items are loaded
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const item = items.find(i => i.id === preselectedItemId);
          if (item) {
            // Check all possible locations for a QR code
            // 1. Check EAN code field
            const existingEan = getItemEanCode(item);
            if (existingEan && isValidQRFormat(existingEan)) {
              console.log('Found existing QR code in EAN field:', existingEan);
              setGeneratedReferenceCode(existingEan);
              return;
            }
            
            // 2. Check reference_id field
            if (item.reference_id && isValidQRFormat(item.reference_id)) {
              console.log('Found existing QR code in reference_id field:', item.reference_id);
              setGeneratedReferenceCode(item.reference_id);
              return;
            }
            
            // 3. Check qr_code field
            if (item.qr_code && isValidQRFormat(item.qr_code)) {
              console.log('Found existing QR code in qr_code field:', item.qr_code);
              setGeneratedReferenceCode(item.qr_code);
              return;
            }
            
            // 4. Check localStorage
            try {
              const storedItem = localStorage.getItem(`item_${item.id}_details`);
              if (storedItem) {
                const parsedItem = JSON.parse(storedItem);
                if (parsedItem.qr_code && isValidQRFormat(parsedItem.qr_code)) {
                  console.log('Found existing QR code in localStorage:', parsedItem.qr_code);
                  setGeneratedReferenceCode(parsedItem.qr_code);
                  return;
                }
              }
            } catch (err) {
              console.error('Error reading QR code from localStorage:', err);
            }
            
            // If no existing QR code found, generate a new one for this item
            console.log('No existing QR code found, generating a new one');
            const newCode = generateUniqueQRValue(preselectedItemId);
            setGeneratedReferenceCode(newCode);
          }
        } else if (newItemMode || itemType === 'new') {
          // For new items, always generate a new reference code
          generateReferenceCode();
        }
      };
      
      checkForExistingQRCode();
    }
  }, [show, newItemMode]);

  // Separate effect to handle preselected values
  useEffect(() => {
    if (show) {
      console.log('Setting preselected values:', { preselectedItemId, preselectedBoxId });
      
      if (preselectedItemId) {
        setItemType('existing');
        setSelectedItemId(preselectedItemId);
      }
      
      if (preselectedBoxId) {
        console.log('Setting box ID to:', preselectedBoxId);
        setBoxId(preselectedBoxId);
        setScannedBoxId(preselectedBoxId);
        
        // Find box number for the preselected box ID
        fetchBoxes().then((boxesData) => {
          const selectedBox = boxesData.find(box => box.id === parseInt(preselectedBoxId) || box.id === preselectedBoxId);
          if (selectedBox) {
            console.log('Found box number:', selectedBox.box_number);
            setScannedBoxNumber(selectedBox.box_number);
          } else {
            console.warn(`Box with ID ${preselectedBoxId} not found in boxes data`);
            
            // Try to fetch the specific box directly if not found in the list
            getBoxById(preselectedBoxId)
              .then(response => {
                if (response.data && response.data.box_number) {
                  console.log('Retrieved box number from direct API call:', response.data.box_number);
                  setScannedBoxNumber(response.data.box_number);
                }
              })
              .catch(err => {
                console.error('Error fetching specific box details:', err);
              });
          }
        });
        
        // Also fetch items for this box
        fetchItems(preselectedBoxId).then(() => {
          // Focus on the search item input field after a short delay
          setTimeout(() => {
            if (searchItemRef.current && itemType === 'existing') {
              searchItemRef.current.focus();
            }
          }, 300);
        });
      }
    }
  }, [show, preselectedItemId, preselectedBoxId]);
  
  // Handle box scan input
  const handleBoxScan = (e) => {
    e.preventDefault();
    
    if (!boxScanInput.trim()) {
      return;
    }
    
    // Parse the box reference ID
    // Format is typically BOX-XXXX-XXXXXX where XXXX is the box number
    const boxScanValue = boxScanInput.trim();
    
    // Check if input is a direct box number
    const directBoxNumber = boxes.find(box => box.box_number === boxScanValue);
    if (directBoxNumber) {
      setScannedBoxId(directBoxNumber.id);
      setScannedBoxNumber(directBoxNumber.box_number);
      setBoxId(directBoxNumber.id);
      
      // Filter items to only show items in this box
      fetchItems(directBoxNumber.id)
        .then(boxItems => {
          console.log(`Box #${directBoxNumber.box_number} contains ${boxItems.length} items`);
          
          // If there's only one item in the box, auto-select it
          if (boxItems.length === 1 && itemType === 'existing') {
            setSelectedItemId(boxItems[0].id);
          }
          // Clear any search term to show all items in the box
          setSearchTerm('');
          
          // Focus on the search item input field
          setTimeout(() => {
            if (searchItemRef.current && itemType === 'existing') {
              searchItemRef.current.focus();
            }
          }, 100);
        });
      
      setBoxScanInput('');
      return;
    }
    
    // Check if it's a reference ID format (BOX-XXXX-XXXXXX)
    const boxRefMatch = boxScanValue.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
    if (boxRefMatch) {
      const boxNumber = boxRefMatch[1].replace(/^0+/, ''); // Remove leading zeros
      
      // Find the box with this number
      const matchedBox = boxes.find(box => 
        box.box_number === boxNumber || 
        box.box_number.endsWith(boxNumber)
      );
      
      if (matchedBox) {
        setScannedBoxId(matchedBox.id);
        setScannedBoxNumber(matchedBox.box_number);
        setBoxId(matchedBox.id);
        
        // Filter items to only show items in this box
        fetchItems(matchedBox.id)
          .then(boxItems => {
            console.log(`Box #${matchedBox.box_number} contains ${boxItems.length} items`);
            
            // If there's only one item in the box, auto-select it
            if (boxItems.length === 1 && itemType === 'existing') {
              setSelectedItemId(boxItems[0].id);
            }
            // Clear any search term to show all items in the box
            setSearchTerm('');
            
            // Focus on the search item input field
            setTimeout(() => {
              if (searchItemRef.current && itemType === 'existing') {
                searchItemRef.current.focus();
              }
            }, 100);
          });
        
        setBoxScanInput('');
        return;
      }
    }
    
    // If no match found
    setError(`Box not found for scan value: ${boxScanValue}`);
    setTimeout(() => setError(''), 3000);
    setBoxScanInput('');
  };
  
  // Clear scanned box filter
  const clearScannedBox = () => {
    setScannedBoxId(null);
    setScannedBoxNumber('');
    setBoxId('');
    fetchItems(); // Reset to show all items
  };

  useEffect(() => {
    if (items.length > 0 && searchTerm) {
      // Check if searchTerm starts with $ (indicating an EAN code search)
      const isEanSearch = searchTerm.startsWith('$');
      const cleanSearchTerm = isEanSearch ? searchTerm.substring(1) : searchTerm;

      const filtered = items.filter(item => 
        item.name?.toLowerCase().includes(cleanSearchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(cleanSearchTerm.toLowerCase())) ||
        (item.serial_number && item.serial_number.toLowerCase().includes(cleanSearchTerm.toLowerCase())) ||
        (item.type && item.type.toLowerCase().includes(cleanSearchTerm.toLowerCase())) ||
        // Add EAN code search - check both database and localStorage
        (item.ean_code && item.ean_code.toLowerCase() === cleanSearchTerm.toLowerCase()) ||
        // Try to get EAN code from localStorage for this item
        getItemEanCode(item)?.toLowerCase() === cleanSearchTerm.toLowerCase()
      );
      setFilteredItems(filtered);
      
      // Auto-select item if we have a match
      if (filtered.length > 0) {
        // Check for exact match by EAN code (case insensitive) - highest priority
        const exactEanMatch = filtered.find(
          item => (item.ean_code && item.ean_code.toLowerCase() === cleanSearchTerm.toLowerCase()) || 
                 (getItemEanCode(item)?.toLowerCase() === cleanSearchTerm.toLowerCase())
        );
        
        // Check for exact match by name (case insensitive)
        const exactNameMatch = filtered.find(
          item => item.name.toLowerCase() === cleanSearchTerm.toLowerCase()
        );
        
        // Check for exact match by serial number (case insensitive)
        const exactSerialMatch = filtered.find(
          item => item.serial_number && item.serial_number.toLowerCase() === cleanSearchTerm.toLowerCase()
        );
        
        // Prioritize exact matches - EAN first, then serial, then name
        if (exactEanMatch) {
          console.log(`Auto-selecting item by exact EAN code match: ${exactEanMatch.name} (ID: ${exactEanMatch.id})`);
          setSelectedItemId(exactEanMatch.id);
        } else if (exactSerialMatch) {
          console.log(`Auto-selecting item by exact serial number match: ${exactSerialMatch.name} (ID: ${exactSerialMatch.id})`);
          setSelectedItemId(exactSerialMatch.id);
        } else if (exactNameMatch) {
          console.log(`Auto-selecting item by exact name match: ${exactNameMatch.name} (ID: ${exactNameMatch.id})`);
          setSelectedItemId(exactNameMatch.id);
        }
        
        // If we have only one result from the filter and no exact match yet, select it
        if (filtered.length === 1 && !exactEanMatch && !exactNameMatch && !exactSerialMatch) {
          console.log(`Auto-selecting the only matching item: ${filtered[0].name} (ID: ${filtered[0].id})`);
          setSelectedItemId(filtered[0].id);
        }
      }
    } else {
      setFilteredItems(items);
    }
  }, [searchTerm, items]);

  // Helper function to get item EAN code from database or localStorage
  const getItemEanCode = (item) => {
    if (item.ean_code) return item.ean_code;
    
    try {
      const storedItem = localStorage.getItem(`item_${item.id}_details`);
      if (storedItem) {
        const parsedItem = JSON.parse(storedItem);
        return parsedItem.ean_code || null;
      }
    } catch (err) {
      console.error('Error reading item EAN code from localStorage:', err);
    }
    
    return null;
  };

  const fetchItems = async (boxFilterId = null) => {
    setLoading(true);
    setError('');
    try {
      // Use the provided boxFilterId, scannedBoxId, or no filter
      const boxIdToUse = boxFilterId || scannedBoxId || null;
      
      const response = await getItems(boxIdToUse);
      // Ensure we're getting the data array from the response
      const data = response.data || [];
      setItems(data);
      setFilteredItems(data);
      return data; // Return the data for use in promise chains
    } catch (err) {
      setError('Failed to fetch items. Please try again.');
      console.error('Error fetching items:', err);
      // Set empty arrays to prevent map errors
      setItems([]);
      setFilteredItems([]);
      return []; // Return empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async () => {
    try {
      const response = await getBoxes();
      const data = response.data || [];
      setBoxes(data);
      
      // If preselectedBoxId is set, use it; otherwise, select the first box
      if (preselectedBoxId) {
        setBoxId(preselectedBoxId);
      } else if (data.length > 0 && !boxId) {
        setBoxId(data[0].id);
      }
      
      return data;
    } catch (err) {
      setError('Failed to fetch boxes. Please try again.');
      console.error('Error fetching boxes:', err);
      setBoxes([]);
      return [];
    }
  };

  const resetForm = () => {
    // Always default to 'existing' mode regardless of newItemMode prop when opened from BoxDetail
    setItemType('existing');
    setSelectedItemId('');
    setQuantity(1);
    // Don't reset boxId if preselectedBoxId is provided
    if (!preselectedBoxId) {
      setBoxId('');
    }
    setNotes('');
    setSupplier('');
    setItemName('');
    setItemDescription('');
    setItemTypeValue('');
    setSerialNumber('');
    setSearchTerm('');
    setIsSubitem(false);
    setParentItemId('');
    setEanCode(''); // Reset EAN code
    setError('');
    setSuccess('');
    setBoxScanInput('');
    setGeneratedReferenceCode(''); // Reset reference code
    setActiveTab('details'); // Reset to details tab
    setLabelFormat('compact'); // Reset label format
    
    // Keep the scanned box if it was preselected
    if (!preselectedBoxId) {
      setScannedBoxId(null);
      setScannedBoxNumber('');
    }
    
    // Generate a new reference code
    if (newItemMode) {
      generateReferenceCode();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (itemType === 'existing' && !selectedItemId) {
      setError('Please select an item');
      return;
    }
    
    if (itemType === 'new' && !itemName.trim()) {
      setError('Please enter an item name');
      return;
    }
    
    if (itemType === 'new' && isSubitem && !parentItemId) {
      setError('Please select a parent item');
      return;
    }
    
    if (!boxId) {
      setError('Please select a box');
      return;
    }
    
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      const stockInData = {
        quantity: parseInt(quantity, 10),
        box_id: boxId,
        notes: notes || null,
        supplier: supplier || null
      };
      
      if (itemType === 'existing') {
        stockInData.item_id = selectedItemId;
      } else {
        stockInData.item_name = itemName;
        stockInData.description = itemDescription || null;
        stockInData.type = itemTypeValue || null;
        stockInData.serial_number = serialNumber || null;
        stockInData.ean_code = eanCode || null;
        stockInData.parent_item_id = isSubitem ? parentItemId : null;
        
        // Always include reference_id if we have it
        if (generatedReferenceCode) {
          stockInData.reference_id = generatedReferenceCode;
          stockInData.qr_code = generatedReferenceCode;
        }
        
        // Explicitly ensure these fields are included
        stockInData.supplier = supplier || null;
        
        // Log the data being sent for debugging
        console.log('Creating new item with data:', stockInData);
      }
      
      console.log('Submitting stock in data:', stockInData);
      
      // Use the imported stockIn function instead of api.stockIn
      const response = await stockIn(stockInData);
      console.log('Stock in response:', response);
      
      // Use our enhanced success handler
      await handleSuccess();
      
      // Close modal after a short delay
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      console.error('Error adding to inventory:', err);
      setError(err.message || 'Failed to add item to inventory. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedItem = () => {
    return items.find(item => item.id === selectedItemId);
  };

  const renderItemForm = () => {
    if (itemType === 'existing') {
      return (
        <div className="mb-3">
          <div className="mb-3">
            <label htmlFor="searchItem" className="form-label">Search Items</label>
            <input
              type="text"
              id="searchItem"
              className="form-control"
              placeholder="Search by name, serial number, description or EAN code ($prefix)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              ref={searchItemRef}
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="itemSelect" className="form-label">Select Item</label>
            <select
              id="itemSelect"
              className="form-select"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required={itemType === 'existing'}
            >
              <option value="">-- Select an item --</option>
              {filteredItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} 
                  {item.type ? ` (${item.type})` : ''} 
                  {item.serial_number ? ` - SN: ${item.serial_number}` : ''}
                  {getItemEanCode(item) ? ` - EAN: $${getItemEanCode(item)}` : ''}
                </option>
              ))}
            </select>
            <small className="form-text text-muted">
              {filteredItems.length} items found
              {scannedBoxId && ` in box #${scannedBoxNumber}`}
            </small>
          </div>
          
          {selectedItemId && (
            <div className="selected-item-details p-2 bg-light rounded border mb-3">
              <h6 className="mb-2">Selected Item Details</h6>
              {(() => {
                const item = getSelectedItem();
                if (!item) return <p>Item not found</p>;
                
                return (
                  <div className="row g-2">
                    <div className="col-md-6">
                      <p className="mb-1"><strong>Name:</strong> {item.name}</p>
                      <p className="mb-1"><strong>Description:</strong> {item.description || '-'}</p>
                    </div>
                    <div className="col-md-6">
                      <p className="mb-1"><strong>Type:</strong> {item.type || '-'}</p>
                      <p className="mb-1"><strong>Current Quantity:</strong> <span className="badge bg-primary">{item.quantity || 0}</span></p>
                    </div>
                    {item.serial_number && (
                      <div className="col-md-6">
                        <p className="mb-1"><strong>Serial Number:</strong> {item.serial_number}</p>
                      </div>
                    )}
                    {getItemEanCode(item) && (
                      <div className="col-md-6">
                        <p className="mb-1"><strong>EAN Code:</strong> ${getItemEanCode(item)}</p>
                      </div>
                    )}
                    {item.box_number && (
                      <div className="col-md-6">
                        <p className="mb-1"><strong>Current Box:</strong> {item.box_number}</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div>
          <div className="mb-3">
            <label htmlFor="itemName" className="form-label">Item Name</label>
            <input
              type="text"
              id="itemName"
              className="form-control"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-3">
            <label htmlFor="itemDescription" className="form-label">Description</label>
            <textarea
              id="itemDescription"
              className="form-control"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              rows="2"
            ></textarea>
          </div>
          
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label htmlFor="itemType" className="form-label">Type</label>
                <input
                  type="text"
                  id="itemType"
                  className="form-control"
                  value={itemTypeValue}
                  onChange={(e) => setItemTypeValue(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label htmlFor="serialNumber" className="form-label">Serial Number</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    id="serialNumber"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number (optional)"
                  />
                  <button 
                    className="btn btn-outline-primary" 
                    type="button"
                    onClick={() => setShowSerialScanner(true)}
                    title="Scan serial number"
                  >
                    <i className="bi bi-camera"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-3">
            <label htmlFor="eanCode" className="form-label">EAN Code</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control"
                id="eanCode"
                value={eanCode}
                onChange={(e) => setEanCode(e.target.value)}
                placeholder="Enter EAN code (optional)"
              />
              <button 
                className="btn btn-outline-primary" 
                type="button"
                onClick={() => setShowEanScanner(true)}
                title="Scan EAN barcode"
              >
                <i className="bi bi-camera"></i>
              </button>
            </div>
          </div>
          
          <div className="mb-3 form-check">
            <input
              type="checkbox"
              id="isSubitem"
              className="form-check-input"
              checked={isSubitem}
              onChange={(e) => setIsSubitem(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="isSubitem">
              This is a subitem of another item
            </label>
          </div>
          
          {isSubitem && (
            <div className="mb-3">
              <label htmlFor="parentItemSelect" className="form-label">Parent Item</label>
              <select
                id="parentItemSelect"
                className="form-select"
                value={parentItemId}
                onChange={(e) => setParentItemId(e.target.value)}
                required={isSubitem}
              >
                <option value="">-- Select parent item --</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.type ? `(${item.type})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          

        </div>
      );
    }
  };

  // After successful stock operation
  const handleSuccess = async () => {
    setSuccess('Item(s) successfully added to inventory.');
    
    // Clear any caches
    try {
      if (api && api.clearCache) {
        api.clearCache('/items');
        console.log('Cleared items cache after stock-in operation');
      }
      
      // Clear localStorage caches
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('item') || key.includes('cache'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Signal cache cleared in session storage
      sessionStorage.setItem('cache_cleared_at', new Date().toISOString());
    } catch (err) {
      console.error('Error clearing caches:', err);
    }
    
    // Manually send a WebSocket refresh notification to ensure all clients update
    if (webSocketService) {
      console.log('Sending WebSocket refresh notification');
      
      // First type of notification
      webSocketService.send({
        type: 'refresh_needed',
        tableType: 'items',
        timestamp: new Date().toISOString()
      });
      
      // Second type of notification for maximum compatibility
      webSocketService.send({
        type: 'client_refresh_request',
        tableType: 'items',
        timestamp: new Date().toISOString()
      });
      
      // Also send item_update notification
      webSocketService.send({
        type: 'item_update',
        action: 'create',
        timestamp: new Date().toISOString()
      });
    }
    
    // Force server-side materialized view refresh
    try {
      await api.post('/database/refresh-view', { timestamp: Date.now() });
      console.log('Forced server-side view refresh after stock-in');
    } catch (err) {
      console.error('Error refreshing view:', err);
    }
    
    // Notify parent component
    if (onSuccess) {
      onSuccess();
    }
    
    // Clear the form
    resetForm();
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-success">
            <h5 className="modal-title text-dark">
              <i className="bi bi-box-arrow-in-down me-2"></i>
              Stock In - Add Items
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={safeClose}
              disabled={submitting}
              aria-label="Close"
            ></button>
          </div>
          
          <div className="modal-body">
            {loading ? (
              <div className="text-center my-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="alert alert-success" role="alert">
                    {success}
                  </div>
                )}
                
                {/* Box Scanning Section */}
                <div className="card mb-3 border-primary">
                  <div className="card-header bg-primary text-white">
                    <i className="bi bi-upc-scan me-2"></i>
                    Scan Box Label
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-8">
                        <div onSubmit={(e) => {
                          e.preventDefault();
                          handleBoxScan(e);
                          // Prevent the form from submitting and closing the modal
                          return false;
                        }}>
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Scan box label or enter box number"
                              value={boxScanInput}
                              onChange={(e) => setBoxScanInput(e.target.value)}
                              // Prevent form submission on Enter key press
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleBoxScan(e);
                                }
                              }}
                              autoFocus
                            />
                            <button 
                              className="btn btn-primary" 
                              type="button" // Change to button instead of submit
                              onClick={handleBoxScan}
                            >
                              <i className="bi bi-search"></i>
                            </button>
                            <button 
                              className="btn btn-outline-primary" 
                              type="button"
                              onClick={() => setShowBoxScanner(true)}
                              title="Scan with camera"
                            >
                              <i className="bi bi-camera"></i>
                            </button>
                          </div>
                        </div>
                        <small className="text-muted">
                          Scan a box label or enter a box number to select a box
                        </small>
                      </div>
                      <div className="col-md-4">
                        {scannedBoxId && (
                          <div className="d-flex align-items-center h-100">
                            <div className="alert alert-info mb-0 w-100 d-flex justify-content-between align-items-center">
                              <span>
                                <strong>Box:</strong> #{scannedBoxNumber}
                              </span>
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline-secondary"
                                onClick={clearScannedBox}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="card mb-3">
                  <div className="card-header bg-light">
                    <ul className="nav nav-tabs card-header-tabs">
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link ${itemType === 'existing' ? 'active border-bottom-0' : ''} text-dark bg-white`}
                          onClick={() => setItemType('existing')}
                        >
                          <strong>Existing Item</strong>
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link ${itemType === 'new' ? 'active border-bottom-0' : ''} text-dark bg-white`}
                          onClick={() => {
                            setItemType('new');
                            // Generate a reference code when switching to new item tab if none exists
                            if (!generatedReferenceCode) {
                              generateReferenceCode();
                            }
                          }}
                        >
                          New Item
                        </button>
                      </li>
                    </ul>
                  </div>
                  <div className="card-body">
                    {renderItemForm()}
                  </div>
                </div>
                
                {itemType === 'new' && (
                  <div className="card mb-3">
                    <div className="card-header bg-light">
                      <ul className="nav nav-tabs card-header-tabs">
                        <li className="nav-item">
                          <button
                            type="button"
                            className={`nav-link ${activeTab === 'details' ? 'active border-bottom-0' : ''} text-dark bg-white`}
                            onClick={() => setActiveTab('details')}
                          >
                            <strong>Item Details</strong>
                          </button>
                        </li>
                        <li className="nav-item">
                          <button
                            type="button"
                            className={`nav-link ${activeTab === 'qrcode' ? 'active border-bottom-0' : ''} text-dark bg-white`}
                            onClick={() => {
                              setActiveTab('qrcode');
                              
                              // Always check for existing QR code first, regardless of item type
                              let existingQRFound = false;
                              
                              if (itemType === 'existing' && selectedItemId) {
                                const selectedItem = getSelectedItem();
                                if (selectedItem) {
                                  // First check EAN code field
                                  const existingEan = getItemEanCode(selectedItem);
                                  if (existingEan && isValidQRFormat(existingEan)) {
                                    console.log('Found existing QR code in EAN field:', existingEan);
                                    setGeneratedReferenceCode(existingEan);
                                    existingQRFound = true;
                                  }
                                  
                                  // Check other potential QR code locations
                                  // For example, it might be in the reference_id field
                                  if (!existingQRFound && selectedItem.reference_id && isValidQRFormat(selectedItem.reference_id)) {
                                    console.log('Found existing QR code in reference_id field:', selectedItem.reference_id);
                                    setGeneratedReferenceCode(selectedItem.reference_id);
                                    existingQRFound = true;
                                  }
                                  
                                  // Or it might be in the qr_code field
                                  if (!existingQRFound && selectedItem.qr_code && isValidQRFormat(selectedItem.qr_code)) {
                                    console.log('Found existing QR code in qr_code field:', selectedItem.qr_code);
                                    setGeneratedReferenceCode(selectedItem.qr_code);
                                    existingQRFound = true;
                                  }
                                }
                              }
                              
                              // Only generate a new code if no existing QR code was found and we don't already have one
                              if (!existingQRFound && !generatedReferenceCode) {
                                console.log('No existing QR code found, generating a new one');
                                generateReferenceCode();
                              }
                            }}
                          >
                            Reference ID / QR Code
                          </button>
                        </li>
                      </ul>
                    </div>
                    <div className="card-body">
                      {activeTab === 'details' ? (
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          Item details are in the main form above. Click on the "Reference ID / QR Code" tab to generate a reference code for this item.
                        </div>
                      ) : activeTab === 'qrcode' && (
                        <div className="p-3">
                          <div className="mb-2 text-center">
                            <h5 className="mb-1">QR Code for {itemName || 'New Item'}</h5>
                            <small className="text-muted d-block mb-3">
                              Choose a format that works with your label printer
                            </small>
                          </div>
                          
                          <div className="alert alert-info py-2 small mb-3">
                            <i className="bi bi-info-circle me-1"></i>
                            Choose the "17mm x 54mm (Compact)" format for small labels
                          </div>
                          
                          <div className="d-flex justify-content-center mb-3">
                            <div className="text-center">
                              <QRCodeSVG
                                id="item-qr-code"
                                value={generatedReferenceCode}
                                size={180}
                                level="H"
                                includeMargin={true}
                              />
                              <div className="mt-2 small text-muted text-center" style={{ wordBreak: 'break-all' }}>
                                {generatedReferenceCode}
                              </div>
                            </div>
                          </div>
                          
                          <div className="alert alert-info py-2 small mb-3">
                            <i className="bi bi-info-circle me-1"></i>
                            Click "Apply as EAN" to use this reference code as the item's EAN code.
                          </div>
                          
                          <div className="mb-3">
                            <label className="form-label">Label Format</label>
                            <select className="form-select" value={labelFormat} onChange={(e) => setLabelFormat(e.target.value)}>
                              <option value="compact">17mm x 54mm (Compact)</option>
                              <option value="standard">Standard</option>
                              <option value="small">Small (Tiny Labels)</option>
                            </select>
                          </div>
                          
                          <div className="d-flex justify-content-center gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary"
                              onClick={() => {
                                // Always confirm before generating a new QR code
                                if (generatedReferenceCode && isValidQRFormat(generatedReferenceCode)) {
                                  if (!window.confirm('This item already has a QR code. Are you sure you want to generate a new one?')) {
                                    return; // User canceled
                                  }
                                }
                                generateReferenceCode();
                              }}
                            >
                              <i className="bi bi-arrow-clockwise me-1"></i>
                              Generate New QR Code
                            </button>
                            <button
                              type="button"
                              className="btn btn-success"
                              onClick={() => {
                                setEanCode(generatedReferenceCode);
                                setActiveTab('details');
                                
                                // If we're working with an existing item, sync the code to database
                                if (itemType === 'existing' && selectedItemId) {
                                  codeSyncService.storeItemCode(selectedItemId, generatedReferenceCode, generatedReferenceCode)
                                    .then(() => {
                                      console.log('EAN/QR code saved to database');
                                      alert('Reference code applied to EAN field and saved to database');
                                    })
                                    .catch(err => {
                                      console.error('Failed to save EAN/QR code to database:', err);
                                      alert('Reference code applied to EAN field (but database update failed)');
                                    });
                                } else {
                                  alert('Reference code applied to EAN field');
                                }
                              }}
                            >
                              <i className="bi bi-check-circle me-1"></i>
                              Apply as EAN
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="card mb-3">
                  <div className="card-header bg-light">
                    <strong className="text-dark">Stock In Details</strong>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="quantity" className="form-label">Quantity</label>
                          <input
                            type="number"
                            id="quantity"
                            className="form-control"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            min="1"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="boxSelect" className="form-label">Select Box</label>
                          <div className="input-group">
                            <select
                              id="boxSelect"
                              className="form-select"
                              value={boxId}
                              onChange={(e) => setBoxId(e.target.value)}
                              required
                            >
                              <option value="">Select a box...</option>
                              {boxes.map(box => (
                                <option key={box.id} value={box.id}>
                                  #{box.box_number} - {box.description || 'No description'} 
                                  {box.location_name ? ` (${box.location_name})` : ''}
                                </option>
                              ))}
                            </select>
                            <button 
                              className="btn btn-outline-primary" 
                              type="button"
                              onClick={() => setShowBoxScanner(true)}
                              title="Scan box QR code"
                            >
                              <i className="bi bi-camera"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="supplier" className="form-label">Supplier</label>
                          <input
                            type="text"
                            id="supplier"
                            className="form-control"
                            value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label htmlFor="notes" className="form-label">Notes</label>
                          <textarea
                            id="notes"
                            className="form-control"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-secondary me-2"
                    onClick={safeClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Processing...
                      </>
                    ) : (
                      <>Stock In</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      
      {/* Barcode Scanner Modals */}
      <BarcodeScannerModal
        show={showBoxScanner}
        onClose={() => setShowBoxScanner(false)}
        onScan={(result) => {
          console.log("Box scan result:", result);
          
          // Check if result is a URL with box ID
          const urlMatch = result.match(/\/boxes\/(\d+)(\?|$)/);
          if (urlMatch) {
            const boxId = urlMatch[1];
            console.log(`Extracted box ID from URL: ${boxId}`);
            setBoxId(boxId);
            
            // Find the box in our list to get the box number
            const matchedBox = boxes.find(b => b.id === parseInt(boxId));
            if (matchedBox) {
              setScannedBoxId(matchedBox.id);
              setScannedBoxNumber(matchedBox.box_number);
              
              // Filter items for this box
              fetchItems(matchedBox.id).then(() => {
                // Focus on the search item input field
                setTimeout(() => {
                  if (searchItemRef.current && itemType === 'existing') {
                    searchItemRef.current.focus();
                  }
                }, 100);
              });
            }
          } else {
            // Try to find box by reference ID or box number
            const boxRefMatch = result.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
            if (boxRefMatch) {
              const boxNumber = boxRefMatch[1].replace(/^0+/, ''); // Remove leading zeros
              console.log(`Extracted box number from reference: ${boxNumber}`);
              
              // Find the box with this number
              const matchedBox = boxes.find(box => 
                box.box_number === boxNumber || 
                box.box_number.toString() === boxNumber ||
                box.box_number.endsWith(boxNumber)
              );
              
              if (matchedBox) {
                setBoxId(matchedBox.id);
                setScannedBoxId(matchedBox.id);
                setScannedBoxNumber(matchedBox.box_number);
                
                // Filter items for this box
                fetchItems(matchedBox.id).then(() => {
                  // Focus on the search item input field
                  setTimeout(() => {
                    if (searchItemRef.current && itemType === 'existing') {
                      searchItemRef.current.focus();
                    }
                  }, 100);
                });
              } else {
                console.log(`No box found with number: ${boxNumber}`);
                alert(`No box found with number: ${boxNumber}`);
              }
            } else {
              // Try direct box number match
              const matchedBox = boxes.find(box => 
                box.box_number.toString() === result || 
                box.reference_id === result
              );
              
              if (matchedBox) {
                setBoxId(matchedBox.id);
                setScannedBoxId(matchedBox.id);
                setScannedBoxNumber(matchedBox.box_number);
                
                // Filter items for this box
                fetchItems(matchedBox.id).then(() => {
                  // Focus on the search item input field
                  setTimeout(() => {
                    if (searchItemRef.current && itemType === 'existing') {
                      searchItemRef.current.focus();
                    }
                  }, 100);
                });
              } else {
                console.log(`No box found with scan value: ${result}`);
                alert(`No box found with scan value: ${result}`);
              }
            }
          }
          
          setShowBoxScanner(false);
        }}
        title="Scan Box QR Code"
      />
      
      <BarcodeScannerModal
        show={showEanScanner}
        onClose={() => setShowEanScanner(false)}
        onScan={(result) => {
          console.log("EAN scan result:", result);
          setEanCode(result);
          // Not closing the modal automatically after scan
        }}
        title="Scan EAN Barcode"
      />
      
      <BarcodeScannerModal
        show={showSerialScanner}
        onClose={() => setShowSerialScanner(false)}
        onScan={(result) => {
          console.log("Serial scan result:", result);
          setSerialNumber(result);
        }}
        title="Scan Serial Number"
      />
    </div>
  );
}

export default StockInModal; 