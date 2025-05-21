import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { getBoxById, deleteBox, getItems, deleteItem } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import BoxModal from './BoxModal';
import ItemModal from './ItemModal';
import TransferModal from './TransferModal';
import StockInModal from './StockInModal';
import StockOutModal from './StockOutModal';
import BoxLabelModal from './BoxLabelModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import TransactionHistory from './TransactionHistory';
import './styles/BoxDetail.css'; // Import styles

// Component to display item relationship in a paragraph style
const ItemRelationship = ({ item, items }) => {
  // Find parent item if exists
  const parentItem = item.parent_item_id ? 
    items.find(i => i.id === parseInt(item.parent_item_id)) : null;
  
  // Find child items if any
  const childItems = items.filter(i => 
    i.parent_item_id && parseInt(i.parent_item_id) === item.id
  );
  
  // Group state for showing/hiding children
  const [showChildren, setShowChildren] = useState(false);
  
  if (!parentItem && childItems.length === 0) {
    return <span className="text-muted">No relationships</span>;
  }
  
  return (
    <div className="relationship-container">
      {parentItem && (
        <div className="parent-relationship mb-1">
          <i className="bi bi-arrow-up-short text-primary"></i>
          <span className="badge bg-primary me-1">Parent:</span>
          <Link to={`/items/edit/${parentItem.id}`} className="text-decoration-none">
            {parentItem.name}
          </Link>
        </div>
      )}
      
      {childItems.length > 0 && (
        <div className="child-relationships">
          <div 
            className="d-flex align-items-center cursor-pointer" 
            onClick={() => setShowChildren(!showChildren)}
            style={{ cursor: 'pointer' }}
          >
            <i className={`bi bi-${showChildren ? 'dash' : 'plus'}-square text-success me-1`}></i>
            <span className="badge bg-success">
              {childItems.length} {childItems.length === 1 ? 'Child' : 'Children'}
            </span>
          </div>
          
          {showChildren && (
            <div className="children-list mt-1 ms-3 border-start border-success ps-2">
              {childItems.map(child => (
                <div key={child.id} className="child-item mb-1">
                  <i className="bi bi-arrow-down-short text-success"></i>
                  <Link to={`/items/edit/${child.id}`} className="text-decoration-none">
                    {child.name}
                  </Link>
                  {child.type && <span className="badge bg-info ms-1 text-dark">{child.type}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function BoxDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [box, setBox] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [itemHover, setItemHover] = useState(null); // To track which item is being hovered
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [selectedItemForStock, setSelectedItemForStock] = useState(null);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [generateNewReference, setGenerateNewReference] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState('item'); // 'item' or 'box'
  const [transactionCount, setTransactionCount] = useState(0);

  // Extract reference ID from URL query params
  const queryParams = new URLSearchParams(location.search);
  const refId = queryParams.get('ref');

  // Determine API URL based on environment
  const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_URL = isLocalDevelopment ? '/api' : window.location.origin + '/api';

  useEffect(() => {
    fetchBoxDetails();
    fetchBoxItems();
  }, [id]);

  const fetchBoxDetails = async () => {
    try {
      setLoading(true);
      // Check if ID is valid before fetching
      if (id === 'new' || isNaN(parseInt(id))) {
        setError('Invalid box ID. Please select a valid box.');
        setBox(null);
        return;
      }
      
      let response;
      
      if (currentUser) {
        // Authenticated request
        response = await getBoxById(id);
      } else {
        // Unauthenticated request using the public endpoint - fixed URL path
        response = await axios.get(`${API_URL}/boxes/public/${id}/details`);
      }
      
      if (!response.data) {
        setError('Box not found. It may have been deleted.');
        setBox(null);
      } else {
        // Log the box data to help with debugging
        console.log('Box details received:', response.data);
        
        // Make sure the date formats are correct
        const boxData = response.data;
        if (boxData.updated_at) {
          // Ensure it's a valid date object or string
          console.log('Box updated_at:', boxData.updated_at);
        } else {
          console.warn('Box missing updated_at timestamp');
          // Add current time as a fallback
          boxData.updated_at = new Date().toISOString();
        }
        
        setBox(boxData);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching box details:', err);
      // Don't show authentication errors to non-authenticated users
      // They'll just see the public view with login button
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (!currentUser) {
          // For unauthenticated users, create a minimal box object with the ID
          setBox({ id: parseInt(id), box_number: `#${id}` });
          setError(null);
        } else {
          setError('You do not have permission to view this box.');
          setBox(null);
        }
      } else {
        setError('Failed to fetch box details. Please try again later.');
        setBox(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxItems = async () => {
    try {
      // Check if ID is valid before fetching
      if (id === 'new' || isNaN(parseInt(id))) {
        setItems([]);
        return;
      }
      
      let response;
      
      if (currentUser) {
        // Authenticated request
        response = await getItems(id);
      } else {
        // Unauthenticated request using the public endpoint - fixed URL path
        response = await axios.get(`${API_URL}/boxes/public/${id}`);
      }
      
      setItems(response.data || []);
    } catch (err) {
      console.error('Error fetching items for box:', err);
      setItems([]);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this box?')) {
      try {
        await deleteBox(id);
        navigate('/boxes');
      } catch (err) {
        setError('Failed to delete box. Please try again later.');
        console.error('Error deleting box:', err);
      }
    }
  };

  const openEditModal = () => {
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
  };

  const openNewItemModal = () => {
    // Use StockInModal - when clicked from ADD NEW ITEM button
    // We want to show the "New Item" tab in the modal
    setShowStockInModal(true);
    // Set the other modals to false
    setShowItemModal(false);
    setShowStockOutModal(false);
    setShowTransferModal(false);
    setSelectedItemForStock({
      isNewItemRequest: true // Special flag to indicate we want the "New Item" tab
    });
  };

  const openEditItemModal = (itemId) => {
    setSelectedItemId(itemId);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setSelectedItemId(null);
  };

  const openStockInModal = (item = null) => {
    setSelectedItemForStock(item);
    setShowStockInModal(true);
  };

  const closeStockInModal = () => {
    setShowStockInModal(false);
    setSelectedItemForStock(null);
  };

  const openStockOutModal = (item = null) => {
    setSelectedItemForStock(item);
    setShowStockOutModal(true);
  };

  const closeStockOutModal = () => {
    setShowStockOutModal(false);
    setSelectedItemForStock(null);
  };

  const handleBoxModalSuccess = () => {
    fetchBoxDetails();
  };

  const handleItemModalSuccess = () => {
    fetchBoxItems();
  };

  const handleStockSuccess = () => {
    fetchBoxItems();
    fetchBoxDetails();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    // Check if date is invalid
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openTransferModal = (item) => {
    setSelectedItemForTransfer(item);
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedItemForTransfer(null);
  };

  const handleTransferSuccess = () => {
    fetchBoxItems();
  };

  // Handle mouse enter on item card
  const handleItemMouseEnter = (itemId) => {
    setItemHover(itemId);
  };

  // Handle mouse leave on item card
  const handleItemMouseLeave = () => {
    setItemHover(null);
  };

  const handleDeleteItem = async (itemId, itemName) => {
    if (window.confirm(`Are you sure you want to delete "${itemName}"?`)) {
      try {
        await deleteItem(itemId);
        fetchBoxItems(); // Refresh the items list
        // Show temporary success message
        setError(`Item "${itemName}" has been deleted successfully.`);
        setTimeout(() => setError(null), 3000);
      } catch (err) {
        setError(`Failed to delete item: ${err.message}`);
        console.error('Error deleting item:', err);
      }
    }
  };

  // Toggle view mode between list and grid
  const toggleViewMode = () => {
    setViewMode(prevMode => prevMode === 'list' ? 'grid' : 'list');
  };

  // Render items grid view
  const renderItemsGrid = () => {
    return (
      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-2">
        {items.map(item => (
          <div className="col" key={item.id}>
            <div 
              className="card h-100 item-card"
              onMouseEnter={() => handleItemMouseEnter(item.id)}
              onMouseLeave={handleItemMouseLeave}
            >
              <div className="card-body p-2">
                <div className="d-flex justify-content-between">
                  <h6 className="card-title mb-1 text-truncate text-dark" style={{maxWidth: '80%'}}>{item.name}</h6>
                  <div className="item-actions">
                    <div className="dropdown d-inline">
                      <button 
                        className="btn btn-sm btn-link text-dark p-0" 
                        type="button"
                        data-bs-toggle="dropdown"
                      >
                        <i className="bi bi-three-dots-vertical"></i>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        <li>
                          <button 
                            className="dropdown-item" 
                            onClick={() => openEditItemModal(item.id)}
                          >
                            <i className="bi bi-pencil me-2"></i> Edit
                          </button>
                        </li>
                        <li>
                          <button 
                            className="dropdown-item" 
                            onClick={() => openStockInModal(item)}
                          >
                            <i className="bi bi-box-arrow-in-down me-2"></i> Stock In
                          </button>
                        </li>
                        <li>
                          <button 
                            className="dropdown-item" 
                            onClick={() => openStockOutModal(item)}
                          >
                            <i className="bi bi-box-arrow-up-right me-2"></i> Stock Out
                          </button>
                        </li>
                        <li>
                          <button 
                            className="dropdown-item" 
                            onClick={() => openTransferModal(item)}
                          >
                            <i className="bi bi-box-arrow-right me-2"></i> Transfer
                          </button>
                        </li>
                        <li><hr className="dropdown-divider" /></li>
                        <li>
                          <button 
                            className="dropdown-item text-danger" 
                            onClick={() => handleDeleteItem(item.id, item.name)}
                          >
                            <i className="bi bi-trash me-2"></i> Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-text small mb-1 text-dark">
                  {item.description || <span className="text-muted">No description</span>}
                </div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <div>
                    {item.type && <span className="badge bg-info text-dark me-1">{item.type}</span>}
                    <span className="badge bg-primary">{item.quantity || 1}</span>
                  </div>
                  <small className="text-muted">{item.reference_id}</small>
                </div>
                
                {/* Add item relationships display */}
                <div className="border-top pt-2 mt-1">
                  <small className="text-muted d-block mb-1">Relationships:</small>
                  <ItemRelationship item={item} items={items} />
                </div>
                
                {itemHover === item.id && (
                  <div className="hover-actions position-absolute bottom-0 end-0 mb-2 me-2">
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-sm btn-outline-primary py-0 px-2"
                        onClick={() => openEditItemModal(item.id)}
                        title="Edit"
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-success py-0 px-2"
                        onClick={() => openStockInModal(item)}
                        title="Stock In"
                      >
                        <i className="bi bi-box-arrow-in-down"></i>
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger py-0 px-2"
                        onClick={() => openStockOutModal(item)}
                        title="Stock Out"
                      >
                        <i className="bi bi-box-arrow-up-right"></i>
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                        onClick={() => openTransferModal(item)}
                        title="Transfer"
                      >
                        <i className="bi bi-box-arrow-right"></i>
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-danger py-0 px-2"
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        title="Delete"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render items list view
  const renderItemsList = () => {
    return (
      <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table className="table table-sm table-hover mb-0 sticky-header">
          <thead className="bg-light sticky-top">
            <tr>
              <th className="text-dark">Name</th>
              <th className="text-dark">Description</th>
              <th className="text-dark">Type</th>
              <th className="text-dark">Quantity</th>
              <th className="text-dark">Serial</th>
              <th className="text-dark">Relationships</th>
              <th className="text-end text-dark">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} 
                onMouseEnter={() => handleItemMouseEnter(item.id)}
                onMouseLeave={handleItemMouseLeave}
                style={{
                  background: itemHover === item.id ? 'rgba(0,123,255,0.05)' : 'transparent'
                }}
              >
                <td className="fw-bold text-dark">{item.name}</td>
                <td className="text-dark">{item.description || '-'}</td>
                <td className="text-dark">{item.type || '-'}</td>
                <td className="text-dark">{item.quantity || 1}</td>
                <td className="text-monospace small text-dark">{item.reference_id || '-'}</td>
                <td>
                  <ItemRelationship item={item} items={items} />
                </td>
                <td className="text-end">
                  <div className="action-buttons">
                    <button 
                      className="btn btn-sm btn-outline-primary py-0 px-2 me-1" 
                      onClick={() => openEditItemModal(item.id)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-success py-0 px-2 me-1" 
                      onClick={() => openStockInModal(item)}
                      title="Stock In"
                    >
                      <i className="bi bi-box-arrow-in-down"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger py-0 px-2 me-1" 
                      onClick={() => openStockOutModal(item)}
                      title="Stock Out"
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-secondary py-0 px-2 me-1" 
                      onClick={() => openTransferModal(item)}
                      title="Transfer"
                    >
                      <i className="bi bi-box-arrow-right"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-outline-danger py-0 px-2" 
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      title="Delete"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const openLabelModal = (generateNew = false) => {
    setGenerateNewReference(generateNew);
    setShowLabelModal(true);
  };

  const closeLabelModal = () => {
    setShowLabelModal(false);
    setGenerateNewReference(false);
  };

  const handleLogin = () => {
    // Redirect to login page, then return to this box after login
    navigate(`/login?redirect=/boxes/${id}${refId ? `?ref=${refId}` : ''}`);
  };

  // Helper function to determine text color based on background color
  const getContrastColor = (hexColor) => {
    // Default to white if no color provided
    if (!hexColor) return '#ffffff';
    
    // Convert hex to RGB
    let hex = hexColor.replace('#', '');
    
    // Handle shorthand hex format (e.g., #FFF)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate perceived brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Use white text for dark backgrounds, black text for light backgrounds
    return brightness > 125 ? '#000000' : '#ffffff';
  };

  // Handle barcode scan result
  const handleScanResult = (result) => {
    console.log('Scan result:', result);
    
    if (scannerMode === 'item') {
      // Search for item by barcode/EAN
      const foundItem = items.find(item => 
        item.ean_code === result || 
        item.serial_number === result ||
        item.reference_id === result
      );
      
      if (foundItem) {
        // Item found - open stock out modal for this item
        setSelectedItemForStock(foundItem);
        setShowStockOutModal(true);
      } else {
        // Item not found - open stock in modal to add it
        setShowStockInModal(true);
      }
    } else if (scannerMode === 'box') {
      // Try to find box by reference ID or QR code URL
      const urlMatch = result.match(/\/boxes\/(\d+)(\?|$)/);
      if (urlMatch) {
        const boxId = urlMatch[1];
        navigate(`/boxes/${boxId}`);
      } else {
        // Handle box reference ID format (BOX-XXXX-XXXXXX)
        const boxRefMatch = result.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
        if (boxRefMatch) {
          // Search for box with this reference
          // For now, just show an alert
          alert(`Box reference scanned: ${result}. This would search for the box.`);
        }
      }
    }
  };

  // Add a floating action button for scanning in the bottom right corner
  const renderScanButton = () => {
    if (!currentUser) return null; // Only show for authenticated users
    
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <div className="dropup">
          <button 
            className="btn btn-lg btn-primary rounded-circle shadow"
            style={{ width: '60px', height: '60px' }}
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="bi bi-camera-fill"></i>
          </button>
          <ul className="dropdown-menu">
            <li>
              <button 
                className="dropdown-item" 
                onClick={() => {
                  setScannerMode('item');
                  setShowScanner(true);
                }}
              >
                <i className="bi bi-upc-scan me-2"></i>
                Scan Item
              </button>
            </li>
            <li>
              <button 
                className="dropdown-item" 
                onClick={() => {
                  setScannerMode('box');
                  setShowScanner(true);
                }}
              >
                <i className="bi bi-box me-2"></i>
                Scan Box
              </button>
            </li>
          </ul>
        </div>
      </div>
    );
  };

  // Callback to receive transaction count from TransactionHistory component
  const handleTransactionCountUpdate = useCallback((count) => {
    setTransactionCount(count);
  }, []);

  if (loading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
        <p className="text-center mt-2">Loading box information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">
          <h4 className="alert-heading">Error</h4>
          <p>{error}</p>
          <div className="mt-3">
            {!currentUser && (
              <button className="btn btn-primary" onClick={handleLogin}>
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Login
              </button>
            )}
            <Link to="/boxes" className="btn btn-secondary ms-2">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Boxes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!box) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          <h4 className="alert-heading">Box Not Found</h4>
          <p>The box you're looking for could not be found.</p>
          <div className="mt-3">
            {!currentUser && (
              <button className="btn btn-primary" onClick={handleLogin}>
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Login
              </button>
            )}
            <Link to="/boxes" className="btn btn-secondary ms-2">
              <i className="bi bi-arrow-left me-2"></i>
              Back to Boxes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // For non-authenticated users, show a simplified view
  if (!currentUser) {
    return (
      <div className="container mt-2 mb-5 px-2">
        <div className="card">
          <div className="card-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-box me-2"></i>
                Box #{box.box_number}
              </h5>
              <span className="badge bg-light text-dark">Public View</span>
            </div>
          </div>
          
          <div className="card-body">
            <div className="mb-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
                <h6 className="card-subtitle text-muted mb-0">Box Details</h6>
                <button 
                  className="btn btn-sm btn-primary" 
                  onClick={handleLogin}
                >
                  <i className="bi bi-box-arrow-in-right me-1"></i>
                  Login to Edit
                </button>
              </div>
              
              <div className="row g-2 mt-2">
                {box.description && (
                  <div className="col-md-6">
                    <strong>Description:</strong> {box.description}
                  </div>
                )}
                
                {box.location_name && (
                  <div className="col-md-6">
                    <strong>Location:</strong> 
                    <span 
                      className="badge ms-1" 
                      style={{ 
                        backgroundColor: box.location_color || '#6c757d',
                        color: getContrastColor(box.location_color)
                      }}
                    >
                      {box.location_name}
                    </span>
                  </div>
                )}
                
                {box.shelf_name && (
                  <div className="col-md-6">
                    <strong>Shelf:</strong> {box.shelf_name}
                  </div>
                )}
                
                {box.serial_number && (
                  <div className="col-md-6">
                    <strong>Serial Number:</strong> {box.serial_number}
                  </div>
                )}
                
                {box.reference_id && (
                  <div className="col-md-6">
                    <strong>Reference ID:</strong> {box.reference_id}
                  </div>
                )}
              </div>
            </div>
            
            <hr />
            
            <h6 className="card-subtitle text-muted mb-3">Box Contents</h6>
            
            {items.length === 0 ? (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                This box is empty. No items found.
              </div>
            ) : (
              <>
                <p className="text-muted small mb-3">
                  <i className="bi bi-boxes me-1"></i>
                  {items.length} {items.length === 1 ? 'item' : 'items'} in this box
                </p>
                
                <div className="table-responsive">
                  <table className="table table-hover table-striped table-sm border">
                    <thead className="table-light">
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>SN/Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.name}</strong>
                            {item.description && (
                              <div className="small text-muted text-truncate" style={{maxWidth: '200px'}}>
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td>{item.type || '-'}</td>
                          <td className="text-center">
                            <span className="badge bg-primary rounded-pill">
                              {item.quantity || 0}
                            </span>
                          </td>
                          <td>
                            {item.serial_number && (
                              <div className="small">
                                <strong>SN:</strong> {item.serial_number}
                              </div>
                            )}
                            {item.supplier && (
                              <div className="small text-muted">
                                <strong>Supplier:</strong> {item.supplier}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          
          <div className="card-footer">
            <div className="d-flex justify-content-center">
              <button 
                className="btn btn-primary" 
                onClick={handleLogin}
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Login to Make Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For authenticated users, show the full interface
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <small className="text-muted">BOX</small>
          <h2 className="h5 mb-0">#{box.box_number}</h2>
        </div>
        <div>
          <button 
            className="btn btn-info btn-sm me-1 py-0 px-2"
            onClick={() => openLabelModal(false)}
            title="Generate Label"
          >
            <i className="bi bi-tag me-1"></i>
            LABEL
          </button>
          <Link to="/boxes" className="btn btn-secondary btn-sm me-1 py-0 px-2">
            BACK
          </Link>
          <button 
            className="btn btn-warning btn-sm me-1 py-0 px-2"
            onClick={openEditModal}
          >
            EDIT
          </button>
          <button className="btn btn-danger btn-sm py-0 px-2" onClick={handleDelete}>
            DEL
          </button>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-body p-3">
              <div className="row g-3">
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block">Location</small>
                  <span className="small">
                    {box.location_name ? (
                      <span 
                        className="badge" 
                        style={{ 
                          backgroundColor: box.location_color || '#6c757d',
                          color: getContrastColor(box.location_color)
                        }}
                      >
                        {box.location_name}
                      </span>
                    ) : '-'}
                  </span>
                </div>
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block fw-bold">Shelf</small>
                  <span className="small fw-bold text-primary">
                    <i className="bi bi-bookmark-fill me-1 text-info"></i>
                    {box.shelf_name || '-'}
                  </span>
                </div>
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block">Reference ID</small>
                  <span className="small text-monospace">{box.reference_id || '-'}</span>
                </div>
                <div className="col-12 mb-1">
                  <small className="text-muted d-block">Description</small>
                  <span className="small">{box.description || '-'}</span>
                </div>
                <div className="col-6 col-md-4">
                  <small className="text-muted d-block">Last Updated</small>
                  <span className="small">
                    {box.updated_at ? (
                      formatDate(box.updated_at)
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body p-3 d-flex flex-column justify-content-between">
              <h6 className="card-subtitle mb-3 text-muted">Quick Actions</h6>
              <div className="d-grid gap-3">
                <button 
                  className="btn btn-success py-2 flex-grow-1"
                  onClick={() => openStockInModal()}
                >
                  <i className="bi bi-box-arrow-in-down me-2"></i> STOCK IN
                </button>
                <button 
                  className="btn btn-danger py-2 flex-grow-1"
                  onClick={() => openStockOutModal()}
                >
                  <i className="bi bi-arrow-up-right-square me-2"></i> STOCK OUT
                </button>
                <button 
                  className="btn btn-dark py-2 flex-grow-1"
                  onClick={openNewItemModal}
                >
                  <i className="bi bi-plus-circle me-2"></i> ADD NEW ITEM
                </button>
                <button 
                  className="btn btn-info py-2 flex-grow-1"
                  onClick={() => openLabelModal(true)}
                >
                  <i className="bi bi-tag me-2"></i> PRINT NEW LABEL
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex align-items-center">
          <small className="text-dark fw-bold me-2">ITEMS IN THIS BOX</small>
          <small className="badge bg-secondary">{items.length || 0}</small>
        </div>
        
        <div className="d-flex align-items-center">
          <div className="btn-group btn-group-sm me-2">
            <button 
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <i className="bi bi-list"></i>
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
          </div>
        </div>
      </div>
      
      {items.length > 0 ? (
        <div className="card mb-3">
          <div className="card-body p-2" style={{ overflow: 'hidden' }}>
            {viewMode === 'grid' ? renderItemsGrid() : renderItemsList()}
          </div>
        </div>
      ) : (
        <div className="card mb-3">
          <div className="card-body p-2 text-center">
            <small>No items in this box</small>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <small className="text-muted">TRANSACTION HISTORY</small>
        <small className="badge bg-secondary">{transactionCount}</small>
      </div>
      
      <div className="card mb-3">
        <div className="card-body p-0">
          {box && box.id ? (
            <TransactionHistory 
              boxId={box.id}
              hideFilters={true}
              size="sm"
              variant="rounded"
              onCountUpdate={handleTransactionCountUpdate}
            />
          ) : (
            <div className="p-3 text-center">
              <small>No transaction history</small>
            </div>
          )}
        </div>
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <ItemModal
          show={showItemModal}
          handleClose={closeItemModal}
          itemId={selectedItemId}
          boxId={id}
          onSuccess={handleItemModalSuccess}
        />
      )}

      {/* Box Edit Modal */}
      {showEditModal && (
        <BoxModal
          show={showEditModal}
          handleClose={closeEditModal}
          boxId={id}
          onSuccess={handleBoxModalSuccess}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedItemForTransfer && (
        <TransferModal
          show={showTransferModal}
          handleClose={closeTransferModal}
          itemId={selectedItemForTransfer.id}
          itemName={selectedItemForTransfer.name}
          currentBoxId={id}
          onSuccess={handleTransferSuccess}
        />
      )}

      {/* Stock In Modal */}
      {showStockInModal && (
        <StockInModal
          show={showStockInModal}
          handleClose={closeStockInModal}
          preselectedItem={selectedItemForStock}
          preselectedBoxId={id}
          onSuccess={handleStockSuccess}
          // If opened from ADD NEW ITEM, set newItemMode=true
          // Otherwise, default to existing mode (opened from STOCK IN button)
          newItemMode={selectedItemForStock && selectedItemForStock.isNewItemRequest ? true : false}
        />
      )}

      {/* Stock Out Modal */}
      {showStockOutModal && (
        <StockOutModal
          show={showStockOutModal}
          handleClose={closeStockOutModal}
          preselectedItemId={selectedItemForStock ? selectedItemForStock.id : null}
          preselectedBoxId={id}
          onSuccess={handleStockSuccess}
        />
      )}

      {/* Box Label Modal */}
      {showLabelModal && (
        <BoxLabelModal
          show={showLabelModal}
          handleClose={closeLabelModal}
          box={box}
          generateReference={generateNewReference}
        />
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        show={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScanResult}
        title={scannerMode === 'item' ? 'Scan Item Barcode' : 'Scan Box QR Code'}
      />
      
      {/* Floating scan button */}
      {renderScanButton()}
    </div>
  );
}

export default BoxDetail; 