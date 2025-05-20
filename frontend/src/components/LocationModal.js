import React, { useState, useEffect } from 'react';
import { createLocation, updateLocation, getColors } from '../services/api';

function LocationModal({ show, handleClose, location = null, onSuccess }) {
  const isEditMode = !!location;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4287f5'
  });
  
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      // Load colors for color picker
      fetchColors();
      
      if (isEditMode && location) {
        setFormData({
          name: location.name || '',
          description: location.description || '',
          color: location.color || '#4287f5'
        });
      } else {
        // Reset form for new location
        setFormData({
          name: '',
          description: '',
          color: '#4287f5'
        });
      }
      setError(null);
    }
  }, [location, show, isEditMode]);

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
        await updateLocation(location.id, formData);
      } else {
        await createLocation(formData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} location:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} location. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2 bg-dark text-white">
            <h5 className="modal-title h6">
              {isEditMode ? 'EDIT LOCATION' : 'NEW LOCATION'}
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
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Location Name *</label>
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
                  <label htmlFor="color" className="form-label small mb-1 fw-bold">Color</label>
                  <div className="d-flex align-items-center">
                    <input
                      type="color"
                      className="form-control form-control-sm me-2"
                      id="color_picker"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      style={{ width: '50px', height: '38px' }}
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="color"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      title="Hex color code (e.g. #4287f5)"
                    />
                  </div>
                  <small className="text-muted">Format: #RRGGBB</small>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Color Suggestions</label>
                  <div className="d-flex flex-wrap">
                    {colors.slice(0, 10).map(color => (
                      <div 
                        key={color.id}
                        className="color-suggestion me-2 mb-2"
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '4px',
                          backgroundColor: color.hex_code,
                          cursor: 'pointer',
                          border: formData.color === color.hex_code ? '2px solid #000' : '1px solid #ddd'
                        }}
                        onClick={() => setFormData({...formData, color: color.hex_code})}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Preview</label>
                  <div className="p-3 border rounded d-flex justify-content-between align-items-center" style={{ backgroundColor: formData.color }}>
                    <div>
                      <span style={{ 
                        color: getBestTextColor(formData.color), 
                        fontWeight: 'bold',
                        textShadow: '0px 0px 1px rgba(0,0,0,0.2)' 
                      }}>
                        {formData.name || 'Location Name'}
                      </span>
                    </div>
                    <div className="badge bg-light text-dark">
                      <i className="bi bi-geo-alt me-1"></i>
                      {formData.name || 'Location'}
                    </div>
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
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default LocationModal; 