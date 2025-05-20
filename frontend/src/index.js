import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/globalStyles.css'; // Import global styles with Roboto font and rounded corners
import App from './App';
// Import our debug utilities
import { debugTransactions } from './debug';

const container = document.getElementById('root');
const root = createRoot(container);

// Make debug functions available to the global scope
window.debug = {
  transactions: debugTransactions
};

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
); 