import React, { useEffect } from 'react';
import './styles/Pagination.css';

/**
 * Enhanced reusable pagination component
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.pageSize - Number of items per page
 * @param {number} props.totalItems - Total number of items
 * @param {Function} props.onPageChange - Function to handle page change
 * @param {Function} props.onPageSizeChange - Function to handle page size change
 * @param {Array} props.pageSizeOptions - Available page size options
 * @param {boolean} props.showPageSizeOptions - Whether to show page size options
 * @param {boolean} props.showItemCount - Whether to show item count
 * @param {string} props.size - Size of pagination: 'sm', 'md' (default), or 'lg'
 * @param {string} props.variant - Styling variant: 'default', 'rounded', 'pills'
 */
function Pagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeOptions = true,
  showItemCount = true,
  size = 'md',
  variant = 'default'
}) {
  // Calculate page range to display
  const getPageRange = () => {
    const maxVisible = window.innerWidth < 576 ? 3 : 5; // Responsive: fewer buttons on mobile
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    
    return Array.from({ length: (end - start) + 1 }, (_, i) => start + i);
  };

  // Handle page change
  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
    
    // Scroll to top of the table/list when changing pages
    const container = document.querySelector('.table-responsive');
    if (container) {
      container.scrollTop = 0;
    }
  };

  // Handle page size change
  const handlePageSizeChange = (e) => {
    const newPageSize = parseInt(e.target.value);
    onPageSizeChange(newPageSize);
  };

  // Handle direct page input
  const handleDirectPageInput = (e) => {
    if (e.key === 'Enter') {
      const page = parseInt(e.target.value);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        handlePageChange(page);
        e.target.value = '';
      }
    }
  };

  // Add keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle keyboard navigation when not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Left arrow: previous page
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        handlePageChange(currentPage - 1);
        showKeyboardHint();
      }
      // Right arrow: next page
      else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        handlePageChange(currentPage + 1);
        showKeyboardHint();
      }
      // Home key: first page
      else if (e.key === 'Home') {
        handlePageChange(1);
        showKeyboardHint();
      }
      // End key: last page
      else if (e.key === 'End') {
        handlePageChange(totalPages);
        showKeyboardHint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, totalPages]);
  
  // Show keyboard navigation hint
  const showKeyboardHint = () => {
    const container = document.querySelector('.pagination-container');
    if (!container) return;
    
    const hint = container.querySelector('::after');
    if (hint) {
      // Show the hint
      const style = document.createElement('style');
      style.textContent = '.pagination-container:focus-within::after { display: block !important; }';
      document.head.appendChild(style);
      
      // Hide after 3 seconds
      setTimeout(() => {
        document.head.removeChild(style);
      }, 3000);
    }
  };

  // Calculate items showing
  const firstItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  // Get pagination size class
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'pagination-sm';
      case 'lg': return 'pagination-lg';
      default: return '';
    }
  };

  // Get variant styling
  const getVariantClass = () => {
    switch (variant) {
      case 'rounded': return 'pagination-rounded';
      case 'pills': return 'pagination-pills';
      default: return '';
    }
  };

  return (
    <div className="d-flex flex-column flex-md-row align-items-center justify-content-between my-3 pagination-container">
      {/* Page size selector and item count */}
      <div className="d-flex flex-wrap align-items-center mb-2 mb-md-0 small">
        {showPageSizeOptions && (
          <div className="d-flex align-items-center me-3 mb-2 mb-sm-0">
            <span className="me-2 text-muted">Show:</span>
            <select
              className="form-select form-select-sm"
              value={pageSize}
              onChange={handlePageSizeChange}
              style={{ width: '80px' }}
              aria-label="Items per page"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
        
        {showItemCount && totalItems > 0 && (
          <div className="text-muted d-flex align-items-center mb-2 mb-sm-0">
            <span className="d-none d-sm-inline me-1">Showing</span> 
            <span className="fw-bold mx-1">{firstItem}-{lastItem}</span> 
            <span className="d-none d-sm-inline me-1">of</span>
            <span className="fw-bold mx-1">{totalItems}</span> 
            <span className="d-none d-sm-inline">items</span>
          </div>
        )}
        
        {/* Direct page input for larger screens */}
        {totalPages > 5 && (
          <div className="ms-auto ms-md-3 d-none d-md-flex align-items-center">
            <span className="text-muted me-2">Go to:</span>
            <input
              type="number"
              className="form-control form-control-sm"
              min="1"
              max={totalPages}
              onKeyDown={handleDirectPageInput}
              style={{ width: '60px' }}
              aria-label="Go to page"
            />
          </div>
        )}
      </div>

      {/* Pagination buttons */}
      {totalPages > 1 && (
        <nav aria-label="Table navigation" className="mt-2 mt-md-0">
          <ul className={`pagination ${getSizeClass()} ${getVariantClass()} mb-0`}>
            {/* First page button */}
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                aria-label="First page"
              >
                <i className="bi bi-chevron-double-left"></i>
              </button>
            </li>
            
            {/* Previous page button */}
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <i className="bi bi-chevron-left"></i>
              </button>
            </li>
            
            {/* Page numbers - show ellipsis for large page counts */}
            {totalPages > 7 && currentPage > 3 && (
              <>
                <li className="page-item d-none d-sm-block">
                  <button className="page-link" onClick={() => handlePageChange(1)}>1</button>
                </li>
                {currentPage > 4 && (
                  <li className="page-item disabled d-none d-sm-block">
                    <span className="page-link">...</span>
                  </li>
                )}
              </>
            )}
            
            {/* Visible page numbers */}
            {getPageRange().map(page => (
              <li key={page} className={`page-item ${page === currentPage ? 'active' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => handlePageChange(page)}
                  aria-current={page === currentPage ? "page" : undefined}
                >
                  {page}
                </button>
              </li>
            ))}
            
            {/* End ellipsis for large page counts */}
            {totalPages > 7 && currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && (
                  <li className="page-item disabled d-none d-sm-block">
                    <span className="page-link">...</span>
                  </li>
                )}
                <li className="page-item d-none d-sm-block">
                  <button className="page-link" onClick={() => handlePageChange(totalPages)}>
                    {totalPages}
                  </button>
                </li>
              </>
            )}
            
            {/* Next page button */}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </li>
            
            {/* Last page button */}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button 
                className="page-link" 
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Last page"
              >
                <i className="bi bi-chevron-double-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}

export default Pagination; 