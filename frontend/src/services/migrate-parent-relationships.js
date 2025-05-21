/**
 * Utility to migrate parent-child relationships from localStorage to the database
 * This should be run once to ensure all data is properly stored in PostgreSQL
 */

import * as api from './api';

/**
 * Migrates parent-child relationships from localStorage to the database
 * @returns {Promise<{success: boolean, migrated: number, errors: Array}>}
 */
export async function migrateParentChildRelationships() {
  console.log('Starting migration of parent-child relationships from localStorage to database...');
  
  const migrationResult = {
    success: false,
    migrated: 0,
    errors: []
  };
  
  try {
    // Get all items from the API
    const itemsResponse = await api.getItems();
    const items = itemsResponse.data || [];
    
    if (!items.length) {
      console.log('No items found in the database.');
      return { ...migrationResult, success: true };
    }
    
    console.log(`Found ${items.length} items in the database.`);
    
    // Find all items with parent relationships in localStorage
    const itemsToUpdate = [];
    
    for (const item of items) {
      const localStorageKey = `item_${item.id}_details`;
      const storedItem = localStorage.getItem(localStorageKey);
      
      if (storedItem) {
        try {
          const parsedItem = JSON.parse(storedItem);
          
          // Check if the item has a parent_item_id in localStorage but not in the database
          if (parsedItem.parent_item_id !== undefined && 
              (item.parent_item_id === undefined || item.parent_item_id === null)) {
            
            // Normalize parent_item_id to number or null
            const parsedParentId = parsedItem.parent_item_id === null ? 
              null : parseInt(parsedItem.parent_item_id, 10) || null;
            
            console.log(`Found item ${item.id} with parent_item_id ${parsedParentId} in localStorage`);
            
            // Add to the list of items to update
            itemsToUpdate.push({
              id: item.id,
              parent_item_id: parsedParentId
            });
          }
        } catch (err) {
          console.error(`Error parsing stored item data for item ${item.id}:`, err);
          migrationResult.errors.push({
            itemId: item.id,
            error: `Error parsing localStorage data: ${err.message}`
          });
        }
      }
    }
    
    console.log(`Found ${itemsToUpdate.length} items with parent relationships in localStorage.`);
    
    // Update items in the database
    for (const itemToUpdate of itemsToUpdate) {
      try {
        console.log(`Updating item ${itemToUpdate.id} with parent_item_id ${itemToUpdate.parent_item_id}`);
        
        // Update the item in the database
        await api.updateItem(itemToUpdate.id, {
          parent_item_id: itemToUpdate.parent_item_id
        });
        
        migrationResult.migrated++;
      } catch (err) {
        console.error(`Error updating item ${itemToUpdate.id}:`, err);
        migrationResult.errors.push({
          itemId: itemToUpdate.id,
          error: `Error updating item: ${err.message}`
        });
      }
    }
    
    console.log(`Migration completed. Successfully migrated ${migrationResult.migrated} items.`);
    
    if (migrationResult.errors.length > 0) {
      console.warn(`Encountered ${migrationResult.errors.length} errors during migration.`);
    } else {
      console.log('No errors encountered during migration.');
    }
    
    return {
      ...migrationResult,
      success: true
    };
  } catch (err) {
    console.error('Migration failed:', err);
    return {
      ...migrationResult,
      success: false,
      errors: [...migrationResult.errors, { error: err.message }]
    };
  }
}

/**
 * Clears parent-child relationship data from localStorage after successful migration
 */
export function clearLocalStorageAfterMigration() {
  const keysToRemove = [];
  
  // Find all item detail keys in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('item_') && key.endsWith('_details')) {
      keysToRemove.push(key);
    }
  }
  
  console.log(`Found ${keysToRemove.length} item detail entries in localStorage.`);
  
  // Remove the keys
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
  
  console.log(`Removed ${keysToRemove.length} item detail entries from localStorage.`);
}

export default {
  migrateParentChildRelationships,
  clearLocalStorageAfterMigration
}; 