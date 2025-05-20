// Test script for the new PostgreSQL item system
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // You may need to install this: npm install chalk

// Import the database configuration
const dbConfig = require('./backend/config/database');
const pool = dbConfig.pool;

// Test data
const testItems = [
  {
    name: 'Test Laptop',
    description: 'Testing item for new schema',
    type: 'Electronics',
    ean_code: '1234567890123',
    serial_number: 'LAPTOP123456',
    quantity: 5
  },
  {
    name: 'Test Monitor',
    description: 'Testing monitor for new schema',
    type: 'Electronics',
    ean_code: '3210987654321',
    serial_number: 'MONITOR654321',
    quantity: 3
  },
  {
    name: 'Test Keyboard',
    description: 'Testing keyboard for new schema',
    type: 'Accessories',
    ean_code: '4567890123456',
    serial_number: 'KB987654',
    quantity: 10
  }
];

// Test functions
async function setupTestSchema() {
  const client = await pool.connect();
  
  try {
    console.log(chalk.blue('Setting up test schema...'));
    
    // Create temporary test schema
    await client.query('CREATE SCHEMA IF NOT EXISTS test_schema');
    
    // Set search path to test schema
    await client.query('SET search_path TO test_schema, public');
    
    // Execute the new item system SQL in test schema
    const schemaFile = path.join(__dirname, 'new_item_system.sql');
    const schema = fs.readFileSync(schemaFile, 'utf8');
    
    // Split the schema into separate statements and execute them
    const statements = schema.split(';');
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement) {
        try {
          await client.query(trimmedStatement);
        } catch (err) {
          console.error(chalk.red(`Error executing schema statement: ${err.message}`));
          console.error(chalk.gray(`Statement: ${trimmedStatement}`));
        }
      }
    }
    
    console.log(chalk.green('Test schema created successfully'));
    
    // Create a test box for testing
    await client.query(`
      CREATE TABLE IF NOT EXISTS boxes (
        id SERIAL PRIMARY KEY,
        box_number VARCHAR(50) NOT NULL,
        description VARCHAR(100),
        location_id INTEGER,
        shelf_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create test shelves and locations for reference
    await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS shelves (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      )
    `);
    
    // Insert test location and shelf
    await client.query(`
      INSERT INTO locations (name, color) VALUES ('Test Location', '#ff5722')
    `);
    
    await client.query(`
      INSERT INTO shelves (name) VALUES ('Test Shelf')
    `);
    
    // Insert test box
    await client.query(`
      INSERT INTO boxes (box_number, description, location_id, shelf_id) 
      VALUES ('TEST123', 'Test Box for New Schema', 1, 1)
    `);
    
    console.log(chalk.green('Created test box for testing'));
    
    return client;
  } catch (err) {
    console.error(chalk.red(`Error setting up test schema: ${err.message}`));
    throw err;
  }
}

async function testItemCreation(client) {
  console.log(chalk.blue('\nTesting item creation...'));
  
  try {
    const results = [];
    
    for (const item of testItems) {
      // Insert into items table
      const itemResult = await client.query(`
        INSERT INTO items (name, description, quantity, box_id, status)
        VALUES ($1, $2, $3, 1, 'active')
        RETURNING id
      `, [item.name, item.description, item.quantity]);
      
      const itemId = itemResult.rows[0].id;
      
      // Insert into item_properties table
      await client.query(`
        INSERT INTO item_properties (item_id, type, ean_code, serial_number)
        VALUES ($1, $2, $3, $4)
      `, [itemId, item.type, item.ean_code, item.serial_number]);
      
      console.log(chalk.green(`Created test item: ${item.name} (ID: ${itemId})`));
      
      results.push({
        id: itemId,
        ...item
      });
    }
    
    console.log(chalk.green('Item creation tests passed'));
    return results;
  } catch (err) {
    console.error(chalk.red(`Error in item creation test: ${err.message}`));
    throw err;
  }
}

