import React, { useState, useEffect } from 'react';
import { getGroups, deleteGroup } from '../services/api';
import GroupModal from '../components/GroupModal';

function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await getGroups();
      setGroups(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Failed to load groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (group = null) => {
    setCurrentGroup(group);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCurrentGroup(null);
  };

  const handleDeleteClick = (group) => {
    setDeleteConfirmation(group);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    try {
      setLoading(true);
      await deleteGroup(deleteConfirmation.id);
      fetchGroups();
      setDeleteConfirmation(null);
    } catch (err) {
      console.error('Error deleting group:', err);
      setError('Failed to delete group. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Group Management</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => handleOpenModal()}
        >
          <i className="bi bi-plus-circle me-1"></i> New Group
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
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-3">
                      No groups found. Create your first group using the "New Group" button.
                    </td>
                  </tr>
                ) : (
                  groups.map(group => (
                    <tr key={group.id}>
                      <td>{group.name}</td>
                      <td>{group.description}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary me-2"
                          onClick={() => handleOpenModal(group)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteClick(group)}
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
                <p>Are you sure you want to delete the group "{deleteConfirmation.name}"?</p>
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

      {/* Group Create/Edit Modal */}
      <GroupModal
        show={showModal}
        handleClose={handleCloseModal}
        group={currentGroup}
        onSuccess={fetchGroups}
      />
    </div>
  );
}

export default GroupsPage; 