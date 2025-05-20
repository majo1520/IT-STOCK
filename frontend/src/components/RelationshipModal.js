import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, Table } from 'react-bootstrap';
import { updateItem, getItems } from '../services/api';

const RelationshipModal = ({ show, handleClose, item = {}, items = [], onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedChildIds, setSelectedChildIds] = useState([]);
  const [allItems, setAllItems] = useState(items || []);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch all items when modal opens
  useEffect(() => {
    if (show) {
      fetchAllItems();
      setIsInitialized(true);
    }
  }, [show]);

  // Fetch items directly from API to ensure we have the latest data
  const fetchAllItems = async () => {
    try {
      setLoading(true);
      const response = await getItems();
      if (response && response.data) {
        // Normalize all item IDs to numbers for consistent comparison
        const normalizedItems = response.data.map(itm => ({
          ...itm,
          id: parseInt(itm.id, 10),
          parent_item_id: itm.parent_item_id ? parseInt(itm.parent_item_id, 10) : null
        }));
        setAllItems(normalizedItems);
      } else {
        // If API call fails, use the items prop as fallback
        setAllItems(items || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
      setError("Failed to load items. Please try again.");
      // Use items prop as fallback
      setAllItems(items || []);
    } finally {
      setLoading(false);
    }
  };

  // Get all potential children (items that are not the current item and not its ancestors)
  const getPotentialChildren = () => {
    // Safety check for missing data
    if (!item || !item.id || !Array.isArray(allItems) || allItems.length === 0) {
      return [];
    }
    
    // Convert item.id to number for consistent comparison
    const currentItemId = Number(item.id);
    
    // Items that can be potential children:
    // 1. Not the current item itself
    // 2. Not an ancestor of the current item
    return allItems.filter(i => 
      i && i.id && Number(i.id) !== currentItemId && 
      !isAncestor(currentItemId, Number(i.id))
    );
  };

  // Check if itemId is an ancestor of potential childId
  const isAncestor = (itemId, potentialChildId) => {
    // Safety check
    if (!Array.isArray(allItems) || allItems.length === 0) {
      return false;
    }
    
    // Ensure we're working with numbers
    const parentId = Number(itemId);
    let childId = Number(potentialChildId);
    
    // Prevent infinite loops
    const maxDepth = 10;
    let depth = 0;
    
    // Start with the potential child
    let currentItem = allItems.find(i => i && i.id && Number(i.id) === childId);
    
    // Follow the parent chain upward
    while (currentItem && currentItem.parent_item_id && depth < maxDepth) {
      const currentParentId = Number(currentItem.parent_item_id);
      
      // If this parent is our target item, we found an ancestor relationship
      if (currentParentId === parentId) {
        return true;
      }
      
      // Move up to the parent
      currentItem = allItems.find(i => i && i.id && Number(i.id) === currentParentId);
      depth++;
    }
    
    return false;
  };

  // Reset search when modal is shown
  useEffect(() => {
    if (show) {
      setSearchTerm('');
      setError('');
      setSelectedChildIds([]);
      
      // Only try to update search results if we have items
      if (isInitialized && Array.isArray(allItems) && allItems.length > 0) {
        updateSearchResults('');
      }
    }
  }, [show, item, isInitialized, allItems]);

  // Update search results when search term or items change
  useEffect(() => {
    // Only update if we're initialized and have items
    if (isInitialized && Array.isArray(allItems) && allItems.length > 0) {
      updateSearchResults(searchTerm);
    }
  }, [searchTerm, allItems, isInitialized]);

  const updateSearchResults = (term) => {
    // Safety check
    if (!Array.isArray(allItems) || allItems.length === 0) {
      setSearchResults([]);
      return;
    }
    
    const potentialChildren = getPotentialChildren();
    
    if (!potentialChildren || potentialChildren.length === 0) {
      setSearchResults([]);
      return;
    }
    
    if (!term) {
      setSearchResults(potentialChildren);
      return;
    }
    
    const termLower = term.toLowerCase();
    const filtered = potentialChildren.filter(i => 
      (i && i.name && i.name.toLowerCase().includes(termLower)) ||
      (i && i.type && i.type.toLowerCase().includes(termLower)) ||
      (i && i.description && i.description.toLowerCase().includes(termLower))
    );
    
    setSearchResults(filtered);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const toggleSelectChild = (childId) => {
    setSelectedChildIds(prev => {
      // Make sure we're working with numbers
      const normalizedChildId = parseInt(childId, 10);
      
      if (prev.includes(normalizedChildId)) {
        return prev.filter(id => id !== normalizedChildId);
      } else {
        return [...prev, normalizedChildId];
      }
    });
  };

  const handleSave = async () => {
    if (selectedChildIds.length === 0) {
      setError('Please select at least one item to add as a child.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Ensure we're using a number for the parent ID
      const parentId = parseInt(item.id, 10);
      console.log("Setting parent_item_id to", parentId, "for children:", selectedChildIds);

      // Update each selected child to have this item as parent
      const updatePromises = selectedChildIds.map(childId => {
        // Make sure childId is a number
        const normalizedChildId = parseInt(childId, 10);
        
        const childItem = allItems.find(i => i && i.id && Number(i.id) === normalizedChildId);
        
        if (!childItem) {
          console.error(`Child item with ID ${normalizedChildId} not found`);
          return Promise.reject(new Error(`Child item with ID ${normalizedChildId} not found`));
        }
        
        // Create a new object with only the necessary properties to avoid sending too much data
        const updatedChild = { 
          parent_item_id: parentId
        };
        
        console.log(`Setting child ${normalizedChildId} (${childItem.name}) parent_item_id to ${parentId}`);
        return updateItem(normalizedChildId, updatedChild);
      });

      await Promise.all(updatePromises);
      
      // Force a refresh of the items list
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
      
      handleClose();
    } catch (err) {
      setError('Failed to update relationships. Please try again.');
      console.error('Error updating relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ensure items array exists and convert quantities to numbers when displaying
  const safeGetQuantity = (item) => {
    if (!item) return 0;
    return typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
  };

  return (
    <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Add Child Items</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        <div className="mb-3">
          <h6 className="mb-2 d-flex align-items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-diagram-3 text-primary me-2" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5v-1zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1zM0 11.5A1.5 1.5 0 0 1 1.5 10h1A1.5 1.5 0 0 1 4 11.5v1A1.5 1.5 0 0 1 2.5 14h-1A1.5 1.5 0 0 1 0 12.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1zm4.5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-1zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1z"/>
            </svg>
            Parent Item
          </h6>
          <div className="selected-item p-3 bg-light rounded border border-primary border-opacity-25 shadow-sm d-flex align-items-center">
            <div className="bg-primary bg-opacity-10 rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style={{width: "40px", height: "40px"}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-box text-primary" viewBox="0 0 16 16">
                <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM2.55 4.221l-.92.38v5.282l8.5 3.245 8.5-3.245V4.602l-.92-.38-7.58 3.223Z"/>
                <path d="M2.55 4.221l5.284 2.15 7.58-3.223-.92-.38-6.66 2.83-6.66-2.83-.92.38Z"/>
              </svg>
            </div>
            <div>
              <strong className="fs-5">{item?.name || 'Unknown Item'}</strong>
              {item?.type && <span className="badge bg-info bg-opacity-25 text-dark rounded-pill px-2 ms-2">{item.type}</span>}
              {item?.quantity > 0 && <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-2 ms-2">Qty: {item.quantity}</span>}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <h6 className="mb-2 d-flex align-items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-search text-primary me-2" viewBox="0 0 16 16">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
            </svg>
            Search Items to Add as Children
          </h6>
          <Form.Control
            type="text"
            placeholder="Type to search items by name, type, or description..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="search-results">
          <h6 className="d-flex align-items-center mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-list-check text-primary me-2" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3.854 2.146a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 1 1 .708-.708L1.5 3.793l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 1 1 .708-.708L1.5 7.793l1.146-1.147a.5.5 0 0 1 .708 0zm0 4a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0l-.5-.5a.5.5 0 0 1 .708-.708l.146.147 1.146-1.147a.5.5 0 0 1 .708 0z"/>
            </svg>
            Select Items to Add ({selectedChildIds.length} selected)
          </h6>
          
          {loading ? (
            <div className="text-center my-4">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
          ) : searchResults.length === 0 ? (
            <Alert variant="info">
              No items found. Try a different search term or create new items to add as children.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover className="border">
                <thead className="bg-light">
                  <tr>
                    <th width="50"></th>
                    <th>Item Name</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Box</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(searchItem => (
                    <tr key={`search-item-${searchItem.id}`}
                      className={selectedChildIds.includes(searchItem.id) ? 'table-active' : ''}
                      onClick={() => toggleSelectChild(searchItem.id)}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={selectedChildIds.includes(searchItem.id)}
                          onChange={() => toggleSelectChild(searchItem.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <div className="fw-medium">{searchItem.name}</div>
                        {searchItem.description && (
                          <small className="text-muted text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                            {searchItem.description}
                          </small>
                        )}
                      </td>
                      <td>{searchItem.type || <span className="text-muted">-</span>}</td>
                      <td>{safeGetQuantity(searchItem)}</td>
                      <td>{searchItem.box_number || <span className="text-muted">-</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={loading || selectedChildIds.length === 0}
        >
          {loading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
              Saving...
            </>
          ) : (
            `Add ${selectedChildIds.length} Selected ${selectedChildIds.length === 1 ? 'Item' : 'Items'} as Children`
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RelationshipModal; 