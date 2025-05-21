import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import BoxList from './components/BoxList';
import BoxDetail from './components/BoxDetail';
import BoxForm from './components/BoxForm';
import ItemList from './components/ItemList';
import ItemForm from './components/ItemForm';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import AdminPanel from './components/AdminPanel';
import CustomerList from './components/CustomerList';
import GroupList from './components/GroupList';
import TransactionPage from './components/TransactionPage';
import StockManagement from './components/StockManagement';
import StockInModal from './components/StockInModal';
import StockOutModal from './components/StockOutModal';
import RemovalReasonManagement from './components/RemovalReasonManagement';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApiServiceProvider } from './contexts/ApiServiceContext';
import RoleList from './components/RoleList';
import PrintLabels from './components/PrintLabels';
import QuickScanButton from './components/QuickScanButton';
import OfflineStatusBar from './components/common/OfflineStatusBar';
import OfflineModeToggle from './components/common/OfflineModeToggle';
import ErrorBoundary from './components/common/ErrorBoundary';
import './App.css';
import { login, findBoxByQRCode, findItemByQRCode } from './services/api';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Toast from 'react-bootstrap/Toast';
import ToastContainer from 'react-bootstrap/ToastContainer';
import codeSyncService from './services/codeSync';
import webSocketService from './services/webSocketService';
import initializeServices from './services/initService';
import Dropdown from 'react-bootstrap/Dropdown';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import ButtonGroup from 'react-bootstrap/ButtonGroup';

function AppContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [stockInItemId, setStockInItemId] = useState(null);
  const [stockInBoxId, setStockInBoxId] = useState(null);
  const [stockOutItemId, setStockOutItemId] = useState(null);
  const [stockOutBoxId, setStockOutBoxId] = useState(null);
  const [searchStatus, setSearchStatus] = useState(null); // 'box', 'item', 'searching', or null
  const [choiceDialog, setChoiceDialog] = useState({ show: false, box: null, item: null });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, setCurrentUser } = useAuth();

  // Initialize Bootstrap is no longer needed as we're using React-Bootstrap components
  
  // Check for auto re-authentication on component mount
  useEffect(() => {
    const checkForReauth = async () => {
      const needsReauth = localStorage.getItem('needsReauth');
      const rememberMe = localStorage.getItem('rememberMe');
      const rememberedUsername = localStorage.getItem('rememberedUsername');
      
      if (needsReauth === 'true' && rememberMe === 'true' && rememberedUsername && !currentUser) {
        try {
          // Show a notification that we're attempting to re-authenticate
          console.log('Attempting to re-authenticate with remembered credentials...');
          
          // We don't have the password, so we need to redirect to login
          navigate('/login');
        } catch (error) {
          console.error('Auto re-authentication failed:', error);
          // Clear the reauth flag to prevent infinite loops
          localStorage.removeItem('needsReauth');
        }
      }
    };
    
    checkForReauth();
  }, [currentUser, navigate, setCurrentUser]);

  // Handle URL parameters for stock actions
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const itemId = params.get('item_id');
    const boxId = params.get('box_id');
    
    if (action === 'stock-in' && itemId) {
      setStockInItemId(itemId);
      if (boxId) setStockInBoxId(boxId);
      setShowStockInModal(true);
      
      // Clear parameters from URL
      navigate(location.pathname, { replace: true });
    } else if (action === 'stock-out' && itemId) {
      setStockOutItemId(itemId);
      if (boxId) setStockOutBoxId(boxId);
      setShowStockOutModal(true);
      
      // Clear parameters from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, navigate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setSearchStatus('searching');
    try {
      // If input is a number, check both box and item QR codes first
      const isNumber = /^\d{1,14}$/.test(searchTerm.trim());
      if (isNumber) {
        const [boxResult, itemResult] = await Promise.all([
          findBoxByQRCode(searchTerm.trim()),
          findItemByQRCode(searchTerm.trim())
        ]);
        if (boxResult.data && itemResult.data) {
          // Both found, show dialog
          setChoiceDialog({ show: true, box: boxResult.data, item: itemResult.data });
          setSearchStatus(null);
          return;
        } else if (boxResult.data) {
          setSearchStatus('box');
          setTimeout(() => {
            setSearchTerm('');
            setSearchStatus(null);
            navigate(`/box/${boxResult.data.id}`);
          }, 500);
          return;
        } else if (itemResult.data) {
          setSearchStatus('item');
          setTimeout(() => {
            setSearchTerm('');
            setSearchStatus(null);
            navigate(`/items?search=id:${itemResult.data.id}`);
          }, 500);
          return;
        }
        
        console.log(`No exact QR match for number: ${searchTerm}, searching in item names...`);
        
        // Always redirect to items page with the numeric search term for name matching
        setSearchStatus(null);
        navigate(`/items?search=${encodeURIComponent(searchTerm)}&numeric_search=true&ts=${Date.now()}`);
        return;
      } else {
        // First check if it's a box QR code
        const boxResult = await findBoxByQRCode(searchTerm);
        if (boxResult.data) {
          setSearchStatus('box');
          setTimeout(() => {
            setSearchTerm('');
            setSearchStatus(null);
            navigate(`/box/${boxResult.data.id}`);
          }, 500);
          return;
        }
        // If not a box, check if it's an item QR code
        const itemResult = await findItemByQRCode(searchTerm);
        if (itemResult.data) {
          setSearchStatus('item');
          setTimeout(() => {
            setSearchTerm('');
            setSearchStatus(null);
            navigate(`/items?search=id:${itemResult.data.id}`);
          }, 500);
          return;
        }
      }
      
      // If no QR code matches are found, perform a general search
      setSearchStatus(null);
      navigate(`/items?search=${encodeURIComponent(searchTerm)}&ts=${Date.now()}`);
    } catch (error) {
      console.error('Error processing search:', error);
      setSearchStatus(null);
      navigate(`/items?search=${encodeURIComponent(searchTerm)}&ts=${Date.now()}`);
    }
  };

  const handleStockInSuccess = () => {
    setShowStockInModal(false);
    setStockInItemId(null);
    setStockInBoxId(null);
    navigate('/stock');
  };

  const handleStockOutSuccess = () => {
    setShowStockOutModal(false);
    setStockOutItemId(null);
    setStockOutBoxId(null);
    navigate('/stock');
  };

  // Function to show toast notifications globally
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
  };
  
  // Make toast function available globally
  useEffect(() => {
    window.showToast = showToast;
    return () => {
      window.showToast = null;
    };
  }, []);

  useEffect(() => {
    // existing initialization code...

    // Synchronize EAN/QR codes between localStorage and database
    const syncItemCodes = async () => {
      try {
        // Only sync if user is logged in (to avoid authentication errors)
        const token = localStorage.getItem('token');
        if (token) {
          console.log('Starting code synchronization process...');
          const syncedItems = await codeSyncService.syncAllItemCodes();
          console.log(`Successfully synchronized ${syncedItems.length} items with the database`);
        }
      } catch (err) {
        console.error('Error during code synchronization:', err);
      }
    };
    
    // Call the sync function with a slight delay to ensure other initialization completes first
    setTimeout(syncItemCodes, 3000);
    
    // Add WebSocket listener for database changes that might require re-syncing
    const handleWebSocketMessage = (message) => {
      if (message.type === 'database_update' || message.type === 'cache_invalidation') {
        // Re-sync codes when database changes are detected
        syncItemCodes();
      }
    };
    
    // Use the subscribe method instead of addMessageListener
    let unsubscribe;
    if (webSocketService) {
      // Subscribe to 'all' events and filter in the callback
      unsubscribe = webSocketService.subscribe('all', handleWebSocketMessage);
      
      // Cleanup listener on component unmount
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    // Initialize all application services (including code synchronization)
    const cleanup = initializeServices();
    
    // Return cleanup function to be called when component unmounts
    return cleanup;
  }, []);

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Header with branding and user info */}
      <header className="text-white py-2">
        <div className="container-fluid px-3">
          <div className="d-flex align-items-center justify-content-between">
            <h1 className="h5 mb-0 d-flex align-items-center">
              <span className="text-warning me-2">IT</span>
              STOCK EUROPLAC
            </h1>
            <div className="d-flex align-items-center">
              {currentUser && (
                <>
                  <form onSubmit={handleSearch} className="d-flex me-3">
                    <div className="input-group input-group-sm">
                      <input
                        type="search"
                        className={`form-control form-control-sm ${
                          searchStatus === 'box' ? 'bg-success text-white' :
                          searchStatus === 'item' ? 'bg-primary text-white' :
                          searchStatus === 'searching' ? 'bg-warning' : ''
                        }`}
                        placeholder="Search or scan QR..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Search"
                      />
                      <button 
                        type="submit" 
                        className={`btn btn-sm ${
                          searchStatus === 'box' ? 'btn-success' :
                          searchStatus === 'item' ? 'btn-primary' :
                          searchStatus === 'searching' ? 'btn-warning' : 'btn-outline-light'
                        } d-flex align-items-center`}
                        disabled={searchStatus === 'box' || searchStatus === 'item'}
                      >
                        {searchStatus === 'searching' ? (
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        ) : searchStatus === 'box' ? (
                          <i className="bi bi-box me-1"></i>
                        ) : searchStatus === 'item' ? (
                          <i className="bi bi-list-ul me-1"></i>
                        ) : (
                          <i className="bi bi-upc-scan text-light me-1"></i>
                        )}
                        <i className="bi bi-search"></i>
                      </button>
                    </div>
                  </form>
                </>
              )}
              
              {currentUser && currentUser.role && (
                <div className="me-2">
                  <span className={`badge 
                    ${currentUser.role === 'admin' ? 'bg-danger' : 
                    currentUser.role === 'leader' ? 'bg-info' : 
                    currentUser.role === 'headworker' ? 'bg-success' : 
                    currentUser.role === 'worker' ? 'bg-primary' : 
                    currentUser.role === 'office' ? 'bg-warning text-dark' : 
                    'bg-secondary'}`}>
                    {currentUser.role === 'admin' ? 'ADMIN' : 
                     currentUser.role === 'leader' ? 'LEADER' : 
                     currentUser.role === 'headworker' ? 'HEAD WORKER' : 
                     currentUser.role === 'worker' ? 'WORKER' : 
                     currentUser.role === 'office' ? 'OFFICE' : 
                     currentUser.role.toUpperCase()}
                  </span>
                </div>
              )}
              
              {currentUser ? (
                <Dropdown>
                  <Dropdown.Toggle 
                    variant="dark" 
                    size="sm"
                    id="userMenuButton"
                    className="d-flex align-items-center"
                  >
                    <i className="bi bi-person-circle me-1"></i>
                    <span className="d-none d-md-inline">{currentUser.username}</span>
                  </Dropdown.Toggle>
                  <Dropdown.Menu variant="dark" align="end">
                    <Dropdown.ItemText className="small text-muted">Signed in as <strong>{currentUser.username}</strong></Dropdown.ItemText>
                    <Dropdown.Divider />
                    <li className="px-3 py-1">
                      <OfflineModeToggle />
                    </li>
                    <Dropdown.Divider />
                    <Dropdown.Item 
                      className="small"
                      onClick={logout}
                    >
                      <i className="bi bi-box-arrow-right me-1"></i>
                      LOGOUT
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <div>
                  <Link to="/login" className="btn btn-sm btn-outline-light me-2">Login</Link>
                  <Link to="/register" className="btn btn-sm btn-outline-light">Register</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main navigation bar */}
      {currentUser && (
        <Navbar bg="dark" variant="dark" expand="lg" className="py-1 sticky-top">
          <Container fluid className="px-3">
            <Navbar.Toggle aria-controls="navbarNav" />
            <Navbar.Collapse id="navbarNav">
              <Nav className="me-auto">
                <Nav.Item>
                  <Nav.Link as={Link} to="/" className="py-1 small">
                    <i className="bi bi-clipboard-check me-1"></i>INVENTORY
                  </Nav.Link>
                </Nav.Item>
                
                {/* Direct links */}
                <Nav.Item>
                  <Nav.Link as={Link} to="/boxes" className="py-1 small">
                    <i className="bi bi-box me-1"></i>BOXES
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link as={Link} to="/items" className="py-1 small">
                    <i className="bi bi-list-ul me-1"></i>ITEMS
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link as={Link} to="/transactions" className="py-1 small">
                    <i className="bi bi-clock-history me-1"></i>TRANSACTIONS
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link as={Link} to="/stock" className="py-1 small">
                    <i className="bi bi-box-seam me-1"></i>STOCK MANAGEMENT
                  </Nav.Link>
                </Nav.Item>
                
                {/* Management dropdown, admin only */}
                {currentUser.role === 'admin' && (
                  <Dropdown as={Nav.Item}>
                    <Dropdown.Toggle as={Nav.Link} id="managementDropdown" className="py-1 small">
                      <i className="bi bi-gear me-1"></i>MANAGEMENT
                    </Dropdown.Toggle>
                    <Dropdown.Menu variant="dark">
                      <Dropdown.Item 
                        as={Link} 
                        to="/customers"
                        className="small"
                      >
                        <i className="bi bi-people me-1"></i>CUSTOMERS
                      </Dropdown.Item>
                      <Dropdown.Item 
                        as={Link} 
                        to="/groups"
                        className="small"
                      >
                        <i className="bi bi-diagram-3 me-1"></i>GROUPS
                      </Dropdown.Item>
                      <Dropdown.Item 
                        as={Link} 
                        to="/roles"
                        className="small"
                      >
                        <i className="bi bi-person-badge me-1"></i>ROLES
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                )}
                
                {/* Admin link, admin only */}
                {currentUser.role === 'admin' && (
                  <Nav.Item>
                    <Nav.Link as={Link} to="/admin" className="py-1 small">
                      <i className="bi bi-shield-lock me-1"></i>ADMIN
                    </Nav.Link>
                  </Nav.Item>
                )}
              </Nav>
              
              {/* Spacer to push user menu to the right */}
              <div className="ms-auto">
                <ButtonGroup>
                  <Button 
                    variant="success" 
                    size="sm"
                    className="me-2"
                    onClick={() => setShowStockInModal(true)}
                  >
                    <i className="bi bi-box-arrow-in-down me-1"></i>
                    STOCK IN
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => setShowStockOutModal(true)}
                  >
                    <i className="bi bi-box-arrow-up-right me-1"></i>
                    STOCK OUT
                  </Button>
                </ButtonGroup>
              </div>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      )}

      {/* Main Content */}
      <main className="container-fluid flex-grow-1 py-3 px-3">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Box detail route accessible without login */}
          <Route path="/box/:id" element={<BoxDetail />} />
          <Route path="/boxes/:id" element={<BoxDetail />} />
          
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/boxes" element={<BoxList />} />
            <Route path="/box/new" element={<BoxForm />} />
            <Route path="/box/:id/edit" element={<BoxForm />} />
            <Route path="/items" element={<ItemList />} />
            <Route path="/items/new" element={<ItemForm />} />
            <Route path="/items/edit/:id" element={<ItemForm />} />
            <Route path="/print-labels" element={<PrintLabels />} />
            <Route path="/transactions" element={<TransactionPage />} />
            <Route path="/stock" element={<StockManagement />} />
          </Route>
          
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/groups" element={<GroupList />} />
            <Route path="/removal-reasons" element={<RemovalReasonManagement />} />
            <Route path="/roles" element={<RoleList />} />
          </Route>
        </Routes>
      </main>

      {/* Stock In/Out Modals for the header buttons */}
      <StockInModal 
        show={showStockInModal}
        handleClose={() => {
          setShowStockInModal(false);
          setStockInItemId(null);
          setStockInBoxId(null);
        }}
        onSuccess={handleStockInSuccess}
        preselectedItemId={stockInItemId}
        preselectedBoxId={stockInBoxId}
      />
      
      <StockOutModal 
        show={showStockOutModal}
        handleClose={() => {
          setShowStockOutModal(false);
          setStockOutItemId(null);
          setStockOutBoxId(null);
        }}
        onSuccess={handleStockOutSuccess}
        preselectedItemId={stockOutItemId}
        preselectedBoxId={stockOutBoxId}
      />

      {/* Offline Status Bar */}
      <OfflineStatusBar />

      {/* Quick Scan Button */}
      {currentUser && <QuickScanButton />}

      {/* Footer - Minimalistic */}
      <footer className="text-center py-2 mt-auto">
        <small className="text-muted">POWERED BY IT EUROPLAC</small>
      </footer>

      {/* Global Toast Notification System */}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        <Toast 
          show={toast.show} 
          onClose={() => setToast({ ...toast, show: false })}
          delay={3000}
          autohide
          bg={toast.type}
        >
          <Toast.Header>
            <strong className="me-auto">
              {toast.type === 'danger' ? 'Error' : 
               toast.type === 'success' ? 'Success' :
               toast.type === 'warning' ? 'Warning' : 'Information'}
            </strong>
          </Toast.Header>
          <Toast.Body className={toast.type === 'dark' ? 'text-white' : ''}>
            {toast.message}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Item/Box choice dialog */}
      <Modal show={choiceDialog.show} onHide={() => setChoiceDialog({ show: false, box: null, item: null })}>
        <Modal.Header closeButton>
          <Modal.Title>Multiple Results Found</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {choiceDialog.item && choiceDialog.box ? (
            <>
              <p>The number matches both a Box and an Item. Which would you like to open?</p>
              <div className="mb-3">
                <Button variant="primary" className="me-2" onClick={() => {
                  setChoiceDialog({ show: false, box: null, item: null });
                  navigate(`/items?search=id:${choiceDialog.item.id}`);
                }}>
                  <i className="bi bi-list-ul me-1"></i> Item: {choiceDialog.item.name || choiceDialog.item.id}
                </Button>
                <Button variant="success" onClick={() => {
                  setChoiceDialog({ show: false, box: null, item: null });
                  navigate(`/box/${choiceDialog.box.id}`);
                }}>
                  <i className="bi bi-box me-1"></i> Box: {choiceDialog.box.box_number || choiceDialog.box.id}
                </Button>
              </div>
            </>
          ) : (
            <p>Loading options...</p>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary 
      errorMessage="An unexpected error occurred in the application."
      showErrorDetails={process.env.NODE_ENV === 'development'}
    >
      <AuthProvider>
        <ApiServiceProvider>
          <AppContent />
        </ApiServiceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App; 