/**
 * Enhanced API Service
 * 
 * Provides API functions with offline support, caching, and retry mechanisms
 */

import axios from 'axios';
import * as originalApi from './api'; // Import all named exports from api.js
import offlineStore from './offline-store';
import networkStatus from './network-status';
import syncService from './sync-service';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Start with 1 second delay

// Create a wrapper around the original API
const enhancedApi = {
  // Retry mechanism for API calls
  async withRetry(apiCall, retries = MAX_RETRIES) {
    try {
      return await apiCall();
    } catch (error) {
      if (
        retries > 0 && 
        error.response && 
        [408, 429, 500, 502, 503, 504].includes(error.response.status)
      ) {
        // Exponential backoff with jitter
        const delay = RETRY_DELAY * Math.pow(2, MAX_RETRIES - retries) * (0.8 + Math.random() * 0.4);
        
        console.log(`API call failed. Retrying in ${Math.round(delay / 1000)}s... (${retries} retries left)`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(apiCall, retries - 1);
      }
      
      // If offline or max retries reached, throw error
      throw error;
    }
  },
  
  // Get items with offline support
  async getItems(boxId = null, search = null, sortOptions = null, parentId = null, timestamp = null, headers = null) {
    try {
      // Skip cache for ALL BOXES view or when timestamp is provided (forcing fresh data)
      const skipCache = !boxId || timestamp;
      
      // Generate a cache key
      const cacheKey = `/api/items?box_id=${boxId || ''}&search=${search || ''}&sort=${sortOptions?.sort || ''}&direction=${sortOptions?.direction || ''}&parent_id=${parentId || ''}&ts=${timestamp || ''}`;
      
      // Try to get from cache first (but skip for ALL BOXES view)
      if (!skipCache) {
        const cachedItems = await offlineStore.getCachedApiResponse(cacheKey);
        
        if (cachedItems) {
          console.log('Using cached items data for specific box view');
          return { data: cachedItems };
        }
      } else {
        console.log('Skipping cache for ALL BOXES view or forced refresh');
      }
      
      // If online, fetch from API and cache
      if (networkStatus.isOnline()) {
        // Pass timestamp and headers to the original API to ensure fresh data
        const response = await this.withRetry(() => originalApi.getItems(
          boxId, 
          search, 
          sortOptions || {}, // Ensure sortOptions is at least an empty object
          parentId,
          timestamp || new Date().getTime(), // Always include timestamp for freshness
          headers || { 
            headers: { 
              'X-Force-Fresh': 'true',
              'X-Skip-Cache': skipCache ? 'true' : 'false'
            }
          }
        ));
        
        if (response && response.data) {
          // Store items in offline store
          await Promise.all(response.data.map(item => offlineStore.put('items', item)));
          
          // Only cache API response if not ALL BOXES view (to avoid outdated data)
          if (!skipCache) {
            await offlineStore.cacheApiResponse(cacheKey, response.data, 10); // 10 min cache for specific box views
          }
        }
        
        return response;
      }
      
      // If offline, get from IndexedDB
      let items = [];
      
      if (boxId) {
        // Filter by box_id
        items = await offlineStore.getByIndex('items', 'box_id', parseInt(boxId, 10));
      } else {
        // Get all items
        items = await offlineStore.getAll('items');
      }
      
      // Apply client-side filters
      if (search) {
        const searchLower = search.toLowerCase();
        const isNumericSearch = /^\d+$/.test(search);
        
        items = items.filter(item => 
          // Regular text search
          item.name?.toLowerCase().includes(searchLower) || 
          item.description?.toLowerCase().includes(searchLower) ||
          item.serial_number?.toLowerCase().includes(searchLower) ||
          
          // For numeric searches, do more aggressive matching on item names and properties
          (isNumericSearch && (
            // Direct number match in the name or with spaces/separators around it
            (item.name && (
              item.name.indexOf(search) >= 0 ||
              // Also try to match with spaces or separators (like 123-456)
              item.name.replace(/[-_\s]/g, '').indexOf(search) >= 0
            )) ||
            
            // Extended search in EAN code or serial number
            (item.ean_code && item.ean_code.includes(search)) ||
            (item.serial_number && item.serial_number.includes(search)) ||
            
            // Also check if item ID contains the number
            (item.id && item.id.toString().includes(search))
          ))
        );
      }
      
      if (parentId) {
        items = items.filter(item => item.parent_item_id === parseInt(parentId, 10));
      }
      
      // Apply sorting
      if (sortOptions && sortOptions.sort) {
        const direction = sortOptions.direction === 'desc' ? -1 : 1;
        items.sort((a, b) => {
          const aVal = a[sortOptions.sort] || '';
          const bVal = b[sortOptions.sort] || '';
          return direction * (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
        });
      }
      
      console.log('Using offline items data');
      return { data: items };
    } catch (error) {
      console.error('Error fetching items:', error);
      
      // Last resort - return empty array
      return { data: [] };
    }
  },
  
  // Get item by ID with offline support
  async getItemById(id) {
    try {
      // If it's a new item, return empty template
      if (id === 'new' || isNaN(parseInt(id))) {
        console.log(`Invalid item ID: ${id}. Returning empty item.`);
        return { 
          data: { 
            id: null, 
            name: '', 
            description: '', 
            quantity: 1, 
            box_id: null,
            parent_item_id: null,
            type: '',
            ean_code: '',
            serial_number: ''
          } 
        };
      }
      
      // Try to get from offline store first
      const offlineItem = await offlineStore.get('items', parseInt(id, 10));
      
      // If online, fetch from API
      if (networkStatus.isOnline()) {
        try {
          const response = await this.withRetry(() => originalApi.getItemById(id));
          
          if (response && response.data) {
            // Update offline store
            await offlineStore.put('items', response.data);
            return response;
          }
        } catch (error) {
          console.error('Error fetching item from API:', error);
          // If API call failed but we have offline data, use that
          if (offlineItem) {
            return { data: offlineItem };
          }
          throw error;
        }
      }
      
      // If offline or API failed, use offline item if available
      if (offlineItem) {
        console.log('Using offline item data');
        return { data: offlineItem };
      }
      
      throw new Error(`Item not found: ${id}`);
    } catch (error) {
      console.error('Error fetching item:', error);
      throw error;
    }
  },
  
  // Create item with offline support
  async createItem(itemData) {
    try {
      // If online, create directly
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.createItem(itemData));
        
        if (response && response.data) {
          // Store in offline store
          await offlineStore.put('items', response.data);
        }
        
        return response;
      }
      
      // If offline, create a temporary ID and store operation for later sync
      const tempId = `temp_${Date.now()}`;
      const tempItem = {
        ...itemData,
        id: tempId,
        _offline_created: true,
        created_at: new Date().toISOString()
      };
      
      // Store in offline store
      await offlineStore.put('items', tempItem);
      
      // Add to pending operations
      await syncService.addOperation('CREATE_ITEM', itemData);
      
      return { data: tempItem };
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  },
  
  // Update item with offline support
  async updateItem(id, itemData) {
    try {
      // Handle temp IDs
      if (typeof id === 'string' && id.startsWith('temp_')) {
        // The item was created offline and not yet synced
        const tempItem = {
          ...itemData,
          id,
          _offline_updated: true,
          updated_at: new Date().toISOString()
        };
        
        // Update in offline store
        await offlineStore.put('items', tempItem);
        
        return { data: tempItem };
      }
      
      // If online, update directly
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.updateItem(id, itemData));
        
        if (response && response.data) {
          // Update in offline store
          await offlineStore.put('items', response.data);
        }
        
        return response;
      }
      
      // If offline, update locally and queue sync
      const existingItem = await offlineStore.get('items', parseInt(id, 10));
      
      if (!existingItem) {
        throw new Error(`Item not found: ${id}`);
      }
      
      const updatedItem = {
        ...existingItem,
        ...itemData,
        _offline_updated: true,
        updated_at: new Date().toISOString()
      };
      
      // Update in offline store
      await offlineStore.put('items', updatedItem);
      
      // Add to pending operations
      await syncService.addOperation('UPDATE_ITEM', updatedItem);
      
      return { data: updatedItem };
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  },
  
  // Stock operations with offline support
  async stockIn(itemData) {
    try {
      // If online, process directly
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.stockIn(itemData));
        
        if (response && response.data) {
          // Update offline store if needed
          if (response.data.id) {
            const item = await offlineStore.get('items', response.data.id);
            if (item) {
              // Update quantity
              item.quantity = (item.quantity || 0) + (itemData.quantity || 0);
              await offlineStore.put('items', item);
            }
          }
        }
        
        return response;
      }
      
      // If offline, update locally and queue sync
      let item;
      
      if (itemData.item_id) {
        // Existing item
        item = await offlineStore.get('items', parseInt(itemData.item_id, 10));
        
        if (!item) {
          throw new Error(`Item not found: ${itemData.item_id}`);
        }
        
        // Update quantity
        item.quantity = (item.quantity || 0) + (itemData.quantity || 0);
        item._offline_updated = true;
        item.updated_at = new Date().toISOString();
        
        // Update in offline store
        await offlineStore.put('items', item);
      } else {
        // New item
        const tempId = `temp_${Date.now()}`;
        item = {
          ...itemData,
          name: itemData.item_name,
          id: tempId,
          quantity: itemData.quantity || 1,
          _offline_created: true,
          created_at: new Date().toISOString()
        };
        
        // Store in offline store
        await offlineStore.put('items', item);
      }
      
      // Add to pending operations
      await syncService.addOperation('STOCK_IN', itemData);
      
      // Record transaction
      const transaction = {
        id: `temp_trans_${Date.now()}`,
        item_id: item.id,
        item_name: item.name,
        type: 'in',
        quantity: itemData.quantity,
        previous_quantity: (item.quantity || 0) - (itemData.quantity || 0),
        new_quantity: item.quantity,
        box_id: item.box_id,
        notes: itemData.notes || 'Stock added (offline)',
        transaction_type: 'STOCK_IN',
        created_at: new Date().toISOString(),
        _offline_created: true
      };
      
      await offlineStore.put('transactions', transaction);
      
      return { data: { id: item.id, message: 'Stock added (offline)' } };
    } catch (error) {
      console.error('Error processing stock in:', error);
      throw error;
    }
  },
  
  async stockOut(itemId, data) {
    try {
      // If online, process directly
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.stockOut(itemId, data));
        
        if (response && response.data) {
          // Update offline store
          const item = await offlineStore.get('items', parseInt(itemId, 10));
          if (item) {
            // Update quantity (ensure it doesn't go below zero)
            item.quantity = Math.max(0, (item.quantity || 0) - (data.quantity || 0));
            await offlineStore.put('items', item);
          }
        }
        
        return response;
      }
      
      // If offline, update locally and queue sync
      const item = await offlineStore.get('items', parseInt(itemId, 10));
      
      if (!item) {
        throw new Error(`Item not found: ${itemId}`);
      }
      
      const previousQuantity = item.quantity || 0;
      // Ensure quantity doesn't go below zero
      item.quantity = Math.max(0, previousQuantity - (data.quantity || 0));
      item._offline_updated = true;
      item.updated_at = new Date().toISOString();
      
      // Update in offline store
      await offlineStore.put('items', item);
      
      // Add to pending operations
      await syncService.addOperation('STOCK_OUT', { id: itemId, ...data });
      
      // Record transaction
      const transaction = {
        id: `temp_trans_${Date.now()}`,
        item_id: item.id,
        item_name: item.name,
        type: 'out',
        quantity: data.quantity,
        previous_quantity: previousQuantity,
        new_quantity: item.quantity,
        box_id: item.box_id,
        notes: data.notes || 'Stock removed (offline)',
        transaction_type: 'STOCK_OUT',
        created_at: new Date().toISOString(),
        _offline_created: true
      };
      
      await offlineStore.put('transactions', transaction);
      
      return { data: { id: item.id, message: 'Stock removed (offline)' } };
    } catch (error) {
      console.error('Error processing stock out:', error);
      throw error;
    }
  },
  
  // Get stock history with offline support
  async getStockHistory(itemId = null, type = null, startDate = null, endDate = null, customerId = null) {
    try {
      // Generate a cache key
      const cacheKey = `/api/transactions?item_id=${itemId || ''}&type=${type || ''}&start_date=${startDate || ''}&end_date=${endDate || ''}&customer_id=${customerId || ''}`;
      
      // Try to get from cache first
      const cachedHistory = await offlineStore.getCachedApiResponse(cacheKey);
      
      if (cachedHistory) {
        console.log('Using cached stock history');
        return { data: cachedHistory };
      }
      
      // If online, fetch from API and cache
      if (networkStatus.isOnline()) {
        try {
          const response = await this.withRetry(() => 
            originalApi.getStockHistory(itemId, type, startDate, endDate, customerId)
          );
          
          if (response && response.data) {
            // Cache API response
            await offlineStore.cacheApiResponse(cacheKey, response.data, 15); // 15 min cache
            
            // Store transactions
            await Promise.all(response.data.map(transaction => 
              offlineStore.put('transactions', transaction)
            ));
          }
          
          return response;
        } catch (error) {
          console.error('Error fetching stock history from API:', error);
          // Fall through to use offline data
        }
      }
      
      // If offline or API failed, get from offline store
      let transactions = await offlineStore.getAll('transactions');
      
      // Apply filters
      if (itemId) {
        transactions = transactions.filter(t => String(t.item_id) === String(itemId));
      }
      
      if (type) {
        transactions = transactions.filter(t => t.type === type);
      }
      
      if (startDate) {
        const startDateObj = new Date(startDate);
        transactions = transactions.filter(t => new Date(t.created_at) >= startDateObj);
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        transactions = transactions.filter(t => new Date(t.created_at) <= endDateObj);
      }
      
      if (customerId) {
        transactions = transactions.filter(t => 
          String(t.customer_id) === String(customerId) || 
          (t.customer_info && String(t.customer_info.id) === String(customerId))
        );
      }
      
      // Sort by date descending
      transactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      console.log('Using offline stock history data');
      return { data: transactions };
    } catch (error) {
      console.error('Error fetching stock history:', error);
      return { data: [] };
    }
  },
  
  // Delete item with offline support
  async deleteItem(id) {
    try {
      // If it's a temp ID (created offline), just remove it
      if (typeof id === 'string' && id.startsWith('temp_')) {
        await offlineStore.delete('items', id);
        return { data: { success: true } };
      }
      
      // If online, delete directly
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.deleteItem(id));
        
        // Remove from offline store
        await offlineStore.delete('items', parseInt(id, 10));
        
        return response;
      }
      
      // If offline, mark as deleted and queue sync
      const item = await offlineStore.get('items', parseInt(id, 10));
      
      if (!item) {
        throw new Error(`Item not found: ${id}`);
      }
      
      // Mark as deleted in offline store (we don't actually delete it until synced)
      item._offline_deleted = true;
      item.updated_at = new Date().toISOString();
      await offlineStore.put('items', item);
      
      // Add to pending operations
      await syncService.addOperation('DELETE_ITEM', { id });
      
      return { data: { success: true, message: 'Item deleted (offline)' } };
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  // Get boxes with offline support
  async getBoxes() {
    try {
      // Generate a cache key
      const cacheKey = `/api/boxes`;
      
      // Try to get from cache first
      const cachedBoxes = await offlineStore.getCachedApiResponse(cacheKey);
      
      if (cachedBoxes) {
        console.log('Using cached boxes data');
        return { data: cachedBoxes };
      }
      
      // If online, fetch from API and cache
      if (networkStatus.isOnline()) {
        const response = await this.withRetry(() => originalApi.getBoxes());
        
        if (response && response.data) {
          // Store boxes in offline store
          await Promise.all(response.data.map(box => offlineStore.put('boxes', box)));
          
          // Cache API response
          await offlineStore.cacheApiResponse(cacheKey, response.data, 60); // 60 min cache
        }
        
        return response;
      }
      
      // If offline, get from IndexedDB
      const boxes = await offlineStore.getAll('boxes');
      
      console.log('Using offline boxes data');
      return { data: boxes };
    } catch (error) {
      console.error('Error fetching boxes:', error);
      
      // Last resort - return empty array
      return { data: [] };
    }
  },

  // Get box by ID with offline support
  async getBoxById(id) {
    try {
      // If it's a new box, return empty template
      if (id === 'new' || isNaN(parseInt(id))) {
        console.log(`Invalid box ID: ${id}. Returning empty box.`);
        return { 
          data: { 
            id: null, 
            box_number: '', 
            description: '', 
            serial_number: '', 
            shelf_id: null, 
            location_id: null 
          } 
        };
      }
      
      // Try to get from offline store first
      const offlineBox = await offlineStore.get('boxes', parseInt(id, 10));
      
      // If online, fetch from API
      if (networkStatus.isOnline()) {
        try {
          const response = await this.withRetry(() => originalApi.getBoxById(id));
          
          if (response && response.data) {
            // Update offline store
            await offlineStore.put('boxes', response.data);
            return response;
          }
        } catch (error) {
          console.error('Error fetching box from API:', error);
          // If API call failed but we have offline data, use that
          if (offlineBox) {
            return { data: offlineBox };
          }
          throw error;
        }
      }
      
      // If offline or API failed, use offline box if available
      if (offlineBox) {
        console.log('Using offline box data');
        return { data: offlineBox };
      }
      
      throw new Error(`Box not found: ${id}`);
    } catch (error) {
      console.error('Error fetching box:', error);
      throw error;
    }
  }
};

// Add all other methods from original API
Object.keys(originalApi).forEach(key => {
  if (typeof originalApi[key] === 'function' && !enhancedApi[key]) {
    enhancedApi[key] = async (...args) => {
      try {
        if (networkStatus.isOnline()) {
          return await enhancedApi.withRetry(() => originalApi[key](...args));
        } else {
          throw new Error('Network unavailable');
        }
      } catch (error) {
        console.error(`Error in ${key}:`, error);
        throw error;
      }
    };
  }
});

export default enhancedApi; 