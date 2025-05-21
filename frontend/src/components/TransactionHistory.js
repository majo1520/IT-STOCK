import React, { useState, useEffect } from 'react';
import { getBoxTransactions, getStockHistory, getItems } from '../services/api';
import Pagination from './Pagination';
import axios from 'axios';

function TransactionHistory({ 
  boxId = null, 
  filter: initialFilter = 'all', 
  limit = null, 
  hideFilters = false,
  size = "md",
  variant = "default",
  itemFilter = '',
  onCountUpdate = null 
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(initialFilter); // all, stock-in, stock-out, transfer, etc.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Add a new state variable for item filter, initialize with prop value
  const [localItemFilter, setLocalItemFilter] = useState(itemFilter);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Update local item filter when prop changes
  useEffect(() => {
    setLocalItemFilter(itemFilter);
  }, [itemFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [boxId, limit, itemFilter]);
  
  // Update filter when initialFilter prop changes
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, startDate, endDate, localItemFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      let response;
      
      // If boxId is provided, get transactions for that specific box
      if (boxId) {
        response = await getBoxTransactions(boxId);
        console.log('Box transactions response:', response);
      } else {
        try {
          // Get all stock history transactions
          const filterType = filter !== 'all' ? filter : null;
          
          // Check if item filter is a numeric ID - preferentially use the prop value
          const effectiveItemFilter = itemFilter || localItemFilter;
          const itemId = effectiveItemFilter && /^\d+$/.test(effectiveItemFilter.trim()) ? parseInt(effectiveItemFilter.trim()) : null;
          
          console.log('Fetching transactions with filter:', { 
            filterType, 
            startDate, 
            endDate,
            itemId: itemId || 'none',
            itemName: !itemId && effectiveItemFilter ? effectiveItemFilter : 'none'
          });
          
          // For deletions, use the improved API that handles deletions
          if (filterType === 'delete') {
            console.log('DELETION TAB - Fetching deletion transactions');
            response = await getStockHistory(itemId, 'delete', startDate || null, endDate || null);
            console.log('DELETION TAB - Received response:', response);
            
            // Check if the API actually returned an array of transactions
            if (!Array.isArray(response.data)) {
              console.error('DELETION TAB - Invalid response format, expected array but got:', typeof response.data);
              response.data = [];
            }
          } else {
            // For non-deletion filters, still include all transactions
            // The is_deletion flag will be used on the frontend to identify deletions
            response = await getStockHistory(itemId, filterType, startDate || null, endDate || null);
          }
          
          console.log(`Transaction history response for ${filterType || 'all'} filter:`, 
            { count: response.data?.length });
            
          // If we used an item ID filter in the API call but still have an item name filter,
          // we'll do client-side filtering after we get the response
        } catch (historyError) {
          console.error('Error fetching stock history:', historyError);
          // Fallback to empty response if stock history API fails
          response = { data: [] };
        }
      }
      
      // Ensure we have an array of transactions
      let transactionsData = Array.isArray(response.data) ? response.data : [];
      
      // If no transactions found but we're on the deletions tab, try a direct approach
      if (filter === 'delete' && transactionsData.length === 0) {
        console.log('DELETION TAB - No deletions found via normal API, trying direct database query');
        
        try {
          // Check if item filter is a numeric ID - preferentially use the prop value
          const effectiveItemFilter = itemFilter || localItemFilter;
          const itemId = effectiveItemFilter && /^\d+$/.test(effectiveItemFilter.trim()) ? parseInt(effectiveItemFilter.trim()) : null;
          
          // Try querying for deletions directly
          const params = {
            is_deletion: 'true',
            direct_filter: "transaction_type ILIKE '%DELETE%' OR is_deletion = true"
          };
          
          // Add item_id filter if provided
          if (itemId) {
            params.item_id = itemId;
          }
          
          const directResponse = await axios.get('/api/items/transactions', { params });
          
          if (Array.isArray(directResponse.data) && directResponse.data.length > 0) {
            console.log(`DELETION TAB - Found ${directResponse.data.length} deletions via direct query`);
            transactionsData = directResponse.data;
          }
        } catch (err) {
          console.error('Failed to get deletion transactions via direct query:', err);
        }
      }
      
      // Apply limit if specified
      if (limit && transactionsData.length > limit) {
        transactionsData = transactionsData.slice(0, limit);
      }
      
      setTransactions(transactionsData);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transaction history');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
  };

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
  };

  const handleItemFilterChange = (e) => {
    setLocalItemFilter(e.target.value);
  };

  const applyFilters = () => {
    console.log("Applying filters:", { filter, startDate, endDate });
    fetchTransactions();
  };

  const resetFilters = () => {
    setFilter('all');
    setStartDate('');
    setEndDate('');
    setLocalItemFilter('');
    fetchTransactions();
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const getTransactionBadgeStyle = (type) => {
    switch (type) {
      case 'ADD_ITEM':
      case 'STOCK_IN':
      case 'in':
        return 'success';
      case 'REMOVE_ITEM':
      case 'STOCK_OUT':
      case 'out':
        return 'danger';
      case 'TRANSFER_IN':
        return 'info';
      case 'TRANSFER_OUT':
        return 'warning';
      case 'UPDATE':
        return 'primary';
      case 'CREATE':
      case 'NEW_ITEM':
        return 'success';
      case 'DELETE':
      case 'delete':
        return 'danger';
      case 'SOFT_DELETE':
      case 'soft-delete':
      case 'BULK_SOFT_DELETE':
        return 'warning';
      case 'PERMANENT_DELETE':
      case 'permanent-delete':
      case 'BULK_PERMANENT_DELETE':
        return 'danger';
      default:
        // Check for partial matches in the type string
        if (type && typeof type === 'string') {
          const lowerType = type.toLowerCase();
          if (lowerType.includes('delete')) {
            return lowerType.includes('soft') ? 'warning' : 'danger';
          }
          if (lowerType.includes('in') || lowerType.includes('add') || lowerType.includes('create')) {
            return 'success';
          }
          if (lowerType.includes('out') || lowerType.includes('remove')) {
            return 'danger';
          }
          if (lowerType.includes('transfer')) {
            return 'info';
          }
        }
        return 'secondary';
    }
  };

  const formatTransactionType = (type) => {
    if (!type) return 'UNKNOWN';
    
    // Handle standardized transaction types
    switch(type.toLowerCase()) {
      case 'in':
        return 'STOCK IN';
      case 'out':
        return 'STOCK OUT';
      case 'transfer':
        return 'TRANSFER';
      case 'stock_in':
        return 'STOCK IN';
      case 'stock_out':
        return 'STOCK OUT';
      case 'delete':
        return 'DELETE';
      case 'soft_delete':
      case 'soft-delete':
        return 'SOFT DELETE';
      case 'permanent_delete':
      case 'permanent-delete':
        return 'PERMANENT DELETE';
      case 'bulk_soft_delete':
        return 'BULK SOFT DELETE';
      case 'bulk_permanent_delete':
        return 'BULK PERMANENT DELETE';
      default:
        return type.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Helper function to determine if a transaction is deletion-related
  const isDeleteTransaction = (transaction) => {
    if (!transaction) return false;
    
    // Check both the is_deletion flag and transaction_type
    const transactionType = transaction.transaction_type || transaction.type || '';
    const lowerType = typeof transactionType === 'string' ? transactionType.toLowerCase() : '';
    
    // Enhanced check for deletion types
    return (
      transaction.is_deletion === true || 
      lowerType === 'delete' ||
      lowerType === 'soft_delete' ||
      lowerType === 'soft-delete' ||
      lowerType === 'permanent_delete' ||
      lowerType === 'permanent-delete' ||
      lowerType === 'bulk_soft_delete' ||
      lowerType === 'bulk_permanent_delete' ||
      lowerType.includes('delete')
    );
  };

  // Filter transactions based on UI filters
  const filteredTransactions = Array.isArray(transactions) ? transactions.filter(transaction => {
    // If no transaction data, skip filtering
    if (!transaction) return false;
    
    // Special handling for deletions tab
    if (filter === 'delete') {
      return isDeleteTransaction(transaction);
    }
    
    // For all other tabs (non-deletion tabs), still show item transactions where the item was later deleted
    // This ensures all transactions are included regardless of deletion status
    
    // Filter by transaction type
    if (filter !== 'all') {
      // Check both transaction_type and type fields (for compatibility)
      const transType = transaction.transaction_type || transaction.type || '';
      
      // Handle different transaction type formats
      const normalizedTransType = typeof transType === 'string' ? transType.toLowerCase() : '';
      const normalizedFilter = filter.toLowerCase();
      
      // Check is_deletion flag for delete filter
      if (normalizedFilter === 'delete' && transaction.is_deletion) {
        return true;
      }
      
      // Match specific transaction types
      if (normalizedFilter === 'in' && 
          (normalizedTransType === 'in' || normalizedTransType === 'stock_in' || normalizedTransType === 'stock in' || 
          normalizedTransType === 'new_item')) {
        // Include this transaction
      } 
      else if (normalizedFilter === 'out' && 
              (normalizedTransType === 'out' || normalizedTransType === 'stock_out' || normalizedTransType === 'stock out')) {
        // Include this transaction
      }
      else if (normalizedFilter === 'transfer' && 
              (normalizedTransType === 'transfer' || normalizedTransType === 'transfer_in' || 
              normalizedTransType === 'transfer_out' || normalizedTransType.includes('transfer'))) {
        // Include this transaction
      }
      else if (normalizedFilter === 'delete' && isDeleteTransaction(transaction)) {
        // Include this deletion transaction
      }
      else if (normalizedFilter === 'update' && 
              (normalizedTransType === 'update' || normalizedTransType.includes('update'))) {
        // Include this update transaction
      }
      else if (normalizedFilter === 'create' && 
              (normalizedTransType === 'create' || normalizedTransType.includes('create') || 
              normalizedTransType === 'new_item')) {
        // Include this creation transaction
      }
      else if (!normalizedTransType.includes(normalizedFilter)) {
        return false;
      }
    }
    
    // Filter by item if specified - prefer the prop value, then the local state value
    const effectiveItemFilter = itemFilter || localItemFilter;
    if (effectiveItemFilter) {
      const itemName = transaction.item_name?.toLowerCase() || '';
      const itemId = String(transaction.item_id || '').toLowerCase();
      const searchTerm = effectiveItemFilter.toLowerCase();
      
      // Check if item name or ID contains the search term
      if (!itemName.includes(searchTerm) && !itemId.includes(searchTerm)) {
        return false;
      }
    }
    
    // Filter by date range if specified
    if (startDate) {
      const transDate = new Date(transaction.created_at);
      const filterDate = new Date(startDate);
      if (transDate < filterDate) return false;
    }
    
    if (endDate) {
      const transDate = new Date(transaction.created_at);
      const filterDate = new Date(endDate);
      // Add one day to include the end date fully
      filterDate.setDate(filterDate.getDate() + 1);
      if (transDate > filterDate) return false;
    }
    
    return true;
  }) : [];

  // Implement pagination
  const totalItems = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Get current page items
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Call onCountUpdate when transaction count changes
  useEffect(() => {
    if (onCountUpdate && typeof onCountUpdate === 'function') {
      onCountUpdate(filteredTransactions.length);
    }
  }, [filteredTransactions.length, onCountUpdate]);

  return (
    <div className="transaction-history">
      {!hideFilters && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3 p-3">
            <h5 className="mb-0">
              <i className="bi bi-clock-history me-2"></i>
              Transaction History
            </h5>
            <span className="badge bg-secondary">{filteredTransactions.length}</span>
          </div>

          {/* Filter controls */}
          <div className="card mb-3 mx-3">
            <div className="card-body p-3">
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label small mb-1">Transaction Type</label>
                  <select 
                    className="form-select form-select-sm"
                    value={filter} 
                    onChange={handleFilterChange}
                  >
                    <option value="all">All Transactions</option>
                    <option value="in">Stock In</option>
                    <option value="out">Stock Out</option>
                    <option value="transfer">Transfers</option>
                    <option value="update">Updates</option>
                    <option value="create">Creation</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small mb-1">Item Name/ID</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search by item..."
                    value={localItemFilter}
                    onChange={handleItemFilterChange}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={handleStartDateChange}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small mb-1">To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={endDate}
                    onChange={handleEndDateChange}
                  />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <div className="d-flex gap-2 w-100">
                    <button 
                      className="btn btn-primary btn-sm flex-grow-1"
                      onClick={applyFilters}
                    >
                      <i className="bi bi-funnel me-1"></i>
                      Filter
                    </button>
                    <button 
                      className="btn btn-outline-secondary btn-sm"
                      onClick={resetFilters}
                    >
                      <i className="bi bi-x-circle"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {itemFilter && (
        <div className="alert alert-info mx-3">
          <i className="bi bi-filter me-2"></i>
          Showing transactions for item: <strong>{itemFilter}</strong>
        </div>
      )}

      {error && <div className="alert alert-danger mx-3">{error}</div>}

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading transactions...</p>
        </div>
      ) : (
        <>
          {filteredTransactions.length === 0 ? (
            <div className="text-center my-5 text-muted">
              <i className="bi bi-inbox-fill fs-2"></i>
              <p className="mt-2">No transactions found</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className={`table table-hover table-striped ${hideFilters ? 'table-sm' : ''}`}>
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Date & Time</th>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Box</th>
                      <th>User</th>
                      <th>Reason / Customer</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((transaction, index) => {
                      if (!transaction) return null; // Skip null/undefined transactions
                      
                      // Support both API response formats (box transactions and stock history)
                      const transactionType = transaction.transaction_type || transaction.type || 'UNKNOWN';
                      const itemName = transaction.item_name || 'N/A';
                      const quantity = transaction.quantity || 1;
                      const boxInfo = transaction.box_name || transaction.to_box_name || 
                        (transaction.box_id ? `Box #${transaction.box_id}` : 'N/A');
                      
                      // Check if this is a deletion transaction
                      const isDeletion = isDeleteTransaction(transaction);
                      
                      // Extract reason and customer info
                      const reasonText = transaction.reason || '';
                      let customerInfo = '';
                      
                      // Try multiple approaches to extract customer information
                      
                      // 1. Direct access to customer_info if available
                      if (transaction.customer_info) {
                        if (transaction.customer_info.contact_person) {
                          customerInfo = transaction.customer_info.contact_person;
                        } else if (transaction.customer_info.name) {
                          customerInfo = transaction.customer_info.name;
                        }
                      }
                      
                      // 2. Check the details field for customer info
                      if (!customerInfo && transaction.details) {
                        const consumedMatch = transaction.details.match(/CONSUMED by ([^.]+)/i);
                        const soldMatch = transaction.details.match(/SOLD to ([^.]+)/i);
                        
                        if (consumedMatch) {
                          customerInfo = consumedMatch[1].trim();
                        } else if (soldMatch) {
                          customerInfo = soldMatch[1].trim();
                        }
                      }
                      
                      // 3. Check for customer_id and reason to infer consumed/sold
                      if (!customerInfo && transaction.customer_id && reasonText) {
                        if (reasonText === 'CONSUMED' || reasonText === '1') {
                          customerInfo = 'Customer #' + transaction.customer_id;
                        } else if (reasonText === 'SOLD' || reasonText === '7') {
                          customerInfo = 'Customer #' + transaction.customer_id;
                        }
                      }
                      
                      // 4. Parse customer information from notes (consumed by/sold to)
                      if (!customerInfo && transaction.notes) {
                        const consumedMatch = transaction.notes.match(/consumed by ([^.]+)/i);
                        const soldMatch = transaction.notes.match(/sold to ([^.]+)/i);
                        if (consumedMatch) {
                          customerInfo = consumedMatch[1].trim();
                        } else if (soldMatch) {
                          customerInfo = soldMatch[1].trim();
                        }
                      }
                      
                      // 5. For stock out transactions, check if reason is CONSUMED or SOLD
                      if (!customerInfo && (transactionType === 'STOCK_OUT' || transactionType === 'out')) {
                        if (reasonText === 'CONSUMED' || reasonText === '1') {
                          customerInfo = 'Consumed';
                        } else if (reasonText === 'SOLD' || reasonText === '7') {
                          customerInfo = 'Sold';
                        }
                      }
                      
                      // Format reason text for better readability
                      let displayReason = reasonText;
                      if (reasonText === '1') displayReason = 'CONSUMED';
                      if (reasonText === '7') displayReason = 'SOLD';
                      
                      // Apply styling based on transaction type
                      const rowClassName = isDeletion ? 'table-warning' : '';
                      
                      // Create a more unique key for each transaction row
                      // Ensure uniqueness even with duplicate transaction IDs from database
                      const uniqueKey = `tr-${index}-${currentPage}-${Math.random().toString(36).substring(2, 8)}-${transaction.id || transaction.created_at || Date.now()}`;
                      
                      return (
                        <tr key={uniqueKey} className={rowClassName}>
                          <td>
                            <span className={`badge bg-${getTransactionBadgeStyle(transactionType)}`}>
                              {formatTransactionType(transactionType)}
                            </span>
                            {isDeletion && (
                              <i className="bi bi-exclamation-triangle text-danger ms-2" title="Item deletion transaction"></i>
                            )}
                          </td>
                          <td className="text-nowrap">{formatDate(transaction.created_at)}</td>
                          <td className="text-truncate" style={{maxWidth: '150px'}}>{itemName}</td>
                          <td>{quantity}</td>
                          <td>{boxInfo}</td>
                          <td>{transaction.user_name || transaction.created_by || 'System'}</td>
                          <td>
                            {customerInfo ? (
                              <>
                                <span className="badge bg-info text-dark">
                                  <i className="bi bi-person me-1"></i>
                                  {customerInfo}
                                </span>
                                {displayReason && displayReason !== 'CONSUMED' && displayReason !== 'SOLD' && (
                                  <span className="badge bg-secondary ms-1">
                                    {displayReason}
                                  </span>
                                )}
                              </>
                            ) : displayReason ? (
                              <span className="badge bg-secondary">
                                {displayReason}
                              </span>
                            ) : transaction.details?.includes('CONSUMED by') ? (
                              <span className="badge bg-info text-dark">
                                <i className="bi bi-person me-1"></i>
                                {transaction.details.match(/CONSUMED by ([^.]+)/i)?.[1] || 'Customer'}
                              </span>
                            ) : transaction.details?.includes('SOLD to') ? (
                              <span className="badge bg-info text-dark">
                                <i className="bi bi-person me-1"></i>
                                {transaction.details.match(/SOLD to ([^.]+)/i)?.[1] || 'Customer'}
                              </span>
                            ) : ''}
                          </td>
                          <td className="text-truncate" style={{maxWidth: '200px'}}>{transaction.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination component */}
              <div className="px-3 py-3">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[10, 25, 50, 100]}
                  showPageSizeOptions={!limit}
                  showItemCount={true}
                  size={size}
                  variant={variant}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default TransactionHistory; 