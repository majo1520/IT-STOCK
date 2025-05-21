import React, { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Table, Badge, Card, Pagination } from 'react-bootstrap';
import { getCustomerItemHistory } from '../services/api';

const CustomerItemHistoryModal = ({ show, handleClose, customer }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalQuantity: 0,
    uniqueItems: 0,
    mostConsumedItem: null
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  // Get current transactions for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = history.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    if (show && customer?.id) {
      loadCustomerHistory(customer.id);
      // Reset pagination when modal opens
      setCurrentPage(1);
    }
  }, [show, customer]);

  useEffect(() => {
    if (history.length > 0) {
      calculateSummary();
      // Calculate total pages
      setTotalPages(Math.ceil(history.length / itemsPerPage));
    } else {
      setTotalPages(1);
    }
  }, [history, itemsPerPage]);

  const loadCustomerHistory = async (customerId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getCustomerItemHistory(customerId);
      console.log('Customer history response:', response);
      
      // Handle API response format
      if (response && response.data) {
        // Check if the response has the new format with transactions and summary
        if (response.data.transactions) {
          console.log('Using API response with transactions array:', response.data.transactions.length);
          setHistory(response.data.transactions || []);
          
          // If we have summary data, use it
          if (response.data.summary) {
            console.log('Using API response summary data');
            setSummary({
              totalItems: response.data.summary.totalItems || 0,
              totalQuantity: response.data.summary.totalQuantity || 0,
              uniqueItems: response.data.summary.uniqueItems || 0,
              mostConsumedItem: response.data.summary.mostConsumedItem || null
            });
          }
        } 
        // Handle the old API format where data is directly an array
        else if (Array.isArray(response.data)) {
          console.log('Using API response with direct array:', response.data.length);
          setHistory(response.data || []);
          // Calculate summary manually in this case
          calculateSummary();
        }
        // Handle empty or invalid response
        else {
          console.warn('Unexpected API response format:', response.data);
          setHistory([]);
        }
      } else {
        // No data in response
        console.warn('No data in API response');
        setHistory([]);
      }
    } catch (err) {
      console.error('Error loading customer history:', err);
      // Don't show error message to user for "no transactions" case
      // Just set history to empty array
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };
  
  // Handle items per page change
  const handleItemsPerPageChange = (e) => {
    const value = parseInt(e.target.value);
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const calculateSummary = () => {
    // Make sure history is an array before processing
    if (!Array.isArray(history) || history.length === 0) {
      setSummary({
        totalItems: 0,
        totalQuantity: 0,
        uniqueItems: 0,
        mostConsumedItem: null
      });
      return;
    }
    
    // Calculate total items
    const totalItems = history.length;
    
    // Calculate total quantity
    const totalQuantity = history.reduce((sum, record) => sum + (record.quantity || 0), 0);
    
    // Calculate unique items
    const uniqueItemIds = new Set(history.map(record => record.item_id));
    const uniqueItems = uniqueItemIds.size;
    
    // Find most consumed item
    const itemCounts = {};
    history.forEach(record => {
      const itemId = record.item_id;
      if (!itemCounts[itemId]) {
        itemCounts[itemId] = {
          id: itemId,
          name: record.item_name,
          quantity: 0,
          count: 0
        };
      }
      itemCounts[itemId].quantity += (record.quantity || 0);
      itemCounts[itemId].count += 1;
    });
    
    const mostConsumedItem = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)[0] || null;
    
    setSummary({
      totalItems,
      totalQuantity,
      uniqueItems,
      mostConsumedItem
    });
  };

  const formatDate = (dateString) => {
    try {
      // Simple date formatting without date-fns
      const date = new Date(dateString);
      const options = { 
        year: 'numeric', 
        month: 'short', 
        day: '2-digit',
        hour: '2-digit', 
        minute: '2-digit'
      };
      return date.toLocaleDateString('en-US', options);
    } catch (e) {
      return dateString;
    }
  };
  
  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    
    // Always show first page
    items.push(
      <Pagination.Item 
        key={1} 
        active={currentPage === 1}
        onClick={() => handlePageChange(1)}
      >
        1
      </Pagination.Item>
    );
    
    // If many pages, add ellipsis after first page
    if (currentPage > 3) {
      items.push(<Pagination.Ellipsis key="ellipsis-1" disabled />);
    }
    
    // Add pages around current page
    for (let number = Math.max(2, currentPage - 1); number <= Math.min(totalPages - 1, currentPage + 1); number++) {
      if (number === 1 || number === totalPages) continue; // Skip first and last page as they're always shown
      items.push(
        <Pagination.Item 
          key={number} 
          active={number === currentPage}
          onClick={() => handlePageChange(number)}
        >
          {number}
        </Pagination.Item>
      );
    }
    
    // If many pages, add ellipsis before last page
    if (currentPage < totalPages - 2) {
      items.push(<Pagination.Ellipsis key="ellipsis-2" disabled />);
    }
    
    // Always show last page if more than 1 page
    if (totalPages > 1) {
      items.push(
        <Pagination.Item 
          key={totalPages} 
          active={currentPage === totalPages}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }
    
    return items;
  };

  return (
    <Modal 
      show={show} 
      onHide={handleClose}
      size="lg"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header closeButton className="bg-light">
        <Modal.Title>
          <div className="d-flex align-items-center">
            <i className="bi bi-arrow-repeat me-2 text-primary"></i>
            Customer Transactions
          </div>
          <div className="text-muted h6 mt-1">
            {customer?.name && <strong>{customer.name}</strong>}
            {customer?.contact_person && <span className="ms-1">| Contact: {customer.contact_person}</span>}
          </div>
          {customer?.notes && (
            <div className="mt-2 p-2 bg-light rounded border-start border-warning border-3">
              <div className="d-flex">
                {customer.notes.startsWith('LEADER') ? (
                  <span className="badge bg-warning text-dark">
                    {customer.notes}
                  </span>
                ) : (
                  <>
                    <i className="bi bi-sticky me-2 text-warning"></i>
                    <small className="text-muted">{customer.notes}</small>
                  </>
                )}
              </div>
            </div>
          )}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center my-4">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : history.length === 0 ? (
          <div>
            <div className="alert alert-info" role="alert">
              <i className="bi bi-info-circle me-2"></i>
              No transactions found for this customer. You can create transactions by using the "Stock Out" function and selecting this customer.
            </div>
            
            <div className="text-center my-4">
              <img 
                src="/assets/images/empty-state.svg" 
                alt="No transactions" 
                style={{ maxWidth: '200px', opacity: '0.6' }} 
                onError={(e) => {
                  // If image fails to load, replace with icon
                  e.target.style.display = 'none';
                  const parentDiv = e.target.parentNode;
                  const icon = document.createElement('i');
                  icon.className = 'bi bi-inbox-fill text-secondary';
                  icon.style.fontSize = '5rem';
                  parentDiv.appendChild(icon);
                }}
              />
              <p className="text-muted mt-3">
                When you create transactions with this customer, they will appear here.
              </p>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={handleClose}
              >
                <i className="bi bi-arrow-left me-1"></i> Back to Customer List
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="row mb-4">
              <div className="col-md-3">
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-3">
                    <div className="text-muted small mb-1">Total Transactions</div>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-arrow-repeat text-primary me-2"></i>
                      <h3 className="mb-0">{summary.totalItems}</h3>
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-3">
                    <div className="text-muted small mb-1">Total Items Transacted</div>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-box-seam text-danger me-2"></i>
                      <h3 className="mb-0">{summary.totalQuantity}</h3>
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-3">
                    <div className="text-muted small mb-1">Unique Items</div>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-boxes text-success me-2"></i>
                      <h3 className="mb-0">{summary.uniqueItems}</h3>
                    </div>
                  </Card.Body>
                </Card>
              </div>
              <div className="col-md-3">
                <Card className="shadow-sm h-100">
                  <Card.Body className="p-3">
                    <div className="text-muted small mb-1">Most Transacted Item</div>
                    {summary.mostConsumedItem ? (
                      <div>
                        <div className="fw-medium text-truncate">{summary.mostConsumedItem.name}</div>
                        <Badge bg="danger" className="rounded-pill">
                          Qty: {summary.mostConsumedItem.quantity}
                        </Badge>
                      </div>
                    ) : (
                      <div className="text-muted">None</div>
                    )}
                  </Card.Body>
                </Card>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="border-bottom pb-2 mb-0 flex-grow-1">Transaction History</h6>
              <div className="d-flex align-items-center">
                <small className="text-muted me-2">Rows per page:</small>
                <select 
                  className="form-select form-select-sm" 
                  value={itemsPerPage} 
                  onChange={handleItemsPerPageChange}
                  style={{ width: '70px' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            
            <div className="table-responsive">
              <Table striped hover className="table-sm">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Box</th>
                    <th>Reason</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTransactions.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="text-nowrap">{formatDate(record.created_at)}</div>
                      </td>
                      <td>
                        <div className="fw-medium">{record.item_name}</div>
                      </td>
                      <td className="text-center">
                        <Badge bg="danger" className="rounded-pill">
                          {record.quantity}
                        </Badge>
                      </td>
                      <td>
                        {record.box_id ? `Box #${record.box_id}` : <span className="text-muted">-</span>}
                      </td>
                      <td>
                        <Badge bg={record.reason === 'CONSUMED' ? 'warning' : 'info'} className="text-dark">
                          {record.reason || 'Unspecified'}
                        </Badge>
                      </td>
                      <td>
                        <small>{record.notes || <span className="text-muted">No details</span>}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            
            {/* Pagination */}
            {history.length > 0 && (
              <div className="d-flex justify-content-between align-items-center mt-3">
                <small className="text-muted">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, history.length)} of {history.length} transactions
                </small>
                <Pagination size="sm" className="mb-0">
                  <Pagination.First
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  />
                  <Pagination.Prev
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  />
                  
                  {renderPaginationItems()}
                  
                  <Pagination.Next
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  />
                  <Pagination.Last
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                  />
                </Pagination>
              </div>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CustomerItemHistoryModal; 