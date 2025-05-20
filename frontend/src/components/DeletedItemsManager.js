import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Alert, Modal, Spinner, Badge } from 'react-bootstrap';
import { getDeletedItems, restoreItem, permanentlyDeleteItem } from '../services/api';
import { formatDate } from '../utils/date-utils';

/**
 * Component for managing deleted items
 */
function DeletedItemsManager() {
  const [deletedItems, setDeletedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState(null); // 'restore' or 'delete'
  const [actionInProgress, setActionInProgress] = useState(false);

  useEffect(() => {
    fetchDeletedItems();
  }, []);

  const fetchDeletedItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getDeletedItems();
      setDeletedItems(response.data || []);
    } catch (err) {
      console.error('Error fetching deleted items:', err);
      setError('Failed to fetch deleted items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = (item) => {
    setSelectedItem(item);
    setActionType('restore');
    setShowConfirmModal(true);
  };

  const handlePermanentDelete = (item) => {
    setSelectedItem(item);
    setActionType('delete');
    setShowConfirmModal(true);
  };

  const confirmAction = async () => {
    if (!selectedItem) return;
    
    setActionInProgress(true);
    
    try {
      if (actionType === 'restore') {
        await restoreItem(selectedItem.id);
        setSuccess(`Item "${selectedItem.name}" has been restored successfully.`);
      } else if (actionType === 'delete') {
        await permanentlyDeleteItem(selectedItem.id);
        setSuccess(`Item "${selectedItem.name}" has been permanently deleted.`);
      }
      
      // Refresh the list
      fetchDeletedItems();
    } catch (err) {
      console.error(`Error ${actionType === 'restore' ? 'restoring' : 'deleting'} item:`, err);
      setError(`Failed to ${actionType === 'restore' ? 'restore' : 'permanently delete'} item. Please try again.`);
    } finally {
      setActionInProgress(false);
      setShowConfirmModal(false);
    }
  };

  const renderConfirmModal = () => {
    if (!selectedItem) return null;
    
    const isRestore = actionType === 'restore';
    const title = isRestore ? 'Restore Item' : 'Permanently Delete Item';
    const variant = isRestore ? 'primary' : 'danger';
    const message = isRestore
      ? `Are you sure you want to restore "${selectedItem.name}"?`
      : `Are you sure you want to PERMANENTLY delete "${selectedItem.name}"? This action cannot be undone!`;
    
    return (
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{message}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)} disabled={actionInProgress}>
            Cancel
          </Button>
          <Button 
            variant={variant} 
            onClick={confirmAction}
            disabled={actionInProgress}
          >
            {actionInProgress ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                {isRestore ? 'Restoring...' : 'Deleting...'}
              </>
            ) : (
              isRestore ? 'Restore' : 'Delete Permanently'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  return (
    <Card className="mb-4">
      <Card.Header className="bg-secondary text-white d-flex justify-content-between align-items-center">
        <div>
          <i className="bi bi-trash me-2"></i>
          Deleted Items
        </div>
        <Button 
          variant="light" 
          size="sm" 
          onClick={fetchDeletedItems}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Refresh
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
        ) : deletedItems.length === 0 ? (
          <Alert variant="info">
            No deleted items found.
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Deleted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deletedItems.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.description || '-'}</td>
                    <td>{item.type || '-'}</td>
                    <td>
                      {item.quantity}
                      {item.quantity === 0 && <Badge bg="warning" className="ms-2">Empty</Badge>}
                    </td>
                    <td>{formatDate(item.deleted_at)}</td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2"
                        onClick={() => handleRestore(item)}
                      >
                        <i className="bi bi-arrow-counterclockwise me-1"></i>
                        Restore
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handlePermanentDelete(item)}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Delete Permanently
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
      
      {renderConfirmModal()}
    </Card>
  );
}

export default DeletedItemsManager; 