import React, { useState, useEffect } from 'react';
import { createCustomer, updateCustomer, getGroups, getRoles } from '../services/api';

function CustomerModal({ show, handleClose, customer = null, onSuccess }) {
  const isEditMode = !!customer;

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    group_name: '',
    role_id: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (show) {
      // Fetch groups and roles for the selection dropdowns
      fetchGroups();
      fetchRoles();
      
      if (isEditMode && customer) {
        console.log('Editing customer:', customer);
        
        // Ensure all fields are properly set from the customer object
        setFormData({
          name: customer.name || '',
          contact_person: customer.contact_person || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          group_name: customer.group_name || '',
          role_id: customer.role_id || '',
          notes: customer.notes || ''
        });
        
        console.log('Form data set for editing:', {
          name: customer.name || '',
          contact_person: customer.contact_person || '',
          group_name: customer.group_name || '',
          role_id: customer.role_id || ''
        });
      } else {
        // Reset form for new customer
        setFormData({
          name: '',
          contact_person: '',
          email: '',
          phone: '',
          address: '',
          group_name: '',
          role_id: '',
          notes: ''
        });
      }
      setError(null);
    }
  }, [customer, show, isEditMode]);

  const fetchGroups = async () => {
    try {
      const response = await getGroups();
      console.log('Fetched groups:', response);
      
      // Check if we have data and handle different response formats
      if (response && response.data && Array.isArray(response.data)) {
        console.log('Groups data:', response.data);
        setGroups(response.data);
      } else if (response && response.data) {
        // Handle case where data is not an array
        console.log('Groups data is not an array:', response.data);
        setGroups(Array.isArray(response.data) ? response.data : [response.data]);
      } else {
        console.error('No groups data in response:', response);
        // Fallback to empty array
        setGroups([]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      // Don't show error to user, just log it
      setGroups([]);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles();
      console.log('Fetched roles:', response);
      
      // Check if we have data and handle different response formats
      if (response && response.data && Array.isArray(response.data)) {
        console.log('Roles data:', response.data);
        setRoles(response.data);
      } else if (response && response.data) {
        // Handle case where data is not an array
        console.log('Roles data is not an array:', response.data);
        setRoles(Array.isArray(response.data) ? response.data : [response.data]);
      } else {
        console.error('No roles data in response:', response);
        // Fallback to empty array
        setRoles([]);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      // Don't show error to user, just log it
      setRoles([]);
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
      
      // Validate required fields
      if (!formData.contact_person.trim()) {
        setError('Contact Person is required');
        setLoading(false);
        return;
      }
      
      if (!formData.name.trim()) {
        setError('Company Name is required');
        setLoading(false);
        return;
      }
      
      // Prepare the data for submission
      const submitData = {
        ...formData,
        // Explicitly set all fields to ensure they're included
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim(),
        email: formData.email || '',
        phone: formData.phone || '',
        address: formData.address || '',
        group_name: formData.group_name || '',
        role_id: formData.role_id || '',
        notes: formData.notes || ''
      };
      
      console.log('Submitting customer data:', submitData);
      
      if (isEditMode) {
        // Pass customer ID and data to update function
        const result = await updateCustomer(customer.id, submitData);
        console.log('Customer update response:', result);
      } else {
        // Create new customer
        const result = await createCustomer(submitData);
        console.log('Customer creation response:', result);
      }
      
      console.log(`Customer ${isEditMode ? 'updated' : 'created'} successfully`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} customer:`, err);
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} customer. Please try again.`);
    } finally {
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

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2 bg-dark text-white">
            <h5 className="modal-title h6">
              {isEditMode ? 'EDIT CUSTOMER' : 'NEW CUSTOMER'}
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
                  <label htmlFor="contact_person" className="form-label small mb-1 fw-bold">Contact Person *</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    id="contact_person"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="name" className="form-label small mb-1 fw-bold">Company Name *</label>
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
                  <label htmlFor="phone" className="form-label small mb-1 fw-bold">Phone</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="address" className="form-label small mb-1 fw-bold">Address</label>
                  <textarea
                    className="form-control form-control-sm"
                    id="address"
                    name="address"
                    rows="2"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="group_name" className="form-label small mb-1 fw-bold">Group</label>
                  <select
                    className="form-select form-select-sm"
                    id="group_name"
                    name="group_name"
                    value={formData.group_name || ""}
                    onChange={handleChange}
                  >
                    <option value="">Select group</option>
                    {groups.map(group => (
                      <option key={group.id || group.name} value={group.name}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                  {groups.length === 0 ? (
                    <small className="text-muted">
                      No groups available. Please create groups in the Group Management section first.
                    </small>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label htmlFor="role_id" className="form-label small mb-1 fw-bold">Role</label>
                  <select
                    className="form-select form-select-sm"
                    id="role_id"
                    name="role_id"
                    value={formData.role_id || ""}
                    onChange={handleChange}
                  >
                    <option value="">Select role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  {roles.length > 0 && (
                    <div className="mt-2">
                      {roles.map(role => (
                        <span 
                          key={role.id} 
                          className={`badge ${getBadgeClass(role.color)} me-1 ${formData.role_id === role.id ? 'border border-dark' : ''}`}
                          style={{cursor: 'pointer'}}
                          onClick={() => setFormData({...formData, role_id: role.id})}
                        >
                          {role.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {roles.length === 0 ? (
                    <small className="text-muted">
                      No roles available. Please create roles in the Role Management section first.
                    </small>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label htmlFor="notes" className="form-label small mb-1 fw-bold d-flex align-items-center">
                    <i className="bi bi-sticky me-1 text-warning"></i>
                    Notes
                  </label>
                  <textarea
                    className="form-control form-control-sm"
                    id="notes"
                    name="notes"
                    rows="3"
                    placeholder="Add important information about this customer here..."
                    value={formData.notes}
                    onChange={handleChange}
                  />
                  <small className="text-muted">
                    These notes will be visible in the customer list and details.
                  </small>
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

export default CustomerModal; 