/**
 * Setup Environment Configuration Script
 * 
 * This script creates or updates the .env file for the ReactStock backend
 * with the specified configuration values.
 */
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Default configuration values
const defaultConfig = {
  // Server Configuration
  PORT: 5000,
  HOST: '0.0.0.0',
  NODE_ENV: 'production',
  
  // JWT Configuration
  JWT_SECRET: `reactstock-jwt-secret-${Math.random().toString(36).substring(2, 15)}`,
  JWT_EXPIRES_IN: '24h',
  
  // Database Configuration
  PGUSER: 'postgres',
  PGHOST: 'localhost',
  PGDATABASE: 'reactstock',
  PGPASSWORD: '',
  PGPORT: 5432,
  
  // Database Connection Pool Configuration
  PG_MAX_CONNECTIONS: 20,
  PG_IDLE_TIMEOUT: 30000,
  PG_CONNECTION_TIMEOUT: 2000,
  PG_MAX_USES: 7500,
  
  // CORS Configuration
  CORS_ORIGIN: '*',
  
  // Logging Configuration
  LOG_LEVEL: 'info',
  LOG_MAX_SIZE: '20m',
  LOG_MAX_FILES: '14d',
  LOG_TO_CONSOLE: true,
  LOG_HTTP_REQUESTS: true,
  
  // Verbose Logging Configuration
  LOG_SQL_QUERIES: false,
  LOG_QUERY_RESULTS: false,
  LOG_QUERY_PARAMS: false,
  CONSOLE_VERBOSITY: 'normal'
};

// Generate the .env file content
const generateEnvContent = (config) => {
  return `# Server Configuration
PORT=${config.PORT}
HOST=${config.HOST}
NODE_ENV=${config.NODE_ENV}

# JWT Configuration - Make sure to change this in production
JWT_SECRET=${config.JWT_SECRET}
JWT_EXPIRES_IN=${config.JWT_EXPIRES_IN}

# Database Configuration - Adjust as needed
PGUSER=${config.PGUSER}
PGHOST=${config.PGHOST}
PGDATABASE=${config.PGDATABASE}
PGPASSWORD=${config.PGPASSWORD}
PGPORT=${config.PGPORT}

# Database Connection Pool Configuration
PG_MAX_CONNECTIONS=${config.PG_MAX_CONNECTIONS}
PG_IDLE_TIMEOUT=${config.PG_IDLE_TIMEOUT}
PG_CONNECTION_TIMEOUT=${config.PG_CONNECTION_TIMEOUT}
PG_MAX_USES=${config.PG_MAX_USES}

# CORS Configuration - Change to your frontend URL in production
CORS_ORIGIN=${config.CORS_ORIGIN}

# Logging Configuration
LOG_LEVEL=${config.LOG_LEVEL}
LOG_MAX_SIZE=${config.LOG_MAX_SIZE}
LOG_MAX_FILES=${config.LOG_MAX_FILES}
LOG_TO_CONSOLE=${config.LOG_TO_CONSOLE}
LOG_HTTP_REQUESTS=${config.LOG_HTTP_REQUESTS}

# Verbose Logging Configuration
LOG_SQL_QUERIES=${config.LOG_SQL_QUERIES}
LOG_QUERY_RESULTS=${config.LOG_QUERY_RESULTS}
LOG_QUERY_PARAMS=${config.LOG_QUERY_PARAMS}
CONSOLE_VERBOSITY=${config.CONSOLE_VERBOSITY}
`;
};

// Main function to setup the environment
async function setupEnv() {
  console.log('\n=== ReactStock Backend Environment Setup ===\n');
  
  try {
    // Check if .env file already exists
    const envPath = path.join(__dirname, '.env');
    let existingEnv = null;
    
    try {
      existingEnv = await fs.readFile(envPath, 'utf8');
      console.log('Existing .env file found. Updating configuration...');
    } catch (err) {
      console.log('No existing .env file found. Creating a new one...');
    }
    
    // Configure logging settings
    console.log('\n--- Logging Configuration ---');
    const logSqlQueries = await prompt('Enable SQL query logging? (true/false) [default: false]: ');
    const logQueryResults = await prompt('Enable query results logging? (true/false) [default: false]: ');
    const logQueryParams = await prompt('Enable query parameters logging? (true/false) [default: false]: ');
    const consoleVerbosity = await prompt('Console verbosity level? (minimal/normal/verbose/debug) [default: normal]: ');
    
    // Update default config with user input
    const config = { ...defaultConfig };
    if (logSqlQueries) config.LOG_SQL_QUERIES = logSqlQueries.toLowerCase() === 'true';
    if (logQueryResults) config.LOG_QUERY_RESULTS = logQueryResults.toLowerCase() === 'true';
    if (logQueryParams) config.LOG_QUERY_PARAMS = logQueryParams.toLowerCase() === 'true';
    if (consoleVerbosity) config.CONSOLE_VERBOSITY = consoleVerbosity || 'normal';
    
    // Generate the .env file content
    const envContent = generateEnvContent(config);
    
    // Write the .env file
    await fs.writeFile(envPath, envContent);
    console.log(`\nEnvironment configuration saved to ${envPath}`);
    
    // Display instructions
    console.log('\n=== Setup Complete ===');
    console.log('To apply these changes, restart the backend service:');
    console.log('sudo systemctl restart reactstock-backend');
    
  } catch (err) {
    console.error('Error setting up environment:', err);
  } finally {
    rl.close();
  }
}

// Run the setup
setupEnv(); 