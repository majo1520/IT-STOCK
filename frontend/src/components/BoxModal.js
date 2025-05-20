import React, { useState, useEffect } from 'react';
import { getBoxById, createBox, updateBox, getLocations, getShelves } from '../services/api';

function BoxModal({ show, handleClose, boxId = null, onSuccess }) {
  const isEditMode = !!boxId;

  const [formData, setFormData] = useState({
    box_number: '',
    description: '',
    serial_number: '',
    shelf_id: '',
    location_id: '',
    created_by: 'admin',
    reference_id: ''
  });
  
  const [locations, setLocations] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      fetchLocationsAndShelves();
      if (isEditMode) {
        fetchBoxDetails();
      } else {
        // Reset form for new box
        setFormData({
          box_number: '',
          description: '',
          serial_number: '',
          shelf_id: '',
          location_id: '',
          created_by: 'admin',
          reference_id: ''
        });
        setError(null);
        setLoading(false);
      }
    }
  }, [boxId, show]);

  const fetchLocationsAndShelves = async () => {
    try {
      const [locationsResponse, shelvesResponse] = await Promise.all([
        getLocations(),
        getShelves()
      ]);
      setLocations(locationsResponse.data);
      setShelves(shelvesResponse.data);
    } catch (err) {
      console.error('Error fetching locations and shelves:', err);
      setError('Failed to load locations and shelves data. Please try again later.');
    }
  };

  const fetchBoxDetails = async () => {
    try {
      setLoading(true);
      const response = await getBoxById(boxId);
      const boxData = response.data;
      
      setFormData({
        box_number: boxData.box_number || '',
        description: boxData.description || '',
        serial_number: boxData.serial_number || '',
        shelf_id: boxData.shelf_id || '',
        location_id: boxData.location_id || '',
        created_by: 'admin',
        reference_id: boxData.reference_id || ''
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch box details. Please try again later.');
      console.error('Error fetching box details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // If location changes, reset shelf selection
    if (name === 'location_id') {
      setFormData(prev => ({
        ...prev,
        shelf_id: '',
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Prepare data - ensure empty strings are sent as null to backend
      // and properly convert string IDs to integers
      const dataToSubmit = {
        ...formData,
        shelf_id: formData.shelf_id ? parseInt(formData.shelf_id, 10) : null,
        location_id: formData.location_id ? parseInt(formData.location_id, 10) : null,
        serial_number: formData.serial_number || null,
        description: formData.description || null
      };
      
      console.log('Submitting box data:', dataToSubmit);
      
      if (isEditMode) {
        await updateBox(boxId, dataToSubmit);
      } else {
        await createBox(dataToSubmit);
      }
      
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(`Failed to ${isEditMode ? 'update' : 'create'} box. Please try again later.`);
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} box:`, err);
      setSubmitting(false);
    }
  };

  // Filter shelves by selected location
  const filteredShelves = formData.location_id 
    ? shelves.filter(shelf => shelf.location_id === parseInt(formData.location_id))
    : shelves;

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
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2 bg-dark text-white">
            <h5 className="modal-title h6">{isEditMode ? 'EDIT BOX' : 'NEW BOX'}</h5>
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
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger my-2 py-2">
                    {error}
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-md-6 mb-2">
                    <label htmlFor="box_number" className="form-label small mb-1 fw-bold">Box Number *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="box_number"
                      name="box_number"
                      value={formData.box_number}
                      onChange={handleChange}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="col-md-6 mb-2">
                    <label htmlFor="location_id" className="form-label small mb-1 fw-bold">Location *</label>
                    <select
                      className="form-select form-select-sm"
                      id="location_id"
                      name="location_id"
                      value={formData.location_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Location</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id} style={{ backgroundColor: location.color }}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    {locations.length === 0 && (
                      <small className="text-muted">
                        No locations available. Please add locations in the admin panel first.
                      </small>
                    )}
                  </div>
                </div>

                <div className="row g-2">
                  <div className="col-md-6 mb-2">
                    <label htmlFor="shelf_id" className="form-label small mb-1">
                      Shelf <span className="text-muted">(optional)</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      id="shelf_id"
                      name="shelf_id"
                      value={formData.shelf_id}
                      onChange={handleChange}
                      disabled={!formData.location_id}
                    >
                      <option value="">Select Shelf</option>
                      {filteredShelves.map(shelf => (
                        <option key={shelf.id} value={shelf.id}>
                          {shelf.name} {shelf.color_name && `(${shelf.color_name})`}
                        </option>
                      ))}
                    </select>
                    {formData.location_id && filteredShelves.length === 0 && (
                      <small className="text-muted">
                        No shelves available for this location. Please add shelves in the admin panel first.
                      </small>
                    )}
                    {!formData.location_id && (
                      <small className="text-muted">
                        Select a location first
                      </small>
                    )}
                  </div>

                  <div className="col-md-6 mb-2">
                    <label htmlFor="serial_number" className="form-label small mb-1">
                      Serial Number / QR Code <span className="text-muted">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      id="serial_number"
                      name="serial_number"
                      value={formData.serial_number}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {isEditMode && formData.reference_id && (
                  <div className="row g-2 mb-2">
                    <div className="col-md-12">
                      <label htmlFor="reference_id" className="form-label small mb-1">
                        Reference ID <span className="text-muted">(system generated)</span>
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light"
                        id="reference_id"
                        value={formData.reference_id}
                        readOnly
                      />
                      <small className="text-muted">
                        This is a unique identifier used for QR codes and labels
                      </small>
                    </div>
                  </div>
                )}

                <div className="row g-2">
                  <div className="col-md-12 mb-2">
                    <label htmlFor="description" className="form-label small mb-1">
                      Description <span className="text-muted">(optional)</span>
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      id="description"
                      name="description"
                      rows="2"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Enter a description (optional)"
                    ></textarea>
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm me-2"
                    onClick={safeClose}
                    disabled={submitting}
                  >
                    CANCEL
                  </button>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoxModal; 