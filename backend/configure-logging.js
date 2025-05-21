/**
 * Configure Logging Settings Script
 * 
 * This script updates the .env file with predefined logging settings
 * without requiring user interaction.
 */
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Define the configuration to apply
const loggingConfig = {
  // Logging Configuration
  LOG_LEVEL: 'info',
  LOG_MAX_SIZE: '20m',
  LOG_MAX_FILES: '14d',
  LOG_TO_CONSOLE: 'true',
  LOG_HTTP_REQUESTS: 'true',
  
  // Verbose Logging Configuration
  LOG_SQL_QUERIES: 'false',  // Set to 'true' to enable SQL query logging
  LOG_QUERY_RESULTS: 'false', // Set to 'true' to log query results
  LOG_QUERY_PARAMS: 'false',  // Set to 'true' to log query parameters
  CONSOLE_VERBOSITY: 'normal' // Options: minimal, normal, verbose, debug
};

async function configureLogging() {
  try {
    console.log('Configuring logging settings...');
    
    // Path to the .env file
    const envPath = path.join(__dirname, '.env');
    
    // Check if the .env file exists
    let envConfig = {};
    try {
      // Read existing .env file
      const envContent = await fs.readFile(envPath, 'utf8');
      // Parse existing values
      envConfig = dotenv.parse(envContent);
      console.log('Found existing .env file. Updating logging settings...');
    } catch (err) {
      console.log('No existing .env file found. Creating a new one with default settings...');
      // We'll create a minimal .env file with just the logging settings
      envConfig = {
        PORT: '5000',
        HOST: '0.0.0.0',
        NODE_ENV: 'production',
        JWT_SECRET: `reactstock-jwt-secret-${Math.random().toString(36).substring(2, 15)}`,
        JWT_EXPIRES_IN: '24h',
        CORS_ORIGIN: '*'
      };
    }
    
    // Merge the logging configuration with existing values
    const updatedConfig = { ...envConfig, ...loggingConfig };
    
    // Generate the .env file content
    const envContent = Object.entries(updatedConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write the updated .env file
    await fs.writeFile(envPath, envContent);
    
    console.log('Logging settings configured successfully!');
    console.log('\nApplied the following logging settings:');
    for (const [key, value] of Object.entries(loggingConfig)) {
      console.log(`- ${key}: ${value}`);
    }
    
    console.log('\nTo apply these changes, restart the backend service:');
    console.log('sudo systemctl restart reactstock-backend');
    
  } catch (err) {
    console.error('Error configuring logging settings:', err);
  }
}

configureLogging(); 