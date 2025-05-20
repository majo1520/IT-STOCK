import React, { useState } from 'react';
import { Tab, Nav, Form, InputGroup, Button } from 'react-bootstrap';
import TransactionHistory from './TransactionHistory';

function TransactionPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [itemSearch, setItemSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    setActiveSearch(itemSearch);
  };

  const clearSearch = () => {
    setItemSearch('');
    setActiveSearch('');
  };

  return (
    <div className="py-3">
      <div className="mb-4 bg-white p-3 rounded shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center">
          <div className="d-flex align-items-center mb-3 mb-md-0">
            <i className="bi bi-clock-history fs-2 me-3 text-primary"></i>
            <div>
              <h1 className="h3 mb-0 text-dark">Inventory Transactions</h1>
              <p className="text-muted mb-0">View and manage stock in, stock out, and transfer records</p>
            </div>
          </div>
          
          <Form className="d-flex" onSubmit={handleSearch}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Search item by name or ID"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                aria-label="Search items"
              />
              {activeSearch && (
                <Button 
                  variant="outline-secondary" 
                  onClick={clearSearch}
                  title="Clear search"
                >
                  <i className="bi bi-x"></i>
                </Button>
              )}
              <Button type="submit" variant="primary">
                <i className="bi bi-search me-1"></i>
                Search
              </Button>
            </InputGroup>
          </Form>
        </div>
        {activeSearch && (
          <div className="mt-2 text-primary">
            <i className="bi bi-filter-circle-fill me-1"></i>
            Showing transactions for item: <strong>{activeSearch}</strong>
          </div>
        )}
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white">
          <Nav variant="tabs" className="card-header-tabs" activeKey={activeTab} onSelect={setActiveTab}>
            <Nav.Item>
              <Nav.Link eventKey="all" className="text-dark fw-bold">ALL TRANSACTIONS</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="stockIn" className="text-dark">
                <i className="bi bi-box-arrow-in-down me-1"></i>
                STOCK IN
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="stockOut" className="text-dark">
                <i className="bi bi-box-arrow-up-right me-1"></i>
                STOCK OUT
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="transfers" className="text-dark">
                <i className="bi bi-arrow-left-right me-1"></i>
                TRANSFERS
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="deletions" className="text-dark">
                <i className="bi bi-trash me-1"></i>
                DELETIONS
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className="card-body p-0 bg-white">
          <Tab.Content>
            <Tab.Pane eventKey="all" active={activeTab === 'all'}>
              <TransactionHistory filter="all" key={`transaction-all-${activeSearch}`} itemFilter={activeSearch} />
            </Tab.Pane>
            <Tab.Pane eventKey="stockIn" active={activeTab === 'stockIn'}>
              <TransactionHistory filter="in" key={`transaction-in-${activeSearch}`} itemFilter={activeSearch} />
            </Tab.Pane>
            <Tab.Pane eventKey="stockOut" active={activeTab === 'stockOut'}>
              <TransactionHistory filter="out" key={`transaction-out-${activeSearch}`} itemFilter={activeSearch} />
            </Tab.Pane>
            <Tab.Pane eventKey="transfers" active={activeTab === 'transfers'}>
              <TransactionHistory filter="transfer" key={`transaction-transfer-${activeSearch}`} itemFilter={activeSearch} />
            </Tab.Pane>
            <Tab.Pane eventKey="deletions" active={activeTab === 'deletions'}>
              <TransactionHistory filter="delete" key={`transaction-delete-${activeSearch}`} itemFilter={activeSearch} />
            </Tab.Pane>
          </Tab.Content>
        </div>
      </div>
    </div>
  );
}

export default TransactionPage; 