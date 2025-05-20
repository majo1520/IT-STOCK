#!/usr/bin/env node

/**
 * Script to check the data in the tables
 * 
 * Usage:
 *   node check_data.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Create PostgreSQL connection pool
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function checkData() {
  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    try {
      // Check items
      console.log('\n=== Items ===');
      const itemsResult = await client.query('SELECT id, name, quantity, box_id, type FROM items LIMIT 10');
      console.log(`Found ${itemsResult.rows.length} items`);
      itemsResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.name}, Quantity: ${row.quantity}, Box ID: ${row.box_id}, Type: ${row.type}`);
      });
      
      // Check item_transactions
      console.log('\n=== Item Transactions ===');
      const transactionsResult = await client.query('SELECT id, item_id, item_name, transaction_type, quantity, created_at FROM item_transactions LIMIT 10');
      console.log(`Found ${transactionsResult.rows.length} item transactions`);
      transactionsResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Item ID: ${row.item_id}, Item Name: ${row.item_name}, Type: ${row.transaction_type}, Quantity: ${row.quantity}, Created At: ${row.created_at}`);
      });
      
      // Check item_properties
      console.log('\n=== Item Properties ===');
      const propertiesResult = await client.query('SELECT id, item_id, type, ean_code, serial_number FROM item_properties LIMIT 10');
      console.log(`Found ${propertiesResult.rows.length} item properties`);
      propertiesResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Item ID: ${row.item_id}, Type: ${row.type}, EAN Code: ${row.ean_code}, Serial Number: ${row.serial_number}`);
      });
      
      // Check customers
      console.log('\n=== Customers ===');
      const customersResult = await client.query('SELECT id, name, contact_person, email FROM customers LIMIT 10');
      console.log(`Found ${customersResult.rows.length} customers`);
      customersResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.name}, Contact Person: ${row.contact_person}, Email: ${row.email}`);
      });
      
      // Check roles
      console.log('\n=== Roles ===');
      const rolesResult = await client.query('SELECT id, name, description, color FROM roles LIMIT 10');
      console.log(`Found ${rolesResult.rows.length} roles`);
      rolesResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Name: ${row.name}, Description: ${row.description}, Color: ${row.color}`);
      });
      
      console.log('\nData check completed');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error checking data:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the check
checkData().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 