import React, { useState, useEffect } from 'react';
import { createShelf, updateShelf, getLocations, getColors } from '../services/api';

function ShelfModal({ show, handleClose, shelf = null, onSuccess }) {
  const isEditMode = !!shelf;

  const [formData, setFormData] = useState({
    name: '',
    location_id: '',
    color_id: '',
    description: ''
  });
  
  const [locations, setLocations] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      // Load locations and colors for dropdowns
      fetchLocations();
      fetchColors();
      
      if (isEditMode && shelf) {
        setFormData({
          name: shelf.name || '',
          location_id: shelf.location_id || '',
          color_id: shelf.color_id || '',
          description: shelf.description || ''
        });
      } else {
        // Reset form for new shelf
        setFormData({
          name: '',
          location_id: '',
          color_id: '',
          description: ''
        });
      }
      setError(null);
    }
  }, [shelf, show, isEditMode]);

  const fetchLocations = async () => {
    try {
      const response = await getLocations();
      setLocations(response.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchColors = async () => {
    try {
      const response = await getColors();
      setColors(response.data);
    } catch (err) {
      console.error('Error fetching colors:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      if (isEditMode) {
        await updateShelf(shelf.id, formData);
      } else {
        await createShelf(formData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} shelf:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} shelf. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Find selected location and color for preview
  const selectedLocation = locations.find(loc => loc.id === parseInt(formData.location_id));
  const selectedColor = colors.find(col => col.id === parseInt(formData.color_id));

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2 bg-dark text-white">
            <h5 className="modal-title h6">
              {isEditMode ? 'EDIT SHELF' : 'NEW SHELF'}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleClose} disabled={loading}></button>
          </div>
          <div className="modal-body p-3">
            {loading ? (
              <div className="d-flex justify-content-center py-3">
                <div className="spinner-border text-primary spinner-border-sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger my-2 py-2">
                    {error}
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Shelf Name *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="location_id" className="form-label small mb-1 fw-bold">Location</label>
                  <select
                    className="form-select form-select-sm"
                    id="location_id"
                    name="location_id"
                    value={formData.location_id}
                    onChange={handleChange}
                  >
                    <option value="">Select a location</option>
                    {locations.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="color_id" className="form-label small mb-1 fw-bold">Color</label>
                  <select
                    className="form-select form-select-sm"
                    id="color_id"
                    name="color_id"
                    value={formData.color_id}
                    onChange={handleChange}
                  >
                    <option value="">Select a color</option>
                    {colors.map(color => (
                      <option key={color.id} value={color.id}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 d-flex flex-wrap">
                    {colors.slice(0, 8).map(color => (
                      <div 
                        key={color.id}
                        className="color-suggestion me-2 mb-2"
                        style={{
                          width: '25px',
                          height: '25px',
                          borderRadius: '4px',
                          backgroundColor: color.hex_code,
                          cursor: 'pointer',
                          border: formData.color_id === color.id.toString() ? '2px solid #000' : '1px solid #ddd'
                        }}
                        onClick={() => setFormData({...formData, color_id: color.id.toString()})}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="description" className="form-label small mb-1 fw-bold">Description</label>
                  <textarea
                    className="form-control form-control-sm"
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="2"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Preview</label>
                  <div className="p-3 border rounded" style={{ 
                    backgroundColor: selectedLocation ? selectedLocation.color : '#f8f9fa',
                    position: 'relative'
                  }}>
                    <div className="badge bg-light text-dark position-absolute top-0 end-0 m-2">
                      {selectedLocation ? selectedLocation.name : 'No Location'}
                    </div>
                    <div className="d-flex align-items-center mt-2">
                      <div 
                        className="color-preview me-2" 
                        style={{ 
                          backgroundColor: selectedColor ? selectedColor.hex_code : '#cccccc',
                          width: '15px',
                          height: '15px',
                          borderRadius: '50%',
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}
                      ></div>
                      <h6 className="mb-0" style={{ 
                        color: selectedLocation ? getBestTextColor(selectedLocation.color) : '#000000',
                        fontWeight: 'bold'
                      }}>
                        {formData.name || 'Shelf Name'}
                      </h6>
                    </div>
                    <p className="small mt-2 mb-0" style={{ 
                      color: selectedLocation ? getBestTextColor(selectedLocation.color) : '#000000',
                      opacity: 0.8
                    }}>
                      {formData.description || 'No description provided'}
                    </p>
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm me-2"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    ) : isEditMode ? 'SAVE' : 'CREATE'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
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

export default ShelfModal; 