const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load configuration from environment variables or use defaults
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'reactstock',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

console.log('Connecting to database:', dbConfig.database);

const pool = new Pool(dbConfig);

async function setupMaterializedView() {
  const client = await pool.connect();
  
  try {
    console.log('Reading SQL file...');
    const sqlFile = path.join(__dirname, 'src', 'database', 'safe_view_setup.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('Executing SQL script...');
    const result = await client.query(sql);
    
    console.log('Materialized view setup completed successfully!');
    console.log('You should now see consistent item data in your application.');
    console.log('');
    console.log('If you encounter any issues, you can run the fallback system by not using the materialized view.');
    
    return true;
  } catch (error) {
    console.error('Error setting up materialized view:', error.message);
    console.error('The original controller code with fallback will continue to work.');
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupMaterializedView()
  .then(success => {
    if (success) {
      console.log('Setup completed successfully');
      process.exit(0);
    } else {
      console.error('Setup failed, but application should still work with fallback');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  }); 