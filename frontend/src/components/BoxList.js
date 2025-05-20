import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getBoxes, deleteBox, getItems, getLocations, getShelves } from '../services/api';
import BoxModal from './BoxModal';

function BoxList() {
  const location = useLocation();
  const [boxes, setBoxes] = useState([]);
  const [filteredBoxes, setFilteredBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [previewBoxId, setPreviewBoxId] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0 });
  const [sortOption, setSortOption] = useState('boxNumber-asc'); // Default sort
  const [locationFilter, setLocationFilter] = useState('all');
  const [shelfFilter, setShelfFilter] = useState('all');
  const [showItemPreviews, setShowItemPreviews] = useState(true); // For mini previews
  const [viewType, setViewType] = useState('card'); // New state for view type: 'card' or 'list'
  const previewTimeoutRef = useRef(null);
  const previewPopupRef = useRef(null);

  // Check for state parameter indicating we should show new box modal
  useEffect(() => {
    if (location.state?.showNewBoxModal) {
      // If navigated from Dashboard with showNewBoxModal state, open the modal
      openNewBoxModal();
      // Clear the state to avoid reopening the modal on page refresh
      window.history.replaceState({}, document.title);
    }
    
    // Check for saved viewType in localStorage
    const savedViewType = localStorage.getItem('boxesViewType');
    if (savedViewType && (savedViewType === 'card' || savedViewType === 'list')) {
      setViewType(savedViewType);
    }
  }, [location]);

  // Click outside handler to close the preview popup
  const handleClickOutside = useCallback((event) => {
    if (previewPopupRef.current && !previewPopupRef.current.contains(event.target)) {
      setPreviewBoxId(null);
    }
  }, []);

  // Handle escape key to close popup
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      setPreviewBoxId(null);
    }
  }, []);

  useEffect(() => {
    fetchBoxes();
    fetchItems();
    fetchLocations();
    fetchShelves();
  }, []);

  // Apply sorting and filtering whenever boxes, sortOption, locationFilter, or shelfFilter changes
  useEffect(() => {
    applyFiltersAndSort();
  }, [boxes, sortOption, locationFilter, shelfFilter]);

  // Initialize Bootstrap tooltips when filteredBoxes changes
  useEffect(() => {
    // Initialize tooltips
    if (typeof document !== 'undefined' && typeof window !== 'undefined' && window.bootstrap) {
      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltipTriggerList].map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl));
    }
  }, [filteredBoxes]);

  // Add event listeners for click outside and escape key
  useEffect(() => {
    if (previewBoxId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewBoxId, handleClickOutside, handleKeyDown]);

  // Function to toggle view type between card and list
  const toggleViewType = () => {
    const newViewType = viewType === 'card' ? 'list' : 'card';
    setViewType(newViewType);
    localStorage.setItem('boxesViewType', newViewType);
  };

  const fetchBoxes = async () => {
    try {
      setLoading(true);
      const response = await getBoxes();
      setBoxes(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch boxes. Please try again later.');
      console.error('Error fetching boxes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await getItems();
      setItems(response.data);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchShelves = async () => {
    try {
      const response = await getShelves();
      setShelves(response.data);
    } catch (err) {
      console.error('Error fetching shelves:', err);
    }
  };

  // Get location name by ID
  const getLocationName = (locationId) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Unknown';
  };

  // Get location color by ID
  const getLocationColor = (locationId) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.color : '#6c757d';  // Default gray color
  };

  // Get shelf name by ID
  const getShelfName = (shelfId) => {
    const shelf = shelves.find(s => s.id === shelfId);
    return shelf ? shelf.name : 'Unknown';
  };

  // Apply filters and sorting
  const applyFiltersAndSort = () => {
    let result = [...boxes];
    
    // Apply location filter
    if (locationFilter !== 'all') {
      result = result.filter(box => 
        box.location_id && box.location_id.toString() === locationFilter
      );
    }
    
    // Apply shelf filter
    if (shelfFilter !== 'all') {
      result = result.filter(box => 
        box.shelf_id && box.shelf_id.toString() === shelfFilter
      );
    }
    
    // Apply sorting
    switch (sortOption) {
      case 'boxNumber-asc':
        result.sort((a, b) => {
          const numA = a.box_number ? parseInt(a.box_number, 10) : 0;
          const numB = b.box_number ? parseInt(b.box_number, 10) : 0;
          return numA - numB;
        });
        break;
      case 'boxNumber-desc':
        result.sort((a, b) => {
          const numA = a.box_number ? parseInt(a.box_number, 10) : 0;
          const numB = b.box_number ? parseInt(b.box_number, 10) : 0;
          return numB - numA;
        });
        break;
      case 'itemCount-asc':
        result.sort((a, b) => {
          const countA = items.filter(item => item.box_id === a.id).length;
          const countB = items.filter(item => item.box_id === b.id).length;
          return countA - countB;
        });
        break;
      case 'itemCount-desc':
        result.sort((a, b) => {
          const countA = items.filter(item => item.box_id === a.id).length;
          const countB = items.filter(item => item.box_id === b.id).length;
          return countB - countA;
        });
        break;
      case 'location':
        result.sort((a, b) => {
          const locA = getLocationName(a.location_id) || 'ZZZZZZ';
          const locB = getLocationName(b.location_id) || 'ZZZZZZ';
          return locA.localeCompare(locB);
        });
        break;
      default:
        // Default sort is by box number ascending
        result.sort((a, b) => {
          const numA = a.box_number ? parseInt(a.box_number, 10) : 0;
          const numB = b.box_number ? parseInt(b.box_number, 10) : 0;
          return numA - numB;
        });
    }
    
    setFilteredBoxes(result);
  };

  // Function to handle sort change
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  // Function to handle location filter change
  const handleLocationFilterChange = (e) => {
    setLocationFilter(e.target.value);
  };

  // Function to handle shelf filter change
  const handleShelfFilterChange = (e) => {
    setShelfFilter(e.target.value);
  };

  // Function to get items for a specific box
  const getBoxItems = (boxId) => {
    return items.filter(item => item.box_id === boxId);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this box?')) {
      try {
        await deleteBox(id);
        setBoxes(boxes.filter(box => box.id !== id));
      } catch (err) {
        setError('Failed to delete box. Please try again later.');
        console.error('Error deleting box:', err);
      }
    }
  };

  const openNewBoxModal = () => {
    setSelectedBoxId(null);
    setShowModal(true);
  };

  const openEditBoxModal = (id) => {
    setSelectedBoxId(id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    fetchBoxes();
  };

  // Function to handle mouse enter for item preview
  const handleItemPreviewEnter = (boxId, event) => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    previewTimeoutRef.current = setTimeout(() => {
      if (event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        setPreviewPosition(calculatePopupPosition(rect));
        setPreviewBoxId(boxId);
      }
    }, 100); // Reduced delay for faster preview response
  };

  // Function to handle click for item preview
  const handleItemPreviewClick = (boxId, event) => {
    event.stopPropagation();
    
    if (previewBoxId === boxId) {
      setPreviewBoxId(null);
    } else {
      if (event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        setPreviewPosition(calculatePopupPosition(rect));
        setPreviewBoxId(boxId);
      }
    }
  };

  // Calculate optimal position for the popup
  const calculatePopupPosition = (triggerRect) => {
    const windowHeight = window.innerHeight;
    const popupHeight = 300; // Estimate height for the popup
    
    let top, left;
    
    if (triggerRect.bottom + popupHeight > windowHeight) {
      // Position above if there's not enough space below
      top = triggerRect.top - popupHeight - 5;
    } else {
      // Position below if there's enough space
      top = triggerRect.bottom + 5;
    }
    
    // Position horizontally to the left of the trigger, but not off screen
    left = Math.max(10, triggerRect.left - 150);
    
    return { top, left };
  };

  // Function to handle mouse leave for item preview
  const handleItemPreviewLeave = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
  };

  // Function to toggle item previews
  const toggleItemPreviews = () => {
    setShowItemPreviews(!showItemPreviews);
  };

  // Function to render a mini preview of items directly within the box card
  const renderMiniItemPreview = (boxId) => {
    const boxItems = getBoxItems(boxId);
    
    if (boxItems.length === 0) {
      return <div className="text-muted small">No items</div>;
    }
    
    // Display first few items with ellipsis if there are more
    const maxDisplayItems = 3;
    const displayItems = boxItems.slice(0, maxDisplayItems);
    const remainingItems = boxItems.length - maxDisplayItems;
    
    return (
      <div className="mini-preview mt-2">
        <ul className="list-unstyled mb-0 small">
          {displayItems.map((item, index) => (
            <li key={item.id} className="text-truncate">
              <small>
                <i className="bi bi-dot"></i>
                {item.name}
                {item.type ? ` (${item.type})` : ''}
              </small>
            </li>
          ))}
          {remainingItems > 0 && (
            <li className="text-muted">
              <small>
                <i className="bi bi-plus-circle-dotted"></i>
                {remainingItems} more item{remainingItems > 1 ? 's' : ''}
              </small>
            </li>
          )}
        </ul>
      </div>
    );
  };

  const renderItemPreview = () => {
    if (!previewBoxId) return null;
    
    const boxItems = getBoxItems(previewBoxId);
    const box = boxes.find(b => b.id === previewBoxId);
    
    if (!box) return null;
    
    return (
      <div 
        ref={previewPopupRef}
        className="box-preview-popup card shadow-sm" 
        style={{
          position: 'fixed',
          top: `${previewPosition.top}px`,
          left: `${previewPosition.left}px`,
          width: '350px', // Slightly wider
          zIndex: 1060
        }}
      >
        <div className="card-header py-2 d-flex justify-content-between align-items-center">
          <span className="fw-bold">Box #{box.box_number} Items</span>
          <button 
            className="btn btn-sm btn-close" 
            onClick={() => setPreviewBoxId(null)}
          />
        </div>
        <div className="card-body p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <div className="mb-2">
            <span className="badge" 
              style={{ 
                backgroundColor: getLocationColor(box.location_id),
                color: getContrastTextColor(getLocationColor(box.location_id))
              }}
            >
              {getLocationName(box.location_id)}
            </span>
            <span className="ms-1 badge bg-dark">{getShelfName(box.shelf_id)}</span>
          </div>
          
          {boxItems.length === 0 ? (
            <div className="text-muted small text-center py-3">No items in this box</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm small">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Serial/Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {boxItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.type || '-'}</td>
                      <td>{item.quantity || 1}</td>
                      <td className="text-truncate" style={{maxWidth: '100px'}}>{item.serial_number || item.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="mt-2 text-center">
            <Link 
              to={`/box/${previewBoxId}`} 
              className="btn btn-sm btn-primary" 
              onClick={() => setPreviewBoxId(null)}
            >
              View Box Details
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to determine if text should be white or black based on background
  const getContrastTextColor = (bgColor) => {
    // If no color, use white text on dark background
    if (!bgColor) return 'white';
    
    // Convert hex to RGB
    let r, g, b;
    
    if (bgColor.startsWith('#')) {
      // Convert hex to RGB
      const hex = bgColor.slice(1);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      // Use default black
      return 'white';
    }
    
    // Calculate brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return white for dark backgrounds, black for light backgrounds
    return brightness > 128 ? 'black' : 'white';
  };

  return (
    <div className="h-100 d-flex flex-column">
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <h2 className="mb-0">Boxes</h2>
        <div className="d-flex gap-2">
          <div className="form-check form-switch me-2 d-flex align-items-center">
            <input
              className="form-check-input me-1"
              type="checkbox"
              id="previewToggle"
              checked={showItemPreviews}
              onChange={toggleItemPreviews}
            />
            <label className="form-check-label small" htmlFor="previewToggle">
              Show Previews
            </label>
          </div>

          {/* View type toggle button */}
          <div className="btn-group me-2">
            <button 
              type="button" 
              className={`btn btn-sm ${viewType === 'card' ? 'btn-primary' : 'btn-outline-primary'}`} 
              onClick={() => viewType !== 'card' && toggleViewType()}
              title="Card View"
            >
              <i className="bi bi-grid-3x3-gap-fill"></i>
            </button>
            <button 
              type="button" 
              className={`btn btn-sm ${viewType === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => viewType !== 'list' && toggleViewType()}
              title="List View"
            >
              <i className="bi bi-list-ul"></i>
            </button>
          </div>

          <Link to="/box/new" className="btn btn-primary btn-sm me-1 d-inline-flex align-items-center">
            <i className="bi bi-plus-circle me-1"></i> 
            New Box
          </Link>
          <div className="btn-group btn-group-sm">
            <select 
              className="form-select form-select-sm" 
              value={locationFilter} 
              onChange={handleLocationFilterChange}
              aria-label="Filter by location"
            >
              <option value="all">All Locations</option>
              {locations.map(location => (
                <option key={location.id} value={location.id.toString()}>
                  {location.name}
                </option>
              ))}
            </select>
            <select 
              className="form-select form-select-sm" 
              value={shelfFilter} 
              onChange={handleShelfFilterChange}
              aria-label="Filter by shelf"
            >
              <option value="all">All Shelves</option>
              {shelves.map(shelf => (
                <option key={shelf.id} value={shelf.id.toString()}>
                  {shelf.name}
                </option>
              ))}
            </select>
            <select 
              className="form-select form-select-sm" 
              value={sortOption} 
              onChange={handleSortChange}
              aria-label="Sort by"
            >
              <option value="boxNumber-asc">Box # (Ascending)</option>
              <option value="boxNumber-desc">Box # (Descending)</option>
              <option value="itemCount-asc">Items (Fewest first)</option>
              <option value="itemCount-desc">Items (Most first)</option>
              <option value="location">Location</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center flex-grow-1">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          {filteredBoxes.length === 0 ? (
            <div className="alert alert-info">
              No boxes found. Create your first box to get started.
            </div>
          ) : viewType === 'card' ? (
            // Card View
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-3">
              {filteredBoxes.map(box => (
                <div className="col" key={box.id}>
                  <div 
                    className="card h-100 box-card" 
                    style={{ 
                      borderLeft: `5px solid ${getLocationColor(box.location_id)}`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <Link 
                          to={`/box/${box.id}`}
                          className="fw-bold text-decoration-none"
                          style={{ fontSize: '1.1rem' }}
                        >
                          Box #{box.box_number || 'Unknown'}
                        </Link>
                        <div className="dropdown">
                          <button className="btn btn-sm btn-link text-dark p-0" type="button" data-bs-toggle="dropdown">
                            <i className="bi bi-three-dots-vertical"></i>
                          </button>
                          <ul className="dropdown-menu dropdown-menu-end">
                            <li>
                              <Link to={`/box/${box.id}`} className="dropdown-item small">
                                <i className="bi bi-eye me-1"></i> View
                              </Link>
                            </li>
                            <li>
                              <Link to={`/box/${box.id}/edit`} className="dropdown-item small">
                                <i className="bi bi-pencil me-1"></i> Edit
                              </Link>
                            </li>
                            <li>
                              <hr className="dropdown-divider" />
                            </li>
                            <li>
                              <button 
                                className="dropdown-item small text-danger" 
                                onClick={() => handleDelete(box.id)}
                              >
                                <i className="bi bi-trash me-1"></i> Delete
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="mb-2 small">
                        <div className="text-muted d-flex align-items-center">
                          <i className="bi bi-geo-alt me-1"></i>
                          <span className="fw-bold" style={{ color: '#333' }}>{getLocationName(box.location_id)}</span>
                        </div>
                        <div className="text-muted d-flex align-items-center">
                          <i className="bi bi-bookshelf me-1"></i>
                          <span className="fw-bold" style={{ color: '#333' }}>{getShelfName(box.shelf_id)}</span>
                        </div>
                        {box.serial_number && (
                          <div className="text-muted d-flex align-items-center">
                            <i className="bi bi-upc me-1"></i>
                            <span className="text-monospace">{box.serial_number}</span>
                          </div>
                        )}
                        {box.reference_id && (
                          <div className="text-muted d-flex align-items-center">
                            <i className="bi bi-hash me-1"></i>
                            <span className="text-monospace">{box.reference_id}</span>
                          </div>
                        )}
                      </div>

                      <div className="d-flex justify-content-between align-items-end">
                        <div 
                          className="d-flex align-items-center item-preview-trigger"
                          onMouseEnter={(e) => handleItemPreviewEnter(box.id, e)}
                          onMouseLeave={handleItemPreviewLeave}
                          onClick={(e) => handleItemPreviewClick(box.id, e)}
                        >
                          <i className="bi bi-box-seam me-1"></i>
                          <span 
                            className={`badge ${getBoxItems(box.id).length > 0 ? 'bg-primary' : 'bg-secondary'} position-relative`}
                            data-bs-toggle="tooltip"
                            data-bs-title="Click to see contents"
                          >
                            {getBoxItems(box.id).length} items
                            <span className="position-absolute top-0 start-100 translate-middle">
                              <i className="bi bi-eye-fill small ms-1 text-info"></i>
                            </span>
                          </span>
                        </div>
                        <div>
                          <Link 
                            to={`/box/${box.id}/edit`}
                            className="btn btn-sm btn-outline-primary me-1"
                          >
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <Link 
                            to={`/box/${box.id}`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            <i className="bi bi-arrow-right"></i>
                          </Link>
                        </div>
                      </div>
                      
                      {/* Show mini preview of items if enabled */}
                      {showItemPreviews && getBoxItems(box.id).length > 0 && (
                        <div className="mt-2 pt-2 border-top">
                          {renderMiniItemPreview(box.id)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // List View
            <div className="table-responsive">
              <table className="table table-hover table-striped">
                <thead>
                  <tr>
                    <th>Box #</th>
                    <th>Location</th>
                    <th>Shelf</th>
                    <th>Items</th>
                    {box => box.serial_number && <th>Serial #</th>}
                    {box => box.reference_id && <th>Reference ID</th>}
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoxes.map(box => (
                    <tr key={box.id}>
                      <td>
                        <Link 
                          to={`/box/${box.id}`}
                          className="fw-bold text-decoration-none d-flex align-items-center"
                        >
                          <span 
                            className="color-indicator me-2" 
                            style={{ 
                              width: '10px', 
                              height: '10px', 
                              borderRadius: '50%', 
                              backgroundColor: getLocationColor(box.location_id),
                              display: 'inline-block'
                            }}
                          />
                          #{box.box_number || 'Unknown'}
                        </Link>
                      </td>
                      <td>{getLocationName(box.location_id)}</td>
                      <td>{getShelfName(box.shelf_id)}</td>
                      <td>
                        <div 
                          className="d-flex align-items-center item-preview-trigger"
                          onMouseEnter={(e) => handleItemPreviewEnter(box.id, e)}
                          onMouseLeave={handleItemPreviewLeave}
                          onClick={(e) => handleItemPreviewClick(box.id, e)}
                        >
                          <span 
                            className={`badge ${getBoxItems(box.id).length > 0 ? 'bg-primary' : 'bg-secondary'}`}
                            data-bs-toggle="tooltip"
                            data-bs-title="Click to see contents"
                          >
                            {getBoxItems(box.id).length}
                            <i className="bi bi-eye-fill small ms-1"></i>
                          </span>
                        </div>
                      </td>
                      {box.serial_number && <td className="text-monospace">{box.serial_number}</td>}
                      {box.reference_id && <td className="text-monospace">{box.reference_id}</td>}
                      <td>
                        <span className="text-muted small">{box.description}</span>
                        {showItemPreviews && getBoxItems(box.id).length > 0 && (
                          <div className="small text-truncate" style={{ maxWidth: '200px' }}>
                            {getBoxItems(box.id).slice(0, 1).map(item => (
                              <span key={item.id} className="text-muted">
                                {item.name}
                                {getBoxItems(box.id).length > 1 && ' +' + (getBoxItems(box.id).length - 1)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="d-flex">
                          <Link 
                            to={`/box/${box.id}`}
                            className="btn btn-sm btn-outline-secondary me-1"
                          >
                            <i className="bi bi-eye"></i>
                          </Link>
                          <Link 
                            to={`/box/${box.id}/edit`}
                            className="btn btn-sm btn-outline-primary me-1"
                          >
                            <i className="bi bi-pencil"></i>
                          </Link>
                          <button 
                            className="btn btn-sm btn-outline-danger" 
                            onClick={() => handleDelete(box.id)}
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
          )}
        </>
      )}

      {previewBoxId && renderItemPreview()}

      <BoxModal 
        show={showModal} 
        handleClose={closeModal} 
        boxId={selectedBoxId}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default BoxList; 