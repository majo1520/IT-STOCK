import React, { useState, useEffect } from 'react';
import { getRemovalReasons, createRemovalReason, updateRemovalReason, deleteRemovalReason } from '../services/api';

function RemovalReasonManagement() {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentReason, setCurrentReason] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchReasons();
  }, []);

  const fetchReasons = async () => {
    try {
      setLoading(true);
      const response = await getRemovalReasons();
      if (response && response.data) {
        setReasons(Array.isArray(response.data) ? response.data : []);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching removal reasons:', err);
      setError('Failed to load removal reasons. Using default reasons.');
      setReasons([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (reason = null) => {
    if (reason) {
      // Edit existing reason
      setCurrentReason(reason);
      setFormData({
        id: reason.id || '',
        name: reason.name || '',
        description: reason.description || ''
      });
    } else {
      // New reason
      setCurrentReason(null);
      setFormData({
        id: '',
        name: '',
        description: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentReason(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a reason name');
      return;
    }
    
    try {
      if (currentReason) {
        // Update existing reason
        await updateRemovalReason(currentReason.id, formData);
      } else {
        // Create new reason
        await createRemovalReason(formData);
      }
      
      fetchReasons(); // Refresh the list
      closeModal();
    } catch (err) {
      console.error('Error saving removal reason:', err);
      setError('Failed to save removal reason. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this removal reason?')) {
      return;
    }
    
    try {
      await deleteRemovalReason(id);
      fetchReasons(); // Refresh the list
    } catch (err) {
      console.error('Error deleting removal reason:', err);
      setError('Failed to delete removal reason. Please try again.');
    }
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0">Removal Reasons Management</h2>
          <p className="text-muted">Manage reasons for removing items from inventory</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => openModal()}
        >
          <i className="bi bi-plus-circle me-1"></i>
          Add New Reason
        </button>
      </div>

      {error && (
        <div className="alert alert-warning">{error}</div>
      )}

      {loading ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover table-striped mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Reason Name</th>
                    <th>Description</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reasons.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-muted">
                        No removal reasons defined. Click "Add New Reason" to create one.
                      </td>
                    </tr>
                  ) : (
                    reasons.map(reason => (
                      <tr key={reason.id}>
                        <td>{reason.id}</td>
                        <td>{reason.name}</td>
                        <td>{reason.description || '-'}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => openModal(reason)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(reason.id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding/editing removal reasons */}
      {showModal && (
        <div className="modal d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {currentReason ? 'Edit Removal Reason' : 'Add New Removal Reason'}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="id" className="form-label">Reason ID (identifier code)</label>
                    <input
                      type="text"
                      className="form-control"
                      id="id"
                      name="id"
                      value={formData.id}
                      onChange={handleInputChange}
                      placeholder="e.g., DAMAGED, SOLD, RETURNED"
                      required
                    />
                    <small className="form-text text-muted">
                      Use uppercase letters with no spaces (e.g., DAMAGED, SOLD)
                    </small>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">Reason Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g., Damaged/Defective, Sold to Customer"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="description" className="form-label">Description (optional)</label>
                    <textarea
                      className="form-control"
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Provide additional details about this reason"
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary">
                    {currentReason ? 'Update Reason' : 'Add Reason'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RemovalReasonManagement; 