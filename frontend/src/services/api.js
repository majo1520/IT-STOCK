import axios from 'axios';
import webSocketService from './webSocketService';

// Dynamically determine if we're using the direct API URL or the proxied one
// When using Vite development server, we can use the proxy
// When deployed, we'll use the direct URL
const isLocalDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocalDevelopment ? '/api' : window.location.origin + '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add cache control to prevent caching
api.interceptors.request.use(
  config => {
    // Add cache control headers to prevent browser caching
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    
    // Add authorization header for authenticated requests
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Cache storage for API responses
const apiCache = new Map();

// Method to clear cache for a specific endpoint or all cache
api.clearCache = (endpoint = null) => {
  if (endpoint) {
    // Clear specific endpoint cache
    for (const key of apiCache.keys()) {
      if (key.includes(endpoint)) {
        apiCache.delete(key);
      }
    }
    console.log(`Cleared cache for endpoint: ${endpoint}`);
  } else {
    // Clear all cache
    apiCache.clear();
    console.log('Cleared all API cache');
  }
  
  // Additionally clear browser cache for items-related endpoints
  if (!endpoint || endpoint.includes('items') || endpoint === '/') {
    // Set session storage flag to indicate cache was cleared
    sessionStorage.setItem('cache_cleared_at', new Date().toISOString());
    
    try {
      // Try to clear localStorage cache for items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('item_') || 
          key.includes('Items') || 
          key.includes('items') || 
          key.includes('Cache')
        )) {
          keysToRemove.push(key);
        }
      }
      
      // Remove the keys in a separate loop to avoid index shifting issues
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.error('Error clearing localStorage cache:', e);
    }
  }
};

// Add cache-busting headers to all API requests
const addCacheBustingHeaders = (config = {}) => {
  const timestamp = new Date().getTime();
  return {
    ...config,
    headers: {
      ...config.headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Bust': timestamp
    }
  };
};

// Authentication API functions
export const register = (userData) => {
  return api.post('/auth/register', userData);
};

export const login = (credentials) => {
  return api.post('/auth/login', credentials);
};

export const getCurrentUser = () => {
  return api.get('/auth/me');
};

// Box API functions
export const getBoxes = () => {
  return api.get('/boxes');
};

export const getBoxById = (id) => {
  // Handle non-numeric IDs to prevent server errors
  if (id === 'new' || isNaN(parseInt(id))) {
    console.log(`Invalid box ID: ${id}. Returning empty box.`);
    return Promise.resolve({ 
      data: { 
        id: null, 
        box_number: '', 
        description: '', 
        serial_number: '', 
        shelf_id: null, 
        location_id: null 
      } 
    });
  }
  return api.get(`/boxes/${id}`);
};

export const createBox = (boxData) => {
  return api.post('/boxes', boxData);
};

export const updateBox = (id, boxData) => {
  return api.put(`/boxes/${id}`, boxData);
};

export const deleteBox = (id) => {
  return api.delete(`/boxes/${id}`);
};

export const getBoxTransactions = (id) => {
  // Use the server API endpoint instead of localStorage
  return api.get(`/boxes/${id}/transactions`);
};

// Item API functions
export const getItems = (boxId = null, search = null, sortOptions = {}, parentId = null, timestamp = null, extraHeaders = null, timeout = null) => {
  const params = new URLSearchParams();
  
  if (boxId) params.append('box_id', boxId);
  
  // Special handling for numeric search terms
  const isNumericSearch = search && /^\d+$/.test(search);
  if (search) {
    params.append('search', search);
    if (isNumericSearch) {
      // Add a flag for backend to know this is a numeric search
      params.append('numeric_search', 'true');
    }
  }
  
  if (sortOptions && sortOptions.sort) params.append('sort', sortOptions.sort);
  if (sortOptions && sortOptions.direction) params.append('sort_direction', sortOptions.direction);
  if (parentId) params.append('parent_id', parentId);
  if (timestamp) params.append('timestamp', timestamp);
  
  // Get the type filter from URL if available
  const typeParam = new URLSearchParams(window.location.search).get('type');
  if (typeParam) {
    params.append('type', typeParam);
  }
  
  // Special handling for ALL BOXES view - add a flag to ensure server returns fresh data
  if (!boxId) {
    params.append('ensure_fresh', 'true');
    params.append('skip_cache', 'true');
  }
  
  const queryString = params.toString();
  const url = `/items${queryString ? `?${queryString}` : ''}`;
  
  // Add special headers for ALL BOXES view to ensure fresh data
  const allBoxesHeaders = !boxId ? {
    'X-Ensure-Fresh': 'true',
    'X-Skip-Cache': 'true',
    'X-Fetch-All-Boxes': 'true'
  } : {};
  
  // Merge any extra headers with cache busting headers and ALL BOXES headers
  const requestHeaders = extraHeaders ? 
    { ...addCacheBustingHeaders(), ...allBoxesHeaders, ...extraHeaders } : 
    { ...addCacheBustingHeaders(), ...allBoxesHeaders };
  
  // Add timeout if specified
  const requestConfig = timeout ? 
    { ...requestHeaders, timeout } : 
    requestHeaders;
  
  console.log(`API getItems request for ${!boxId ? 'ALL BOXES' : 'box ' + boxId} with timestamp ${timestamp || 'none'}`);
  
  return api.get(url, requestConfig);
};

export const getItemById = (id) => {
  // Handle non-numeric IDs to prevent server errors
  if (id === 'new' || isNaN(parseInt(id))) {
    console.log(`Invalid item ID: ${id}. Returning empty item.`);
    return Promise.resolve({ 
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
    });
  }
  
  // First get the item data
  return api.get(`/items/${id}`)
    .then(response => {
      if (response.data) {
        // Then get the item properties
        return api.get(`/items/${id}/properties`)
          .then(propertiesResponse => {
            // Merge the properties with the item data
            const mergedData = {
              ...response.data,
              type: propertiesResponse.data.type || response.data.type || '',
              ean_code: propertiesResponse.data.ean_code || response.data.ean_code || '',
              serial_number: propertiesResponse.data.serial_number || response.data.serial_number || '',
              additional_data: propertiesResponse.data.additional_data || {}
            };
            
            return { data: mergedData };
          })
          .catch(err => {
            console.error('Error fetching item properties:', err);
        
            // Try to recover data from localStorage if API fails
        const storedItem = localStorage.getItem(`item_${id}_details`);
        if (storedItem) {
          try {
            const parsedItem = JSON.parse(storedItem);
                
                // Merge the localStorage data with the item data
                const mergedData = {
                  ...response.data,
                  type: parsedItem.type || response.data.type || '',
                  ean_code: parsedItem.ean_code || response.data.ean_code || '',
                  serial_number: parsedItem.serial_number || response.data.serial_number || ''
                };
                
                // Ensure parent_item_id is set if available in localStorage
                if (parsedItem.parent_item_id && !response.data.parent_item_id) {
                  const parsedParentId = parseInt(parsedItem.parent_item_id, 10);
                  if (!isNaN(parsedParentId)) {
                    mergedData.parent_item_id = parsedParentId;
                console.log(`Restoring parent_item_id from localStorage for item ${id}: ${parsedParentId}`);
              }
            }
            
                return { data: mergedData };
          } catch (err) {
            console.error('Error parsing stored item data:', err);
          }
        }
        
            // Return the original response if no localStorage data or error
            return response;
          });
        }
        
        return response;
    });
};

