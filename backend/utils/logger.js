const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get log settings from environment variables or use defaults
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
const MAX_FILES = process.env.LOG_MAX_FILES || '14d';
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false';
const CONSOLE_VERBOSITY = process.env.CONSOLE_VERBOSITY || 'normal';

// SQL logging options
const LOG_SQL_QUERIES = process.env.LOG_SQL_QUERIES === 'true';
const LOG_QUERY_RESULTS = process.env.LOG_QUERY_RESULTS === 'true';
const LOG_QUERY_PARAMS = process.env.LOG_QUERY_PARAMS === 'true';

// Log the configuration being used
console.log('Logger configuration:');
console.log(`- LOG_LEVEL: ${LOG_LEVEL}`);
console.log(`- MAX_SIZE: ${MAX_SIZE}`);
console.log(`- MAX_FILES: ${MAX_FILES}`);
console.log(`- LOG_TO_CONSOLE: ${LOG_TO_CONSOLE}`);
console.log(`- CONSOLE_VERBOSITY: ${CONSOLE_VERBOSITY}`);
console.log(`- LOG_SQL_QUERIES: ${LOG_SQL_QUERIES}`);
console.log(`- LOG_QUERY_RESULTS: ${LOG_QUERY_RESULTS}`);
console.log(`- LOG_QUERY_PARAMS: ${LOG_QUERY_PARAMS}`);

// Create a rotating file transport for errors
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: MAX_SIZE,
  maxFiles: MAX_FILES,
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create a rotating file transport for all logs
const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: MAX_SIZE,
  maxFiles: MAX_FILES,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Define transports array
const transports = [errorFileTransport, combinedFileTransport];

// Add console transport if enabled
if (LOG_TO_CONSOLE) {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    )
  }));
}

// Create the logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'reactstock-api' },
  transports
});

// Add events for when log rotation occurs
errorFileTransport.on('rotate', function(oldFilename, newFilename) {
  logger.info(`Error log rotated from ${oldFilename} to ${newFilename}`);
});

combinedFileTransport.on('rotate', function(oldFilename, newFilename) {
  logger.info(`Combined log rotated from ${oldFilename} to ${newFilename}`);
});

// Helper methods for SQL logging
const sqlLogger = {
  logQuery: (query, params) => {
    if (LOG_SQL_QUERIES) {
      logger.debug(`SQL Query: ${query}`);
      
      if (LOG_QUERY_PARAMS && params && params.length > 0) {
        logger.debug(`Query Params: ${JSON.stringify(params)}`);
      }
    }
  },
  
  logQueryResults: (results) => {
    if (LOG_QUERY_RESULTS) {
      if (Array.isArray(results)) {
        logger.debug(`Query returned ${results.length} rows`);
        if (CONSOLE_VERBOSITY === 'debug' && results.length > 0) {
          logger.debug(`First row sample: ${JSON.stringify(results[0])}`);
        }
      } else {
        logger.debug(`Query result: ${JSON.stringify(results)}`);
      }
    }
  }
};

// Extend the logger with SQL logging methods
logger.sql = sqlLogger;

module.exports = logger; 