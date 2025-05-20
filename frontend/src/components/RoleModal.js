import React, { useState, useEffect } from 'react';
import { createRole, updateRole } from '../services/api';

function RoleModal({ show, handleClose, role = null, onSuccess }) {
  const isEditMode = !!role;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    access_level: 1,
    color: '#6c757d', // Default gray color
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available colors for roles with their Bootstrap class names
  const availableColors = [
    { value: '#dc3545', name: 'Red', class: 'bg-danger' },
    { value: '#fd7e14', name: 'Orange', class: 'bg-warning' },
    { value: '#198754', name: 'Green', class: 'bg-success' },
    { value: '#0d6efd', name: 'Blue', class: 'bg-primary' },
    { value: '#0dcaf0', name: 'Cyan', class: 'bg-info' },
    { value: '#6f42c1', name: 'Purple', class: 'bg-purple' },
    { value: '#6c757d', name: 'Gray', class: 'bg-secondary' },
    { value: '#212529', name: 'Dark', class: 'bg-dark' }
  ];

  useEffect(() => {
    if (show) {
      if (isEditMode && role) {
        setFormData({
          name: role.name || '',
          description: role.description || '',
          access_level: role.access_level || 1,
          color: role.color || '#6c757d',
          notes: role.notes || ''
        });
      } else {
        // Reset form for new role
        setFormData({
          name: '',
          description: '',
          access_level: 1,
          color: '#6c757d',
          notes: ''
        });
      }
      setError(null);
    }
  }, [role, show, isEditMode]);

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
      
      console.log('Submitting role data:', formData);
      
      if (isEditMode) {
        await updateRole(role.id, formData);
      } else {
        await createRole(formData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} role:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} role. Please try again.`);
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
              {isEditMode ? 'EDIT ROLE' : 'NEW ROLE'}
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
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Role Name *</label>
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
                    rows="2"
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="access_level" className="form-label small mb-1 fw-bold">Access Level</label>
                  <select
                    className="form-select form-select-sm"
                    id="access_level"
                    name="access_level"
                    value={formData.access_level}
                    onChange={handleChange}
                  >
                    <option value="1">1 - Basic Access</option>
                    <option value="2">2 - Standard Access</option>
                    <option value="3">3 - Extended Access</option>
                    <option value="4">4 - Manager Access</option>
                    <option value="5">5 - Admin Access</option>
                  </select>
                  <small className="text-muted">Higher levels have more permissions</small>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Color</label>
                  <div className="d-flex flex-wrap gap-2">
                    {availableColors.map(color => (
                      <div key={color.value} className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="color"
                          id={`color-${color.name}`}
                          value={color.value}
                          checked={formData.color === color.value}
                          onChange={handleChange}
                        />
                        <label 
                          className="form-check-label d-flex align-items-center" 
                          htmlFor={`color-${color.name}`}
                        >
                          <span 
                            className={`badge ${color.class} me-1`} 
                            style={{width: '20px', height: '20px'}}
                          ></span>
                          {color.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="notes" className="form-label small mb-1 fw-bold">Notes</label>
                  <textarea
                    className="form-control form-control-sm"
                    id="notes"
                    name="notes"
                    rows="2"
                    value={formData.notes}
                    onChange={handleChange}
                  />
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
                    {isEditMode ? 'SAVE' : 'CREATE'}
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

export default RoleModal; 