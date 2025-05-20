import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStockHistory, getItems } from '../services/api';

function StockHistory() {
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [selectedItem, setSelectedItem] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [transactionType, setTransactionType] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const itemId = params.get('item_id');
    const type = params.get('type');
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const page = parseInt(params.get('page')) || 1;
    const perPage = parseInt(params.get('per_page')) || 10;
    
    if (itemId) setSelectedItem(itemId);
    if (type) setTransactionType(type);
    if (startDate) setDateRange(prev => ({ ...prev, startDate }));
    if (endDate) setDateRange(prev => ({ ...prev, endDate }));
    setCurrentPage(page);
    setItemsPerPage(perPage);
    
    fetchItems();
    fetchHistory(itemId, type, startDate, endDate);
  }, [location]);

  const fetchItems = async () => {
    try {
      const response = await getItems();
      setItems(response.data);
    } catch (err) {
      console.error('Error fetching items:', err);
    }
  };

  const fetchHistory = async (itemId = null, type = null, startDate = null, endDate = null) => {
    try {
      setLoading(true);
      const response = await getStockHistory(itemId, type, startDate, endDate);
      
      // Set the total items count for pagination
      const allRecords = response.data || [];
      setTotalItems(allRecords.length);
      
      // Store all records but display only the current page
      setHistory(allRecords);
      setError(null);
    } catch (err) {
      setError('Failed to fetch stock history. Please try again later.');
      console.error('Error fetching stock history:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate pagination values
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = history.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(history.length / itemsPerPage);

  // Change page
  const paginate = (pageNumber) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    
    const params = new URLSearchParams(location.search);
    params.set('page', pageNumber);
    navigate({ search: params.toString() });
    setCurrentPage(pageNumber);
    
    // Scroll to top of the table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemChange = (e) => {
    const itemId = e.target.value;
    setSelectedItem(itemId);
    
    const params = new URLSearchParams(location.search);
    if (itemId) {
      params.set('item_id', itemId);
    } else {
      params.delete('item_id');
    }
    
    // Reset to page 1 when changing filters
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    fetchHistory(
      itemId || null, 
      transactionType || null, 
      dateRange.startDate || null, 
      dateRange.endDate || null
    );
  };

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setTransactionType(type);
    
    const params = new URLSearchParams(location.search);
    if (type) {
      params.set('type', type);
    } else {
      params.delete('type');
    }
    
    // Reset to page 1 when changing filters
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    
    // Ensure we're sending the correct type value to the API
    console.log('Filtering by transaction type:', type);
    fetchHistory(
      selectedItem || null, 
      type || null, 
      dateRange.startDate || null, 
      dateRange.endDate || null
    );
  };

  const handleDateChange = (field, value) => {
    const newDateRange = { ...dateRange, [field]: value };
    setDateRange(newDateRange);
    
    const params = new URLSearchParams(location.search);
    if (value) {
      params.set(field === 'startDate' ? 'start_date' : 'end_date', value);
    } else {
      params.delete(field === 'startDate' ? 'start_date' : 'end_date');
    }
    
    // Reset to page 1 when changing filters
    params.set('page', 1);
    setCurrentPage(1);
    
    navigate({ search: params.toString() });
    
    // Always fetch when either date changes
    console.log('Date filter changed:', field, value);
    console.log('New date range:', newDateRange.startDate, newDateRange.endDate);
    
    fetchHistory(
      selectedItem || null, 
      transactionType || null, 
      newDateRange.startDate || null, 
      newDateRange.endDate || null
    );
  };

  const clearFilters = () => {
    setSelectedItem('');
    setTransactionType('');
    setDateRange({ startDate: '', endDate: '' });
    setCurrentPage(1);
    
    // Clear URL parameters
    navigate({ search: '' });
    
    // Reset pagination to defaults
    setItemsPerPage(10);
    
    // Fetch unfiltered history data
    console.log('Clearing all filters');
    fetchHistory(null, null, null, null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'in': return 'Stock In';
      case 'out': return 'Stock Out';
      case 'transfer': return 'Transfer';
      default: return type;
    }
  };

  const getTransactionTypeBadge = (type) => {
    switch (type) {
      case 'in': return 'bg-success';
      case 'out': return 'bg-danger';
      case 'transfer': return 'bg-primary';
      default: return 'bg-secondary';
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" className="bi bi-clock-history me-2 text-primary" viewBox="0 0 16 16">
            <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022zm2.004.45a7 7 0 0 0-.985-.299l.219-.976a8 8 0 0 1 1.125.34zm1.69.896a7 7 0 0 0-.833-.556l.391-.902a8 8 0 0 1 .955.639zm1.178 1.173a7 7 0 0 0-.631-.748l.54-.79c.27.292.52.608.743.949zM14.345 4.4a7 7 0 0 0-.375-.872l.67-.665a8 8 0 0 1 .432.998zM15.358 6.4a7 7 0 0 0-.08-.962l.782-.518a8 8 0 0 1 .09 1.103zM15.8 8.3a7 7 0 0 0 .236-.971l.884.237a8 8 0 0 1-.271 1.116zM16 10.32a7 7 0 0 0-.214-.938l.847-.352a8 8 0 0 1 .245 1.076zM15.42 12.5a7 7 0 0 0-.436-.846l.749-.544c.185.334.35.688.49 1.06zM14.195 14.38a7 7 0 0 0-.616-.674l.601-.703c.242.266.463.55.66.77zM12.444 15.74a7 7 0 0 0-.752-.44l.397-.899c.29.196.575.41.84.534zM10.326 16.45a7 7 0 0 0-.84-.175l.147-.991a8 8 0 0 1 .96.2zM8.52 16.71a7 7 0 0 0-.855 0l-.147-.99a8 8 0 0 1 1.15 0zM6.74 16.262a7 7 0 0 0-.84.177l-.219-.976a8 8 0 0 1 .96-.203zM5.1 15.66a7 7 0 0 0-.75.443l-.397-.898c.264-.182.54-.346.83-.535zm-1.33-.93a7 7 0 0 0-.616.678l-.602-.702c.192-.225.417-.478.655-.77zm-1.224-1.188a7 7 0 0 0-.437.851l-.749-.542c.15-.304.34-.61.49-1.064zm-.594-1.399a7.014 7.014 0 0 0-.214.942l-.847-.353c.082-.28.166-.572.245-1.075zm.004-1.947a7 7 0 0 0 .233.975l-.884.237a8 8 0 0 1-.27-1.12zm.413-1.85a7 7 0 0 0-.083.965l-.781-.52a8 8 0 0 1 .094-1.105zm1-.934c-.127.302-.241.609-.377.873l-.67-.663a8 8 0 0 1 .435-.1zm.663-1.16a7 7 0 0 0-.631.75l-.54-.788a8 8 0 0 1 .721-.952zm.726-.54a7 7 0 0 0-.834.56l-.391-.902c.281-.206.59-.38.956-.641zm.527-.265a7 7 0 0 0-.983.303l-.222-.978a8 8 0 0 1 1.128-.341zM6.75.5a.5.5 0 0 1 .5.5v5.75h4.75a.75.75 0 0 1 0 1.5h-5.5a.5.5 0 0 1-.5-.5V.5a.5.5 0 0 1 .5-.5"/>
          </svg>
          <div>
            <small className="text-muted">INVENTORY</small>
            <h2 className="h5 mb-0">STOCK HISTORY</h2>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-body p-3">
          <div className="row align-items-center g-3">
            <div className="col-md-3">
              <label htmlFor="itemFilter" className="form-label small mb-1 d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-tag me-1 text-primary" viewBox="0 0 16 16">
                  <path d="M6 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1 0a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0z"/>
                  <path d="M2 1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 1 6.586V2a1 1 0 0 1 1-1zm0 5.586 7 7L13.586 9l-7-7H2v4.586z"/>
                </svg>
                Item:
              </label>
              <select
                id="itemFilter"
                className="form-select form-select-sm"
                value={selectedItem}
                onChange={handleItemChange}
              >
                <option value="">All Items</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label htmlFor="typeFilter" className="form-label small mb-1 d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-arrow-down-up me-1 text-primary" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5m-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5"/>
                </svg>
                Type:
              </label>
              <select
                id="typeFilter"
                className="form-select form-select-sm"
                value={transactionType}
                onChange={handleTypeChange}
              >
                <option value="">All Types</option>
                <option value="in" style={{color: '#198754'}}>Stock In</option>
                <option value="out" style={{color: '#dc3545'}}>Stock Out</option>
                <option value="transfer" style={{color: '#0d6efd'}}>Transfer</option>
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="startDate" className="form-label small mb-1 d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-calendar-event me-1 text-primary" viewBox="0 0 16 16">
                  <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z"/>
                  <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                </svg>
                From:
              </label>
              <input
                type="date"
                id="startDate"
                className="form-control form-control-sm"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label htmlFor="endDate" className="form-label small mb-1 d-flex align-items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-calendar-event me-1 text-primary" viewBox="0 0 16 16">
                  <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z"/>
                  <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                </svg>
                To:
              </label>
              <input
                type="date"
                id="endDate"
                className="form-control form-control-sm"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
            <div className="col-md-1">
              <label className="form-label small mb-1 invisible">Action</label>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-block"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : history.length === 0 ? (
        <div className="text-center py-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" className="bi bi-clock-history text-muted mb-3" viewBox="0 0 16 16">
            <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022zm2.004.45a7 7 0 0 0-.985-.299l.219-.976a8 8 0 0 1 1.125.34zm1.69.896a7 7 0 0 0-.833-.556l.391-.902a8 8 0 0 1 .955.639zm1.178 1.173a7 7 0 0 0-.631-.748l.54-.79c.27.292.52.608.743.949zM14.345 4.4a7 7 0 0 0-.375-.872l.67-.665a8 8 0 0 1 .432.998zM15.358 6.4a7 7 0 0 0-.08-.962l.782-.518a8 8 0 0 1 .09 1.103zM15.8 8.3a7 7 0 0 0 .236-.971l.884.237a8 8 0 0 1-.271 1.116zM16 10.32a7 7 0 0 0-.214-.938l.847-.352a8 8 0 0 1 .245 1.076zM15.42 12.5a7 7 0 0 0-.436-.846l.749-.544c.185.334.35.688.49 1.06zM14.195 14.38a7 7 0 0 0-.616-.674l.601-.703c.242.266.463.55.66.77zM12.444 15.74a7 7 0 0 0-.752-.44l.397-.899c.29.196.575.41.84.534zM10.326 16.45a7 7 0 0 0-.84-.175l.147-.991a8 8 0 0 1 .96.2zM8.52 16.71a7 7 0 0 0-.855 0l-.147-.99a8 8 0 0 1 1.15 0zM6.74 16.262a7 7 0 0 0-.84.177l-.219-.976a8 8 0 0 1 .96-.203zM5.1 15.66a7 7 0 0 0-.75.443l-.397-.898c.264-.182.54-.346.83-.535zm-1.33-.93a7 7 0 0 0-.616.678l-.602-.702c.192-.225.417-.478.655-.77zm-1.224-1.188a7 7 0 0 0-.437.851l-.749-.542c.15-.304.34-.61.49-1.064zm-.594-1.399a7.014 7.014 0 0 0-.214.942l-.847-.353c.082-.28.166-.572.245-1.075zm.004-1.947a7 7 0 0 0 .233.975l-.884.237a8 8 0 0 1-.27-1.12zm.413-1.85a7 7 0 0 0-.083.965l-.781-.52a8 8 0 0 1 .094-1.105zm1-.934c-.127.302-.241.609-.377.873l-.67-.663a8 8 0 0 1 .435-.1zm.663-1.16a7 7 0 0 0-.631.75l-.54-.788a8 8 0 0 1 .721-.952zm.726-.54a7 7 0 0 0-.834.56l-.391-.902c.281-.206.59-.38.956-.641zm.527-.265a7 7 0 0 0-.983.303l-.222-.978a8 8 0 0 1 1.128-.341zM6.75.5a.5.5 0 0 1 .5.5v5.75h4.75a.75.75 0 0 1 0 1.5h-5.5a.5.5 0 0 1-.5-.5V.5a.5.5 0 0 1 .5-.5"/>
          </svg>
          <h5 className="text-muted">No transaction history found</h5>
          <p className="text-muted">Try changing the filters or add some stock transactions</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-striped">
            <thead className="table-light">
              <tr>
                <th>Date & Time</th>
                <th>Item</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Box</th>
                <th>Details</th>
                <th>Customer/User</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(record => (
                <tr key={record.id}>
                  <td>
                    <div className="d-flex flex-column">
                      <span>{formatDate(record.created_at)}</span>
                      <small className="text-muted">{record.created_by}</small>
                    </div>
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <span className="fw-medium">{record.item_name}</span>
                      <small className="text-muted">ID: {record.item_id}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getTransactionTypeBadge(record.type)}`}>
                      {getTransactionTypeLabel(record.type)}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex flex-column">
                      <span>{record.quantity}</span>
                      <small className="text-muted">
                        {record.previous_quantity !== undefined && record.new_quantity !== undefined && (
                          <>
                            {record.previous_quantity} → {record.new_quantity}
                          </>
                        )}
                      </small>
                    </div>
                  </td>
                  <td>
                    {record.box_id ? (
                      <>Box #{record.box_id}</>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <div style={{ maxWidth: '200px', wordBreak: 'break-word' }}>
                      {record.notes}
                    </div>
                    {record.details && record.details.includes('Removed due to:') && (
                      <div className="mt-1">
                        {record.details.includes('Removed due to: CONSUMED by') ? (
                          <span className="badge bg-success bg-opacity-10 text-success">
                            <i className="bi bi-person-check me-1"></i>
                            {record.details}
                          </span>
                        ) : record.details.includes('Removed due to: SOLD by') ? (
                          <span className="badge bg-warning bg-opacity-10 text-warning">
                            <i className="bi bi-currency-dollar me-1"></i>
                            {record.details}
                          </span>
                        ) : (
                          <span className="badge bg-info bg-opacity-10 text-dark">
                            {record.details}
                          </span>
                        )}
                      </div>
                    )}
                    {record.details && record.details.includes('supplier:') && (
                      <div className="mt-1">
                        <span className="badge bg-primary bg-opacity-10 text-primary">
                          <i className="bi bi-truck me-1"></i>
                          {record.details}
                        </span>
                      </div>
                    )}
                    {record.supplier && !record.details?.includes('supplier:') && (
                      <div className="mt-1">
                        <span className="badge bg-primary bg-opacity-10 text-primary">
                          <i className="bi bi-truck me-1"></i>
                          Supplier: {record.supplier}
                        </span>
                      </div>
                    )}
                    {record.reason && !record.details?.includes(record.reason) && (
                      <span className="badge bg-info bg-opacity-10 text-dark mt-1">
                        Reason: {record.reason}
                      </span>
                    )}
                  </td>
                  <td>
                    {record.customer_info ? (
                      <div className="d-flex flex-column">
                        {(record.customer_info.reason === 'CONSUMED' || record.reason === 'CONSUMED') ? (
                          <>
                            <span className="badge bg-success">
                              {record.customer_info.contact_person || record.customer_info.name.split('(')[0].trim()}
                            </span>
                            {record.customer_info.company && (
                              <small className="text-muted mt-1">
                                {record.customer_info.company}
                              </small>
                            )}
                            <small className="text-success fw-medium mt-1">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              Consumed By
                            </small>
                          </>
                        ) : (record.customer_info.reason === 'SOLD' || record.reason === 'SOLD') ? (
                          <>
                            <span className="badge bg-warning text-dark">
                              {record.customer_info.name}
                            </span>
                            {record.customer_info.company && record.customer_info.company !== record.customer_info.name && (
                              <small className="text-muted mt-1">
                                {record.customer_info.company}
                              </small>
                            )}
                            <small className="text-warning fw-medium mt-1">
                              <i className="bi bi-currency-dollar me-1"></i>
                              Sold To
                            </small>
                          </>
                        ) : (
                          <>
                            <span className="badge bg-info">
                              {record.customer_info.name}
                            </span>
                            {record.customer_info.company && record.customer_info.company !== record.customer_info.name && (
                              <small className="text-muted mt-1">
                                {record.customer_info.company}
                              </small>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted small">
                Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, history.length)} of {history.length} transactions
              </div>
              <nav>
                <ul className="pagination pagination-sm">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                  </li>
                  
                  {/* First page */}
                  {currentPage > 2 && (
                    <li className="page-item">
                      <button className="page-link" onClick={() => paginate(1)}>1</button>
                    </li>
                  )}
                  
                  {/* Ellipsis if needed */}
                  {currentPage > 3 && (
                    <li className="page-item disabled">
                      <span className="page-link">...</span>
                    </li>
                  )}
                  
                  {/* Page before current */}
                  {currentPage > 1 && (
                    <li className="page-item">
                      <button className="page-link" onClick={() => paginate(currentPage - 1)}>
                        {currentPage - 1}
                      </button>
                    </li>
                  )}
                  
                  {/* Current page */}
                  <li className="page-item active">
                    <span className="page-link">{currentPage}</span>
                  </li>
                  
                  {/* Page after current */}
                  {currentPage < totalPages && (
                    <li className="page-item">
                      <button className="page-link" onClick={() => paginate(currentPage + 1)}>
                        {currentPage + 1}
                      </button>
                    </li>
                  )}
                  
                  {/* Ellipsis if needed */}
                  {currentPage < totalPages - 2 && (
                    <li className="page-item disabled">
                      <span className="page-link">...</span>
                    </li>
                  )}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 1 && (
                    <li className="page-item">
                      <button className="page-link" onClick={() => paginate(totalPages)}>
                        {totalPages}
                      </button>
                    </li>
                  )}
                  
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
              
              <div className="d-flex align-items-center">
                <label className="me-2 text-muted small">Items per page:</label>
                <select 
                  className="form-select form-select-sm" 
                  style={{ width: '70px' }}
                  value={itemsPerPage}
                  onChange={(e) => {
                    const newItemsPerPage = parseInt(e.target.value);
                    setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                    
                    // Update URL params
                    const params = new URLSearchParams(location.search);
                    params.set('page', 1);
                    params.set('per_page', newItemsPerPage);
                    navigate({ search: params.toString() });
                  }}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StockHistory; 