import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getItems, deleteItem, getBoxes, bulkTransferItems, bulkDeleteItems, refreshItemsView } from '../services/api';
import api from '../services/api'; // Import the API service
import ItemModal from './ItemModal';
import TransferModal from './TransferModal';
import BulkTransferModal from './BulkTransferModal';
import StockInModal from './StockInModal';
import StockOutModal from './StockOutModal';
import RelationshipModal from './RelationshipModal';
import QRCodeLabel from './QRCodeLabel';
import ItemLabelPrinting from './ItemLabelPrinting';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import ErrorBoundary from './common/ErrorBoundary';
import { useApi } from '../contexts/ApiServiceContext';
import webSocketService from '../services/webSocketService';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Tooltip } from 'bootstrap';

// Component to display item relationship with simple arrows for child items
const ItemRelationship = ({ item, allItems, onOpenRelationshipModal }) => {
  // Normalize item ID to a number
  const itemId = parseInt(item.id, 10);
  
  // Find child items if any - make sure parent_item_id is properly compared
  const childItems = allItems.filter(i => {
    if (!i.parent_item_id) return false;
    
    // Normalize both IDs to numbers for comparison
    const childParentId = parseInt(i.parent_item_id, 10);
    
    // Check if this is a child of the current item
    const isChild = childParentId === itemId;
    
    if (isChild) {
      console.log(`Found child relationship: Item ${i.id} (${i.name}) is child of ${itemId} (${item.name})`);
    }
    
    return isChild;
  });
  
  // Group state for showing/hiding children
  const [showChildren, setShowChildren] = useState(false);
  
  // Calculate if any children have their own children (grandchildren)
  const hasGrandchildren = childItems.some(childItem => {
    const childItemId = parseInt(childItem.id, 10);
    return allItems.some(i => {
      if (!i.parent_item_id) return false;
      const possibleChildParentId = parseInt(i.parent_item_id, 10);
      return possibleChildParentId === childItemId;
    });
  });
  
  if (childItems.length === 0) {
    return (
      <div className="d-flex align-items-center">
        <span className="text-muted fst-italic">None</span>
        <button 
          className="btn btn-sm btn-link text-primary py-0 px-2 ms-2"
          onClick={() => onOpenRelationshipModal(item)}
          title="Add child items"
        >
          <small>+ Add</small>
        </button>
      </div>
    );
  }
  
  return (
    <div className="child-items-container">
      {/* Key 1: Visual relationship identifier - shows a small visual key above the items */}
      <div className="d-flex align-items-center justify-content-start mb-1">
        <div className="relationship-key d-flex align-items-center" style={{ fontSize: '0.7rem' }}>
          <span className="badge bg-secondary me-1" style={{ width: '12px', height: '12px' }}></span>
          <span className="text-muted me-2">Parent</span>
          <span className="badge bg-info me-1" style={{ width: '12px', height: '12px' }}></span>
          <span className="text-muted me-2">Child</span>
          {hasGrandchildren && (
            <>
              <span className="badge bg-success me-1" style={{ width: '12px', height: '12px' }}></span>
              <span className="text-muted">Nested</span>
            </>
          )}
        </div>
      </div>
      
      <div className="d-flex align-items-center mb-2">
        <button 
          className={`btn btn-sm btn-outline-success rounded-pill shadow-sm d-flex align-items-center ${showChildren ? 'active' : ''}`}
          onClick={() => setShowChildren(!showChildren)}
          style={{ cursor: 'pointer' }}
        >
          <span className="badge bg-success text-white rounded-circle me-1 d-flex align-items-center justify-content-center" style={{width: "20px", height: "20px"}}>
            {childItems.length}
          </span>
          <small className="me-1">{childItems.length === 1 ? 'Child Item' : 'Child Items'}</small>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" 
            className={`bi ${showChildren ? 'bi-chevron-up' : 'bi-chevron-down'}`} 
            viewBox="0 0 16 16">
            {showChildren ? (
              <path fillRule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
            ) : (
              <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
            )}
          </svg>
        </button>
        
        <button 
          className="btn btn-sm btn-link text-primary py-0 ms-2"
          onClick={(e) => {
            e.stopPropagation();
            onOpenRelationshipModal(item);
          }}
          title="Add more child items"
        >
          <small>+ Add More</small>
        </button>
      </div>
      
      {showChildren && (
        <div className="children-list mt-1 mb-3 border-start border-success ps-3 bg-light bg-opacity-50 rounded-end py-2">
          {/* Key 2: Parent node indicator */}
          <div className="parent-node d-flex align-items-center mb-3 bg-white rounded py-1 px-2 shadow-sm">
            <span className="badge bg-secondary text-white rounded-circle me-2 d-flex align-items-center justify-content-center" style={{width: "20px", height: "20px"}}>P</span>
            <div className="fw-medium">{item.name}</div>
            {item.type && <span className="badge bg-secondary ms-2">{item.type}</span>}
          </div>
          
          <div className="mb-2 ps-2">
            <small className="text-success fw-medium">Child Items:</small>
          </div>
          
          {/* Key 3: Hierarchical connection lines */}
          <div className="hierarchy-container position-relative" style={{ paddingLeft: '12px' }}>
            {childItems.map((child, index) => {
              // Check if this child has its own children
              const childId = parseInt(child.id, 10);
              const hasOwnChildren = allItems.some(i => {
                if (!i.parent_item_id) return false;
                const possibleParentId = parseInt(i.parent_item_id, 10);
                return possibleParentId === childId;
              });
              
              // Count the number of child's children
              const childrenCount = allItems.filter(i => {
                if (!i.parent_item_id) return false;
                const possibleParentId = parseInt(i.parent_item_id, 10);
                return possibleParentId === childId;
              }).length;
              
              return (
                <div key={child.id} className="position-relative">
                  {/* Connection line */}
                  <div 
                    className="connection-line position-absolute" 
                    style={{ 
                      top: '0', 
                      left: '-12px', 
                      width: '12px', 
                      height: '50%', 
                      borderBottom: '1px solid #198754', 
                      borderLeft: index > 0 ? '1px solid #198754' : 'none'
                    }}
                  ></div>
                  
                  <div className="child-item d-flex align-items-center mb-2 bg-white rounded py-1 px-2 shadow-sm">
                    {/* Item icon based on whether it has children */}
                    {hasOwnChildren ? (
                      <span className="badge bg-success text-white rounded-circle me-2 d-flex align-items-center justify-content-center" style={{width: "20px", height: "20px"}}>
                        {childrenCount}
                      </span>
                    ) : (
                      <span className="badge bg-info text-white rounded-circle me-2 d-flex align-items-center justify-content-center" style={{width: "20px", height: "20px"}}>
                        C
                      </span>
                    )}
                    
                    <Link to={`/items/edit/${child.id}`} className="text-decoration-none text-dark d-flex align-items-center flex-grow-1">
                      <span className="fw-medium">{child.name}</span>
                      {child.type && <small className="badge bg-info bg-opacity-25 text-dark rounded-pill px-2 ms-1">{child.type}</small>}
                      {child.quantity > 0 && <small className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 ms-1">Qty: {child.quantity}</small>}
                    </Link>
                    
                    {hasOwnChildren && (
                      <Link 
                        to={`/items?parent_id=${child.id}`}
                        className="btn btn-sm btn-outline-info py-0 rounded-pill ms-2"
                        title="View child items"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <small><i className="bi bi-diagram-3"></i></small>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {childItems.length > 3 && (
            <div className="text-center mt-2 mb-1">
              <Link 
                to={`/items?parent_id=${item.id}`}
                className="btn btn-sm btn-outline-success py-0 px-3 rounded-pill"
              >
                <small>View all {childItems.length} child items</small>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to get item type from localStorage if not in database
const getItemType = (item) => item.type || null;

// Helper function to get item serial number from localStorage if not in database
const getItemSerialNumber = (item) => item.serial_number || null;

// Helper function to get item EAN code from database or localStorage
const getItemEanCode = (item) => item.ean_code || null;

// Helper function to determine whether to use black or white text based on background color
const getContrastYIQ = (hexcolor) => {
  // Default to a light gray if no color is provided
  if (!hexcolor) return '#000000';
  
  // Remove # if present
  hexcolor = hexcolor.replace('#', '');
  
  // Convert 3-digit hex to 6-digits
  if (hexcolor.length === 3) {
    hexcolor = hexcolor[0] + hexcolor[0] + hexcolor[1] + hexcolor[1] + hexcolor[2] + hexcolor[2];
  }
  
  // Convert hex to RGB
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  
  // Calculate YIQ contrast formula
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // Return black for light colors, white for dark colors
  return (yiq >= 128) ? '#000000' : '#ffffff';
};

// Sort icon component
const SortIcon = ({ currentSort, currentDirection, column }) => {
  if (currentSort !== column) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" className="bi bi-arrow-down-up ms-1 text-muted opacity-50" viewBox="0 0 16 16">
        <path fillRule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5zm-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4.5 13.293V1.5a.5.5 0 0 1 .5-.5z"/>
      </svg>
    );
  }
  
  return currentDirection === 'asc' ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" className="bi bi-sort-alpha-down ms-1" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371h-1.781zm1.57-.785L11 2.687h-.047l-.652 2.157h1.351z"/>
      <path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645V14zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 1 .7-.006l2-2a.5.5 0 0 0-.707-.708L4.5 12.293V2.5z"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" className="bi bi-sort-alpha-up ms-1" viewBox="0 0 16 16">
      <path fillRule="evenodd" d="M10.082 5.629 9.664 7H8.598l1.789-5.332h1.234L13.402 7h-1.12l-.419-1.371h-1.781zm1.57-.785L11 2.687h-.047l-.652 2.157h1.351z"/>
      <path d="M12.96 14H9.028v-.691l2.579-3.72v-.054H9.098v-.867h3.785v.691l-2.567 3.72v.054h2.645V14zM4.5 2.5a.5.5 0 0 0-1 0V2.707L2.354 3.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L4.5 2.707V13.5z"/>
    </svg>
  );
};

function ItemList() {
  const { api } = useApi();
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBox, setSelectedBox] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState(null);
  // Multi-select states
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showBulkTransferModal, setShowBulkTransferModal] = useState(false);
  
  // Stock In/Out modals
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [selectedItemForStockOut, setSelectedItemForStockOut] = useState(null);
  const [stockInNewItemMode, setStockInNewItemMode] = useState(false);
  
  // Relationship management
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedItemForRelationship, setSelectedItemForRelationship] = useState(null);
  
  // QR Label Printing
  const [showLabelPrintingModal, setShowLabelPrintingModal] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Type filter state
  const [selectedType, setSelectedType] = useState('');
  const [availableTypes, setAvailableTypes] = useState([]);
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedItemForQR, setSelectedItemForQR] = useState(null);
  
  // Add state for clipboard confirmation
  const [copiedItemId, setCopiedItemId] = useState(null);
  
  const location = useLocation();
  const navigate = useNavigate();
  
  // Add custom styling for Roboto font and rounded corners
  useEffect(() => {
    // Create a style element
    const styleEl = document.createElement('style');
    styleEl.id = 'items-page-styles';
    
    // Add Google Fonts import for Roboto
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    document.head.appendChild(fontLink);
    
    // Define custom styles for the Items page
    styleEl.innerHTML = `
      /* Apply Roboto font to the items list container */
      .items-list-container {
        font-family: 'Roboto', sans-serif;
      }
      
      /* Add rounded corners to various elements */
      .items-list-container .card {
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
      }
      
      .items-list-container .table {
        border-radius: 12px;
        overflow: hidden;
      }
      
      .items-list-container .alert {
        border-radius: 12px;
      }
      
      .items-list-container .btn {
        border-radius: 8px;
        font-weight: 500;
      }
      
      .items-list-container .badge {
        border-radius: 8px;
        padding: 0.25rem 0.5rem;
      }
      
      /* Style for badges */
      .items-list-container .badge.copy-badge-hover {
        border-radius: 8px;
        transition: all 0.2s ease;
      }
      
      /* Add subtle hover effect to table rows */
      .items-list-container .table tbody tr:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        transition: all 0.2s ease;
      }
      
      /* Style action buttons */
      .items-list-container .action-button {
        margin-right: 3px;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      
      /* Improve filter panel styling */
      .items-list-container .filter-panel {
        border-radius: 12px;
        margin-bottom: 20px;
      }
      
      /* Rounded input fields */
      .items-list-container .form-control,
      .items-list-container .input-group-text {
        border-radius: 8px;
      }
      
      /* Active filters styling */
      .items-list-container .active-filters .badge {
        font-weight: 500;
        padding: 0.4rem 0.7rem;
      }
    `;
    
    // Add the style element to the document head
    document.head.appendChild(styleEl);
    
    // Clean up function to remove the style element when component unmounts
    return () => {
      const existingStyle = document.getElementById('items-page-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      if (fontLink && document.head.contains(fontLink)) {
        document.head.removeChild(fontLink);
      }
    };
  }, []);

  // Custom styles for clickable rows
  const rowStyle = {
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const rowHoverStyle = {
    backgroundColor: '#f8f9ff',
    transform: 'translateY(-1px)',
    boxShadow: '0 2px 5px rgba(0,123,255,0.1)'
  };
  
  // Style for clickable badges (like EAN codes)
  const copyableBadgeStyle = {
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative'
  };
  
  const copyableBadgeHoverStyle = {
    backgroundColor: '#e9ecef',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  // Add successMessage state
  const [successMessage, setSuccessMessage] = useState('');

  // Add WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  
  // Function to initialize tooltips
  const initTooltips = () => {
    // Use a small timeout to ensure DOM elements are updated
    setTimeout(() => {
      try {
        if (!window.bootstrap || !window.bootstrap.Tooltip) {
          console.warn('Bootstrap Tooltip not available');
          return;
        }
        
        // Destroy existing tooltips first
        const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        
        // Safely dispose existing tooltips
        tooltipTriggerList.forEach(tooltipTriggerEl => {
          try {
            const tooltipInstance = window.bootstrap.Tooltip.getInstance(tooltipTriggerEl);
            if (tooltipInstance) {
              tooltipInstance.dispose();
            }
          } catch (instanceError) {
            console.warn('Error disposing tooltip instance:', instanceError);
          }
        });
        
        // Create new tooltips with a timeout to avoid immediate creation after disposal
        setTimeout(() => {
          tooltipTriggerList.forEach(tooltipTriggerEl => {
            try {
              new window.bootstrap.Tooltip(tooltipTriggerEl, {
                trigger: 'hover focus',
                container: 'body',
                boundary: 'window'
              });
            } catch (tooltipError) {
              console.warn('Error creating tooltip:', tooltipError);
            }
          });
        }, 50);
      } catch (error) {
        console.warn('Error initializing tooltips:', error);
      }
    }, 100);
  };
  
  // Setup WebSocket subscriptions
  useEffect(() => {
    // Get connection status updates
    const connectionSub = webSocketService.subscribe('connection', (status) => {
      setWsConnected(status.connected);
    });
    
    // Receive item updates via WebSocket
    const itemUpdateSub = webSocketService.subscribe('item_update', (data) => {
      console.log('Received item update via WebSocket:', data);
      
      // Get current filter state from URL and state
      const params = new URLSearchParams(location.search);
      const boxId = params.get('box_id') || selectedBox;
      const search = params.get('search') || searchTerm;
      const parentId = params.get('parent_id');
      const type = params.get('type') || selectedType;
      
      console.log('Preserving filter state during item_update:', { boxId, search, parentId, type });
      
      // Force a complete reload while preserving filters
      reloadItemsWithFilters(boxId, search, parentId, type);
    });
    
    // Initial tooltip initialization
    initTooltips();
    
    // Receive refresh notifications via WebSocket
    const refreshSub = webSocketService.subscribe('refresh_needed', (data) => {
      if (data.tableType === 'items' || data.tableType === 'all') {
        console.log('Received refresh_needed via WebSocket:', data);
        
        // Clear cache first to ensure fresh data
        if (api.clearCache) {
          api.clearCache();
        }
        
        // Get current filter state
        const params = new URLSearchParams(location.search);
        const boxId = params.get('box_id') || selectedBox;
        const search = params.get('search') || searchTerm;
        const parentId = params.get('parent_id');
        const type = params.get('type') || selectedType;
        
        console.log('Preserving filter state during refresh_needed:', { boxId, search, parentId, type });
        
        // Force a complete reload with view refresh while preserving filters
        reloadItemsWithFilters(boxId, search, parentId, type);
      }
    });
    
    // Subscribe to client refresh requests (direct refresh command from server)
    const clientRefreshSub = webSocketService.subscribe('client_refresh_request', (data) => {
      console.log('Received client refresh request via WebSocket:', data);
      if (data.tableType === 'items' || data.tableType === 'all') {
        // Clear cache first to ensure fresh data
        if (api.clearCache) {
          api.clearCache();
        }
        
        // Get current filter state
        const params = new URLSearchParams(location.search);
        const boxId = params.get('box_id') || selectedBox;
        const search = params.get('search') || searchTerm;
        const parentId = params.get('parent_id');
        const type = params.get('type') || selectedType;
        
        console.log('Preserving filter state during client_refresh_request:', { boxId, search, parentId, type });
        
        // Force a complete reload with view refresh while preserving filters
        reloadItemsWithFilters(boxId, search, parentId, type);
      }
    });
    
    // Initial connection
    webSocketService.connect();
    
    // Cleanup subscriptions when component unmounts
    return () => {
      connectionSub();
      itemUpdateSub();
      refreshSub();
      clientRefreshSub();
    };
  }, [location.search, selectedBox, searchTerm, selectedType]);

  // Helper function to reload items with filters preserved
  const reloadItemsWithFilters = async (boxId, search, parentId, type) => {
    console.log("Reloading items with preserved filters:", { boxId, search, parentId, type });
    
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      // First refresh the materialized view
      console.log("First refreshing the materialized view...");
      await refreshItemsView();
      
      // Longer delay to ensure DB operations complete and changes propagate
      // Use a longer delay for ALL BOXES view since it needs to process more data
      const delay = !boxId ? 1500 : 1200;
      console.log(`Waiting ${delay}ms for database changes to propagate...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Clear any existing items first to ensure we see the change
      setItems([]);
      
      // Generate a unique timestamp to prevent caching
      const timestamp = new Date().getTime() + Math.random();
      
      // Explicitly clear all API caches to ensure fresh data
      if (api.clearCache) {
        api.clearCache(); // Clear ALL caches
        console.log("Cleared all API cache to ensure fresh data");
      }
      
      // Add a cache-busting parameter to the URL if we're on the items page
      if (window.location.pathname.includes('/items')) {
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('_ts', timestamp);
        
        // Ensure box_id is preserved in URL if it exists
        if (boxId) {
          currentParams.set('box_id', boxId);
          setSelectedBox(boxId);
        }
        
        // Ensure search is preserved in URL if it exists
        if (search) {
          currentParams.set('search', search);
          setSearchTerm(search);
        }
        
        // Ensure parent_id is preserved in URL if it exists
        if (parentId) {
          currentParams.set('parent_id', parentId);
        }
        
        // Ensure type filter is preserved in URL if it exists
        if (type) {
          currentParams.set('type', type);
          setSelectedType(type);
        }
        
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }
      
      console.log(`Fetching fresh items with filters (boxId: ${boxId}, search: ${search}, parentId: ${parentId}, type: ${type}) and cache-busting timestamp: ${timestamp}`);
      
      // Fetch items with force refresh and timestamp, preserving filters
      fetchItems(boxId || null, search || null, true, parentId || null, timestamp);
    } catch (error) {
      console.error("Error during item reload:", error);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to get parent item name
  const getParentName = (parentId) => {
    if (parentId === null || parentId === undefined) {
      return 'Unknown';
    }
    
    // Make sure we're comparing integers, not strings
    const parentIdNum = parseInt(parentId, 10);
    const parentItem = items.find(i => parseInt(i.id, 10) === parentIdNum);
    
    return parentItem ? parentItem.name : `Item #${parentIdNum}`;
  };

  // Define the reloadItems function
  const reloadItems = async () => {
    console.log("Reloading items data with COMPLETE force refresh...");
    
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      // First refresh the materialized view
      console.log("First refreshing the materialized view...");
      await refreshItemsView();
      
      // Longer delay to ensure DB operations complete and changes propagate
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Get current query parameters
      const params = new URLSearchParams(location.search);
      const boxId = params.get('box_id');
      const search = params.get('search');
      const parentId = params.get('parent_id');
      const type = params.get('type');
      
      // Clear any existing items first to ensure we see the change
      setItems([]);
      
      // Generate a unique timestamp to prevent caching
      const timestamp = new Date().getTime() + Math.random();
      
      // Explicitly clear all API caches to ensure fresh data
      if (api.clearCache) {
        api.clearCache(); // Clear ALL caches
        console.log("Cleared all API cache to ensure fresh data");
      }
      
      // Clear any browser storage caches for items
      try {
        localStorage.removeItem('items_cache');
        sessionStorage.removeItem('items_cache');
        
        // Clear all item-related localStorage entries
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('item')) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('Error clearing browser caches:', e);
      }
      
      // Add a cache-busting parameter to the URL if we're on the items page
      if (window.location.pathname.includes('/items')) {
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('_ts', timestamp);
        
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }
      
      console.log(`Fetching fresh items with cache-busting timestamp: ${timestamp}`);
      
      // Fetch items with force refresh and timestamp
      fetchItems(boxId || null, search || null, true, parentId || null, timestamp);
    } catch (error) {
      console.error("Error during item reload:", error);
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update handleStockOperationSuccess to use the reloadItems function
  const handleStockOperationSuccess = async () => {
    // Use reloadItems instead of fetchItems to force a complete refresh
    console.log("Stock operation success - forcing complete data refresh");
    await reloadItems();
  };

  // Handle manual refresh with stronger cache busting
  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      console.log("Manual refresh requested by user - performing thorough refresh");
      
      // First clear all API caches
      if (api.clearCache) {
        api.clearCache();
        console.log("Cleared all API caches");
      }
      
      // Clear browser caches - remove ALL items and cache entries
      try {
        // Try to clear localStorage cache for items
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('item') || key.includes('cache'))) {
            keysToRemove.push(key);
          }
        }
        
        // Remove the keys in a separate loop
        keysToRemove.forEach(key => {
          console.log(`Removing localStorage key: ${key}`);
          localStorage.removeItem(key);
        });
        
        // Also clear sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('item') || key.includes('cache'))) {
            console.log(`Removing sessionStorage key: ${key}`);
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.warn('Error clearing browser caches:', e);
      }
      
      // Get current filter state
      const params = new URLSearchParams(location.search);
      const boxId = params.get('box_id') || selectedBox;
      const search = params.get('search') || searchTerm;
      const parentId = params.get('parent_id');
      const type = params.get('type') || selectedType;
      
      console.log('Preserving filter state during manual refresh:', { boxId, search, parentId, type });
      
      // Refresh with current filters
      await reloadItemsWithFilters(boxId, search, parentId, type);
      
      // Show success message
      setSuccessMessage('Data refreshed successfully');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (error) {
      console.error('Error during manual refresh:', error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check for query parameters
    const params = new URLSearchParams(location.search);
    const boxId = params.get('box_id');
    const search = params.get('search');
    const sort = params.get('sort');
    const direction = params.get('direction');
    const parentId = params.get('parent_id');
    const type = params.get('type');
    
    if (boxId) {
      setSelectedBox(boxId);
    }
    
    if (search) {
      setSearchTerm(search);
    }
    
    if (sort) {
      setSortColumn(sort);
    }
    
    if (direction) {
      setSortDirection(direction);
    }
    
    if (type) {
      setSelectedType(type);
    }
    
    fetchBoxes();
    fetchItems(boxId, search, false, parentId);

    // Check if we should open the new item modal from state parameter
    if (location.state?.showNewItemModal) {
      openNewItemModal();
      // Clear the state to avoid reopening the modal on page refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.search, location.state]);

  // Reset selected items when items change
  useEffect(() => {
    setSelectedItems([]);
    setSelectAll(false);
    setShowBulkActions(false);
  }, [items]);

  // Show/hide bulk actions based on selection
  useEffect(() => {
    setShowBulkActions(selectedItems.length > 0);
  }, [selectedItems]);

  const fetchItems = async (boxId = null, search = null, forceRefresh = false, parentId = null, timestamp = null) => {
    try {
      setLoading(true);
      
      // Create sort options object for server-side sorting
      const sortOptions = {
        sort: sortColumn,
        direction: sortDirection
      };
      
      // Check if search has the special "id:" prefix for direct item ID search
      let itemIdSearch = null;
      let modifiedSearch = search;
      
      if (search && search.startsWith('id:')) {
        // Extract the item ID from the search term
        itemIdSearch = search.substring(3);
        // Clear the regular search term to avoid confusion
        modifiedSearch = null;
        
        console.log(`Special ID search detected: ${itemIdSearch}`);
      }
      
      // Check if search is a pure number - if it is, we'll need to do additional handling
      const isNumericSearch = search && /^\d+$/.test(search) && !search.startsWith('id:');
      
      // Check if numeric_search was explicitly specified in URL
      const isExplicitNumericSearch = new URLSearchParams(location.search).get('numeric_search') === 'true';
      
      // Use either explicit flag or detected numeric pattern
      const shouldHandleAsNumeric = isNumericSearch || isExplicitNumericSearch;
      
      if (shouldHandleAsNumeric) {
        console.log(`Numeric search detected: ${search}. Adding special handling for numeric item search.`);
      }
      
      // Get the type filter state (from state or URL)
      const typeFilter = selectedType || new URLSearchParams(location.search).get('type');
      
      // Generate a unique timestamp if not provided
      const requestTimestamp = timestamp || new Date().getTime() + Math.random();
      
      console.log(`Fetching items with parameters:`, {
        boxId,
        search: modifiedSearch,
        itemIdSearch,
        sortOptions,
        parentId,
        typeFilter,
        forceRefresh,
        timestamp: requestTimestamp,
        isAllBoxesView: !boxId
      });
      
      // Clear any cached data in the API service
      if (api.clearCache) {
        // Always force clear cache for items endpoints
        api.clearCache('/items');
        console.log('Cleared items cache before fetching');
      }
      
      // Generate strong cache-busting headers
      const cacheBustingHeaders = {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache-Bust': requestTimestamp,
          'X-Type-Filter': typeFilter || '',  // Add type filter to headers for tracking
          'X-Box-Filter': boxId || 'ALL',     // Add box filter to headers for tracking
          'X-Numeric-Search': shouldHandleAsNumeric ? 'true' : 'false', // Add numeric search flag
          'X-Item-Id-Search': itemIdSearch || '' // Add item ID search if present
        }
      };
      
      // Set API request timeout higher to allow for database operations
      const requestTimeout = 15000; // 15 seconds
      
      // Call the API to get items with cache-busting headers and timeout
      const response = await api.getItems(
        boxId, 
        modifiedSearch, 
        sortOptions, 
        parentId, 
        requestTimestamp,
        cacheBustingHeaders,
        requestTimeout
      );
      
      console.log(`Items fetched: ${response.data.length} items`, {
        firstItem: response.data[0] ? `${response.data[0].id} - ${response.data[0].name}` : 'none',
        lastItem: response.data.length > 0 ? `${response.data[response.data.length-1].id} - ${response.data[response.data.length-1].name}` : 'none',
        timestamp: requestTimestamp,
        receivedAt: new Date().toISOString()
      });
      
      // Log parent-child relationships for debugging
      response.data.forEach(item => {
        if (item.parent_item_id) {
          console.log(`Item ${item.id} (${item.name}) has parent: ${item.parent_item_id}`);
        }
      });
      
      // Check for potential duplicates by name
      const nameCount = {};
      response.data.forEach(item => {
        if (item.name) {
          nameCount[item.name] = (nameCount[item.name] || 0) + 1;
        }
      });
      
      // Log any duplicate named items
      Object.entries(nameCount).forEach(([name, count]) => {
        if (count > 1) {
          console.warn(`Found ${count} items with the same name: "${name}"`);
          const duplicates = response.data.filter(item => item.name === name);
          console.log('Duplicate items:', duplicates);
        }
      });
      
      // Collect all unique types for the filter dropdown
      const types = response.data
        .map(item => item.type)
        .filter(type => type !== null && type !== undefined && type !== '')
        .filter((value, index, self) => self.indexOf(value) === index)
        .sort();
      
      setAvailableTypes(types);
      
      // Apply client-side filtering
      let filteredItems = response.data;
      let allItems = [...response.data]; // Save a copy of all items for numeric search
      
      // Apply type filtering if selected
      if (typeFilter) {
        filteredItems = filteredItems.filter(item => 
          item.type === typeFilter
        );
        
        console.log(`Applied type filter "${typeFilter}": ${filteredItems.length} items remaining`);
      }
      
      // Apply ID filtering if using the special id: search syntax
      if (itemIdSearch) {
        const searchId = parseInt(itemIdSearch, 10);
        if (!isNaN(searchId)) {
          filteredItems = filteredItems.filter(item => 
            parseInt(item.id, 10) === searchId
          );
          
          // If we found the exact item, highlight it visually
          if (filteredItems.length === 1) {
            // Set the search term to the item name to make it clear what was found
            setSearchTerm(`ID: ${itemIdSearch} (${filteredItems[0].name})`);
          }
        }
      }
      // Apply numeric search for number in item names (highest priority)
      else if (search && /^\d+$/.test(search)) {
        console.log(`Performing direct numeric search for "${search}" in item names`);
        
        // For numeric searches, we want to search across ALL items first,
        // then apply type filter if needed
        const numericMatches = allItems.filter(item => {
          // Skip null items
          if (!item) return false;
          
          // Convert everything to strings for reliable comparisons
          const searchTerm = String(search).toLowerCase();
          const itemName = String(item.name || '').toLowerCase();
          const itemId = String(item.id || '');
          const itemEan = String(item.ean_code || '').toLowerCase();
          const itemSerial = String(item.serial_number || '').toLowerCase();
          const itemDescription = String(item.description || '').toLowerCase();
          const itemSupplier = String(item.supplier || '').toLowerCase();
          const itemQR = String(item.qr_code || '').toLowerCase();
          const itemType = String(item.type || '').toLowerCase();
          
          // Additional check for numbers within words (like "T206", "TK206")
          const nameContainsNumber = itemName.includes(searchTerm);
          const nameWithoutSeparators = itemName.replace(/[-_\s.]/g, '');
          const descriptionContainsNumber = itemDescription.includes(searchTerm);
          
          // We'll match the item if ANY of the following is true
          return (
            // Direct matches against reference numbers
            itemId === searchTerm ||
            itemEan === searchTerm ||
            itemSerial === searchTerm ||
            itemQR === searchTerm ||
            
            // Partial matches against text fields
            nameContainsNumber ||
            nameWithoutSeparators.includes(searchTerm) ||
            descriptionContainsNumber ||
            itemSupplier.includes(searchTerm) ||
            itemType.includes(searchTerm) ||
            
            // Additional aggressive match patterns for names
            // Check for "Name 206", "Name-206", "Name.206", etc.
            itemName.match(new RegExp(`\\b${searchTerm}\\b`)) !== null ||
            // Check for "Name206", "SomePrefix206Suffix", etc. 
            itemName.match(new RegExp(searchTerm)) !== null
          );
        });
        
        if (numericMatches.length > 0) {
          console.log(`Found ${numericMatches.length} items with number ${search} in name/id/ean/serial/description`);
          
          // If type filter is active, apply it to numeric matches
          if (typeFilter) {
            const filteredNumericMatches = numericMatches.filter(item => item.type === typeFilter);
            console.log(`After applying type filter "${typeFilter}": ${filteredNumericMatches.length} numeric matches remain`);
            
            if (filteredNumericMatches.length > 0) {
              filteredItems = filteredNumericMatches;
            } else {
              // Special case: If no matches with type filter, offer all numeric matches
              console.log(`No matches found with both numeric search and type filter, showing all numeric matches`);
              filteredItems = numericMatches;
              
              // Optionally clear type filter if no matches are found with both filters
              if (window.confirm(`No items found with number ${search} and type ${typeFilter}. Show all items with number ${search} instead?`)) {
                setSelectedType('');
                
                // Update URL to remove type filter
                const params = new URLSearchParams(location.search);
                params.delete('type');
                if (search) params.set('search', search);
                
                // Update URL without reloading the page
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState({ path: newUrl }, '', newUrl);
              }
            }
          } else {
            // No type filter active, use all numeric matches
            filteredItems = numericMatches;
          }
        } else {
          console.log(`No items found with number ${search} in name/id/ean/serial/description`);
        }
      }
      // Apply general search for non-numeric searches
      else if (search && search.trim() !== '') {
        console.log(`Performing general search for "${search}" in item data`);
        
        // Convert search term to lowercase for case-insensitive matching
        const searchTermLower = search.toLowerCase();
        
        // For general searches, we want to search across ALL items first,
        // then apply type filter if needed
        const generalMatches = allItems.filter(item => {
          if (!item) return false;
          
          // Convert all searchable fields to lowercase strings for case-insensitive matching
          const itemName = String(item.name || '').toLowerCase();
          const itemDesc = String(item.description || '').toLowerCase();
          const itemType = String(item.type || '').toLowerCase();
          const itemEan = String(item.ean_code || '').toLowerCase();
          const itemSerial = String(item.serial_number || '').toLowerCase();
          const itemSupplier = String(item.supplier || '').toLowerCase();
          const itemId = String(item.id || '').toLowerCase();
          
          // Also check for matches when separators are removed (consistent with numeric search)
          const itemNameNoSeparators = itemName.replace(/[-_\s.]/g, '');
          
          // Return true if the search term is found in any field
          return (
            itemName.includes(searchTermLower) ||
            itemNameNoSeparators.includes(searchTermLower) ||
            itemDesc.includes(searchTermLower) ||
            itemType.includes(searchTermLower) ||
            itemEan.includes(searchTermLower) ||
            itemSerial.includes(searchTermLower) ||
            itemSupplier.includes(searchTermLower) ||
            itemId.includes(searchTermLower)
          );
        });
        
        console.log(`General search found ${generalMatches.length} matching items`);
        
        // If type filter is active, apply it to general matches
        if (typeFilter && generalMatches.length > 0) {
          const filteredGeneralMatches = generalMatches.filter(item => item.type === typeFilter);
          console.log(`After applying type filter "${typeFilter}": ${filteredGeneralMatches.length} general matches remain`);
          
          if (filteredGeneralMatches.length > 0) {
            filteredItems = filteredGeneralMatches;
          } else {
            // Special case: If no matches with type filter, offer all general matches
            console.log(`No matches found with both search and type filter, showing all search matches`);
            filteredItems = generalMatches;
            
            // Optionally clear type filter if no matches are found with both filters
            if (window.confirm(`No items found with search "${search}" and type ${typeFilter}. Show all matching items instead?`)) {
              setSelectedType('');
              
              // Update URL to remove type filter
              const params = new URLSearchParams(location.search);
              params.delete('type');
              if (search) params.set('search', search);
              
              // Update URL without reloading the page
              const newUrl = `${window.location.pathname}?${params.toString()}`;
              window.history.replaceState({ path: newUrl }, '', newUrl);
            }
          }
        } else {
          // No type filter active or no general matches found
          if (generalMatches.length > 0) {
            filteredItems = generalMatches;
          }
        }
      }
      
      console.log(`Setting ${filteredItems.length} items in state after filtering`);
      setItems(filteredItems);
      setError(null);
      
      // Initialize tooltips after items update
      setTimeout(initTooltips, 300);
    } catch (err) {
      setError('Failed to fetch items. Please try again later.');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async () => {
    try {
      const response = await api.getBoxes();
      setBoxes(response.data);
    } catch (err) {
      console.error('Error fetching boxes:', err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setLoading(true);
      try {
        await api.deleteItem(id);
        
        // First refresh the materialized view to ensure database is updated
        console.log("Refreshing view after item deletion...");
        await refreshItemsView();
        
        // Short delay to ensure view refresh completes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force a complete data refresh
        await reloadItems();
        
        // Show success message
        setSuccessMessage('Item successfully deleted');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete item. Please try again later.');
        console.error('Error deleting item:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBoxChange = (e) => {
    // If e is an event, it's from the select dropdown
    // If e is not an event, it's from the clear button in ActiveFilters
    const boxId = e.target?.value !== undefined ? e.target.value : '';
    setSelectedBox(boxId);
    
    // Update URL with new query parameters
    const params = new URLSearchParams(location.search);
    
    // Get current search, parent_id and type filters if they exist
    const searchFilter = params.get('search') || searchTerm;
    const parentId = params.get('parent_id');
    const typeFilter = params.get('type') || selectedType;
    
    // Update box_id parameter
    if (boxId) {
      params.set('box_id', boxId);
    } else {
      params.delete('box_id');
    }
    
    // Preserve other filters
    if (searchFilter) {
      params.set('search', searchFilter);
    }
    
    // Preserve type filter
    if (typeFilter) {
      params.set('type', typeFilter);
    }
    
    // Add timestamp for cache busting
    const timestamp = new Date().getTime();
    params.set('_ts', timestamp);
    
    // Update URL
    navigate({ search: params.toString() });
    
    // Call fetchItems with all filters
    console.log(`Box filter changed, fetching items with: boxId=${boxId}, search=${searchFilter}, parentId=${parentId}, type=${typeFilter}`);
    
    // If switching to "ALL BOXES" view, we need a complete refresh to get fresh data
    if (!boxId) {
      // Clear API cache
      if (api.clearCache) {
        api.clearCache();
        console.log('Cleared API cache for ALL BOXES view');
      }
      
      // Set loading state
      setLoading(true);
      
      // First refresh the materialized view to get fresh data
      refreshItemsView().then(() => {
        console.log('Materialized view refreshed, fetching fresh items');
        
        // Allow a small delay for the view refresh to complete
        setTimeout(() => {
          fetchItems(null, searchFilter || null, true, parentId || null, timestamp);
        }, 500);
      }).catch(error => {
        console.error('Error refreshing view:', error);
        fetchItems(null, searchFilter || null, true, parentId || null, timestamp);
        setLoading(false);
      });
    } else {
      // Normal flow for specific box selection
      fetchItems(boxId, searchFilter || null, true, parentId || null, timestamp);
    }
  };

  const [searchInputTimeout, setSearchInputTimeout] = useState(null);

  const handleSearchChange = (e) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    
    // Clear any existing timeout
    if (searchInputTimeout) {
      clearTimeout(searchInputTimeout);
    }
    
    // If search term is numeric, schedule an automatic search
    if (/^\d+$/.test(newSearchTerm) && newSearchTerm.length > 0) {
      const timeoutId = setTimeout(() => {
        console.log('Auto-triggering search for numeric term:', newSearchTerm);
        
        // Update URL with search parameter
        const params = new URLSearchParams(location.search);
        const boxId = params.get('box_id') || selectedBox;
        const parentId = params.get('parent_id');
        
        if (newSearchTerm) {
          params.set('search', newSearchTerm);
          params.set('numeric_search', 'true');
        } else {
          params.delete('search');
          params.delete('numeric_search');
        }
        
        // Preserve other filters
        if (boxId) {
          params.set('box_id', boxId);
        }
        
        // Add timestamp for cache busting
        params.set('_ts', new Date().getTime());
        
        // Update URL without reloading the page
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);
        
        // Execute the search
        fetchItems(boxId || null, newSearchTerm || null, true, parentId || null);
      }, 800); // Wait 800ms to avoid excessive API calls
      
      setSearchInputTimeout(timeoutId);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    // Update URL with new query parameters
    const params = new URLSearchParams(location.search);
    
    // Get current box_id and parent_id if they exist
    const boxId = params.get('box_id') || selectedBox;
    const parentId = params.get('parent_id');
    
    // Update search parameter
    if (searchTerm) {
      params.set('search', searchTerm);
      
      // If the search term is numeric, add numeric_search=true to the URL
      if (/^\d+$/.test(searchTerm)) {
        params.set('numeric_search', 'true');
      } else {
        params.delete('numeric_search');
      }
    } else {
      params.delete('search');
      params.delete('numeric_search');
    }
    
    // Preserve other filters
    if (boxId) {
      params.set('box_id', boxId);
    }
    
    // Add timestamp for cache busting
    params.set('_ts', new Date().getTime());
    
    // Update URL
    navigate({ search: params.toString() });
    
    // Call fetchItems with all filters
    console.log(`Search submitted, fetching items with: boxId=${boxId}, search=${searchTerm}, parentId=${parentId}`);
    fetchItems(boxId || null, searchTerm || null, true, parentId || null);
  };
  
  // Clear search field and reload items
  const clearSearch = () => {
    setSearchTerm('');
    
    // Get current URL parameters
    const params = new URLSearchParams(location.search);
    const boxId = params.get('box_id') || selectedBox;
    const parentId = params.get('parent_id');
    
    // Always remove the search parameter from URL
    params.delete('search');
    
    // Preserve other filters
    if (boxId) {
      params.set('box_id', boxId);
    }
    
    // Add timestamp for cache busting
    params.set('_ts', new Date().getTime());
    
    // Update URL
    navigate({ search: params.toString() });
    
    // Fetch items without any search term, but preserving other filters
    console.log(`Search cleared, fetching items with: boxId=${boxId}, parentId=${parentId}`);
    fetchItems(boxId || null, null, true, parentId || null);
  };

  // Handle sort column click
  const handleSort = (column) => {
    const newDirection = column === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
    
    // Update URL with sort parameters while preserving other parameters
    const params = new URLSearchParams(location.search);
    
    // Get current filter values
    const boxId = params.get('box_id') || selectedBox;
    const search = params.get('search') || searchTerm;
    const parentId = params.get('parent_id');
    
    // Update sort parameters
    params.set('sort', column);
    params.set('direction', newDirection);
    
    // Preserve other filters
    if (boxId) {
      params.set('box_id', boxId);
    }
    
    if (search) {
      params.set('search', search);
    }
    
    // Add timestamp for cache busting
    params.set('_ts', new Date().getTime());
    
    navigate({ search: params.toString() });
    
    // Always fetch from the server with the new sort parameters and all filters
    console.log(`Sorting changed to ${column} ${newDirection}, fetching items with: boxId=${boxId}, search=${search}, parentId=${parentId}`);
    fetchItems(boxId || null, search || null, true, parentId || null);
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.id));
    }
    setSelectAll(!selectAll);
  };

  // Handle individual item selection
  const handleSelectItem = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
      setSelectAll(false);
    } else {
      setSelectedItems([...selectedItems, itemId]);
      if (selectedItems.length + 1 === items.length) {
        setSelectAll(true);
      }
    }
  };

  // Handle bulk transfer
  const openBulkTransferModal = () => {
    if (selectedItems.length === 0) {
      return;
    }
    setShowBulkTransferModal(true);
  };

  const closeBulkTransferModal = () => {
    setShowBulkTransferModal(false);
  };

  const handleBulkTransferSuccess = async (destinationBoxId, notes) => {
    setLoading(true);
    try {
      await api.bulkTransferItems(selectedItems, {
        destination_box_id: destinationBoxId,
        notes: notes
      });
      
      // First refresh the materialized view
      console.log("Refreshing view after bulk transfer...");
      await refreshItemsView();
      
      // Short delay to ensure view refresh completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force a complete data refresh
      await reloadItems();
      
      // Clear the selection
      setSelectedItems([]);
      setSelectAll(false);
      
      // Show success message
      const itemCount = selectedItems.length;
      setSuccessMessage(`${itemCount} ${itemCount === 1 ? 'item' : 'items'} successfully transferred`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Close the modal
      closeBulkTransferModal();
    } catch (err) {
      setError('Failed to transfer items. Please try again later.');
      console.error('Error transferring items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) {
      return;
    }
    
    const itemCount = selectedItems.length;
    const confirmMessage = `Are you sure you want to delete ${itemCount} ${itemCount === 1 ? 'item' : 'items'}?`;
    
    if (window.confirm(confirmMessage)) {
      setLoading(true);
      try {
        await api.bulkDeleteItems(selectedItems);
        
        // First refresh the materialized view to ensure database is updated
        console.log("Refreshing view after bulk deletion...");
        await refreshItemsView();
        
        // Short delay to ensure view refresh completes
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force a complete data refresh
        await reloadItems();
        
        // Clear the selection
        setSelectedItems([]);
        setSelectAll(false);
        
        // Show success message
        setSuccessMessage(`${itemCount} ${itemCount === 1 ? 'item' : 'items'} successfully deleted`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setError('Failed to delete items. Please try again later.');
        console.error('Error deleting items:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Stock In/Out handlers
  const openStockInModal = () => {
    console.log("Opening stock in modal...");
    setStockInNewItemMode(false);
    setShowStockInModal(true);
  };

  const closeStockInModal = () => {
    setShowStockInModal(false);
    setStockInNewItemMode(false);
  };

  const openStockOutModal = (item) => {
    setSelectedItemForStockOut(item.id);
    setShowStockOutModal(true);
  };

  const closeStockOutModal = () => {
    setShowStockOutModal(false);
    setSelectedItemForStockOut(null);
  };

  // Add relationship modal handlers
  const closeRelationshipModal = () => {
    setShowRelationshipModal(false);
    setSelectedItemForRelationship(null);
  };

  const handleRelationshipSuccess = async () => {
    console.log("Relationship updated successfully, reloading items...");
    closeRelationshipModal();
    // Force reload items to refresh parent-child relationships
    await reloadItems();
  };

  // Modal functions
  const openNewItemModal = () => {
    console.log("Opening stock in modal for new item creation...");
    setStockInNewItemMode(true);
    setShowStockInModal(true);
  };

  const openEditItemModal = (id) => {
    console.log("Opening edit item modal for ID:", id);
    setSelectedItemId(id);
    setShowModal(true);
  };

  const closeModal = () => {
    console.log("Closing item modal");
    setShowModal(false);
    setSelectedItemId(null);
  };

  const handleModalSuccess = async () => {
    console.log("Item modal success, refreshing items with force refresh...");
    // Force refresh to ensure we get the latest data from the database
    // Clear any existing timeout to prevent multiple refreshes
    if (window.itemListRefreshTimeout) {
      clearTimeout(window.itemListRefreshTimeout);
    }
    
    // Use a small timeout to ensure the modal is fully closed
    window.itemListRefreshTimeout = setTimeout(async () => {
      // Use the async reloadItems function
      await reloadItems();
    }, 200);
  };

  const openTransferModal = (item) => {
    setSelectedItemForTransfer(item);
    setShowTransferModal(true);
  };

  // Close transfer modal
  const closeTransferModal = () => {
    setShowTransferModal(false);
    setSelectedItemForTransfer(null);
  };

  const handleTransferSuccess = async () => {
    console.log("Transfer successful, refreshing items with force refresh...");
    closeTransferModal();
    
    // Force complete data refresh including view refresh
    await reloadItems();
    
    // Show success message
    setSuccessMessage('Item successfully transferred');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Handle row click to open edit modal
  const handleRowClick = (e, itemId) => {
    // Don't trigger if the click was on a button, input, or any element with cursor-pointer class
    if (e.target.tagName === 'BUTTON' || 
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'I' ||
        e.target.closest('.btn') !== null ||
        e.target.closest('.cursor-pointer') !== null ||
        e.target.classList.contains('cursor-pointer') ||
        e.target.closest('[data-bs-toggle="tooltip"]') !== null) {
      return;
    }
    
    openEditItemModal(itemId);
  };

  // Export items to Excel with formatting
  const exportToExcel = () => {
    try {
      // First close the dropdown to prevent UI issues
      setTimeout(() => closeExportDropdown(), 100);
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Items');
      
      // Define columns
      worksheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Type', key: 'type', width: 15 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Box', key: 'box', width: 15 },
        { header: 'Location', key: 'location', width: 20 },
        { header: 'Parent Item', key: 'parent', width: 20 },
        { header: 'Supplier', key: 'supplier', width: 15 },
        { header: 'EAN', key: 'ean_code', width: 15 }
      ];
      
      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24; // Increase header height
      
      // Add data rows
      items.forEach(item => {
        const rowData = {
          name: item.name || '',
          description: item.description || '',
          type: item.type || '',
          quantity: item.quantity || 0,
          box: item.box_number || '',
          location: item.location_name || '',
          parent: item.parent_item_id ? getParentName(item.parent_item_id, items) : '',
          supplier: item.supplier || '',
          ean_code: item.ean_code || ''
        };
        
        worksheet.addRow(rowData);
      });
      
      // Apply formatting to all data rows
      for (let i = 2; i <= items.length + 1; i++) {
        const row = worksheet.getRow(i);
        
        // Format quantity column as number
        const quantityCell = row.getCell(4);
        quantityCell.numFmt = '0';
        
        // Apply conditional formatting to quantity cells
        const quantity = quantityCell.value;
        if (quantity === 0) {
          // Red for zero quantity
          quantityCell.font = { color: { argb: 'FF0000' } };
          quantityCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFDDDD' }
          };
        } else if (quantity < 5) {
          // Yellow for low quantity
          quantityCell.font = { color: { argb: '9C6500' } };
          quantityCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEB9C' }
          };
        } else {
          // Green for good quantity
          quantityCell.font = { color: { argb: '006100' } };
        }
        
        // Add alternating row colors
        if (i % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'F2F2F2' }
          };
        }
        
        // Add border to all cells in the row
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Center align quantity column
          if (cell.col === 4) {
            cell.alignment = { horizontal: 'center' };
          }
        });
      }
      
      // Add summary section with totals
      const summaryStartRow = items.length + 4;
      
      // Add a title for the summary section
      const summaryTitleRow = worksheet.getRow(summaryStartRow);
      const summaryTitleCell = summaryTitleRow.getCell(1);
      summaryTitleCell.value = 'Summary';
      summaryTitleCell.font = { bold: true, size: 12 };
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'DDEBF7' }
      };
      worksheet.mergeCells(`A${summaryStartRow}:G${summaryStartRow}`);
      summaryTitleCell.alignment = { horizontal: 'center' };
      
      // Calculate summary data
      const totalItems = items.length;
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const uniqueTypes = [...new Set(items.filter(item => item.type).map(item => item.type))];
      const uniqueBoxes = [...new Set(items.filter(item => item.box_number).map(item => item.box_number))];
      const uniqueLocations = [...new Set(items.filter(item => item.location_name).map(item => item.location_name))];
      
      // Add summary rows
      const summaryData = [
        ['Total Items', totalItems],
        ['Total Quantity', totalQuantity],
        ['Unique Types', uniqueTypes.length],
        ['Unique Boxes', uniqueBoxes.length],
        ['Unique Locations', uniqueLocations.length]
      ];
      
      summaryData.forEach((data, index) => {
        const rowNum = summaryStartRow + index + 1;
        const row = worksheet.getRow(rowNum);
        
        const labelCell = row.getCell(1);
        labelCell.value = data[0];
        labelCell.font = { bold: true };
        
        const valueCell = row.getCell(2);
        valueCell.value = data[1];
        
        // Add borders
        [labelCell, valueCell].forEach(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      
      // Add timestamp at the bottom
      const timestampRow = worksheet.getRow(summaryStartRow + summaryData.length + 2);
      const timestampCell = timestampRow.getCell(1);
      timestampCell.value = `Report generated: ${new Date().toLocaleString()}`;
      timestampCell.font = { italic: true, color: { argb: '808080' } };
      worksheet.mergeCells(`A${timestampRow.number}:G${timestampRow.number}`);
      
      // Generate Excel file with error handling
      workbook.xlsx.writeBuffer()
        .then(buffer => {
          try {
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `items-export-${new Date().toISOString().slice(0,10)}.xlsx`);
            
            // Show success message
            if (window.showToast) {
              window.showToast('Excel file exported successfully!', 'success');
            }
          } catch (error) {
            console.error('Error creating or saving Excel file:', error);
            if (window.showToast) {
              window.showToast('Error exporting Excel file', 'error');
            }
          }
        })
        .catch(error => {
          console.error('Error generating Excel buffer:', error);
          if (window.showToast) {
            window.showToast('Error generating Excel file', 'error');
          }
        });
    } catch (error) {
      console.error('Excel export error:', error);
      if (window.showToast) {
        window.showToast('Error during Excel export', 'error');
      }
    }
  };

  // For backward compatibility, keep exportToCSV as an alias for exportToExcel
  const exportToCSV = exportToExcel;

  // Clear type filter and reload items
  const clearTypeFilter = () => {
    setSelectedType('');
    
    // Update URL parameters
    const params = new URLSearchParams(location.search);
    
    // Get current filter values
    const boxId = params.get('box_id') || selectedBox;
    const search = params.get('search') || searchTerm;
    const parentId = params.get('parent_id');
    
    // Remove type parameter
    params.delete('type');
    
    // Preserve other filters
    if (boxId) {
      params.set('box_id', boxId);
    }
    
    if (search) {
      params.set('search', search);
    }
    
    // Add timestamp for cache busting
    params.set('_ts', new Date().getTime());
    
    // Update URL
    navigate({ search: params.toString() });
    
    // Fetch items with all filters preserved
    console.log(`Type filter cleared, fetching items with: boxId=${boxId}, search=${search}, parentId=${parentId}`);
    fetchItems(boxId || null, search || null, true, parentId || null);
  };

  // Show active filters with ability to clear
  const ActiveFilters = () => {
    const hasActiveFilters = selectedBox || searchTerm || selectedType;
    
    if (!hasActiveFilters) return null;
    
    return (
      <div className="active-filters mb-3">
        {(selectedBox || searchTerm || selectedType) && (
          <div className="card mb-3">
            <div className="card-header bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <strong>Active Filters</strong>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    // Update state
                    setSelectedBox('');
                    setSearchTerm('');
                    setSelectedType('');
                    
                    // Clear the URL parameters and navigate to base URL
                    navigate('/items');
                    
                    // Clear API cache to ensure fresh data
                    if (api.clearCache) {
                      api.clearCache();
                      console.log('Cleared API cache when clearing all filters');
                    }
                    
                    // Set loading state
                    setLoading(true);
                    
                    // First refresh the materialized view
                    refreshItemsView().then(() => {
                      console.log('Materialized view refreshed after clearing all filters');
                      
                      // Allow a small delay for the view refresh to complete
                      setTimeout(() => {
                        // Fetch all items with a fresh timestamp
                        const timestamp = new Date().getTime();
                        fetchItems(null, null, true, null, timestamp);
                      }, 500);
                    }).catch(error => {
                      console.error('Error refreshing view:', error);
                      fetchItems(null, null, true, null, new Date().getTime());
                      setLoading(false);
                    });
                  }}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Clear All Filters
                </button>
              </div>
            </div>
            <div className="card-body py-2">
              <div className="filter-badges">
                {selectedBox && (
                  <span className="badge bg-primary me-2 mb-1">
                    Box: {boxes.find(b => b.id === parseInt(selectedBox))?.box_number || selectedBox}
                    <button className="ms-1 btn btn-sm p-0 text-white" onClick={() => handleBoxChange('')}>
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </span>
                )}
                
                {searchTerm && (
                  <span className="badge bg-info me-2 mb-1">
                    Search: {searchTerm}
                    <button className="ms-1 btn btn-sm p-0 text-white" onClick={clearSearch}>
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </span>
                )}
                
                {selectedType && (
                  <span className="badge bg-success me-2 mb-1">
                    Type: {selectedType}
                    <button className="ms-1 btn btn-sm p-0 text-white" onClick={clearTypeFilter}>
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const openQRModal = (item) => {
    // First check if the item has any QR code or EAN that starts with EPL-IT-STOCK
    let itemWithQR = { ...item };
    
    // Check if QR code exists in the item
    let qrCodeFound = false;
    
    // Check if QR code exists in the item properties
    if (item.qr_code && item.qr_code.startsWith('EPL-IT-STOCK')) {
      console.log('Using QR code from item:', item.qr_code);
      itemWithQR.qr_code = item.qr_code;
      qrCodeFound = true;
    }
    
    // Check if QR code exists in the EAN field
    if (!qrCodeFound && item.ean_code && item.ean_code.startsWith('EPL-IT-STOCK')) {
      console.log('Using EAN code as QR code:', item.ean_code);
      itemWithQR.qr_code = item.ean_code;
      qrCodeFound = true;
    }
    
    // Check if QR code exists in localStorage
    if (!qrCodeFound) {
      try {
        const storedItem = localStorage.getItem(`item_${item.id}_details`);
        if (storedItem) {
          const parsedItem = JSON.parse(storedItem);
          if (parsedItem.qr_code && parsedItem.qr_code.startsWith('EPL-IT-STOCK')) {
            console.log('Using QR code from localStorage:', parsedItem.qr_code);
            itemWithQR.qr_code = parsedItem.qr_code;
            qrCodeFound = true;
          } else if (parsedItem.ean_code && parsedItem.ean_code.startsWith('EPL-IT-STOCK')) {
            console.log('Using EAN code from localStorage as QR code:', parsedItem.ean_code);
            itemWithQR.qr_code = parsedItem.ean_code;
            qrCodeFound = true;
          }
        }
      } catch (err) {
        console.error('Error checking localStorage for QR code:', err);
      }
    }
    
    setSelectedItemForQR(itemWithQR);
    setShowQRModal(true);
  };
  
  const closeQRModal = () => {
    setShowQRModal(false);
    setSelectedItemForQR(null);
  };

  // Add a separate handler for type filter changes
  const handleTypeChange = (e) => {
    const typeValue = e.target.value;
    setSelectedType(typeValue);
    
    // Update URL with new query parameters
    const params = new URLSearchParams(location.search);
    
    // Get current filter values
    const boxId = params.get('box_id') || selectedBox;
    const search = params.get('search') || searchTerm;
    const parentId = params.get('parent_id');
    
    // Update type parameter
    if (typeValue) {
      params.set('type', typeValue);
    } else {
      params.delete('type');
    }
    
    // Preserve other filters
    if (boxId) {
      params.set('box_id', boxId);
    }
    
    if (search) {
      params.set('search', search);
    }
    
    // Add timestamp for cache busting
    params.set('_ts', new Date().getTime());
    
    // Update URL
    navigate({ search: params.toString() });
    
    // Fetch items with all filters preserved
    console.log(`Type filter changed to ${typeValue}, fetching items with: boxId=${boxId}, search=${search}, parentId=${parentId}`);
    fetchItems(boxId || null, search || null, true, parentId || null);
  };

  // Add back the openRelationshipModal function
  const openRelationshipModal = (item) => {
    setSelectedItemForRelationship(item);
    setShowRelationshipModal(true);
  };

  // Function for fallback clipboard copy method
  const fallbackCopyToClipboard = (text, onSuccess) => {
    try {
      // Create a temporary textarea element
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      
      // Add to document, select, and try to copy
      document.body.appendChild(textArea);
      
      // Check if element was successfully added
      if (!document.body.contains(textArea)) {
        throw new Error('Could not append text area to document body');
      }
      
      // Focus and select the text
      textArea.focus();
      textArea.select();
      
      // Execute the copy command with timeout safety
      const successful = document.execCommand('copy');
      
      // Clean up - ensure we always remove the element
      if (document.body.contains(textArea)) {
        document.body.removeChild(textArea);
      }
      
      if (successful) {
        // Call success callback safely
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
      } else {
        console.error('execCommand returned false');
        if (window.showToast) {
          window.showToast('Failed to copy to clipboard', 'error');
        }
      }
    } catch (err) {
      console.error('Fallback clipboard method failed:', err);
      if (window.showToast) {
        window.showToast('Failed to copy to clipboard', 'error');
      }
    }
  };

  // Handle copying text to clipboard
  const handleCopyToClipboard = (e, text, itemId) => {
    // Stop event propagation to prevent row click
    e.stopPropagation();
    
    // Safely handle tooltip - first check if the Bootstrap class exists
    if (window.bootstrap && window.bootstrap.Tooltip) {
      try {
        // Destroy tooltip on the clicked element to prevent it from staying visible
        const tooltipElement = e.currentTarget;
        const tooltipInstance = window.bootstrap.Tooltip.getInstance(tooltipElement);
        if (tooltipInstance) {
          tooltipInstance.hide();
          tooltipInstance.dispose();
        }
      } catch (err) {
        console.error('Error handling tooltip:', err);
        // Continue even if tooltip handling fails
      }
    }
    
    // Function to handle successful copy
    const handleSuccess = () => {
      // Set the copiedItemId to show visual feedback
      setCopiedItemId(itemId);
        
      // Show toast notification if available
      if (window.showToast) {
        window.showToast('Copied to clipboard!', 'success');
      }
      
      // Clear the visual feedback after 1.5 seconds
      setTimeout(() => {
        setCopiedItemId(null);
      }, 1500);
    };

    // Try to use the Clipboard API with fallback - ensuring promise safety
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(handleSuccess)
          .catch(err => {
            console.error('Clipboard write failed:', err);
            // Fallback to alternative method
            fallbackCopyToClipboard(text, handleSuccess);
          });
      } else {
        // Use fallback for browsers without clipboard API
        fallbackCopyToClipboard(text, handleSuccess);
      }
    } catch (err) {
      console.error('Error in clipboard operation:', err);
      // Always provide some feedback even on error
      if (window.showToast) {
        window.showToast('Error copying to clipboard', 'error');
      }
    }
  };

  // Define animation keyframes style
  const copyAnimationStyle = `
    @keyframes copyPulse {
      0% { transform: scale(1); opacity: 1; }
      25% { transform: scale(1.15); opacity: 1; }
      50% { transform: scale(1.1); opacity: 1; }
      75% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    .copy-animation {
      animation: copyPulse 0.4s ease;
      background-color: #28a745 !important;
      color: white !important;
      border-color: #28a745 !important;
      box-shadow: 0 0 0 4px rgba(40, 167, 69, 0.25) !important;
    }
    .copy-badge-hover:hover {
      background-color: #e9f5ff !important;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }
    .copy-badge-hover:hover .copy-icon {
      opacity: 1 !important;
    }
    .copy-icon {
      opacity: 0.5;
      transition: opacity 0.2s ease;
    }
    .copied-text {
      animation: fadeIn 0.2s ease;
    }
  `;

  // Add a function to generate PDF for a single item with QR code
  const generateItemPDF = async (item) => {
    try {
      // Show generating notification
      if (window.showToast) {
        window.showToast('Generating item PDF...', 'info');
      }
      
      // Initialize PDF document - use landscape for better layout
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Set document properties
      doc.setProperties({
        title: `Item Card - ${item.display_name || item.name || item.id}`,
        subject: 'Item Details',
        author: 'IT Stock Europlac',
        creator: 'ReactStock System'
      });
      
      // Define colors
      const primaryColor = '#0066cc';
      const secondaryColor = '#333333';
      const accentColor = '#009966';
      const lightGray = '#f8f9fa';
      
      // Calculate page dimensions for reference
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Add branded header with background
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 20, 'F');
      
      // Add company logo text in header
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text('IT STOCK EUROPLAC', 15, 13);
      
      // Add document title in header
      doc.setFontSize(12);
      doc.text('ITEM CARD', pageWidth - 15, 13, { align: 'right' });
      
      // Add item name as document subtitle
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 20, pageWidth, 12, 'F');
      
      doc.setTextColor(secondaryColor);
      doc.setFontSize(14);
      doc.text(item.display_name || item.name || `Item #${item.id}`, pageWidth / 2, 28, { align: 'center' });
      
      // Create a two-column layout - left side for item details, right side for QR code
      const leftColumnWidth = pageWidth * 0.6;
      const rightColumnWidth = pageWidth * 0.4;
      const startY = 40;
      
      // Define QR code size here so it's accessible throughout the function
      const qrCodeSize = 80;
      const qrCodeValue = item.qr_code || `ITEM-${item.id}`;
      
      // Generate QR code - right column
      try {
        // Create a canvas element for the QR code
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        
        // Use the QRCode library with promise to generate a QR code
        await QRCode.toCanvas(canvas, qrCodeValue, {
          width: 300,
          margin: 2,
          color: {
            dark: secondaryColor,
            light: '#fff'
          }
        });
        
        // Convert the canvas to a data URL
        const qrCodeUrl = canvas.toDataURL('image/png');
        
        // Calculate centered position for QR code
        const qrCodeX = leftColumnWidth + (rightColumnWidth / 2) - (qrCodeSize / 2);
        
        // Add QR code to the PDF
        doc.addImage(qrCodeUrl, 'PNG', qrCodeX, startY, qrCodeSize, qrCodeSize);
        
        // Add QR code value below
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(qrCodeValue, leftColumnWidth + (rightColumnWidth / 2), startY + qrCodeSize + 10, { align: 'center' });
        
        // Add "Scan me" text
        doc.setFontSize(10);
        doc.setTextColor(accentColor);
        doc.text('Scan QR Code for Item Details', leftColumnWidth + (rightColumnWidth / 2), startY + qrCodeSize + 20, { align: 'center' });
      } catch (qrError) {
        console.error('Error generating QR code:', qrError);
      }
      
      // Add item information section - left column
      doc.setFillColor(lightGray);
      doc.roundedRect(10, startY, leftColumnWidth - 20, pageHeight - startY - 25, 3, 3, 'F');
      
      // Add section title
      doc.setFontSize(14);
      doc.setTextColor(primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Item Information', 20, startY + 10);
      
      // Add horizontal rule
      doc.setDrawColor(primaryColor);
      doc.setLineWidth(0.5);
      doc.line(20, startY + 13, leftColumnWidth - 30, startY + 13);
      
      // Helper function to determine stock status color
      const getStockStatusColor = (quantity) => {
        if (quantity <= 0) return '#dc3545'; // red for out of stock
        if (quantity < 5) return '#fd7e14';  // orange for low stock
        return '#198754';                    // green for in stock
      };
      
      // Create a status indicator for quantity
      const stockStatus = item.quantity > 0 
        ? (item.quantity < 5 ? 'LOW STOCK' : 'IN STOCK') 
        : 'OUT OF STOCK';
      const stockStatusColor = getStockStatusColor(item.quantity);
      
      // Add stock status badge
      doc.setFillColor(stockStatusColor);
      doc.roundedRect(leftColumnWidth - 70, startY + 2, 40, 8, 4, 4, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(stockStatus, leftColumnWidth - 50, startY + 7, { align: 'center' });
      
      // Format item details for the table
      const itemDetailsArray = [
        ['ID:', `${item.id}`],
        ['Type:', `${item.type || '-'}`],
        ['Quantity:', `${item.quantity || 0}`],
        ['Box Number:', `${item.box_number || '-'}`],
        ['Location:', `${item.location_name || '-'}`],
        ['Shelf:', `${item.shelf_name || '-'}`],
        ['Supplier:', `${item.supplier || '-'}`],
        ['Serial Number:', `${item.serial_number || '-'}`],
        ['EAN Code:', `${item.ean_code || '-'}`]
      ];
      
      // If there's a description, add it separately
      const hasDescription = item.description && item.description.trim().length > 0;
      
      // Add item details in a clean table format
      autoTable(doc, {
        startY: startY + 20,
        margin: { left: 20 },
        head: [],
        body: itemDetailsArray,
        theme: 'plain',
        styles: { 
          fontSize: 10, 
          cellPadding: 4,
          overflow: 'linebreak',
          lineWidth: 0.1
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold', 
            cellWidth: 40, 
            textColor: secondaryColor 
          },
          1: { 
            cellWidth: leftColumnWidth - 80,
            cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }
          }
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252]
        },
        didDrawCell: (data) => {
          if (data.column.index === 1 && data.row.index === 2) { // Quantity cell
            // Add colored dot for stock status
            const yPos = data.cell.y + data.cell.height / 2;
            const xPos = data.cell.x + data.cell.width - 10;
            
            doc.setFillColor(stockStatusColor);
            doc.circle(xPos, yPos, 2, 'F');
          }
        }
      });
      
      // Add description section if available
      if (hasDescription) {
        const finalY = doc.lastAutoTable.finalY + 10;
        
        doc.setFontSize(12);
        doc.setTextColor(secondaryColor);
        doc.setFont('helvetica', 'bold');
        doc.text('Description:', 20, finalY);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(item.description, 20, finalY + 7, {
          maxWidth: leftColumnWidth - 40
        });
      }
      
      // Add footer with timestamp
      doc.setDrawColor(primaryColor);
      doc.setLineWidth(0.5);
      doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 15, pageHeight - 7);
      doc.text('IT Stock Inventory System', pageWidth - 15, pageHeight - 7, { align: 'right' });
      
      // Save the PDF
      doc.save(`item-${item.id}-${item.name ? item.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'details'}.pdf`);
      
      // Show success message
      if (window.showToast) {
        window.showToast('Item PDF generated successfully', 'success');
      }
    } catch (error) {
      console.error('Error generating item PDF:', error);
      if (window.showToast) {
        window.showToast('Error generating PDF: ' + error.message, 'danger');
      } else {
        alert('Error generating PDF: ' + error.message);
      }
    }
  };

  // Function to handle box number click
  const handleBoxClick = (e, boxId) => {
    // Stop event propagation to prevent row click
    e.stopPropagation();
    
    try {
      // Safely handle tooltip - first check if the Bootstrap class exists
      if (window.bootstrap && window.bootstrap.Tooltip) {
        try {
          // Destroy tooltip on the clicked element to prevent it from staying visible
          const boxTooltipElement = e.currentTarget;
          if (boxTooltipElement) {
            const boxTooltipInstance = window.bootstrap.Tooltip.getInstance(boxTooltipElement);
            if (boxTooltipInstance) {
              boxTooltipInstance.hide();
              boxTooltipInstance.dispose();
            }
          }
        } catch (err) {
          console.error('Error handling tooltip in box click:', err);
          // Continue even if tooltip handling fails
        }
      }
      
      // Verify boxId is valid before navigation
      if (boxId) {
        // Navigate to box page - use setTimeout to ensure the tooltip disposal is complete
        setTimeout(() => {
          navigate(`/box/${boxId}`);
        }, 10);
      } else {
        console.error('Invalid boxId for navigation:', boxId);
      }
    } catch (err) {
      console.error('Error in box click handler:', err);
    }
  };

  const exportDropdownRef = useRef(null);
  
  // Initialize exportDropdown
  useEffect(() => {
    if (exportDropdownRef.current && window.bootstrap && window.bootstrap.Dropdown) {
      try {
        // First check if there's an existing dropdown instance and dispose it
        const existingDropdown = window.bootstrap.Dropdown.getInstance(exportDropdownRef.current);
        if (existingDropdown) {
          existingDropdown.dispose();
        }
        
        // Create a new dropdown instance
        new window.bootstrap.Dropdown(exportDropdownRef.current);
        console.log('Export dropdown initialized successfully');
      } catch (error) {
        console.error('Error initializing export dropdown:', error);
      }
    }
  }, []);

  // Helper to close export dropdown
  const closeExportDropdown = () => {
    if (exportDropdownRef.current && window.bootstrap && window.bootstrap.Dropdown) {
      try {
        const dropdown = window.bootstrap.Dropdown.getInstance(exportDropdownRef.current);
        if (dropdown) {
          dropdown.hide();
        } else {
          // If dropdown instance not found, try to create and then hide
          const newDropdown = new window.bootstrap.Dropdown(exportDropdownRef.current);
          newDropdown.hide();
        }
      } catch (error) {
        console.error('Error closing export dropdown:', error);
        
        // Fallback: manipulate DOM directly as a last resort
        if (exportDropdownRef.current) {
          exportDropdownRef.current.setAttribute('aria-expanded', 'false');
          const menu = document.querySelector('[aria-labelledby="exportDropdown"]');
          if (menu) {
            menu.classList.remove('show');
          }
        }
      }
    }
  };

  // Initialize Bootstrap dropdowns after component mounts
  useEffect(() => {
    // Small timeout to ensure the DOM is fully ready
    const timeoutId = setTimeout(() => {
      if (window.bootstrap && window.bootstrap.Dropdown) {
        try {
          // Initialize all dropdowns in the component
          const dropdownElementList = document.querySelectorAll('[data-bs-toggle="dropdown"]');
          dropdownElementList.forEach(dropdownToggleEl => {
            try {
              // Dispose of any existing instances
              const dropdownInstance = window.bootstrap.Dropdown.getInstance(dropdownToggleEl);
              if (dropdownInstance) {
                dropdownInstance.dispose();
              }
              
              // Create a new dropdown instance
              new window.bootstrap.Dropdown(dropdownToggleEl);
            } catch (err) {
              console.warn('Error initializing dropdown:', err);
            }
          });
          console.log('All dropdowns initialized');
        } catch (error) {
          console.error('Error initializing dropdowns:', error);
        }
      } else {
        console.warn('Bootstrap Dropdown not available');
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Add manual dropdown handling for the export button
  useEffect(() => {
    const handleExportButtonClick = (e) => {
      if (exportDropdownRef.current && e.target === exportDropdownRef.current) {
        e.preventDefault();
        e.stopPropagation();
        
        try {
          if (window.bootstrap && window.bootstrap.Dropdown) {
            const dropdown = window.bootstrap.Dropdown.getInstance(exportDropdownRef.current);
            if (dropdown) {
              dropdown.toggle();
            } else {
              // If no instance, create one and show it
              const newDropdown = new window.bootstrap.Dropdown(exportDropdownRef.current);
              newDropdown.show();
            }
          } else {
            // Manual DOM manipulation as fallback
            const menu = document.querySelector('[aria-labelledby="exportDropdown"]');
            if (menu) {
              const isShown = menu.classList.contains('show');
              if (isShown) {
                menu.classList.remove('show');
                exportDropdownRef.current.setAttribute('aria-expanded', 'false');
              } else {
                menu.classList.add('show');
                exportDropdownRef.current.setAttribute('aria-expanded', 'true');
              }
            }
          }
        } catch (error) {
          console.error('Error toggling export dropdown:', error);
        }
      }
    };
    
    // Close dropdown when clicking outside
    const handleOutsideClick = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        try {
          const menu = document.querySelector('[aria-labelledby="exportDropdown"]');
          if (menu && menu.classList.contains('show')) {
            closeExportDropdown();
          }
        } catch (error) {
          console.error('Error handling outside click for dropdown:', error);
        }
      }
    };
    
    // Add event listeners
    document.addEventListener('click', handleOutsideClick);
    if (exportDropdownRef.current) {
      exportDropdownRef.current.addEventListener('click', handleExportButtonClick);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      if (exportDropdownRef.current) {
        exportDropdownRef.current.removeEventListener('click', handleExportButtonClick);
      }
    };
  }, []);

  // Clean up the search input timeout when component unmounts
  useEffect(() => {
    return () => {
      if (searchInputTimeout) {
        clearTimeout(searchInputTimeout);
      }
    };
  }, [searchInputTimeout]);

  return (
    <ErrorBoundary errorMessage="Failed to load items. Please try again.">
      <div className="items-list-container">
        {/* Inject animation styles */}
        <style>{copyAnimationStyle}</style>
        
        {/* Status messages */}
        {error && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close"></button>
          </div>
        )}
        
        {successMessage && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMessage}
            <button type="button" className="btn-close" onClick={() => setSuccessMessage('')} aria-label="Close"></button>
          </div>
        )}
        
        {loading && (
          <div className="text-center my-3">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading items...</p>
          </div>
        )}
        
        <div className="container-fluid px-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="h5 mb-0">Items</h2>
            </div>
            <div className="d-flex">
                <button 
                className="btn btn-primary btn-sm me-2" 
                  type="button"
                onClick={openNewItemModal}
                >
                  <i className="bi bi-plus-circle me-1"></i>
                  Create Item
                </button>
                    <button 
                className="btn btn-success btn-sm me-2" 
                  type="button"
                      onClick={() => {
                        setStockInNewItemMode(false);
                        setShowStockInModal(true);
                        setTimeout(() => {
                    const scannerTab = document.querySelector('#stockInModal .nav-link[data-bs-target=\"#scanTab\"]');
                          if (scannerTab) scannerTab.click();
                        }, 300);
                      }}
                    >
                <i className="bi bi-box-arrow-in-down me-1"></i>
                Stock In
                    </button>
              <button 
                className="btn btn-warning btn-sm me-2" 
                onClick={() => {
                  if (selectedItems.length > 0) {
                    // Filter selected items from the items array
                    const selectedItemsData = items.filter(item => selectedItems.includes(item.id));
                    if (selectedItemsData.length > 0) {
                      setShowLabelPrintingModal(true);
                    } else {
                      alert('Could not load the selected items data. Please try again.');
                    }
                  } else {
                    alert('Please select items to print QR code labels');
                  }
                }}
                disabled={selectedItems.length === 0}
                title="Print QR codes for selected items"
              >
                <i className="bi bi-printer me-1"></i>
                Print QR Labels
              </button>
              <button
                className="btn btn-outline-primary me-2"
                onClick={handleManualRefresh}
                disabled={loading}
                title="Refresh Data"
              >
                <i className="bi bi-arrow-clockwise"></i>
                {loading ? ' Refreshing...' : ' Refresh'}
              </button>
              <div className="dropdown ms-2">
                <button
                  className="btn btn-outline-success btn-sm dropdown-toggle"
                  type="button"
                  id="exportDropdown"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  title="Export Data"
                  ref={exportDropdownRef}
                >
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>
                  Export
                </button>
                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="exportDropdown" data-bs-popper="static">
                  <li>
                    <button 
                      className="dropdown-item" 
                      onClick={exportToExcel}
                    >
                      <i className="bi bi-file-earmark-excel me-1"></i>
                      Export to Excel
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item" 
                      onClick={() => {
                        // First close the dropdown to prevent UI issues
                        setTimeout(() => closeExportDropdown(), 100);

                        // Simple CSV export
                        const headers = ['Name', 'Description', 'Type', 'Quantity', 'Box', 'Location', 'Supplier', 'Serial Number', 'EAN Code'];
                        
                        // Create CSV content
                        let csvContent = headers.join(',') + '\n';
                        
                        items.forEach(item => {
                          const row = [
                            `"${(item.name || '').replace(/"/g, '""')}"`,
                            `"${(item.description || '').replace(/"/g, '""')}"`,
                            `"${(item.type || '').replace(/"/g, '""')}"`,
                            item.quantity || 0,
                            `"${(item.box_number || '').replace(/"/g, '""')}"`,
                            `"${(item.location_name || '').replace(/"/g, '""')}"`,
                            `"${(item.supplier || '').replace(/"/g, '""')}"`,
                            `"${(item.serial_number || '').replace(/"/g, '""')}"`,
                            `"${(item.ean_code || '').replace(/"/g, '""')}"`
                          ];
                          csvContent += row.join(',') + '\n';
                        });
                        
                        // Create blob and download
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `items_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Show success message
                        if (window.showToast) {
                          window.showToast('CSV file exported successfully!', 'success');
                        }
                      }}
                    >
                      <i className="bi bi-filetype-csv me-1"></i>
                      Export to CSV
                    </button>
                  </li>
                  <li>
                    <button 
                      className="dropdown-item" 
                      onClick={() => {
                        try {
                          // First close the dropdown to prevent UI issues
                          setTimeout(() => closeExportDropdown(), 100);
                          
                          // Show spinner or toast while generating
                          if (window.showToast) {
                            window.showToast('Generating PDF, please wait...', 'info');
                          }
                          
                          // Initialize the PDF document (A4 format)
                          const doc = new jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: 'a4'
                          });
                          
                          // Set document properties
                          doc.setProperties({
                            title: 'Items Inventory Report',
                            subject: 'Inventory Report',
                            author: 'ReactStock',
                            creator: 'ReactStock'
                          });
                          
                          // Add title and timestamp
                          doc.setFontSize(20);
                          doc.setTextColor(40, 40, 40);
                          doc.text('Inventory Items Report', 14, 22);
                          
                          doc.setFontSize(10);
                          doc.setTextColor(100, 100, 100);
                          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
                          
                          // Add company info
                          doc.setFontSize(12);
                          doc.setTextColor(40, 40, 40);
                          doc.text('IT STOCK EUROPLAC', 14, 40);
                          
                          // Create the table
                          const tableColumn = [
                            'ID', 'Name', 'Type', 'Quantity', 'Box', 
                            'Location', 'Supplier', 'EAN'
                          ];
                          
                          // Map the items data to table rows
                          const tableRows = items.map(item => [
                            item.id,
                            item.name || '',
                            item.type || '',
                            item.quantity || 0,
                            item.box_number || '',
                            item.location_name || '',
                            item.supplier || '',
                            item.ean_code || ''
                          ]);
                          
                          // Generate table with autoTable function (using the imported function)
                          autoTable(doc, {
                            head: [tableColumn],
                            body: tableRows,
                            startY: 50,
                            theme: 'grid',
                            styles: {
                              fontSize: 8,
                              cellPadding: 1,
                              overflow: 'linebreak',
                              halign: 'left'
                            },
                            headStyles: {
                              fillColor: [66, 66, 66],
                              textColor: [255, 255, 255],
                              fontStyle: 'bold'
                            },
                            columnStyles: {
                              0: { cellWidth: 15 }, // ID
                              1: { cellWidth: 40 }, // Name
                              2: { cellWidth: 25 }, // Type
                              3: { cellWidth: 15, halign: 'center' }, // Quantity
                              4: { cellWidth: 20 }, // Box
                              5: { cellWidth: 25 }, // Location
                              6: { cellWidth: 25 }, // Supplier
                              7: { cellWidth: 25 }  // EAN
                            },
                            alternateRowStyles: {
                              fillColor: [245, 245, 245]
                            },
                            margin: { top: 10 },
                            didParseCell: (data) => {
                              // Add color to quantity cells based on value
                              if (data.column.index === 3 && data.section === 'body') {
                                const qty = parseInt(data.cell.raw);
                                if (qty === 0) {
                                  data.cell.styles.textColor = [255, 0, 0]; // Red for zero
                                } else if (qty < 5) {
                                  data.cell.styles.textColor = [255, 128, 0]; // Orange for low
                                }
                              }
                            }
                          });
                          
                          // Get the y-position after the table
                          const finalY = doc.lastAutoTable.finalY || 60;
                          
                          // Add summary section
                          doc.setFontSize(12);
                          doc.setTextColor(40, 40, 40);
                          doc.text('Summary', 14, finalY + 10);
                          
                          // Calculate summary data
                          const totalItems = items.length;
                          const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                          const uniqueTypes = [...new Set(items.filter(item => item.type).map(item => item.type))];
                          const uniqueBoxes = [...new Set(items.filter(item => item.box_number).map(item => item.box_number))];
                          const uniqueLocations = [...new Set(items.filter(item => item.location_name).map(item => item.location_name))];
                          
                          // Add summary data as a small table
                          autoTable(doc, {
                            body: [
                              ['Total Items', totalItems],
                              ['Total Quantity', totalQuantity],
                              ['Unique Types', uniqueTypes.length],
                              ['Unique Boxes', uniqueBoxes.length],
                              ['Unique Locations', uniqueLocations.length]
                            ],
                            startY: finalY + 15,
                            theme: 'plain',
                            styles: {
                              fontSize: 10,
                              cellPadding: 1
                            },
                            columnStyles: {
                              0: { fontStyle: 'bold', cellWidth: 40 },
                              1: { cellWidth: 30 }
                            }
                          });
                          
                          // Add filter information if filters are applied
                          if (selectedBox || searchTerm || selectedType) {
                            const filterY = doc.lastAutoTable.finalY + 10;
                            doc.setFontSize(10);
                            doc.setTextColor(100, 100, 100);
                            doc.text('Applied Filters:', 14, filterY);
                            
                            let filterText = [];
                            if (selectedBox) {
                              const boxName = boxes.find(b => b.id === parseInt(selectedBox))?.box_number || selectedBox;
                              filterText.push(`Box: ${boxName}`);
                            }
                            if (searchTerm) {
                              filterText.push(`Search: ${searchTerm}`);
                            }
                            if (selectedType) {
                              filterText.push(`Type: ${selectedType}`);
                            }
                            
                            doc.setFontSize(9);
                            doc.text(filterText.join(', '), 14, filterY + 5);
                          }
                          
                          // Add page numbers
                          const pageCount = doc.internal.getNumberOfPages();
                          for (let i = 1; i <= pageCount; i++) {
                            doc.setPage(i);
                            doc.setFontSize(8);
                            doc.setTextColor(150, 150, 150);
                            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
                          }
                          
                          // Save the PDF
                          doc.save(`inventory-items-${new Date().toISOString().slice(0,10)}.pdf`);
                          
                          // Show success toast
                          if (window.showToast) {
                            window.showToast('PDF successfully generated', 'success');
                          }
                        } catch (error) {
                          console.error('Error generating PDF:', error);
                          if (window.showToast) {
                            window.showToast('Error generating PDF: ' + error.message, 'danger');
                          }
                        }
                      }}
                    >
                      <i className="bi bi-file-earmark-pdf me-1"></i>
                      Export to PDF
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="card mb-3 filter-panel">
            <div className="card-body p-3">
              <div className="row g-2">
                <div className="col-md-3">
                  <label htmlFor="box-filter" className="form-label small mb-1">Box Filter</label>
                  <div className="input-group input-group-sm">
                    <select 
                      id="box-filter"
                      className="form-select form-select-sm"
                      value={selectedBox}
                      onChange={handleBoxChange}
                    >
                      <option value="">All Boxes</option>
                      {boxes.map(box => (
                        <option key={box.id} value={box.id}>
                          {box.box_number} {box.location_name && `(${box.location_name})`}
                        </option>
                      ))}
                    </select>
                    {selectedBox && (
                      <button 
                        className="btn btn-outline-secondary" 
                        type="button"
                        onClick={() => {
                          setSelectedBox('');
                          const params = new URLSearchParams(location.search);
                          params.delete('box_id');
                          
                          // Preserve type filter if exists
                          const typeFilter = params.get('type') || selectedType;
                          if (typeFilter) {
                            params.set('type', typeFilter);
                          }
                          
                          // Preserve search filter if exists
                          const searchFilter = params.get('search') || searchTerm;
                          if (searchFilter) {
                            params.set('search', searchFilter);
                          }
                          
                          // Add timestamp for cache busting
                          const timestamp = new Date().getTime();
                          params.set('_ts', timestamp);
                          
                          navigate({ search: params.toString() });
                          
                          // Clear API cache
                          if (api.clearCache) {
                            api.clearCache();
                            console.log('Cleared API cache for ALL BOXES view');
                          }
                          
                          // Set loading state
                          setLoading(true);
                          
                          // First refresh the materialized view to get fresh data
                          refreshItemsView().then(() => {
                            // Include all filters when fetching items
                            const parentId = params.get('parent_id');
                            console.log(`Box filter cleared, fetching fresh items with: search=${searchFilter}, parentId=${parentId}, type=${typeFilter}`);
                            
                            // Allow a small delay for the view refresh to complete
                            setTimeout(() => {
                              fetchItems(null, searchFilter || null, true, parentId || null, timestamp);
                            }, 500);
                          }).catch(error => {
                            console.error('Error refreshing view:', error);
                            fetchItems(null, searchFilter || null, true, parentId || null, timestamp);
                            setLoading(false);
                          });
                        }}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-3">
                  <label htmlFor="type-filter" className="form-label small mb-1">Type Filter</label>
                  <div className="input-group input-group-sm">
                    <select 
                      id="type-filter"
                      className="form-select form-select-sm"
                      value={selectedType}
                      onChange={handleTypeChange}
                    >
                      <option value="">All Types</option>
                      {availableTypes.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {selectedType && (
                      <button 
                        className="btn btn-outline-secondary" 
                        type="button"
                        onClick={clearTypeFilter}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <label htmlFor="search-input" className="form-label small mb-1">Search</label>
                  <form onSubmit={handleSearchSubmit} className="d-flex search-container">
                    <div className="input-group input-group-sm">
                      <input
                        id="search-input"
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                      />
                      <button className="btn btn-outline-secondary" type="submit">
                        <i className="bi bi-search"></i>
                      </button>
                      {searchTerm && (
                        <button 
                          className="btn btn-outline-secondary" 
                          type="button"
                          onClick={clearSearch}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          <ActiveFilters />

          {showBulkActions && (
            <div className="card mb-3 border-primary">
              <div className="card-body p-2 d-flex justify-content-between align-items-center">
                <div>
                  <span className="badge bg-primary rounded-pill me-2">{selectedItems.length}</span>
                  <span>items selected</span>
                </div>
                <div>
                  <button 
                    className="btn btn-outline-primary btn-sm me-2" 
                    onClick={openBulkTransferModal}
                  >
                    Transfer
                  </button>
                  <button 
                    className="btn btn-outline-danger btn-sm" 
                    onClick={handleBulkDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="d-flex justify-content-center my-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center my-5">
              <p className="text-muted">No items found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              {/* Add relationship legend above the table */}
              <div className="d-flex align-items-center justify-content-end mb-2">
                <div className="relationship-legend d-flex align-items-center bg-light py-1 px-2 rounded shadow-sm border" style={{ fontSize: '0.8rem' }}>
                  <span className="badge bg-secondary rounded-pill me-1 d-flex align-items-center justify-content-center" style={{width: "18px", height: "18px"}}>P</span>
                  <span className="text-muted me-2">Parent</span>
                  
                  <span className="badge bg-info rounded-pill me-1 d-flex align-items-center justify-content-center" style={{width: "18px", height: "18px"}}>C</span>
                  <span className="text-muted me-2">Child</span>
                  
                  <span className="badge bg-success rounded-pill me-1 d-flex align-items-center justify-content-center" style={{width: "18px", height: "18px"}}>N</span>
                  <span className="text-muted">Nested</span>
                </div>
              </div>
              
              <table className="table table-hover shadow-sm border">
                <thead className="bg-light">
                  <tr>
                    <th style={{ width: '40px' }} className="border-bottom">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                        />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer', width: '25%' }} onClick={() => handleSort('name')} className="border-bottom">
                      <div className="d-flex align-items-center">
                        Name / EAN
                        {sortColumn === 'name' && (
                          <span className="badge bg-primary ms-1 me-1 rounded-circle" style={{ fontSize: '0.7rem', width: '16px', height: '16px' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="name" />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('description')}>
                      <div className="d-flex align-items-center">
                        Description
                        {sortColumn === 'description' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="description" />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('type')}>
                      <div className="d-flex align-items-center">
                        Type
                        {sortColumn === 'type' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="type" />
                      </div>
                    </th>
                    {/* EAN column removed and merged with Name column */}
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quantity')}>
                      <div className="d-flex align-items-center">
                        Qty
                        {sortColumn === 'quantity' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="quantity" />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('supplier')}>
                      <div className="d-flex align-items-center">
                        Supplier
                        {sortColumn === 'supplier' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="supplier" />
                      </div>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('box_number')}>
                      <div className="d-flex align-items-center">
                        Box
                        {sortColumn === 'box_number' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="box_number" />
                      </div>
                    </th>
                    <th>Relationship</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('location_name')}>
                      <div className="d-flex align-items-center">
                        Location
                        {sortColumn === 'location_name' && (
                          <span className="badge bg-primary ms-1 me-1" style={{ fontSize: '0.7rem' }}>
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        <SortIcon currentSort={sortColumn} currentDirection={sortDirection} column="location_name" />
                      </div>
                    </th>
                    <th style={{ width: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr 
                      key={item.id} 
                      onClick={(e) => handleRowClick(e, item.id)} 
                      className={`${selectedItems.includes(item.id) ? "table-active" : ""} ${item.quantity === 0 ? "text-muted" : ""}`}
                      style={rowStyle}
                      onMouseEnter={(e) => {
                        Object.assign(e.currentTarget.style, rowHoverStyle);
                      }}
                      onMouseLeave={(e) => {
                        Object.assign(e.currentTarget.style, rowStyle);
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '';
                        e.currentTarget.style.backgroundColor = selectedItems.includes(item.id) ? '' : '';
                      }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="fw-medium d-flex align-items-center">
                          {item.display_name || item.name}
                          {item.display_name && item.display_name !== item.name && (
                            <span 
                              className="badge bg-info text-white ms-2" 
                              style={{fontSize: "0.7rem"}}
                              title="This item has a duplicate name and has been given a unique display name"
                            >
                              Duplicate
                            </span>
                          )}
                          {/* Type badge moved to Type column only */}
                        </div>
                        
                                                 {/* EAN display moved here from separate column */}
                         {item.ean_code && (
                           <div className="small mt-1">
                             <span 
                               className={`badge cursor-pointer copy-badge-hover ${copiedItemId === item.id ? 'bg-success text-white copy-animation' : ''}`} 
                               onClick={(e) => handleCopyToClipboard(e, item.ean_code, item.id)}
                               style={{
                                 ...copyableBadgeStyle,
                                 background: item.ean_code.startsWith('EPL-IT-STOCK') ? 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' : '#e8f5e9',
                                 color: '#2e7d32',
                                 border: '1px solid #a5d6a7',
                                 padding: '0.25rem 0.5rem',
                                 fontFamily: 'monospace',
                                 letterSpacing: '0.03rem'
                               }}
                               title="Click to copy to clipboard"
                               data-bs-toggle="tooltip"
                               data-bs-placement="top"
                             >
                               {copiedItemId === item.id ? (
                                 <span className="copied-text">
                                   <i className="bi bi-clipboard-check me-1"></i> Copied!
                                 </span>
                               ) : (
                                 <>
                                   <i className="bi bi-upc me-1" style={{color: '#1b5e20'}}></i> 
                                   {item.ean_code.startsWith('EPL-IT-STOCK') ? (
                                     <>
                                       <span style={{color: '#1b5e20', fontWeight: 'bold'}}>EPL-IT-STOCK</span>
                                       <span style={{color: '#2e7d32'}}>{item.ean_code.substring(12)}</span>
                                     </>
                                   ) : (
                                     <span>{item.ean_code}</span>
                                   )}
                                   <i className="bi bi-clipboard ms-1 copy-icon" style={{fontSize: '0.8rem'}}></i>
                                 </>
                               )}
                             </span>
                           </div>
                         )}
                        
                        {item.serial_number && (
                          <div className="small mt-1">
                            <span 
                              className={`badge cursor-pointer copy-badge-hover ${copiedItemId === item.id + '_sn' ? 'bg-success text-white copy-animation' : ''}`} 
                              onClick={(e) => handleCopyToClipboard(e, item.serial_number, item.id + '_sn')}
                              style={{
                                ...copyableBadgeStyle,
                                background: 'linear-gradient(135deg, #f2f7f9, #e6f0f5)',
                                color: '#0066cc',
                                border: '1px solid #c0d6e4',
                                padding: '0.25rem 0.5rem',
                                fontFamily: 'Consolas, monospace',
                                letterSpacing: '0.03rem',
                                fontWeight: '500'
                              }}
                              title="Click to copy SN to clipboard"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                            >
                              {copiedItemId === item.id + '_sn' ? (
                                <span className="copied-text">
                                  <i className="bi bi-clipboard-check me-1"></i> Copied!
                                </span>
                              ) : (
                                <>
                                  <i className="bi bi-upc-scan me-1" style={{color: '#0066cc'}}></i> 
                                  <span>SN: {item.serial_number}</span>
                                  <i className="bi bi-clipboard ms-1 copy-icon" style={{fontSize: '0.8rem'}}></i>
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        {item.description ? (
                          <div className="small text-wrap" style={{maxWidth: "200px", whiteSpace: "normal"}}>
                            {item.description}
                          </div>
                        ) : (
                          <span className="text-muted fst-italic">No description</span>
                        )}
                      </td>
                      <td>
                        {item.type ? (
                          <span className="badge bg-light text-dark border">{item.type}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                                            {/* EAN column removed - now displayed under the item name */}
                      <td className={`${item.quantity <= 0 ? 'text-danger' : item.quantity < 5 ? 'text-warning' : ''}`}>
                        <span className="fw-bold">{item.quantity}</span>
                      </td>
                      <td>
                        {item.supplier ? (
                          <div className="small">{item.supplier}</div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {item.box_id ? (
                          <div className="d-flex align-items-center">
                            <span 
                              className="badge box-badge me-1 cursor-pointer" 
                              style={{ 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: '#f0f0f0',
                                color: '#0066cc',
                                border: '1px solid #dddddd'
                              }}
                              onClick={(e) => handleBoxClick(e, item.box_id)}
                              title="Click to view box details"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e9ecef';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f0f0f0';
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = '';
                              }}
                            >
                              <i className="bi bi-box me-1"></i>
                              #{item.box_number || item.box_id}
                            </span>
                            {item.box_description && (
                              <span className="small text-muted ms-1">{item.box_description}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">No box</span>
                        )}
                      </td>
                      <td>
                          <ItemRelationship 
                            item={item} 
                            allItems={items} 
                          onOpenRelationshipModal={() => openRelationshipModal(item)}
                          />
                      </td>
                      <td>
                        {item.location_name ? (
                          <div className="d-flex align-items-center">
                            <span 
                              className="badge location-badge me-1"
                              style={{
                                backgroundColor: item.location_color || '#6c757d', 
                                color: getContrastYIQ(item.location_color)
                              }}
                            >
                              {item.location_name}
                            </span>
                            {item.shelf_name && (
                              <span className="badge bg-light text-dark border ms-1">{item.shelf_name}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex">
                          <button
                            className="action-button edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditItemModal(item.id);
                            }}
                            title="Edit Item"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                            <button 
                            className="action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStockOutModal(item);
                            }}
                              title="Stock Out"
                            >
                              <i className="bi bi-dash-circle"></i>
                            </button>
                          <button
                            className="action-button transfer"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTransferModal(item);
                            }}
                            title="Transfer Item"
                          >
                            <i className="bi bi-box-arrow-right"></i>
                          </button>
                          <button
                            className="action-button delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            title="Delete Item"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                          <button 
                            className="action-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openQRModal(item);
                            }}
                            title="Show QR Code"
                          >
                            <i className="bi bi-qr-code"></i>
                          </button>
                          <button
                            className="action-button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await generateItemPDF(item);
                            }}
                            title="Generate Item PDF"
                          >
                            <i className="bi bi-file-earmark-pdf"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Item Modal */}
          {showModal && (
            <ItemModal
              show={showModal}
              handleClose={closeModal}
              itemId={selectedItemId}
              boxId={selectedBox || null}
              onSuccess={handleModalSuccess}
            />
          )}

          {/* Transfer Modal */}
          {showTransferModal && (
            <TransferModal
              show={showTransferModal}
              handleClose={closeTransferModal}
              itemId={selectedItemForTransfer?.id}
              currentBoxId={selectedItemForTransfer?.box_id}
              itemName={selectedItemForTransfer?.name}
              displayName={selectedItemForTransfer?.display_name}
              onSuccess={handleTransferSuccess}
            />
          )}

          {/* Bulk Transfer Modal */}
          {showBulkTransferModal && (
            <BulkTransferModal
              itemIds={selectedItems}
              onClose={closeBulkTransferModal}
              onSuccess={handleBulkTransferSuccess}
            />
          )}

          {/* Stock In Modal */}
          {showStockInModal && (
            <StockInModal
              show={showStockInModal}
              handleClose={closeStockInModal}
              onSuccess={handleStockOperationSuccess}
              newItemMode={stockInNewItemMode}
            />
          )}

          {/* Stock Out Modal */}
          {showStockOutModal && (
            <StockOutModal
              show={showStockOutModal}
              handleClose={closeStockOutModal}
              preselectedItemId={selectedItemForStockOut}
              onSuccess={handleStockOperationSuccess}
            />
          )}

          {/* Relationship Modal */}
          {showRelationshipModal && (
            <RelationshipModal
              item={selectedItemForRelationship}
              onClose={closeRelationshipModal}
              onSuccess={handleRelationshipSuccess}
            />
          )}

          {/* QR Code Modal */}
          {showQRModal && selectedItemForQR && (
            <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
              <div className="modal-dialog modal-md">
                <div className="modal-content">
                  <div className="modal-header py-2 bg-dark text-white">
                    <h5 className="modal-title h6">QR CODE FOR ITEM</h5>
                    <button 
                      type="button" 
                      className="btn-close btn-close-white" 
                      onClick={closeQRModal} 
                      aria-label="Close"
                    ></button>
                  </div>
                  <div className="modal-body p-3 text-center">
                    <h6>{selectedItemForQR.display_name || selectedItemForQR.name}</h6>
                    <div className="alert alert-info py-2 mb-3">
                      <small>
                        <i className="bi bi-info-circle me-1"></i>
                        Choose the "17mm x 54mm (Compact)" format for small labels
                      </small>
                    </div>
                    <div className="d-flex justify-content-center my-3">
                      <QRCodeLabel 
                        itemId={selectedItemForQR.id} 
                        itemName={selectedItemForQR.display_name || selectedItemForQR.name}
                        qrValue={selectedItemForQR.qr_code}
                        size={200}
                        labelFormat="compact"
                      />
                    </div>
                  </div>
                  <div className="modal-footer py-2">
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={closeQRModal}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Label Printing Modal */}
          {showLabelPrintingModal && (
            <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
              <div className="modal-dialog modal-xl">
                <div className="modal-content">
                  <div className="modal-header py-2 bg-dark text-white">
                    <h5 className="modal-title h6">PRINT QR CODE LABELS</h5>
                    <button 
                      type="button" 
                      className="btn-close btn-close-white" 
                      onClick={() => setShowLabelPrintingModal(false)} 
                      aria-label="Close"
                    ></button>
                  </div>
                  <div className="modal-body p-3">
                    <ItemLabelPrinting
                      items={items.filter(item => selectedItems.includes(item.id))}
                      onClose={() => setShowLabelPrintingModal(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default ItemList; 