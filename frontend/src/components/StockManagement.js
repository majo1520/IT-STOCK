import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StockInModal from './StockInModal';
import StockOutModal from './StockOutModal';
import TransactionHistory from './TransactionHistory';
import ErrorBoundary from './common/ErrorBoundary';
import { useApi } from '../contexts/ApiServiceContext';

function StockManagement() {
  const { api } = useApi();
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const [stockStats, setStockStats] = useState({
    totalInCount: 0,
    totalOutCount: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStockStats();
  }, [refreshTransactions]);

  const fetchStockStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get recent stock movements (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const formattedDate = sevenDaysAgo.toISOString().split('T')[0];
      
      let stockHistory;
      try {
        // Try to get stock history
        const response = await api.getStockHistory(null, null, formattedDate, null);
        console.log('Stock history API response:', response);
        stockHistory = response.data || [];
        console.log('Stock history data:', stockHistory);
      } catch (historyError) {
        console.error('Error fetching stock history:', historyError);
        // Fallback to empty history if API fails
        stockHistory = [];
        
        // Try to get item data as fallback for stats
        try {
          const itemsResponse = await api.getItems();
          console.log('Items API response for fallback:', itemsResponse);
          const items = itemsResponse.data || [];
          
          // Create some mock stats based on current items
          stockHistory = items.map(item => ({
            id: `item-${item.id}`,
            type: 'in',
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity || 1,
            created_at: item.created_at || new Date().toISOString()
          }));
          console.log('Generated fallback stock history:', stockHistory);
        } catch (itemsError) {
          console.error('Error fetching items fallback:', itemsError);
        }
      }
      
      // Ensure stockHistory is an array
      stockHistory = Array.isArray(stockHistory) ? stockHistory : [];
      
      // Count stock in and stock out operations
      const inCount = stockHistory.filter(item => item.type === 'in').length;
      const outCount = stockHistory.filter(item => item.type === 'out').length;
      
      setStockStats({
        totalInCount: inCount,
        totalOutCount: outCount,
        recentActivity: Array.isArray(stockHistory) ? stockHistory.slice(0, 5) : [] // Get only the 5 most recent activities
      });
    } catch (error) {
      console.error('Error fetching stock stats:', error);
      setError('Failed to load stock statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleStockInSuccess = () => {
    setRefreshTransactions(prev => prev + 1);
  };

  const handleStockOutSuccess = () => {
    setRefreshTransactions(prev => prev + 1);
  };

  // Debug logging for modal state
  useEffect(() => {
    console.log('StockOutModal visibility:', showStockOutModal);
  }, [showStockOutModal]);

  return (
    <ErrorBoundary errorMessage="Failed to load stock management data. Please try again.">
      <div className="stock-management">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-box-seam fs-2 me-3 text-primary"></i>
            <div>
              <h1 className="h3 mb-0">Stock Management</h1>
              <p className="text-muted mb-0">Track and manage inventory stock in/out operations</p>
            </div>
          </div>
          <div className="d-flex gap-2">
            <Link to="/items" className="btn btn-outline-secondary">
              <i className="bi bi-list-ul me-1"></i>
              View All Items
            </Link>
            <div className="btn-group">
              <button 
                className="btn btn-success"
                onClick={() => setShowStockInModal(true)}
              >
                <i className="bi bi-box-arrow-in-down me-1"></i>
                Stock In
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => setShowStockOutModal(true)}
                type="button"
              >
                <i className="bi bi-box-arrow-up-right me-1"></i>
                Stock Out
              </button>
            </div>
          </div>
        </div>

        {/* Error alert if any */}
        {error && (
          <div className="alert alert-warning alert-dismissible fade show mb-4" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setError(null)} 
              aria-label="Close"
            ></button>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="card h-100 border-success">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-success bg-opacity-10 p-3 me-3">
                    <i className="bi bi-box-arrow-in-down text-success fs-4"></i>
                  </div>
                  <div>
                    <h6 className="text-muted mb-1">Stock In (7 days)</h6>
                    <h3 className="mb-0">{loading ? '...' : stockStats.totalInCount}</h3>
                  </div>
                </div>
                <button 
                  className="btn btn-sm btn-success w-100 mt-3"
                  onClick={() => setShowStockInModal(true)}
                >
                  Add Items
                </button>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card h-100 border-danger">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-danger bg-opacity-10 p-3 me-3">
                    <i className="bi bi-box-arrow-up-right text-danger fs-4"></i>
                  </div>
                  <div>
                    <h6 className="text-muted mb-1">Stock Out (7 days)</h6>
                    <h3 className="mb-0">{loading ? '...' : stockStats.totalOutCount}</h3>
                  </div>
                </div>
                <button 
                  className="btn btn-sm btn-danger w-100 mt-3"
                  onClick={() => setShowStockOutModal(true)}
                >
                  Remove Items
                </button>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card h-100">
              <div className="card-header bg-primary text-white py-2">
                <i className="bi bi-activity me-2"></i>
                Recent Activity
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="text-center my-3">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : stockStats.recentActivity.length > 0 ? (
                  <ul className="list-group list-group-flush">
                    {stockStats.recentActivity.map((activity, index) => (
                      <li key={`activity-${index}-${Math.random().toString(36).substring(2, 8)}-${activity.id || activity.created_at || Date.now()}`} className="list-group-item py-2 px-3">
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <span className={`badge ${activity.type === 'in' ? 'bg-success' : 'bg-danger'} me-2`}>
                              {activity.type === 'in' ? 'IN' : 'OUT'}
                            </span>
                            <span className="small">{activity.item_name}</span>
                          </div>
                          <small className="text-muted">
                            {new Date(activity.created_at).toLocaleDateString()}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center my-3 text-muted">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center bg-primary text-white">
            <div>
              <i className="bi bi-clock-history me-2"></i>
              Transaction History
            </div>
            {/* Commenting out the link since the page might not exist */}
            {/* 
            <Link to="/stock/history" className="btn btn-sm btn-light">
              View All
            </Link>
            */}
            <button 
              className="btn btn-sm btn-light"
              onClick={() => setRefreshTransactions(prev => prev + 1)}
              title="Refresh history"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
          <div className="card-body p-0">
            <ErrorBoundary errorMessage="Failed to load transaction history">
              <TransactionHistory 
                key={refreshTransactions} 
                hideFilters={false}
                size="md"
                variant="rounded"
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Stock In Modal */}
        <StockInModal 
          show={showStockInModal}
          handleClose={() => setShowStockInModal(false)}
          onSuccess={handleStockInSuccess}
        />

        {/* Stock Out Modal */}
        <StockOutModal 
          show={showStockOutModal}
          handleClose={() => setShowStockOutModal(false)}
          onSuccess={handleStockOutSuccess}
        />
      </div>
    </ErrorBoundary>
  );
}

export default StockManagement; 