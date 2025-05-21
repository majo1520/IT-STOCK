// Script to manually refresh the items_complete_view materialized view
const { Pool } = require('pg');
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

async function refreshView() {
  console.log('=== Refreshing Materialized View ===');
  
  try {
    console.log('Refreshing items_complete_view...');
    await pool.query('REFRESH MATERIALIZED VIEW items_complete_view');
    console.log('✓ View refreshed successfully');
    
    // Get current item count to verify the view is working
    const result = await pool.query('SELECT COUNT(*) FROM items_complete_view');
    console.log(`The view now contains ${result.rows[0].count} items`);
    
    // List 5 most recently updated items
    const recentItems = await pool.query(`
      SELECT id, name, updated_at, box_id, quantity 
      FROM items_complete_view 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    
    console.log('\nRecently updated items:');
    if (recentItems.rows.length > 0) {
      recentItems.rows.forEach(item => {
        console.log(`ID: ${item.id}, Name: ${item.name}, Updated: ${item.updated_at}, Box: ${item.box_id}, Qty: ${item.quantity}`);
      });
    } else {
      console.log('No items found');
    }
    
  } catch (error) {
    console.error('Error refreshing view:', error);
  } finally {
    await pool.end();
  }
}

// Run the function
refreshView(); 