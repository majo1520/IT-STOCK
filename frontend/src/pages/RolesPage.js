import React, { useState, useEffect } from 'react';
import { getRoles, deleteRole } from '../services/api';
import RoleModal from '../components/RoleModal';

function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await getRoles();
      setRoles(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (role = null) => {
    setCurrentRole(role);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentRole(null);
  };

  const handleDeleteClick = (role) => {
    setDeleteConfirmation(role);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    try {
      setLoading(true);
      await deleteRole(deleteConfirmation.id);
      fetchRoles();
      setDeleteConfirmation(null);
    } catch (err) {
      console.error('Error deleting role:', err);
      setError('Failed to delete role. Please try again.');
      setLoading(false);
    }
  };

  // Function to get the appropriate badge class based on role color
  const getBadgeClass = (color) => {
    const colorMap = {
      '#dc3545': 'bg-danger',
      '#fd7e14': 'bg-warning',
      '#198754': 'bg-success',
      '#0d6efd': 'bg-primary',
      '#0dcaf0': 'bg-info',
      '#6f42c1': 'bg-purple',
      '#6c757d': 'bg-secondary',
      '#212529': 'bg-dark'
    };
    
    return colorMap[color] || 'bg-secondary';
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Role Management</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => handleOpenModal()}
        >
          <i className="bi bi-plus-circle me-1"></i> New Role
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {loading && !showModal ? (
        <div className="d-flex justify-content-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Access Level</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-3">
                      No roles found. Create your first role using the "New Role" button.
                    </td>
                  </tr>
                ) : (
                  roles.map(role => (
                    <tr key={role.id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <span 
                            className={`badge ${getBadgeClass(role.color)} me-2`}
                            style={{width: '20px', height: '20px'}}
                          ></span>
                          <strong>{role.name}</strong>
                        </div>
                      </td>
                      <td>{role.description}</td>
                      <td>
                        <span className="badge bg-secondary">
                          Level {role.access_level}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleOpenModal(role)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteClick(role)}
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
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="modal fade show" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2 bg-danger text-white">
                <h5 className="modal-title h6">Confirm Delete</h5>
                <button type="button" className="btn-close btn-close-white" onClick={handleCancelDelete}></button>
              </div>
              <div className="modal-body p-3">
                <p>Are you sure you want to delete the role "{deleteConfirmation.name}"?</p>
                <p className="text-danger mb-0"><strong>This action cannot be undone.</strong></p>
              </div>
              <div className="modal-footer py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelDelete}>Cancel</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleConfirmDelete}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Create/Edit Modal */}
      <RoleModal
        show={showModal}
        handleClose={handleCloseModal}
        role={currentRole}
        onSuccess={fetchRoles}
      />
    </div>
  );
}

export default RolesPage; 