export const createItem = (itemData) => {
  // Extract properties that should go to item_properties
  const { type, ean_code, serial_number, qr_code, supplier, ...restData } = itemData;
  
  // Create the item first - include supplier in the main item data 
  return api.post('/items', { ...restData, qr_code, supplier, type })
    .then(response => {
      if (response && response.data && response.data.id) {
        // Then save the properties
        return api.post(`/items/${response.data.id}/properties`, {
          type,
          ean_code,
          serial_number,
          additional_data: {}
        })
        .then(() => {
          console.log('Item properties saved to database');
          
          // Record the creation transaction
          addTransactionToHistory({
            item_id: response.data.id,
            item_name: response.data.name,
            type: 'create',
            quantity: response.data.quantity || 1,
            box_id: response.data.box_id,
            details: `Item created${restData.parent_item_id ? ' as child item' : ''}`,
            transaction_type: 'ITEM_CREATED'
          });
          
          // Record parent relationship if set
          if (restData.parent_item_id) {
            // Get parent item details if needed
            return getItemById(restData.parent_item_id)
              .then(parentResponse => {
                const parentName = parentResponse?.data?.name || `Item #${restData.parent_item_id}`;
                
                // Record relationship transaction
                addTransactionToHistory({
                  item_id: response.data.id,
                  item_name: response.data.name,
                  type: 'relationship',
                  related_item_id: restData.parent_item_id,
                  related_item_name: parentName,
                  details: `Created as child of ${parentName}`,
                  box_id: response.data.box_id,
                  transaction_type: 'CHILD_RELATIONSHIP_CREATED'
                });
                
                return response;
              })
              .catch(err => {
                console.error('Error fetching parent item details:', err);
                return response;
              });
          }
          
          return response;
        })
        .catch(err => {
          console.error('Error saving item properties to database:', err);
          
          // Fallback to localStorage if the API call fails
          try {
            // Store the complete item data in localStorage to preserve fields that might be lost
            localStorage.setItem(`item_${response.data.id}_details`, JSON.stringify({
              type,
              ean_code,
              serial_number,
              parent_item_id: restData.parent_item_id || null,
              supplier: supplier || null,
              qr_code
            }));
        } catch (err) {
          console.error('Error storing item details in localStorage:', err);
        }
          
          return response;
        });
      }
      
      return response;
    });
};

// Helper function to add transaction to history
const addTransactionToHistory = (transaction) => {
  try {
    // For delete-related transactions, add a special flag to indicate that the item may not exist anymore
    const isDeleteTransaction = transaction.type?.includes('delete') || 
                               transaction.transaction_type?.includes('DELETE');
    
    // First, record the transaction in the database
    api.post('/items/transactions', {
      ...transaction,
      is_deletion: isDeleteTransaction, // Add flag to indicate deletion
      created_at: new Date().toISOString()
    })
    .then(response => {
      console.log('Transaction recorded in database:', response.data);
    })
    .catch(err => {
      console.error('Error recording transaction in database:', err);
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Server error response:', err.response.data);
        console.error('Status code:', err.response.status);
      } else if (err.request) {
        // The request was made but no response was received
        console.error('No response received from server');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', err.message);
      }
      
      // Fallback to localStorage if the API call fails
      const transactions = JSON.parse(localStorage.getItem('itemTransactions') || '[]');
      
      // Generate a more unique ID with timestamp and random string
      const random = Math.random().toString(36).substring(2, 10);
      const uniqueId = `trans-${Date.now()}-${random}`;
      
      transactions.push({
        id: uniqueId,
        ...transaction,
        is_deletion: isDeleteTransaction, // Add flag to local storage as well
        created_at: new Date().toISOString()
      });
      localStorage.setItem('itemTransactions', JSON.stringify(transactions));
      console.log('Transaction recorded in localStorage as fallback:', transaction);
    });
  } catch (err) {
    console.error('Error recording transaction history:', err);
  }
};

export const stockIn = (itemData) => {
  // Ensure the parent_item_id is explicitly included in the payload
  const cleanData = { ...itemData };
  
  // If we're creating a new item, make sure parent_item_id is properly set
  if (!cleanData.item_id && cleanData.item_name) {
    if (cleanData.parent_item_id === undefined) {
      cleanData.parent_item_id = null;
    } else if (typeof cleanData.parent_item_id === 'string' && cleanData.parent_item_id) {
      cleanData.parent_item_id = parseInt(cleanData.parent_item_id, 10);
    }
    
    // No longer removing the type field - keep it for the database
    console.log('StockIn - Creating new item with type:', cleanData.type);
    console.log('StockIn - Creating new item with supplier:', cleanData.supplier);
  }
  
  console.log('API stockIn - Sending data:', cleanData);
  
  // Mock implementation since the /items/stock-in endpoint doesn't exist
  // If we have an item_id, update the existing item, otherwise create a new one
  if (cleanData.item_id) {
    // Get the current item first
    return getItemById(cleanData.item_id)
      .then(response => {
        const currentItem = response.data;
        if (!currentItem) {
          throw new Error('Item not found');
        }
        
        // Update the item with the new quantity
        const newQuantity = (currentItem.quantity || 0) + cleanData.quantity;
        const updateData = {
          ...currentItem,
          quantity: newQuantity
        };
        
        // Ensure type field is preserved if it exists
        if (!updateData.type && currentItem.type) {
          updateData.type = currentItem.type;
        }
        
        // Retrieve stored item details that might contain type information
        const storedItem = localStorage.getItem(`item_${cleanData.item_id}_details`);
        if (storedItem) {
          try {
            const parsedItem = JSON.parse(storedItem);
            // If type exists in stored data but not in updateData, use it
            if (parsedItem.type && !updateData.type) {
              updateData.type = parsedItem.type;
            }
          } catch (err) {
            console.error('Error parsing stored item data:', err);
          }
        }
        
        // Add transaction notes if provided
        if (cleanData.notes) {
          updateData.notes = cleanData.notes;
        }
        
        // Convert box IDs to strings for consistent comparison
        const boxId = String(currentItem.box_id);
        
        // Record the stock-in transaction
        addTransactionToHistory({
          item_id: currentItem.id,
          item_name: currentItem.name,
          type: 'in',
          quantity: cleanData.quantity,
          previous_quantity: currentItem.quantity || 0,
          new_quantity: newQuantity,
          details: cleanData.notes || (cleanData.supplier ? `Stock added from supplier: ${cleanData.supplier}` : 'Stock added to inventory'),
          box_id: boxId,
          transaction_type: 'STOCK_IN',
          supplier: cleanData.supplier || null
        });
        
        return updateItem(cleanData.item_id, updateData);
      });
  } else {
    // Create a new item
    const newItemData = {
      name: cleanData.item_name,
      description: cleanData.description || null,
      serial_number: cleanData.serial_number || null,
      ean_code: cleanData.ean_code || null,
      quantity: cleanData.quantity,
      box_id: cleanData.box_id,
      type: cleanData.type || null, // Explicitly include type
      supplier: cleanData.supplier || null, // Explicitly include supplier
      parent_item_id: cleanData.parent_item_id === null ? null : 
        (typeof cleanData.parent_item_id === 'string' ? parseInt(cleanData.parent_item_id, 10) : cleanData.parent_item_id)
    };
    
    console.log('Creating new item with complete data:', newItemData);
    
    return createItem(newItemData)
      .then(response => {
        if (response && response.data) {
          // Convert box ID to string for consistent comparison
          const boxId = String(cleanData.box_id);
          
          // Record the initial stock transaction for the new item
          addTransactionToHistory({
            item_id: response.data.id,
            item_name: response.data.name,
            type: 'in',
            quantity: cleanData.quantity,
            previous_quantity: 0,
            new_quantity: cleanData.quantity,
            details: cleanData.notes || (cleanData.supplier ? `Initial stock from supplier: ${cleanData.supplier}` : 'Initial item stock'),
            box_id: boxId,
            transaction_type: 'NEW_ITEM',
            supplier: cleanData.supplier || null
          });
        }
        return response;
      });
  }
};

