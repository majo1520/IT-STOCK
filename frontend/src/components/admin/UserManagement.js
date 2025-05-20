import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Alert, Modal, Form, Spinner } from 'react-bootstrap';
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../../services/api';

/**
 * Component for managing users
 */
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'resetPassword'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user', // Default role
    name: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await getUsers();
      setUsers(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setModalMode('create');
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      name: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setModalMode('edit');
    setFormData({
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
      name: user.name || '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowModal(true);
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setModalMode('resetPassword');
    setFormData({
      ...formData,
      newPassword: '',
      confirmPassword: ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id, username) => {
    if (window.confirm(`Are you sure you want to delete the user "${username}"?`)) {
      try {
        setActionInProgress(true);
        await deleteUser(id);
        setUsers(users.filter(user => user.id !== id));
        setSuccess(`User "${username}" deleted successfully.`);
      } catch (err) {
        console.error('Error deleting user:', err);
        setError('Failed to delete user. Please try again later.');
      } finally {
        setActionInProgress(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setActionInProgress(true);
      
      if (modalMode === 'create') {
        // Validate password
        if (!formData.password) {
          setError('Password is required');
          setActionInProgress(false);
          return;
        }
        
        // Create new user
        const response = await createUser({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          name: formData.name
        });
        
        setUsers([...users, response.data]);
        setSuccess(`User "${formData.username}" created successfully.`);
      } else if (modalMode === 'edit') {
        // Update existing user
        const response = await updateUser(selectedUser.id, {
          username: formData.username,
          email: formData.email,
          role: formData.role,
          name: formData.name
        });
        
        setUsers(users.map(user => user.id === selectedUser.id ? response.data : user));
        setSuccess(`User "${formData.username}" updated successfully.`);
      } else if (modalMode === 'resetPassword') {
        // Validate passwords
        if (formData.newPassword !== formData.confirmPassword) {
          setError('Passwords do not match');
          setActionInProgress(false);
          return;
        }
        
        // Reset password
        await resetPassword(selectedUser.id, {
          password: formData.newPassword
        });
        
        setSuccess(`Password for "${selectedUser.username}" reset successfully.`);
      }
      
      setShowModal(false);
    } catch (err) {
      console.error('Error saving user:', err);
      setError(err.response?.data?.error || 'Failed to save user. Please try again later.');
    } finally {
      setActionInProgress(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setError(null);
  };

  const renderModal = () => {
    let title = '';
    
    switch (modalMode) {
      case 'create':
        title = 'Create New User';
        break;
      case 'edit':
        title = 'Edit User';
        break;
      case 'resetPassword':
        title = 'Reset Password';
        break;
      default:
        title = 'User';
    }
    
    return (
      <Modal show={showModal} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {error && (
              <Alert variant="danger" onClose={() => setError(null)} dismissible>
                {error}
              </Alert>
            )}
            
            {modalMode !== 'resetPassword' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                </Form.Group>
                
                {modalMode === 'create' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required={modalMode === 'create'}
                    />
                  </Form.Group>
                )}
              </>
            )}
            
            {modalMode === 'resetPassword' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal} disabled={actionInProgress}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={actionInProgress}
            >
              {actionInProgress ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Saving...
                </>
              ) : (
                modalMode === 'resetPassword' ? 'Reset Password' : 'Save'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    );
  };

  return (
    <Card className="mb-4">
      <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
        <div>
          <i className="bi bi-people me-2"></i>
          User Management
        </div>
        <Button 
          variant="light" 
          size="sm" 
          onClick={handleCreateUser}
          disabled={actionInProgress}
        >
          <i className="bi bi-plus-circle me-1"></i>
          Add User
        </Button>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
            {success}
          </Alert>
        )}
        
        {loading ? (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : users.length === 0 ? (
          <Alert variant="info">
            No users found. Create a new user to get started.
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.name || '-'}</td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => handleEditUser(user)}
                        disabled={actionInProgress}
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button
                        variant="outline-warning"
                        size="sm"
                        className="me-2"
                        onClick={() => handleResetPassword(user)}
                        disabled={actionInProgress}
                      >
                        <i className="bi bi-key"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(user.id, user.username)}
                        disabled={actionInProgress}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
      
      {renderModal()}
    </Card>
  );
}

export default UserManagement; 