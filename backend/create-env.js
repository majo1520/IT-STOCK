/**
 * Script to generate .env file with logging configuration
 */
const fs = require('fs');
const path = require('path');

const envContent = `# Server Configuration
PORT=5000
HOST=0.0.0.0
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Database Configuration
PGUSER=postgres
PGHOST=localhost
PGDATABASE=reactstock
PGPASSWORD=your-password-here
PGPORT=5432

# Database Connection Pool Configuration
PG_MAX_CONNECTIONS=20
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=2000
PG_MAX_USES=7500

# CORS Configuration
# For production, set this to your actual frontend origin
# CORS_ORIGIN=https://your-frontend-domain.com

# Logging Configuration
LOG_LEVEL=info              # Possible values: error, warn, info, http, verbose, debug, silly
LOG_MAX_SIZE=20m            # Maximum size of each log file before rotation
LOG_MAX_FILES=14d           # Maximum number of log files to keep (can be days or number)
LOG_TO_CONSOLE=true         # Whether to log to console in addition to files
LOG_HTTP_REQUESTS=true      # Whether to log HTTP requests
`;

const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent);
  console.log(`Successfully created .env file at ${envPath}`);
  console.log('Logging configuration:');
  console.log('- LOG_LEVEL=info');
  console.log('- LOG_MAX_SIZE=20m');
  console.log('- LOG_MAX_FILES=14d');
  console.log('- LOG_TO_CONSOLE=true');
  console.log('- LOG_HTTP_REQUESTS=true');
} catch (err) {
  console.error('Error creating .env file:', err);
} 