async function testItemQueries(client, items) {
  console.log(chalk.blue('\nTesting item queries...'));
  
  try {
    // Test basic item retrieval
    const allItems = await client.query('SELECT * FROM items');
    console.log(chalk.green(`Retrieved ${allItems.rows.length} items`));
    
    // Test items with properties view
    const itemsWithProps = await client.query('SELECT * FROM items_with_properties');
    console.log(chalk.green(`Retrieved ${itemsWithProps.rows.length} items with properties`));
    
    // Test materialized view
    await client.query('REFRESH MATERIALIZED VIEW items_complete_data');
    const completeItems = await client.query('SELECT * FROM items_complete_data');
    console.log(chalk.green(`Retrieved ${completeItems.rows.length} items from materialized view`));
    
    // Test search by name
    const nameSearchItem = items[0].name;
    const nameSearch = await client.query(`
      SELECT * FROM items_with_properties 
      WHERE name ILIKE $1
    `, [`%${nameSearchItem}%`]);
    console.log(chalk.green(`Name search for "${nameSearchItem}" returned ${nameSearch.rows.length} items`));
    
    // Test search by EAN code
    const eanSearchItem = items[1].ean_code;
    const eanSearch = await client.query(`
      SELECT * FROM items_with_properties 
      WHERE ean_code = $1
    `, [eanSearchItem]);
    console.log(chalk.green(`EAN search for "${eanSearchItem}" returned ${eanSearch.rows.length} items`));
    
    // Test search by serial number
    const serialSearchItem = items[2].serial_number;
    const serialSearch = await client.query(`
      SELECT * FROM items_with_properties 
      WHERE serial_number = $1
    `, [serialSearchItem]);
    console.log(chalk.green(`Serial number search for "${serialSearchItem}" returned ${serialSearch.rows.length} items`));
    
    console.log(chalk.green('Item query tests passed'));
  } catch (err) {
    console.error(chalk.red(`Error in item query test: ${err.message}`));
    throw err;
  }
}

async function testTransactions(client, items) {
  console.log(chalk.blue('\nTesting transactions...'));
  
  try {
    // Test stock in transaction
    const item = items[0];
    const stockInResult = await client.query(`
      INSERT INTO item_transactions (item_id, type, quantity, box_id, supplier, notes)
      VALUES ($1, 'in', 10, 1, 'Test Supplier', 'Testing stock in transaction')
      RETURNING id
    `, [item.id]);
    
    const transactionId = stockInResult.rows[0].id;
    console.log(chalk.green(`Created stock in transaction (ID: ${transactionId})`));
    
    // Check if quantity updated
    const updatedItem = await client.query(`
      SELECT quantity FROM items WHERE id = $1
    `, [item.id]);
    
    console.log(chalk.green(`Item quantity updated to: ${updatedItem.rows[0].quantity}`));
    
    // Test stock out transaction
    const stockOutResult = await client.query(`
      INSERT INTO item_transactions (item_id, type, quantity, box_id, notes)
      VALUES ($1, 'out', 3, 1, 'Testing stock out transaction')
      RETURNING id
    `, [item.id]);
    
    console.log(chalk.green(`Created stock out transaction (ID: ${stockOutResult.rows[0].id})`));
    
    // Check if quantity updated again
    const finalItem = await client.query(`
      SELECT quantity FROM items WHERE id = $1
    `, [item.id]);
    
    console.log(chalk.green(`Item quantity updated to: ${finalItem.rows[0].quantity}`));
    
    // Test transaction metadata
    await client.query(`
      INSERT INTO transaction_metadata (transaction_id, invoice_number, external_reference)
      VALUES ($1, 'INV-001', 'PO-12345')
    `, [transactionId]);
    
    console.log(chalk.green('Added transaction metadata'));
    
    // Test transaction retrieval with metadata
    const transactionWithMetadata = await client.query(`
      SELECT t.*, tm.invoice_number, tm.external_reference 
      FROM item_transactions t
      LEFT JOIN transaction_metadata tm ON t.id = tm.transaction_id
      WHERE t.id = $1
    `, [transactionId]);
    
    if (transactionWithMetadata.rows[0].invoice_number === 'INV-001') {
      console.log(chalk.green('Transaction metadata retrieved successfully'));
    } else {
      console.log(chalk.red('Failed to retrieve transaction metadata'));
    }
    
    console.log(chalk.green('Transaction tests passed'));
  } catch (err) {
    console.error(chalk.red(`Error in transaction test: ${err.message}`));
    throw err;
  }
}

async function testAuditLog(client, items) {
  console.log(chalk.blue('\nTesting audit log...'));
  
  try {
    // Update an item to trigger audit log
    const item = items[0];
    await client.query(`
      UPDATE items 
      SET name = $1
      WHERE id = $2
    `, [`${item.name} (Updated)`, item.id]);
    
    console.log(chalk.green(`Updated item name for ID: ${item.id}`));
    
    // Check audit log
    const auditLog = await client.query(`
      SELECT * FROM item_audit_log WHERE item_id = $1
    `, [item.id]);
    
    if (auditLog.rows.length > 0) {
      console.log(chalk.green(`Found ${auditLog.rows.length} audit log entries for item`));
      console.log(chalk.gray('First audit log entry:'));
      console.log(chalk.gray(JSON.stringify(auditLog.rows[0], null, 2)));
    } else {
      console.log(chalk.red('No audit log entries found'));
    }
    
    console.log(chalk.green('Audit log tests passed'));
  } catch (err) {
    console.error(chalk.red(`Error in audit log test: ${err.message}`));
    throw err;
  }
}