export const stockOut = (itemId, data) => {
  // Get the current item first
  return getItemById(itemId)
    .then(response => {
      const currentItem = response.data;
      if (!currentItem) {
        throw new Error('Item not found');
      }
      
      // Ensure we don't go below zero
      const previousQuantity = currentItem.quantity || 0;
      const newQuantity = Math.max(0, previousQuantity - data.quantity);
      const updateData = {
        ...currentItem,
        quantity: newQuantity
      };
      
      // Add additional data if provided
      if (data.notes) {
        updateData.notes = data.notes;
      }
      
      // Convert box ID to string for consistent comparison
      const boxId = String(currentItem.box_id);
      
      // Record the stock-out transaction
      addTransactionToHistory({
        item_id: currentItem.id,
        item_name: currentItem.name,
        type: 'out',
        quantity: data.quantity,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        details: data.notes || (data.reason ? 
          (data.customer_info && (data.reason === 'CONSUMED' || data.reason === 1 || data.reason === '1' || data.reason === 'SOLD' || data.reason === 7 || data.reason === '7') ? 
            `Removed due to: ${(data.reason === 'CONSUMED' || data.reason === 1 || data.reason === '1') ? 'CONSUMED by' : 'SOLD to'} ${data.customer_info.contact_person || data.customer_info.name.split('(')[0].trim()}` : 
            `Removed due to: ${data.reason}`) : 
          'Stock removed from inventory'),
        box_id: boxId,
        transaction_type: 'STOCK_OUT',
        reason: data.reason || null,
        customer_id: data.customer_id || null,
        customer_info: data.customer_info || null,
        notes: data.notes || null  // Explicitly include notes field
      });
      
      return updateItem(itemId, updateData);
    });
};

export const getStockHistory = (itemId = null, type = null, startDate = null, endDate = null, customerId = null) => {
  // Use the server API with query parameters
  const params = {};
  
  if (itemId) {
    params.item_id = itemId;
  }
  
  // Debug logging for deletions issue
  console.log('getStockHistory called with type:', type);
  
  if (type) {
    if (type === 'in') {
      params.transaction_type = ['STOCK_IN', 'NEW_ITEM'];
    } else if (type === 'out') {
      params.transaction_type = 'STOCK_OUT';
    } else if (type === 'delete') {
      // For deletions, set the is_deletion flag to true
      params.is_deletion = 'true';
      
      // Also add a direct filter for comprehensive deletion detection
      params.direct_filter = "transaction_type ILIKE '%DELETE%' OR is_deletion = true";
      
      console.log('Using DELETE filter params:', params);
    } else if (type === 'transfer') {
      params.transaction_type = ['TRANSFER', 'TRANSFER_IN', 'TRANSFER_OUT'];
    } else if (type === 'update') {
      params.transaction_type = 'UPDATE';
    } else if (type === 'create') {
      params.transaction_type = ['CREATE', 'NEW_ITEM'];
    } else {
      params.transaction_type = type.toUpperCase();
    }
  }
  
  if (startDate) {
    params.start_date = new Date(startDate).toISOString();
  }
  
  if (endDate) {
    // Include the entire end date
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);
    params.end_date = endDateTime.toISOString();
  }
  
  if (customerId) {
    params.customer_id = customerId;
  }
  
  console.log('Getting stock history with params:', params);
  
  // Use item-transactions endpoint for all transactions including deletions
  const apiEndpoint = '/items/transactions'; 
  
  // Call the server API
  return api.get(apiEndpoint, { params })
    .then(response => {
      console.log(`Received ${response.data.length} transactions from API`);
      
      // Special handling for deletions if none were found
      if (type === 'delete' && response.data.length === 0) {
        console.log('No deletion transactions found, trying alternative endpoint');
        
        // Try transactions endpoint as fallback
        return api.get('/transactions', { 
          params: { 
            is_deletion: 'true',
            direct_filter: "transaction_type ILIKE '%DELETE%' OR is_deletion = true"
          } 
        })
        .then(fallbackResponse => {
          console.log(`Found ${fallbackResponse.data.length} deletion transactions from fallback API`);
          return fallbackResponse;
        })
        .catch(error => {
          console.error('Error in fallback API call:', error);
          return response; // Return original empty response if fallback fails
        });
      }
      
      return response;
    })
    .catch(err => {
      console.error('Error fetching stock history from API:', err);
      
      // Fallback to localStorage if the API call fails
      return getCurrentUser()
        .then(userResponse => {
          const currentUser = userResponse.data || { username: 'Unknown User' };
          const username = currentUser.username || currentUser.name || currentUser.email || 'Unknown User';
          
          // Then get all items
          return getItems()
            .then(response => {
              let items = response.data || [];
              
              // Create a map of items by ID for easy lookup
              const itemsMap = {};
              items.forEach(item => {
                itemsMap[item.id] = item;
              });
              
              // Get stored transactions from localStorage
              let storedTransactions = [];
              try {
                const transactionsJson = localStorage.getItem('itemTransactions');
                if (transactionsJson) {
                  storedTransactions = JSON.parse(transactionsJson);
                }
              } catch (err) {
                console.error('Error reading transaction history from localStorage:', err);
              }
              
              // Create initial transactions for items without any recorded history
              let mockStockHistory = [];
              
              // Only add initial stock entries for items that don't have a creation transaction
              const itemsWithTransactions = new Set(storedTransactions
                .filter(t => t.transaction_type === 'NEW_ITEM' || t.transaction_type === 'STOCK_IN')
                .map(t => t.item_id));
              
              items.forEach(item => {
                if (!itemsWithTransactions.has(item.id)) {
                  // Create mock initial transaction only for items without recorded creation
                  mockStockHistory.push({
                    id: `stock-in-${item.id}`,
                    type: 'in',
                    item_id: item.id,
                    item_name: item.name,
                    quantity: item.quantity || 1,
                    previous_quantity: 0,
                    new_quantity: item.quantity || 1,
                    box_id: item.box_id,
                    notes: 'Initial stock',
                    created_at: item.created_at || new Date().toISOString(),
                    created_by: username,
                    transaction_type: 'STOCK_IN'
                  });
                }
              });
              
              // Format the stored transactions
              if (storedTransactions.length > 0) {
                const formattedTransactions = storedTransactions.map(transaction => {
                  const item = itemsMap[transaction.item_id] || {};
                  return {
                    id: transaction.id,
                    type: transaction.type || (transaction.transaction_type === 'QUANTITY_UPDATE' ? 
                           (transaction.details?.includes('increase') ? 'in' : 'out') : 
                           'in'),
                    item_id: transaction.item_id,
                    item_name: transaction.item_name || item.name || 'Unknown Item',
                    quantity: transaction.quantity || 0,
                    previous_quantity: transaction.previous_quantity,
                    new_quantity: transaction.new_quantity,
                    box_id: transaction.box_id || item.box_id,
                    notes: transaction.details || 'No details provided',
                    created_at: transaction.created_at,
                    created_by: username,
                    transaction_type: transaction.transaction_type || 'UNKNOWN',
                    previous_box_id: transaction.previous_box_id,
                    new_box_id: transaction.new_box_id,
                    reason: transaction.reason
                  };
                });
                
                mockStockHistory = [...mockStockHistory, ...formattedTransactions];
              }
              
              // Sort by creation date descending (newest first)
              mockStockHistory.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
              
              // Apply filters
              let filteredHistory = mockStockHistory;
              
              if (itemId) {
                // Convert both to strings for consistent comparison
                filteredHistory = filteredHistory.filter(record => String(record.item_id) === String(itemId));
              }
              
              if (type) {
                filteredHistory = filteredHistory.filter(record => record.type === type);
              }
              
              if (startDate) {
                const startDateObj = new Date(startDate);
                filteredHistory = filteredHistory.filter(record => {
                  const recordDate = new Date(record.created_at);
                  return recordDate >= startDateObj;
                });
              }
              
              if (endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setDate(endDateObj.getDate() + 1); // Include the end date
                filteredHistory = filteredHistory.filter(record => {
                  const recordDate = new Date(record.created_at);
                  return recordDate <= endDateObj;
                });
              }
              
              if (customerId) {
                    filteredHistory = filteredHistory.filter(record => 
                      record.customer_id === customerId || 
                      (record.customer_info && record.customer_info.id === customerId)
                    );
                  }
                  
                  console.log('Using localStorage fallback for stock history');
              return { data: filteredHistory };
            });
        });
    });
};

