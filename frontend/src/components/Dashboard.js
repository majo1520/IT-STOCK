import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getBoxes, getItems } from '../services/api';

function Dashboard() {
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Location color mapping
  const locationColors = {
    'IT OFFICE': 'success',
    'IT HOUSE': 'danger',
    'WAREHOUSE': 'warning',
    'STORAGE': 'primary',
    'SERVER ROOM': 'info'
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [boxesResponse, itemsResponse] = await Promise.all([
        getBoxes(),
        getItems()
      ]);
      
      setBoxes(boxesResponse.data);
      setItems(itemsResponse.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch inventory data. Please try again later.');
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get color class for location
  const getLocationColorClass = (location) => {
    if (!location) return 'bg-secondary';
    
    // Check if we have a predefined color for this location
    const normalizedLocation = location.toUpperCase();
    for (const [key, value] of Object.entries(locationColors)) {
      if (normalizedLocation.includes(key)) {
        return `bg-${value}`;
      }
    }
    
    // Default color if no match
    return 'bg-secondary';
  };

  // Count items per box
  const itemCountsByBox = items.reduce((counts, item) => {
    if (item.box_id) {
      counts[item.box_id] = (counts[item.box_id] || 0) + 1;
    }
    return counts;
  }, {});

  // Group boxes by location
  const boxesByLocation = boxes.reduce((grouped, box) => {
    const location = box.location || 'Unassigned';
    if (!grouped[location]) {
      grouped[location] = [];
    }
    grouped[location].push(box);
    return grouped;
  }, {});

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger my-2 py-2">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-grid me-2 text-primary" viewBox="0 0 16 16">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-3z"/>
          </svg>
          <div>
            <small className="text-muted">OVERVIEW</small>
            <h2 className="h5 mb-0">INVENTORY</h2>
          </div>
        </div>
        
        <div>
          <Link to="/boxes" className="btn btn-primary btn-sm me-1 d-inline-flex align-items-center" state={{ showNewBoxModal: true }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-seam me-1" viewBox="0 0 16 16">
              <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2zm3.564 1.426L5.596 5 8 5.961 14.154 3.5zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"/>
            </svg>
            NEW BOX
          </Link>
          <Link to="/items" className="btn btn-primary btn-sm d-inline-flex align-items-center" state={{ showNewItemModal: true }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-plus-circle me-1" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
            </svg>
            NEW ITEM
          </Link>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body p-3">
          <div className="row">
            <div className="col-md-3 mb-2 mb-md-0">
              <div className="d-flex align-items-center">
                <div className="bg-primary bg-opacity-10 p-2 rounded me-2 d-flex align-items-center justify-content-center" style={{width: "40px", height: "40px"}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-boxes text-primary" viewBox="0 0 16 16">
                    <path d="M7.752.066a.5.5 0 0 1 .496 0l3.75 2.143a.5.5 0 0 1 .252.434v3.995l3.498 2A.5.5 0 0 1 16 9.07v4.286a.5.5 0 0 1-.252.434l-3.75 2.143a.5.5 0 0 1-.496 0l-3.502-2-3.502 2.001a.5.5 0 0 1-.496 0l-3.75-2.143A.5.5 0 0 1 0 13.357V9.071a.5.5 0 0 1 .252-.434L3.75 6.638V2.643a.5.5 0 0 1 .252-.434L7.752.066ZM4.25 7.504 1.508 9.071l2.742 1.567 2.742-1.567L4.25 7.504ZM7.5 9.933l-2.75 1.571v3.134l2.75-1.571V9.933Zm1 3.134 2.75 1.571v-3.134L8.5 9.933v3.134Zm.508-3.996 2.742 1.567 2.742-1.567-2.742-1.567-2.742 1.567Zm2.242-2.433V3.504L8.5 5.076V8.21l2.75-1.572ZM7.5 8.21V5.076L4.75 3.504v3.134L7.5 8.21ZM5.258 2.643 8 4.21l2.742-1.567L8 1.076 5.258 2.643ZM15 9.933l-2.75 1.571v3.134L15 13.067V9.933ZM3.75 14.638v-3.134L1 9.933v3.134l2.75 1.571Z"/>
                  </svg>
                </div>
                <div>
                  <div className="small text-muted">Total Items</div>
                  <div className="h5 m-0">{items.length}</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-2 mb-md-0">
              <div className="d-flex align-items-center">
                <div className="bg-success bg-opacity-10 p-2 rounded me-2 d-flex align-items-center justify-content-center" style={{width: "40px", height: "40px"}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-box-seam text-success" viewBox="0 0 16 16">
                    <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5l2.404.961L10.404 2zm3.564 1.426L5.596 5 8 5.961 14.154 3.5zm3.25 1.7-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464z"/>
                  </svg>
                </div>
                <div>
                  <div className="small text-muted">Total Boxes</div>
                  <div className="h5 m-0">{boxes.length}</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 mb-2 mb-md-0">
              <div className="d-flex align-items-center">
                <div className="bg-warning bg-opacity-10 p-2 rounded me-2 d-flex align-items-center justify-content-center" style={{width: "40px", height: "40px"}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-geo-alt text-warning" viewBox="0 0 16 16">
                    <path d="M12.166 8.94c-.524 1.062-1.234 2.12-1.96 3.07A31.493 31.493 0 0 1 8 14.58a31.481 31.481 0 0 1-2.206-2.57c-.726-.95-1.436-2.008-1.96-3.07C3.304 7.867 3 6.862 3 6a5 5 0 0 1 10 0c0 .862-.305 1.867-.834 2.94zM8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10z"/>
                    <path d="M8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                  </svg>
                </div>
                <div>
                  <div className="small text-muted">Locations</div>
                  <div className="h5 m-0">{Object.keys(boxesByLocation).length}</div>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="d-flex align-items-center">
                <div className="bg-info bg-opacity-10 p-2 rounded me-2 d-flex align-items-center justify-content-center" style={{width: "40px", height: "40px"}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-123 text-info" viewBox="0 0 16 16">
                    <path d="M2.873 11.297V4.142H1.699L0 5.379v1.137l1.64-1.18h.06v5.961h1.174Zm3.213-5.09v-.063c0-.618.44-1.169 1.196-1.169.676 0 1.174.44 1.174 1.106 0 .624-.42 1.101-.807 1.526L4.99 10.553v.744h4.78v-.99H6.643v-.069L8.41 8.252c.65-.724 1.237-1.332 1.237-2.27C9.646 4.849 8.723 4 7.308 4c-1.573 0-2.36 1.064-2.36 2.15v.057h1.138Zm6.559 1.883h.786c.823 0 1.374.481 1.379 1.179.01.707-.55 1.216-1.421 1.21-.77-.005-1.326-.419-1.379-.953h-1.095c.042 1.053.938 1.918 2.464 1.918 1.478 0 2.642-.839 2.62-2.144-.02-1.143-.922-1.651-1.551-1.714v-.063c.535-.09 1.347-.66 1.326-1.678-.026-1.053-.933-1.855-2.359-1.855-1.5 0-2.37.92-2.37 1.887h1.08c.012-.49.492-.844 1.248-.844.694 0 1.248.384 1.248.982 0 .59-.452.994-1.2.994h-.788v.92Z"/>
                  </svg>
                </div>
                <div>
                  <div className="small text-muted">Total Quantity</div>
                  <div className="h5 m-0">{items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center py-2">
              <span className="small fw-bold d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-boxes me-1 text-primary" viewBox="0 0 16 16">
                  <path d="M7.752.066a.5.5 0 0 1 .496 0l3.75 2.143a.5.5 0 0 1 .252.434v3.995l3.498 2A.5.5 0 0 1 16 9.07v4.286a.5.5 0 0 1-.252.434l-3.75 2.143a.5.5 0 0 1-.496 0l-3.502-2-3.502 2.001a.5.5 0 0 1-.496 0l-3.75-2.143A.5.5 0 0 1 0 13.357V9.071a.5.5 0 0 1 .252-.434L3.75 6.638V2.643a.5.5 0 0 1 .252-.434L7.752.066ZM4.25 7.504 1.508 9.071l2.742 1.567 2.742-1.567L4.25 7.504Z"/>
                </svg>
                BOXES
              </span>
              <span className="badge bg-primary">{boxes.length}</span>
            </div>
            <div className="card-body p-0">
              {Object.keys(boxesByLocation).length === 0 ? (
                <div className="p-3 text-center">
                  <small className="text-muted">No boxes found</small>
                </div>
              ) : (
                <div className="list-group list-group-flush dashboard-scroll">
                  {Object.entries(boxesByLocation).map(([location, locationBoxes]) => (
                    <div key={location} className="location-group">
                      <div className={`list-group-item ${getLocationColorClass(location)} text-white py-1 px-3`}>
                        <small className="fw-bold">{location}</small>
                        <span className="badge bg-secondary float-end">{locationBoxes.length}</span>
                      </div>
                      {locationBoxes.map(box => (
                        <Link 
                          to={`/boxes/${box.id}`} 
                          key={box.id} 
                          className="list-group-item list-group-item-action py-1 px-3"
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="small">
                              <span className="fw-bold">#{box.box_number}</span>
                              {box.shelf && 
                                <span className="text-primary fw-bold ms-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" className="bi bi-bookmark-fill text-info me-1" viewBox="0 0 16 16">
                                    <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
                                  </svg>
                                  {box.shelf}
                                </span>
                              }
                            </div>
                            <div>
                              <span className="badge bg-info me-1">
                                {itemCountsByBox[box.id] || 0} items
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header d-flex justify-content-between align-items-center py-2">
              <span className="small fw-bold d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-collection me-1 text-primary" viewBox="0 0 16 16">
                  <path d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-11zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1h-7zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6v7zm1.5.5A.5.5 0 0 1 1 13V6a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5h-13z"/>
                </svg>
                RECENT ITEMS
              </span>
              <span className="badge bg-primary">{items.length}</span>
            </div>
            <div className="card-body p-0">
              {items.length === 0 ? (
                <div className="p-3 text-center">
                  <small className="text-muted">No items found</small>
                </div>
              ) : (
                <div className="list-group list-group-flush dashboard-scroll">
                  {items.slice(0, 10).map(item => {
                    const boxData = boxes.find(box => box.id === item.box_id);
                    return (
                      <Link 
                        to={`/items/edit/${item.id}`} 
                        key={item.id} 
                        className="list-group-item list-group-item-action py-1 px-3"
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="small">
                            <span>{item.name}</span>
                            <span className="badge bg-secondary ms-1">{item.quantity}</span>
                          </div>
                          <div>
                            {boxData && (
                              <small className={`badge ${getLocationColorClass(boxData.location)} text-white`}>
                                #{boxData.box_number}
                              </small>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {items.length > 10 && (
                    <Link to="/items" className="list-group-item list-group-item-action text-center py-1">
                      <small className="text-primary">See all {items.length} items</small>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 