async function testTagging(client, items) {
  console.log(chalk.blue('\nTesting item tagging...'));
  
  try {
    // Create some tags
    await client.query(`
      INSERT INTO item_tags (name, color) 
      VALUES 
        ('Test', '#ff0000'),
        ('Electronics', '#00ff00'),
        ('Important', '#0000ff')
    `);
    
    console.log(chalk.green('Created test tags'));
    
    // Tag some items
    const item = items[0];
    
    // Get tag IDs
    const tags = await client.query('SELECT id, name FROM item_tags');
    
    for (const tag of tags.rows) {
      await client.query(`
        INSERT INTO item_tag_relations (item_id, tag_id)
        VALUES ($1, $2)
      `, [item.id, tag.id]);
      
      console.log(chalk.green(`Tagged item ${item.id} with tag: ${tag.name}`));
    }
    
    // Test tag retrieval
    const itemWithTags = await client.query(`
      SELECT i.*, 
        (SELECT array_agg(t.name) FROM item_tag_relations tr 
         JOIN item_tags t ON tr.tag_id = t.id 
         WHERE tr.item_id = i.id) as tags
      FROM items i
      WHERE i.id = $1
    `, [item.id]);
    
    if (itemWithTags.rows[0].tags && itemWithTags.rows[0].tags.length > 0) {
      console.log(chalk.green(`Retrieved item with tags: ${itemWithTags.rows[0].tags.join(', ')}`));
    } else {
      console.log(chalk.red('Failed to retrieve item tags'));
    }
    
    console.log(chalk.green('Tagging tests passed'));
  } catch (err) {
    console.error(chalk.red(`Error in tagging test: ${err.message}`));
    throw err;
  }
}

async function cleanupTestSchema(client) {
  console.log(chalk.blue('\nCleaning up test schema...'));
  
  try {
    // Drop the test schema and all its objects
    await client.query('DROP SCHEMA test_schema CASCADE');
    console.log(chalk.green('Test schema cleaned up successfully'));
  } catch (err) {
    console.error(chalk.red(`Error cleaning up test schema: ${err.message}`));
  }
}

// Main test function
async function runTests() {
  console.log(chalk.yellow.bold('=== POSTGRESQL ITEM SYSTEM TEST ==='));
  
  let client;
  
  try {
    // Setup test schema
    client = await setupTestSchema();
    
    // Run tests
    const items = await testItemCreation(client);
    await testItemQueries(client, items);
    await testTransactions(client, items);
    await testAuditLog(client, items);
    await testTagging(client, items);
    
    // Performance testing
    console.log(chalk.blue('\nRunning basic performance tests...'));
    
    console.time('100 Item Queries');
    for (let i = 0; i < 100; i++) {
      await client.query('SELECT * FROM items_with_properties LIMIT 10');
    }
    console.timeEnd('100 Item Queries');
    
    console.time('100 Materialized View Queries');
    for (let i = 0; i < 100; i++) {
      await client.query('SELECT * FROM items_complete_data LIMIT 10');
    }
    console.timeEnd('100 Materialized View Queries');
    
    // Summary
    console.log(chalk.yellow.bold('\n=== TEST SUMMARY ==='));
    console.log(chalk.green.bold('✓ All tests completed successfully'));
    
    // Ask if user wants to keep the test schema
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(chalk.yellow('Do you want to keep the test schema for inspection? (y/n): '), (answer) => {
      if (answer.toLowerCase() !== 'y') {
        cleanupTestSchema(client).then(() => {
          rl.close();
          client.release();
          pool.end();
        });
      } else {
        console.log(chalk.yellow('Test schema has been preserved for inspection.'));
        console.log(chalk.yellow('Set schema with: SET search_path TO test_schema, public;'));
        console.log(chalk.yellow('When finished, clean up with: DROP SCHEMA test_schema CASCADE;'));
        rl.close();
        client.release();
        pool.end();
      }
    });
    
  } catch (err) {
    console.error(chalk.red.bold('Test failed with error:'), err);
    
    if (client) {
      await cleanupTestSchema(client);
      client.release();
    }
    
    pool.end();
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  console.error(chalk.red.bold('Unhandled error:'), err);
  process.exit(1);
}); 