import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { getItemById, createItem, updateItem, getBoxes, getItems } from '../services/api';
import QRCodeLabel from './QRCodeLabel';

function ItemForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditMode = !!id;

  // Get box_id from query parameter if it exists
  const queryParams = new URLSearchParams(location.search);
  const boxIdFromQuery = queryParams.get('box_id');
  const parentItemIdFromQuery = queryParams.get('parent_item_id');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    ean_code: '',
    serial_number: '',
    quantity: 1,
    box_id: boxIdFromQuery || '',
    parent_item_id: parentItemIdFromQuery || '',
    is_subitem: false,
    qr_code: '',
    supplier: ''
  });
  
  const [boxes, setBoxes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    fetchBoxes();
    fetchItems();
    
    if (isEditMode) {
      fetchItemDetails();
    }
  }, [id]);

  // Show QR code section when EAN is empty and form has been interacted with
  useEffect(() => {
    if (!formData.ean_code && formData.name) {
      setShowQrCode(true);
    } else {
      setShowQrCode(false);
    }
  }, [formData.ean_code, formData.name]);

  const fetchBoxes = async () => {
    try {
      const response = await getBoxes();
      setBoxes(response.data);
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setError('Failed to fetch boxes. Please try again later.');
    }
  };

  const fetchItems = async () => {
    try {
      const response = await getItems();
      // Filter out the current item (if in edit mode) to prevent self-reference
      const filteredItems = isEditMode 
        ? response.data.filter(item => item.id !== id)
        : response.data;
      
      setItems(filteredItems);
    } catch (err) {
      console.error('Error fetching items:', err);
      setError('Failed to fetch items. Please try again later.');
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      const response = await getItemById(id);
      const itemData = response.data;
      
      setFormData({
        name: itemData.name,
        description: itemData.description || '',
        type: itemData.type || '',
        ean_code: itemData.ean_code || '',
        serial_number: itemData.serial_number || '',
        quantity: itemData.quantity,
        box_id: itemData.box_id || '',
        parent_item_id: itemData.parent_item_id || '',
        is_subitem: !!itemData.parent_item_id,
        qr_code: itemData.qr_code || '',
        supplier: itemData.supplier || ''
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
    } else {
      // For other input types
      setFormData({
        ...formData,
        [name]: name === 'quantity' ? parseInt(value, 10) : value
      });
    }
  };

  // Handle QR code generation
  const handleQRCodeGenerated = (qrValue) => {
    setFormData(prev => ({
      ...prev,
      qr_code: qrValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.is_subitem && !formData.parent_item_id) {
      setError('Please select a parent item');
      return;
    }
    
    try {
      setSubmitting(true);
      
      // Prepare data for submission - explicitly specify each field
      const dataToSubmit = {
        name: formData.name,
        description: formData.description || null,
        type: formData.type || null,
        ean_code: formData.ean_code || null,
        serial_number: formData.serial_number || null,
        quantity: formData.quantity,
        box_id: formData.box_id || null,
        parent_item_id: formData.is_subitem ? formData.parent_item_id : null,
        qr_code: formData.qr_code || null,
        supplier: formData.supplier || null
      };
      
      console.log('ItemForm - Submitting item data:', dataToSubmit);
      console.log('ItemForm - Type field:', dataToSubmit.type);
      console.log('ItemForm - Description:', dataToSubmit.description);
      console.log('ItemForm - Box ID:', dataToSubmit.box_id);
      console.log('ItemForm - Supplier:', dataToSubmit.supplier);
      console.log('ItemForm - Is subitem?', formData.is_subitem);
      console.log('ItemForm - Parent item ID:', formData.parent_item_id);
      
      let response;
      if (isEditMode) {
        response = await updateItem(id, dataToSubmit);
        console.log('ItemForm - Update response:', response.data);
      } else {
        response = await createItem(dataToSubmit);
        console.log('ItemForm - Create response:', response.data);
      }
      
      // After successful submission, update the form data with returned values
      // to ensure UI reflects what was actually saved
      if (response && response.data) {
        const returnedData = response.data;
        // Update only if we're in edit mode and staying on the same page
        if (isEditMode) {
          setFormData(prevData => ({
            ...prevData,
            name: returnedData.name || prevData.name,
            description: returnedData.description || '',
            type: returnedData.type || '',
            ean_code: returnedData.ean_code || '',
            serial_number: returnedData.serial_number || '',
            quantity: returnedData.quantity || prevData.quantity,
            box_id: returnedData.box_id || '',
            supplier: returnedData.supplier || '',
            parent_item_id: returnedData.parent_item_id || '',
            is_subitem: !!returnedData.parent_item_id,
            qr_code: returnedData.qr_code || prevData.qr_code
          }));
        } else {
          // If creating a new item, navigate to the items list
          navigate('/items');
        }
      } else {
        // If creating a new item, navigate to the items list even without response data
        if (!isEditMode) {
          navigate('/items');
        }
      }
    } catch (err) {
      setError(`Failed to ${isEditMode ? 'update' : 'create'} item. Please try again later.`);
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} item:`, err);
      console.error('Request payload:', dataToSubmit);
      console.error('Error response:', err.response?.data);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <div className="spinner-border text-primary spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <small className="text-muted">{isEditMode ? 'EDIT' : 'NEW'}</small>
          <h2 className="h5 mb-0">ITEM</h2>
        </div>
        <Link to="/items" className="btn btn-secondary btn-sm py-0 px-2">
          CANCEL
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger my-2 py-2">
          {error}
        </div>
      )}

      <div className="card">
        <div className="card-body p-3">
          <form onSubmit={handleSubmit}>
            <div className="row g-2">
              <div className="col-md-6 mb-2">
                <label htmlFor="name" className="form-label small mb-1">Name *</label>
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

              <div className="col-md-6 mb-2">
                <label htmlFor="quantity" className="form-label small mb-1">Quantity *</label>
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
                  value={formData.type}
                  onChange={handleChange}
                  placeholder="e.g. Electronic, Tool, Part"
                />
              </div>

              <div className="col-md-6 mb-2">
                <label htmlFor="ean_code" className="form-label small mb-1">EAN Code</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  id="ean_code"
                  name="ean_code"
                  value={formData.ean_code}
                  onChange={handleChange}
                  placeholder="EAN/Barcode if available"
                />
                <small className="form-text text-muted">
                  If no EAN code is available, you can generate a unique QR code below.
                </small>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-md-6 mb-2">
                <label htmlFor="serial_number" className="form-label small mb-1">Serial Number</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  id="serial_number"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleChange}
                  placeholder="Serial or Part Number"
                />
            </div>

              <div className="col-md-6 mb-2">
                <label htmlFor="box_id" className="form-label small mb-1">Box</label>
                <select
                  className="form-select form-select-sm"
                  id="box_id"
                  name="box_id"
                  value={formData.box_id}
                  onChange={handleChange}
                >
                  <option value="">No Box</option>
                  {boxes.map(box => (
                    <option key={box.id} value={box.id}>
                      #{box.box_number} {box.location_name ? `(${box.location_name})` : ''} 
                      {box.shelf_name ? `- Shelf: ${box.shelf_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              </div>
              
            <div className="row g-2">
              <div className="col-md-6 mb-2">
                <label htmlFor="supplier" className="form-label small mb-1">Supplier</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  id="supplier"
                  name="supplier"
                  value={formData.supplier || ''}
                  onChange={handleChange}
                  placeholder="Supplier or source of item"
                />
              </div>

              <div className="col-md-6 mb-2">
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
                    This is a subitem
                  </label>
                </div>
              </div>
            </div>

            {formData.is_subitem && (
              <div className="row g-2">
                <div className="col-12 mb-2">
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
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.type ? `(${item.type})` : ''} 
                        {item.serial_number ? `- SN: ${item.serial_number}` : ''}
                      </option>
                    ))}
                  </select>
                  <small className="form-text text-muted">
                    Select the parent item that this subitem belongs to.
                  </small>
                </div>
              </div>
            )}
              
            <div className="col-md-12 mb-2">
              <label htmlFor="description" className="form-label small mb-1">Description</label>
              <textarea
                className="form-control form-control-sm"
                id="description"
                name="description"
                rows="3"
                value={formData.description}
                onChange={handleChange}
              ></textarea>
            </div>

            {showQrCode && (
              <div className="row mt-3 mb-3">
                <div className="col-12">
                  <div className="alert alert-info py-2 mb-2">
                    <i className="bi bi-info-circle me-2"></i>
                    No EAN code provided. Generate a unique QR code for this item below.
                  </div>
                  <div className="border rounded p-3 bg-light">
                    <QRCodeLabel
                      itemId={isEditMode ? id : null}
                      itemName={formData.name || 'New Item'}
                      qrValue={formData.qr_code}
                      onGenerate={handleQRCodeGenerated}
                      size={128}
                    />
                  </div>
                  <small className="form-text text-muted">
                    This QR code can be printed and attached to the physical item for easy identification.
                  </small>
                </div>
              </div>
            )}

            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <>{isEditMode ? 'SAVE' : 'CREATE'}</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ItemForm; 