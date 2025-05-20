import React, { useState, useEffect } from 'react';
import { getBoxes, transferItem } from '../services/api';

function TransferModal({ show, handleClose, itemId, currentBoxId, itemName, displayName, onSuccess }) {
  const [boxes, setBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBoxDetails, setSelectedBoxDetails] = useState(null);

  // Use the display name if available, otherwise fallback to the regular item name
  const itemDisplayName = displayName || itemName;

  useEffect(() => {
    if (show) {
      fetchBoxes();
      setSelectedBoxId('');
      setNotes('');
      setError(null);
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
      
      await transferItem(itemId, {
        source_box_id: currentBoxId,
        destination_box_id: selectedBoxId,
        notes: notes,
        type: 'transfer'
      });
      
      handleClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError('Failed to transfer item. Please try again later.');
      console.error('Error transferring item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to render the current box details
  const renderCurrentBoxDetails = () => {
    if (!currentBoxId || boxes.length === 0) return 'No Box';
    
    // Fix the comparison by converting both IDs to the same type (string or number)
    const currentBox = boxes.find(box => 
      box.id === currentBoxId || 
      String(box.id) === String(currentBoxId)
    );
    
    if (!currentBox) {
      console.log('Current box not found:', currentBoxId, 'Available boxes:', boxes.map(b => ({id: b.id, number: b.box_number})));
      return 'Unknown Box';
    }
    
    return (
      <div>
        <div className="fw-bold">Box #{currentBox.box_number}</div>
        {currentBox.shelf_name && (
          <div><small className="text-muted">Shelf: {currentBox.shelf_name}</small></div>
        )}
        {currentBox.location_name && (
          <div><small className="text-muted">Location: {currentBox.location_name}</small></div>
        )}
        {currentBox.description && (
          <div><small className="text-secondary">{currentBox.description}</small></div>
        )}
      </div>
    );
  };

  if (!show) return null;

  return (
    <div className="modal fade show" tabIndex="-1" style={{ display: 'block', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h5 className="modal-title h6">TRANSFER ITEM</h5>
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
                  <label className="form-label small mb-1 fw-bold">Item:</label>
                  <div className="form-control-plaintext form-control-sm">{itemDisplayName}</div>
                </div>

                <div className="mb-3">
                  <label className="form-label small mb-1 fw-bold">Current Box:</label>
                  <div className="form-control-plaintext form-control-sm">
                    {renderCurrentBoxDetails()}
                  </div>
                </div>

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
                    {boxes
                      .filter(box => box.id !== currentBoxId)
                      .map(box => (
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
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        TRANSFERRING...
                      </>
                    ) : (
                      'TRANSFER'
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

export default TransferModal; 