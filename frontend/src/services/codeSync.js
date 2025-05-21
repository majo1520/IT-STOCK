// codeSync.js - Synchronization service for EAN/QR codes
import api from './api';
import { updateItemCodes } from './api';

/**
 * Synchronizes EAN/QR codes stored in localStorage with the PostgreSQL database
 * This ensures that any codes generated or modified in the UI are properly saved in the database
 */
const codeSyncService = {
  /**
   * Checks localStorage for items with EAN/QR codes and updates the database if needed
   * @returns {Promise} A promise that resolves when sync is complete
   */
  syncAllItemCodes: async () => {
    console.log('Starting EAN/QR code synchronization...');
    const syncPromises = [];
    const syncedItems = [];
    
    // Loop through localStorage to find items with EAN or QR codes
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('item_') && key.includes('_details')) {
        try {
          const itemData = JSON.parse(localStorage.getItem(key));
          const itemId = key.split('_')[1]; // Extract item ID from key
          
          // Check if there's an EAN or QR code that needs to be synced
          if (itemData && (itemData.ean_code || itemData.qr_code)) {
            syncPromises.push(
              codeSyncService.syncItemCode(itemId, itemData).then(() => {
                syncedItems.push(itemId);
              })
            );
          }
        } catch (err) {
          console.error(`Error processing item in localStorage: ${key}`, err);
        }
      }
    }
    
    try {
      await Promise.all(syncPromises);
      console.log(`Completed synchronization for ${syncedItems.length} items`);
      return syncedItems;
    } catch (err) {
      console.error('Error during code synchronization:', err);
      throw err;
    }
  },
  
  /**
   * Synchronizes a specific item's EAN/QR code with the database
   * @param {string|number} itemId - The ID of the item to sync
   * @param {Object} itemData - The item data containing ean_code and/or qr_code
   * @returns {Promise} A promise that resolves when update is complete
   */
  syncItemCode: async (itemId, itemData) => {
    if (!itemId) return Promise.reject('No item ID provided');
    
    try {
      // First check if the item exists and get current values
      const response = await api.getItemById(itemId);
      const serverItem = response.data;
      
      // Determine if we need to update the database
      const needsUpdate = (
        (itemData.ean_code && itemData.ean_code !== serverItem.ean_code) ||
        (itemData.qr_code && itemData.qr_code !== serverItem.qr_code)
      );
      
      if (needsUpdate) {
        console.log(`Updating database with codes for item ${itemId}`);
        
        // Only send the fields that need updating
        const updateData = {
          ...(itemData.ean_code ? { ean_code: itemData.ean_code } : {}),
          ...(itemData.qr_code ? { qr_code: itemData.qr_code, reference_id: itemData.qr_code } : {})
        };
        
        // Update the item codes using the dedicated endpoint
        return updateItemCodes(itemId, updateData);
      } else {
        // No update needed
        return Promise.resolve();
      }
    } catch (err) {
      console.error(`Error syncing codes for item ${itemId}:`, err);
      return Promise.reject(err);
    }
  },
  
  /**
   * Stores EAN/QR code in both localStorage and database
   * @param {string|number} itemId - The ID of the item
   * @param {string} eanCode - The EAN code
   * @param {string} qrCode - The QR code (often the same as EAN)
   * @returns {Promise} A promise that resolves when update is complete
   */
  storeItemCode: async (itemId, eanCode, qrCode = null) => {
    if (!itemId || !eanCode) return Promise.reject('Missing required information');
    
    // Always store in localStorage for immediate access
    try {
      let itemData = {};
      const storedItem = localStorage.getItem(`item_${itemId}_details`);
      if (storedItem) {
        itemData = JSON.parse(storedItem);
      }
      
      // Update codes
      itemData.ean_code = eanCode;
      if (qrCode) itemData.qr_code = qrCode;
      
      // Save back to localStorage
      localStorage.setItem(`item_${itemId}_details`, JSON.stringify(itemData));
      
      // Also update in database using dedicated endpoint
      const updateData = {
        ean_code: eanCode,
        ...(qrCode ? { qr_code: qrCode, reference_id: qrCode } : {})
      };
      
      return updateItemCodes(itemId, updateData);
    } catch (err) {
      console.error(`Error storing codes for item ${itemId}:`, err);
      return Promise.reject(err);
    }
  }
};

export default codeSyncService; 