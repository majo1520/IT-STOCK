import React, { useState, useEffect } from 'react';
import { createUser, updateUser, resetPassword } from '../services/api';

function UserModal({ show, handleClose, user = null, mode = 'create', onSuccess }) {
  const isEditMode = mode === 'edit';
  const isResetPassword = mode === 'resetPassword';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    full_name: '',
    role: 'user'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      if (isEditMode && user) {
        setFormData({
          username: user.username || '',
          password: '',
          confirmPassword: '',
          email: user.email || '',
          full_name: user.full_name || '',
          role: user.role || 'user'
        });
      } else if (isResetPassword && user) {
        setFormData({
          ...formData,
          username: user.username || '',
          password: '',
          confirmPassword: ''
        });
      } else {
        // Reset form for new user
        setFormData({
          username: '',
          password: '',
          confirmPassword: '',
          email: '',
          full_name: '',
          role: 'user'
        });
      }
      setError(null);
    }
  }, [user, show, mode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords match if needed
    if ((mode === 'create' || mode === 'resetPassword') && 
        formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      if (isEditMode) {
        // Remove password fields for edit mode if not changing password
        const { password, confirmPassword, ...updateData } = formData;
        await updateUser(user.id, updateData);
      } else if (isResetPassword) {
        // Only send password for reset
        await resetPassword(user.id, { password: formData.password });
      } else {
        // Remove confirmPassword for create mode
        const { confirmPassword, ...userData } = formData;
        await createUser(userData);
      }
      
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${mode === 'create' ? 'creating' : mode === 'edit' ? 'updating' : 'resetting password for'} user:`, err);
      setError(err.response?.data?.error || `Failed to ${mode === 'create' ? 'create' : mode === 'edit' ? 'update' : 'reset password for'} user. Please try again.`);
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
              {isEditMode ? 'EDIT USER' : isResetPassword ? 'RESET PASSWORD' : 'NEW USER'}
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
                  <label htmlFor="username" className="form-label small mb-1 fw-bold">Username</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={isEditMode || isResetPassword}
                    required
                  />
                </div>

                {!isEditMode || isResetPassword ? (
                  <>
                    <div className="mb-3">
                      <label htmlFor="password" className="form-label small mb-1 fw-bold">Password</label>
                      <input
                        type="password"
                        className="form-control form-control-sm"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="confirmPassword" className="form-label small mb-1 fw-bold">Confirm Password</label>
                      <input
                        type="password"
                        className="form-control form-control-sm"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </>
                ) : null}

                {!isResetPassword && (
                  <>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label small mb-1 fw-bold">Email</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="full_name" className="form-label small mb-1 fw-bold">Full Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="full_name"
                        name="full_name"
                        value={formData.full_name}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="role" className="form-label small mb-1 fw-bold">Role</label>
                      <select
                        className="form-select form-select-sm"
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="worker">Worker</option>
                        <option value="headworker">Head Worker</option>
                        <option value="leader">Leader</option>
                        <option value="office">Office</option>
                      </select>
                    </div>
                  </>
                )}

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
                    ) : isEditMode ? 'SAVE' : isResetPassword ? 'RESET PASSWORD' : 'CREATE'}
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

export default UserModal; 