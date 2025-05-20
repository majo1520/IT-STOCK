/**
 * Sync Service
 * 
 * Handles synchronization of offline operations with the server
 */

import offlineStore from './offline-store';
import networkStatus from './network-status';
import api from './api';

class SyncService {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = null;
    this.maxRetries = 5;
    this.retryDelay = 60000; // 1 minute
    this.syncErrors = [];
    
    // Listen for network status changes
    networkStatus.addListener(isOnline => {
      if (isOnline && !this.isSyncing) {
        this.sync();
      }
    });
    
    // Set up periodic sync
    this.startPeriodicSync();
  }
  
  // Start periodic sync
  startPeriodicSync() {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Set up new interval (every 5 minutes)
    this.syncInterval = setInterval(() => {
      if (networkStatus.isOnline() && !this.isSyncing) {
        this.sync();
      }
    }, 5 * 60 * 1000);
  }
  
  // Stop periodic sync
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  // Sync all pending operations
  async sync() {
    if (this.isSyncing || !networkStatus.isOnline()) return;
    
    this.isSyncing = true;
    this.syncErrors = [];
    
    try {
      const pendingOperations = await offlineStore.getPendingOperations();
      
      if (pendingOperations.length === 0) {
        this.isSyncing = false;
        return;
      }
      
      console.log(`Syncing ${pendingOperations.length} pending operations`);
      
      // Process operations in order
      for (const operation of pendingOperations) {
        await this.processOperation(operation);
      }
    } catch (error) {
      console.error('Error during sync:', error);
      this.syncErrors.push({ 
        message: 'General sync error', 
        error: error.toString(),
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isSyncing = false;
    }
  }
  
  // Process a single operation
  async processOperation(operation) {
    try {
      // Skip if max retries reached
      if (operation.retries >= this.maxRetries) {
        await offlineStore.updatePendingOperation(operation.id, {
          status: 'failed',
          error: 'Max retries reached'
        });
        return;
      }
      
      const { operation: operationType, data } = operation;
      let result;
      
      switch (operationType) {
        case 'CREATE_ITEM':
          result = await api.createItem(data);
          break;
        case 'UPDATE_ITEM':
          result = await api.updateItem(data.id, data);
          break;
        case 'DELETE_ITEM':
          result = await api.deleteItem(data.id);
          break;
        case 'STOCK_IN':
          result = await api.stockIn(data);
          break;
        case 'STOCK_OUT':
          result = await api.stockOut(data.id, data);
          break;
        case 'TRANSFER_ITEM':
          result = await api.transferItem(data.id, data);
          break;
        case 'CUSTOMER_TRANSACTION':
          result = await api.createCustomerTransaction(data.customer_id, data);
          break;
        default:
          throw new Error(`Unknown operation type: ${operationType}`);
      }
      
      // If successful, mark as completed
      await offlineStore.updatePendingOperation(operation.id, {
        status: 'completed',
        result: result.data,
        completedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error processing operation ${operation.id}:`, error);
      
      // Increment retry count
      const retries = (operation.retries || 0) + 1;
      const nextRetry = new Date(Date.now() + this.retryDelay * retries);
      
      await offlineStore.updatePendingOperation(operation.id, {
        retries,
        status: retries >= this.maxRetries ? 'failed' : 'pending',
        lastError: error.toString(),
        nextRetry: nextRetry.toISOString()
      });
      
      this.syncErrors.push({
        operationId: operation.id,
        operationType: operation.operation,
        message: `Failed to process operation: ${error.message || error}`,
        retries,
        data: operation.data
      });
    }
  }
  
  // Add new operation for offline processing
  async addOperation(operationType, data) {
    const operationId = await offlineStore.addPendingOperation(operationType, data);
    
    // Try to sync immediately if online
    if (networkStatus.isOnline() && !this.isSyncing) {
      setTimeout(() => this.sync(), 100);
    }
    
    return operationId;
  }
  
  // Get sync status
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      errors: this.syncErrors
    };
  }
  
  // Force sync
  forceSync() {
    if (!this.isSyncing) {
      return this.sync();
    }
    return Promise.resolve(false);
  }
  
  // Clean up resources
  destroy() {
    this.stopPeriodicSync();
  }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService; 