// Get items consumed by a specific customer
export const getCustomerItemHistory = (customerId) => {
  // Use the server API endpoint
  return api.get(`/customers/${customerId}/transactions`)
    .then(response => {
      console.log('Customer transactions API response:', response);
      
      // Ensure we have a consistent response format
      const transactions = Array.isArray(response.data) ? response.data : 
                          (response.data?.transactions || []);
      
      // Calculate summary statistics
      const summary = {
        totalItems: transactions.length,
        totalQuantity: transactions.reduce((sum, record) => sum + (record.quantity || 0), 0),
        uniqueItems: new Set(transactions.map(record => record.item_id)).size,
        mostConsumedItem: null
      };
      
      // Find most consumed item
      const itemCounts = {};
      transactions.forEach(record => {
        const itemId = record.item_id;
        if (!itemCounts[itemId]) {
          itemCounts[itemId] = {
            id: itemId,
            name: record.item_name,
            quantity: 0,
            count: 0
          };
        }
        itemCounts[itemId].quantity += (record.quantity || 0);
        itemCounts[itemId].count += 1;
      });
      
      if (Object.keys(itemCounts).length > 0) {
        summary.mostConsumedItem = Object.values(itemCounts)
          .sort((a, b) => b.quantity - a.quantity)[0];
      }
      
      return { 
        data: {
          transactions,
          summary
        }
      };
    })
    .catch(err => {
      console.error('Error fetching customer transactions from API:', err);
      // Return empty data with consistent format
      return { 
        data: {
          transactions: [],
          summary: {
            totalItems: 0,
            totalQuantity: 0,
            uniqueItems: 0,
            mostConsumedItem: null
          }
        }
      };
    });
};

// User Management API functions
export const getUsers = () => {
  return api.get('/users');
};

export const getUserById = (id) => {
  return api.get(`/users/${id}`);
};

export const createUser = (userData) => {
  return api.post('/users', userData);
};

export const updateUser = (id, userData) => {
  return api.put(`/users/${id}`, userData);
};

export const deleteUser = (id) => {
  return api.delete(`/users/${id}`);
};

export const resetPassword = (id, passwordData) => {
  return api.post(`/users/${id}/reset-password`, passwordData);
};

// Customer Management API functions
export const getCustomers = () => {
  return api.get('/customers');
};

export const getCustomerById = (id) => {
  return api.get(`/customers/${id}`);
};

export const createCustomer = (customerData) => {
  console.log('Creating new customer. Data:', customerData);
  
  // Ensure all fields are being passed, especially contact_person
  const dataToSend = {
    ...customerData,
    // Make sure contact_person is explicitly set if it exists
    contact_person: customerData.contact_person || '',
    // Ensure other important fields are present
    name: customerData.name || '',
    email: customerData.email || '',
    phone: customerData.phone || '',
    address: customerData.address || '',
    notes: customerData.notes || ''
  };
  
  console.log('Sanitized create data:', dataToSend);
  
  return api.post('/customers', dataToSend)
    .then(response => {
      console.log('Customer creation successful:', response.data);
      return response;
    })
    .catch(error => {
      console.error('Error creating customer:', error);
      throw error;
    });
};

export const updateCustomer = (id, customerData) => {
  console.log('Updating customer with ID:', id, 'Data:', customerData);
  
  // Ensure all fields are being passed, especially contact_person
  const dataToSend = {
    ...customerData,
    // Make sure contact_person is explicitly set if it exists
    contact_person: customerData.contact_person || '',
    // Ensure other important fields are present
    name: customerData.name || '',
    email: customerData.email || '',
    phone: customerData.phone || '',
    address: customerData.address || '',
    notes: customerData.notes || ''
  };
  
  console.log('Sanitized update data:', dataToSend);
  
  return api.put(`/customers/${id}`, dataToSend)
    .then(response => {
      console.log('Customer update successful:', response.data);
      return response;
    })
    .catch(error => {
      console.error('Error updating customer:', error);
      throw error;
    });
};

export const deleteCustomer = (id) => {
  return api.delete(`/customers/${id}`);
};

// Group Management API functions
export const getGroups = () => {
  return api.get('/groups');
};

