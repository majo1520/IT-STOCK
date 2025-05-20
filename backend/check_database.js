#!/usr/bin/env node

/**
 * Script to check the database schema and tables
 * 
 * Usage:
 *   node check_database.js
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

async function checkDatabase() {
  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');

    try {
      // List all tables
      console.log('\n=== Tables ===');
      const tablesResult = await client.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      tablesResult.rows.forEach(row => {
        console.log(`${row.table_name} (${row.table_schema})`);
      });
      
      // List columns for item_transactions table
      console.log('\n=== item_transactions columns ===');
      try {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'item_transactions'
          ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(row => {
          console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
      } catch (err) {
        console.log('Table item_transactions does not exist');
      }
      
      // List columns for customers table
      console.log('\n=== customers columns ===');
      try {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'customers'
          ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(row => {
          console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
      } catch (err) {
        console.log('Table customers does not exist');
      }
      
      // List columns for items table
      console.log('\n=== items columns ===');
      try {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'items'
          ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(row => {
          console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
      } catch (err) {
        console.log('Table items does not exist');
      }
      
      // List columns for item_properties table
      console.log('\n=== item_properties columns ===');
      try {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'item_properties'
          ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(row => {
          console.log(`${row.column_name} (${row.data_type}, ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
      } catch (err) {
        console.log('Table item_properties does not exist');
      }
      
      console.log('\nDatabase check completed');

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the check
checkDatabase().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 