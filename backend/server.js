const { app, checkDatabaseConnection } = require('./src/app');
const http = require('http');
const { runMigrations } = require('./utils/db-init');
const logger = require('./utils/logger');
const { createWebSocketServer } = require('./src/websocket');

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wsServer = createWebSocketServer(server);

// Add WebSocket server to global scope for use in controllers
global.wsServer = wsServer;

// Initialize and check database structure
const initializeDatabase = async () => {
  try {
    logger.info('Running database migrations...');
    await runMigrations();
    return true;
  } catch (err) {
    logger.error('Failed to initialize database:', { error: err.message, stack: err.stack });
    return false;
  }
};

// Start server
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

(async function startServer() {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Server not started.');
      process.exit(1);
    }
    
    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      logger.error('Failed to initialize database. Server not started.');
      process.exit(1);
    }
    
    // Start server
    server.listen(PORT, HOST, () => {
      logger.info(`HTTP Server is running on http://${HOST}:${PORT}`);
      logger.info(`WebSocket Server is running on ws://${HOST}:${PORT}/ws`);
    });
  } catch (err) {
    logger.error('Failed to start server:', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})(); 