import React, { useState, useEffect } from 'react';
import { createColor, updateColor } from '../services/api';

function ColorModal({ show, handleClose, color = null, onSuccess }) {
  const isEditMode = !!color;

  const [formData, setFormData] = useState({
    name: '',
    hex_code: '#000000'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      if (isEditMode && color) {
        setFormData({
          name: color.name || '',
          hex_code: color.hex_code || '#000000'
        });
      } else {
        // Reset form for new color
        setFormData({
          name: '',
          hex_code: '#000000'
        });
      }
      setError(null);
    }
  }, [color, show, isEditMode]);

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
        await updateColor(color.id, formData);
      } else {
        await createColor(formData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} color:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} color. Please try again.`);
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
              {isEditMode ? 'EDIT COLOR' : 'NEW COLOR'}
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
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Color Name *</label>
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
                  <label htmlFor="hex_code" className="form-label small mb-1 fw-bold">Hex Code *</label>
                  <div className="d-flex align-items-center">
                    <input
                      type="color"
                      className="form-control form-control-sm me-2"
                      id="color_picker"
                      name="hex_code"
                      value={formData.hex_code}
                      onChange={handleChange}
                      style={{ width: '50px', height: '38px' }}
                    />
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="hex_code"
                      name="hex_code"
                      value={formData.hex_code}
                      onChange={handleChange}
                      required
                      pattern="^#[0-9A-Fa-f]{6}$"
                      title="Hex color code (e.g. #FF0000)"
                    />
                  </div>
                  <small className="text-muted">Format: #RRGGBB</small>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Preview</label>
                  <div className="p-3 border rounded" style={{ backgroundColor: formData.hex_code }}>
                    <div className="text-center">
                      <span style={{ 
                        color: getBestTextColor(formData.hex_code), 
                        fontWeight: 'bold',
                        textShadow: '0px 0px 1px rgba(0,0,0,0.2)' 
                      }}>
                        {formData.name || 'Color Preview'}
                      </span>
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

export default ColorModal; 