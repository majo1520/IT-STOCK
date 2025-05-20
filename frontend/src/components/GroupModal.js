import React, { useState, useEffect } from 'react';
import { createGroup, updateGroup } from '../services/api';

function GroupModal({ show, handleClose, group = null, onSuccess }) {
  const isEditMode = !!group;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      if (isEditMode && group) {
        setFormData({
          name: group.name || '',
          description: group.description || '',
          notes: group.notes || ''
        });
      } else {
        // Reset form for new group
        setFormData({
          name: '',
          description: '',
          notes: ''
        });
      }
      setError(null);
    }
  }, [group, show, isEditMode]);

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
      
      console.log('Submitting group data:', formData);
      
      if (isEditMode) {
        await updateGroup(group.id, formData);
      } else {
        await createGroup(formData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} group:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} group. Please try again.`);
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
              {isEditMode ? 'EDIT GROUP' : 'NEW GROUP'}
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
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Group Name *</label>
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

export default GroupModal; 