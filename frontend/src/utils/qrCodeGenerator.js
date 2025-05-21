/**
 * QR Code Generator Utility
 * Generates unique QR codes for items
 */

/**
 * Generate a unique QR code value for an item
 * Format: EPL-IT-STOCK-{itemId}-{random}
 * 
 * @param {number|string} itemId - The item ID (optional, for existing items)
 * @returns {string} A unique QR code value
 */
export const generateUniqueQRValue = (itemId = null) => {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD format
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  if (itemId) {
    return `EPL-IT-STOCK-${itemId}-${random}`;
  } else {
    // Generate a random number for new items
    const tempId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `EPL-IT-STOCK-${tempId}-${random}`;
  }
};

/**
 * Extract item ID from a QR code value
 * 
 * @param {string} qrValue - The QR code value
 * @returns {string|null} The item ID if found, null otherwise
 */
export const extractItemIdFromQR = (qrValue) => {
  if (!qrValue || typeof qrValue !== 'string') {
    return null;
  }
  
  // Check if it matches our format EPL-IT-STOCK-itemId-random
  const parts = qrValue.split('-');
  if (parts.length >= 5 && parts[0] === 'EPL' && parts[1] === 'IT' && parts[2] === 'STOCK') {
    return parts[3];
  }
  
  return null;
};

/**
 * Validate if a QR code value is in the correct format
 * 
 * @param {string} qrValue - The QR code value to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidQRFormat = (qrValue) => {
  if (!qrValue || typeof qrValue !== 'string') {
    return false;
  }
  
  // Check if it matches our format EPL-IT-STOCK-itemId-random
  const parts = qrValue.split('-');
  return parts.length >= 5 && parts[0] === 'EPL' && parts[1] === 'IT' && parts[2] === 'STOCK';
}; 