import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBoxById, createBox, updateBox, getLocations, getShelves } from '../services/api';

function BoxForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    box_number: '',
    description: '',
    serial_number: '',
    shelf_id: '',
    location_id: '',
    created_by: 'admin'
  });
  
  const [locations, setLocations] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLocationsAndShelves();
    if (isEditMode) {
      fetchBoxDetails();
    } else {
      setLoading(false);
    }
  }, [id]);

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
      const response = await getBoxById(id);
      const boxData = response.data;
      
      setFormData({
        box_number: boxData.box_number || '',
        description: boxData.description || '',
        serial_number: boxData.serial_number || '',
        shelf_id: boxData.shelf_id || '',
        location_id: boxData.location_id || '',
        created_by: 'admin'
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

    // If location changes, filter shelves by location
    if (name === 'location_id') {
      // Reset shelf selection when location changes
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
      
      // Create a clean copy of the form data with proper handling of empty values
      const cleanData = {
        ...formData,
        // Convert empty strings to null for integer fields
        shelf_id: formData.shelf_id === '' ? null : formData.shelf_id,
        location_id: formData.location_id === '' ? null : formData.location_id
      };
      
      if (isEditMode) {
        await updateBox(id, cleanData);
      } else {
        await createBox(cleanData);
      }
      
      navigate('/boxes');
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
          <h2 className="h5 mb-0">BOX</h2>
        </div>
        <Link to="/boxes" className="btn btn-secondary btn-sm py-0 px-2">
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
                <label htmlFor="box_number" className="form-label small mb-1 fw-bold">Box Number</label>
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
                <label htmlFor="location_id" className="form-label small mb-1">Location <span className="text-muted">(Optional)</span></label>
                <select
                  className="form-select form-select-sm"
                  id="location_id"
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
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
                    No locations available. <Link to="/admin" className="text-decoration-none">Manage locations</Link>
                  </small>
                )}
              </div>
            </div>

            <div className="row g-2">
              <div className="col-md-6 mb-2">
                <label htmlFor="shelf_id" className="form-label small mb-1">Shelf <span className="text-muted">(Optional)</span></label>
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
                    No shelves available for this location. <Link to="/admin" className="text-decoration-none">Manage shelves</Link>
                  </small>
                )}
                {!formData.location_id && (
                  <small className="text-muted">
                    Select a location first
                  </small>
                )}
              </div>

              <div className="col-md-6 mb-2">
                <label htmlFor="serial_number" className="form-label small mb-1">Serial Number / QR Code</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  id="serial_number"
                  name="serial_number"
                  value={formData.serial_number}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="row g-2">
              <div className="col-md-12 mb-2">
                <label htmlFor="description" className="form-label small mb-1">Description</label>
                <textarea
                  className="form-control form-control-sm"
                  id="description"
                  name="description"
                  rows="2"
                  value={formData.description}
                  onChange={handleChange}
                ></textarea>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-2">
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

export default BoxForm; 