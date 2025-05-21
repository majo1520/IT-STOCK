import React, { useState, useEffect } from 'react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getRoles } from '../services/api';
import CustomerModal from './CustomerModal';
import CustomerItemHistoryModal from './CustomerItemHistoryModal';

function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // New state for customer history modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchRoles();
  }, []);

  // Initialize tooltips after render
  useEffect(() => {
    // Check if Bootstrap is available
    if (typeof window !== 'undefined' && window.bootstrap && window.bootstrap.Tooltip) {
      // Initialize all tooltips
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new window.bootstrap.Tooltip(tooltipTriggerEl);
      });
    }
  }, [customers]); // Re-initialize when customers change

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log('Fetching customers...');
      const response = await getCustomers();
      
      console.log('Customers fetched:', response.data);
      
      // Process customers to ensure uniqueness
      const processedCustomers = response.data || [];
      
      // Validate customer data
      const validCustomers = processedCustomers.map(customer => {
        // Log each customer to help debug
        console.log('Processing customer:', customer);
        
        // Ensure all fields exist on customer object
        return {
          id: customer.id,
          name: customer.name || '',
          contact_person: customer.contact_person || '',
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          group_name: customer.group_name || '',
          role_id: customer.role_id || '',
          notes: customer.notes || '',
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        };
      });
      
      // Create a map to track customers with the same name
      const customerNameCounts = {};
      validCustomers.forEach(customer => {
        if (customer.name) {
          customerNameCounts[customer.name] = (customerNameCounts[customer.name] || 0) + 1;
        }
      });
      
      // Add display suffix for duplicate company names
      validCustomers.forEach(customer => {
        if (customer.name && customerNameCounts[customer.name] > 1) {
          // If there are multiple customers with the same name, add contact person to help identify
          if (customer.contact_person) {
            customer.displayName = `${customer.name} (${customer.contact_person})`;
          } else {
            customer.displayName = `${customer.name} (#${customer.id})`;
          }
        } else {
          customer.displayName = customer.name;
        }
      });
      
      // Sort customers by created_at date (most recent first)
      if (validCustomers && Array.isArray(validCustomers)) {
        validCustomers.sort((a, b) => {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
      }
      
      console.log('Processed customers:', validCustomers);
      setCustomers(validCustomers);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles();
      const roleMap = {};
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach(role => {
          roleMap[role.id] = role;
        });
      }
      setRoles(roleMap);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setShowModal(true);
  };

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  // New handler to view customer's consumed items
  const handleViewCustomerHistory = (customer, e) => {
    e.stopPropagation(); // Prevent row click from triggering
    setSelectedCustomerForHistory(customer);
    setShowHistoryModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the customer "${name}"?`)) {
      try {
        await deleteCustomer(id);
        setCustomers(customers.filter(customer => customer.id !== id));
      } catch (err) {
        console.error('Error deleting customer:', err);
        setError('Failed to delete customer. Please try again later.');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    console.log('Customer modal success - refreshing customer list');
    
    // Force a complete refresh of the customer list with clear cache
    setTimeout(() => {
      console.log('Executing delayed customer list refresh');
      // Force a complete refresh of the customer list
      setCustomers([]);
      setLoading(true);
      fetchCustomers();
    }, 800); // Increase timeout to ensure API has time to update
    
    setShowModal(false);
  };

  // New handler to close history modal
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
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

  if (loading && customers.length === 0) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-building me-2 text-primary" viewBox="0 0 16 16">
            <path d="M4 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-10Zm.5.5v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm-6 2v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm-6 2v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm-6 2v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Zm2 0v1h1v-1h-1Z"/>
            <path d="M14 14.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v1ZM1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h4V2h-4Z"/>
          </svg>
          <div>
            <small className="text-muted">MANAGEMENT</small>
            <h2 className="h5 mb-0">CUSTOMERS</h2>
          </div>
        </div>
        <button 
          className="btn btn-primary btn-sm d-flex align-items-center"
          onClick={handleCreateCustomer}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-building-add me-1" viewBox="0 0 16 16">
            <path d="M12.5 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm.5-5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1a.5.5 0 0 1 1 0Z"/>
            <path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6.5a.5.5 0 0 1-1 0V1H3v14h3v-2.5a.5.5 0 0 1 .5-.5H8v4H3a1 1 0 0 1-1-1V1Z"/>
            <path d="M4.5 2a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm-6 3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm-6 3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm3 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z"/>
          </svg>
          NEW CUSTOMER
        </button>
      </div>

      {error && (
        <div className="alert alert-danger my-2 py-2">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header bg-dark py-2 d-flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-buildings me-2 text-white" viewBox="0 0 16 16">
            <path d="M14.763.075A.5.5 0 0 1 15 .5v15a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V14h-1v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V10a.5.5 0 0 1 .342-.474L6 7.64V4.5a.5.5 0 0 1 .276-.447l8-4a.5.5 0 0 1 .487.022ZM6 8.694 1 10.36V15h5V8.694ZM7 15h2v-1.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V15h2V1.309l-7 3.5V15Z"/>
            <path d="M2 11h1v1H2v-1Zm2 0h1v1H4v-1Zm-2 2h1v1H2v-1Zm2 0h1v1H4v-1Zm4-4h1v1H8V9Zm2 0h1v1h-1V9Zm-2 2h1v1H8v-1Zm2 0h1v1h-1v-1Zm2-2h1v1h-1V9Zm0 2h1v1h-1v-1ZM8 7h1v1H8V7Zm2 0h1v1h-1V7Zm2 0h1v1h-1V7ZM8 5h1v1H8V5Zm2 0h1v1h-1V5Zm2 0h1v1h-1V5Zm0-2h1v1h-1V3Z"/>
          </svg>
          <h3 className="h6 mb-0 text-white">Customer Management</h3>
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0">
            <thead className="bg-light">
              <tr>
                <th>Transactions</th>
                <th>Company</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Group</th>
                <th>Role</th>
                <th>Notes</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-3">No customers found</td>
                </tr>
              ) : (
                customers.map(customer => (
                  <tr key={customer.id}>
                    <td 
                      className="cursor-pointer"
                      onClick={(e) => handleViewCustomerHistory(customer, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex align-items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-repeat me-1 text-primary" viewBox="0 0 16 16">
                          <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                          <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                        </svg>
                        <span>Transactions</span>
                        <small className="ms-1 text-primary">
                          <i className="bi bi-box-arrow-up-right"></i>
                        </small>
                      </div>
                    </td>
                    <td className="fw-bold">{customer.displayName || '-'}</td>
                    <td>{customer.contact_person || '-'}</td>
                    <td>{customer.email || '-'}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>
                      {customer.group_name ? (
                        <span className="badge bg-info">
                          {customer.group_name}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {customer.role_id && roles[customer.role_id] ? (
                        <span className={`badge ${getBadgeClass(roles[customer.role_id].color)}`}>
                          {roles[customer.role_id].name}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {customer.notes ? (
                        <div 
                          className="text-truncate" 
                          style={{ maxWidth: '150px', cursor: 'help' }} 
                          title={customer.notes}
                          data-bs-toggle="tooltip"
                          data-bs-placement="top"
                        >
                          {customer.notes.startsWith('LEADER') ? (
                            <span className="badge bg-warning text-dark">
                              {customer.notes}
                            </span>
                          ) : (
                            <>
                              <i className="bi bi-sticky me-1 text-warning"></i>
                              {customer.notes}
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted fst-italic">No notes</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleEditCustomer(customer)}
                          title="Edit Customer"
                          style={{width: "28px", height: "28px"}}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-pencil" viewBox="0 0 16 16">
                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                          </svg>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleDelete(customer.id, customer.displayName)}
                          title="Delete Customer"
                          style={{width: "28px", height: "28px"}}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
                            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerModal
        show={showModal}
        handleClose={closeModal}
        customer={selectedCustomer}
        onSuccess={handleModalSuccess}
      />

      {/* Add the CustomerItemHistoryModal */}
      <CustomerItemHistoryModal
        show={showHistoryModal}
        handleClose={closeHistoryModal}
        customer={selectedCustomerForHistory}
      />
    </div>
  );
}

export default CustomerList; 