export const getGroupById = (id) => {
  return api.get(`/groups/${id}`);
};

export const createGroup = (groupData) => {
  return api.post('/groups', groupData);
};

export const updateGroup = (id, groupData) => {
  return api.put(`/groups/${id}`, groupData);
};

export const deleteGroup = (id) => {
  return api.delete(`/groups/${id}`);
};

// Location Management API functions
export const getLocations = () => {
  return api.get('/locations');
};

export const getLocationById = (id) => {
  return api.get(`/locations/${id}`);
};

export const createLocation = (locationData) => {
  return api.post('/locations', locationData);
};

export const updateLocation = (id, locationData) => {
  return api.put(`/locations/${id}`, locationData);
};

export const deleteLocation = (id) => {
  return api.delete(`/locations/${id}`);
};

// Color Management API functions
export const getColors = () => {
  return api.get('/colors');
};

export const getColorById = (id) => {
  return api.get(`/colors/${id}`);
};

export const createColor = (colorData) => {
  return api.post('/colors', colorData);
};

export const updateColor = (id, colorData) => {
  return api.put(`/colors/${id}`, colorData);
};

export const deleteColor = (id) => {
  return api.delete(`/colors/${id}`);
};

// Shelf Management API functions
export const getShelves = () => {
  return api.get('/shelves');
};

export const getShelfById = (id) => {
  return api.get(`/shelves/${id}`);
};

export const createShelf = (shelfData) => {
  return api.post('/shelves', shelfData);
};

export const updateShelf = (id, shelfData) => {
  return api.put(`/shelves/${id}`, shelfData);
};

export const deleteShelf = (id) => {
  return api.delete(`/shelves/${id}`);
};

// Removal Reason Management API functions
export const getRemovalReasons = () => {
  // Use the server API endpoint
  return api.get('/removal-reasons')
    .catch(error => {
      console.error('Error fetching removal reasons from API:', error);
      
      // Fallback to localStorage if the API call fails
    try {
      // Try to get reasons from localStorage
      const storedReasons = localStorage.getItem('removalReasons');
      if (storedReasons) {
          const reasons = JSON.parse(storedReasons);
          console.log('Using localStorage fallback for removal reasons:', reasons);
          return { data: reasons };
        }
        
        // If no stored reasons, create and return default reasons
        const defaultReasons = [
          { id: 1, name: 'CONSUMED', description: 'Item was consumed or used up' },
          { id: 2, name: 'DAMAGED', description: 'Item was damaged and cannot be used' },
          { id: 3, name: 'EXPIRED', description: 'Item has expired' },
          { id: 4, name: 'SOLD', description: 'Item was sold to a customer' },
          { id: 5, name: 'RETURNED', description: 'Item was returned to supplier' },
          { id: 6, name: 'LOST', description: 'Item was lost' },
          { id: 7, name: 'OTHER', description: 'Other reason' }
        ];
        
        // Save default reasons to localStorage
        localStorage.setItem('removalReasons', JSON.stringify(defaultReasons));
      
        return { data: defaultReasons };
    } catch (error) {
      console.error('Error in localStorage getRemovalReasons:', error);
        return { data: [] };
    }
  });
};

