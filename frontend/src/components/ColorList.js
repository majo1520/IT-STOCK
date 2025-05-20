import React, { useState, useEffect } from 'react';
import { getColors, deleteColor } from '../services/api';
import ColorModal from './ColorModal';

function ColorList() {
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedColor, setSelectedColor] = useState(null);

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      setLoading(true);
      const response = await getColors();
      setColors(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching colors:', err);
      setError('Failed to fetch colors. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateColor = () => {
    setSelectedColor(null);
    setShowModal(true);
  };

  const handleEditColor = (color) => {
    setSelectedColor(color);
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete the color "${name}"?`)) {
      try {
        await deleteColor(id);
        setColors(colors.filter(color => color.id !== id));
      } catch (err) {
        console.error('Error deleting color:', err);
        if (err.response && err.response.data && err.response.data.error) {
          setError(err.response.data.error);
        } else {
          setError('Failed to delete color. Please try again later.');
        }
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalSuccess = () => {
    fetchColors();
    setShowModal(false);
  };

  if (loading && colors.length === 0) {
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
          <i className="bi bi-palette-fill fs-4 me-2 text-primary"></i>
          <div>
            <small className="text-muted">ADMIN PANEL</small>
            <h2 className="h5 mb-0">COLORS</h2>
          </div>
        </div>
        <button 
          className="btn btn-primary btn-sm d-flex align-items-center"
          onClick={handleCreateColor}
        >
          <i className="bi bi-plus-circle me-1"></i>
          NEW COLOR
        </button>
      </div>

      {error && (
        <div className="alert alert-danger my-2 py-2">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header bg-dark py-2 d-flex align-items-center">
          <i className="bi bi-palette text-white me-2"></i>
          <h3 className="h6 mb-0 text-white">Color Management</h3>
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-sm mb-0">
            <thead className="bg-light">
              <tr>
                <th>Color Preview</th>
                <th>Name</th>
                <th>Hex Code</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {colors.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-3">No colors found</td>
                </tr>
              ) : (
                colors.map(color => (
                  <tr key={color.id}>
                    <td>
                      <div 
                        className="color-preview" 
                        style={{ 
                          backgroundColor: color.hex_code,
                          width: '30px',
                          height: '30px',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      ></div>
                    </td>
                    <td className="fw-bold">{color.name}</td>
                    <td>
                      <code>{color.hex_code}</code>
                    </td>
                    <td className="text-end">
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-outline-primary py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleEditColor(color)}
                          title="Edit Color"
                          style={{width: "28px", height: "28px"}}
                        >
                          <i className="bi bi-pencil" style={{fontSize: "14px"}}></i>
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger py-0 px-2 d-flex align-items-center justify-content-center"
                          onClick={() => handleDelete(color.id, color.name)}
                          title="Delete Color"
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

      <ColorModal
        show={showModal}
        handleClose={closeModal}
        color={selectedColor}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

export default ColorList; 