import React, { useState, useEffect } from 'react';
import { getShelves, deleteShelf } from '../services/api';
import ShelfModal from './ShelfModal';

function ShelfList() {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState(null);

  useEffect(() => {
    fetchShelves();
  }, []);

  const fetchShelves = async () => {
    try {
      setLoading(true);
      const response = await getShelves();
      setShelves(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching shelves:', err);
      setError('Failed to fetch shelves. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShelf = () => {
    setSelectedShelf(null);
    setShowModal(true);
  };

  const handleEditShelf = (shelf) => {
    setSelectedShelf(shelf);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the shelf "${name}"?`)) {
      try {
        await deleteShelf(id);
        setShelves(shelves.filter(shelf => shelf.id !== id));
      } catch (err) {
        console.error('Error deleting shelf:', err);
        if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to delete shelf. Please try again later.');
        }
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    fetchShelves();
    setShowModal(false);
  };

  if (loading && shelves.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <i className="bi bi-bookshelf fs-4 me-2 text-primary"></i>
          <div>
            <small className="text-muted">ADMIN PANEL</small>
            <h2 className="h5 mb-0">SHELVES</h2>
          </div>
        </div>
        <button 
          className="btn btn-primary btn-sm d-flex align-items-center"
          onClick={handleCreateShelf}
        >
          <i className="bi bi-plus-circle me-1"></i>
          NEW SHELF
        </button>
      </div>

      {error && (
        <div className="alert alert-danger my-2 py-2">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header bg-dark py-2 d-flex align-items-center">
          <i className="bi bi-grid-3x3 text-white me-2"></i>
          <h3 className="h6 mb-0 text-white">Shelf Management</h3>
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0">
            <thead className="bg-light">
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Color</th>
                <th>Description</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shelves.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-3">No shelves found</td>
                </tr>
              ) : (
                shelves.map(shelf => (
                  <tr key={shelf.id}>
                    <td className="fw-bold">
                      <span className="d-flex align-items-center">
                        <div 
                          className="shelf-color me-2" 
                          style={{ 
                            backgroundColor: shelf.color_hex || '#cccccc',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%'
                          }}
                        ></div>
                        {shelf.name}
                      </span>
                    </td>
                    <td>
                      {shelf.location_name ? (
                        <span className="badge" style={{
                          backgroundColor: shelf.location_color || '#6c757d',
                          color: getBestTextColor(shelf.location_color || '#6c757d')
                        }}>
                          <i className="bi bi-geo-alt me-1"></i>
                          {shelf.location_name}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <div 
                          className="color-preview me-2" 
                          style={{ 
                            backgroundColor: shelf.color_hex || '#cccccc',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}
                        ></div>
                        {shelf.color_name || '-'}
                      </div>
                    </td>
                    <td>{shelf.description || '-'}</td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleEditShelf(shelf)}
                          title="Edit Shelf"
                          style={{width: "28px", height: "28px"}}
                        >
                          <i className="bi bi-pencil" style={{fontSize: "14px"}}></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleDelete(shelf.id, shelf.name)}
                          title="Delete Shelf"
                          style={{width: "28px", height: "28px"}}
                        >
                          <i className="bi bi-trash" style={{fontSize: "14px"}}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ShelfModal
        show={showModal}
        handleClose={closeModal}
        shelf={selectedShelf}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

// Helper function to determine best text color (black or white) for a given background color
function getBestTextColor(hexColor) {
  // Check if hexColor is valid
  if (!hexColor || !hexColor.startsWith('#')) return '#000000';
  
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#000000';
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default ShelfList; 