export const getRemovalReasonById = (id) => {
  // Use the server API endpoint first
  return api.get(`/removal-reasons/${id}`)
    .catch(error => {
      console.error('Error fetching removal reason from API:', error);
      
      // Fall back to localStorage if the API call fails
      return new Promise((resolve, reject) => {
        try {
          const storedReasons = localStorage.getItem('removalReasons');
          if (!storedReasons) {
            reject(new Error('No removal reasons found'));
            return;
          }
          
          const reasons = JSON.parse(storedReasons);
          const reason = reasons.find(r => r.id === id);
          
          if (reason) {
            resolve({ data: reason });
          } else {
            reject(new Error('Removal reason not found'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
};

export const createRemovalReason = (reasonData) => {
  // Use the server API endpoint first
  return api.post('/removal-reasons', reasonData)
    .catch(error => {
      console.error('Error creating removal reason in API:', error);
      
      // Fall back to localStorage if the API call fails
      return new Promise((resolve, reject) => {
        try {
          const storedReasons = localStorage.getItem('removalReasons');
          let reasons = storedReasons ? JSON.parse(storedReasons) : [];
          
          // Check if ID already exists
          if (reasons.some(r => r.id === reasonData.id)) {
            reject(new Error('A removal reason with this ID already exists'));
            return;
          }
          
          // Add new reason
          reasons.push(reasonData);
          localStorage.setItem('removalReasons', JSON.stringify(reasons));
          
          resolve({ data: reasonData });
        } catch (error) {
          reject(error);
        }
      });
    });
};

export const updateRemovalReason = (id, reasonData) => {
  // Use the server API endpoint first
  return api.put(`/removal-reasons/${id}`, reasonData)
    .catch(error => {
      console.error('Error updating removal reason in API:', error);
      
      // Fall back to localStorage if the API call fails
      return new Promise((resolve, reject) => {
        try {
          const storedReasons = localStorage.getItem('removalReasons');
          if (!storedReasons) {
            reject(new Error('No removal reasons found'));
            return;
          }
          
          let reasons = JSON.parse(storedReasons);
          const index = reasons.findIndex(r => r.id === id);
          
          if (index === -1) {
            reject(new Error('Removal reason not found'));
            return;
          }
          
          // Update reason
          reasons[index] = { ...reasonData };
          localStorage.setItem('removalReasons', JSON.stringify(reasons));
          
          resolve({ data: reasonData });
        } catch (error) {
          reject(error);
        }
      });
    });
};

export const deleteRemovalReason = (id) => {
  // Use the server API endpoint first
  return api.delete(`/removal-reasons/${id}`)
    .catch(error => {
      console.error('Error deleting removal reason from API:', error);
      
      // Fall back to localStorage if the API call fails
      return new Promise((resolve, reject) => {
        try {
          const storedReasons = localStorage.getItem('removalReasons');
          if (!storedReasons) {
            reject(new Error('No removal reasons found'));
            return;
          }
          
          let reasons = JSON.parse(storedReasons);
          const updatedReasons = reasons.filter(r => r.id !== id);
          
          if (updatedReasons.length === reasons.length) {
            reject(new Error('Removal reason not found'));
            return;
          }
          
          localStorage.setItem('removalReasons', JSON.stringify(updatedReasons));
          resolve({ data: { success: true } });
        } catch (error) {
          reject(error);
        }
      });
    });
};

export const updateItem = (id, itemData) => {
  // First clear all item-related cache
  api.clearCache('/items');
  
  // Ensure type field is included in both main item data and properties
  const { type, ean_code, serial_number, qr_code, supplier, ...restData } = itemData;
  
  return api.put(`/items/${id}`, { ...restData, qr_code, supplier, type }, addCacheBustingHeaders())
    .then(response => {
      // Update the item properties as well
      return api.post(`/items/${id}/properties`, {
        type,
        ean_code,
        serial_number,
        additional_data: {}
      })
      .then(() => {
        // Trigger a manual refresh of the materialized view to ensure all clients get updated data
        refreshItemsView()
          .then(() => {
            console.log('Successfully refreshed items view after item update');
          })
          .catch(err => {
            console.error('Error refreshing items view after update:', err);
          });
          
        // Manually trigger WebSocket update event for immediate UI updates
        if (webSocketService && response.data) {
          webSocketService.send({
            type: 'refresh_needed',
            tableType: 'items',
            timestamp: new Date().toISOString()
          });
        }
        
        return response;
      })
      .catch(err => {
        console.error('Error updating item properties:', err);
        
        // Fallback to localStorage if the API call fails
        try {
          // Store the complete item data in localStorage to preserve fields
          localStorage.setItem(`item_${id}_details`, JSON.stringify({
            type,
            ean_code,
            serial_number,
            supplier: supplier || null,
            qr_code
          }));
        } catch (err) {
          console.error('Error storing item details in localStorage:', err);
        }
        
        return response;
      });
    });
};

export const transferItem = (id, transferData) => {
  // Get the current item first to record transaction
  return getItemById(id)
    .then(response => {
      const item = response.data;
      if (!item) {
        throw new Error('Item not found');
      }
      
      // Convert box IDs to strings for consistent comparison
      const sourceBoxId = String(item.box_id);
      const destinationBoxId = String(transferData.destination_box_id);
      
      // Record the transfer transaction
      addTransactionToHistory({
        item_id: id,
        item_name: item.name,
        type: 'transfer',
        quantity: item.quantity,
        previous_quantity: item.quantity,
        new_quantity: item.quantity,
        previous_box_id: sourceBoxId,
        new_box_id: destinationBoxId,
        box_id: destinationBoxId, // Current box after transfer
        details: transferData.notes || `Item transferred from Box ${sourceBoxId} to Box ${destinationBoxId}`,
        transaction_type: 'TRANSFER'
      });
      
      return api.post(`/items/${id}/transfer`, transferData);
    });
};

export const bulkTransferItems = (itemIds, transferData) => {
  // Record transactions for each item being transferred
  return getItems()
    .then(response => {
      const allItems = response.data || [];
      const itemsToTransfer = allItems.filter(item => itemIds.includes(item.id));
      
      // Convert destination box ID to string for consistent comparison
      const destinationBoxId = String(transferData.destination_box_id);
      
      // Record a transaction for each transferred item
      itemsToTransfer.forEach(item => {
        // Convert source box ID to string
        const sourceBoxId = String(item.box_id);
        
        addTransactionToHistory({
          item_id: item.id,
          item_name: item.name,
          type: 'transfer',
          quantity: item.quantity,
          previous_quantity: item.quantity,
          new_quantity: item.quantity,
          previous_box_id: sourceBoxId,
          new_box_id: destinationBoxId,
          box_id: destinationBoxId, // Current box after transfer
          details: transferData.notes || `Item transferred from Box ${sourceBoxId} to Box ${destinationBoxId} in bulk operation`,
          transaction_type: 'BULK_TRANSFER'
        });
      });
      
      return api.post('/items/bulk-transfer', {
        item_ids: itemIds,
        destination_box_id: transferData.destination_box_id,
        notes: transferData.notes
      });
    });
};

export const deleteItem = (id) => {
  // Get item details before deletion for history
  return getItemById(id)
    .then(response => {
      const item = response.data;
      if (item) {
        // Record soft deletion in transaction history
        addTransactionToHistory({
          item_id: id,
          item_name: item.name,
          type: 'soft-delete',
          quantity: item.quantity,
          details: 'Item soft-deleted (moved to trash)',
          box_id: item.box_id,
          transaction_type: 'SOFT_DELETE',
          metadata: {
            item_type: item.type || '',
            serial_number: item.serial_number || '',
            parent_item_id: item.parent_item_id || null
          }
        });
      }
      return api.delete(`/items/${id}`);
    })
    .catch(error => {
      console.error('Error getting item before deletion:', error);
      // Continue with deletion even if getting item failed
      return api.delete(`/items/${id}`);
    });
};

export const bulkDeleteItems = (itemIds) => {
  // Get items details before deletion for history
  return getItems()
    .then(response => {
      const allItems = response.data || [];
      const itemsToDelete = allItems.filter(item => itemIds.includes(item.id));
      
      // Record soft deletion for each item
      itemsToDelete.forEach(item => {
        addTransactionToHistory({
          item_id: item.id,
          item_name: item.name,
          type: 'soft-delete',
          quantity: item.quantity,
          details: 'Item soft-deleted in bulk operation (moved to trash)',
          box_id: item.box_id,
          transaction_type: 'BULK_SOFT_DELETE',
          metadata: {
            item_type: item.type || '',
            serial_number: item.serial_number || '',
            parent_item_id: item.parent_item_id || null,
            bulk_operation: true
          }
        });
      });
      
      return api.post('/items/bulk-delete', {
        item_ids: itemIds
      });
    });
};

// Role Management API functions
export const getRoles = () => {
  // Use the server API endpoint
  return api.get('/roles')
    .catch(error => {
      console.error('Error fetching roles from API:', error);
      
      // Fallback to localStorage if the API call fails
    try {
      // Try to get roles from localStorage
      const storedRoles = localStorage.getItem('roles');
      if (storedRoles) {
          const roles = JSON.parse(storedRoles);
          console.log('Using localStorage fallback for roles:', roles);
          return { data: roles };
        }
        
        // If no stored roles, create and return default roles
        const defaultRoles = [
          { id: 1, name: 'Customer', description: 'Regular customer', color: '#0d6efd' },
          { id: 2, name: 'VIP', description: 'Very important customer', color: '#dc3545' },
          { id: 3, name: 'Partner', description: 'Business partner', color: '#198754' },
          { id: 4, name: 'Supplier', description: 'Product supplier', color: '#fd7e14' },
          { id: 5, name: 'Internal', description: 'Internal department', color: '#6f42c1' }
        ];
        
        // Save default roles to localStorage
        localStorage.setItem('roles', JSON.stringify(defaultRoles));
      
        return { data: defaultRoles };
    } catch (error) {
      console.error('Error in localStorage getRoles:', error);
        return { data: [] };
    }
  });
};

export const getRoleById = (id) => {
  return new Promise((resolve, reject) => {
    try {
      const storedRoles = localStorage.getItem('roles');
      if (!storedRoles) {
        reject(new Error('No roles found'));
        return;
      }
      
      const roles = JSON.parse(storedRoles);
      const role = roles.find(r => r.id === id);
      
      if (role) {
        resolve({ data: role });
      } else {
        reject(new Error('Role not found'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const createRole = (roleData) => {
  return new Promise((resolve, reject) => {
    try {
      const storedRoles = localStorage.getItem('roles');
      let roles = storedRoles ? JSON.parse(storedRoles) : [];
      
      // Generate a unique ID
      const id = `role-${Date.now()}`;
      
      // Add new role
      const newRole = {
        id,
        name: roleData.name,
        description: roleData.description || '',
        access_level: parseInt(roleData.access_level) || 1,
        color: roleData.color || '#6c757d',
        notes: roleData.notes || ''
      };
      
      roles.push(newRole);
      localStorage.setItem('roles', JSON.stringify(roles));
      
      resolve({ data: newRole });
    } catch (error) {
      reject(error);
    }
  });
};

export const updateRole = (id, roleData) => {
  return new Promise((resolve, reject) => {
    try {
      const storedRoles = localStorage.getItem('roles');
      if (!storedRoles) {
        reject(new Error('No roles found'));
        return;
      }
      
      let roles = JSON.parse(storedRoles);
      const index = roles.findIndex(r => r.id === id);
      
      if (index === -1) {
        reject(new Error('Role not found'));
        return;
      }
      
      // Update role
      roles[index] = {
        ...roles[index],
        name: roleData.name,
        description: roleData.description || roles[index].description,
        access_level: parseInt(roleData.access_level) || roles[index].access_level,
        color: roleData.color || roles[index].color,
        notes: roleData.notes || roles[index].notes
      };
      
      localStorage.setItem('roles', JSON.stringify(roles));
      
      resolve({ data: roles[index] });
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteRole = (id) => {
  return new Promise((resolve, reject) => {
    try {
      const storedRoles = localStorage.getItem('roles');
      if (!storedRoles) {
        reject(new Error('No roles found'));
        return;
      }
      
      let roles = JSON.parse(storedRoles);
      const updatedRoles = roles.filter(r => r.id !== id);
      
      if (updatedRoles.length === roles.length) {
        reject(new Error('Role not found'));
        return;
      }
      
      localStorage.setItem('roles', JSON.stringify(updatedRoles));
      resolve({ data: { success: true } });
    } catch (error) {
      reject(error);
    }
  });
};

// New function to find item by QR code
export const findItemByQRCode = (qrCode) => {
  console.log('Searching for item with QR code:', qrCode);
  
  // First check if it's a standard item QR code format (with $ prefix)
  if (qrCode.startsWith('$')) {
    console.log('QR code has $ prefix, searching by qr_code');
    
    // Try an exact match on the qr_code field
    return api.get('/items', { 
      params: { qr_code: qrCode },
      headers: {
        // Add cache-busting headers
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Cache-Bust': new Date().getTime()
      }
    })
      .then(response => {
        console.log('QR code search result:', response.data);
        if (response && response.data && response.data.length > 0) {
          // Return the first exact match
          return { data: response.data[0] };
        }
        
        // If no exact match found, try with the ean_code field
        // (since some systems store QR codes in the EAN field)
        return api.get('/items', { 
          params: { ean_code: qrCode },
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Cache-Bust': new Date().getTime()
          }
        })
          .then(eanResponse => {
            if (eanResponse && eanResponse.data && eanResponse.data.length > 0) {
              return { data: eanResponse.data[0] };
            }
            return { data: null };
          });
      })
      .catch(error => {
        console.error('Error finding item by QR code:', error);
        return { data: null };
      });
  }
  
  // If the QR code looks like an EAN code (numeric, 8-14 digits)
  const eanPattern = /^\d{8,14}$/;
  if (eanPattern.test(qrCode)) {
    console.log('QR code looks like an EAN, searching by ean_code');
    // Try direct exact match by EAN code
    return api.get('/items', { 
      params: { ean_code: qrCode },
      headers: {
        // Add cache-busting headers
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Cache-Bust': new Date().getTime()
      }
    })
      .then(response => {
        console.log('EAN search result:', response.data);
        if (response && response.data && response.data.length > 0) {
          // Return the first exact match
          return { data: response.data[0] };
        }
        
        // If not found by exact EAN, try by serial number
        console.log('Not found by EAN, trying serial number');
        return api.get('/items', { 
          params: { serial_number: qrCode },
          headers: {
            // Add cache-busting headers
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Cache-Bust': new Date().getTime()
          }
        })
          .then(serialResponse => {
            console.log('Serial number search result:', serialResponse.data);
            if (serialResponse && serialResponse.data && serialResponse.data.length > 0) {
              return { data: serialResponse.data[0] };
            }
            return { data: null };
          });
      })
      .catch(error => {
        console.error('Error finding item by EAN code:', error);
        return { data: null };
      });
  }
  
  // Try searching by serial number directly
  console.log('Trying direct serial number search');
  return api.get('/items', { 
    params: { serial_number: qrCode },
    headers: {
      // Add cache-busting headers
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Bust': new Date().getTime()
    }
  })
    .then(response => {
      console.log('Serial number direct search result:', response.data);
      if (response && response.data && response.data.length > 0) {
        // Only return exact serial number matches
        const exactMatch = response.data.find(item => 
          item.serial_number === qrCode
        );
        
        if (exactMatch) {
          console.log(`Found exact serial number match: Item #${exactMatch.id}`);
          return { data: exactMatch };
        }
        
        console.log('No exact serial number match found, returning null');
        return { data: null };
      }
      
      // Last resort: search by ID or name exact match only
      if (/^\d+$/.test(qrCode)) {
        console.log('Trying item ID search');
        return api.get(`/items/${qrCode}`)
          .then(idResponse => {
            if (idResponse && idResponse.data && idResponse.data.id) {
              console.log(`Found exact item ID match: Item #${idResponse.data.id}`);
              return { data: idResponse.data };
            }
            return { data: null };
          })
          .catch(() => {
            // If ID search fails, return null - don't try fuzzy name search
            return { data: null };
          });
      }
      
      // If not a number, we won't try fuzzy name search to avoid false matches
      return { data: null };
    })
    .catch(error => {
      console.error('Error finding item by serial number or name:', error);
      return { data: null };
    });
};

// New function to find box by QR code
export const findBoxByQRCode = (qrCode) => {
  // Check if the QR code follows the box pattern (BOX-XXX or just a number)
  const boxMatch = qrCode.match(/BOX[-_]?(\d{1,4})[-_]?\w*/i);
  const justNumberMatch = /^\d{1,4}$/.test(qrCode);
  
  if (boxMatch) {
    const boxNumber = boxMatch[1].replace(/^0+/, ''); // Remove leading zeros
    
    // Search for boxes with this number
    return api.get('/boxes', { params: { box_number: boxNumber } })
      .then(response => {
        if (response && response.data && response.data.length > 0) {
          // Prioritize EXACT matches first
          const exactMatch = response.data.find(box => 
            box.box_number === boxNumber
          );
          
          if (exactMatch) {
            console.log(`Found exact box match: Box #${exactMatch.box_number}`);
            return { data: exactMatch };
          }
          
          // If no exact match, we won't return partial matches anymore
          // This prevents box "3" from matching with box "23" or "123"
          console.log('No exact box match found, returning null');
          return { data: null };
        }
        return { data: null };
      })
      .catch(error => {
        console.error('Error finding box by QR code:', error);
        return { data: null };
      });
  } else if (justNumberMatch) {
    // If it's just a number, try to find a box with that exact number
    const boxNumber = qrCode.replace(/^0+/, ''); // Remove leading zeros
    
    return api.get('/boxes', { params: { box_number: boxNumber } })
      .then(response => {
        if (response && response.data && response.data.length > 0) {
          // Only return EXACT matches
          const exactMatch = response.data.find(box => 
            box.box_number === boxNumber
          );
          
          if (exactMatch) {
            console.log(`Found exact box match: Box #${exactMatch.box_number}`);
            return { data: exactMatch };
          }
          
          // No partial matches
          console.log('No exact box match found, returning null');
          return { data: null };
        }
        return { data: null };
      })
      .catch(error => {
        console.error('Error finding box by number:', error);
        return { data: null };
      });
  }
  
  // Not a box QR code
  return Promise.resolve({ data: null });
};

// Database Backup and Restore API functions
export const backupDatabase = () => {
  return api.post('/database/backup');
};

export const getBackupsList = () => {
  return api.get('/database/backups');
};

export const downloadBackup = (filename) => {
  // Fix the URL format to correctly point to the API endpoint
  const token = localStorage.getItem('token');
  const url = `${API_URL}/database/backups/${filename}`;
  
  // Create a temporary anchor element
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  
  // Add the authorization header via a fetch request
  fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.blob())
  .then(blob => {
    const url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  })
  .catch(error => {
    console.error('Error downloading backup:', error);
    alert('Failed to download backup file. Please check console for details.');
  });
};

export const restoreDatabase = (filename) => {
  return api.post('/database/restore', { filename });
};

export const uploadBackup = (file) => {
  const formData = new FormData();
  formData.append('backupFile', file);
  
  return api.post('/database/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

export const deleteBackup = (filename) => {
  return api.delete(`/database/backups/${filename}`);
};

// Deleted items management
export const getDeletedItems = () => {
  return api.get('/items/deleted');
};

export const restoreItem = (id) => {
  // Get item details before restoration for history
  return getItemById(id)
    .then(response => {
      const item = response.data;
      if (item) {
        // Record restoration in transaction history
        addTransactionToHistory({
          item_id: id,
          item_name: item.name,
          type: 'restore',
          quantity: item.quantity,
          details: 'Item restored from trash',
          box_id: item.box_id,
          transaction_type: 'RESTORE'
        });
      }
      return api.post(`/items/${id}/restore`);
    })
    .catch(error => {
      console.error('Error getting item before restoration:', error);
      // Continue with restoration even if getting item failed
      return api.post(`/items/${id}/restore`);
    });
};

export const permanentlyDeleteItem = (id) => {
  // Get item details before permanent deletion for history
  return getItemById(id)
    .then(response => {
      const item = response.data;
      if (item) {
        // Record permanent deletion in transaction history
        addTransactionToHistory({
          item_id: id,
          item_name: item.name,
          type: 'permanent-delete',
          quantity: item.quantity,
          details: 'Item permanently deleted from system',
          box_id: item.box_id,
          transaction_type: 'PERMANENT_DELETE',
          metadata: {
            item_type: item.type || '',
            serial_number: item.serial_number || '',
            parent_item_id: item.parent_item_id || null,
            deleted_at: new Date().toISOString()
          }
        });
      }
      return api.delete(`/items/${id}/permanent`);
    })
    .catch(error => {
      console.error('Error getting item before permanent deletion:', error);
      // Continue with permanent deletion even if getting item failed
      return api.delete(`/items/${id}/permanent`);
    });
};

// New function to handle bulk permanent deletion of items
export const bulkPermanentlyDeleteItems = (itemIds) => {
  // Get items details before permanent deletion for history
  return getDeletedItems()
    .then(response => {
      const allDeletedItems = response.data || [];
      const itemsToDelete = allDeletedItems.filter(item => itemIds.includes(item.id));
      
      // Record permanent deletion for each item
      itemsToDelete.forEach(item => {
        addTransactionToHistory({
          item_id: item.id,
          item_name: item.name,
          type: 'permanent-delete',
          quantity: item.quantity || 0,
          details: 'Item permanently deleted in bulk operation',
          box_id: item.box_id,
          transaction_type: 'BULK_PERMANENT_DELETE',
          metadata: {
            item_type: item.type || '',
            serial_number: item.serial_number || '',
            parent_item_id: item.parent_item_id || null,
            deleted_at: new Date().toISOString(),
            bulk_operation: true
          }
        });
      });
      
      return api.post('/items/bulk-permanent-delete', {
        item_ids: itemIds
      });
    })
    .catch(error => {
      console.error('Error getting deleted items before permanent deletion:', error);
      // Continue with permanent deletion even if getting items failed
      return api.post('/items/bulk-permanent-delete', {
        item_ids: itemIds
      });
    });
};

// Refresh the items materialized view
export const refreshItemsView = () => {
  console.log('Manually refreshing items materialized view');
  // Add timestamp parameter to avoid caching
  const timestamp = new Date().getTime();
  
  // First clear all caches before requesting a view refresh
  if (api.clearCache) {
    api.clearCache();
    console.log('Cleared all API caches before refreshing view');
  }
  
  // Use stronger cache-busting headers for this critical operation
  const cacheBustingHeaders = {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Bust': timestamp,
      'X-Refresh-Type': 'FULL_REFRESH',
      'X-Request-Source': 'CLIENT_EXPLICIT'
    }
  };
  
  return api.post('/database/refresh-view', { 
    timestamp,
    force: true,
    source: 'user_request'
  }, cacheBustingHeaders)
    .then(response => {
      console.log('View refresh response:', response.data);
      
      // Notify all clients to refresh their data - send both notification types for redundancy
      if (webSocketService) {
        // First notification type (legacy)
        webSocketService.send({
          type: 'refresh_needed',
          tableType: 'items',
          timestamp: new Date().toISOString(),
          force: true
        });
        
        // Second notification type (direct client refresh)
        webSocketService.send({
          type: 'client_refresh_request',
          tableType: 'items',
          timestamp: new Date().toISOString(),
          force: true
        });
        
        // Also send item_update notification
        webSocketService.send({
          type: 'item_update',
          action: 'update', // Generic update action
          timestamp: new Date().toISOString(),
          force: true
        });
        
        console.log('Sent WebSocket notifications to all clients for data refresh');
      }
      
      // Wait a short time to ensure database changes propagate
      return new Promise(resolve => {
        setTimeout(() => {
          console.log('View refresh complete with delay');
          resolve(response);
        }, 600);
      });
    })
    .catch(error => {
      console.error('Error refreshing materialized view:', error);
      throw error;
    });
};

// Admin API functions
export const getSystemInfo = () => {
  return api.get('/admin/system-info');
};

// Add a new method to update just EAN and QR codes

/**
 * Updates just the EAN and QR codes for an item
 * @param {string|number} itemId - Item ID
 * @param {object} codeData - Object containing ean_code, qr_code, and/or reference_id
 * @returns {Promise} - Promise resolving to the API response
 */
export const updateItemCodes = (itemId, codeData) => {
  return api.put(`/api/items/${itemId}/codes`, codeData);
};

export default api; 