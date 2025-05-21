/**
 * Application Configuration
 * Central place for application-wide configuration settings
 */

// Get the current hostname and port
const hostname = window.location.hostname;
const port = window.location.port;
const protocol = window.location.protocol;

// Check if running in a development environment
// Development environments typically use localhost or are IP addresses
const isDevelopment = hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

// API base URL - configured based on environment
const apiBaseUrl = isDevelopment 
  ? `http://${hostname}:3000/api` 
  : `/api`;

// Application base URL - include protocol and port if it exists in production
const appBaseUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}`;

// Export configuration object
const config = {
  apiBaseUrl,
  appBaseUrl,
  isDevelopment
};

export default config; 