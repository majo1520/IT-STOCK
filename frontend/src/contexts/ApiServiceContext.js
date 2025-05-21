import React, { createContext, useContext, useState, useEffect } from 'react';
import originalApi from '../services/api';
import enhancedApi from '../services/enhanced-api';

// Create context
const ApiServiceContext = createContext();

// Context provider 
export const ApiServiceProvider = ({ children }) => {
  const [isOfflineEnabled, setIsOfflineEnabled] = useState(() => {
    const storedPreference = localStorage.getItem('offline_mode_enabled');
    return storedPreference !== null ? storedPreference === 'true' : true; // Default to enabled
  });

  // Determine which API service to use
  const api = isOfflineEnabled ? enhancedApi : originalApi;

  // Save preference to localStorage when changed
  useEffect(() => {
    localStorage.setItem('offline_mode_enabled', isOfflineEnabled.toString());
  }, [isOfflineEnabled]);

  // Toggle offline mode
  const toggleOfflineMode = () => {
    setIsOfflineEnabled(prev => !prev);
  };

  return (
    <ApiServiceContext.Provider value={{ api, isOfflineEnabled, toggleOfflineMode }}>
      {children}
    </ApiServiceContext.Provider>
  );
};

// Custom hook to use the API service
export const useApi = () => {
  const context = useContext(ApiServiceContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiServiceProvider');
  }
  return context;
};

export default ApiServiceContext; 