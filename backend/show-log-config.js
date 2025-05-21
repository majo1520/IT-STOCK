/**
 * Script to show current logging configuration from .env file
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Path to .env file
const envPath = path.join(__dirname, '.env');

try {
  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found. Please run create-env.js first.');
    process.exit(1);
  }

  // Load environment variables from .env file
  dotenv.config({ path: envPath });
  
  console.log('Current logging configuration:');
  console.log(`- LOG_LEVEL=${process.env.LOG_LEVEL || 'info'}`);
  console.log(`- LOG_MAX_SIZE=${process.env.LOG_MAX_SIZE || '20m'}`);
  console.log(`- LOG_MAX_FILES=${process.env.LOG_MAX_FILES || '14d'}`);
  console.log(`- LOG_TO_CONSOLE=${process.env.LOG_TO_CONSOLE !== 'false' ? 'true' : 'false'}`);
  console.log(`- LOG_HTTP_REQUESTS=${process.env.LOG_HTTP_REQUESTS !== 'false' ? 'true' : 'false'}`);
  
  console.log('\nTo update these settings, use update-log-config.js');
  console.log('Example: node update-log-config.js debug 50m 30d true true');
} catch (err) {
  console.error('Error reading .env file:', err);
} 