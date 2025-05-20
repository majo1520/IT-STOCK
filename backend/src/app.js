const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('../config/database');
const routes = require('./routes');
const logger = require('../utils/logger');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // Use environment variable or allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
};

// Create a custom morgan token for logging request body
morgan.token('req-body', (req) => {
  const body = { ...req.body };
  // Remove sensitive information
  if (body.password) body.password = '[REDACTED]';
  if (body.token) body.token = '[REDACTED]';
  return JSON.stringify(body);
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
if (process.env.LOG_HTTP_REQUESTS !== 'false') {
  app.use(morgan(':method :url :status :response-time ms - :req-body', {
    stream: {
      write: (message) => logger.http(message.trim())
    },
    skip: (req) => {
      // Skip logging for health check requests to reduce noise
      return req.url === '/api/health-check';
    }
  }));
}

// API Routes - prefix with /api
app.use('/api', routes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ReactStock API' });
});

// 404 handler
app.use((req, res, next) => {
  logger.warn(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorMessage = err.message || 'Internal Server Error';
  
  // Log the error
  logger.error(`Error processing request: ${req.method} ${req.url}`, {
    error: errorMessage,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // Send error response
  res.status(statusCode).json({
    error: errorMessage,
    path: req.url,
    timestamp: new Date().toISOString()
  });
});

// Test database connection on startup
const checkDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL database');
    client.release();
    return true;
  } catch (err) {
    logger.error('Error connecting to database:', { error: err.message, stack: err.stack });
    return false;
  }
};

module.exports = { app, checkDatabaseConnection }; 