import React, { useState, useEffect } from 'react';
import { getLocations, deleteLocation } from '../services/api';
import LocationModal from './LocationModal';

function LocationList() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await getLocations();
      setLocations(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch locations. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLocation = () => {
    setSelectedLocation(null);
    setShowModal(true);
  };

  const handleEditLocation = (location) => {
    setSelectedLocation(location);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the location "${name}"?`)) {
      try {
        await deleteLocation(id);
        setLocations(locations.filter(location => location.id !== id));
      } catch (err) {
        console.error('Error deleting location:', err);
        if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to delete location. Please try again later.');
        }
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    fetchLocations();
    setShowModal(false);
  };

  if (loading && locations.length === 0) {
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
          <i className="bi bi-geo-alt-fill fs-4 me-2 text-primary"></i>
          <div>
            <small className="text-muted">ADMIN PANEL</small>
            <h2 className="h5 mb-0">LOCATIONS</h2>
          </div>
        </div>
        <button 
          className="btn btn-primary btn-sm d-flex align-items-center"
          onClick={handleCreateLocation}
        >
          <i className="bi bi-plus-circle me-1"></i>
          NEW LOCATION
        </button>
      </div>

      {error && (
        <div className="alert alert-danger my-2 py-2">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header bg-dark py-2 d-flex align-items-center">
          <i className="bi bi-geo-alt text-white me-2"></i>
          <h3 className="h6 mb-0 text-white">Location Management</h3>
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0">
            <thead className="bg-light">
              <tr>
                <th>Color</th>
                <th>Name</th>
                <th>Description</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-3">No locations found</td>
                </tr>
              ) : (
                locations.map(location => (
                  <tr key={location.id}>
                    <td>
                      <div 
                        className="color-preview" 
                        style={{ 
                          backgroundColor: location.color || '#cccccc',
                          width: '30px',
                          height: '30px',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      ></div>
                    </td>
                    <td className="fw-bold">{location.name}</td>
                    <td>{location.description || '-'}</td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleEditLocation(location)}
                          title="Edit Location"
                          style={{width: "28px", height: "28px"}}
                        >
                          <i className="bi bi-pencil" style={{fontSize: "14px"}}></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleDelete(location.id, location.name)}
                          title="Delete Location"
                          style={{width: "28px", height: "28px"}}
                        >
                          <i className="bi bi-trash" style={{fontSize: "14px"}}></i>
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

      <LocationModal
        show={showModal}
        handleClose={closeModal}
        location={selectedLocation}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default LocationList; 