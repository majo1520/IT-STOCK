import React, { useState, useEffect } from 'react';
import { getItemById, createItem, updateItem, getBoxes, getItems } from '../services/api';
import api from '../services/api';
import QRCodeLabel from './QRCodeLabel';
import { useApi } from '../contexts/ApiServiceContext';
import webSocketService from '../services/webSocketService';
import { generateUniqueQRValue } from '../utils/qrCodeGenerator';
import codeSyncService from '../services/codeSync';

function ItemModal({ show, handleClose, itemId = null, boxId = null, onSuccess }) {
  const isEditMode = !!itemId;
  const [originalData, setOriginalData] = useState(null); // To track changes for transaction history

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: 1,
    box_id: boxId || '',
    type: '',
    serial_number: '',
    is_subitem: false,
    parent_item_id: '',
    supplier: '',
    ean_code: '',
    qr_code: ''
  });
  
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [parentItemDetails, setParentItemDetails] = useState(null);
  const [childItems, setChildItems] = useState([]);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (show) {
      fetchBoxes();
      fetchItems();
      
      if (isEditMode) {
        fetchItemDetails();
      } else {
        // Reset form for new item, but keep boxId if provided
        setFormData({
          name: '',
          description: '',
          quantity: 1,
          box_id: boxId || '',
          type: '',
          serial_number: '',
          is_subitem: false,
          parent_item_id: '',
          supplier: '',
          ean_code: '',
          qr_code: ''
        });
        setOriginalData(null);
        setParentItemDetails(null);
        setChildItems([]);
        setError(null);
      }
    }
  }, [itemId, boxId, show]);

  // Auto-select the box when boxId changes
  useEffect(() => {
    if (boxId && show) {
      setFormData(prevData => ({
        ...prevData,
        box_id: boxId
      }));
    }
  }, [boxId, show]);

  // Fetch parent item details when parent_item_id changes
  useEffect(() => {
    if (formData.parent_item_id && formData.is_subitem) {
      fetchParentItemDetails(formData.parent_item_id);
    } else {
      setParentItemDetails(null);
    }
  }, [formData.parent_item_id, formData.is_subitem]);

  const fetchBoxes = async () => {
    try {
      const response = await getBoxes();
      setBoxes(response.data || []);
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setError('Failed to fetch boxes. Please try again later.');
      setBoxes([]);
    }
  };
  
  const fetchItems = async () => {
    try {
      const response = await getItems();
      const allItems = response.data || [];
      
      // Filter out the current item (if in edit mode) to prevent self-reference
      const filteredItems = isEditMode && itemId 
        ? allItems.filter(item => item.id !== parseInt(itemId))
        : allItems;
      
      setItems(filteredItems);
      
      // Find child items if in edit mode
      if (isEditMode && itemId) {
        const children = allItems.filter(item => 
          item.parent_item_id && parseInt(item.parent_item_id) === parseInt(itemId)
        );
        setChildItems(children);
      } else {
        setChildItems([]);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to fetch items. Please try again later.');
      setItems([]);
    }
  };

  const fetchParentItemDetails = async (parentId) => {
    if (!parentId) return;
    
    try {
      const response = await getItemById(parentId);
      setParentItemDetails(response.data);
    } catch (err) {
      console.error('Error fetching parent item details:', err);
      setParentItemDetails(null);
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      const response = await getItemById(itemId);
      const itemData = response.data;
      
      // Store original data for tracking changes
      setOriginalData(itemData);
      
      // If there's a parent_item_id, fetch its details
      if (itemData.parent_item_id) {
        fetchParentItemDetails(itemData.parent_item_id);
      }
      
      // Get EAN code from response or localStorage
      let eanCode = '';
      let qrCode = '';
      if (itemData.ean_code) {
        eanCode = itemData.ean_code;
      }
      
      // Try to get QR code and other data from localStorage
        try {
          const storedItem = localStorage.getItem(`item_${itemId}_details`);
          if (storedItem) {
            const parsedItem = JSON.parse(storedItem);
          if (!eanCode && parsedItem.ean_code) {
            eanCode = parsedItem.ean_code;
          }
          if (parsedItem.qr_code) {
            qrCode = parsedItem.qr_code;
          }
          }
        } catch (err) {
        console.error('Error parsing stored item data:', err);
      }
      
      setFormData({
        name: itemData.name || '',
        description: itemData.description || '',
        quantity: itemData.quantity || 1,
        box_id: itemData.box_id || '',
        type: itemData.type || '',
        serial_number: itemData.serial_number || '',
        is_subitem: !!itemData.parent_item_id,
        parent_item_id: itemData.parent_item_id || '',
        supplier: itemData.supplier || '',
        ean_code: eanCode,
        qr_code: qrCode
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch item details. Please try again later.');
      console.error('Error fetching item details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      // For checkbox inputs
      setFormData({
        ...formData,
        [name]: checked
      });
      
      // When unchecking "is_subitem", clear the parent_item_id
      if (name === 'is_subitem' && !checked) {
        setFormData(prev => ({
          ...prev,
          parent_item_id: ''
        }));
      }
    } else if (name === 'parent_item_id') {
      // When selecting parent item, also sync box_id if applicable
      const parentItem = items.find(item => item.id === parseInt(value));
      
      if (parentItem && parentItem.box_id) {
        // If parent has a box, update form data with both parent and box
        setFormData({
          ...formData,
          parent_item_id: value,
          box_id: parentItem.box_id
        });
      } else {
        // Just update parent_item_id without changing box
        setFormData({
          ...formData,
          parent_item_id: value
        });
      }
    } else if (name === 'type') {
      // Make sure type is always updated correctly
      setFormData({
        ...formData,
        type: value
      });
    } else {
      // For other input types
      setFormData({
        ...formData,
        [name]: name === 'quantity' ? (parseInt(value, 10) || 1) : value
      });
    }
  };

  const handleQRCodeGenerate = (qrValue) => {
    setFormData({
      ...formData,
      qr_code: qrValue,
      ean_code: qrValue // Ensure QR code is saved to EAN field
    });
    
    // If we're editing an existing item, sync the QR code to the database immediately
    if (isEditMode && itemId) {
      codeSyncService.storeItemCode(itemId, qrValue, qrValue)
        .then(() => {
          console.log('QR code successfully synced to database');
        })
        .catch(err => {
          console.error('Failed to sync QR code to database:', err);
        });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      // Ensure the quantity is properly parsed as a number
      const itemDataToSubmit = {
        ...formData,
        quantity: parseInt(formData.quantity, 10)
      };
      
      // Create or update item
      let response;
      
      if (isEditMode) {
        response = await updateItem(itemId, itemDataToSubmit);
      } else {
        response = await createItem(itemDataToSubmit);
      }
      
      // Force UI refresh by sending a WebSocket notification
      webSocketService.send({
        type: 'client_refresh_request',
        tableType: 'items',
        timestamp: new Date().toISOString()
      });
      
      console.log('Item successfully saved:', response.data);
      
      // Close the modal after a short delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
        handleClose();
      }, 500);
      
    } catch (err) {
      console.error('Error saving item:', err);
      setError(err.message || 'Failed to save item. Please try again.');
      
    } finally {
      setSubmitting(false);
    }
  };

  // Safe access to boxes and items
  const safeBoxes = boxes || [];
  const safeItems = items || [];

  // Method to ensure clean exit from the modal
  const safeClose = () => {
    // Reset form and state before closing
    setError(null);
    setSubmitting(false);
    
    // Call the parent component's close handler
    if (typeof handleClose === 'function') {
      handleClose();
    }
  };

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header py-2 bg-dark text-white d-flex align-items-center">
            <h5 className="modal-title h6">{isEditMode ? 'EDIT ITEM' : 'NEW ITEM'}</h5>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={safeClose} 
              disabled={submitting}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body p-3">
            {loading ? (
              <div className="d-flex justify-content-center py-3">
                <div className="spinner-border text-primary spinner-border-sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                <ul className="nav nav-tabs mb-3">
                  <li className="nav-item">
                    <button 
                      className={`nav-link ${activeTab === 'details' ? 'active' : ''}`} 
                      onClick={() => setActiveTab('details')}
                      type="button"
                    >
                      Item Details
                    </button>
                  </li>
                  {isEditMode && (
                    <li className="nav-item">
                      <button 
                        className={`nav-link ${activeTab === 'qrcode' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('qrcode')}
                        type="button"
                      >
                        QR Code
                      </button>
                    </li>
                  )}
                </ul>
                
                {activeTab === 'details' ? (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger my-2 py-2">
                    {error}
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-md-8 mb-2">
                    <label htmlFor="name" className="form-label small mb-1 fw-bold">Item Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="col-md-4 mb-2">
                    <label htmlFor="quantity" className="form-label small mb-1">Quantity</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      id="quantity"
                      name="quantity"
                      min="1"
                      value={formData.quantity}
                      onChange={handleChange}
                      required
                    />
                    {isEditMode && originalData && (
                      <small className="text-muted">
                        Previous: {originalData.quantity || 0}
                        {formData.quantity !== originalData.quantity && (
                          <span className={formData.quantity > originalData.quantity ? "text-success" : "text-danger"}>
                            {" "}({formData.quantity > originalData.quantity ? "+" : ""}{formData.quantity - originalData.quantity})
                          </span>
                        )}
                      </small>
                    )}
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-6 mb-2">
                    <label htmlFor="type" className="form-label small mb-1">Type</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="type"
                      name="type"
                      placeholder="e.g. Electronic, Tool, Part"
                      value={formData.type || ''}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="col-md-6 mb-2">
                    <label htmlFor="serial_number" className="form-label small mb-1">Serial Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="serial_number"
                      name="serial_number"
                      placeholder="Optional"
                      value={formData.serial_number || ''}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-6 mb-2">
                    <label htmlFor="ean_code" className="form-label small mb-1">
                      EAN Code <span className="text-muted small">($prefix)</span>
                    </label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">$</span>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="ean_code"
                        name="ean_code"
                        placeholder="Enter EAN barcode"
                        value={formData.ean_code || ''}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-12 mb-2">
                    <label htmlFor="supplier" className="form-label small mb-1">Supplier</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="supplier"
                      name="supplier"
                      placeholder="e.g. Cullom"
                      value={formData.supplier || ''}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-12 mb-2">
                    <label htmlFor="box_id" className="form-label small mb-1">Box</label>
                    <select
                      className="form-select form-select-sm"
                      id="box_id"
                      name="box_id"
                      value={formData.box_id}
                      onChange={handleChange}
                    >
                      <option value="">No Box</option>
                      {safeBoxes.map(box => (
                        <option key={box.id} value={box.id}>
                          #{box.box_number} {box.location_name ? `(${box.location_name})` : ''} 
                          {box.shelf_name ? `- Shelf: ${box.shelf_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Item Relationship Section */}
                <div className="row g-2 mt-3">
                  <div className="col-12">
                    <fieldset className="border p-2 rounded">
                      <legend className="float-none w-auto px-2 fs-6 text-primary mb-0">Item Relationships</legend>
                      
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="is_subitem"
                          name="is_subitem"
                          checked={formData.is_subitem}
                          onChange={handleChange}
                        />
                        <label className="form-check-label" htmlFor="is_subitem">
                          This is a child item (belongs to another item)
                        </label>
                      </div>
                      
                      {formData.is_subitem && (
                        <div className="mt-2">
                          <label htmlFor="parent_item_id" className="form-label small mb-1">Parent Item *</label>
                          <select
                            className="form-select form-select-sm"
                            id="parent_item_id"
                            name="parent_item_id"
                            value={formData.parent_item_id}
                            onChange={handleChange}
                            required={formData.is_subitem}
                          >
                            <option value="">-- Select Parent Item --</option>
                            {safeItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name} {item.type ? `(${item.type})` : ''} 
                                {item.box_id ? `- Box: #${item.box_number || item.box_id}` : ''}
                              </option>
                            ))}
                          </select>
                          
                          {parentItemDetails && (
                            <div className="card mt-2 bg-light">
                              <div className="card-body p-2">
                                <h6 className="card-title mb-1">{parentItemDetails.name}</h6>
                                <div className="small">
                                  {parentItemDetails.type && (
                                    <span className="badge bg-info text-dark me-1">{parentItemDetails.type}</span>
                                  )}
                                  <span className="badge bg-primary">Qty: {parentItemDetails.quantity}</span>
                                </div>
                                {parentItemDetails.description && (
                                  <p className="card-text small mt-1 mb-0">{parentItemDetails.description}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show existing child items if editing and there are children */}
                      {isEditMode && childItems.length > 0 && (
                        <div className="mt-3">
                          <h6 className="text-success mb-1">Child Items ({childItems.length})</h6>
                          <div className="list-group">
                            {childItems.map(child => (
                              <div key={child.id} className="list-group-item list-group-item-action p-2 d-flex justify-content-between align-items-center">
                                <div>
                                  <span className="d-block fw-bold">{child.name}</span>
                                  <div className="small">
                                    {child.type && (
                                      <span className="badge bg-info text-dark me-1">{child.type}</span>
                                    )}
                                    <span className="badge bg-primary me-1">Qty: {child.quantity}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </fieldset>
                  </div>
                </div>

                <div className="row g-2 mt-3">
                  <div className="col-md-12 mb-2">
                    <label htmlFor="description" className="form-label small mb-1">Description</label>
                    <textarea
                      className="form-control form-control-sm"
                      id="description"
                      name="description"
                      rows="3"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Optional item description"
                    ></textarea>
                  </div>
                </div>

                {isEditMode && originalData && (
                  <div className="row g-2 mt-3">
                    <div className="col-12">
                      <div className="border rounded p-2 bg-light">
                        <h6 className="small fw-bold mb-2 text-secondary">Timestamps</h6>
                        <div className="d-flex justify-content-between align-items-center small">
                          <div>
                            <i className="bi bi-calendar-plus me-1 text-primary"></i>
                            <span className="text-muted">Created:</span> {' '}
                            {originalData.created_at ? 
                              new Date(originalData.created_at).toLocaleString() : 
                              'Unknown'}
                          </div>
                          <div>
                            <i className="bi bi-calendar-check me-1 text-success"></i>
                            <span className="text-muted">Last Updated:</span> {' '}
                            {originalData.updated_at ? 
                              new Date(originalData.updated_at).toLocaleString() : 
                              'Not modified yet'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm me-2"
                    onClick={safeClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg me-1"></i>
                        {isEditMode ? 'Update Item' : 'Create Item'}
                      </>
                    )}
                  </button>
                </div>
              </form>
                ) : (
                  <div className="p-3 text-center">
                    <h6>QR Code for {formData.name}</h6>
                    <div className="alert alert-info py-2 mb-3">
                      <small>
                        <i className="bi bi-info-circle me-1"></i>
                        Choose the "17mm x 54mm (Compact)" format for small labels
                      </small>
                    </div>
                    
                    <QRCodeLabel 
                      itemId={itemId}
                      itemName={formData.name}
                      qrValue={formData.qr_code || formData.ean_code}
                      onGenerate={handleQRCodeGenerate}
                      size={200}
                      labelFormat="compact"
                    />
                    
                    <div className="mt-2 d-flex gap-2 justify-content-center">
                      <button 
                        type="button" 
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          const qrLabelComponent = document.querySelector('.qr-code-container');
                          if (qrLabelComponent) {
                            const printButton = qrLabelComponent.querySelector('button');
                            if (printButton) {
                              printButton.click();
                            }
                          }
                        }}
                      >
                        <i className="bi bi-printer me-1"></i>
                        Print
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemModal; 