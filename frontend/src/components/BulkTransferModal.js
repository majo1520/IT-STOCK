import React, { useState, useEffect } from 'react';
import { getBoxes } from '../services/api';

function BulkTransferModal({ show, handleClose, selectedItems, itemsData, onSuccess }) {
  const [boxes, setBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [transferProgress, setTransferProgress] = useState(0);
  const [selectedBoxDetails, setSelectedBoxDetails] = useState(null);

  // Group selected items by their current box
  const itemsByBox = itemsData
    .filter(item => selectedItems.includes(item.id))
    .reduce((acc, item) => {
      const boxId = item.box_id || 'unassigned';
      if (!acc[boxId]) {
        acc[boxId] = [];
      }
      acc[boxId].push(item);
      return acc;
    }, {});

  useEffect(() => {
    if (show) {
      fetchBoxes();
      setSelectedBoxId('');
      setNotes('');
      setError(null);
      setTransferProgress(0);
      setSelectedBoxDetails(null);
    }
  }, [show]);

  // Update selected box details when a box is selected
  useEffect(() => {
    if (selectedBoxId && boxes.length > 0) {
      // Fix the comparison by converting both IDs to the same type (string or number)
      const boxDetails = boxes.find(box => 
        box.id === selectedBoxId || 
        String(box.id) === String(selectedBoxId)
      );
      
      if (boxDetails) {
        console.log('Selected box details:', boxDetails);
      } else {
        console.log('Selected box not found:', selectedBoxId, 'Available boxes:', boxes.map(b => b.id));
      }
      
      setSelectedBoxDetails(boxDetails || null);
    } else {
      setSelectedBoxDetails(null);
    }
  }, [selectedBoxId, boxes]);

  const fetchBoxes = async () => {
    try {
      setLoading(true);
      const response = await getBoxes();
      setBoxes(response.data);
    } catch (err) {
      console.error('Error fetching boxes:', err);
      setError('Failed to fetch boxes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedBoxId) {
      setError('Please select a destination box.');
      return;
    }

    try {
      setSubmitting(true);
      setTransferProgress(0);
      
      // We'll implement the actual transfer in the ItemList component
      // This is a placeholder for the progress indicator
      const totalItems = selectedItems.length;
      let processed = 0;
      
      // Simulate progress for now
      const interval = setInterval(() => {
        processed++;
        setTransferProgress(Math.round((processed / totalItems) * 100));
        
        if (processed === totalItems) {
          clearInterval(interval);
          setTimeout(() => {
            handleClose();
            if (onSuccess) onSuccess(selectedBoxId, notes);
          }, 500);
        }
      }, 200);
      
    } catch (err) {
      setError('Failed to transfer items. Please try again later.');
      console.error('Error transferring items:', err);
      setSubmitting(false);
    }
  };

  // Helper function to render box details
  const renderBoxDetails = (boxId) => {
    if (!boxId || boxId === 'unassigned' || boxes.length === 0) return 'Unassigned';
    
    // Fix the comparison by converting both IDs to the same type (string or number)
    const box = boxes.find(box => 
      box.id === boxId || 
      String(box.id) === String(boxId)
    );
    
    if (!box) {
      console.log('Box not found:', boxId, 'Available boxes:', boxes.map(b => ({id: b.id, number: b.box_number})));
      return `Box ID: ${boxId}`;
    }
    
    return (
      <>
        <span className="fw-bold">Box #{box.box_number}</span>
        {box.shelf_name && <span className="ms-1 text-muted small">Shelf: {box.shelf_name}</span>}
        {box.location_name && <span className="ms-1 text-muted small">({box.location_name})</span>}
      </>
    );
  };

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title h6">BULK TRANSFER ITEMS</h5>
            <button type="button" className="btn-close" onClick={handleClose} disabled={submitting}></button>
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

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Selected Items:</label>
                  <div className="form-control form-control-sm bg-light">
                    <span className="badge bg-primary me-2">{selectedItems.length}</span>
                    items selected
                  </div>
                </div>

                {Object.entries(itemsByBox).length > 0 && (
                  <div className="mb-3">
                    <label className="form-label small mb-1 fw-bold">Current Locations:</label>
                    <div className="border rounded p-2 bg-light">
                      {Object.entries(itemsByBox).map(([boxId, items]) => (
                        <div key={boxId} className="mb-1 d-flex align-items-center">
                          <span className="badge bg-secondary me-2">{items.length}</span>
                          <small>
                            {renderBoxDetails(boxId)}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="destinationBox" className="form-label small mb-1 fw-bold">Destination Box:</label>
                  <select
                    id="destinationBox"
                    className="form-select form-select-sm"
                    value={selectedBoxId}
                    onChange={(e) => setSelectedBoxId(e.target.value)}
                    required
                  >
                    <option value="">Select Destination Box</option>
                    {boxes.map(box => (
                      <option key={box.id} value={box.id}>
                        #{box.box_number} 
                        {box.location_name ? ` (${box.location_name})` : ''} 
                        {box.shelf_name ? ` - Shelf: ${box.shelf_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBoxDetails && (
                  <div className="mb-3 card border-light">
                    <div className="card-body p-2 bg-light">
                      <h6 className="card-title mb-2">Destination Box Details</h6>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <div className="fw-bold small">Box Number</div>
                          <div>#{selectedBoxDetails.box_number}</div>
                        </div>
                        {selectedBoxDetails.shelf_name && (
                          <div className="col-md-6">
                            <div className="fw-bold small">Shelf</div>
                            <div>{selectedBoxDetails.shelf_name}</div>
                          </div>
                        )}
                        {selectedBoxDetails.location_name && (
                          <div className="col-md-6">
                            <div className="fw-bold small">Location</div>
                            <div>{selectedBoxDetails.location_name}</div>
                          </div>
                        )}
                        {selectedBoxDetails.shelf_id && !selectedBoxDetails.shelf_name && (
                          <div className="col-md-6">
                            <div className="fw-bold small">Shelf ID</div>
                            <div>{selectedBoxDetails.shelf_id}</div>
                          </div>
                        )}
                        {selectedBoxDetails.location_id && !selectedBoxDetails.location_name && (
                          <div className="col-md-6">
                            <div className="fw-bold small">Location ID</div>
                            <div>{selectedBoxDetails.location_id}</div>
                          </div>
                        )}
                        {selectedBoxDetails.items_count !== undefined && (
                          <div className="col-md-6">
                            <div className="fw-bold small">Items</div>
                            <div>{selectedBoxDetails.items_count} items</div>
                          </div>
                        )}
                      </div>
                      {selectedBoxDetails.description && (
                        <div className="mt-2">
                          <div className="fw-bold small">Description</div>
                          <div className="text-secondary">{selectedBoxDetails.description}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="notes" className="form-label small mb-1">Transfer Notes:</label>
                  <textarea
                    id="notes"
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="Reason for transfer or additional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>

                {submitting && (
                  <div className="mb-3">
                    <label className="form-label small mb-1">Transfer Progress:</label>
                    <div className="progress" style={{ height: '10px' }}>
                      <div 
                        className="progress-bar progress-bar-striped progress-bar-animated" 
                        role="progressbar" 
                        style={{ width: `${transferProgress}%` }} 
                        aria-valuenow={transferProgress} 
                        aria-valuemin="0" 
                        aria-valuemax="100">
                      </div>
                    </div>
                    <div className="text-center mt-1">
                      <small>{transferProgress}% Complete</small>
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm me-2"
                    onClick={handleClose}
                    disabled={submitting}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting}
                  >
                    {submitting ? 'TRANSFERRING...' : 'TRANSFER ITEMS'}
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

export default BulkTransferModal; 