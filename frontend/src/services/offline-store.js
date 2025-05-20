import { openDB } from 'idb';

const DB_NAME = 'reactstock';
const DB_VERSION = 1;

// Database schema definition
const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Items store
    if (!db.objectStoreNames.contains('items')) {
      const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
      itemsStore.createIndex('box_id', 'box_id');
      itemsStore.createIndex('name', 'name');
      itemsStore.createIndex('type', 'type');
      itemsStore.createIndex('parent_item_id', 'parent_item_id');
    }

    // Transactions store
    if (!db.objectStoreNames.contains('transactions')) {
      const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionsStore.createIndex('item_id', 'item_id');
      transactionsStore.createIndex('box_id', 'box_id');
      transactionsStore.createIndex('transaction_type', 'transaction_type');
      transactionsStore.createIndex('created_at', 'created_at');
    }

    // Boxes store
    if (!db.objectStoreNames.contains('boxes')) {
      const boxesStore = db.createObjectStore('boxes', { keyPath: 'id' });
      boxesStore.createIndex('box_number', 'box_number');
    }

    // Customer transactions store
    if (!db.objectStoreNames.contains('customer_transactions')) {
      const customerTransactionsStore = db.createObjectStore('customer_transactions', { keyPath: 'id' });
      customerTransactionsStore.createIndex('customer_id', 'customer_id');
      customerTransactionsStore.createIndex('item_id', 'item_id');
    }

    // Pending operations store (for offline operations that need to be synced)
    if (!db.objectStoreNames.contains('pending_operations')) {
      const pendingStore = db.createObjectStore('pending_operations', { 
        keyPath: 'id', 
        autoIncrement: true 
      });
      pendingStore.createIndex('operation', 'operation');
      pendingStore.createIndex('status', 'status');
      pendingStore.createIndex('timestamp', 'timestamp');
    }

    // API cache store (for caching API responses)
    if (!db.objectStoreNames.contains('api_cache')) {
      const cacheStore = db.createObjectStore('api_cache', { keyPath: 'url' });
      cacheStore.createIndex('timestamp', 'timestamp');
      cacheStore.createIndex('expiry', 'expiry');
    }
  }
});

// Generic CRUD operations
export const offlineStore = {
  // Get all items from a store
  async getAll(storeName) {
    const db = await dbPromise;
    return db.getAll(storeName);
  },

  // Get a single item by ID
  async get(storeName, id) {
    const db = await dbPromise;
    return db.get(storeName, id);
  },

  // Get items by index
  async getByIndex(storeName, indexName, value) {
    const db = await dbPromise;
    const index = db.transaction(storeName).store.index(indexName);
    return index.getAll(value);
  },

  // Put an item in a store (create or update)
  async put(storeName, item) {
    const db = await dbPromise;
    return db.put(storeName, item);
  },

  // Add an item to a store (create only)
  async add(storeName, item) {
    const db = await dbPromise;
    return db.add(storeName, item);
  },

  // Delete an item from a store
  async delete(storeName, id) {
    const db = await dbPromise;
    return db.delete(storeName, id);
  },

  // Clear a store
  async clear(storeName) {
    const db = await dbPromise;
    return db.clear(storeName);
  },

  // Add a pending operation
  async addPendingOperation(operation, data) {
    const db = await dbPromise;
    return db.add('pending_operations', {
      operation,
      data,
      status: 'pending',
      retries: 0,
      timestamp: new Date().toISOString()
    });
  },

  // Get all pending operations
  async getPendingOperations() {
    const db = await dbPromise;
    return db.getAllFromIndex('pending_operations', 'status', 'pending');
  },

  // Update a pending operation
  async updatePendingOperation(id, updates) {
    const db = await dbPromise;
    const tx = db.transaction('pending_operations', 'readwrite');
    const store = tx.objectStore('pending_operations');
    const operation = await store.get(id);
    if (!operation) return false;
    
    const updatedOperation = { ...operation, ...updates };
    await store.put(updatedOperation);
    await tx.done;
    return true;
  },

  // Cache API response
  async cacheApiResponse(url, data, expiryMinutes = 30) {
    const db = await dbPromise;
    const now = new Date();
    const expiry = new Date(now.getTime() + expiryMinutes * 60000);
    
    await db.put('api_cache', {
      url,
      data,
      timestamp: now.toISOString(),
      expiry: expiry.toISOString()
    });
  },

  // Get cached API response
  async getCachedApiResponse(url) {
    const db = await dbPromise;
    const cachedResponse = await db.get('api_cache', url);
    
    if (!cachedResponse) return null;
    
    // Check if cache has expired
    if (new Date(cachedResponse.expiry) < new Date()) {
      await db.delete('api_cache', url);
      return null;
    }
    
    return cachedResponse.data;
  }
};

export default offlineStore; 