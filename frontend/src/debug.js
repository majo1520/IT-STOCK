import axios from 'axios';

// Function to log information about the transactions API call
async function debugTransactions() {
  console.log('Starting transactions debugging...');

  try {
    // Try direct call to /api/transactions with delete filter
    const response = await axios.get('/api/transactions?type=delete');
    console.log('Transactions API response (delete filter):', {
      status: response.status,
      count: response.data.length,
      sample: response.data.length > 0 ? response.data[0] : null
    });

    // Also try calling item-transactions API directly
    const itemTransResponse = await axios.get('/api/items/transactions');
    console.log('Item Transactions API response:', {
      status: itemTransResponse.status,
      count: itemTransResponse.data.length,
      deletions: itemTransResponse.data.filter(t => t.is_deletion === true).length,
      sample: itemTransResponse.data.length > 0 ? itemTransResponse.data[0] : null
    });

    // Check the frontend filter logic by fetching all transactions and filtering manually
    const allTransactions = await axios.get('/api/transactions');
    console.log('All Transactions API response:', {
      status: allTransactions.status,
      count: allTransactions.data.length
    });

    // Manual filtering for deletions
    const deletions = allTransactions.data.filter(t => {
      const transType = (t.transaction_type || t.type || '').toLowerCase();
      return (
        t.is_deletion === true || 
        transType.includes('delete') ||
        transType === 'soft_delete' || 
        transType === 'permanent_delete'
      );
    });

    console.log('Manual filtering for deletions:', {
      count: deletions.length,
      sample: deletions.length > 0 ? deletions[0] : null
    });

  } catch (error) {
    console.error('Error in debug script:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Export function to be called from the browser console
window.debugTransactions = debugTransactions;

// Also expose some helper functions
window.checkTransactionsByType = async (type) => {
  try {
    const response = await axios.get(`/api/transactions?type=${type}`);
    console.log(`Transactions for type=${type}:`, {
      count: response.data.length,
      sample: response.data.length > 0 ? response.data[0] : null
    });
  } catch (error) {
    console.error(`Error fetching transactions for type=${type}:`, error);
  }
};

export { debugTransactions }; 