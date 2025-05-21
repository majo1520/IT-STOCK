// initService.js - Application initialization services
import webSocketService from './webSocketService';
import codeSyncService from './codeSync';

/**
 * Initialize EAN/QR code synchronization between localStorage and database
 */
const initCodeSync = () => {
  console.log('Initializing EAN/QR code synchronization service...');

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

  let unsubscribe;
  if (webSocketService) {
    // Use subscribe method instead of addMessageListener
    unsubscribe = webSocketService.subscribe('all', handleWebSocketMessage);
    console.log('Added WebSocket listener for database changes');
    
    // Return cleanup function for component unmount
    return () => {
      if (unsubscribe) unsubscribe();
      console.log('Removed WebSocket listener for database changes');
    };
  }
  
  return () => {}; // Empty cleanup function if websocket service isn't available
};

/**
 * Initialize all application services
 */
const initializeServices = () => {
  console.log('Initializing application services...');
  
  // Initialize code synchronization
  const cleanupCodeSync = initCodeSync();
  
  // Return a unified cleanup function
  return () => {
    cleanupCodeSync();
  };
};

export default initializeServices; 