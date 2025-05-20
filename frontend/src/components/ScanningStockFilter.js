import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStockHistory, getItems, getBoxes } from '../services/api';
import BarcodeScanner from './BarcodeScanner';

const ScanningStockFilter = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [error, setError] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');
  const [boxItems, setBoxItems] = useState([]);
  const [scanningForItem, setScanningForItem] = useState(false);
  
  // Filter states
  const [selectedBox, setSelectedBox] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Load initial data and parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const boxId = params.get('box_id');
    const itemId = params.get('item_id');
    const type = params.get('type');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const page = parseInt(params.get('page')) || 1;
    const scanParam = params.get('scan');
    const tab = params.get('tab');
    
    if (tab && ['transactions', 'items'].includes(tab)) {
      setActiveTab(tab);
    }
    
    if (boxId) setSelectedBox(boxId);
    if (itemId) setSelectedItem(itemId);
    if (type) setTransactionType(type);
    if (startDate) setDateRange(prev => ({ ...prev, startDate }));
    if (endDate) setDateRange(prev => ({ ...prev, endDate }));
    setCurrentPage(page);
    
    // Fetch reference data
    fetchBoxes();
    fetchItems().then(() => {
      // Process scan parameter if present
      if (scanParam) {
        // We need to wait for boxes and items to be loaded before processing the scan
        setTimeout(() => {
          handleScan(scanParam);
          
          // Remove the scan parameter from the URL to prevent re-scanning on refresh
          const newParams = new URLSearchParams(location.search);
          newParams.delete('scan');
          navigate({ search: newParams.toString() }, { replace: true });
        }, 500);
      }
    });
    
    // Fetch transactions based on URL parameters
    fetchTransactions(itemId, type, startDate, endDate);
  }, [location.search]);

  // Fetch boxes
  const fetchBoxes = async () => {
    try {
      const response = await getBoxes();
      setBoxes(response.data || []);
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setError('Failed to load boxes. Please try again.');
    }
  };

  // Fetch items
  const fetchItems = async (boxId = null) => {
    try {
      const response = await getItems(boxId);
      setItems(response.data || []);
      
      // If a box ID is provided, also set boxItems
      if (boxId) {
        setBoxItems(response.data || []);
      }
      
      return response.data || [];
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to load items. Please try again.');
      return [];
    }
  };

  // Fetch transactions with filters
  const fetchTransactions = async (itemId = null, type = null, startDate = null, endDate = null) => {
    try {
      setLoading(true);
      const response = await getStockHistory(itemId, type, startDate, endDate);
      setTransactions(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching stock history:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle box selection
  const handleBoxChange = (e) => {
    const boxId = e.target.value;
    setSelectedBox(boxId);
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    if (boxId) {
      params.set('box_id', boxId);
      // Filter items by selected box
      fetchItems(boxId);
      
      // Switch to items tab when a box is selected
      setActiveTab('items');
      params.set('tab', 'items');
    } else {
      params.delete('box_id');
      fetchItems();
    }
    
    // Reset item selection if box changes
    setSelectedItem('');
    params.delete('item_id');
    
    // Reset to page 1
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
  };

  // Handle item selection
  const handleItemChange = (e) => {
    const itemId = e.target.value;
    setSelectedItem(itemId);
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    if (itemId) {
      params.set('item_id', itemId);
      
      // Switch to transactions tab when an item is selected
      setActiveTab('transactions');
      params.set('tab', 'transactions');
    } else {
      params.delete('item_id');
    }
    
    // Reset to page 1
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    fetchTransactions(
      itemId || null, 
      transactionType || null, 
      dateRange.startDate || null, 
      dateRange.endDate || null
    );
  };

  // Handle transaction type filter
  const handleTypeChange = (e) => {
    const type = e.target.value;
    setTransactionType(type);
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    if (type) {
      params.set('type', type);
    } else {
      params.delete('type');
    }
    
    // Reset to page 1
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    fetchTransactions(
      selectedItem || null, 
      type || null, 
      dateRange.startDate || null, 
      dateRange.endDate || null
    );
  };

  // Handle date range changes
  const handleDateChange = (field, value) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set(field === 'startDate' ? 'start_date' : 'end_date', value);
    } else {
      params.delete(field === 'startDate' ? 'start_date' : 'end_date');
    }
    
    // Reset to page 1
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    fetchTransactions(
      selectedItem || null, 
      transactionType || null, 
      newDateRange.startDate || null, 
      newDateRange.endDate || null
    );
  };

  // Handle barcode scan
  const handleScan = (scannedCode) => {
    console.log('Scanned code:', scannedCode);
    setShowScanner(false);
    setScanningForItem(false);
    
    // Check if it's a box barcode
    const boxMatch = scannedCode.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
    if (boxMatch) {
      const boxNumber = boxMatch[1].replace(/^0+/, ''); // Remove leading zeros
      
      // Find the box with this number
      const matchedBox = boxes.find(box => 
        box.box_number === boxNumber || 
        box.box_number.endsWith(boxNumber)
      );
      
      if (matchedBox) {
        // Set the box and update filters
        setSelectedBox(matchedBox.id);
        
        // Update URL parameters
        const params = new URLSearchParams(location.search);
        params.set('box_id', matchedBox.id);
        params.set('page', 1);
        setCurrentPage(1);
        
        // Switch to items tab
        setActiveTab('items');
        params.set('tab', 'items');
        
        navigate({ search: params.toString() });
        
        // Update items for this box
        fetchItems(matchedBox.id).then(boxItemsData => {
          setBoxItems(boxItemsData);
          
          // If there's only one item in the box, auto-select it
          if (boxItemsData.length === 1) {
            setSelectedItem(boxItemsData[0].id);
            
            // Update URL with the selected item
            const itemParams = new URLSearchParams(location.search);
            itemParams.set('item_id', boxItemsData[0].id);
            
            // Switch to transactions tab
            setActiveTab('transactions');
            itemParams.set('tab', 'transactions');
            
            navigate({ search: itemParams.toString() });
            
            // Fetch transactions for this item
            fetchTransactions(
              boxItemsData[0].id, 
              transactionType || null, 
              dateRange.startDate || null, 
              dateRange.endDate || null
            );
          } else if (boxItemsData.length > 1) {
            // If multiple items, prompt to scan item
            setTimeout(() => {
              setScanningForItem(true);
              setShowScanner(true);
            }, 500);
          }
        });
        return;
      }
    }
    
    // Check if it's an item barcode (EAN code) and we're in item scanning mode
    const matchedItem = items.find(item => item.ean_code === scannedCode);
    if (matchedItem) {
      // Set the item and update filters
      setSelectedItem(matchedItem.id);
      
      // Update URL parameters
      const params = new URLSearchParams(location.search);
      params.set('item_id', matchedItem.id);
      params.set('page', 1);
      setCurrentPage(1);
      
      // Switch to transactions tab
      setActiveTab('transactions');
      params.set('tab', 'transactions');
      
      navigate({ search: params.toString() });
      
      // Fetch transactions for this item
      fetchTransactions(
        matchedItem.id, 
        transactionType || null, 
        dateRange.startDate || null, 
        dateRange.endDate || null
      );
      return;
    }
    
    // If no match found
    setError(`No box or item found for scan value: ${scannedCode}`);
    setTimeout(() => setError(''), 3000);
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ search: params.toString() });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedBox('');
    setSelectedItem('');
    setTransactionType('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
    setBoxItems([]);
    
    // Clear URL parameters but keep the active tab
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    navigate({ search: params.toString() });
    
    // Fetch all items and unfiltered transactions
    fetchItems();
    fetchTransactions();
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get transaction type badge
  const getTransactionTypeBadge = (type) => {
    switch(type) {
      case 'in':
        return <span className="badge bg-success">Stock In</span>;
      case 'out':
        return <span className="badge bg-danger">Stock Out</span>;
      case 'delete':
        return <span className="badge bg-warning">Delete</span>;
      case 'transfer':
        return <span className="badge bg-info">Transfer</span>;
      case 'update':
        return <span className="badge bg-primary">Update</span>;
      case 'create':
        return <span className="badge bg-secondary">Creation</span>;
      default:
        return <span className="badge bg-secondary">Unknown</span>;
    }
  };

  // Pagination logic
  const indexOfLastTransaction = currentPage * itemsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - itemsPerPage;
  const currentTransactions = transactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    
    const params = new URLSearchParams(location.search);
    params.set('page', pageNumber);
    navigate({ search: params.toString() });
    setCurrentPage(pageNumber);
    
    // Scroll to top of the table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mt-4">
      <div className="row mb-4">
        <div className="col">
          <h2>Stock Management</h2>
          <p>Scan boxes or items to manage inventory</p>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {/* Scanning button */}
      <div className="row mb-4">
        <div className="col">
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setScanningForItem(false);
              setShowScanner(true);
            }}
          >
            <i className="bi bi-upc-scan me-2"></i>
            Scan Box/Item
          </button>
          
          {selectedBox && (
            <button 
              className="btn btn-outline-primary ms-2" 
              onClick={() => {
                setScanningForItem(true);
                setShowScanner(true);
              }}
            >
              <i className="bi bi-search me-2"></i>
              Scan Item in Box
            </button>
          )}
        </div>
      </div>
      
      {/* Scanner modal */}
      {showScanner && (
        <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {scanningForItem 
                    ? `Scan Item in Box #${boxes.find(b => b.id === parseInt(selectedBox))?.box_number || selectedBox}`
                    : 'Scan Box or Item'}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowScanner(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <BarcodeScanner 
                  onScan={handleScan} 
                  onClose={() => setShowScanner(false)}
                  scannerTitle={scanningForItem ? "Scan Item Barcode" : "Scan Box or Item Barcode"}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter controls */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <label htmlFor="boxSelect" className="form-label">Box</label>
          <select 
            id="boxSelect" 
            className="form-select"
            value={selectedBox}
            onChange={handleBoxChange}
          >
            <option value="">All Boxes</option>
            {boxes.map(box => (
              <option key={box.id} value={box.id}>
                Box #{box.box_number} - {box.description || 'No description'}
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-md-3 mb-3">
          <label htmlFor="itemSelect" className="form-label">Item</label>
          <select 
            id="itemSelect" 
            className="form-select"
            value={selectedItem}
            onChange={handleItemChange}
          >
            <option value="">All Items</option>
            {(selectedBox ? boxItems : items).map(item => (
              <option key={item.id} value={item.id}>
                {item.name} {item.serial_number ? `(${item.serial_number})` : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-md-2 mb-3">
          <label htmlFor="typeSelect" className="form-label">Transaction Type</label>
          <select 
            id="typeSelect" 
            className="form-select"
            value={transactionType}
            onChange={handleTypeChange}
          >
            <option value="">All Transactions</option>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="transfer">Transfers</option>
            <option value="update">Updates</option>
            <option value="create">Creation</option>
            <option value="delete">Delete</option>
          </select>
        </div>
        
        <div className="col-md-2 mb-3">
          <label htmlFor="startDate" className="form-label">Start Date</label>
          <input 
            type="date" 
            id="startDate" 
            className="form-control"
            value={dateRange.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
          />
        </div>
        
        <div className="col-md-2 mb-3">
          <label htmlFor="endDate" className="form-label">End Date</label>
          <input 
            type="date" 
            id="endDate" 
            className="form-control"
            value={dateRange.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
          />
        </div>
      </div>
      
      <div className="row mb-3">
        <div className="col">
          <button 
            className="btn btn-outline-secondary" 
            onClick={clearFilters}
          >
            Clear Filters
          </button>
        </div>
      </div>
      
      {/* Tabs navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => handleTabChange('transactions')}
          >
            <i className="bi bi-clock-history me-1"></i>
            Transactions
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => handleTabChange('items')}
          >
            <i className="bi bi-box me-1"></i>
            Box Items {selectedBox && `(${boxItems.length})`}
          </button>
        </li>
      </ul>
      
      {/* Tab content */}
      <div className="tab-content">
        {/* Transactions tab */}
        <div className={`tab-pane fade ${activeTab === 'transactions' ? 'show active' : ''}`}>
          {loading ? (
            <div className="text-center my-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <>
              {transactions.length === 0 ? (
                <div className="alert alert-info">
                  No transactions found matching the selected filters.
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Item</th>
                          <th>Box</th>
                          <th>Type</th>
                          <th>Quantity</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTransactions.map(transaction => (
                          <tr key={transaction.id}>
                            <td>{formatDate(transaction.created_at)}</td>
                            <td>{transaction.item_name}</td>
                            <td>
                              {transaction.box_id ? (
                                boxes.find(b => b.id === parseInt(transaction.box_id))?.box_number || 
                                `Box #${transaction.box_id}`
                              ) : 'N/A'}
                            </td>
                            <td>{getTransactionTypeBadge(transaction.type)}</td>
                            <td>{transaction.quantity}</td>
                            <td>{transaction.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <nav aria-label="Transaction history pagination">
                      <ul className="pagination justify-content-center">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                        </li>
                        
                        {[...Array(totalPages).keys()].map(number => (
                          <li 
                            key={number + 1} 
                            className={`page-item ${currentPage === number + 1 ? 'active' : ''}`}
                          >
                            <button 
                              className="page-link" 
                              onClick={() => paginate(number + 1)}
                            >
                              {number + 1}
                            </button>
                          </li>
                        ))}
                        
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                          <button 
                            className="page-link" 
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </li>
                      </ul>
                    </nav>
                  )}
                </>
              )}
            </>
          )}
        </div>
        
        {/* Items tab */}
        <div className={`tab-pane fade ${activeTab === 'items' ? 'show active' : ''}`}>
          {selectedBox ? (
            boxItems.length > 0 ? (
              <div className="row">
                {boxItems.map(item => (
                  <div key={item.id} className="col-md-4 mb-3">
                    <div className="card h-100">
                      <div className="card-body">
                        <h5 className="card-title">{item.name}</h5>
                        {item.serial_number && (
                          <h6 className="card-subtitle mb-2 text-muted">SN: {item.serial_number}</h6>
                        )}
                        <p className="card-text">
                          {item.description || 'No description'}
                        </p>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="badge bg-primary">Qty: {item.quantity}</span>
                          <div className="btn-group">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => {
                                // Open stock in modal
                                navigate(`/stock?action=stock-in&item_id=${item.id}&box_id=${selectedBox}`);
                              }}
                            >
                              <i className="bi bi-plus-circle me-1"></i>
                              IN
                            </button>
                            <button 
                              className="btn btn-sm btn-danger"
                              onClick={() => {
                                // Open stock out modal
                                navigate(`/stock?action=stock-out&item_id=${item.id}&box_id=${selectedBox}`);
                              }}
                            >
                              <i className="bi bi-dash-circle me-1"></i>
                              OUT
                            </button>
                            <button 
                              className="btn btn-sm btn-info"
                              onClick={() => {
                                // Select this item and view its transactions
                                setSelectedItem(item.id);
                                setActiveTab('transactions');
                                
                                const params = new URLSearchParams(location.search);
                                params.set('item_id', item.id);
                                params.set('tab', 'transactions');
                                navigate({ search: params.toString() });
                                
                                fetchTransactions(
                                  item.id,
                                  transactionType || null,
                                  dateRange.startDate || null,
                                  dateRange.endDate || null
                                );
                              }}
                            >
                              <i className="bi bi-clock-history me-1"></i>
                              History
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-info">
                No items found in this box.
              </div>
            )
          ) : (
            <div className="alert alert-info">
              Please select a box to view its items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanningStockFilter; 