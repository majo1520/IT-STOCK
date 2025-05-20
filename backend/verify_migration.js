#!/usr/bin/env node

/**
 * Script to verify migration by counting records in each table
 * 
 * Usage:
 *   node verify_migration.js
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

async function verifyMigration() {
  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    try {
      // Check if tables exist
      const tables = [
        'items', 
        'boxes', 
        'item_transactions', 
        'item_properties', 
        'customers', 
        'roles', 
        'removal_reasons',
        'users',
        'locations',
        'shelves'
      ];
      
      console.log('=== Migration Verification ===\n');
      
      // Count records in each table
      for (const table of tables) {
        try {
          const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`${table}: ${result.rows[0].count} records`);
        } catch (error) {
          console.log(`${table}: Table does not exist or cannot be accessed`);
        }
      }
      
      // Check item transactions specifically
      try {
        const typesResult = await client.query(`
          SELECT transaction_type, COUNT(*) 
          FROM item_transactions 
          GROUP BY transaction_type 
          ORDER BY COUNT(*) DESC
        `);
        
        console.log('\n=== Item Transaction Types ===');
        typesResult.rows.forEach(row => {
          console.log(`${row.transaction_type}: ${row.count} records`);
        });
      } catch (error) {
        console.log('Cannot query item transaction types');
      }
      
      // Check item properties
      try {
        const propertiesResult = await client.query(`
          SELECT COUNT(*) as total,
                 COUNT(type) as with_type,
                 COUNT(ean_code) as with_ean,
                 COUNT(serial_number) as with_serial
          FROM item_properties
        `);
        
        if (propertiesResult.rows.length > 0) {
          const props = propertiesResult.rows[0];
          console.log('\n=== Item Properties ===');
          console.log(`Total: ${props.total}`);
          console.log(`With type: ${props.with_type}`);
          console.log(`With EAN code: ${props.with_ean}`);
          console.log(`With serial number: ${props.with_serial}`);
        }
      } catch (error) {
        console.log('Cannot query item properties');
      }
      
      console.log('\nMigration verification completed');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error verifying migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyMigration().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 