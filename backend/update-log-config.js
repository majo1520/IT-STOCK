/**
 * Script to update logging configuration in .env file
 * Usage: node update-log-config.js [level] [maxSize] [maxFiles] [console] [httpRequests]
 * Example: node update-log-config.js debug 50m 30d true true
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Get command line arguments
const args = process.argv.slice(2);
const level = args[0] || 'info';
const maxSize = args[1] || '20m';
const maxFiles = args[2] || '14d';
const toConsole = args[3] === 'false' ? 'false' : 'true';
const httpRequests = args[4] === 'false' ? 'false' : 'true';

// Valid log levels
const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
if (!validLogLevels.includes(level)) {
  console.error(`Invalid log level: ${level}`);
  console.error(`Valid log levels: ${validLogLevels.join(', ')}`);
  process.exit(1);
}

// Path to .env file
const envPath = path.join(__dirname, '.env');

try {
  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found. Please run create-env.js first.');
    process.exit(1);
  }

  // Read the current .env file
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update the logging configuration
  const updatedContent = envContent
    .replace(/LOG_LEVEL=.+/, `LOG_LEVEL=${level}`)
    .replace(/LOG_MAX_SIZE=.+/, `LOG_MAX_SIZE=${maxSize}`)
    .replace(/LOG_MAX_FILES=.+/, `LOG_MAX_FILES=${maxFiles}`)
    .replace(/LOG_TO_CONSOLE=.+/, `LOG_TO_CONSOLE=${toConsole}`)
    .replace(/LOG_HTTP_REQUESTS=.+/, `LOG_HTTP_REQUESTS=${httpRequests}`);
  
  // Write the updated content back to the .env file
  fs.writeFileSync(envPath, updatedContent);
  
  console.log('Logging configuration updated:');
  console.log(`- LOG_LEVEL=${level}`);
  console.log(`- LOG_MAX_SIZE=${maxSize}`);
  console.log(`- LOG_MAX_FILES=${maxFiles}`);
  console.log(`- LOG_TO_CONSOLE=${toConsole}`);
  console.log(`- LOG_HTTP_REQUESTS=${httpRequests}`);
  
  console.log('\nTo apply these changes, restart your server.');
} catch (err) {
  console.error('Error updating .env file:', err);
} 