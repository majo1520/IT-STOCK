import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../contexts/ApiServiceContext';
import api from '../services/api'; // Import the full API service
import BarcodeScannerModal from './BarcodeScannerModal';
import webSocketService from '../services/webSocketService';

function StockOutModal({ show, handleClose, onSuccess, preselectedItemId, preselectedBoxId }) {
  const { api } = useApi(); // Use the API from context
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [removalReasons, setRemovalReasons] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [boxId, setBoxId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [recipient, setRecipient] = useState('');
  const [location, setLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showCustomerSelect, setShowCustomerSelect] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  
  // Box scanning functionality
  const [boxScanInput, setBoxScanInput] = useState('');
  const [scannedBoxId, setScannedBoxId] = useState(null);
  const [scannedBoxNumber, setScannedBoxNumber] = useState('');
  
  // Add state for barcode scanner
  const [showBoxScanner, setShowBoxScanner] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState(false);
  
  // Default removal reasons in case API fails
  const defaultReasons = [
    { id: 'CONSUMED', name: 'Used/Consumed' },
    { id: 'DAMAGED', name: 'Damaged/Defective' },
    { id: 'EXPIRED', name: 'Expired' },
    { id: 'STOLEN', name: 'Stolen/Lost' },
    { id: 'RETURNED', name: 'Returned to Supplier' },
    { id: 'TRANSFERRED', name: 'Transferred to Another Location' },
    { id: 'SOLD', name: 'Sold to Customer' },
    { id: 'OTHER', name: 'Other' }
  ];
  
  // Reference to input fields for focus control
  const itemSearchRef = useRef(null);
  const reasonSelectRef = useRef(null);
  const itemSelectRef = useRef(null);
  
  useEffect(() => {
    if (show) {
      console.log('StockOutModal shown, fetching data...');
      console.log('Preselected values:', { preselectedItemId, preselectedBoxId });
      
      // Reset form and errors
      resetForm();
      setError('');
      
      // If preselectedBoxId is provided, set scannedBoxId immediately to show UI feedback
      if (preselectedBoxId) {
        setScannedBoxId(preselectedBoxId);
        setBoxId(preselectedBoxId);
        
        // Find box number for the preselected box ID
        fetchBoxes().then((boxesData) => {
          const selectedBox = boxesData.find(box => box.id === preselectedBoxId);
          if (selectedBox) {
            console.log(`Found box number for preselected box: #${selectedBox.box_number}`);
            setScannedBoxNumber(selectedBox.box_number);
          } else {
            console.warn(`Could not find box with ID ${preselectedBoxId} in boxes data`);
          }
        }).catch(err => {
          console.error('Error fetching box details:', err);
        });
      }
      
      // Fetch customers first to ensure they're available when needed
      fetchCustomers().then(() => {
        console.log('Customers loaded successfully');
      }).catch(err => {
        console.error('Error loading customers:', err);
      });
      
      // Fetch all necessary data
      Promise.all([
        fetchItems(preselectedBoxId), // Pass preselectedBoxId to fetchItems
        fetchRemovalReasons(),
        fetchBoxes()
      ]).then(() => {
        // Focus on search field when all data is loaded, especially when opened from BoxDetail
        if (preselectedBoxId && itemSearchRef.current) {
          // Use a small delay to ensure the DOM is ready
          setTimeout(() => {
            itemSearchRef.current.focus();
            console.log('Auto-focused on search items field from BoxDetail view');
          }, 300);
        }
      }).catch(err => {
        console.error('Error initializing StockOutModal:', err);
        setError('Failed to load data. Please try again or refresh the page.');
      });
      
      // Set preselected values if provided
      if (preselectedItemId) {
        setSelectedItemId(preselectedItemId);
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
    const boxScanValue = boxScanInput.trim();
    
    // Check if boxes are available
    if (!boxes || boxes.length === 0) {
      setError('Box data not available. Please try refreshing the page.');
      setTimeout(() => setError(''), 3000);
      setBoxScanInput('');
      return;
    }
    
    console.log('Processing box scan value:', boxScanValue);
    
    // Check if input is a URL (from QR code)
    const urlMatch = boxScanValue.match(/\/boxes\/(\d+)(\?|$)/);
    if (urlMatch) {
      const boxId = parseInt(urlMatch[1]); // Extract box ID from URL and convert to number
      console.log(`Detected QR code URL, extracted box ID: ${boxId}`);
      
      const matchedBox = boxes.find(box => box.id === boxId);
      if (matchedBox) {
        console.log(`Found matching box: #${matchedBox.box_number} (ID: ${matchedBox.id})`);
        setScannedBoxId(matchedBox.id);
        setScannedBoxNumber(matchedBox.box_number);
        setBoxId(matchedBox.id);
        
        // Filter items to only show items in this box
        fetchItems(matchedBox.id)
          .then(boxItems => {
            console.log(`Box #${matchedBox.box_number} (ID: ${matchedBox.id}) contains ${boxItems.length} items`);
            console.log('Items found in box:', boxItems);
            
            // If there's only one item in the box, auto-select it
            if (boxItems.length === 1) {
              setSelectedItemId(boxItems[0].id);
              // Auto-focus on reason select after short delay
              setTimeout(() => {
                if (reasonSelectRef.current) {
                  reasonSelectRef.current.focus();
                }
              }, 100);
            } else if (boxItems.length === 0) {
              console.warn(`No items found in box #${matchedBox.box_number} (ID: ${matchedBox.id})`);
              // Focus on the item select dropdown to show all items
              setTimeout(() => {
                if (itemSelectRef.current) {
                  itemSelectRef.current.focus();
                }
              }, 100);
            } else {
              // Multiple items found - focus on item search
              setTimeout(() => {
                if (itemSearchRef.current) {
                  itemSearchRef.current.focus();
                }
              }, 100);
            }
            // Clear any search term to show all items in the box
            setSearchTerm('');
          });
        
        setBoxScanInput('');
        return;
      } else {
        console.warn(`Box with ID ${boxId} not found in the available boxes`);
      }
    }
    
    // Check if input is a direct box number
    const directBoxNumber = boxes.find(box => 
      box.box_number === boxScanValue || 
      box.box_number === boxScanValue.replace(/^0+/, '')
    );
    
    if (directBoxNumber) {
      console.log(`Found box by direct number: #${directBoxNumber.box_number} (ID: ${directBoxNumber.id})`);
      setScannedBoxId(directBoxNumber.id);
      setScannedBoxNumber(directBoxNumber.box_number);
      setBoxId(directBoxNumber.id);
      
      // Filter items to only show items in this box
      fetchItems(directBoxNumber.id)
        .then(boxItems => {
          console.log(`Box #${directBoxNumber.box_number} (ID: ${directBoxNumber.id}) contains ${boxItems.length} items`);
          console.log('Items found in box:', boxItems);
          
          // If there's only one item in the box, auto-select it
          if (boxItems.length === 1) {
            setSelectedItemId(boxItems[0].id);
            // Auto-focus on reason select
            setTimeout(() => {
              if (reasonSelectRef.current) {
                reasonSelectRef.current.focus();
              }
            }, 100);
          } else if (boxItems.length === 0) {
            console.warn(`No items found in box #${directBoxNumber.box_number} (ID: ${directBoxNumber.id})`);
          } else {
            // Multiple items - focus on search
            setTimeout(() => {
              if (itemSearchRef.current) {
                itemSearchRef.current.focus();
              }
            }, 100);
          }
          // Clear any search term to show all items in the box
          setSearchTerm('');
        });
      
      setBoxScanInput('');
      return;
    }
    
    // Check if it's a reference ID format (BOX-XXXX-XXXXXX)
    const boxRefMatch = boxScanValue.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
    if (boxRefMatch) {
      const boxNumber = boxRefMatch[1].replace(/^0+/, ''); // Remove leading zeros
      console.log(`Extracted box number from reference: ${boxNumber}`);
      
      // Find the box with this number
      const matchedBox = boxes.find(box => 
        box.box_number === boxNumber || 
        box.box_number.endsWith(boxNumber)
      );
      
      if (matchedBox) {
        console.log(`Found box by reference: #${matchedBox.box_number} (ID: ${matchedBox.id})`);
        setScannedBoxId(matchedBox.id);
        setScannedBoxNumber(matchedBox.box_number);
        setBoxId(matchedBox.id);
        
        // Filter items to only show items in this box
        fetchItems(matchedBox.id)
          .then(boxItems => {
            console.log(`Box #${matchedBox.box_number} (ID: ${matchedBox.id}) contains ${boxItems.length} items`);
            console.log('Items found in box:', boxItems);
            
            // If there's only one item in the box, auto-select it
            if (boxItems.length === 1) {
              setSelectedItemId(boxItems[0].id);
              // Auto-focus on reason select
              setTimeout(() => {
                if (reasonSelectRef.current) {
                  reasonSelectRef.current.focus();
                }
              }, 100);
            } else if (boxItems.length === 0) {
              console.warn(`No items found in box #${matchedBox.box_number} (ID: ${matchedBox.id})`);
            }
            // Clear any search term to show all items in the box
            setSearchTerm('');
          });
        
        setBoxScanInput('');
        return;
      }
    }
    
    // If no match found
    console.warn(`Box not found for scan value: ${boxScanValue}`);
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

  // Debug effect to track visibility
  useEffect(() => {
    console.log('StockOutModal visibility changed:', show);
  }, [show]);

  // Filter and auto-select items based on search term
  useEffect(() => {
    if (!items || items.length === 0) {
      setFilteredItems([]);
      return;
    }
    
    if (searchTerm) {
      const cleanSearchTerm = searchTerm.trim().toLowerCase();
      
      // Skip filtering if search term is too short (less than 2 characters)
      if (cleanSearchTerm.length < 2) {
        setFilteredItems(items);
        return;
      }

      const filtered = items.filter(item => 
        // Match by name
        (item.name && item.name.toLowerCase().includes(cleanSearchTerm)) || 
        // Match by serial number
        (item.serial_number && item.serial_number.toLowerCase().includes(cleanSearchTerm)) ||
        // Match by description
        (item.description && item.description.toLowerCase().includes(cleanSearchTerm)) ||
        // Match by EAN code - exact match first, then partial
        (item.ean_code && (
          item.ean_code.toLowerCase() === cleanSearchTerm || 
          item.ean_code.toLowerCase().includes(cleanSearchTerm)
        )) ||
        // Try to match EAN code from localStorage
        (getItemEanCode(item) && (
          getItemEanCode(item).toLowerCase() === cleanSearchTerm ||
          getItemEanCode(item).toLowerCase().includes(cleanSearchTerm)
        ))
      );
      
      setFilteredItems(filtered);
      
      // Auto-select item if we have a match
      if (filtered.length > 0) {
        // Check for exact match by EAN code (case insensitive) - highest priority
        const exactEanMatch = filtered.find(
          item => (item.ean_code && item.ean_code.toLowerCase() === cleanSearchTerm) || 
                 (getItemEanCode(item) && getItemEanCode(item).toLowerCase() === cleanSearchTerm)
        );
        
        // Check for exact match by name (case insensitive)
        const exactNameMatch = filtered.find(
          item => item.name && item.name.toLowerCase() === cleanSearchTerm
        );
        
        // Check for exact match by serial number (case insensitive)
        const exactSerialMatch = filtered.find(
          item => item.serial_number && item.serial_number.toLowerCase() === cleanSearchTerm
        );
        
        // Prioritize exact matches - EAN first, then serial, then name
        if (exactEanMatch) {
          console.log(`Auto-selecting item by exact EAN code match: ${exactEanMatch.name} (ID: ${exactEanMatch.id})`);
          setSelectedItemId(exactEanMatch.id);
          
          // If the item is in a box, auto-select that box too
          if (exactEanMatch.box_id) {
            setBoxId(exactEanMatch.box_id);
          }
        } else if (exactSerialMatch) {
          console.log(`Auto-selecting item by exact serial number match: ${exactSerialMatch.name} (ID: ${exactSerialMatch.id})`);
          setSelectedItemId(exactSerialMatch.id);
          
          // If the item is in a box, auto-select that box too
          if (exactSerialMatch.box_id) {
            setBoxId(exactSerialMatch.box_id);
          }
        } else if (exactNameMatch) {
          console.log(`Auto-selecting item by exact name match: ${exactNameMatch.name} (ID: ${exactNameMatch.id})`);
          setSelectedItemId(exactNameMatch.id);
          
          // If the item is in a box, auto-select that box too
          if (exactNameMatch.box_id) {
            setBoxId(exactNameMatch.box_id);
          }
        }
        
        // If we have only one result from the filter and no exact match yet, select it
        if (filtered.length === 1 && !exactEanMatch && !exactNameMatch && !exactSerialMatch) {
          console.log(`Auto-selecting the only matching item: ${filtered[0].name} (ID: ${filtered[0].id})`);
          setSelectedItemId(filtered[0].id);
          
          // If the item is in a box, auto-select that box too
          if (filtered[0].box_id) {
            setBoxId(filtered[0].box_id);
          }
        }
      }
    } else {
      setFilteredItems(items);
    }
  }, [searchTerm, items]);

  // Helper function to get item EAN code from database or localStorage
  const getItemEanCode = (item) => {
    if (!item) return null;
    if (item.ean_code) return item.ean_code;
    
    try {
      const storedItem = localStorage.getItem(`item_${item.id}_details`);
      if (storedItem) {
        const parsedItem = JSON.parse(storedItem);
        return parsedItem?.ean_code || null;
      }
    } catch (err) {
      console.error('Error reading item EAN code from localStorage:', err);
    }
    
    return null;
  };

  // Filter customers based on search term
  useEffect(() => {
    if (!customers || customers.length === 0) {
      setFilteredCustomers([]);
      return;
    }
    
    if (customerSearchTerm && customerSearchTerm.trim().length > 0) {
      const searchTerm = customerSearchTerm.trim().toLowerCase();
      const filtered = customers.filter(customer => 
        (customer.name && customer.name.toLowerCase().includes(searchTerm)) || 
        (customer.contact_person && customer.contact_person.toLowerCase().includes(searchTerm))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [customerSearchTerm, customers]);

  const fetchItems = async (boxFilterId = null) => {
    setLoading(true);
    try {
      // If boxFilterId is provided, fetch only items in that box
      let response;
      if (boxFilterId) {
        console.log(`Fetching items for box ID: ${boxFilterId}`);
        response = await api.getItems(boxFilterId);
      } else {
        console.log('Fetching all items (no box filter)');
        response = await api.getItems();
      }
      
      const data = response.data || [];
      console.log(`Items fetched: ${data.length}`);
      
      // Filter out items with zero quantity
      const availableItems = data.filter(item => item.quantity > 0);
      console.log(`Items with quantity > 0: ${availableItems.length}`);
      
      setItems(availableItems);
      setFilteredItems(availableItems);
      setLoading(false);
      return availableItems;
    } catch (err) {
      console.error('Error fetching items:', err);
      setItems([]);
      setFilteredItems([]);
      setLoading(false);
      return [];
    }
  };
  
  const fetchRemovalReasons = async () => {
    try {
      const response = await api.getRemovalReasons();
      const data = response.data || defaultReasons;
      setRemovalReasons(data);
    } catch (err) {
      console.error('Error fetching removal reasons:', err);
      // Fall back to default reasons if API fails
      setRemovalReasons(defaultReasons);
    }
  };

  const fetchBoxes = async () => {
    try {
      const response = await api.getBoxes();
      const data = response.data || [];
      setBoxes(data);
      
      // If we have a preselectedBoxId but no scannedBoxNumber yet, try to find it now
      if (preselectedBoxId && !scannedBoxNumber) {
        const selectedBox = data.find(box => box.id === parseInt(preselectedBoxId));
        if (selectedBox) {
          console.log(`Found box number for preselected box: #${selectedBox.box_number}`);
          setScannedBoxNumber(selectedBox.box_number);
        } else {
          console.warn(`Could not find box with ID ${preselectedBoxId} in boxes data`);
        }
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setBoxes([]);
      return [];
    }
  };

  const fetchCustomers = async () => {
    try {
      console.log('Fetching customers...');
      const response = await api.getCustomers();
      console.log('Customer API response:', response);
      
      if (!response || !response.data) {
        console.error('Invalid customer API response:', response);
        setCustomers([]);
        setFilteredCustomers([]);
        return [];
      }
      
      const data = response.data || [];
      console.log('Fetched customers data:', data);
      
      // Ensure we have valid customer objects
      const validCustomers = data.filter(customer => customer && typeof customer === 'object' && customer.id);
      
      if (validCustomers.length !== data.length) {
        console.warn('Some invalid customer objects were filtered out:', 
          data.length - validCustomers.length, 'items removed');
      }
      
      setCustomers(validCustomers);
      setFilteredCustomers(validCustomers);
      console.log('Customers state updated with', validCustomers.length, 'customers');
      
      return validCustomers;
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
      setFilteredCustomers([]);
      return [];
    }
  };

  const resetForm = () => {
    // Initialize with preselectedItemId only if it's a valid value
    setSelectedItemId(preselectedItemId ? String(preselectedItemId) : '');
    setQuantity(1);
    setBoxId(preselectedBoxId || '');
    setReason('');
    setNotes('');
    setRecipient('');
    setLocation('');
    setSearchTerm('');
    setSelectedCustomerId('');
    setShowCustomerSelect(false);
    setCustomerSearchTerm('');
    setError('');
    setSuccess('');
    setBoxScanInput('');
    
    // Keep the scanned box if it was preselected
    if (!preselectedBoxId) {
      setScannedBoxId(null);
      setScannedBoxNumber('');
    }
  };

  // After successful stock out operation
  const handleSuccess = async () => {
    setSuccess('Item(s) successfully removed from inventory.');
    
    // Clear any caches using the api from context first, then fall back to the imported api
    try {
      // First try to use api from context if available
      if (api && api.clearCache) {
        api.clearCache('/items');
        console.log('Cleared items cache after stock-out operation');
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
        action: 'update',
        timestamp: new Date().toISOString()
      });
    }
    
    // Force server-side materialized view refresh
    try {
      // Try using api from context first, then fall back to imported api
      const apiToUse = (api && api.post) ? api : api;
      await apiToUse.post('/database/refresh-view', { timestamp: Date.now() });
      console.log('Forced server-side view refresh after stock-out');
    } catch (err) {
      console.error('Error refreshing view:', err);
    }
    
    // Notify parent component
    if (onSuccess) {
      onSuccess();
    }
  };

  // Update the handleSubmit function to use our new handleSuccess
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }
    
    if (!quantity || quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    
    // Verify quantity is not greater than item's current quantity
    const selectedItem = getSelectedItem();
    if (selectedItem && quantity > selectedItem.quantity) {
      setError(`Cannot remove more than the current quantity (${selectedItem.quantity})`);
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    // Add customer info to notes for CONSUMED or SOLD items
    let updatedNotes = notes || '';
    
    // Get customer name if a customer is selected
    let customerName = '';
    let customerInfo = null;
    if (selectedCustomerId) {
      const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));
      if (selectedCustomer) {
        customerName = selectedCustomer.contact_person || selectedCustomer.name;
        
        // Create customer_info object for the API
        customerInfo = {
          name: selectedCustomer.name,
          contact_person: selectedCustomer.contact_person || '',
          id: selectedCustomer.id
        };
      }
    }
    
    // For CONSUMED or SOLD reasons, add customer name to notes
    if ((reason === 'CONSUMED' || reason === 1 || reason === '1') && customerName) {
      updatedNotes = `consumed by ${customerName}${updatedNotes ? `. ${updatedNotes}` : ''}`;
    } else if ((reason === 'SOLD' || reason === 7 || reason === '7') && customerName) {
      updatedNotes = `sold to ${customerName}${updatedNotes ? `. ${updatedNotes}` : ''}`;
    }
    
    // Create the stock out data object
    const stockOutData = {
      quantity: parseInt(quantity, 10),
      notes: updatedNotes || null,
      reason: reason,
      customer_id: selectedCustomerId
    };
    
    // Add customer_info object to match API expectations
    if (customerInfo) {
      stockOutData.customer_info = customerInfo;
    }
    
    // Include recipient if it's set
    if (recipient && recipient.trim() !== '') {
      stockOutData.recipient = recipient;
    }
    
    try {
      // Use the context API if available, otherwise fall back to the imported API
      const apiToUse = (api && api.stockOut) ? api : api;
      const response = await apiToUse.stockOut(selectedItemId, stockOutData);
      
      if (!response) {
        throw new Error('No response from server');
      }
      
      // Use our enhanced success handler
      await handleSuccess();
      
      // Close modal after a short delay
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      console.error('Error removing from inventory:', err);
      setError(err.message || 'Failed to remove item from inventory. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedItem = () => {
    // If selectedItemId is empty or undefined, return null immediately
    if (!selectedItemId) {
      return null;
    }
    
    // First try to find the item in the current items list
    const item = items.find(item => item.id === parseInt(selectedItemId));
    
    if (item) {
      return item;
    }
    
    // If we have a stringified ID, try parsing it
    if (selectedItemId && typeof selectedItemId === 'string') {
      const parsedId = parseInt(selectedItemId);
      if (!isNaN(parsedId)) {
        const itemWithParsedId = items.find(item => item.id === parsedId);
        if (itemWithParsedId) {
          return itemWithParsedId;
        }
      }
    }
    
    // If not found and we're in the process of loading, return a temporary placeholder
    if (loading) {
      console.log('Item not found, but we are still loading...');
      return null;
    }
    
    // Only log error if selectedItemId has a value
    if (selectedItemId) {
      console.error(`Selected item (ID: ${selectedItemId}) not found in items list. Items:`, items);
    }
    
    // If we have a preselectedItemId and it matches the selectedItemId, try to fetch it
    if (preselectedItemId && preselectedItemId === selectedItemId) {
      console.log('Attempting to fetch the preselected item...');
      
      // If we're running in a box detail view, and have a preselectedBoxId
      if (preselectedBoxId) {
        console.log(`Using preselectedBoxId: ${preselectedBoxId} to fetch items`);
        // Fetch all items instead of just items in the box to be sure we get the item
        api.getItems().then(response => {
          if (response && response.data) {
            const allItems = response.data;
            const selectedItemFromAll = allItems.find(item => item.id === parseInt(selectedItemId));
            if (selectedItemFromAll) {
              console.log('Found preselected item in all items:', selectedItemFromAll);
              // Add it to our items list
              setItems(prev => [...prev, selectedItemFromAll]);
              setFilteredItems(prev => [...prev, selectedItemFromAll]);
            }
          }
        }).catch(err => {
          console.error('Error fetching all items:', err);
        });
      }
    }
    
    return null;
  };

  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setQuantity(value);
  };

  // Add effect to handle keydown event for TAB navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only process if modal is shown
      if (!show) return;
      
      // TAB key without modifiers
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // If item is selected, focus on reason select
        if (selectedItemId && e.target.id === 'itemSelect') {
          e.preventDefault();
          if (reasonSelectRef.current) {
            reasonSelectRef.current.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, selectedItemId]);

  // Effect to move focus when selected item changes
  useEffect(() => {
    if (selectedItemId && show) {
      // Auto-focus on reason select when item is selected
      setTimeout(() => {
        if (reasonSelectRef.current) {
          reasonSelectRef.current.focus();
        }
      }, 100);
    }
  }, [selectedItemId, show]);

  // Effect to show/hide customer selection based on reason
  useEffect(() => {
    console.log('Reason changed:', reason);
    console.log('Reason type:', typeof reason);
    console.log('Direct equality check:', reason === 1);
    console.log('Strict equality check:', reason === '1');
    console.log('Customers available:', customers.length);
    console.log('Show customer select:', showCustomerSelect);
    
    // Check for both string 'CONSUMED'/'SOLD' and numeric 1/7 reason IDs
    if (reason === 'CONSUMED' || reason === 'SOLD' || reason === 1 || reason === '1' || reason === 7 || reason === '7') {
      console.log('Should show customer selection for reason:', reason);
      setShowCustomerSelect(true);
      // Filter customers based on current search term
      if (customerSearchTerm) {
        const filtered = customers.filter(customer => 
          customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
          (customer.contact_person && customer.contact_person.toLowerCase().includes(customerSearchTerm.toLowerCase()))
        );
        setFilteredCustomers(filtered);
        console.log('Filtered customers:', filtered.length);
      } else {
        setFilteredCustomers(customers);
        console.log('All customers set to filtered list:', customers.length);
      }
      
      // If we don't have customers yet, fetch them now
      if (customers.length === 0) {
        console.log('No customers loaded yet, fetching them now...');
        fetchCustomers();
      }
    } else {
      console.log('Hiding customer selection for reason:', reason);
      setShowCustomerSelect(false);
      setSelectedCustomerId('');
    }
  }, [reason, customers, customerSearchTerm]);

  // Effect to filter customers when search term changes
  useEffect(() => {
    if (showCustomerSelect && customers.length > 0) {
      if (customerSearchTerm) {
        const filtered = customers.filter(customer => 
          customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
          (customer.contact_person && customer.contact_person.toLowerCase().includes(customerSearchTerm.toLowerCase()))
        );
        setFilteredCustomers(filtered);
      } else {
        setFilteredCustomers(customers);
      }
    }
  }, [customerSearchTerm, customers, showCustomerSelect]);

  const getSelectedCustomerName = () => {
    if (!selectedCustomerId) return '';
    const selectedCustomer = customers.find(c => c.id === parseInt(selectedCustomerId));
    if (!selectedCustomer) return '';
    
    // Prioritize contact person if available, otherwise use company name
    return selectedCustomer.contact_person || selectedCustomer.name;
  };

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title d-flex align-items-center">
              <i className="bi bi-box-arrow-up-right me-2"></i>
              <span className="d-none d-sm-inline">Stock Out - </span>Remove Items
              {scannedBoxId && scannedBoxNumber && (
                <span className="badge bg-light text-dark ms-2">
                  Box #{scannedBoxNumber}
                </span>
              )}
            </h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={handleClose}
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
                <p className="mt-2">Loading items...</p>
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
                
                {/* Box indicator when a box is selected */}
                {scannedBoxId && scannedBoxNumber && (
                  <div className="alert alert-primary d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <i className="bi bi-box me-2"></i>
                      <strong>Selected Box:</strong> #{scannedBoxNumber}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={clearScannedBox}
                      title="Clear selected box"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                )}
                
                {/* Box Scanning Section */}
                <div className="card mb-3 border-primary">
                  <div className="card-header bg-primary text-white">
                    <i className="bi bi-upc-scan me-2"></i>
                    Scan Box Label
                  </div>
                  <div className="card-body">
                    <div className="row g-2">
                      <div className="col-md-8 col-sm-12">
                        <div className="box-scan-container">
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Scan box label or enter box number"
                              value={boxScanInput}
                              onChange={(e) => setBoxScanInput(e.target.value)}
                              // Handle Enter key press
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault(); 
                                  handleBoxScan(e);
                                }
                              }}
                              autoFocus={!scannedBoxId} // Only autofocus if no box is already selected
                            />
                            <button 
                              className="btn btn-primary" 
                              type="button"
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
                          Scan a box label or enter a box number to filter items
                        </small>
                      </div>
                      <div className="col-md-4 col-sm-12 mt-2 mt-md-0">
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
                  <div className="card-body">
                    <div className="mb-3">
                      <label htmlFor="itemSearch" className="form-label">Search Items</label>
                      <div className="input-group">
                        <input
                          type="text"
                          id="itemSearch"
                          className="form-control"
                          placeholder="Search by name, serial number, description or EAN code"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          // Prevent form submission on Enter key press
                          ref={itemSearchRef}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                        />
                        <button 
                          className="btn btn-outline-primary" 
                          type="button"
                          onClick={() => setShowItemScanner(true)}
                          title="Scan item barcode"
                        >
                          <i className="bi bi-camera"></i>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label htmlFor="itemSelect" className="form-label">Select Item</label>
                      {items.length === 0 ? (
                        <div className="alert alert-info">No items available in inventory.</div>
                      ) : (
                        <>
                          <select
                            id="itemSelect"
                            className="form-select"
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            required
                            ref={itemSelectRef}
                          >
                            <option value="">-- Select an item --</option>
                            {Array.isArray(filteredItems) && filteredItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} 
                                {item.quantity ? ` (Qty: ${item.quantity})` : ''} 
                                {item.serial_number ? ` - SN: ${item.serial_number}` : ''}
                                {getItemEanCode(item) ? ` - EAN: ${getItemEanCode(item)}` : ''}
                              </option>
                            ))}
                          </select>
                          <small className="form-text text-muted">
                            {Array.isArray(filteredItems) ? filteredItems.length : 0} items found
                            {scannedBoxId && ` in box #${scannedBoxNumber}`}
                          </small>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {selectedItemId && (
                  <div className="card mb-3">
                    <div className="card-body p-2 p-sm-3">
                      <div className="selected-item-details p-2 bg-light rounded border">
                        <h6 className="mb-2">Selected Item Details</h6>
                        {(() => {
                          const item = getSelectedItem();
                          if (!item) return <p>Item not found</p>;
                          
                          return (
                            <div className="row g-2">
                              <div className="col-sm-6">
                                <p className="mb-1"><strong>Name:</strong> {item.name}</p>
                                <p className="mb-1"><strong>Description:</strong> {item.description || '-'}</p>
                              </div>
                              <div className="col-sm-6">
                                <p className="mb-1"><strong>Type:</strong> {item.type || '-'}</p>
                                <p className="mb-1"><strong>Current Quantity:</strong> <span className="badge bg-primary">{item.quantity || 0}</span></p>
                              </div>
                              {item.serial_number && (
                                <div className="col-sm-6">
                                  <p className="mb-1"><strong>Serial Number:</strong> {item.serial_number}</p>
                                </div>
                              )}
                              {getItemEanCode(item) && (
                                <div className="col-sm-6">
                                  <p className="mb-1"><strong>EAN Code:</strong> {getItemEanCode(item)}</p>
                                </div>
                              )}
                              {item.box_number && (
                                <div className="col-sm-6">
                                  <p className="mb-1"><strong>Box:</strong> {item.box_number}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="card mb-3">
                  <div className="card-header bg-light">
                    <strong className="text-dark">Stock Out Details</strong>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-md-6 col-sm-12">
                        <div className="mb-3">
                          <label htmlFor="quantity" className="form-label text-dark">Quantity to Remove</label>
                          <input
                            type="number"
                            className="form-control"
                            id="quantity"
                            min="1"
                            value={quantity}
                            onChange={handleQuantityChange}
                            max={getSelectedItem()?.quantity || 999}
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="col-md-6 col-sm-12">
                        <div className="mb-3">
                          <label htmlFor="reason" className="form-label text-dark">Reason</label>
                          <select
                            id="reason"
                            className="form-select"
                            value={reason}
                            onChange={(e) => {
                              const newReason = e.target.value;
                              console.log('Reason selected:', newReason, 'type:', typeof newReason);
                              setReason(newReason);
                              
                              // Directly update showCustomerSelect based on reason
                              if (newReason === 'CONSUMED' || newReason === 'SOLD' || 
                                  newReason === 1 || newReason === '1' || 
                                  newReason === 7 || newReason === '7') {
                                console.log('Setting showCustomerSelect to true for reason:', newReason);
                                setShowCustomerSelect(true);
                              } else {
                                console.log('Setting showCustomerSelect to false for reason:', newReason);
                                setShowCustomerSelect(false);
                                setSelectedCustomerId('');
                              }
                            }}
                            required
                            ref={reasonSelectRef}
                          >
                            <option value="">-- Select reason --</option>
                            {removalReasons.map(reason => (
                              <option key={reason.id} value={reason.id}>
                                {reason.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Debug info */}
                      <div className="d-none">
                        {console.log('Render - showCustomerSelect:', showCustomerSelect)}
                        {console.log('Render - reason:', reason)}
                        {console.log('Render - reason type:', typeof reason)}
                        {console.log('Render - condition result:', reason === 'CONSUMED' || reason === 'SOLD' || reason === 1 || reason === '1' || reason === 7 || reason === '7')}
                        {console.log('Render - filteredCustomers:', filteredCustomers.length)}
                      </div>
                      
                      {/* Customer selection section */}
                      {(() => {
                        console.log('JSX rendering - reason:', reason, 'type:', typeof reason);
                        console.log('JSX condition result:', reason === 'CONSUMED' || reason === 'SOLD' || reason === 1 || reason === '1' || reason === 7 || reason === '7');
                        
                        return (reason === 'CONSUMED' || reason === 'SOLD' || reason === 1 || reason === '1' || reason === 7 || reason === '7') ? (
                          <div className="col-12">
                            <div className="mb-3">
                              <label htmlFor="customer" className="form-label text-dark">
                                {reason === 'CONSUMED' || reason === 1 || reason === '1' ? 'Used/Consumed By' : 'Sold To'}
                              </label>
                              
                              <div className="mb-2">
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="Search by name or company..."
                                  value={customerSearchTerm}
                                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                />
                              </div>
                              
                              <select
                                id="customer"
                                className="form-select"
                                value={selectedCustomerId}
                                onChange={(e) => setSelectedCustomerId(e.target.value)}
                                required
                              >
                                <option value="">-- Select customer --</option>
                                {filteredCustomers.map(customer => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.contact_person ? `${customer.contact_person} (${customer.name})` : customer.name}
                                  </option>
                                ))}
                              </select>
                              <small className="form-text text-muted">
                                Select the individual or company who used/consumed or purchased this item
                              </small>
                              <small className="form-text d-block mt-1">
                                {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'} found
                              </small>
                              
                              {selectedCustomerId && (
                                <div className="alert alert-info mt-2 small">
                                  <strong>Transaction will be logged as:</strong><br/>
                                  <span className="d-block mt-1">
                                    <i className="bi bi-quote me-1"></i>
                                    {reason === 'CONSUMED' || reason === 1 || reason === '1' 
                                      ? <strong>consumed by {getSelectedCustomerName()}</strong>
                                      : <strong>sold to {getSelectedCustomerName()}</strong>
                                    }
                                    {notes ? `. ${notes}` : ''}
                                  </span>
                                  <small className="d-block mt-1 text-muted">
                                    This will appear in the transaction history notes column
                                  </small>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null;
                      })()}
                      
                      <div className="col-12">
                        <div className="mb-3">
                          <label htmlFor="notes" className="form-label text-dark">Additional Notes</label>
                          <textarea
                            id="notes"
                            className="form-control"
                            rows="2"
                            placeholder="Enter any additional notes about this transaction"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="d-flex justify-content-end mt-3 flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary me-2"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={submitting || !selectedItemId}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Processing...
                      </>
                    ) : (
                      <>Stock Out</>
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
          // Set the scan result to the input field
          setBoxScanInput(result);
          
          // Process the scan result immediately
          // Create a synthetic event object for handleBoxScan
          const syntheticEvent = { preventDefault: () => {} };
          
          // Use setTimeout to ensure state is updated before processing
          setTimeout(() => {
            handleBoxScan(syntheticEvent);
          }, 100);
        }}
        title="Scan Box Label"
      />
      
      <BarcodeScannerModal
        show={showItemScanner}
        onClose={() => setShowItemScanner(false)}
        onScan={(result) => {
          console.log("Item scan result:", result);
          setSearchTerm(result);
          // Focus on the item select after scanning
          setTimeout(() => {
            if (itemSelectRef.current) {
              itemSelectRef.current.focus();
            }
          }, 100);
        }}
        title="Scan Item Barcode"
      />
    </div>
  );
}

export default StockOutModal; 